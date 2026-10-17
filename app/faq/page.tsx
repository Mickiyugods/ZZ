"use client";

import * as React from "react";
import Link from "next/link";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const FAQS: [string, React.ReactNode][] = [
  [
    "What is ZEEP?",
    "A coin launcher on Robinhood Chain. Launching mints a regular Pons V2 bonding-curve coin, and ZEEP pairs it with one NFT or graded-card collection and a fixed payout rule (raffle to holders, hold, or burn), funded by a share of the coin's own trading fees.",
  ],
  [
    "What does it cost to launch?",
    "0.0005 ETH, paid to Pons in the launch transaction, plus gas. There's no dev buy — your coin starts at the curve's opening price (a 1.68 ETH market cap). Every trade then pays Pons' 1% curve fee plus whatever creator tax you pick (0–10%). The full table is in Docs → Fees & numbers.",
  ],
  [
    "Are ZEEP coins a gacha or a loot box?",
    "No. The only randomness in a coin is a raffle among its own existing holders, funded entirely by trading fees the market already generated — never a separate purchase. The Gacha Station is a different, clearly separate feature: it sells Collector Crypt card packs for USDC on Solana.",
  ],
  [
    "What is the Gacha Station?",
    "A storefront for Collector Crypt's Pokémon and One Piece pack machines on Solana. You pay a fixed USDC price and get one graded card, drawn at the odds shown on the machine, redeemable for the physical card. The machines, odds and cards are Collector Crypt's; ZEEP never holds your funds.",
  ],
  [
    "What happens to my coin's trading fees?",
    "Pons pays every coin's creator side about 0.75% of each trade plus the creator tax. Once ZEEP's reserve router is live, all of that splits 80% to the coin's reserve and 20% to the ZEEP treasury, and anyone can trigger the harvest. Until then, Pons pays those fees to the creator's own wallet.",
  ],
  [
    "Can the collection or payout rule change after I launch?",
    "No. Both are locked at launch. Withdrawals are disabled by design — no key, not even ZEEP's, can pull funds out of a reserve except to buy the paired collection.",
  ],
  [
    "When does a coin graduate?",
    "When its bonding curve has raised 4.20 ETH. Pons then moves it into a locked pool. Progress toward that is shown live on every coin page.",
  ],
  [
    "Where does the price and market data come from?",
    "Straight from Pons — the same prices, market cap, trades, candles and holder counts you'd see on ponsfamily.com, updated live as trades land.",
  ],
  [
    "Are the Pokémon and One Piece cards real?",
    "Yes. They're tokenized by Courtyard.io, a real-world-asset vaulting platform — burning the NFT gets the physical, custodied card shipped. Courtyard runs on Polygon, priced in USD/USDC. A second line, Collector Crypt, works the same way on Solana.",
  ],
  [
    "Is the reserve actually buying NFTs right now?",
    "Not yet. The live site runs a transparent simulation (Phase 1.5): it reads real on-chain Pons fee data, but purchases and raffle draws are logged, not executed. Any reserve panel in that state shows a \"Simulated\" badge. The on-chain system that will actually buy and raffle NFTs (Phase 2) is built and tested but not deployed — see Contracts.",
  ],
  [
    "How does the raffle decide a winner?",
    "The draw is seeded from a future block hash, so nobody — including ZEEP — can see the outcome in advance. The winner is picked from the coin's existing holders at that point.",
  ],
  [
    "Can I lose money?",
    "Yes. Coins launched on ZEEP are experimental and can lose all value, and a gacha card can be worth less than its pack. Nothing on this site is financial advice.",
  ],
];

function FaqItem({ id, question, answer, defaultOpen }: { id: string; question: string; answer: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  // id comes from the list index, not useId(): useId differs between the server
  // render and hydration under Next dev tooling, which React flags as a mismatch.
  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <h2 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className={cn("flex min-h-11 w-full items-center justify-between gap-4 py-4 text-left", focusRing)}
        >
          <span className="text-[15px] font-semibold">{question}</span>
          <IconChevronDown className={cn("size-[18px] shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 ease-out", open && "rotate-180")} stroke={1.75} aria-hidden />
        </button>
      </h2>
      {/* grid-rows 0fr→1fr animates the real content height without measuring it */}
      <div id={id} role="region" className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!open}>
          <p className="max-w-[620px] pb-5 text-[14px] leading-relaxed text-[var(--muted-foreground)]">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqPage() {

  return (
    <section className="mx-auto max-w-[760px] px-6 pb-20 pt-14">
      <h1 className="text-[38px]">FAQ</h1>
      <p className="mt-2.5 text-[var(--muted-foreground)]">
        For the full picture, see{" "}
        <Link href="/docs" className="text-[var(--primary)] hover:underline">
          Docs
        </Link>
        .
      </p>

      <div className="mt-8">
        {FAQS.map(([q, a], i) => (
          <FaqItem key={q} id={`faq-answer-${i}`} question={q} answer={a} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}
