// DEV-ONLY simulated market for coins that aren't live on Pons yet (e.g. the
// seeded local demo coin), so the coin page and chart can be built and tested
// before any real trade exists. It reproduces Pons V2's actual curve parameters
// (1.68 ETH virtual quote reserve, 1B virtual token reserve, 4.2 ETH graduation,
// 1% fee — read off a live Pons curve) and returns data in exactly the same
// shapes as Pons' launch API, so the page has a single code path.
//
// Never used in production: every entry point returns nothing unless
// NODE_ENV !== "production" (or ZEEP_DEV is set). Rows are tagged simulated.

import fs from "fs";
import path from "path";
import crypto from "crypto";

const FILE = path.join(process.cwd(), ".data", "zeep-trades.json");

// Every Pons V2 ETH-pair curve starts from these exact values (verified on-chain
// across several live coins: virtual quote reserve 1.68 ETH, virtual token
// reserve 1.000B → k = 1.68e9, graduation at 4.2 ETH raised, 1% curve fee).
// taxBps = the coin's creator tax; ZEEP's demo coin launched with 0%.
export const DEMO = { Q0: 1.68, T0: 1_000_000_000, threshold: 4.2, feeBps: 100, taxBps: 0, supply: 1_000_000_000 };
const CUT = () => (DEMO.feeBps + DEMO.taxBps) / 10_000;

export interface DemoTradeRecord {
  token: string;
  side: "buy" | "sell";
  trader: string;
  eth_value: number; // ETH paid incl. fee+tax (buy) or ETH received after fee+tax (sell) — Pons' quoteAmount
  tokens: number;
  price: number; // fill price = eth_value / tokens, exactly how Pons prices a trade
  ts: number; // unix seconds
  tx: string;
  simulated: true;
}

export function devOnly(): boolean {
  return process.env.NODE_ENV !== "production" || !!process.env.ZEEP_DEV;
}

function readAll(): DemoTradeRecord[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeAll(rows: DemoTradeRecord[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function mine(token: string): DemoTradeRecord[] {
  return readAll()
    .filter((t) => t.token.toLowerCase() === token.toLowerCase())
    .sort((a, b) => a.ts - b.ts);
}

/** Current curve reserves after replaying every demo trade (constant product). */
function reserves(trades: DemoTradeRecord[]) {
  let q = DEMO.Q0;
  let t = DEMO.T0;
  for (const tr of trades) {
    if (tr.side === "buy") {
      const net = tr.eth_value * (1 - CUT());
      const out = (net * t) / (q + net);
      q += net;
      t -= out;
    } else {
      const gross = (tr.tokens * q) / (t + tr.tokens);
      q -= gross;
      t += tr.tokens;
    }
  }
  return { q, t };
}

const demoAddr = (seed: string) => "0x" + crypto.createHash("sha256").update(seed).digest("hex").slice(0, 40);
const demoTx = () => "0x" + crypto.randomBytes(32).toString("hex");

/** Apply one simulated buy (ETH in) or sell (ETH-equivalent of tokens out). */
export function addDemoTrade(token: string, side: "buy" | "sell", ethValue: number, trader?: string, ts?: number) {
  if (!devOnly()) return null;
  const rows = readAll();
  const { q, t } = reserves(mine(token));
  const eth = Math.max(0.0001, ethValue || 0.01);
  let rec: DemoTradeRecord;
  const at = ts ?? Math.floor(Date.now() / 1000);
  if (side === "buy") {
    // Pons buy: fee + tax come off the ETH sent; the rest goes into the curve.
    const net = eth * (1 - CUT());
    const out = (net * t) / (q + net);
    rec = { token, side, trader: trader || demoAddr(`buyer-${Date.now()}`), eth_value: eth, tokens: out, price: eth / out, ts: at, tx: demoTx(), simulated: true };
  } else {
    // Pons sell: the curve pays out gross, then fee + tax come off it.
    // Pick the tokens whose net proceeds ≈ the requested ETH (capped by what was ever sold out).
    const sold = DEMO.T0 - t;
    if (sold <= 0) return null;
    const gross = eth / (1 - CUT());
    const tokensIn = Math.min((gross * t) / Math.max(1e-12, q - gross), sold);
    const g = (tokensIn * q) / (t + tokensIn);
    const netOut = g * (1 - CUT());
    rec = { token, side, trader: trader || demoAddr(`seller-${Date.now()}`), eth_value: netOut, tokens: tokensIn, price: netOut / tokensIn, ts: at, tx: demoTx(), simulated: true };
  }
  rows.push(rec);
  writeAll(rows);
  return rec;
}

export function hasDemo(token: string) {
  return devOnly() && mine(token).length > 0;
}

/** Pons-launch-shaped summary for a demo coin. */
export function demoLaunch(token: string, quoteUsd: number) {
  const trades = mine(token);
  const { q } = reserves(trades);
  // Like Pons: the shown price is the last trade's fill price; before any trade
  // it's the curve's starting spot price, 1.68 ETH / 1B = 1.68e-9 ETH.
  const price = trades.at(-1)?.price ?? DEMO.Q0 / DEMO.T0;
  const raised = Math.max(0, q - DEMO.Q0);
  const volume = trades.reduce((s, x) => s + x.eth_value, 0);
  return {
    address: token.toLowerCase(),
    stage: raised >= DEMO.threshold ? "graduated" : "curve",
    createdAt: trades[0]?.ts ?? Math.floor(Date.now() / 1000),
    lastTradeAt: trades.at(-1)?.ts ?? null,
    progress: Math.min(1, raised / DEMO.threshold),
    raisedQuote: raised,
    thresholdQuote: DEMO.threshold,
    priceQuote: price,
    priceUsd: price * quoteUsd,
    marketCapQuote: price * DEMO.supply,
    marketCapUsd: price * DEMO.supply * quoteUsd,
    volumeQuote: volume,
    volumeUsd: volume * quoteUsd,
    tradeCount: trades.length,
    creatorTaxBps: DEMO.taxBps,
    curve: "",
    pool: null,
    totalSupply: DEMO.supply,
    graduatedAt: null,
    quoteUsd,
    simulated: true,
  };
}

/** Wallets left holding a positive balance after replaying the demo trades. */
export function demoHolders(token: string) {
  const bal = new Map<string, number>();
  for (const t of mine(token)) bal.set(t.trader, (bal.get(t.trader) ?? 0) + (t.side === "buy" ? t.tokens : -t.tokens));
  return { holders: [...bal.values()].filter((v) => v > 1e-6).length };
}

export function demoTrades(token: string) {
  const items = mine(token)
    .reverse()
    .slice(0, 50)
    .map((r) => ({ id: r.tx, side: r.side, trader: r.trader, quoteAmount: r.eth_value, tokenAmount: r.tokens, price: r.price, timestamp: r.ts, txHash: r.tx, venue: "curve" }));
  return { items, nextCursor: null };
}

const BUCKET: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

/** OHLCV candles built exactly like Pons': open = first trade's fill price in the
 * bucket (not the previous close), high/low/close from the bucket's own trades,
 * and buckets without trades are simply absent (no flat filler candles). */
export function demoCandles(token: string, interval: string) {
  const size = BUCKET[interval] ?? 3600;
  const out: { time: number; open: number; high: number; low: number; close: number; volumeQuote: number; trades: number }[] = [];
  for (const tr of mine(token)) {
    const time = Math.floor(tr.ts / size) * size;
    const c = out.at(-1);
    if (!c || c.time !== time) {
      out.push({ time, open: tr.price, high: tr.price, low: tr.price, close: tr.price, volumeQuote: tr.eth_value, trades: 1 });
      continue;
    }
    c.high = Math.max(c.high, tr.price);
    c.low = Math.min(c.low, tr.price);
    c.close = tr.price;
    c.volumeQuote += tr.eth_value;
    c.trades += 1;
  }
  return out;
}
