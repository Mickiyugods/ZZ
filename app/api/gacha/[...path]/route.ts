// Server-side proxy to Collector Crypt's Gacha Machine API.
//
// Why a proxy and not direct browser calls:
//  - CORS: gacha.collectorcrypt.com doesn't send permissive CORS headers, so
//    the browser can't call it directly.
//  - Secret: the optional `x-api-key` (which gives our packs a branded memo
//    slug instead of the anonymous `cc-` prefix) must stay server-side.
//
// Base host is env-configurable. Defaults to **devnet** so nothing here spends
// real USDC until the owner deliberately flips COLLECTORCRYPT_GACHA_URL to the
// mainnet host (https://gacha.collectorcrypt.com).

import { NextRequest, NextResponse } from "next/server";

const BASE = (process.env.COLLECTORCRYPT_GACHA_URL || "https://dev-gacha.collectorcrypt.com").replace(/\/$/, "");
const API_KEY = process.env.COLLECTORCRYPT_API_KEY;

// Only these gacha endpoints may be proxied — an allowlist so this route can't
// be turned into an open proxy to arbitrary paths on the gacha host.
const ALLOWED = new Set([
  "machines",
  "generatePack",
  "submitTransaction",
  "openPack",
  "pack/status",
  "getNfts",
  "getRecentWinners",
  "getAllWinners",
  "status",
  "stock",
]);

function targetPath(path: string[]): string | null {
  const joined = path.join("/");
  return ALLOWED.has(joined) ? joined : null;
}

// Machine media fields come back host-relative (e.g. "/pokemon_50.webm"), which
// wouldn't resolve on our domain. Rewrite them to absolute URLs on the gacha
// host (which does serve them) so the client can render the vending-machine
// videos/images directly.
const MEDIA_FIELDS = ["thumbnailUrl", "imageNobg", "videoSrc", "videoHevc", "videoNobgWeb", "videoNobgIos", "videoNobgAndroid"] as const;

function absolutizeMachines(text: string): string {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data?.machines)) return text;
    for (const m of data.machines) {
      for (const f of MEDIA_FIELDS) {
        const v = m[f];
        if (typeof v === "string" && v.startsWith("/")) m[f] = BASE + v;
      }
    }
    return JSON.stringify(data);
  } catch {
    return text;
  }
}

async function forward(req: NextRequest, path: string[], method: "GET" | "POST") {
  const sub = targetPath(path);
  if (!sub) return NextResponse.json({ error: "Unknown gacha endpoint" }, { status: 404 });

  const search = req.nextUrl.search; // preserved query string, e.g. ?memo=... / ?code=...
  const url = `${BASE}/api/${sub}${method === "GET" ? search : ""}`;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const init: RequestInit = { method, headers };
  if (method === "POST") init.body = await req.text();

  try {
    const res = await fetch(url, init);
    let text = await res.text();
    if (res.ok && sub === "machines") text = absolutizeMachines(text);
    // Pass the upstream body + status straight through; it's already JSON.
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Gacha upstream unreachable", detail: String(err) }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "POST");
}
