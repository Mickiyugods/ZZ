"use client";

import * as React from "react";
import Link from "next/link";
import { IconSearch, IconX } from "@tabler/icons-react";
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
  const [retry, setRetry] = React.useState(0);

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
  }, [list, search, retry]);

  const rows: CoinRow[] = data?.rows ?? [];

  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-12">
      <h1 className="text-[40px]">Explore</h1>
      <p className="mt-2 max-w-[520px] text-[var(--muted-foreground)]">
        Every coin launched on ZEEP, with the reserve it&apos;s building and the NFTs it holds. Sort by newest, biggest reserve, or most NFTs collected.
      </p>

      <div role="tablist" aria-label="Sort coins" className="mt-5 flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
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
      <div className="relative my-5">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[var(--muted-foreground)]" stroke={1.75} aria-hidden />
        <input
          id="coin-search"
          type="search"
          placeholder="Search by name, ticker or collection"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] bg-[var(--card)] py-3.5 pl-11 pr-11 text-[14px] transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] [&::-webkit-search-cancel-button]:hidden",
            focusRing,
          )}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className={cn("absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-white/5 hover:text-[var(--foreground)]", focusRing)}
          >
            <IconX className="size-4" stroke={2} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {[
          ["Coins", data ? fmtInt(data.coins) : "—"],
          ["ETH in reserves", data ? `${fmtEth(data.vaultEth)} ETH` : "—"],
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
          <div role="alert" className="col-span-full flex flex-col items-center gap-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] px-6 py-[60px] text-center text-[var(--muted-foreground)]">
            Couldn&apos;t load the coin registry. Check your connection and try again.
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className={cn("min-h-11 rounded-full border border-[var(--border)] px-5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:border-white/40", focusRing)}
            >
              Try again
            </button>
          </div>
        ) : data === null ? (
          Array.from({ length: 6 }).map((_, i) => <CoinCardSkeleton key={i} />)
        ) : rows.length ? (
          rows.map((row, i) => (
            <div key={row.token} className="zeep-rise" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
              <CoinCard row={row} />
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center gap-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] px-6 py-[60px] text-center text-[var(--muted-foreground)]">
            {search ? <>No coin matches &ldquo;{search}&rdquo;.</> : "No coins launched yet — be the first."}
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className={cn("min-h-11 rounded-full border border-[var(--border)] px-5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:border-white/40", focusRing)}
              >
                Clear search
              </button>
            ) : (
              <Link href="/launch" className={cn("inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-5 text-[13px] font-semibold text-[var(--primary-foreground)]", focusRing)}>
                Launch a coin
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
