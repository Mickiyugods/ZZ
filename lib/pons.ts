// Client for Pons' launch data, via our /api/pons proxy. Every ZEEP coin is a
// Pons V2 launch, so this is what keeps the coin page identical to ponsfamily.com.

export interface PonsLaunch {
  address: string;
  name: string;
  symbol: string;
  stage: "curve" | "graduated" | string;
  deployer: string;
  createdAt: number | null;
  lastTradeAt: number | null;
  progress: number; // 0..1 toward graduation
  raisedQuote: number; // ETH raised on the curve
  thresholdQuote: number; // ETH needed to graduate
  priceQuote: number; // ETH per token
  priceUsd: number;
  marketCapQuote: number;
  marketCapUsd: number;
  volumeQuote: number | null; // null = unknown (read from chain before Pons indexed it)
  volumeUsd: number | null;
  tradeCount: number | null;
  creatorTaxBps: number;
  curve: string;
  pool: string | null;
  poolId?: string | null; // set once graduated; matches `swaps[].pool` in the ticks feed
  totalSupply: number;
  graduatedAt: number | null;
  quoteUsd: number; // Pons' own ETH/USD rate
  factory?: string;
  decimals?: number;
  fees?: { distributor: string | null } | null;
  simulated?: boolean; // only on the dev-only demo market
  source?: "chain"; // set when Pons hadn't indexed the coin yet and we read the curve directly
}

export interface PonsTrade {
  id: string;
  side: "buy" | "sell";
  trader: string;
  quoteAmount: number; // ETH
  tokenAmount: number;
  price: number; // ETH per token
  timestamp: number; // unix seconds
  txHash: string;
  venue: string;
}

export interface PonsCandle {
  time: number; // unix seconds, bucket start
  open: number;
  high: number;
  low: number;
  close: number;
  volumeQuote: number;
  trades: number;
}

export interface PonsMarkerTrade {
  id: string;
  who: string;
  wallet: string;
  side: "buy" | "sell";
  tokens: number;
  quote: number;
  price: number;
  time: number;
  txHash: string;
}

export type PonsInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

async function get<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams(params);
  let r = await fetch(`/api/pons?${qs}`, { cache: "no-store" });
  // Not on Pons (yet): fall back to the dev-only simulated market, same shapes.
  // In production that route always 404s, so nothing simulated can show.
  if (r.status === 404) r = await fetch(`/api/trades?${qs}`, { cache: "no-store" });
  if (!r.ok) return null;
  try {
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const ponsLaunch = (token: string) => get<PonsLaunch>({ token, view: "launch" });

export const ponsTrades = (token: string, cursor?: string) =>
  get<{ items: PonsTrade[]; nextCursor: string | null }>({ token, view: "trades", ...(cursor ? { cursor } : {}) });

export const ponsCandles = async (token: string, interval: PonsInterval) => {
  const c = await get<PonsCandle[]>({ token, view: "candles", interval });
  return Array.isArray(c) ? c : null;
};

export const ponsMarkers = (token: string) => get<{ dev: string; trades: PonsMarkerTrade[] }>({ token, view: "markers" });

/** Pons' live feed: trades from the last ~3s across every coin. Poll every ~2.5s. */
export interface PonsTick {
  id: string; // "<txHash>:<logIndex>" — the same id the trade later has in view=trades
  curve: string;
  trader: string;
  side: "buy" | "sell";
  at: number;
  block: number;
  logIndex: number;
  quote: string; // wei. buy: ETH sent incl. fee+tax; sell: ETH received after fee+tax
  tokens: string; // wei
  fee: string; // wei
  tax: string; // wei
}
export interface PonsTicks {
  block: number;
  at: number;
  ticks: PonsTick[];
  swaps: { id: string; pool: string; at: number }[];
}

const wei = (v: string) => Number(BigInt(v)) / 1e18;

/** A tick as Pons prices it: fill price = quote / tokens (verified equal to the
 * trade's price once Pons' trades API catches up). */
export function tickToTrade(t: PonsTick): PonsTrade & { fee: number; tax: number } {
  const quoteAmount = wei(t.quote);
  const tokenAmount = wei(t.tokens);
  return {
    id: t.id,
    side: t.side,
    trader: t.trader,
    quoteAmount,
    tokenAmount,
    price: tokenAmount > 0 ? quoteAmount / tokenAmount : 0,
    timestamp: t.at,
    txHash: t.id.split(":")[0],
    venue: "curve",
    fee: wei(t.fee),
    tax: wei(t.tax),
  };
}
export async function ponsTicks(): Promise<PonsTicks | null> {
  try {
    const r = await fetch("/api/pons?view=ticks", { cache: "no-store" });
    return r.ok ? ((await r.json()) as PonsTicks) : null;
  } catch {
    return null;
  }
}

/** Holder count from Pons' balances indexer — the same number ponsfamily.com shows. */
export async function ponsHolders(token: string): Promise<number | null> {
  const r = await get<{ holders?: number }>({ token, view: "holders" });
  return typeof r?.holders === "number" ? r.holders : null;
}

export interface PonsDevTransfer {
  id: string;
  to: string;
  tokens: number;
  time: number;
  txHash: string;
}

// Addresses Pons does NOT count as a dev "transfer" (they're trades, liquidity or
// plumbing, not the creator handing tokens to another wallet). Copied from
// ponsfamily.com's own chart code so ZEEP's "T" markers match it exactly.
const PONS_SYSTEM = [
  "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  "0xa67f1807f929b2be55a847eadc7f7077ebf2d01b", // Pons swap router
  "0x6861639c7b7e70021deb1786941afeb7659ddd45", // Pons dampener
  "0x8876789976decbfcbbbe364623c63652db8c0904", // Uniswap v4 universal router
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Permit2
  "0x715c72b7d9eab4d06c956178ffa05713da7c262f", // Pons liquidity vault
  "0x0000000000000000000000000000000000000000",
];

/** The creator moving this coin's tokens to another wallet ("T" on Pons' chart). */
export async function ponsDevTransfers(m: PonsLaunch): Promise<PonsDevTransfer[]> {
  if (!m.deployer) return [];
  const r = await get<{ items?: { to: string; value: string; time: number; tx_hash: string; log_index: number }[] }>({
    token: m.address,
    view: "sent",
    wallet: m.deployer,
  });
  const skip = new Set([m.address, m.curve, m.factory, m.fees?.distributor, ...PONS_SYSTEM].filter((x): x is string => !!x).map((x) => x.toLowerCase()));
  const unit = 10 ** (m.decimals ?? 18);
  return (r?.items ?? [])
    .filter((x) => x.to && !skip.has(x.to.toLowerCase()))
    .map((x) => ({ id: `${x.tx_hash}:${x.log_index}`, to: x.to.toLowerCase(), tokens: Number(x.value) / unit, time: x.time, txHash: x.tx_hash }));
}

/** Pons' public coin page for a token. */
export const ponsUrl = (token: string) => `https://ponsfamily.com/launchpad/${token.toLowerCase()}`;
