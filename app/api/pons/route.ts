// GET /api/pons?token=0x...&view=launch|trades|candles|markers[&interval=1h][&cursor=...]
//
// Every ZEEP coin is a Pons V2 launch, so Pons' own launch API is the source of
// truth for market data (price, market cap, curve progress, trades, candles).
// Reading it here keeps the coin page's numbers and chart identical to
// ponsfamily.com. Proxied server-side: avoids CORS, allowlists what can be asked
// for, and adds a short cache so live polling doesn't hammer Pons.
//
// Note: this is Pons' public-but-undocumented frontend API, not a versioned
// partner API — if its shape changes, the coin page falls back gracefully.

import { NextRequest, NextResponse } from "next/server";
import { chainLaunch } from "@/lib/server/pons-chain";
import { ethUsd } from "@/lib/server/eth-usd";

const BASE = "https://ponsfamily.com/api/launches";
// Pons' balances indexer (what ponsfamily.com itself uses for holders and for its
// "T" dev-transfer chart markers): /v1/tokens/<token>/holders, /sent/<wallet>.
const BALANCES = "https://balancesapi.ponsfamily.com/v1/tokens";
const VIEWS = new Set(["launch", "trades", "candles", "markers", "holders", "sent"]);
const INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);

const cache = new Map<string, { at: number; status: number; body: string }>();
// Short: a new trade should show up on the next refetch (triggered by ticks below).
const TTL_MS = 2000;

// Pons' live trade feed: every curve buy/sell ("ticks") and pool swap ("swaps")
// across all coins in roughly the last 3 seconds. The coin page polls this to
// refresh market cap / price the moment one of its own trades lands, like Pons.
let ticksCache: { at: number; body: string } | null = null;
async function ticks() {
  if (ticksCache && Date.now() - ticksCache.at < 1500) return ticksCache.body;
  const r = await fetch(`${BASE}/ticks`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!r.ok) throw new Error(`ticks ${r.status}`);
  ticksCache = { at: Date.now(), body: await r.text() };
  return ticksCache.body;
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const token = (q.get("token") || "").toLowerCase();
  const view = q.get("view") || "launch";
  if (view === "ticks") {
    try {
      return new NextResponse(await ticks(), { headers: { "Content-Type": "application/json" } });
    } catch {
      return NextResponse.json({ ticks: [], swaps: [] }, { status: 502 });
    }
  }
  // USD per ETH, for valuing a wallet's ETH on /profile (Pons' own rate isn't
  // reachable without a token, so this uses the shared CoinGecko fallback).
  if (view === "ethusd") return NextResponse.json({ usd: await ethUsd() });
  if (!/^0x[0-9a-f]{40}$/.test(token) || !VIEWS.has(view)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (view === "holders" || view === "sent") {
    let url: string;
    if (view === "holders") url = `${BALANCES}/${token}/holders?limit=1`;
    else {
      const wallet = (q.get("wallet") || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(wallet)) return NextResponse.json({ error: "bad wallet" }, { status: 400 });
      url = `${BALANCES}/${token}/sent/${wallet}`;
    }
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < 10_000) return new NextResponse(hit.body, { status: hit.status, headers: { "Content-Type": "application/json" } });
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
      const body = await r.text();
      const status = r.ok ? 200 : r.status;
      cache.set(url, { at: Date.now(), status, body });
      return new NextResponse(body, { status, headers: { "Content-Type": "application/json" } });
    } catch {
      return NextResponse.json({ error: "Pons balances unreachable" }, { status: 502 });
    }
  }

  const params = new URLSearchParams();
  if (view !== "launch") params.set("view", view);
  if (view === "candles") {
    const interval = q.get("interval") || "1h";
    if (!INTERVALS.has(interval)) return NextResponse.json({ error: "bad interval" }, { status: 400 });
    params.set("interval", interval);
    params.set("limit", "1000");
  }
  if (view === "trades") {
    const cursor = q.get("cursor");
    if (cursor && /^[0-9.]+$/.test(cursor)) params.set("cursor", cursor);
  }
  const url = `${BASE}/${token}${params.size ? `?${params}` : ""}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return new NextResponse(hit.body, { status: hit.status, headers: { "Content-Type": "application/json" } });
  }

  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000), cache: "no-store" });
    let body = await r.text();
    // Pons answers unknown tokens with an error object; pass a clean 404 through.
    let status = r.ok && !body.startsWith('{"error"') ? 200 : r.status === 200 ? 404 : r.status;
    // Not indexed by Pons yet (e.g. a ZEEP coin seconds after launch): read the
    // real curve from chain so the page still shows the true starting state.
    if (status !== 200 && view === "launch") {
      const onChain = await chainLaunch(token);
      if (onChain) {
        body = JSON.stringify(onChain);
        status = 200;
      }
    }
    cache.set(url, { at: Date.now(), status, body });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return new NextResponse(body, { status, headers: { "Content-Type": "application/json" } });
  } catch {
    if (view === "launch") {
      const onChain = await chainLaunch(token);
      if (onChain) return NextResponse.json(onChain);
    }
    return NextResponse.json({ error: "Pons is unreachable right now" }, { status: 502 });
  }
}
