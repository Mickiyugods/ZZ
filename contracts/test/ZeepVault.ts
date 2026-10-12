import { expect } from "chai";
import { readFileSync } from "node:fs";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("ZeepFeeRouter", function () {
  async function deployRouter() {
    const [deployer, vaultStandIn, treasury] = await ethers.getSigners();
    const escrow = await ethers.deployContract("MockPonsEscrow");
    const router = await ethers.deployContract("ZeepFeeRouter", [
      await vaultStandIn.getAddress(),
      await treasury.getAddress(),
      await escrow.getAddress(),
    ]);
    return { deployer, vaultStandIn, treasury, escrow, router };
  }

  it("reverts when there is nothing to harvest", async function () {
    const { router } = await deployRouter();
    await expect(router.harvest()).to.be.revertedWithCustomError(router, "NothingToHarvest");
  });

  it("splits a harvested amount 80/20 between vault and treasury", async function () {
    const { vaultStandIn, treasury, escrow, router } = await deployRouter();

    await escrow.fund(await router.getAddress(), { value: ethers.parseEther("1.0") });

    const vaultBefore = await ethers.provider.getBalance(await vaultStandIn.getAddress());
    const treasuryBefore = await ethers.provider.getBalance(await treasury.getAddress());

    await expect(router.harvest())
      .to.emit(router, "Harvested")
      .withArgs(ethers.parseEther("1.0"), ethers.parseEther("0.8"), ethers.parseEther("0.2"));

    const vaultAfter = await ethers.provider.getBalance(await vaultStandIn.getAddress());
    const treasuryAfter = await ethers.provider.getBalance(await treasury.getAddress());

    expect(vaultAfter - vaultBefore).to.equal(ethers.parseEther("0.8"));
    expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("0.2"));
  });

  it("also sweeps ETH sent to it directly (e.g. a creator tax)", async function () {
    const { deployer, vaultStandIn, router } = await deployRouter();
    await deployer.sendTransaction({ to: await router.getAddress(), value: ethers.parseEther("0.3") });

    const vaultBefore = await ethers.provider.getBalance(await vaultStandIn.getAddress());
    await router.harvest();
    const vaultAfter = await ethers.provider.getBalance(await vaultStandIn.getAddress());

    expect(vaultAfter - vaultBefore).to.equal(ethers.parseEther("0.24")); // 80% of 0.3
  });
});

describe("ZeepVault", function () {
  const TOKEN_ID = 42n;

  async function deployVault() {
    const [owner, keeper, seller, stranger] = await ethers.getSigners();
    const collection = await ethers.deployContract("MockERC721");
    const otherCollection = await ethers.deployContract("MockERC721");
    const seaport = await ethers.deployContract("MockSeaport");

    const vault = await ethers.deployContract("ZeepVault", [
      await collection.getAddress(),
      await seaport.getAddress(),
      await keeper.getAddress(),
      await owner.getAddress(),
    ]);

    await collection.mint(await seller.getAddress(), TOKEN_ID);
    await collection.connect(seller).setApprovalForAll(await seaport.getAddress(), true);

    // fund the vault like a FeeRouter harvest would
    await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("2") });

    return { owner, keeper, seller, stranger, collection, otherCollection, seaport, vault };
  }

  function basicOrder(overrides: Record<string, unknown> = {}) {
    return {
      considerationToken: ethers.ZeroAddress,
      considerationIdentifier: 0n,
      considerationAmount: ethers.parseEther("1"),
      offerer: ethers.ZeroAddress,
      zone: ethers.ZeroAddress,
      offerToken: ethers.ZeroAddress,
      offerIdentifier: TOKEN_ID,
      offerAmount: 1n,
      basicOrderType: 0,
      startTime: 0n,
      endTime: 0n,
      zoneHash: ethers.ZeroHash,
      salt: 0n,
      offererConduitKey: ethers.ZeroHash,
      fulfillerConduitKey: ethers.ZeroHash,
      totalOriginalAdditionalRecipients: 0n,
      additionalRecipients: [],
      signature: "0x",
      ...overrides,
    };
  }

  it("only the keeper can post a price ceiling", async function () {
    const { vault, stranger } = await deployVault();
    await expect(vault.connect(stranger).postCeiling(ethers.parseEther("1"))).to.be.revertedWithCustomError(vault, "NotKeeper");
  });

  it("rejects a buy before any ceiling is posted", async function () {
    const { vault, keeper, seller, collection } = await deployVault();
    const order = basicOrder({ offerToken: await collection.getAddress(), offerer: await seller.getAddress() });
    await expect(vault.connect(keeper).buy(order, TOKEN_ID)).to.be.revertedWithCustomError(vault, "NoCeilingPosted");
  });

  it("rejects a buy priced over the posted ceiling", async function () {
    const { vault, keeper, seller, collection } = await deployVault();
    await vault.connect(keeper).postCeiling(ethers.parseEther("0.5"));
    const order = basicOrder({ offerToken: await collection.getAddress(), offerer: await seller.getAddress(), considerationAmount: ethers.parseEther("1") });
    await expect(vault.connect(keeper).buy(order, TOKEN_ID)).to.be.revertedWithCustomError(vault, "OverCeiling");
  });

  it("rejects a buy from a collection other than its own", async function () {
    const { vault, keeper, seller, otherCollection } = await deployVault();
    await vault.connect(keeper).postCeiling(ethers.parseEther("1"));
    const order = basicOrder({ offerToken: await otherCollection.getAddress(), offerer: await seller.getAddress() });
    await expect(vault.connect(keeper).buy(order, TOKEN_ID)).to.be.revertedWithCustomError(vault, "WrongCollection");
  });

  it("rejects a buy once the ceiling has expired", async function () {
    const { vault, keeper, seller, collection } = await deployVault();
    await vault.connect(keeper).postCeiling(ethers.parseEther("1"));
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);
    const order = basicOrder({ offerToken: await collection.getAddress(), offerer: await seller.getAddress() });
    await expect(vault.connect(keeper).buy(order, TOKEN_ID)).to.be.revertedWithCustomError(vault, "CeilingExpired");
  });

  it("buys the NFT through Seaport and ends up owning it", async function () {
    const { vault, keeper, seller, collection } = await deployVault();
    await vault.connect(keeper).postCeiling(ethers.parseEther("1"));
    const order = basicOrder({ offerToken: await collection.getAddress(), offerer: await seller.getAddress(), considerationAmount: ethers.parseEther("1") });

    await expect(vault.connect(keeper).buy(order, TOKEN_ID)).to.emit(vault, "Purchased").withArgs(TOKEN_ID, ethers.parseEther("1"));

    expect(await collection.ownerOf(TOKEN_ID)).to.equal(await vault.getAddress());
    expect(await vault.priceCeiling()).to.equal(0n);
  });

  it("has no withdraw function at all", function () {
    const artifact = JSON.parse(readFileSync(new URL("../artifacts/src/ZeepVault.sol/ZeepVault.json", import.meta.url), "utf8"));
    const names = (artifact.abi as { name?: string }[]).map((f) => f.name).filter(Boolean);
    expect(names).to.not.include("withdraw");
    expect(names).to.not.include("rescue");
    expect(names).to.not.include("sweep");
  });

  it("only hands an NFT to its locked-in outcome handler, never anyone else", async function () {
    const { vault, keeper, seller, stranger, collection } = await deployVault();
    await vault.connect(keeper).postCeiling(ethers.parseEther("1"));
    const order = basicOrder({ offerToken: await collection.getAddress(), offerer: await seller.getAddress() });
    await vault.connect(keeper).buy(order, TOKEN_ID);

    await expect(vault.connect(stranger).handOffToOutcome(TOKEN_ID)).to.be.revertedWith("not outcome handler");
  });
});
