"use client";

// Live token holdings for a wallet on Robinhood Chain (4663), for /profile.
//
// - Which tokens: Alchemy's token index (/api/wallet-tokens, server side) AND
//   Robinhood Chain's Blockscout (`/addresses/<a>/token-balances`, public,
//   CORS-open — called from the browser because its Cloudflare blocks
//   server-side fetches), merged, plus every ZEEP coin in the registry.
// - Logos: ZEEP registry logo → Pons artwork → Blockscout icon → Alchemy logo,
//   each falling through to the next if it fails to load.
// - How much: read straight from chain every few seconds — one JSON-RPC batch
//   of `eth_getBalance` + `balanceOf` per token through /api/rpc — so amounts
//   are as fresh as the latest block, not the indexer.
// - Instantly after a trade: Pons' live feed (`/api/pons?view=ticks`) is
//   watched for this wallet; one of its trades triggers an immediate re-read.
// - Price: Pons' own launch data for Pons coins (same numbers ponsfamily.com
//   shows), else Blockscout's market rate when it has one, else none.

import * as React from "react";
import { CHAIN } from "./config";
import { ponsArtwork, ponsLaunch, ponsTicks } from "./pons";

const BLOCKSCOUT = `${CHAIN.explorer}/api/v2`;
const BALANCE_MS = 4000;
const DISCOVER_MS = 15000;
const TICKS_MS = 3000;
const PRICE_MS = 20000;

export interface TokenMeta {
  address: string; // lowercase
  symbol: string;
  name: string;
  decimals: number;
  icon: string | null; // ZEEP registry logo or Blockscout icon
  altIcon?: string | null; // Alchemy's logo, last resort
  marketUsd: number | null; // Blockscout exchange rate, when it has one
}

export interface Holding extends TokenMeta {
  icons: string[]; // candidate logo URLs, best first
  raw: bigint;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  priceSource: "pons" | "market" | null;
}

export interface HoldingsState {
  holdings: Holding[] | null; // null until the first on-chain read lands
  ethWei: bigint | null;
  ethUsd: number;
  block: number | null;
  updatedAt: number | null;
  discoveryFailed: boolean; // Blockscout unreachable: only known/registry tokens are checked
  changed: Set<string>; // tokens (and "eth") whose balance changed on the last read
}

interface BlockscoutBalance {
  value: string;
  token: {
    address_hash: string;
    symbol: string | null;
    name: string | null;
    decimals: string | null;
    type: string;
    icon_url: string | null;
    exchange_rate: string | null;
    reputation?: string | null;
  } | null;
}

/** Union of both indexes; throws only if both are unreachable. */
async function discover(owner: string): Promise<TokenMeta[]> {
  const [bs, al] = await Promise.allSettled([discoverBlockscout(owner), discoverAlchemy(owner)]);
  if (bs.status === "rejected" && al.status === "rejected") throw new Error("no token index reachable");
  const out = new Map<string, TokenMeta>();
  if (bs.status === "fulfilled") for (const m of bs.value) out.set(m.address, m);
  if (al.status === "fulfilled")
    for (const m of al.value) {
      const prev = out.get(m.address);
      out.set(m.address, prev ? { ...prev, altIcon: m.altIcon } : m);
    }
  return [...out.values()];
}

async function discoverAlchemy(owner: string): Promise<TokenMeta[]> {
  const r = await fetch(`/api/wallet-tokens?address=${owner}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`wallet-tokens ${r.status}`);
  const j = (await r.json()) as { tokens: { address: string; symbol: string | null; name: string | null; decimals: number | null; logo: string | null }[] };
  return j.tokens.map((t) => ({
    address: t.address,
    symbol: t.symbol || "?",
    name: t.name || t.symbol || "Unknown token",
    decimals: t.decimals ?? 18,
    icon: null,
    altIcon: t.logo,
    marketUsd: null,
  }));
}

async function discoverBlockscout(owner: string): Promise<TokenMeta[]> {
  const r = await fetch(`${BLOCKSCOUT}/addresses/${owner}/token-balances`, { cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`blockscout ${r.status}`);
  const items = (await r.json()) as BlockscoutBalance[];
  return items
    .filter((i) => i.token && i.token.type === "ERC-20" && i.token.reputation !== "scam")
    .map((i) => ({
      address: i.token!.address_hash.toLowerCase(),
      symbol: i.token!.symbol || "?",
      name: i.token!.name || i.token!.symbol || "Unknown token",
      decimals: Number(i.token!.decimals ?? 18) || 0,
      icon: i.token!.icon_url,
      marketUsd: i.token!.exchange_rate ? Number(i.token!.exchange_rate) || null : null,
    }));
}

type RpcOut = { id: number; result?: string; error?: unknown };

async function rpcBatch(calls: { method: string; params: unknown[] }[]): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(calls.length).fill(null);
  for (let start = 0; start < calls.length; start += 60) {
    const chunk = calls.slice(start, start + 60).map((c, i) => ({ jsonrpc: "2.0", id: start + i, ...c }));
    const r = await fetch("/api/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(chunk), cache: "no-store" });
    if (!r.ok) throw new Error(`rpc ${r.status}`);
    const res = (await r.json()) as RpcOut[] | RpcOut;
    // ids are positions; anything without a result stays null (= unknown this round)
    for (const x of Array.isArray(res) ? res : [res]) if (typeof x?.id === "number" && typeof x.result === "string") out[x.id] = x.result;
  }
  return out;
}

/** ETH + every token's balance, read from the latest block. */
async function readBalances(owner: string, tokens: string[]) {
  const data = "0x70a08231" + owner.slice(2).toLowerCase().padStart(64, "0"); // balanceOf(owner)
  const res = await rpcBatch([
    { method: "eth_blockNumber", params: [] },
    { method: "eth_getBalance", params: [owner, "latest"] },
    ...tokens.map((to) => ({ method: "eth_call", params: [{ to, data }, "latest"] })),
  ]);
  const big = (v: string | null) => (v && v !== "0x" ? BigInt(v.length > 66 ? v.slice(0, 66) : v) : null);
  const balances = new Map<string, bigint>();
  tokens.forEach((t, i) => {
    const b = big(res[i + 2]);
    if (b !== null) balances.set(t, b);
  });
  return { block: res[0] ? Number(BigInt(res[0])) : null, eth: big(res[1]), balances };
}

function toAmount(raw: bigint, decimals: number) {
  if (decimals === 0) return Number(raw);
  const base = 10n ** BigInt(decimals);
  return Number(raw / base) + Number(raw % base) / Number(base);
}

/**
 * Live holdings for `owner`. `known` = extra tokens always checked on chain
 * (the ZEEP registry), so a fresh ZEEP coin shows even before Blockscout
 * indexes the transfer.
 */
export function useHoldings(owner: string | null, known: TokenMeta[] = []): HoldingsState {
  const [state, setState] = React.useState<HoldingsState>({
    holdings: null,
    ethWei: null,
    ethUsd: 0,
    block: null,
    updatedAt: null,
    discoveryFailed: false,
    changed: new Set(),
  });

  const knownKey = known.map((k) => k.address).join(",");
  const knownRef = React.useRef(known);
  knownRef.current = known;

  React.useEffect(() => {
    if (!owner) return;
    let alive = true;
    const metas = new Map<string, TokenMeta>();
    const prices = new Map<string, { usd: number; source: "pons" | "market" } | null>();
    const art = new Map<string, string[]>(); // Pons artwork URLs per coin
    let balances = new Map<string, bigint>();
    let eth: bigint | null = null;
    let ethUsd = 0;
    let block: number | null = null;
    let discoveryFailed = false;
    let readBusy = false;
    let lastTickId = "";
    let changed = new Set<string>();
    const lower = owner.toLowerCase();

    for (const k of knownRef.current) metas.set(k.address, k);

    const publish = (fresh: boolean) => {
      if (!alive || !fresh) return;
      const holdings: Holding[] = [];
      for (const [addr, raw] of balances) {
        if (raw <= 0n) continue;
        const m = metas.get(addr);
        if (!m) continue;
        const amount = toAmount(raw, m.decimals);
        const p = prices.get(addr) ?? null;
        const icons = [...new Set([m.icon, ...(art.get(addr) ?? []), m.altIcon].filter((u): u is string => !!u))];
        holdings.push({ ...m, icons, raw, amount, priceUsd: p?.usd ?? null, valueUsd: p ? p.usd * amount : null, priceSource: p?.source ?? null });
      }
      // most valuable first; unpriced tokens after, by amount
      holdings.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1) || b.amount - a.amount);
      setState({ holdings, ethWei: eth, ethUsd, block, updatedAt: Date.now(), discoveryFailed, changed });
    };

    async function readNow() {
      if (readBusy) return;
      readBusy = true;
      try {
        const res = await readBalances(owner!, [...metas.keys()]);
        if (!alive) return;
        // never let an older block overwrite a newer one (RPC failover can lag)
        if (block !== null && res.block !== null && res.block < block) return;
        changed = new Set();
        if (eth !== null && res.eth !== null && res.eth !== eth) changed.add("eth");
        for (const [t, b] of res.balances) if (balances.has(t) && balances.get(t) !== b) changed.add(t);
        // merge, don't replace: a call that failed this round (RPC hiccup, rate
        // limit) keeps its last known balance instead of vanishing from the list
        balances = new Map([...balances, ...res.balances]);
        if (res.eth !== null) eth = res.eth;
        block = res.block ?? block;
        publish(true);
        void pricesFor([...balances].filter(([, b]) => b > 0n).map(([t]) => t), false);
      } catch {
        // keep showing the last good read; the next tick retries
      } finally {
        readBusy = false;
      }
    }

    async function discoverNow() {
      try {
        const found = await discover(owner!);
        discoveryFailed = false;
        let added = false;
        for (const m of found) {
          const prev = metas.get(m.address);
          if (!prev) added = true;
          // registry metadata (ZEEP logo) wins over the indexes'; rate + Alchemy logo come from them
          metas.set(m.address, prev ? { ...m, ...prev, icon: prev.icon ?? m.icon, altIcon: m.altIcon ?? prev.altIcon, marketUsd: m.marketUsd ?? prev.marketUsd } : m);
          if (m.marketUsd && prices.get(m.address)?.source === "market") prices.set(m.address, { usd: m.marketUsd, source: "market" });
        }
        if (added) await readNow();
      } catch {
        discoveryFailed = true;
      }
    }

    async function pricesFor(tokens: string[], refresh: boolean) {
      // refresh re-reads Pons coins (their price moves every trade); everything else is looked up once
      const todo = tokens.filter((t) => !prices.has(t) || (refresh && prices.get(t)?.source === "pons"));
      for (let i = 0; i < todo.length; i += 4) {
        await Promise.all(
          todo.slice(i, i + 4).map(async (t) => {
            const l = await ponsLaunch(t).catch(() => null);
            const m = metas.get(t);
            if (l && !l.simulated && l.artwork) art.set(t, ponsArtwork(l.artwork));
            if (l && l.priceUsd > 0 && !l.simulated) {
              prices.set(t, { usd: l.priceUsd, source: "pons" });
              if (l.quoteUsd > 0) ethUsd = l.quoteUsd;
            } else if (m?.marketUsd) prices.set(t, { usd: m.marketUsd, source: "market" });
            else prices.set(t, null);
          }),
        );
        if (!alive) return;
      }
      if (todo.length) publish(true);
    }

    async function watchTicks() {
      const t = await ponsTicks();
      if (!alive || !t) return;
      const mine = t.ticks.filter((x) => x.trader?.toLowerCase() === lower && x.id !== lastTickId);
      if (mine.length) {
        lastTickId = mine[mine.length - 1].id;
        // a trade of ours just landed: refresh amounts now, and look for a new token
        await readNow();
        void discoverNow();
        void pricesFor([...balances.keys()], true);
      }
    }

    fetch("/api/pons?view=ethusd")
      .then((r) => r.json())
      .then((j: { usd?: number }) => {
        if (!ethUsd && j.usd) ethUsd = j.usd;
        publish(true);
      })
      .catch(() => {});

    void (async () => {
      await discoverNow();
      await readNow();
    })();

    const every = (ms: number, fn: () => unknown) =>
      window.setInterval(() => {
        if (!document.hidden) void fn();
      }, ms);
    const timers = [
      every(BALANCE_MS, readNow),
      every(DISCOVER_MS, discoverNow),
      every(TICKS_MS, watchTicks),
      every(PRICE_MS, () => pricesFor([...balances].filter(([, b]) => b > 0n).map(([t]) => t), true)),
    ];
    const onVisible = () => {
      if (!document.hidden) void readNow();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      timers.forEach(clearInterval);
      document.removeEventListener("visibilitychange", onVisible);
      setState({ holdings: null, ethWei: null, ethUsd: 0, block: null, updatedAt: null, discoveryFailed: false, changed: new Set() });
    };
    // knownKey: restart when the registry list changes, not on every render
  }, [owner, knownKey]);

  return state;
}
