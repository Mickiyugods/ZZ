// USD per ETH from CoinGecko, cached a minute. Only used where Pons' own
// `quoteUsd` isn't available (coins Pons hasn't indexed yet, and the dev demo).

let cache: { at: number; usd: number } | null = null;

export async function ethUsd(): Promise<number> {
  if (cache && Date.now() - cache.at < 60_000) return cache.usd;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const usd = Number((await r.json())?.ethereum?.usd) || 0;
    if (usd > 0) cache = { at: Date.now(), usd };
    return usd || cache?.usd || 0;
  } catch {
    return cache?.usd || 0;
  }
}
