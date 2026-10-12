import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

function saltWithTag(tag: string): string {
  const tagBytes = ethers.toUtf8Bytes(tag);
  const rand = ethers.randomBytes(32 - tagBytes.length);
  return ethers.hexlify(ethers.concat([tagBytes, rand]));
}

function launchParams(overrides: Record<string, unknown> = {}) {
  return {
    name: "Charizard Fund",
    symbol: "CHZD",
    logo: "",
    description: "test",
    socials: { twitter: "", telegram: "", discord: "", website: "", farcaster: "" },
    creatorFeeRecipient: ethers.ZeroAddress, // overwritten by the launcher
    creatorTaxBps: 0,
    buybackEnabled: false,
    expectedEconomics: ethers.ZeroHash,
    salt: saltWithTag("ZEEP"),
    ...overrides,
  };
}

describe("ZeepLauncher", function () {
  async function deployLauncher() {
    const [registryOwner, keeper, treasury, deployer] = await ethers.getSigners();
    const escrow = await ethers.deployContract("MockPonsEscrow");
    const seaport = await ethers.deployContract("MockSeaport");
    const ponsFactory = await ethers.deployContract("MockPonsFactory");
    const collection = await ethers.deployContract("MockERC721");

    const launcher = await ethers.deployContract("ZeepLauncher", [
      await ponsFactory.getAddress(),
      await seaport.getAddress(),
      await treasury.getAddress(),
      await escrow.getAddress(),
      await registryOwner.getAddress(),
      await keeper.getAddress(),
    ]);

    return { registryOwner, keeper, treasury, deployer, escrow, seaport, ponsFactory, collection, launcher };
  }

  it("rejects a salt that doesn't carry the ZEEP tag", async function () {
    const { launcher, collection, deployer } = await deployLauncher();
    const fee = ethers.parseEther("0.0005");
    const params = launchParams({ salt: saltWithTag("NOPE") });
    await expect(
      launcher.connect(deployer).launch(params, 0, ethers.ZeroAddress, await collection.getAddress(), 1 /* Raffle */, { value: fee }),
    ).to.be.revertedWithCustomError(launcher, "BadSaltTag");
  });

  it("launches a coin and deploys its vault + fee router + raffle in one transaction (raffle policy)", async function () {
    const { launcher, collection, deployer, keeper } = await deployLauncher();
    const fee = ethers.parseEther("0.0005");
    const params = launchParams();

    const tx = await launcher.connect(deployer).launch(params, 0, ethers.ZeroAddress, await collection.getAddress(), 1 /* Raffle */, { value: fee });
    const receipt = await tx.wait();

    const event = receipt!.logs
      .map((log) => {
        try {
          return launcher.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "CoinLaunched");

    expect(event).to.not.be.undefined;
    const { token, curve, vault, feeRouter, raffle, collection: loggedCollection, policy } = event!.args;

    expect(token).to.not.equal(ethers.ZeroAddress);
    expect(curve).to.not.equal(ethers.ZeroAddress);
    expect(vault).to.not.equal(ethers.ZeroAddress);
    expect(feeRouter).to.not.equal(ethers.ZeroAddress);
    expect(raffle).to.not.equal(ethers.ZeroAddress);
    expect(loggedCollection).to.equal(await collection.getAddress());
    expect(policy).to.equal(1n);

    // The deployed vault really is wired to this exact raffle as its outcome handler,
    // and the raffle really is wired to this exact vault — not left dangling.
    const vaultContract = await ethers.getContractAt("ZeepVault", vault);
    expect(await vaultContract.outcomeHandler()).to.equal(raffle);
    expect(await vaultContract.keeper()).to.equal(await keeper.getAddress());

    const raffleContract = await ethers.getContractAt("ZeepRaffle", raffle);
    expect(await raffleContract.vault()).to.equal(vault);
    expect(await raffleContract.policy()).to.equal(0n); // ZeepRaffle.Policy.Raffle

    // The fee router really points at this exact vault + the launcher's treasury.
    const routerContract = await ethers.getContractAt("ZeepFeeRouter", feeRouter);
    expect(await routerContract.vault()).to.equal(vault);
  });

  it("deploys no raffle contract at all for hold-policy coins", async function () {
    const { launcher, collection, deployer } = await deployLauncher();
    const fee = ethers.parseEther("0.0005");
    const params = launchParams();

    const tx = await launcher.connect(deployer).launch(params, 0, ethers.ZeroAddress, await collection.getAddress(), 0 /* Hold */, { value: fee });
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((log) => {
        try {
          return launcher.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "CoinLaunched");

    expect(event!.args.raffle).to.equal(ethers.ZeroAddress);

    const vaultContract = await ethers.getContractAt("ZeepVault", event!.args.vault);
    expect(await vaultContract.outcomeHandler()).to.equal(ethers.ZeroAddress);
  });

  it("only the registry owner can rotate the keeper used for future launches", async function () {
    const { launcher, deployer } = await deployLauncher();
    await expect(launcher.connect(deployer).setKeeper(await deployer.getAddress())).to.be.revertedWith("not registry owner");
  });

  it("end to end: fee router harvests real escrow fees into the launched vault", async function () {
    const { launcher, collection, deployer, escrow } = await deployLauncher();
    const fee = ethers.parseEther("0.0005");
    const params = launchParams();

    const tx = await launcher.connect(deployer).launch(params, 0, ethers.ZeroAddress, await collection.getAddress(), 2 /* Burn */, { value: fee });
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((log) => {
        try {
          return launcher.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "CoinLaunched")!;

    const { vault, feeRouter } = event.args;

    await escrow.fund(feeRouter, { value: ethers.parseEther("1") });
    const routerContract = await ethers.getContractAt("ZeepFeeRouter", feeRouter);

    const vaultBalBefore = await ethers.provider.getBalance(vault);
    await routerContract.harvest();
    const vaultBalAfter = await ethers.provider.getBalance(vault);

    expect(vaultBalAfter - vaultBalBefore).to.equal(ethers.parseEther("0.8"));
  });
});
