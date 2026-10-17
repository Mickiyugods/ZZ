"use client";

import * as React from "react";
import Link from "next/link";
import { listCoins, type CoinRow } from "@/lib/api";
import { categoryLabel, getMachines, type Machine } from "@/lib/gacha";
import { fmtEth, fmtInt, fmtUsdWhole } from "@/lib/format";
import { SocialLinks } from "@/components/social-links";
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

// Real photos of actual Courtyard-vaulted cards (2026-10) — not Rarible (the
// owner hasn't gotten that API key yet, see CLAUDE.md), but a still frame
// pulled from the same card's own public OpenSea listing media
// (raw2.seadn.io, the same CDN already used for every other real image on
// this page), which needs no key at all. Saved locally since there's no
// stable hotlink to a single video frame.
const HERO_CARDS = [
  { label: "Pokémon", sub: "Graded cards", image: "/images/cards/pokemon-celebrations-pikachu.jpg" },
  { label: "One Piece", sub: "CGC 10 PRISTINE", image: "/images/cards/onepiece-monkey-d-luffy-st08.jpg" },
];


// Hero showcase: 2 real card photos + 4 real NFT logos, fanned with
// overlap/rotation for depth, sized bigger/more dramatic (2026-10 restyle,
// matching a reference the owner supplied) — max ~250px tall / ~820px wide
// at desktop, scaling down through tablet and mobile. A soft dark "ground"
// shadow beneath the fan (not a glow — just a darker ellipse, kept subtle
// per the hero-background pass's "avoid excessive glowing effects" rule)
// gives the row something to visually stand on, like the reference.
function HeroShowcase() {
  return (
    <div className="relative flex items-center justify-center -space-x-5 sm:-space-x-7 lg:-space-x-9">
      <div
        aria-hidden="true"
        className="absolute inset-x-4 bottom-2 h-1/4 rounded-[50%] bg-black/70 blur-2xl sm:inset-x-8 lg:inset-x-12"
      />
      {HERO_NFTS.map((n, i) => (
        <div
          key={n.name}
          className={cn(
            "relative aspect-square w-[108px] shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_18px_40px_rgba(0,0,0,0.65)] transition-transform duration-300 ease-out sm:w-[150px] lg:w-[196px]",
            "hover:z-30 hover:-translate-y-5 hover:rotate-0 hover:scale-[1.08] hover:border-white/30 hover:shadow-[0_30px_60px_rgba(0,0,0,0.75)] motion-reduce:transition-none motion-reduce:hover:transform-none",
            i % 2 === 0 ? "translate-y-3 -rotate-6" : "-translate-y-2 rotate-6",
          )}
        >
          <img src={n.image} alt={n.name} loading="eager" decoding="async" className="size-full object-cover" />
        </div>
      ))}
    </div>
  );
}

// Home teaser for the Gacha Station: the banner copy + CTA alongside two real
// live machines (one Pokémon, one One Piece) pulled from the gacha API, so the
// section shows the actual product, not just text.
function gachaMedia(m: Machine): { video: string | null; poster: string | null } {
  const abs = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : null);
  return { video: abs(m.videoNobgWeb) || abs(m.videoSrc), poster: abs(m.imageNobg) || abs(m.thumbnailUrl) };
}

function GachaMiniCard({ m }: { m: Machine }) {
  const { poster } = gachaMedia(m);
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]">
      <div className="relative flex h-[176px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#171717] to-[#090909] sm:h-[196px]">
        {poster ? (
          // Static poster, not autoplaying video — the live machine videos live
          // on /gacha; the home teaser stays light. The posters carry a lot of
          // transparent padding, so they're scaled up to read at this size.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={m.name} loading="lazy" decoding="async" className="h-full w-full scale-[1.18] object-contain transition-transform duration-300 ease-out group-hover:scale-[1.26] motion-reduce:transition-none" />
        ) : (
          <span className="px-3 text-center text-[12px] font-semibold text-[var(--muted-foreground)]">{m.shortName || m.name}</span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">{categoryLabel(m.menuCategory)}</span>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="truncate text-[12px] font-semibold">{m.shortName || m.name}</span>
        <span className="shrink-0 font-mono-tabular text-[13px] font-semibold">{fmtUsdWhole(m.price)}</span>
      </div>
    </div>
  );
}

function GachaHomeSection({ machines }: { machines: Machine[] | null }) {
  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-10">
      <Link
        href="/gacha"
        className={cn(
          "group relative grid grid-cols-1 gap-7 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center motion-reduce:transform-none",
          focusRing,
        )}
      >
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-white/[0.07] blur-[90px]" />
        <div className="relative max-w-[520px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <span className="size-1.5 rounded-full bg-[#4ade80]" /> New · Gacha Station
          </span>
          <h2 className="mt-3.5 text-[26px] sm:text-[30px]">
            Crack a pack. Pull a <span className="text-[var(--primary)]">real graded card</span>.
          </h2>
          <p className="mt-2.5 text-[14px] text-[var(--muted-foreground)]">
            Open sealed Pokémon &amp; One Piece packs, pay in USDC on Solana, and instantly pull a real, graded,
            tokenized card — redeemable for the physical card.
          </p>
          <span className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors duration-200 group-hover:bg-[#e5e5e5]">
            Open the Gacha Station →
          </span>
        </div>

        <div className="relative grid w-full grid-cols-2 gap-3 lg:w-[320px]">
          {machines === null
            ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[170px] animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]" />)
            : machines.map((m) => <GachaMiniCard key={m.code} m={m} />)}
        </div>
      </Link>
    </section>
  );
}

export default function HomePage() {
  const wallet = useWallet();
  const [totals, setTotals] = React.useState<{ coins: number; vaultEth: number; nftsHeld: number } | null>(null);
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [myTotals, setMyTotals] = React.useState<{ coins: number; vaultEth: number } | null>(null);
  // Two live gacha machines (Pokémon + One Piece), shared by the Gacha teaser
  // and the Card Collections tiles so both show the real machine artwork.
  const [gachaMachines, setGachaMachines] = React.useState<Machine[] | null>(null);


  React.useEffect(() => {
    getMachines()
      .then((d) => {
        const list = (d.machines || []).filter((m) => m.public !== false);
        const pick = (cat: string) => list.find((m) => m.menuCategory === cat);
        setGachaMachines([pick("Pokemon"), pick("One Piece")].filter(Boolean) as Machine[]);
      })
      .catch(() => setGachaMachines([]));
  }, []);

  React.useEffect(() => {
    listCoins({ list: "new" })
      .then((data) => {
        setTotals({ coins: data.coins, vaultEth: data.vaultEth, nftsHeld: data.nftsHeld });
        setRows(data.rows.slice(0, 3));
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
      {/* Home only, desktop only: ZEEP socials in the page's top-right corner
          (a zero-height anchor so the hero below isn't shifted). */}
      <div className="relative hidden md:block">
        <SocialLinks className="zeep-rise absolute right-5 top-5 z-30" style={{ animationDelay: "350ms" }} />
      </div>
      <Hero10
        title="Every trade"
        titleLine2Prefix="feeds the"
        titleHighlight="reserve."
        description="Pick an NFT collection and a payout rule when you launch — raffle, hold, or burn. From then on, a share of every trade is set aside for that collection's reserve, and the rule is locked the moment your coin goes live."
        socialProof={
          totals
            ? `${fmtInt(totals.coins)} ${totals.coins === 1 ? "coin" : "coins"} live · ${fmtEth(totals.vaultEth)} ETH working in reserves`
            : error
              ? "Live totals unavailable right now."
              : "Loading live totals…"
        }
        mediaSlot={<HeroShowcase />}
        layout="split"
        animation="subtle"
        backgroundImage="/images/hero/hero-planets-bg.webp"
        primaryCTA={{ ctaEnabled: true, text: "Launch a coin", link: "/launch", variant: "default" }}
        secondaryCTA={{ ctaEnabled: true, text: "Explore coins", link: "/explore", variant: "outline" }}
      />

      <section className="mx-auto max-w-[1180px] px-6 pb-10">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Coins launched", totals ? fmtInt(totals.coins) : "—"],
            ["NFTs collected", totals ? fmtInt(totals.nftsHeld) : "—"],
            ["ETH in reserves", totals ? fmtEth(totals.vaultEth) : "—"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-6 py-6 transition-colors duration-200 hover:border-white/20"
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="font-mono-tabular text-[38px] font-bold leading-none tracking-tight text-[var(--primary)]">{value}</div>
              <div className="mt-2.5 text-[12px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {wallet.connected && (
        <section className="mx-auto max-w-[1180px] px-6 pb-10">
          <Link
            href="/profile"
            className={cn(
              "flex flex-col items-start justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-6 py-4 transition-colors duration-200 hover:border-[var(--muted-foreground)] sm:flex-row sm:items-center",
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

      <GachaHomeSection machines={gachaMachines} />

      <section className="mx-auto max-w-[1180px] px-6 py-16">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--background)] p-7 transition-colors duration-200 hover:border-white/20">
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
                  className={cn("flex flex-col items-center gap-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-4 text-center transition-colors duration-200 hover:border-[var(--muted-foreground)]", focusRing)}
                >
                  <span className="aspect-[5/7] h-[128px] shrink-0 overflow-hidden rounded-lg border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt={c.label} loading="lazy" decoding="async" className="size-full object-cover" />
                  </span>
                  <span className="text-[13px] font-semibold">{c.label}</span>
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

          <div className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--background)] p-7 transition-colors duration-200 hover:border-white/20">
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
              Pair a coin with an NFT collection. Its reserve collects NFTs from real marketplace listings and
              raffles them to holders.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HERO_NFTS.map((n) => (
                <Link
                  key={n.name}
                  href="/collections"
                  className={cn("flex flex-col items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-3 text-center transition-colors duration-200 hover:border-[var(--muted-foreground)]", focusRing)}
                >
                  <span className="size-20 shrink-0 overflow-hidden rounded-full border border-[var(--border)] sm:size-[92px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
            className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold transition-colors duration-200 hover:border-[var(--muted-foreground)]", focusRing)}
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={rows === null}>
          {rows === null ? (
            Array.from({ length: 3 }).map((_, i) => <CoinCardSkeleton key={i} />)
          ) : rows.length ? (
            rows.map((row, i) => (
              <div key={row.token} className="zeep-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <CoinCard row={row} />
              </div>
            ))
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
