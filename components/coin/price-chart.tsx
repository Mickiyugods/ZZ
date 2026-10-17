"use client";

import * as React from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import { ponsCandles, ponsDevTransfers, ponsMarkers, type PonsCandle, type PonsDevTransfer, type PonsInterval, type PonsLaunch, type PonsTrade } from "@/lib/pons";
import { fmtUsdCompact, short, subPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

// ZEEP palette — pure black/white, no accent. Up = white, down = muted grey.
const UP = "#ffffff";
const DOWN = "#6f6f6f";
const UP_VOL = "rgba(255,255,255,0.22)";
const DOWN_VOL = "rgba(130,130,130,0.22)";
const DEV = "#a3a3a3"; // "D": the creator's own buys/sells
const XFER = "#ffffff"; // "T": the creator moving tokens to another wallet (square, so it reads apart from D)

/** 500000 -> "500K", 5094669 -> "5.1M" (Pons' compact token amounts). */
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return `${+n.toFixed(2)}`;
}

// Same timeframe set as Pons' chart. 6h is built from 1h candles (Pons' API has
// no 6h bucket); "All" uses 4h so a coin's whole life fits without thinning out.
const RANGES = [
  { key: "1m", label: "1m", interval: "1m", group: 1 },
  { key: "5m", label: "5m", interval: "5m", group: 1 },
  { key: "1h", label: "1h", interval: "1h", group: 1 },
  { key: "6h", label: "6h", interval: "1h", group: 6 },
  { key: "all", label: "All", interval: "4h", group: 1 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const POLL_MS = 15_000;
const VISIBLE_BARS = 72; // max bars shown on open (~9px each), roughly what Pons' chart shows

/** Merge consecutive candles into larger buckets (e.g. 1h → 6h). */
function regroup(c: PonsCandle[], group: number, size: number): PonsCandle[] {
  if (group <= 1) return c;
  const span = size * group;
  const out: PonsCandle[] = [];
  for (const k of c) {
    const time = Math.floor(k.time / span) * span;
    const last = out.at(-1);
    if (last && last.time === time) {
      last.high = Math.max(last.high, k.high);
      last.low = Math.min(last.low, k.low);
      last.close = k.close;
      last.volumeQuote += k.volumeQuote;
      last.trades += k.trades;
    } else out.push({ ...k, time });
  }
  return out;
}

const SIZE: Record<PonsInterval, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

/** Extend the forming candle / open new ones with trades the candle API doesn't
 * have yet (oldest first) — the same way Pons' chart moves the instant a trade lands. */
function foldTrades(base: PonsCandle[], trades: PonsTrade[], size: number): PonsCandle[] {
  if (!trades.length) return base;
  const out = base.slice();
  for (const t of trades) {
    const p = t.price;
    if (!(p > 0)) continue;
    const time = Math.floor(t.timestamp / size) * size;
    const last = out.at(-1);
    if (last && last.time === time) {
      out[out.length - 1] = { ...last, high: Math.max(last.high, p), low: Math.min(last.low, p), close: p, volumeQuote: last.volumeQuote + t.quoteAmount, trades: last.trades + 1 };
    } else if (!last || time > last.time) {
      out.push({ time, open: p, high: p, low: p, close: p, volumeQuote: t.quoteAmount, trades: 1 });
    }
  }
  return out;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export function CoinPriceChart({
  token,
  ethUsd,
  priceUsd,
  priceEth,
  simulated,
  reloadKey = 0,
  liveTrades,
  launch,
  symbol,
}: {
  token: string;
  ethUsd: number; // Pons' own ETH/USD, so USD values match Pons exactly
  priceUsd?: number;
  priceEth?: number;
  simulated?: boolean;
  reloadKey?: number;
  liveTrades?: PonsTrade[]; // trades Pons' launch snapshot doesn't include yet, oldest first
  launch?: PonsLaunch | null; // for the dev-transfer ("T") lookup
  symbol: string;
}) {
  const [range, setRange] = React.useState<RangeKey>("1h");
  const [mode, setMode] = React.useState<"candles" | "line">("candles");
  const [base, setBase] = React.useState<PonsCandle[] | null>(null); // straight from Pons' candle API
  const [hourly, setHourly] = React.useState<PonsCandle[]>([]);
  const [devTrades, setDevTrades] = React.useState<{ time: number; side: "buy" | "sell"; tokens: number; quote: number }[]>([]);
  const [transfers, setTransfers] = React.useState<PonsDevTransfer[]>([]);
  const [hoverNotes, setHoverNotes] = React.useState<string[]>([]);
  const notesByTime = React.useRef(new Map<number, string[]>());

  const box = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const priceRef = React.useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const volRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);
  const fitNext = React.useRef(true); // only auto-fit on first load / timeframe change, never on live ticks

  const usd = ethUsd > 0;
  const mult = usd ? ethUsd : 1;
  const r = RANGES.find((x) => x.key === range)!;

  // candles for the selected timeframe, refreshed live
  const viewKey = React.useRef("");
  const shown = React.useRef<{ key: string; c: PonsCandle[] } | null>(null);
  React.useEffect(() => {
    let alive = true;
    // re-fit only when the coin or timeframe changes — a new trade (reloadKey)
    // just updates the bars in place, so the user's zoom/scroll never jumps
    const key = `${token}|${r.interval}|${r.group}`;
    if (viewKey.current !== key) {
      viewKey.current = key;
      fitNext.current = true;
    }
    const load = async () => {
      const c = await ponsCandles(token, r.interval).catch(() => null);
      if (!alive) return;
      const next = c ? regroup(c, r.group, SIZE[r.interval]) : [];
      // Pons' API is CDN-cached; ignore a snapshot older than the last one we used
      const prev = shown.current?.key === key ? shown.current.c : null;
      const a = prev?.at(-1);
      const b = next.at(-1);
      if (a && (!b || b.time < a.time || (b.time === a.time && b.trades < a.trades))) return;
      shown.current = { key, c: next };
      setBase(next);
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, r.interval, r.group, reloadKey]);

  const size = SIZE[r.interval] * r.group;
  const candles = React.useMemo(() => (base ? foldTrades(base, liveTrades ?? [], size) : null), [base, liveTrades, size]);

  // 1h candles back the "24h" change figure, whatever timeframe is on screen
  React.useEffect(() => {
    let alive = true;
    const load = () => ponsCandles(token, "1h").then((c) => alive && c && setHourly(c)).catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, reloadKey]);

  // Creator activity, detected by Pons itself and refreshed every 20s like Pons:
  //   "D" — every buy/sell from the deployer wallet (Pons' markers view)
  //   "T" — the deployer sending this coin's tokens to another wallet (Pons'
  //         balances indexer, minus Pons' own system addresses — see ponsDevTransfers)
  const xferKey = launch && !launch.simulated ? `${launch.address}|${launch.deployer}|${launch.curve}` : "";
  React.useEffect(() => {
    let alive = true;
    const load = () => {
      ponsMarkers(token)
        .then((m) => alive && m && setDevTrades(m.trades.filter((t) => t.who === "dev").map((t) => ({ time: t.time, side: t.side, tokens: t.tokens, quote: t.quote }))))
        .catch(() => {});
      if (xferKey && launch) ponsDevTransfers(launch).then((t) => alive && setTransfers(t)).catch(() => {});
      else setTransfers([]);
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `launch` changes every poll; xferKey is its identity
  }, [token, reloadKey, xferKey]);

  const hasData = !!candles && candles.length > 0;
  const lastEth = priceEth ?? (hasData ? candles![candles!.length - 1].close : 0);
  const lastShown = usd ? (priceUsd ?? lastEth * ethUsd) : lastEth;

  // Pons' "24h" figure: change vs. the close of the last full hourly candle that
  // ended before (now − 24h) — i.e. the price at the top of that hour. Verified
  // against ponsfamily.com's own number on a live coin. Coins younger than a day
  // measure from their first trade.
  const change24 = React.useMemo(() => {
    if (!hourly.length || !lastEth) return null;
    const cutoff = Date.now() / 1000 - 86400;
    let base = hourly[0].open;
    for (const c of hourly) {
      if (c.time + 3600 <= cutoff) base = c.close;
      else break;
    }
    return base > 0 ? ((lastEth - base) / base) * 100 : null;
  }, [hourly, lastEth]);

  // build the chart once there's data
  React.useEffect(() => {
    const el = box.current;
    if (!el || !hasData) return;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: 360,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a8a8a", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      rightPriceScale: { borderVisible: false, mode: PriceScaleMode.Logarithmic, scaleMargins: { top: 0.12, bottom: 0.2 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7 },
      crosshair: { mode: CrosshairMode.Normal },
      // the wheel scrolls the page, not the chart (drag to pan, pinch/axis-drag to zoom)
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
      // locale pinned to English: otherwise the time axis/crosshair follow the
      // browser language (an Indonesian browser showed "17 Okt '26").
      localization: { locale: "en-US", priceFormatter: (v: number) => (usd ? `$${subPrice(v)}` : subPrice(v)) },
    });
    chartRef.current = chart;
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    volRef.current = vol;
    fitNext.current = true;
    // Like Pons: hovering a candle spells out the creator activity in it
    chart.subscribeCrosshairMove((p) => setHoverNotes(p.time != null ? notesByTime.current.get(p.time as number) ?? [] : []));

    const ro = new ResizeObserver(() => box.current && chart.applyOptions({ width: box.current.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      priceRef.current = null;
      volRef.current = null;
    };
  }, [hasData, usd]);

  // (re)create the price series when the chart type changes
  React.useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const s =
      mode === "candles"
        ? chart.addCandlestickSeries({ upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false, priceLineColor: "#ffffff", priceLineStyle: 2 })
        : chart.addLineSeries({ color: UP, lineWidth: 2, priceLineColor: "#ffffff", priceLineStyle: 2 });
    priceRef.current = s;
    fitNext.current = true;
    return () => {
      if (chartRef.current && priceRef.current) chartRef.current.removeSeries(priceRef.current);
      priceRef.current = null;
    };
  }, [mode, hasData, usd]);

  // feed data in place — live ticks only call setData, so the view never jumps
  React.useEffect(() => {
    const chart = chartRef.current;
    const s = priceRef.current;
    const vol = volRef.current;
    if (!chart || !s || !candles) return;
    if (mode === "candles") {
      (s as ISeriesApi<"Candlestick">).setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open * mult, high: c.high * mult, low: c.low * mult, close: c.close * mult })));
    } else {
      (s as ISeriesApi<"Line">).setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close * mult })));
    }
    vol?.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volumeQuote * mult, color: c.close >= c.open ? UP_VOL : DOWN_VOL })));

    const marks: SeriesMarker<UTCTimestamp>[] = [];
    if (candles.length) {
      const first = candles[0].time;
      const snap = (ts: number) => {
        let out = first;
        for (const c of candles) {
          if (c.time <= ts) out = c.time;
          else break;
        }
        return out as UTCTimestamp;
      };
      const notes = new Map<number, string[]>();
      const note = (t: number, text: string) => notes.set(t, [...(notes.get(t) ?? []), text]);
      for (const d of devTrades) {
        if (d.time < first) continue;
        const t = snap(d.time);
        // Pons: a buy sits under the bar, a sell above it
        marks.push({ time: t, position: d.side === "buy" ? "belowBar" : "aboveBar", color: DEV, shape: "circle", text: "D", size: 1.4 });
        note(t, `Dev ${d.side === "buy" ? "bought" : "sold"} ${compact(d.tokens)} ${symbol} for ${usd ? fmtUsdCompact(d.quote * ethUsd) : `${+d.quote.toFixed(4)} ETH`}`);
      }
      for (const x of transfers) {
        if (x.time < first) continue;
        const t = snap(x.time);
        marks.push({ time: t, position: "aboveBar", color: XFER, shape: "square", text: "T", size: 1.4 });
        note(t, `Dev sent ${compact(x.tokens)} ${symbol} to ${short(x.to)}`);
      }
      notesByTime.current = notes;
    }
    marks.sort((a, b) => (a.time as number) - (b.time as number));
    s.setMarkers(marks);

    if (fitNext.current) {
      // Like Pons: open on the most recent bars at a readable width instead of
      // squeezing a coin's whole history in; drag left to see earlier candles.
      const n = candles.length;
      const visible = Math.max(24, Math.min(VISIBLE_BARS, Math.floor((box.current?.clientWidth ?? 640) / 9)));
      if (n > visible) chart.timeScale().setVisibleLogicalRange({ from: n - visible, to: n + 3 });
      else chart.timeScale().fitContent();
      fitNext.current = false;
    }
  }, [candles, mode, mult, devTrades, transfers, symbol, usd, ethUsd, hasData]);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span key={lastShown} className="zeep-tick font-mono-tabular text-[28px] font-bold leading-none text-[var(--primary)]">
              {usd ? `$${subPrice(lastShown)}` : `${subPrice(lastShown)} ETH`}
            </span>
            {simulated && (
              <span className="rounded-full border border-[var(--border)] px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                Demo · simulated
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono-tabular text-[13px]">
            {change24 != null ? (
              <>
                <span className={cn("font-semibold", change24 >= 0 ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")}>
                  {change24 >= 0 ? "+" : ""}
                  {change24.toFixed(2)}%
                </span>
                <span className="ml-1.5 text-[var(--muted-foreground)]">24h</span>
              </>
            ) : (
              <span className="text-[var(--muted-foreground)]">Price</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
            {(["line", "candles"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn("rounded-full px-3 py-1 text-[12px] font-semibold capitalize", focusRing, mode === m ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
            {RANGES.map((x) => (
              <button
                key={x.key}
                onClick={() => setRange(x.key)}
                aria-pressed={range === x.key}
                className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", focusRing, range === x.key ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {candles === null ? (
        <div className="h-[360px] animate-pulse rounded-[var(--radius)] bg-[var(--background)]" aria-label="Loading chart" />
      ) : !hasData ? (
        <div className="flex h-[200px] items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--border)] px-6 text-center text-[12px] text-[var(--muted-foreground)]">
          No trades yet. The chart fills in from real buys and sells on Pons — ZEEP never invents a price history.
        </div>
      ) : (
        <>
          {/* creator activity under the cursor (D/T markers), like Pons' chart legend */}
          <div className="mb-1 min-h-[18px] truncate font-mono-tabular text-[12px] text-[var(--muted-foreground)]" aria-live="polite">
            {hoverNotes.join(" · ")}
          </div>
          <div ref={box} className="w-full" />
        </>
      )}
    </div>
  );
}
