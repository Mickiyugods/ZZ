// Runs the simulated vault keeper (see lib/server/keeper.ts). Scheduled by
// vercel.json's `crons` entry; Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
// automatically when CRON_SECRET is set, so this route is only reachable by the
// scheduler in production. In dev (no CRON_SECRET set) it's open so you can trigger
// a tick by hand while testing.

import { NextRequest, NextResponse } from "next/server";
import { runKeeperTick } from "@/lib/server/keeper";
import * as store from "@/lib/server/store";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runKeeperTick();
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof store.NotConfigured) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error(e);
    return NextResponse.json({ error: "Keeper tick failed" }, { status: 500 });
  }
}
