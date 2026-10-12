import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// Minimal Merkle tree (sorted-pair keccak256) matching ZeepRaffle's leaf encoding
// and OpenZeppelin's MerkleProof.verify, without pulling in an extra npm package.
function hashLeaf(wallet: string, start: bigint, count: bigint): string {
  const inner = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256", "uint256"], [wallet, start, count]),
  );
  return ethers.keccak256(inner); // bytes.concat(keccak256(abi.encode(...))) in Solidity == keccak256(inner) here
}
function hashPair(a: string, b: string): string {
  const [x, y] = BigInt(a) <= BigInt(b) ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([x, y]));
}
function buildTree(leaves: string[]): { root: string; layers: string[][] } {
  let layer = leaves;
  const layers = [layer];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(i + 1 < layer.length ? hashPair(layer[i], layer[i + 1]) : layer[i]);
    }
    layer = next;
    layers.push(layer);
  }
  return { root: layer[0], layers };
}
function proofFor(layers: string[][], index: number): string[] {
  const proof: string[] = [];
  let idx = index;
  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (pairIdx < layer.length) proof.push(layer[pairIdx]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

describe("ZeepRaffle", function () {
  const TOKEN_ID = 7n;

  async function deployRaffleWithNft() {
    const [keeper, holderA, holderB, holderC] = await ethers.getSigners();
    const collection = await ethers.deployContract("MockERC721");

    // Deploy a plain vault-like holder: for this test we only need something that
    // can call handOffToOutcome's counterpart (IZeepVault) — reuse ZeepVault itself,
    // configured so the raffle is its outcome handler, pre-loaded with the NFT by
    // minting straight to it (skips the Seaport purchase path, tested separately).
    const seaport = await ethers.deployContract("MockSeaport");
    const vault = await ethers.deployContract("ZeepVault", [
      await collection.getAddress(),
      await seaport.getAddress(),
      await keeper.getAddress(),
      await keeper.getAddress(),
    ]);
    await collection.mint(await vault.getAddress(), TOKEN_ID);

    const raffle = await ethers.deployContract("ZeepRaffle", [
      await vault.getAddress(),
      await collection.getAddress(),
      await keeper.getAddress(),
      0, // ZeepRaffle.Policy.Raffle
    ]);
    await vault.connect(keeper).setOutcomeHandler(await raffle.getAddress());

    // Three holders get ticket ranges [0,100) [100,50) [150,25) — total 175 tickets.
    const entries: [string, bigint, bigint][] = [
      [await holderA.getAddress(), 0n, 100n],
      [await holderB.getAddress(), 100n, 50n],
      [await holderC.getAddress(), 150n, 25n],
    ];
    const leaves = entries.map(([w, s, c]) => hashLeaf(w, s, c));
    const { root, layers } = buildTree(leaves);
    const totalTickets = 175n;

    return { keeper, holderA, holderB, holderC, collection, vault, raffle, entries, leaves, layers, root, totalTickets };
  }

  it("opens a giveaway and runs the full commit/draw/deliver flow", async function () {
    const { keeper, raffle, entries, layers, root, totalTickets, collection, vault } = await deployRaffleWithNft();

    await expect(raffle.connect(keeper).openGiveaway(TOKEN_ID, root, totalTickets))
      .to.emit(raffle, "GiveawayOpened")
      .withArgs(TOKEN_ID, root, totalTickets, (await ethers.provider.getBlock("latest"))!.timestamp + 1);

    // Can't commit before the 15-minute public snapshot window passes.
    await expect(raffle.commitDraw(TOKEN_ID)).to.be.revertedWithCustomError(raffle, "TooEarly");

    await ethers.provider.send("evm_increaseTime", [15 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    await expect(raffle.commitDraw(TOKEN_ID)).to.emit(raffle, "DrawCommitted");
    const g1 = await raffle.giveaways(TOKEN_ID);
    const targetBlock = g1.commitBlock;

    // Can't draw before the target block is mined.
    await expect(raffle.draw(TOKEN_ID)).to.be.revertedWithCustomError(raffle, "TargetBlockNotMined");

    // Mine up to (and past) the target block.
    const current = await ethers.provider.getBlockNumber();
    for (let i = current; i <= Number(targetBlock); i++) {
      await ethers.provider.send("evm_mine", []);
    }

    await expect(raffle.draw(TOKEN_ID)).to.emit(raffle, "DrawCompleted");
    const g2 = await raffle.giveaways(TOKEN_ID);
    expect(g2.drawn).to.equal(true);

    // Figure out which of the three entries actually won, then deliver with that
    // wallet's real proof — proves the full Merkle path works end to end both for
    // the winner and (implicitly) that it fails for the other two.
    const winningTicket = g2.winningTicket;
    const winnerIndex = entries.findIndex(([, start, count]) => winningTicket >= start && winningTicket < start + count);
    expect(winnerIndex).to.be.greaterThanOrEqual(0);
    const [winnerAddr, start, count] = entries[winnerIndex];
    const proof = proofFor(layers, winnerIndex);

    await expect(raffle.deliver(TOKEN_ID, winnerAddr, start, count, proof))
      .to.emit(raffle, "Delivered")
      .withArgs(TOKEN_ID, winnerAddr);

    expect(await collection.ownerOf(TOKEN_ID)).to.equal(winnerAddr);
    expect((await raffle.giveaways(TOKEN_ID)).delivered).to.equal(true);

    // Can't deliver twice.
    await expect(raffle.deliver(TOKEN_ID, winnerAddr, start, count, proof)).to.be.revertedWithCustomError(raffle, "AlreadyDelivered");
  });

  it("rejects a ticket range that doesn't cover the winning ticket", async function () {
    const { keeper, raffle, entries, layers, root, totalTickets } = await deployRaffleWithNft();
    await raffle.connect(keeper).openGiveaway(TOKEN_ID, root, totalTickets);
    await ethers.provider.send("evm_increaseTime", [15 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    await raffle.commitDraw(TOKEN_ID);
    const g1 = await raffle.giveaways(TOKEN_ID);
    const current = await ethers.provider.getBlockNumber();
    for (let i = current; i <= Number(g1.commitBlock); i++) await ethers.provider.send("evm_mine", []);
    await raffle.draw(TOKEN_ID);

    const g2 = await raffle.giveaways(TOKEN_ID);
    const winnerIndex = entries.findIndex(([, start, count]) => g2.winningTicket >= start && g2.winningTicket < start + count);
    const loserIndex = (winnerIndex + 1) % entries.length;
    const [loserAddr, start, count] = entries[loserIndex];
    const proof = proofFor(layers, loserIndex);

    // The loser's own real range/proof is valid as a Merkle leaf, but doesn't
    // cover the winning ticket — must revert with TicketOutOfRange, not a forged win.
    await expect(raffle.deliver(TOKEN_ID, loserAddr, start, count, proof)).to.be.revertedWithCustomError(raffle, "TicketOutOfRange");
  });

  it("rejects a forged proof for an unclaimed range", async function () {
    const { keeper, raffle, root, totalTickets, holderA } = await deployRaffleWithNft();
    await raffle.connect(keeper).openGiveaway(TOKEN_ID, root, totalTickets);
    await ethers.provider.send("evm_increaseTime", [15 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    await raffle.commitDraw(TOKEN_ID);
    const g1 = await raffle.giveaways(TOKEN_ID);
    const current = await ethers.provider.getBlockNumber();
    for (let i = current; i <= Number(g1.commitBlock); i++) await ethers.provider.send("evm_mine", []);
    await raffle.draw(TOKEN_ID);

    await expect(raffle.deliver(TOKEN_ID, await holderA.getAddress(), 0n, 175n, [])).to.be.revertedWithCustomError(raffle, "InvalidProof");
  });

  it("burns instead of raffling for burn-policy coins, and only the wired handler may trigger it", async function () {
    const [keeper] = await ethers.getSigners();
    const collection = await ethers.deployContract("MockERC721");
    const seaport = await ethers.deployContract("MockSeaport");
    const vault = await ethers.deployContract("ZeepVault", [
      await collection.getAddress(),
      await seaport.getAddress(),
      await keeper.getAddress(),
      await keeper.getAddress(),
    ]);
    await collection.mint(await vault.getAddress(), TOKEN_ID);

    const burnRaffle = await ethers.deployContract("ZeepRaffle", [
      await vault.getAddress(),
      await collection.getAddress(),
      await keeper.getAddress(),
      1, // ZeepRaffle.Policy.Burn
    ]);
    await vault.connect(keeper).setOutcomeHandler(await burnRaffle.getAddress());

    const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
    await expect(burnRaffle.connect(keeper).burnNow(TOKEN_ID)).to.emit(burnRaffle, "Burned").withArgs(TOKEN_ID);
    expect(await collection.ownerOf(TOKEN_ID)).to.equal(BURN_ADDRESS);
  });

  it("rejects burnNow on a raffle-policy contract and openGiveaway on a burn-policy one", async function () {
    const { keeper, raffle, root, totalTickets } = await deployRaffleWithNft();
    await expect(raffle.connect(keeper).burnNow(TOKEN_ID)).to.be.revertedWithCustomError(raffle, "WrongPolicy");

    const [, , , , strangerKeeper] = await ethers.getSigners();
    void strangerKeeper;
    const collection = await ethers.deployContract("MockERC721");
    const seaport = await ethers.deployContract("MockSeaport");
    const vault = await ethers.deployContract("ZeepVault", [
      await collection.getAddress(),
      await seaport.getAddress(),
      await keeper.getAddress(),
      await keeper.getAddress(),
    ]);
    const burnRaffle = await ethers.deployContract("ZeepRaffle", [
      await vault.getAddress(),
      await collection.getAddress(),
      await keeper.getAddress(),
      1,
    ]);
    await expect(burnRaffle.connect(keeper).openGiveaway(TOKEN_ID, root, totalTickets)).to.be.revertedWithCustomError(burnRaffle, "WrongPolicy");
  });
});
