// POST /api/ai-agent — ZEEP Assistant: a read-only Q&A helper grounded in ZEEP's
// own documented mechanics. No wallet access, cannot initiate transactions, never
// gives financial advice. Gracefully disabled (no fake replies) until
// ANTHROPIC_API_KEY is set, same degrade-gracefully pattern as Privy/Supabase.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { allow, clientIp } from "@/lib/server/limit";

const SYSTEM_PROMPT = `You are the ZEEP Assistant, a help widget embedded on ZEEP's website.

ZEEP is a memecoin launchpad on Robinhood Chain (Pons V2 bonding-curve coins — the same mechanism MONETA uses). Launching mints a regular Pons coin; ZEEP additionally pairs it with one NFT collection and a fixed outcome chosen at launch (raffle to holders, hold, or burn), tracked in ZEEP's own registry — not a Pons feature.

Facts you can rely on:
- Pairing (collection + outcome) is locked at launch and cannot change after the coin ships.
- Of every trade's ZEEP-routed fee, 80% goes to that coin's reserve and 20% to the ZEEP treasury.
- The reserve can only ever buy at or under its posted price ceiling; that ceiling expires after 1 hour.
- Purchases only happen through Seaport 1.6. Reserve withdrawals are disabled by design — there is no admin key that can drain a reserve.
- Anyone can call harvest to pull a coin's accrued trading fees into its reserve.
- Raffle draws are seeded from a future block hash, so no one can see the outcome in advance.
- Right now, the on-chain reserve contracts are built and tested but not deployed — the live site runs a transparent simulation: it reads real Pons fee data but does not execute real NFT purchases or raffle payouts yet. Any reserve panel showing a "Simulated" badge means this.
- Pokémon/One Piece card reserves point at real cards custodied by Courtyard.io (on Polygon), priced in USD/USDC, not ETH.
- ZEEP is not a gacha or loot-box product and never charges fiat for randomized rewards — the only randomness is a raffle draw among a coin's own existing holders, funded by trading fees the market already generated.
- Coins launched on ZEEP are experimental and can lose all value.

Rules:
- Only answer questions about how ZEEP works, its reserve mechanics, and how to use the site. Keep answers short and concrete.
- Never give financial or investment advice, and never tell anyone whether to buy, sell, or launch a specific coin.
- You have no wallet access and cannot sign, send, or initiate any transaction. Never ask for or acknowledge handling a private key or seed phrase.
- If asked about something outside ZEEP or outside these facts, say you don't know rather than guessing.
- If asked to do anything other than answer a question (browse the web, run code, remember personal data across sessions), decline.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: "The ZEEP Assistant isn't configured yet — check back soon." });
  }

  if (!allow("ai-agent", 20, clientIp(req))) {
    return NextResponse.json({ error: "Too many messages — try again in a minute." }, { status: 429 });
  }

  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!messages.length || messages.length > 20) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const result = await anthropic.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 2000),
      })),
    });
    const block = result.content.find((b) => b.type === "text");
    const reply = block && block.type === "text" ? block.text : "Sorry, I couldn't generate a reply.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "The ZEEP Assistant is unavailable right now." }, { status: 500 });
  }
}
