// GET /api/tokens?list=new|top|nfts&search=...&token=0x...&deployer=0x...
// Returns the ZEEP coin registry (each coin plus its vault state) and platform totals.

import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/server/store";
import type { CoinRecord } from "@/lib/server/store";

function sortRows(rows: CoinRecord[], list: string) {
  const out = [...rows];
  if (list === "top") return out.sort((a, b) => (b.vault_eth || 0) - (a.vault_eth || 0));
  if (list === "nfts") return out.sort((a, b) => (b.nfts_held || 0) - (a.nfts_held || 0));
  return out.sort((a, b) => new Date(b.launched_at).getTime() - new Date(a.launched_at).getTime());
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const list = url.searchParams.get("list") || "new";
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const token = (url.searchParams.get("token") || "").trim().toLowerCase();
    const deployer = (url.searchParams.get("deployer") || "").trim().toLowerCase();

    let rows = await store.list();
    if (token) rows = rows.filter((r) => r.token.toLowerCase() === token);
    if (deployer) rows = rows.filter((r) => r.deployer?.toLowerCase() === deployer);
    if (search) {
      rows = rows.filter(
        (r) =>
          r.name?.toLowerCase().includes(search) ||
          r.symbol?.toLowerCase().includes(search) ||
          r.collection_name?.toLowerCase().includes(search),
      );
    }
    rows = sortRows(rows, list);

    const totals = rows.reduce(
      (acc, r) => {
        acc.vaultEth += r.vault_eth || 0;
        acc.nftsHeld += r.nfts_held || 0;
        acc.feesAwaiting += r.fees_awaiting || 0;
        return acc;
      },
      { vaultEth: 0, nftsHeld: 0, feesAwaiting: 0 },
    );

    return NextResponse.json(
      { coins: rows.length, ...totals, rows },
      { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" } },
    );
  } catch (e) {
    if (e instanceof store.NotConfigured) {
      return NextResponse.json({ coins: 0, vaultEth: 0, nftsHeld: 0, feesAwaiting: 0, rows: [] });
    }
    console.error(e);
    return NextResponse.json({ error: "Registry unavailable" }, { status: 500 });
  }
}
