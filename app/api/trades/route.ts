// DEV ONLY — simulated market for coins not live on Pons yet (the local demo coin).
//   GET  /api/trades?token=0x...&view=launch|trades|candles|markers[&interval=1h]
//        same response shapes as Pons' launch API (see /api/pons), so the coin
//        page and chart use one code path for real and demo coins.
//   POST /api/trades { token, side, ethValue } — append one simulated trade.
// In production every call returns 404/403: no fabricated market can ship.

import { NextRequest, NextResponse } from "next/server";
import { addDemoTrade, demoCandles, demoHolders, demoLaunch, demoTrades, devOnly, hasDemo } from "@/lib/server/demo-market";
import { ethUsd } from "@/lib/server/eth-usd";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const token = (q.get("token") || "").toLowerCase();
  if (!devOnly() || !/^0x[0-9a-f]{40}$/.test(token) || !hasDemo(token)) {
    return NextResponse.json({ error: "no demo market" }, { status: 404 });
  }
  const view = q.get("view") || "launch";
  if (view === "launch") return NextResponse.json(demoLaunch(token, await ethUsd()));
  if (view === "trades") return NextResponse.json(demoTrades(token));
  if (view === "candles") return NextResponse.json(demoCandles(token, q.get("interval") || "1h"));
  if (view === "markers") return NextResponse.json({ dev: "", trades: [] });
  if (view === "holders") return NextResponse.json(demoHolders(token));
  if (view === "sent") return NextResponse.json({ items: [] }); // the demo dev never moves tokens
  return NextResponse.json({ error: "bad view" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!devOnly()) return NextResponse.json({ error: "Demo trades are disabled in production" }, { status: 403 });
  try {
    const body = await req.json();
    const token = String(body?.token || "").toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(token)) return NextResponse.json({ error: "token required" }, { status: 400 });
    const side = body?.side === "sell" ? "sell" : "buy";
    const trade = addDemoTrade(token, side, Number(body?.ethValue) || 0.01);
    return NextResponse.json({ trade });
  } catch {
    return NextResponse.json({ error: "Could not record demo trade" }, { status: 500 });
  }
}
