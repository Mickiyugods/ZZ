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

const MECH: [string, string][] = [
  ["PAIRING", "locked at launch"],
  ["FEE SPLIT", "80% vault / 20% protocol"],
  ["SPEND CAP", "price ≤ posted ceiling"],
  ["CEILING TTL", "expires in 1 hour"],
  ["MARKETPLACE", "Seaport 1.6 only"],
  ["WITHDRAWALS", "disabled by design"],
  ["HARVEST", "callable by anyone"],
  ["DRAW SOURCE", "future block hash"],
  ["OUTCOME", "raffle, hold or burn"],
  ["ADMIN KEYS", "none on the vault"],
];

// Real, recognizable NFT collections (see /collections for the full real
// list — not imported here: it's 400+ entries and this only ever needs 3).
// Hardcoded, not fabricated: the same OpenSea-hosted logos shown there.
// These three are on Ethereum, so pairing a coin with them routes through
// the cross-chain External Vault/Launcher, not the native Robinhood one —
// see CLAUDE.md "Contracts workspace".
const HERO_IMAGES = [
  "https://i2c.seadn.io/collection/boredapeyachtclub/image/1a09c26b1c30427b26944c47fc7bb9/d81a09c26b1c30427b26944c47fc7bb9.png",
  "https://i2c.seadn.io/collection/pudgypenguins/image/f489fb69fd11886b468c0f7ff1376c/cdf489fb69fd11886b468c0f7ff1376c.png",
  "https://i2c.seadn.io/collection/milady/image/d4499e2e55f5e85ead4b0eb7f7dad7/90d4499e2e55f5e85ead4b0eb7f7dad7.jpeg",
];
const HERO_IMAGE_ALTS = ["Bored Ape Yacht Club", "Pudgy Penguins", "Milady Maker"];

export default function HomePage() {
  const wallet = useWallet();
  const [totals, setTotals] = React.useState<{ coins: number; vaultEth: number; nftsHeld: number } | null>(null);
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [myTotals, setMyTotals] = React.useState<{ coins: number; vaultEth: number } | null>(null);

  React.useEffect(() => {
    document.title = "ZEEP — memecoins with a vault inside";
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
        titleHighlight="vault."
        description="Pick an NFT collection and a payout rule when you launch — raffle, hold, or burn. From that point on, a share of every trade routes on-chain into that collection's vault automatically. No admin key can touch it and no one can change the rule once the coin is live."
        socialProof={
          totals
            ? `${fmtInt(totals.coins)} coins live · ${fmtEth(totals.vaultEth)} ETH working in vaults`
            : error
              ? "Live totals unavailable right now."
              : "Loading live totals…"
        }
        images={HERO_IMAGES}
        imageAlts={HERO_IMAGE_ALTS}
        animation="subtle"
        primaryCTA={{ ctaEnabled: true, text: "Launch a coin", link: "/launch", variant: "default" }}
        secondaryCTA={{ ctaEnabled: true, text: "Explore coins", link: "/explore", variant: "outline" }}
      />

      <section className="mx-auto max-w-[1180px] px-6 pb-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
          {[
            ["Coins launched", totals ? fmtInt(totals.coins) : "—"],
            ["NFTs collected", totals ? fmtInt(totals.nftsHeld) : "—"],
            ["ETH in vaults", totals ? fmtEth(totals.vaultEth) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="bg-[var(--background)] px-6 py-[22px]">
              <div className="font-mono-tabular text-[30px] font-semibold text-[var(--primary)]">{value}</div>
              <div className="mt-1 text-[12px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
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
              <strong className="font-mono-tabular">{myTotals ? fmtEth(myTotals.vaultEth) : "…"}</strong> ETH in vaults
            </span>
            <span className="text-[13px] font-semibold text-[var(--primary)]">View profile →</span>
          </Link>
        </section>
      )}

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--background)] p-9 md:flex-row md:items-center">
          <div>
            <span className="mb-3 inline-block rounded-full bg-[var(--primary)] px-2.5 py-[3px] text-[11px] font-bold tracking-wide text-[var(--primary-foreground)]">
              New · Card Vaults
            </span>
            <h2 className="max-w-[420px] text-[26px]">Vaults that hunt real cards.</h2>
            <p className="mt-2 max-w-[420px] text-[var(--muted-foreground)]">
              Pair a coin with Pokémon or One Piece listings. Its vault stacks graded cards as it goes and raffles them
              straight to holders.
            </p>
          </div>
          <Link
            href="/cards"
            className={cn("flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5]", focusRing)}
          >
            See Card Vaults →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="mb-9 max-w-[560px]">
          <h2 className="text-[34px]">How the vault works</h2>
          <p className="mt-2.5 text-[15px] text-[var(--muted-foreground)]">
            Every launch is bound to these rules on day one. Nothing here can change after the coin ships.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] lg:grid-cols-5">
          {MECH.map(([k, v]) => (
            <div key={k} className="bg-[var(--background)] px-4 py-[18px]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{k}</div>
              <div className="mt-1.5 text-[14px] font-semibold">{v}</div>
            </div>
          ))}
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
