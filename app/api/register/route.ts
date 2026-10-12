// Records a coin in the ZEEP registry after checking its launch on chain.
// Body: { hash, collectionName, collectionSlug, chain, category, policy }
// Accepted only if the tx called the Pons factory or router, succeeded, emitted
// TokenLaunched from the factory, and used a salt starting with "ZEEP".

import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "ethers";
import * as rpc from "@/lib/server/rpc";
import * as store from "@/lib/server/store";
import { allow, clientIp } from "@/lib/server/limit";
import { FACTORY, ROUTER, SALT_PREFIX, launchIface } from "@/lib/server/pons";

const clip = (s: unknown, n: number) => String(s || "").slice(0, n);
const POLICIES = new Set(["raffle", "hold", "burn"]);
const CATEGORIES = new Set(["pfp", "art", "cards"]);

interface RpcTx {
  to?: string;
  input: string;
  value: string;
}
interface RpcReceipt {
  status: string;
  blockNumber: string;
  logs: { address: string; topics: string[]; data: string }[];
}
interface RpcBlock {
  timestamp: string;
}

export async function POST(req: NextRequest) {
  if (!allow("register", 12, clientIp(req))) {
    return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const hash = String(body.hash || "");
  const collectionName = String(body.collectionName || "");
  const collectionSlug = String(body.collectionSlug || "");
  const chainName = String(body.chain || "ethereum");
  const category = String(body.category || "pfp");
  const policy = String(body.policy || "");

  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
  if (!collectionName || !collectionSlug) return NextResponse.json({ error: "Missing collection" }, { status: 400 });
  if (!POLICIES.has(policy)) return NextResponse.json({ error: "Invalid policy" }, { status: 400 });
  if (category && !CATEGORIES.has(category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  try {
    const tx = (await rpc.call("eth_getTransactionByHash", [hash])) as RpcTx | null;
    if (!tx) return NextResponse.json({ error: "Transaction not found yet" }, { status: 404 });

    const to = (tx.to || "").toLowerCase();
    if (to !== FACTORY.toLowerCase() && to !== ROUTER.toLowerCase()) {
      return NextResponse.json({ error: "Not a Pons launch transaction" }, { status: 422 });
    }

    let parsed;
    try {
      parsed = launchIface.parseTransaction({ data: tx.input, value: tx.value });
    } catch {}
    if (!parsed || !["launchToken", "launchAndBuy"].includes(parsed.name)) {
      return NextResponse.json({ error: "Not a Pons launch transaction" }, { status: 422 });
    }
    const params = parsed.args[0];
    if (!String(params.salt).toLowerCase().startsWith(SALT_PREFIX)) {
      return NextResponse.json({ error: "This coin was not launched through ZEEP" }, { status: 422 });
    }

    const receipt = (await rpc.call("eth_getTransactionReceipt", [hash])) as RpcReceipt | null;
    if (!receipt) return NextResponse.json({ error: "Transaction not confirmed yet" }, { status: 404 });
    if (receipt.status !== "0x1") return NextResponse.json({ error: "Launch transaction failed" }, { status: 422 });

    let launched: { token: string; curve: string; deployer: string } | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== FACTORY.toLowerCase()) continue;
      try {
        const ev = launchIface.parseLog(log);
        if (ev?.name === "TokenLaunched") {
          launched = { token: ev.args.token, curve: ev.args.curve, deployer: ev.args.deployer };
          break;
        }
      } catch {}
    }
    if (!launched) return NextResponse.json({ error: "No TokenLaunched event in this transaction" }, { status: 422 });

    const block = (await rpc.call("eth_getBlockByNumber", [receipt.blockNumber, false])) as RpcBlock;
    const record = {
      token: getAddress(launched.token),
      curve: getAddress(launched.curve),
      deployer: getAddress(launched.deployer),
      tx_hash: hash.toLowerCase(),
      block_number: Number(receipt.blockNumber),
      launched_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      name: clip(params.name, 64),
      symbol: clip(params.symbol, 16),
      logo: clip(params.logo, 512),
      description: clip(params.description, 2048),
      collection_name: clip(collectionName, 128),
      collection_slug: clip(collectionSlug, 128),
      chain: clip(chainName, 32),
      category: clip(category, 16),
      policy,
      vault_eth: 0,
      protocol_eth: 0,
      nfts_held: 0,
      fees_awaiting: 0,
    };
    await store.add(record);
    return NextResponse.json({ ok: true, token: record.token });
  } catch (err) {
    if (err instanceof store.NotConfigured) return NextResponse.json({ error: err.message }, { status: 503 });
    console.error(err);
    return NextResponse.json({ error: "Could not verify the launch right now" }, { status: 502 });
  }
}
