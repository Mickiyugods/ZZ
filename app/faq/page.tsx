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
    "A coin launcher on Robinhood Chain. Launching mints a regular Pons coin — the same bonding-curve mechanism MONETA uses — and ZEEP pairs it with one NFT collection and a fixed payout rule (raffle to holders, hold, or burn), funded by a share of the coin's own trading fees.",
  ],
  [
    "Is this a gacha or loot-box product?",
    "No. ZEEP never charges fiat for a randomized reward. The only randomness is a raffle draw among a coin's own existing holders, funded entirely by trading fees the market already generated — not a separate purchase.",
  ],
  [
    "What happens to my coin's trading fees?",
    "80% of every ZEEP-routed trading fee goes into that coin's reserve, 20% to the ZEEP treasury. Anyone can trigger a harvest to pull accrued fees in — it's not restricted to ZEEP or the coin's creator.",
  ],
  [
    "Can the collection or payout rule change after I launch?",
    "No. Both are locked at launch. There's no admin key on the reserve, and withdrawals are disabled by design — nothing can pull funds back out except to buy the paired collection.",
  ],
  [
    "Are the Pokémon and One Piece cards real?",
    "Yes. They're tokenized by Courtyard.io, a real-world-asset vaulting platform — burning the NFT gets the physical, custodied card shipped. That vault runs on Polygon, priced in USD/USDC. A second line, Collector Crypt, works the same way on Solana.",
  ],
  [
    "Is the reserve actually buying NFTs right now?",
    "Not yet. The live site runs a transparent simulation (Phase 1.5): it reads real on-chain Pons fee data, but purchases and raffle draws are logged, not executed. Any reserve panel in that state shows a \"Simulated\" badge. The full on-chain system that would actually buy and raffle NFTs (Phase 2) is built and tested but not deployed — see Contracts for its status.",
  ],
  [
    "How does the raffle decide a winner?",
    "The draw is seeded from a future block hash, so the outcome can't be seen in advance by anyone, including ZEEP. The winner is picked from the coin's existing holders at that point.",
  ],
  [
    "Can I lose money?",
    "Yes. Coins launched on ZEEP are experimental and can lose all value. Nothing on this site is financial advice.",
  ],
];

function FaqItem({ question, answer, defaultOpen }: { question: string; answer: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className="border-b border-[var(--border)] py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("flex w-full items-center justify-between gap-4 text-left", focusRing)}
      >
        <span className="text-[15px] font-semibold">{question}</span>
        <IconChevronDown className={cn("size-[18px] shrink-0 text-[var(--muted-foreground)] transition-transform duration-150", open && "rotate-180")} stroke={1.75} />
      </button>
      {open && <p className="mt-2.5 max-w-[620px] text-[14px] leading-relaxed text-[var(--muted-foreground)]">{answer}</p>}
    </div>
  );
}

export default function FaqPage() {
  React.useEffect(() => {
    document.title = "FAQ · ZEEP";
  }, []);

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
          <FaqItem key={q} question={q} answer={a} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}
