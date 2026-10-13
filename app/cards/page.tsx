"use client";

import * as React from "react";
import Link from "next/link";
import { listCoins, type CoinRow } from "@/lib/api";
import { fmtEth, fmtInt } from "@/lib/format";
import { CoinCard, CoinCardSkeleton } from "@/components/coin-card";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export default function CardVaultsPage() {
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    document.title = "Card Collections · ZEEP";
  }, []);

  React.useEffect(() => {
    listCoins({ list: "new" })
      .then((data) => setRows(data.rows.filter((r) => r.category === "cards")))
      .catch(() => setError(true));
  }, []);

  const totals = rows?.reduce(
    (a, r) => {
      a.vault += r.vault_eth || 0;
      a.nfts += r.nfts_held || 0;
      a.fees += r.fees_awaiting || 0;
      return a;
    },
    { vault: 0, nfts: 0, fees: 0 },
  );

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pb-8 pt-14 text-center">
        <h1 className="text-[34px] sm:text-[46px]">
          Reserves that hunt <span className="text-[var(--primary)]">real cards</span>.
        </h1>
        <p className="mx-auto mt-3.5 max-w-[540px] text-[var(--muted-foreground)]">
          Pair a coin with a Pokémon or One Piece listing on launch. Every trade feeds its reserve, which buys graded cards on
          the open market and raffles them straight to holders.
        </p>
        <div className="mt-5 flex justify-center gap-2.5">
          {["Pokémon", "One Piece", "More sets soon"].map((tag) => (
            <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-[7px] text-[13px] font-semibold">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-6">
          <Link
            href="/launch"
            className={cn("inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5]", focusRing)}
          >
            Launch a card reserve
          </Link>
        </div>
      </section>

      <section className="mx-auto mb-2 mt-8 max-w-[1180px] px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
          {[
            ["Card reserves", rows ? fmtInt(rows.length) : "—"],
            ["ETH in reserves", totals ? fmtEth(totals.vault) : "—"],
            ["Cards held", totals ? fmtInt(totals.nfts) : "—"],
            ["Fees awaiting", totals ? `${fmtEth(totals.fees)} ETH` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="bg-[var(--background)] px-5 py-4">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
              <div className="mt-1 font-mono-tabular text-[20px]">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-10">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Coming soon · Grail Mode
          </span>
          <h2 className="mt-3 text-[26px] sm:text-[30px]">
            Save up for <span className="text-[var(--primary)]">one grail</span>.
          </h2>
          <p className="mt-2.5 max-w-[620px] text-[var(--muted-foreground)]">
            Instead of buying the cheapest card every tick, a Grail Mode coin&apos;s reserve saves everything until it can
            afford one specific graded card, then buys only that — one card, one raffle, one winner.
          </p>
          <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
            {[
              ["01", "Pick a grail at launch"],
              ["02", "The reserve saves, buys nothing else"],
              ["03", "It buys the grail the moment it can afford it"],
              ["04", "One holder wins it"],
            ].map(([n, label]) => (
              <li key={n} className="rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] p-3.5">
                <div className="font-mono-tabular text-[11px] text-[var(--muted-foreground)]">{n}</div>
                <div className="mt-1 text-[13px]">{label}</div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[12px] text-[var(--muted-foreground)]">
            Not live yet — Grail Mode needs a reserve policy that targets one specific card instead of &quot;cheapest in
            category&quot;, plus a real-time price feed from the Solana card marketplace. The regular raffle/hold/burn
            reserves above are real.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={rows === null}>
          {error ? (
            <div role="alert" className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[70px] text-center text-[var(--muted-foreground)]">
              Could not load card reserves.
            </div>
          ) : rows === null ? (
            Array.from({ length: 6 }).map((_, i) => <CoinCardSkeleton key={i} />)
          ) : rows.length ? (
            rows.map((row) => <CoinCard key={row.token} row={row} />)
          ) : (
            <div className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[70px] text-center text-[var(--muted-foreground)]">
              No card reserves yet.{" "}
              <Link href="/launch" className="text-[var(--primary)]">
                Launch the first one →
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
