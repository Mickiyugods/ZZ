"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { ethers } from "ethers";
import { IconCopy, IconExternalLink, IconCoins, IconShoppingBag, IconTicket, IconPhoto } from "@tabler/icons-react";
import { listCoins, listVaultEvents, runKeeperNow, recordDemoTrade, type CoinRow, type VaultEvent } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { useToast } from "@/lib/toast";
import * as chain from "@/lib/chain";
import { CHAIN, DEFAULT_SLIPPAGE, SLIPPAGE_OPTIONS } from "@/lib/config";
import { short, fmtEth, fmtInt, timeAgo, policyLabel, fmtUsd, fmtUsdCompact, ageShort, subPrice } from "@/lib/format";
import { ponsHolders, ponsLaunch, ponsTicks, ponsTrades, ponsUrl, tickToTrade, type PonsLaunch, type PonsTrade } from "@/lib/pons";
import { CoinPriceChart } from "@/components/coin/price-chart";
import { cn } from "@/lib/utils";

interface OnChainState {
  curve: string;
  graduated: boolean;
}

const TRADES_PAGE = 10; // trades shown per "Show more" step

/** Union of two trade lists by id, newest first (ties: later log index first). */
function mergeTrades(a: PonsTrade[], b: PonsTrade[]): PonsTrade[] {
  const byId = new Map<string, PonsTrade>();
  for (const x of a) byId.set(x.id, x);
  for (const x of b) if (!byId.has(x.id)) byId.set(x.id, x);
  const li = (x: PonsTrade) => Number(x.id.split(":")[1]) || 0;
  return [...byId.values()].sort((x, y) => y.timestamp - x.timestamp || li(y) - li(x));
}

/** Fold trades a Pons snapshot doesn't include yet (oldest first) into it, with
 * Pons' own rules: price = last fill price, market cap = price × supply, and the
 * curve gains a buy's ETH minus the 1% fee + creator tax / loses a sell's gross. */
function applyTrades(m: PonsLaunch, pending: PonsTrade[]): PonsLaunch {
  if (!pending.length) return m;
  const cut = (100 + (m.creatorTaxBps || 0)) / 10_000;
  let raised = m.raisedQuote;
  let volume = m.volumeQuote;
  for (const t of pending) {
    raised += t.side === "buy" ? t.quoteAmount * (1 - cut) : -t.quoteAmount / (1 - cut);
    if (volume != null) volume += t.quoteAmount;
  }
  raised = Math.max(0, raised);
  const last = pending[pending.length - 1];
  const usd = m.quoteUsd || 0;
  const supply = m.totalSupply || 1e9;
  return {
    ...m,
    priceQuote: last.price,
    priceUsd: last.price * usd,
    marketCapQuote: last.price * supply,
    marketCapUsd: last.price * supply * usd,
    raisedQuote: raised,
    progress: m.thresholdQuote > 0 ? Math.min(1, raised / m.thresholdQuote) : m.progress,
    tradeCount: m.tradeCount != null ? m.tradeCount + pending.length : null,
    volumeQuote: volume,
    volumeUsd: volume != null ? volume * usd : null,
    lastTradeAt: Math.max(m.lastTradeAt ?? 0, last.timestamp),
  };
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export default function CoinPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const wallet = useWallet();
  const toast = useToast();

  const [row, setRow] = React.useState<CoinRow | null | undefined>(undefined);
  const [onChain, setOnChain] = React.useState<OnChainState | null>(null);
  const [tab, setTab] = React.useState<"buy" | "sell">("buy");
  const [amount, setAmount] = React.useState("");
  const [slippage, setSlippage] = React.useState(DEFAULT_SLIPPAGE);
  const [quote, setQuote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [events, setEvents] = React.useState<VaultEvent[] | null>(null);
  const [keeperBusy, setKeeperBusy] = React.useState(false);
  const [tradeReload, setTradeReload] = React.useState(0);
  const [demoBusy, setDemoBusy] = React.useState(false);
  // Market data straight from Pons (every ZEEP coin is a Pons launch), so price,
  // market cap, curve progress and trades match ponsfamily.com exactly.
  //   snap  = Pons' latest authoritative snapshot (launch numbers + the trade ids
  //           its first trades page had), never allowed to step backwards
  //   pages = trades from Pons' trades API (every page loaded so far)
  //   live  = trades from Pons' ~3s tick feed, which runs ~10s ahead of the
  //           CDN-cached launch/trades APIs
  // What's shown = snap + the trades it doesn't include yet. Each newer snapshot
  // becomes the new base, so any drift corrects itself on the next refresh.
  const [snap, setSnap] = React.useState<{ m: PonsLaunch | null; ids: Set<string> } | undefined>(undefined);
  const [pages, setPages] = React.useState<PonsTrade[] | null>(null);
  const [live, setLive] = React.useState<PonsTrade[]>([]);
  const [holders, setHolders] = React.useState<number | null>(null); // Pons' balances indexer
  const [tradesCursor, setTradesCursor] = React.useState<string | null>(null);
  const [moreBusy, setMoreBusy] = React.useState(false);
  const [shownTrades, setShownTrades] = React.useState(TRADES_PAGE);

  React.useEffect(() => {
    setShownTrades(TRADES_PAGE);
    setLive([]);
    setHolders(null);
  }, [address]);

  const isDev = process.env.NODE_ENV !== "production";

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      const [m, t, h] = await Promise.all([
        ponsLaunch(address).catch(() => null),
        ponsTrades(address).catch(() => null),
        ponsHolders(address).catch(() => null),
      ]);
      if (!alive) return;
      if (h != null) setHolders(h);
      setSnap((prev) => {
        const p = prev?.m;
        // Pons' API sits behind a CDN: drop a snapshot older than the one we have
        if (m && p && p.address === m.address) {
          if ((m.lastTradeAt ?? 0) < (p.lastTradeAt ?? 0)) return prev;
          if (m.tradeCount != null && p.tradeCount != null && m.tradeCount < p.tradeCount) return prev;
        }
        return { m, ids: new Set(t?.items.map((x) => x.id) ?? []) };
      });
      if (t) {
        setPages((prev) => mergeTrades(prev ?? [], t.items));
        setTradesCursor((c) => c ?? t.nextCursor);
      } else setPages((prev) => prev ?? []);
    };
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [address, tradeReload]);

  // Every trade we know of, newest first (API pages ∪ live ticks, deduped by id).
  const trades = React.useMemo(() => (pages === null && !live.length ? null : mergeTrades(pages ?? [], live)), [pages, live]);

  // Trades the snapshot's numbers don't include yet: anything after its last
  // trade time, or at that same second but missing from its trade list.
  const pending = React.useMemo(() => {
    const m = snap?.m;
    if (!m || !trades || m.stage !== "curve") return [];
    const at = m.lastTradeAt ?? 0;
    return trades.filter((x) => x.venue === "curve" && (x.timestamp > at || (x.timestamp === at && !snap.ids.has(x.id)))).reverse(); // oldest first
  }, [snap, trades]);

  const market = snap === undefined ? undefined : snap.m ? applyTrades(snap.m, pending) : null;

  // Live updates exactly like Pons' own page: poll Pons' ~3s trade feed and fold
  // each new buy/sell for this coin in the instant it lands (a tick's fill price,
  // quote ÷ tokens, is identical to the trade Pons later records — verified).
  // Post-graduation pool swaps just trigger a refetch.
  const liveCurve = snap?.m && !snap.m.simulated ? snap.m.curve?.toLowerCase() : undefined;
  const livePool = snap?.m && !snap.m.simulated ? snap.m.poolId?.toLowerCase() : undefined;
  React.useEffect(() => {
    if (!liveCurve && !livePool) return;
    let alive = true;
    const poll = async () => {
      const feed = await ponsTicks();
      if (!alive || !feed) return;
      const mine = feed.ticks.filter((x) => x.curve?.toLowerCase() === liveCurve).map(tickToTrade);
      if (mine.length) setLive((prev) => mergeTrades(prev, mine).slice(0, 300));
      if (livePool && feed.swaps.some((x) => x.pool?.toLowerCase() === livePool)) setTradeReload((k) => k + 1);
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [liveCurve, livePool]);

  // Reveal 10 more rows; only hits Pons for the next page once the rows
  // already loaded run out.
  async function showMoreTrades() {
    const next = shownTrades + TRADES_PAGE;
    if (trades && next > trades.length && tradesCursor) {
      setMoreBusy(true);
      try {
        const t = await ponsTrades(address, tradesCursor);
        if (t) {
          setPages((prev) => mergeTrades(prev ?? [], t.items));
          setTradesCursor(t.nextCursor);
        }
      } finally {
        setMoreBusy(false);
      }
    }
    setShownTrades(next);
  }

  async function doDemoTrade(side: "buy" | "sell") {
    setDemoBusy(true);
    try {
      await recordDemoTrade(address, side, 0.005 + Math.random() * 0.04);
      setTradeReload((k) => k + 1);
    } catch {
      toast("Demo trade failed", "error");
    } finally {
      setDemoBusy(false);
    }
  }

  const loadEvents = React.useCallback(() => {
    listVaultEvents(address)
      .then((data) => setEvents(data.events))
      .catch(() => setEvents([]));
  }, [address]);

  React.useEffect(() => {
    listCoins({})
      .then((data) => {
        const found = data.rows.find((r) => r.token.toLowerCase() === address.toLowerCase());
        setRow(found ?? null);
        if (found) {
          chain
            .readToken(found.token)
            .then((t) => setOnChain({ curve: t.curve, graduated: t.graduated }))
            .catch(() => setOnChain(null));
        }
      })
      .catch(() => setRow(null));
    loadEvents();
  }, [address, loadEvents]);

  async function doRunKeeper() {
    setKeeperBusy(true);
    try {
      const result = await runKeeperNow();
      toast(result.log.length ? result.log[0] : "Keeper ran, nothing to do yet", "success");
      loadEvents();
    } catch (err) {
      toast((err as Error).message || "Keeper run failed", "error");
    } finally {
      setKeeperBusy(false);
    }
  }

  React.useEffect(() => {
    document.title = row ? `$${row.symbol} · ZEEP` : "ZEEP";
  }, [row]);

  async function onAmountChange(value: string) {
    setAmount(value);
    if (!onChain || !row || !value || Number(value) <= 0) return setQuote(null);
    try {
      if (tab === "buy") {
        const { out } = await chain.quoteBuy(onChain.curve, ethers.parseEther(value));
        setQuote(`≈ ${ethers.formatUnits(out, 18)} ${row.symbol}`);
      } else {
        const { out } = await chain.quoteSell(onChain.curve, ethers.parseUnits(value, 18));
        setQuote(`≈ ${ethers.formatEther(out)} ETH`);
      }
    } catch {
      setQuote(null);
    }
  }

  async function doTrade() {
    if (!row || !onChain || !amount || Number(amount) <= 0) return toast("Enter an amount", "error");
    setBusy(true);
    try {
      if (tab === "buy") {
        await chain.buy(onChain.curve, ethers.parseEther(amount), slippage);
      } else {
        await chain.sell(row.token, onChain.curve, ethers.parseUnits(amount, 18), slippage);
      }
      toast("Trade confirmed", "success");
      setTradeReload((k) => k + 1); // show the new market cap / trade right away
      setAmount("");
      setQuote(null);
    } catch (err) {
      const e = err as { code?: number | string; message?: string };
      toast(e?.code === 4001 || e?.code === "ACTION_REJECTED" ? "Transaction rejected" : e.message || "Trade failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (row === undefined) return <CoinSkeleton />;
  if (row === null) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-16 text-center">
        <h1 className="text-[32px]">Coin not found</h1>
        <p className="mt-2.5 text-[var(--muted-foreground)]">This address was not launched through ZEEP.</p>
        <Link href="/explore" className={cn("mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)]", focusRing)}>
          Back to Explore
        </Link>
      </div>
    );
  }

  // Coins are always Pons launches on Robinhood Chain itself — `row.chain` is the
  // *paired collection's* chain, separate from where this token's own contract lives.
  const explorerAddr = `${CHAIN.explorer}/address/`;
  const explorerUrl = explorerAddr + row.token;
  const latestPurchase = events?.find((e) => e.type === "purchase") ?? null;
  const curveAddr = market?.curve || onChain?.curve || "";
  const graduated = market ? market.stage !== "curve" : !!onChain?.graduated;
  const usd = (market?.quoteUsd ?? 0) > 0;
  const copyAddr = () => navigator.clipboard?.writeText(row.token).then(() => toast("Address copied", "success")).catch(() => {});

  // Real 80/20 split the keeper recorded (both halves stored on the coin row).
  const toReserve = row.vault_eth;
  const toTreasury = row.protocol_eth;
  const totalHarvested = toReserve + toTreasury;

  // Same figures Pons shows, plus ZEEP's own reserve numbers.
  const stats: [string, string][] = [
    ["Market cap", market ? (usd ? fmtUsdCompact(market.marketCapUsd) : `${fmtEth(market.marketCapQuote, 2)} ETH`) : "—"],
    ["Holders", holders != null ? fmtInt(holders) : "—"],
    ["Trades", market && market.tradeCount != null ? fmtInt(market.tradeCount) : "—"],
    ["Volume", market && market.volumeQuote != null ? (usd ? fmtUsdCompact(market.volumeUsd ?? 0) : `${fmtEth(market.volumeQuote)} ETH`) : "—"],
    ["Supply", "1B"],
    ["Reserve", `${fmtEth(row.vault_eth)} ETH`],
    ["NFTs held", fmtInt(row.nfts_held)],
    ["Fees awaiting", `${fmtEth(row.fees_awaiting)} ETH`],
  ];

  const details: [string, React.ReactNode][] = [
    ["Collects", row.collection_name],
    ["NFT policy", policyLabel(row.policy)],
    ["Creator tax", market ? `${(market.creatorTaxBps / 100).toFixed(market.creatorTaxBps % 100 ? 1 : 0)}%` : "—"],
    ["Marketplace", "Seaport 1.6 only"],
    // Always English, whatever the visitor's browser language ("Oct 15, 2026").
    ["Launched", new Date(row.launched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
    ["Deployer", <ExplorerLink key="dep" href={explorerAddr + row.deployer}>{short(row.deployer)}</ExplorerLink>],
    ["Status", graduated ? "Graduated" : "On the bonding curve"],
  ];

  return (
    <>
      {/* ── identity header (Curato-style, ZEEP colors) ─────────────── */}
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1180px] px-6 pb-6 pt-6">
          <Link href="/explore" className={cn("inline-flex items-center gap-1.5 rounded text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]", focusRing)}>
            ← The register
          </Link>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {row.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.logo} alt="" className="size-16 shrink-0 rounded-2xl border border-[var(--border)] object-cover" />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[20px] font-bold text-[var(--muted-foreground)]">{row.symbol.slice(0, 1)}</div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h1 className="text-[30px] leading-none md:text-[36px]">{row.name}</h1>
                  <span className="font-mono-tabular text-[18px] tracking-wide text-[var(--muted-foreground)]">${row.symbol}</span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--muted-foreground)]">
                  <span>Collects <span className="text-[var(--foreground)]">{row.collection_name}</span></span>
                  <span aria-hidden>·</span>
                  <span>{timeAgo(row.launched_at)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5 font-mono-tabular">
                    <a href={explorerUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--foreground)] hover:underline">{short(row.token)}</a>
                    <button type="button" onClick={copyAddr} aria-label="Copy contract address" className={cn("hover:text-[var(--foreground)]", focusRing)}>
                      <IconCopy className="size-[13px]" stroke={1.75} />
                    </button>
                    <a href={explorerUrl} target="_blank" rel="noreferrer" aria-label="Open in explorer" className={cn("hover:text-[var(--foreground)]", focusRing)}>
                      <IconExternalLink className="size-[13px]" stroke={1.75} />
                    </a>
                  </span>
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              {market === undefined ? (
                <div className="space-y-2 sm:ml-auto">
                  <div className="h-4 w-24 animate-pulse rounded bg-[var(--card)] sm:ml-auto" />
                  <div className="h-9 w-36 animate-pulse rounded bg-[var(--card)] sm:ml-auto" />
                </div>
              ) : market ? (
                <>
                  <p className="text-[13px] text-[var(--muted-foreground)]">Market cap</p>
                  {/* keyed on the value: a new trade re-mounts it and replays the tick pulse */}
                  <p key={market.marketCapQuote} className="zeep-tick font-mono-tabular text-[30px] font-bold leading-tight text-[var(--primary)] md:text-[36px]" aria-live="polite">
                    {usd ? fmtUsdCompact(market.marketCapUsd) : `${fmtEth(market.marketCapQuote, 2)} ETH`}
                  </p>
                  <p key={`p${market.priceQuote}`} className="zeep-tick mt-1 font-mono-tabular text-[12px] text-[var(--muted-foreground)]">
                    {usd ? fmtUsd(market.priceUsd) : `${subPrice(market.priceQuote)} ETH`} price
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--muted-foreground)]">Reserve balance</p>
                  <p className="font-mono-tabular text-[30px] font-bold leading-tight text-[var(--primary)] md:text-[36px]">{fmtEth(row.vault_eth)} ETH</p>
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">Market data appears once Pons indexes this coin</p>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[1fr_380px]">
        {/* ── left column ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {/* signature panel: harvest */}
          <div className="rounded-[var(--radius)] border border-white/25 bg-gradient-to-br from-[#161616] to-[var(--card)] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Fees</p>
                <p className="mt-1.5 text-[22px] font-semibold">Harvest this coin</p>
                <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                  Anyone can pull this coin&apos;s accrued fees out of Pons — <span className="text-[var(--foreground)]">80%</span> to the reserve, <span className="text-[var(--foreground)]">20%</span> to the treasury, in one transaction.
                </p>
              </div>
              <button
                type="button"
                onClick={doRunKeeper}
                disabled={keeperBusy}
                className={cn("flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5] disabled:opacity-50", focusRing)}
              >
                {keeperBusy ? "Harvesting…" : "Harvest"}
              </button>
            </div>
          </div>

          {/* price chart — Pons' own candles (or the dev-only demo market) */}
          <CoinPriceChart
            token={row.token}
            ethUsd={market?.quoteUsd ?? 0}
            priceUsd={market?.priceUsd}
            priceEth={market?.priceQuote}
            simulated={!!market?.simulated}
            reloadKey={tradeReload}
            liveTrades={pending}
            launch={snap?.m}
            symbol={row.symbol}
          />

          {/* bonding curve progress — same figure Pons shows ("93% of 4.20 ETH") */}
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-5 py-4">
            <div className="flex items-baseline justify-between gap-4 text-[13px]">
              <span className="text-[var(--muted-foreground)]">Bonding curve</span>
              {market ? (
                graduated ? (
                  <span className="font-mono-tabular font-semibold">Graduated</span>
                ) : (
                  <span className="font-mono-tabular">
                    <span className="font-semibold text-[var(--primary)]">{Math.round(market.progress * 100)}%</span>
                    <span className="text-[var(--muted-foreground)]">
                      {" "}
                      · {market.raisedQuote.toFixed(2)} of {market.thresholdQuote.toFixed(2)} ETH
                    </span>
                  </span>
                )
              ) : (
                <span className="font-mono-tabular text-[var(--muted-foreground)]">{graduated ? "Graduated" : "—"}</span>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--background)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={market ? Math.round(market.progress * 100) : 0} aria-label="Bonding curve progress">
              <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${graduated ? 100 : Math.min(100, (market?.progress ?? 0) * 100)}%` }} />
            </div>
            {!graduated && market && <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">Graduates to a Pons pool at {market.thresholdQuote.toFixed(2)} ETH raised.</p>}
          </div>

          {/* stats grid */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
            {stats.map(([k, v]) => (
              <div key={k} className="bg-[var(--card)] px-5 py-4">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{k}</dt>
                <dd className="mt-1.5 font-mono-tabular text-[20px] font-bold leading-tight text-[var(--primary)]">{v}</dd>
              </div>
            ))}
          </dl>

          {/* trades — same feed as Pons' trade list */}
          <Panel
            title="Trades"
            action={market?.tradeCount != null ? <span className="font-mono-tabular text-[12px] text-[var(--muted-foreground)]">{fmtInt(market.tradeCount)} total</span> : undefined}
          >
            {trades === null ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-[var(--background)]" />
                ))}
              </div>
            ) : trades.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-8 text-center text-[13px] text-[var(--muted-foreground)]">No trades yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        <th className="pb-2 font-medium">Side</th>
                        <th className="pb-2 font-medium">Trader</th>
                        <th className="pb-2 text-right font-medium">ETH</th>
                        <th className="pb-2 text-right font-medium">{usd ? "USD" : "Tokens"}</th>
                        <th className="pb-2 text-right font-medium">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, shownTrades).map((t) => (
                        <tr key={t.id} className="border-t border-[color-mix(in_srgb,var(--border)_60%,transparent)]">
                          <td className={cn("py-2.5 font-semibold capitalize", t.side === "buy" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")}>{t.side}</td>
                          <td className="py-2.5">
                            <a href={`${explorerAddr}${t.trader}`} target="_blank" rel="noreferrer" className={cn("font-mono-tabular text-[12px] hover:underline", focusRing)}>
                              {short(t.trader)}
                            </a>
                          </td>
                          <td className="py-2.5 text-right font-mono-tabular">{t.quoteAmount < 0.001 ? "<0.001" : fmtEth(t.quoteAmount)}</td>
                          <td className="py-2.5 text-right font-mono-tabular text-[var(--muted-foreground)]">
                            {usd ? fmtUsdCompact(t.quoteAmount * (market?.quoteUsd ?? 0)) : fmtInt(t.tokenAmount)}
                          </td>
                          <td className="py-2.5 text-right text-[var(--muted-foreground)]">
                            {t.txHash && !market?.simulated ? (
                              <a href={`${CHAIN.explorer}/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="hover:underline">
                                {ageShort(t.timestamp)}
                              </a>
                            ) : (
                              ageShort(t.timestamp)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(shownTrades < trades.length || tradesCursor) && (
                  <button
                    type="button"
                    onClick={showMoreTrades}
                    disabled={moreBusy}
                    className={cn("mt-3 w-full rounded-full border border-[var(--border)] py-2 text-[12px] font-semibold text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)] disabled:opacity-50", focusRing)}
                  >
                    {moreBusy ? "Loading…" : "Show more"}
                  </button>
                )}
              </>
            )}
          </Panel>

          {/* reserve activity */}
          <Panel
            title="Reserve activity"
            action={
              process.env.NODE_ENV !== "production" ? (
                <button type="button" onClick={doRunKeeper} disabled={keeperBusy} className={cn("rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold hover:border-[var(--primary)] disabled:opacity-50", focusRing)}>
                  {keeperBusy ? "Running…" : "Run keeper now"}
                </button>
              ) : undefined
            }
          >
            {events === null ? (
              <div className="py-6 text-center text-[var(--muted-foreground)]">Loading…</div>
            ) : events.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-10 text-center text-[var(--muted-foreground)]">
                No reserve activity yet. Fees are harvested on a schedule once this coin has real trades.
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {events.map((e, i) => (
                  <li key={e.id ?? i} className="flex items-start gap-3 border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] py-3 text-[13px] last:border-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)]"><EventIcon type={e.type} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold">{eventLabel(e)}</span>
                        {e.simulated && <span className="rounded-full border border-[var(--border)] px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">Simulated</span>}
                      </span>
                      {e.winner && <span className="block font-mono-tabular text-[12px] text-[var(--muted-foreground)]">to {short(e.winner)}</span>}
                      {e.type === "draw" && !e.winner && <span className="block text-[12px] text-[var(--muted-foreground)]">no buyers yet — winner pending</span>}
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">{timeAgo(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── right column ────────────────────────────────────────── */}
        <aside className="space-y-6">
          {/* trade */}
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
            {!onChain ? (
              <>
                <h2 className="mb-1 text-[16px] font-semibold">Trading unavailable</h2>
                <p className="text-[13px] text-[var(--muted-foreground)]">Live curve data for this coin isn&apos;t reachable right now, so buy/sell is turned off here.</p>
                {isDev && (
                  <div className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--border)] p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Dev · demo trades</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => doDemoTrade("buy")}
                        disabled={demoBusy}
                        className={cn("flex min-h-10 flex-1 items-center justify-center rounded-full bg-[var(--primary)] text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50", focusRing)}
                      >
                        Demo buy
                      </button>
                      <button
                        type="button"
                        onClick={() => doDemoTrade("sell")}
                        disabled={demoBusy}
                        className={cn("flex min-h-10 flex-1 items-center justify-center rounded-full border border-[var(--border)] text-[13px] font-semibold hover:border-[var(--primary)] disabled:opacity-50", focusRing)}
                      >
                        Demo sell
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">Simulated — appends to the demo chart only. Dev-only, never in production.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="mb-4 text-[16px] font-semibold">Trade ${row.symbol}</h2>
                <div role="tablist" aria-label="Trade side" className="mb-4 flex gap-1 rounded-full border border-[var(--border)] p-1">
                  {(["buy", "sell"] as const).map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setAmount(""); setQuote(null); }} className={cn("min-h-11 flex-1 rounded-full py-2 text-[13px] font-semibold capitalize", focusRing, tab === t ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]")}>
                      {t}
                    </button>
                  ))}
                </div>
                <label htmlFor="trade-amount" className="mb-2 block text-[13px] font-semibold">{tab === "buy" ? "You pay (ETH)" : "You sell (tokens)"}</label>
                <input id="trade-amount" type="number" inputMode="decimal" min={0} className={cn("input", focusRing)} placeholder="0.0" value={amount} onChange={(e) => onAmountChange(e.target.value)} />
                <span id="slippage-label" className="mb-2 mt-4 block text-[13px] font-semibold">Slippage</span>
                <div role="group" aria-labelledby="slippage-label" className="flex flex-wrap gap-2">
                  {SLIPPAGE_OPTIONS.map((s) => (
                    <button key={s} aria-pressed={slippage === s} onClick={() => setSlippage(s)} className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--muted-foreground)]", focusRing, slippage === s && "border-[var(--primary)] bg-[rgba(255,255,255,.08)] text-[var(--primary)]")}>
                      {s}%
                    </button>
                  ))}
                </div>
                <div className="my-3 font-mono-tabular text-[13px] text-[var(--muted-foreground)]" aria-live="polite">{quote ? `Est. ${quote}` : ""}</div>
                {!wallet.connected ? (
                  <button onClick={openWallet} className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)]", focusRing)}>Connect wallet</button>
                ) : (
                  <button disabled={busy} onClick={doTrade} aria-busy={busy} className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold capitalize text-[var(--primary-foreground)] disabled:opacity-50", focusRing)}>{busy ? "Working…" : tab}</button>
                )}
                {graduated && (
                  <p className="mt-2.5 text-[12px] text-[var(--muted-foreground)]">
                    This coin graduated —{" "}
                    <a href={ponsUrl(row.token)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--foreground)]">
                      trade it on Pons
                    </a>
                    .
                  </p>
                )}
              </>
            )}
          </div>

          {/* details */}
          <Panel title="Details">
            {row.description ? <p className="mb-3 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{row.description}</p> : null}
            <dl className="divide-y divide-[color-mix(in_srgb,var(--border)_60%,transparent)] text-[13px]">
              {details.map(([k, v], i) => (
                <div key={i} className="flex items-center justify-between gap-6 py-3">
                  <dt className="text-[var(--muted-foreground)]">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* acquired by this vault */}
          <Panel title="Acquired by this reserve">
            {row.nfts_held > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]"><IconPhoto className="size-6" stroke={1.5} /></div>
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="font-semibold">{row.collection_name}</div>
                  {latestPurchase?.nft_label && <div className="font-mono-tabular text-[var(--muted-foreground)]">{latestPurchase.nft_label}</div>}
                  {latestPurchase?.amount_eth != null && <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">Acquired for ≈ {fmtEth(latestPurchase.amount_eth)} ETH (simulated)</div>}
                </div>
              </div>
            ) : (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-8 text-center text-[13px] text-[var(--muted-foreground)]">The reserve hasn&apos;t bought an NFT yet. Purchases appear here as soon as they happen.</p>
            )}
          </Panel>

          {/* contracts */}
          <Panel title="Contracts">
            <dl className="divide-y divide-[color-mix(in_srgb,var(--border)_60%,transparent)] text-[13px]">
              <div className="flex items-center justify-between gap-6 py-3">
                <dt className="text-[var(--muted-foreground)]">Coin</dt>
                <dd><ExplorerLink href={explorerUrl}>{short(row.token)}</ExplorerLink></dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3">
                <dt className="text-[var(--muted-foreground)]">Bonding curve</dt>
                <dd>{curveAddr ? <ExplorerLink href={explorerAddr + curveAddr}>{short(curveAddr)}</ExplorerLink> : <span className="text-[var(--muted-foreground)]">—</span>}</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3">
                <dt className="text-[var(--muted-foreground)]">Reserve / FeeRouter</dt>
                <dd className="text-right text-[12px] text-[var(--muted-foreground)]">deployed per launch</dd>
              </div>
            </dl>
            {market && !market.simulated && (
              <a
                href={ponsUrl(row.token)}
                target="_blank"
                rel="noreferrer"
                className={cn("mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] text-[12px] font-semibold hover:border-[var(--primary)]", focusRing)}
              >
                View on Pons <IconExternalLink className="size-[13px]" stroke={1.75} />
              </a>
            )}
          </Panel>

          {/* fees harvested */}
          <Panel title="Fees harvested">
            <dl className="divide-y divide-[color-mix(in_srgb,var(--border)_60%,transparent)] text-[13px]">
              <div className="flex items-center justify-between gap-6 py-3">
                <dt className="text-[var(--muted-foreground)]">Total harvested</dt>
                <dd className="font-mono-tabular">{fmtEth(totalHarvested)} ETH</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3">
                <dt className="text-[var(--muted-foreground)]">To reserve (80%)</dt>
                <dd className="font-mono-tabular">{fmtEth(toReserve)} ETH</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-3">
                <dt className="text-[var(--muted-foreground)]">To treasury (20%)</dt>
                <dd className="font-mono-tabular">{fmtEth(toTreasury)} ETH</dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </section>
    </>
  );
}

function CoinSkeleton() {
  const Box = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-[var(--radius)] bg-[var(--card)]", className)} />;
  return (
    <>
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1180px] px-6 pb-6 pt-6">
          <Box className="h-4 w-28" />
          <div className="mt-4 flex items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <Box className="size-16 rounded-2xl" />
              <div className="space-y-2">
                <Box className="h-8 w-56" />
                <Box className="h-4 w-72" />
              </div>
            </div>
            <div className="hidden space-y-2 sm:block">
              <Box className="ml-auto h-4 w-24" />
              <Box className="ml-auto h-9 w-36" />
            </div>
          </div>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Box className="h-28" />
          <Box className="h-48" />
          <Box className="h-14" />
          <Box className="h-24" />
          <Box className="h-64" />
        </div>
        <div className="space-y-6">
          <Box className="h-80" />
          <Box className="h-48" />
          <Box className="h-40" />
        </div>
      </section>
    </>
  );
}

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("font-mono-tabular text-[12px] underline-offset-2 hover:underline", focusRing)}>
      {children} ↗
    </a>
  );
}

function Panel({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EventIcon({ type }: { type: VaultEvent["type"] }) {
  if (type === "harvest") return <IconCoins className="size-[14px]" stroke={1.75} />;
  if (type === "purchase") return <IconShoppingBag className="size-[14px]" stroke={1.75} />;
  return <IconTicket className="size-[14px]" stroke={1.75} />;
}

function eventLabel(e: VaultEvent) {
  if (e.type === "harvest") return `Harvested ${fmtEth(e.amount_eth ?? 0, 5)} ETH in fees`;
  if (e.type === "purchase") return `Bought ${e.nft_label} for ${fmtEth(e.amount_eth ?? 0)} ETH`;
  return `Drew a winner for ${e.nft_label}`;
}
