// The ZEEP keeper — runs on a schedule (see app/api/cron/keeper/route.ts).
//
// SIMULATION MODE ONLY. Every event this writes has `simulated: true`. No private
// key is used and no ETH ever actually moves:
//   - harvest: reads the REAL Pons escrow balance for each coin's creator (a public
//     view call, no key needed) and books 80/20 of any increase since last tick into
//     that coin's simulated vault_eth / protocol_eth.
//   - purchase: once a coin's simulated vault_eth clears its collection's real listed
//     floor price (lib/collections.ts), it "buys" a plausible card/NFT — decrements
//     vault_eth, increments nfts_held, logs the event. Nothing is actually bought.
//   - draw: for raffle-policy coins, picks a winner from real recent on-chain buyers
//     of that coin (ERC20 Transfer logs from the curve), seeded by a real recent
//     Robinhood Chain block hash. If nobody has bought yet, the draw is logged as
//     pending with no winner.
//
// Turning this into Phase 2 (real money) means: (a) making the vault itself the
// Pons creatorFeeRecipient (or adding a splitter) instead of reading someone else's
// claimable balance, (b) replacing the purchase step with a real Seaport 1.6 fill
// from a funded keeper wallet behind a spend ceiling, and (c) resolving draws against
// a block that was still in the future when the purchase happened, not the latest
// block at tick time. None of that is wired up yet — see CLAUDE.md "Vault execution".

import { ethers } from "ethers";
import * as rpcClient from "./rpc";
import * as store from "./store";
import type { CoinRecord } from "./store";
import { ESCROW, escrowAbi } from "./pons";
import { findCollection } from "@/lib/collections";
import { VAULT } from "@/lib/config";

const escrowIface = new ethers.Interface(escrowAbi);
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const HARVEST_DUST_ETH = 0.000001; // ignore sub-dust deltas (rounding noise)
const BUYER_LOOKBACK_BLOCKS = 5000;

function nowIso() {
  return new Date().toISOString();
}

async function readEscrowBalanceEth(recipient: string): Promise<number> {
  const data = escrowIface.encodeFunctionData("balanceOf", [recipient]);
  const result = (await rpcClient.call("eth_call", [{ to: ESCROW, data }, "latest"])) as string;
  const [balance] = escrowIface.decodeFunctionResult("balanceOf", result);
  return Number(ethers.formatEther(balance as bigint));
}

async function latestBlock(): Promise<{ number: number; hash: string }> {
  const block = (await rpcClient.call("eth_getBlockByNumber", ["latest", false])) as { number: string; hash: string };
  return { number: parseInt(block.number, 16), hash: block.hash };
}

function parseFloorEth(floor?: string): number | null {
  if (!floor) return null;
  const m = floor.trim().match(/^([\d.]+)\s*ETH$/i);
  return m ? parseFloat(m[1]) : null;
}

function pickByHash(hash: string, count: number): number {
  if (count <= 0) return -1;
  const n = BigInt(hash);
  return Number(n % BigInt(count));
}

// Real recent buyers of a coin: addresses the curve sent tokens to (ERC20 Transfer
// logs with `from` = curve). Scoped to a recent block window since the public RPC
// has no archive access over the coin's full history.
async function fetchRecentBuyers(token: string, curve: string): Promise<string[]> {
  try {
    const latest = await rpcClient.call("eth_blockNumber", []);
    const latestNum = parseInt(latest as string, 16);
    const fromBlock = Math.max(0, latestNum - BUYER_LOOKBACK_BLOCKS);
    const logs = (await rpcClient.call("eth_getLogs", [
      {
        address: token,
        fromBlock: "0x" + fromBlock.toString(16),
        toBlock: "latest",
        topics: [TRANSFER_TOPIC, ethers.zeroPadValue(ethers.getAddress(curve), 32)],
      },
    ])) as { topics: string[] }[];
    return logs.map((log) => ethers.getAddress("0x" + log.topics[2].slice(26)));
  } catch {
    return [];
  }
}

async function harvestOne(row: CoinRecord, log: string[]) {
  const currentEth = await readEscrowBalanceEth(row.deployer);
  const last = row.last_harvested_escrow || 0;
  const delta = currentEth - last;

  if (delta <= HARVEST_DUST_ETH) {
    // Either nothing new, or the creator claimed independently (balance dropped).
    // Either way, resync the baseline so we don't double-count or go negative.
    if (Math.abs(currentEth - last) > HARVEST_DUST_ETH) {
      await store.update(row.token, { last_harvested_escrow: currentEth });
    }
    return;
  }

  const vaultShare = delta * (VAULT.vaultBps / 10000);
  const protocolShare = delta * (VAULT.protocolBps / 10000);
  await store.update(row.token, {
    vault_eth: (row.vault_eth || 0) + vaultShare,
    protocol_eth: (row.protocol_eth || 0) + protocolShare,
    last_harvested_escrow: currentEth,
  });
  await store.addEvent({
    token: row.token,
    type: "harvest",
    amount_eth: delta,
    nft_label: null,
    winner: null,
    block_hash: null,
    simulated: true,
    created_at: nowIso(),
  });
  log.push(`${row.symbol}: harvested ${delta.toFixed(5)} ETH in fees (vault +${vaultShare.toFixed(5)})`);
}

async function drawWinner(row: CoinRecord, nftLabel: string, log: string[]) {
  const { hash } = await latestBlock();
  const buyers = await fetchRecentBuyers(row.token, row.curve);
  const idx = pickByHash(hash, buyers.length);
  const winner = idx >= 0 ? buyers[idx] : null;

  await store.addEvent({
    token: row.token,
    type: "draw",
    amount_eth: null,
    nft_label: nftLabel,
    winner,
    block_hash: hash,
    simulated: true,
    created_at: nowIso(),
  });
  log.push(winner ? `${row.symbol}: drew ${winner.slice(0, 6)}… to win ${nftLabel}` : `${row.symbol}: draw logged, no recent buyers to pick a winner from yet`);
}

async function purchaseIfReady(row: CoinRecord, log: string[]) {
  if (row.policy === "burn" && row.nfts_held > 0) return; // already burned its one piece conceptually; nothing more to do
  const collection = findCollection(row.collection_slug);
  const floorEth = parseFloorEth(collection?.floor);
  if (floorEth == null) return;
  if ((row.vault_eth || 0) < floorEth) return;

  const tokenId = Math.floor(Math.random() * 9000) + 1000;
  const label = `${row.collection_name} #${tokenId}`;

  await store.update(row.token, {
    vault_eth: (row.vault_eth || 0) - floorEth,
    nfts_held: (row.nfts_held || 0) + 1,
  });
  await store.addEvent({
    token: row.token,
    type: "purchase",
    amount_eth: floorEth,
    nft_label: label,
    winner: null,
    block_hash: null,
    simulated: true,
    created_at: nowIso(),
  });
  log.push(`${row.symbol}: simulated purchase of ${label} for ${floorEth} ETH`);

  if (row.policy === "raffle") {
    await drawWinner(row, label, log);
  }
}

export async function runKeeperTick(): Promise<{ ok: true; log: string[] }> {
  const log: string[] = [];
  const rows = await store.list();

  for (const row of rows) {
    try {
      await harvestOne(row, log);
    } catch (e) {
      log.push(`${row.symbol}: harvest failed — ${(e as Error).message}`);
    }
  }

  // Re-read after harvesting so purchases see this tick's fresh vault_eth.
  const refreshed = await store.list();
  for (const row of refreshed) {
    try {
      await purchaseIfReady(row, log);
    } catch (e) {
      log.push(`${row.symbol}: purchase check failed — ${(e as Error).message}`);
    }
  }

  return { ok: true, log };
}
