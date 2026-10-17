// GET /api/wallet-tokens?address=0x...
//
// Every ERC-20 a wallet holds on Robinhood Chain, via Alchemy's indexed
// `alchemy_getTokenBalances` (balances are as of the latest block) plus
// `alchemy_getTokenMetadata` for name/symbol/decimals/logo. Needs RPC_URL to be
// an Alchemy Robinhood Mainnet URL; without it this returns 503 and /profile
// falls back to Blockscout for discovery. Balances shown on the page are still
// re-read straight from chain by lib/holdings.ts.

import { NextRequest, NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/server/limit";

const ALCHEMY = process.env.RPC_URL && /alchemy\.com/.test(process.env.RPC_URL) ? process.env.RPC_URL : null;

type Meta = { symbol: string | null; name: string | null; decimals: number | null; logo: string | null };
const metaCache = new Map<string, Meta>(); // token metadata never changes
const listCache = new Map<string, { at: number; body: unknown }>();

async function alchemy<T>(payload: unknown): Promise<T> {
  const r = await fetch(ALCHEMY!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`alchemy ${r.status}`);
  return (await r.json()) as T;
}

export async function GET(req: NextRequest) {
  if (!ALCHEMY) return NextResponse.json({ error: "Alchemy not configured" }, { status: 503 });
  if (!allow("wallet-tokens", 60, clientIp(req))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const address = (new URL(req.url).searchParams.get("address") || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return NextResponse.json({ error: "bad address" }, { status: 400 });

  const hit = listCache.get(address);
  if (hit && Date.now() - hit.at < 3000) return NextResponse.json(hit.body);

  try {
    // 1. which tokens (paged; a few hundred tokens is plenty for a profile)
    const held: { address: string; balance: string }[] = [];
    let pageKey: string | undefined;
    for (let page = 0; page < 5; page++) {
      const res = await alchemy<{ result?: { tokenBalances: { contractAddress: string; tokenBalance: string | null }[]; pageKey?: string }; error?: unknown }>({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: pageKey ? [address, "erc20", { pageKey }] : [address, "erc20"],
      });
      if (!res.result) throw new Error("alchemy error");
      for (const t of res.result.tokenBalances) {
        if (t.tokenBalance && BigInt(t.tokenBalance) > 0n) held.push({ address: t.contractAddress.toLowerCase(), balance: t.tokenBalance });
      }
      pageKey = res.result.pageKey;
      if (!pageKey) break;
    }

    // 2. metadata for tokens we haven't seen yet, in one batch
    const missing = held.filter((t) => !metaCache.has(t.address)).map((t) => t.address);
    for (let i = 0; i < missing.length; i += 50) {
      const chunk = missing.slice(i, i + 50);
      const res = await alchemy<{ id: number; result?: Meta }[]>(
        chunk.map((a, j) => ({ jsonrpc: "2.0", id: j, method: "alchemy_getTokenMetadata", params: [a] })),
      );
      for (const x of Array.isArray(res) ? res : []) if (x.result) metaCache.set(chunk[x.id], x.result);
    }
    if (metaCache.size > 20000) metaCache.clear();

    const body = {
      tokens: held.map((t) => {
        const m = metaCache.get(t.address);
        return { address: t.address, balance: t.balance, symbol: m?.symbol ?? null, name: m?.name ?? null, decimals: m?.decimals ?? null, logo: m?.logo ?? null };
      }),
    };
    listCache.set(address, { at: Date.now(), body });
    if (listCache.size > 2000) listCache.delete(listCache.keys().next().value!);
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "Alchemy unreachable" }, { status: 502 });
  }
}
