// GET /api/vault-events?token=0x... — vault event log (harvest / purchase / draw) for one coin.

import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/server/store";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || undefined;
    const events = await store.listEvents(token);
    return NextResponse.json({ events });
  } catch (e) {
    if (e instanceof store.NotConfigured) return NextResponse.json({ events: [] });
    console.error(e);
    return NextResponse.json({ error: "Could not load vault events" }, { status: 500 });
  }
}
