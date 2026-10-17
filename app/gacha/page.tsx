"use client";

import * as React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { cardThumb, categoryLabel, getMachines, getRecentWinners, tierName, winnerImage, type Machine, type Winner } from "@/lib/gacha";
import { useGacha } from "@/lib/useGacha";
import { fmtUsdWhole, short } from "@/lib/format";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const RARITY_COLOR: Record<string, string> = {
  Epic: "#c084fc",
  Rare: "#60a5fa",
  Uncommon: "#4ade80",
  Common: "#a1a1aa",
};
const TIER_OF = { epic: 1, rare: 2, uncommon: 3, common: 4 } as const;
const RARITY_ORDER: (keyof typeof TIER_OF)[] = ["epic", "rare", "uncommon", "common"];

// Inlined at build time — a stable branch, so the two page variants below never
// swap at runtime (and we never call Privy hooks when there's no provider).
const HAS_PRIVY = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Only surface these gacha categories (mainnet also exposes Sports, Watch,
// partner "Builder Fee"/"feebuilder" machines, etc. — out of scope for ZEEP).
const ALLOWED_CATEGORIES = new Set(["Pokemon", "One Piece"]);

// The proxy rewrites host-relative media to absolute URLs, so these are ready
// to use. Prefer the no-background vending-machine video (like Rarible), then
// the plain video, then a still image; a poster image shows under/behind it.
function machineMedia(m: Machine): { video: string | null; poster: string | null } {
  const abs = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : null);
  return {
    video: abs(m.videoNobgWeb) || abs(m.videoSrc),
    poster: abs(m.imageNobg) || abs(m.thumbnailUrl),
  };
}

function useMachines() {
  const [machines, setMachines] = React.useState<Machine[] | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    getMachines()
      .then((d) =>
        setMachines(
          (d.machines || [])
            // Keep only Pokémon & One Piece public machines (drop hidden,
            // devnet test/static, and every other category).
            .filter((m) => m.public !== false && !!m.menuCategory && ALLOWED_CATEGORIES.has(m.menuCategory))
            .sort((a, b) => (a.menuOrder ?? 99) - (b.menuOrder ?? 99)),
        ),
      )
      .catch(() => setError(true));
  }, []);
  return { machines, error };
}

// Group machines by their category, preserving first-seen (menuOrder) order.
function groupByCategory(machines: Machine[]): [string, Machine[]][] {
  const map = new Map<string, Machine[]>();
  for (const m of machines) {
    const k = categoryLabel(m.menuCategory);
    (map.get(k) ?? map.set(k, []).get(k)!).push(m);
  }
  return [...map.entries()];
}

export default function GachaPage() {
  return HAS_PRIVY ? <GachaLive /> : <GachaReadOnly />;
}

function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* ambient stage glow — static, so no reduced-motion concern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 z-0 mx-auto h-[360px] max-w-[680px] rounded-[50%] bg-white/[0.06] blur-[90px]"
      />
      <div className="relative z-10 mx-auto max-w-[1180px] px-6 pb-6 pt-14 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-[7px] text-[12px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <span className="size-1.5 rounded-full bg-[#4ade80]" />
          Powered by Collector Crypt · Solana
        </span>
        <h1 className="mt-4 font-display text-[36px] leading-[1.05] sm:text-[52px]">
          Crack a pack.
          <br className="hidden sm:block" /> Pull a <span className="text-[var(--primary)]">real graded card</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[var(--muted-foreground)]">
          Buy a sealed Pokémon or One Piece pack, pay in USDC on Solana, and instantly open it for a real, graded,
          tokenized card — on-chain and redeemable for the physical card.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">{children}</div>
      </div>
    </section>
  );
}

function MachineSections({
  machines,
  error,
  onCrack,
  busy,
  disabledLabel,
}: {
  machines: Machine[] | null;
  error: boolean;
  onCrack?: (code: string) => void;
  busy?: boolean;
  disabledLabel?: string;
}) {
  if (error) {
    return (
      <section className="mx-auto max-w-[1180px] px-6 py-10">
        <div role="alert" className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[70px] text-center text-[var(--muted-foreground)]">
          Couldn&apos;t reach the gacha machines right now.
        </div>
      </section>
    );
  }
  if (machines === null) {
    return (
      <section className="mx-auto max-w-[1180px] px-6 py-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[440px] animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" />
          ))}
        </div>
      </section>
    );
  }

  const groups = groupByCategory(machines);
  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-20 pt-4">
      {groups.map(([category, items]) => (
        <div key={category} className="mb-12 last:mb-0">
          <div className="mb-5 flex items-baseline justify-between border-b border-[var(--border)] pb-3">
            <h2 className="font-display text-[22px] sm:text-[26px]">{category}</h2>
            <span className="text-[13px] text-[var(--muted-foreground)]">
              {items.length} {items.length === 1 ? "machine" : "machines"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => (
              <MachineCard key={m.code} m={m} onCrack={onCrack ? () => onCrack(m.code) : undefined} busy={busy} disabledLabel={disabledLabel} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function MachineCard({ m, onCrack, busy, disabledLabel }: { m: Machine; onCrack?: () => void; busy?: boolean; disabledLabel?: string }) {
  const { video, poster } = machineMedia(m);
  const totalStock = m.stock ? Object.values(m.stock).reduce((a, b) => a + b, 0) : 0;
  const soldOut = totalStock === 0;
  const lowStock = !soldOut && m.lowThreshold != null && totalStock <= m.lowThreshold;
  const label = disabledLabel ?? (soldOut ? "Sold out" : busy ? "Opening…" : `Crack a Pack · ${fmtUsdWhole(m.price)}`);

  // Play the machine video only while the pointer is over the card, so idle
  // cards aren't decoding video (keeps the page light + leaving it smooth).
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const playVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    v.play().catch(() => {});
  };
  const stopVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {}
  };

  return (
    <div
      onMouseEnter={playVideo}
      onMouseLeave={stopVideo}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] transition-all duration-200",
        "hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] motion-reduce:transform-none motion-reduce:transition-none",
      )}
    >
      <div className="relative flex h-[230px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#171717] to-[#090909]">
        {video ? (
          <video
            ref={videoRef}
            src={video}
            poster={poster ?? undefined}
            loop
            muted
            playsInline
            preload="none"
            className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={m.name} loading="lazy" decoding="async" className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:transform-none" />
        ) : (
          <span className="px-6 text-center text-[18px] font-semibold text-[var(--muted-foreground)]">{m.shortName || m.name}</span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{categoryLabel(m.menuCategory)}</span>
        {lowStock && (
          <span className="absolute right-3 top-3 rounded-full bg-[#D97706] px-2.5 py-1 text-[11px] font-semibold text-black">Low stock</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[16px] font-semibold leading-tight">{m.name}</h3>
          <span className="shrink-0 font-mono-tabular text-[17px] font-semibold">{fmtUsdWhole(m.price)}</span>
        </div>

        <div className="mt-3.5 grid grid-cols-4 overflow-hidden rounded-[10px] border border-[var(--border)]">
          {RARITY_ORDER.map((r, i) => (
            <div key={r} className={cn("px-1.5 py-2 text-center", i > 0 && "border-l border-[var(--border)]")}>
              <div aria-hidden className="mx-auto mb-1.5 h-[3px] w-5 rounded-full" style={{ backgroundColor: RARITY_COLOR[tierName[TIER_OF[r]]] }} />
              <div className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">{r}</div>
              <div className="mt-0.5 font-mono-tabular text-[12px]">{(m.odds[r] * 100).toFixed(m.odds[r] < 0.01 ? 2 : 0)}%</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--muted-foreground)]">
          <span className="font-mono-tabular">{totalStock.toLocaleString("en-US")} {totalStock === 1 ? "card" : "cards"}</span>
          {m.ev != null && <span className="font-mono-tabular">EV {fmtUsdWhole(m.ev)}</span>}
        </div>

        <button
          type="button"
          onClick={onCrack}
          disabled={!onCrack || busy || soldOut}
          className={cn(
            "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors duration-200",
            "hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer",
            focusRing,
          )}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

// Live social proof — a horizontal strip of the latest real pulls.
function LivePulls({ packType }: { packType: string }) {
  const [winners, setWinners] = React.useState<Winner[] | null>(null);
  React.useEffect(() => {
    let on = true;
    getRecentWinners(packType)
      .then((d) => on && setWinners(d.data || []))
      .catch(() => on && setWinners([]));
    return () => {
      on = false;
    };
  }, [packType]);

  if (!winners || !winners.length) return null;
  return (
    <section className="mx-auto max-w-[1180px] px-6 pt-6">
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Latest pulls</span>
        <div className="flex gap-2.5 overflow-x-auto">
          {winners.map((w, i) => {
            const img = cardThumb(winnerImage(w), 128);
            const rt = tierName[w.prize_tier];
            return (
              <div key={i} className="group relative shrink-0" title={`${rt}${w.winner ? ` · ${short(w.winner)}` : ""}`}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={rt} loading="lazy" decoding="async" width={44} height={44} className="size-11 rounded-md bg-[#0a0a0a] object-cover ring-1 ring-inset" style={{ boxShadow: `inset 0 0 0 1.5px ${RARITY_COLOR[rt] ?? "transparent"}` }} />
                ) : (
                  <span className="flex size-11 items-center justify-center rounded-md border border-[var(--border)] text-[9px] text-[var(--muted-foreground)]">{rt}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Variant with a live Solana wallet (Privy configured) ─────────────────────
function GachaLive() {
  const { machines, error } = useMachines();
  const gacha = useGacha();
  const { authenticated } = usePrivy();
  const busy = gacha.phase === "paying" || gacha.phase === "opening";
  const firstCode = machines?.[0]?.code;

  return (
    <>
      <Hero>
        {gacha.solanaAddress ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-[13px]">
            <span className="size-2 rounded-full bg-[#4ade80]" />
            Solana · <span className="font-mono-tabular">{short(gacha.solanaAddress)}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={gacha.connect}
            disabled={!gacha.ready}
            className={cn("inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-60", focusRing)}
          >
            {gacha.ready ? "Connect Solana wallet" : "Loading…"}
          </button>
        )}
        {!gacha.solanaAddress && authenticated && (
          <span className="text-[12px] text-[var(--muted-foreground)]">
            Connected, but no Solana wallet detected — connect a Phantom/Solflare wallet to pay in USDC.
          </span>
        )}
      </Hero>

      {firstCode && <LivePulls packType={firstCode} />}
      <MachineSections machines={machines} error={error} onCrack={(code) => gacha.crackPack(code)} busy={busy} />

      {gacha.phase !== "idle" && <CrackModal gacha={gacha} />}
    </>
  );
}

// ── Variant without wallet support (Privy not configured) ────────────────────
function GachaReadOnly() {
  const { machines, error } = useMachines();
  const firstCode = machines?.[0]?.code;
  return (
    <>
      <Hero>
        <span className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-[13px] text-[var(--muted-foreground)]">
          Wallet connect isn&apos;t configured in this environment yet.
        </span>
      </Hero>
      {firstCode && <LivePulls packType={firstCode} />}
      <MachineSections machines={machines} error={error} disabledLabel="Connect wallet to crack" />
    </>
  );
}

function wonImage(r: NonNullable<ReturnType<typeof useGacha>["result"]>): string | null {
  const won = r.nftWon as { image?: string; content?: { links?: { image?: string }; files?: { uri?: string }[] } } | undefined;
  return won?.image || won?.content?.links?.image || won?.content?.files?.[0]?.uri || null;
}

function CrackModal({ gacha }: { gacha: ReturnType<typeof useGacha> }) {
  const { phase, result, error, reset } = gacha;
  const rarity = result?.rarity;
  const img = result ? cardThumb(wonImage(result), 640) : null;
  const closable = phase !== "paying" && phase !== "opening";
  const glow = rarity ? RARITY_COLOR[rarity] : undefined;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-5 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && closable && reset()}
    >
      <div className="relative w-full max-w-[400px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-7 text-center">
        {(phase === "paying" || phase === "opening") && (
          <>
            <div className="mx-auto mb-5 size-16 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] motion-reduce:animate-none" />
            <h3 className="text-[18px] font-semibold">{phase === "paying" ? "Confirm payment in your wallet" : "Opening your pack…"}</h3>
            <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
              {phase === "paying" ? "Approve the USDC transfer to buy the pack." : "Rolling your card on-chain — this takes a few seconds."}
            </p>
          </>
        )}

        {phase === "won" && result && (
          <>
            <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: glow }}>
              {rarity ?? "You pulled"}
            </div>
            <div
              className="mx-auto my-4 flex aspect-[5/7] w-[210px] items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[#0a0a0a]"
              style={glow ? { boxShadow: `0 0 36px -6px ${glow}66, inset 0 0 0 1.5px ${glow}` } : undefined}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={result.nftWon?.content?.metadata?.name || "Won card"} className="h-full w-full object-cover" />
              ) : (
                <span className="px-4 text-[13px] text-[var(--muted-foreground)]">Card minted to your wallet</span>
              )}
            </div>
            <h3 className="text-[17px] font-semibold">{result.nftWon?.content?.metadata?.name || "Card won!"}</h3>
            {result.points != null && <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">+{result.points} points</p>}
            <button type="button" onClick={reset} className={cn("mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5]", focusRing)}>
              Crack another
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <h3 className="text-[17px] font-semibold">Couldn&apos;t open the pack</h3>
            <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">{error}</p>
            <button type="button" onClick={reset} className={cn("mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold transition-colors hover:border-[var(--muted-foreground)]", focusRing)}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
