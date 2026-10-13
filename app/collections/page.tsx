"use client";

import * as React from "react";
import Link from "next/link";
import { COLLECTIONS, type Category } from "@/lib/collections";
import { listCoins, type CoinRow } from "@/lib/api";
import { fmtEth, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const CATS: { key: Exclude<Category, "cards"> | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pfp", label: "PFP" },
  { key: "art", label: "Art" },
];

interface Agg {
  coins: number;
  vaultEth: number;
  nftsHeld: number;
}

export default function CollectionsPage() {
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [category, setCategory] = React.useState<Exclude<Category, "cards"> | "all">("all");
  const [search, setSearch] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    document.title = "Collections · ZEEP";
  }, []);

  React.useEffect(() => {
    listCoins({ list: "new" })
      .then((data) => setRows(data.rows))
      .catch(() => setError(true));
  }, []);

  const byCollection = React.useMemo(() => {
    const map = new Map<string, Agg>();
    for (const r of rows ?? []) {
      const agg = map.get(r.collection_slug) ?? { coins: 0, vaultEth: 0, nftsHeld: 0 };
      agg.coins += 1;
      agg.vaultEth += r.vault_eth || 0;
      agg.nftsHeld += r.nfts_held || 0;
      map.set(r.collection_slug, agg);
    }
    return map;
  }, [rows]);

  // Card collections get their own page (/cards) — not mixed into this list.
  const pfpAndArt = React.useMemo(() => COLLECTIONS.filter((c) => c.category !== "cards"), []);
  const matched = (category === "all" ? pfpAndArt : pfpAndArt.filter((c) => c.category === category)).filter((c) =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) : true,
  );
  // Rendering 400+ rows (each with a hotlinked image) at once is the main
  // reason this page used to feel heavy — cap it until the visitor searches,
  // filters, or explicitly asks for the rest.
  const PAGE_SIZE = 60;
  const list = showAll || search ? matched : matched.slice(0, PAGE_SIZE);

  React.useEffect(() => {
    setShowAll(false);
  }, [category, search]);

  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-12">
      <h1 className="text-[40px]">Collections</h1>
      <p className="mt-2 max-w-[560px] text-[var(--muted-foreground)]">
        {fmtInt(pfpAndArt.length)} real PFP and art collections a new coin can be paired with. Each coin sweeps exactly
        one — native on Robinhood Chain, or via a cross-chain reserve for the rest (Ethereum, Base, Hyperliquid, Polygon,
        Solana). Looking for graded cards?{" "}
        <Link href="/cards" className="text-[var(--primary)] underline-offset-2 hover:underline">
          See Card Reserves →
        </Link>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div role="tablist" aria-label="Filter by category" className="flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
          {CATS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={category === t.key}
              onClick={() => setCategory(t.key)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition-colors",
                focusRing,
                category === t.key ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]",
              )}
            >
              {t.label}
            </button>
          ))}
          <Link
            href="/cards"
            className={cn(
              "flex min-h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]",
              focusRing,
            )}
          >
            Cards ↗
          </Link>
        </div>
        <label htmlFor="collection-search" className="sr-only">
          Search collections by name
        </label>
        <input
          id="collection-search"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "min-h-11 min-w-[200px] flex-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]",
            focusRing,
          )}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <th className="px-4 py-3 font-medium">Collection</th>
              <th className="px-4 py-3 font-medium">Chain</th>
              <th className="px-4 py-3 font-medium">Coins</th>
              <th className="px-4 py-3 font-medium">ETH in reserves</th>
              <th className="px-4 py-3 font-medium">NFTs held</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                  Could not load the registry.
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                  No collections match &quot;{search}&quot;.
                </td>
              </tr>
            ) : (
              list.map((c) => {
                const agg = byCollection.get(c.slug);
                return (
                  <tr key={c.slug} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/launch?collection=${c.slug}`} className={cn("flex items-center gap-2.5 rounded", focusRing)}>
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image}
                            alt=""
                            width={28}
                            height={28}
                            loading="lazy"
                            decoding="async"
                            className="size-7 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="size-7 shrink-0 rounded-md bg-[var(--border)]" />
                        )}
                        <span className="font-semibold">{c.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.chain}</td>
                    <td className="px-4 py-3 font-mono-tabular">{rows ? fmtInt(agg?.coins ?? 0) : "—"}</td>
                    <td className="px-4 py-3 font-mono-tabular">{rows ? fmtEth(agg?.vaultEth ?? 0) : "—"}</td>
                    <td className="px-4 py-3 font-mono-tabular">{rows ? fmtInt(agg?.nftsHeld ?? 0) : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!showAll && !search && matched.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={cn(
            "mt-4 flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] border border-[var(--border)] text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            focusRing,
          )}
        >
          Show all {fmtInt(matched.length)} collections
        </button>
      )}
    </section>
  );
}
