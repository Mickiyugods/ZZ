// Read-only JSON-RPC gateway with upstream failover. Only safe read methods pass through.

import { NextRequest, NextResponse } from "next/server";
import * as rpc from "@/lib/server/rpc";
import { allow, clientIp } from "@/lib/server/limit";

const ALLOWED = new Set([
  "eth_call",
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBlockByNumber",
  "eth_getLogs",
]);

export async function POST(req: NextRequest) {
  if (!allow("rpc", 120, clientIp(req))) {
    return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  for (const c of calls as { method?: string }[]) {
    if (!c.method || !ALLOWED.has(c.method)) {
      return NextResponse.json({ error: `Method not allowed: ${c.method}` }, { status: 403 });
    }
  }
  try {
    const out = await rpc.send(body);
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "RPC upstream failed" }, { status: 502 });
  }
}
