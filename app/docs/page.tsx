"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--border)] py-8 first:border-t-0 first:pt-0">
      <h2 className="text-[20px]">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[14px] leading-relaxed text-[var(--muted-foreground)]">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  React.useEffect(() => {
    document.title = "Docs · ZEEP";
  }, []);

  return (
    <section className="mx-auto max-w-[760px] px-6 pb-20 pt-14">
      <h1 className="text-[38px]">Docs</h1>
      <p className="mt-2.5 text-[var(--muted-foreground)]">How ZEEP's coins, reserves and card collections actually work.</p>

      <div className="mt-10">
        <Section title="What ZEEP is">
          <p>
            ZEEP is a coin launcher on Robinhood Chain, built on the same Pons V2 bonding-curve mechanism as MONETA.
            Launching a coin mints a regular Pons coin — nothing about that part is ZEEP-specific. What ZEEP adds on top is
            a <strong className="text-[var(--foreground)]">reserve</strong>: at launch, you pair your coin with one listed
            NFT collection and a fixed payout rule (raffle to holders, hold, or burn). From then on, a share of every trade
            routes into that collection&apos;s reserve.
          </p>
          <p>ZEEP is not a gacha or loot-box product and never charges fiat for randomized rewards. The only randomness is a raffle draw among a coin&apos;s own existing holders, funded by trading fees the market already generated.</p>
        </Section>

        <Section title="Launching a coin">
          <p>
            The launch wizard is four steps: name and image, the collection you&apos;re pairing with, the payout rule and
            creator tax, then a final confirm. Once you sign the transaction, the pairing is locked — the collection and
            outcome can&apos;t change after the coin ships, and there&apos;s no admin key on the reserve that could override
            it later.
          </p>
        </Section>

        <Section title="How the reserve works">
          <ul className="flex flex-col gap-2">
            <li>• 80% of every ZEEP-routed trading fee goes to the coin&apos;s reserve, 20% to the ZEEP treasury.</li>
            <li>• The reserve can only buy at or under its posted price ceiling, which expires after 1 hour.</li>
            <li>• Purchases only ever happen through Seaport 1.6 — no other marketplace integration exists.</li>
            <li>• Reserve withdrawals are disabled by design. Nothing, including ZEEP, can pull funds back out except to buy the paired collection.</li>
            <li>• Harvesting accrued fees into the reserve is callable by anyone — it&apos;s not gated behind a privileged account.</li>
            <li>• Raffle draws are seeded from a future block hash, so no one — including ZEEP — can see the outcome before it&apos;s committed.</li>
          </ul>
        </Section>

        <Section title="Card collections">
          <p>
            Pokémon and One Piece cards aren&apos;t native NFTs — they&apos;re tokenized by Courtyard.io, a real-world-asset
            vaulting platform: burn the NFT and Courtyard ships the physical, custodied card. Courtyard&apos;s vault runs on
            Polygon, and pricing there is USD/USDC, not ETH. A second card line, Collector Crypt, runs the same way on
            Solana. Because neither lives on Robinhood Chain, pairing a coin with them routes through ZEEP&apos;s cross-chain
            contracts rather than the native ones used for Robinhood Chain collections.
          </p>
        </Section>

        <Section title="Current status">
          <p>
            <strong className="text-[var(--foreground)]">Phase 1 — live.</strong> Coins launch as real, on-chain Pons coins,
            verified against the actual launch transaction before anything is recorded.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Phase 1.5 — live, simulated.</strong> A scheduled keeper reads real
            on-chain Pons fee data for every coin, but purchases and raffle draws are logged, not executed — no private key,
            no real ETH moves. Every reserve panel that&apos;s running this way shows a &quot;Simulated&quot; badge.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Phase 2 — built and tested, not deployed.</strong> A full on-chain
            contract system that actually buys, holds and raffles NFTs exists and passes its test suite, but hasn&apos;t
            been deployed anywhere real, audited, or had a keeper wallet funded. See{" "}
            <Link href="/contracts" className="text-[var(--primary)] hover:underline">
              Contracts
            </Link>{" "}
            for what that system is made of.
          </p>
        </Section>

        <Section title="Risk">
          <p>Coins launched on ZEEP are experimental and can lose all value. Nothing on this site is financial advice.</p>
        </Section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/faq"
          className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold hover:border-[var(--muted-foreground)]", focusRing)}
        >
          Read the FAQ
        </Link>
        <Link
          href="/contracts"
          className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold hover:border-[var(--muted-foreground)]", focusRing)}
        >
          View contracts
        </Link>
      </div>
    </section>
  );
}
