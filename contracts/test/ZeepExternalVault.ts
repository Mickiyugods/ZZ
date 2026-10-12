import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("ZeepExternalVault", function () {
  async function deploy() {
    const [owner, keeper, stranger] = await ethers.getSigners();
    const vault = await ethers.deployContract("ZeepExternalVault", [
      "ethereum",
      "0xCourtyardCollectionAddress",
      await keeper.getAddress(),
      await owner.getAddress(),
    ]);
    await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("2") });
    return { owner, keeper, stranger, vault };
  }

  it("only the keeper can announce a withdrawal", async function () {
    const { vault, stranger } = await deploy();
    await expect(vault.connect(stranger).announceWithdrawal(ethers.parseEther("1"))).to.be.revertedWithCustomError(vault, "NotKeeper");
  });

  it("rejects announcing more than the vault holds", async function () {
    const { vault, keeper } = await deploy();
    await expect(vault.connect(keeper).announceWithdrawal(ethers.parseEther("99"))).to.be.revertedWithCustomError(vault, "InsufficientBalance");
  });

  it("cannot execute before the 1 hour wait elapses", async function () {
    const { vault, keeper } = await deploy();
    await vault.connect(keeper).announceWithdrawal(ethers.parseEther("1"));
    await expect(vault.connect(keeper).executeWithdrawal(0)).to.be.revertedWithCustomError(vault, "StillWaiting");
  });

  it("executes and sends ETH to the keeper after the wait, and records a purchase receipt", async function () {
    const { vault, keeper } = await deploy();
    await vault.connect(keeper).announceWithdrawal(ethers.parseEther("1"));
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    const before = await ethers.provider.getBalance(await keeper.getAddress());
    const tx = await vault.connect(keeper).executeWithdrawal(0);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;
    const after = await ethers.provider.getBalance(await keeper.getAddress());

    expect(after - before + gasCost).to.equal(ethers.parseEther("1"));

    await expect(vault.connect(keeper).recordPurchase(0, "courtyard-12345", ethers.parseEther("0.8"), "0xrealtxhashonmainnet"))
      .to.emit(vault, "PurchaseRecorded")
      .withArgs(0, "ethereum", "0xCourtyardCollectionAddress", "courtyard-12345", ethers.parseEther("0.8"), "0xrealtxhashonmainnet");
  });

  it("lets the owner cancel an announced withdrawal before it executes", async function () {
    const { vault, keeper, owner } = await deploy();
    await vault.connect(keeper).announceWithdrawal(ethers.parseEther("1"));
    await vault.connect(owner).cancelWithdrawal(0);
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);
    await expect(vault.connect(keeper).executeWithdrawal(0)).to.be.revertedWithCustomError(vault, "AlreadyCancelled");
  });

  it("a stranger cannot cancel a withdrawal", async function () {
    const { vault, keeper, stranger } = await deploy();
    await vault.connect(keeper).announceWithdrawal(ethers.parseEther("1"));
    await expect(vault.connect(stranger).cancelWithdrawal(0)).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
  });
});

describe("ZeepExternalRaffle", function () {
  function hashLeaf(wallet: string, start: bigint, count: bigint): string {
    const inner = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256", "uint256"], [wallet, start, count]));
    return ethers.keccak256(inner);
  }

  async function deploy() {
    const [keeper, holderA, holderB] = await ethers.getSigners();
    const vault = await ethers.deployContract("ZeepExternalVault", ["ethereum", "0xCollection", await keeper.getAddress(), await keeper.getAddress()]);
    const raffle = await ethers.deployContract("ZeepExternalRaffle", [await vault.getAddress(), await keeper.getAddress()]);

    const entries: [string, bigint, bigint][] = [
      [await holderA.getAddress(), 0n, 60n],
      [await holderB.getAddress(), 60n, 40n],
    ];
    const leaves = entries.map(([w, s, c]) => hashLeaf(w, s, c));
    const root = ethers.keccak256(ethers.concat([leaves[0], leaves[1]].sort()));
    return { keeper, holderA, holderB, raffle, entries, leaves, root };
  }

  it("verifies a winner on-chain and lets the keeper record off-chain delivery, without ever touching an asset", async function () {
    const { keeper, raffle, entries, leaves, root } = await deploy();
    const tokenId = "courtyard-99";

    await raffle.connect(keeper).openGiveaway(tokenId, root, 100n);
    await ethers.provider.send("evm_increaseTime", [15 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    await raffle.commitDraw(tokenId);

    const key = await raffle.tokenKey(tokenId);
    const g1 = await raffle.giveaways(key);
    const current = await ethers.provider.getBlockNumber();
    for (let i = current; i <= Number(g1.commitBlock); i++) await ethers.provider.send("evm_mine", []);
    await raffle.draw(tokenId);

    const g2 = await raffle.giveaways(key);
    const winnerIndex = entries.findIndex(([, start, count]) => g2.winningTicket >= start && g2.winningTicket < start + count);
    const [winnerAddr, start, count] = entries[winnerIndex];
    const otherLeaf = leaves[winnerIndex === 0 ? 1 : 0];
    const myLeaf = leaves[winnerIndex];
    const proof = [myLeaf === leaves[0] ? leaves[1] : leaves[0]];
    void otherLeaf;

    await expect(raffle.verifyWinner(tokenId, winnerAddr, start, count, proof)).to.emit(raffle, "WinnerVerified").withArgs(key, winnerAddr);

    await expect(raffle.connect(keeper).recordDelivery(tokenId, "0xrealdeliverytxonmainnet"))
      .to.emit(raffle, "DeliveryRecorded")
      .withArgs(key, winnerAddr, "0xrealdeliverytxonmainnet");
  });
});
