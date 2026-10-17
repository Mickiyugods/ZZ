"use client";

import * as React from "react";
import Link from "next/link";
import { MAX_CREATOR_TAX_BPS, PONS_CREATOR_BASE_BPS } from "@/lib/config";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const SECTIONS = [
  { id: "what", title: "What ZEEP is" },
  { id: "launching", title: "Launching a coin" },
  { id: "fees", title: "Fees & numbers" },
  { id: "reserve", title: "How the reserve works" },
  { id: "cards", title: "Card collections" },
  { id: "gacha", title: "Gacha Station" },
  { id: "status", title: "Current status" },
  { id: "risk", title: "Risk" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[var(--border)] py-9 first:border-t-0 first:pt-0">
      <h2 className="text-[22px]">{title}</h2>
      <div className="mt-3.5 flex flex-col gap-3 text-[15px] leading-relaxed text-[var(--muted-foreground)]">{children}</div>
    </section>
  );
}

const strong = "font-semibold text-[var(--foreground)]";

// Every figure here is read off Pons V2 on-chain or measured on live coins
// (see CLAUDE.md "How Pons prices things") — keep it in sync if Pons changes.
const FEES: [string, string, string][] = [
  ["Launch fee", "0.0005 ETH", "One-time, paid to Pons in the launch transaction (plus gas)."],
  ["Trading fee", "1% of every buy and sell", `Pons' curve fee. About ${(PONS_CREATOR_BASE_BPS / 100).toFixed(2)}% of each trade is paid to the coin's creator side.`],
  ["Creator tax", `0–${MAX_CREATOR_TAX_BPS / 100}%`, "Optional extra cut of every trade, chosen at launch and fixed after."],
  ["Earnings split", "80% reserve · 20% treasury", "Applied to everything the creator side earns, once ZEEP's router is live."],
  ["Supply", "1,000,000,000", "Fixed. No minting after launch."],
  ["Starting market cap", "1.68 ETH", "Every Pons ETH curve starts at 1.68 ETH of virtual liquidity over 1B tokens."],
  ["Graduation", "4.20 ETH raised", "The curve then graduates the coin into a locked Pons pool."],
  ["Anti-snipe tax", "First seconds only", "Pons charges the very first buyers extra, so launch-block bots can't take the curve."],
];

export default function DocsPage() {
  const [active, setActive] = React.useState<string>(SECTIONS[0].id);

  React.useEffect(() => {
    document.title = "Docs · ZEEP";
  }, []);

  // Scroll-spy: highlight the section currently in the reading band.
  React.useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-[1080px] px-6 pb-20 pt-14">
      <header className="max-w-[720px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Documentation</p>
        <h1 className="mt-2 text-[40px] leading-[1.05] sm:text-[48px]">How ZEEP works</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--muted-foreground)]">
          Coins, reserves, fees and the Gacha Station — what&apos;s live today, and what&apos;s still being built.
        </p>
      </header>

      {/* mobile: section chips */}
      <nav aria-label="On this page" className="-mx-6 mt-8 flex gap-2 overflow-x-auto px-6 pb-1 lg:hidden">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={cn("shrink-0 rounded-full border border-[var(--border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--muted-foreground)]", focusRing)}>
            {s.title}
          </a>
        ))}
      </nav>

      <div className="mt-10 grid gap-12 lg:grid-cols-[200px_1fr]">
        {/* desktop: sticky table of contents */}
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-8 flex flex-col gap-1 border-l border-[var(--border)]">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "true" : undefined}
                  className={cn(
                    "-ml-px block border-l-2 py-1.5 pl-4 text-[13px] transition-colors duration-150",
                    focusRing,
                    active === s.id ? "border-[var(--primary)] font-semibold text-[var(--foreground)]" : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 max-w-[720px]">
          <Section id="what" title="What ZEEP is">
            <p>
              ZEEP is a coin launcher on Robinhood Chain, built on Pons&apos; V2 bonding curve. Launching a coin mints a
              regular Pons coin — nothing about that part is ZEEP-specific. What ZEEP adds on top is a{" "}
              <strong className={strong}>reserve</strong>: at launch you pair the coin with one listed NFT collection and a
              fixed payout rule (raffle to holders, hold, or burn). From then on, a share of every trade is set aside for
              that collection&apos;s reserve.
            </p>
            <p>
              A ZEEP coin itself is not a gacha or loot box. The only randomness in a coin is a raffle among its own existing
              holders, funded by trading fees the market already generated. The{" "}
              <a href="#gacha" className="text-[var(--primary)] hover:underline">
                Gacha Station
              </a>{" "}
              is a separate feature, explained below.
            </p>
          </Section>

          <Section id="launching" title="Launching a coin">
            <p>
              The launch wizard has four steps: name and image, the collection you&apos;re pairing with, the payout rule and
              creator tax, then a final review. Once you sign, the pairing is locked — the collection and outcome can&apos;t
              change after the coin ships, and no key, not even ZEEP&apos;s, can withdraw from the reserve; it can only buy
              the paired collection.
            </p>
            <p>
              There is no dev buy in a ZEEP launch: your coin starts exactly at the curve&apos;s opening price, and you can buy
              your own coin from its page like anyone else.
            </p>
          </Section>

          <Section id="fees" title="Fees & numbers">
            <p>Everything a coin costs and earns, with no small print.</p>
            <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
              <dl>
                {FEES.map(([k, v, note]) => (
                  <div key={k} className="grid gap-1 border-b border-[var(--border)] px-4 py-3.5 last:border-0 sm:grid-cols-[170px_1fr] sm:gap-4">
                    <dt className="text-[13px] font-semibold text-[var(--foreground)]">{k}</dt>
                    <dd>
                      <span className="font-mono-tabular text-[14px] text-[var(--foreground)]">{v}</span>
                      <span className="mt-0.5 block text-[13px]">{note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Section>

          <Section id="reserve" title="How the reserve works">
            <p className="text-[13px] uppercase tracking-[0.12em]">Phase 2 contract design</p>
            <ul className="flex flex-col gap-2.5">
              <li>• 80% of everything a coin&apos;s creator side earns goes to its reserve, 20% to the ZEEP treasury.</li>
              <li>• The reserve can only buy at or under its posted price ceiling, which expires after 1 hour.</li>
              <li>• Purchases only ever happen through Seaport 1.6 — no other marketplace integration exists.</li>
              <li>• Withdrawals are disabled by design. Nothing, including ZEEP, can pull funds out except to buy the paired collection.</li>
              <li>• Harvesting accrued fees into the reserve is callable by anyone — it isn&apos;t gated behind a privileged account.</li>
              <li>• Raffle draws are seeded from a future block hash, so no one — including ZEEP — can see the outcome before it&apos;s committed.</li>
            </ul>
            <p>
              The ZEEP treasury — the 20% side of that split — is a single wallet controlled by the ZEEP project owner, not a
              DAO or a governance contract. It receives the protocol&apos;s share the same mechanical way a reserve receives
              its own, and it has no access to any coin&apos;s reserve. See{" "}
              <Link href="/contracts" className="text-[var(--primary)] hover:underline">
                Contracts
              </Link>{" "}
              for the contract that enforces the split.
            </p>
          </Section>

          <Section id="cards" title="Card collections">
            <p>
              Pokémon and One Piece cards aren&apos;t native NFTs — they&apos;re tokenized by Courtyard.io, a real-world-asset
              vaulting platform: burn the NFT and Courtyard ships the physical, custodied card. Courtyard runs on Polygon and
              prices in USD/USDC, not ETH. A second card line, Collector Crypt, works the same way on Solana. Because neither
              lives on Robinhood Chain, pairing a coin with them goes through ZEEP&apos;s cross-chain contracts rather than the
              native ones.
            </p>
          </Section>

          <Section id="gacha" title="Gacha Station">
            <p>
              The Gacha Station is powered by <strong className={strong}>Collector Crypt</strong> on Solana. You pay a fixed
              USDC price for a sealed Pokémon or One Piece pack and receive one graded card, drawn at the odds published on
              each machine, as an NFT you can redeem for the physical card.
            </p>
            <p>
              The machines, odds, prices and cards are Collector Crypt&apos;s — ZEEP shows them and lets you sign with your own
              Solana wallet. ZEEP coins and reserves aren&apos;t involved, and ZEEP never holds your funds.
            </p>
          </Section>

          <Section id="status" title="Current status">
            <p>
              <strong className={strong}>Phase 1 — live.</strong> Coins launch as real, on-chain Pons coins, verified against
              the actual launch transaction before anything is recorded. Market data on every coin page comes straight from
              Pons.
            </p>
            <p>
              <strong className={strong}>Phase 1.5 — live, simulated.</strong> A scheduled keeper reads real on-chain Pons fee
              data for every coin, but purchases and raffle draws are logged, not executed — no private key, no real ETH moves.
              Every reserve panel running this way shows a &quot;Simulated&quot; badge. Until the router is deployed, Pons pays
              a coin&apos;s creator fees to the creator&apos;s own wallet.
            </p>
            <p>
              <strong className={strong}>Phase 2 — built and tested, not deployed.</strong> The on-chain contracts that
              actually buy, hold and raffle NFTs pass their test suite, but haven&apos;t been deployed, audited, or had a
              keeper wallet funded. See{" "}
              <Link href="/contracts" className="text-[var(--primary)] hover:underline">
                Contracts
              </Link>{" "}
              for what that system is made of.
            </p>
          </Section>

          <Section id="risk" title="Risk">
            <p>Coins launched on ZEEP are experimental memecoins and can lose all value. Gacha pulls are random and a card can be worth less than its pack. Nothing on this site is financial advice.</p>
          </Section>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/faq" className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold transition-colors duration-200 hover:border-[var(--muted-foreground)]", focusRing)}>
              Read the FAQ
            </Link>
            <Link href="/contracts" className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold transition-colors duration-200 hover:border-[var(--muted-foreground)]", focusRing)}>
              View contracts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
