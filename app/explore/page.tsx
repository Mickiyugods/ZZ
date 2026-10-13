"use client";

import * as React from "react";
import { listCoins, type CoinRow, type CoinsResponse } from "@/lib/api";
import { fmtEth, fmtInt } from "@/lib/format";
import { CoinCard, CoinCardSkeleton } from "@/components/coin-card";
import { cn } from "@/lib/utils";

const TABS: { key: "new" | "top" | "nfts"; label: string }[] = [
  { key: "new", label: "New" },
  { key: "top", label: "Top reserve" },
  { key: "nfts", label: "Most NFTs" },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export default function ExplorePage() {
  const [list, setList] = React.useState<"new" | "top" | "nfts">("new");
  const [search, setSearch] = React.useState("");
  const [data, setData] = React.useState<CoinsResponse | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    document.title = "Explore · ZEEP";
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setData(null);
      setError(false);
      listCoins({ list, search })
        .then(setData)
        .catch(() => setError(true));
    }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [list, search]);

  const rows: CoinRow[] = data?.rows ?? [];

  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-12">
      <h1 className="text-[40px]">Explore</h1>

      <div role="tablist" aria-label="Sort coins" className="mt-2 flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={list === t.key}
            onClick={() => setList(t.key)}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition-colors",
              focusRing,
              list === t.key ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label htmlFor="coin-search" className="sr-only">
        Search by name, ticker or collection
      </label>
      <input
        id="coin-search"
        type="search"
        placeholder="Search by name, ticker or collection"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(
          "my-5 w-full rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 text-[14px] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]",
          focusRing,
        )}
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {[
          ["Coins", data ? fmtInt(data.coins) : "—"],
          ["ETH in reserves", data ? fmtEth(data.vaultEth) : "—"],
          ["NFTs held", data ? fmtInt(data.nftsHeld) : "—"],
          ["Fees awaiting", data ? `${fmtEth(data.feesAwaiting)} ETH` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-[var(--background)] px-5 py-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
            <div className="mt-1 font-mono-tabular text-[20px]">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={data === null}>
        {error ? (
          <div role="alert" className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[70px] text-center text-[var(--muted-foreground)]">
            Could not load the registry.
          </div>
        ) : data === null ? (
          Array.from({ length: 6 }).map((_, i) => <CoinCardSkeleton key={i} />)
        ) : rows.length ? (
          rows.map((row) => <CoinCard key={row.token} row={row} />)
        ) : (
          <div className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[70px] text-center text-[var(--muted-foreground)]">
            No coins match yet.
          </div>
        )}
      </div>
    </section>
  );
}
