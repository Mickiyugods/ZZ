"use client";

import * as React from "react";
import Link from "next/link";
import { listCoins, type CoinRow } from "@/lib/api";
import { fmtEth, fmtInt } from "@/lib/format";
import { CoinCard, CoinCardSkeleton } from "@/components/coin-card";
import { Hero10 } from "@/components/ui/hero-10";
import { useWallet } from "@/lib/useWallet";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

// Real, recognizable NFT collections (see /collections for the full real
// list — not imported here: it's 400+ entries and this only ever needs 4).
// Hardcoded, not fabricated: the same OpenSea-hosted logos shown there.
// These are on Ethereum, so pairing a coin with them routes through the
// cross-chain External Vault/Launcher, not the native Robinhood one — see
// CLAUDE.md "Contracts workspace".
const HERO_NFTS = [
  { name: "Bored Ape Yacht Club", image: "https://i2c.seadn.io/collection/boredapeyachtclub/image/1a09c26b1c30427b26944c47fc7bb9/d81a09c26b1c30427b26944c47fc7bb9.png" },
  { name: "Pudgy Penguins", image: "https://i2c.seadn.io/collection/pudgypenguins/image/f489fb69fd11886b468c0f7ff1376c/cdf489fb69fd11886b468c0f7ff1376c.png" },
  { name: "Milady Maker", image: "https://i2c.seadn.io/collection/milady/image/d4499e2e55f5e85ead4b0eb7f7dad7/90d4499e2e55f5e85ead4b0eb7f7dad7.jpeg" },
  { name: "Azuki", image: "https://i2c.seadn.io/collection/azuki/image/d62d4b9df96c961712b03f41c4231c/4dd62d4b9df96c961712b03f41c4231c.jpeg" },
];

// No licensed Pokémon/One Piece card photography lives in this codebase, and
// none is fabricated here — these are deliberately plain, labeled
// placeholders, not real card art, consistent with "no fabricated art"
// elsewhere in CLAUDE.md. A real card image only ever comes from the actual
// Courtyard listing a purchase executes against, once Phase 2 ships.
const HERO_CARDS = [
  { label: "Pokémon", sub: "Graded cards" },
  { label: "One Piece", sub: "Manga alt art" },
];

// `size` picks a fixed, non-responsive height so this renders consistently
// wherever it's used (a "mini" row tile must not grow at the lg breakpoint
// just because the hero's "showcase" variant does).
function CardPlaceholder({
  label,
  sub,
  size = "showcase",
  className,
}: {
  label: string;
  sub: string;
  size?: "showcase" | "mini";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-[5/7] shrink-0 flex-col justify-between rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--background)] shadow-[0_10px_24px_rgba(0,0,0,0.5)]",
        size === "showcase" ? "h-[92px] p-2 sm:h-[130px] sm:p-2.5 lg:h-[170px]" : "h-[52px] p-1.5",
        className,
      )}
    >
      <span className={cn("font-bold uppercase leading-tight tracking-wider text-[var(--muted-foreground)]", size === "showcase" ? "text-[8px] sm:text-[10px]" : "text-[7px]")}>
        {label}
      </span>
      <span className={cn("leading-tight text-[var(--muted-foreground)]", size === "showcase" ? "text-[7px] sm:text-[9px]" : "text-[6px]")}>{sub}</span>
    </div>
  );
}

// Compact hero showcase: 2 card placeholders + 4 real NFT logos, fanned with
// slight overlap/rotation for depth. Sized to stay well under the hero's
// text/CTA width — max ~170px tall / ~580px wide at desktop, scaling down
// through tablet and mobile — and never claims to be more than a visual intro.
function HeroShowcase() {
  return (
    <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 lg:-space-x-5">
      <CardPlaceholder label={HERO_CARDS[0].label} sub={HERO_CARDS[0].sub} className="-rotate-6 translate-y-2" />
      <CardPlaceholder label={HERO_CARDS[1].label} sub={HERO_CARDS[1].sub} className="z-10 rotate-3" />
      {HERO_NFTS.map((n, i) => (
        <div
          key={n.name}
          className={cn(
            "aspect-square h-[56px] shrink-0 overflow-hidden rounded-xl border border-[var(--border)] shadow-[0_10px_24px_rgba(0,0,0,0.5)] sm:h-[78px] lg:h-[104px]",
            i % 2 === 0 ? "translate-y-2.5 -rotate-3" : "-translate-y-2 rotate-3",
          )}
        >
          <img src={n.image} alt={n.name} loading="eager" decoding="async" className="size-full object-cover" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const wallet = useWallet();
  const [totals, setTotals] = React.useState<{ coins: number; vaultEth: number; nftsHeld: number } | null>(null);
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [myTotals, setMyTotals] = React.useState<{ coins: number; vaultEth: number } | null>(null);

  React.useEffect(() => {
    document.title = "ZEEP — memecoins with a reserve inside";
  }, []);

  React.useEffect(() => {
    listCoins({ list: "new" })
      .then((data) => {
        setTotals({ coins: data.coins, vaultEth: data.vaultEth, nftsHeld: data.nftsHeld });
        setRows(data.rows.slice(0, 6));
      })
      .catch(() => setError(true));
  }, []);

  React.useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      setMyTotals(null);
      return;
    }
    listCoins({ deployer: wallet.address })
      .then((data) => setMyTotals({ coins: data.coins, vaultEth: data.vaultEth }))
      .catch(() => setMyTotals(null));
  }, [wallet.connected, wallet.address]);

  return (
    <>
      <Hero10
        title="Every trade"
        titleLine2Prefix="feeds the"
        titleHighlight="reserve."
        description="Pick an NFT collection and a payout rule when you launch — raffle, hold, or burn. From that point on, a share of every trade routes on-chain into that collection's reserve automatically. No admin key can touch it and no one can change the rule once the coin is live."
        socialProof={
          totals
            ? `${fmtInt(totals.coins)} coins live · ${fmtEth(totals.vaultEth)} ETH working in reserves`
            : error
              ? "Live totals unavailable right now."
              : "Loading live totals…"
        }
        mediaSlot={<HeroShowcase />}
        layout="split"
        animation="subtle"
        primaryCTA={{ ctaEnabled: true, text: "Launch a coin", link: "/launch", variant: "default" }}
        secondaryCTA={{ ctaEnabled: true, text: "Explore coins", link: "/explore", variant: "outline" }}
      />

      <section className="mx-auto max-w-[1180px] px-6 pb-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius)] border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.14)] sm:grid-cols-3">
          {[
            ["Coins launched", totals ? fmtInt(totals.coins) : "—"],
            ["NFTs collected", totals ? fmtInt(totals.nftsHeld) : "—"],
            ["ETH in reserves", totals ? fmtEth(totals.vaultEth) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="bg-[var(--background)] px-6 py-[22px]">
              <div className="font-mono-tabular text-[32px] font-bold leading-none tracking-tight text-[var(--primary)]">{value}</div>
              <div className="mt-2 text-[12px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {wallet.connected && (
        <section className="mx-auto max-w-[1180px] px-6 pb-10">
          <Link
            href="/profile"
            className={cn(
              "flex flex-col items-start justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-6 py-4 hover:border-[var(--muted-foreground)] sm:flex-row sm:items-center",
              focusRing,
            )}
          >
            <span className="text-[14px]">
              You&apos;ve launched <strong className="font-mono-tabular">{myTotals ? fmtInt(myTotals.coins) : "…"}</strong>{" "}
              {myTotals?.coins === 1 ? "coin" : "coins"} ·{" "}
              <strong className="font-mono-tabular">{myTotals ? fmtEth(myTotals.vaultEth) : "…"}</strong> ETH in reserves
            </span>
            <span className="text-[13px] font-semibold text-[var(--primary)]">View profile →</span>
          </Link>
        </section>
      )}

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--background)] p-7">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-block rounded-full bg-[var(--primary)] px-2.5 py-[3px] text-[11px] font-bold tracking-wide text-[var(--primary-foreground)]">
                Card Collections
              </span>
              <Link
                href="/cards"
                className={cn("hidden shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5] sm:flex", focusRing)}
              >
                See Card Collections →
              </Link>
            </div>
            <h2 className="mt-3 text-[22px]">Physical cards. Real reserves.</h2>
            <p className="mt-2 text-[14px] text-[var(--muted-foreground)]">
              Pair a coin with Pokémon or One Piece listings. Its reserve stacks graded cards as it goes and raffles them
              straight to holders.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {HERO_CARDS.map((c) => (
                <Link
                  key={c.label}
                  href="/cards"
                  className={cn("flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-3 hover:border-[var(--muted-foreground)]", focusRing)}
                >
                  <CardPlaceholder label={c.label} sub={c.sub} size="mini" />
                  <span className="text-[13px] font-semibold">{c.label} →</span>
                </Link>
              ))}
            </div>
            <Link
              href="/cards"
              className={cn("mt-5 flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5] sm:hidden", focusRing)}
            >
              See Card Collections →
            </Link>
          </div>

          <div className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--background)] p-7">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-block rounded-full bg-[var(--primary)] px-2.5 py-[3px] text-[11px] font-bold tracking-wide text-[var(--primary-foreground)]">
                NFT Collections
              </span>
              <Link
                href="/collections"
                className={cn("hidden shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5] sm:flex", focusRing)}
              >
                See NFT Collections →
              </Link>
            </div>
            <h2 className="mt-3 text-[22px]">Digital collections. On-chain reserves.</h2>
            <p className="mt-2 text-[14px] text-[var(--muted-foreground)]">
              Pair a coin with an NFT collection. Its reserve automatically collects NFTs from real marketplace listings and
              raffles them to holders.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HERO_NFTS.map((n) => (
                <Link
                  key={n.name}
                  href="/collections"
                  className={cn("flex flex-col items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-3 text-center hover:border-[var(--muted-foreground)]", focusRing)}
                >
                  <span className="size-10 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
                    <img src={n.image} alt={n.name} loading="lazy" decoding="async" className="size-full object-cover" />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{n.name}</span>
                </Link>
              ))}
            </div>
            <Link
              href="/collections"
              className={cn("mt-5 flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5] sm:hidden", focusRing)}
            >
              See NFT Collections →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="mb-9 flex items-center justify-between">
          <div>
            <h2 className="text-[34px]">Recent launches</h2>
            <p className="mt-2.5 text-[15px] text-[var(--muted-foreground)]">Freshest coins, straight off the factory.</p>
          </div>
          <Link
            href="/explore"
            className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold hover:border-[var(--muted-foreground)]", focusRing)}
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={rows === null}>
          {rows === null ? (
            Array.from({ length: 3 }).map((_, i) => <CoinCardSkeleton key={i} />)
          ) : rows.length ? (
            rows.map((row) => <CoinCard key={row.token} row={row} />)
          ) : (
            <div className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[70px] text-center text-[var(--muted-foreground)]">
              No coins launched yet.{" "}
              <Link href="/launch" className="text-[var(--primary)]">
                Be the first →
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
