"use client";

import * as React from "react";
import Link from "next/link";
import { IconCopy, IconCheck, IconExternalLink } from "@tabler/icons-react";
import { listCoins, type CoinRow } from "@/lib/api";
import { fmtEth, fmtInt, fmtUsd, fmtUsdCompact, short } from "@/lib/format";
import { CoinCard, CoinCardSkeleton } from "@/components/coin-card";
import { WalletAvatar } from "@/components/wallet-avatar";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { walletIdentity } from "@/lib/identity";
import { useHoldings, type Holding, type TokenMeta } from "@/lib/holdings";
import { ponsUrl } from "@/lib/pons";
import { CHAIN } from "@/lib/config";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

/** Token amounts: 171.29 · 134,896 · 12.4M · 0.0004521 */
function fmtAmount(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

const fmtValue = (usd: number) => (usd >= 1000 ? fmtUsdCompact(usd) : usd >= 0.01 || usd === 0 ? `$${usd.toFixed(2)}` : "<$0.01");

export default function ProfilePage() {
  const wallet = useWallet();
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [registry, setRegistry] = React.useState<CoinRow[]>([]);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      setRows(null);
      return;
    }
    setRows(null);
    setError(false);
    listCoins({ deployer: wallet.address })
      .then((data) => setRows(data.rows))
      .catch(() => setError(true));
  }, [wallet.connected, wallet.address]);

  // every ZEEP coin is always checked on chain, even before Blockscout indexes it
  React.useEffect(() => {
    listCoins()
      .then((d) => setRegistry(d.rows))
      .catch(() => {});
  }, []);
  const known = React.useMemo<TokenMeta[]>(
    () =>
      registry.map((r) => ({
        address: r.token.toLowerCase(),
        symbol: r.symbol,
        name: r.name,
        decimals: 18,
        icon: r.logo || null,
        marketUsd: null,
      })),
    [registry],
  );
  const zeepTokens = React.useMemo(() => new Set(known.map((k) => k.address)), [known]);

  const live = useHoldings(wallet.connected ? wallet.address : null, known);

  const collections = rows?.filter((r) => r.category === "pfp" || r.category === "art") ?? [];
  const cards = rows?.filter((r) => r.category === "cards") ?? [];
  const totals = rows?.reduce(
    (a, r) => {
      a.vault += r.vault_eth || 0;
      a.nfts += r.nfts_held || 0;
      return a;
    },
    { vault: 0, nfts: 0 },
  );

  if (!wallet.connected || !wallet.address) {
    return (
      <section className="mx-auto max-w-[1180px] px-6 py-16 text-center">
        <h1 className="text-[34px] sm:text-[46px]">Your profile</h1>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[var(--muted-foreground)]">
          Connect a wallet to see your tokens on {CHAIN.name} and the coins you&apos;ve launched on ZEEP.
        </p>
        <button
          type="button"
          onClick={openWallet}
          className={cn(
            "mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5]",
            focusRing,
          )}
        >
          Connect wallet
        </button>
      </section>
    );
  }

  const id = walletIdentity(wallet.address);
  const ethAmount = live.ethWei !== null ? Number(live.ethWei) / 1e18 : null;
  const ethValue = ethAmount !== null && live.ethUsd > 0 ? ethAmount * live.ethUsd : null;
  const tokensValue = live.holdings?.reduce((s, h) => s + (h.valueUsd ?? 0), 0) ?? null;
  const portfolio = ethValue !== null || tokensValue !== null ? (ethValue ?? 0) + (tokensValue ?? 0) : null;

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pb-8 pt-14">
        <h1 className="sr-only">Your profile</h1>
        <div className="zeep-rise flex flex-col gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <WalletAvatar address={wallet.address} size={80} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={cn("size-1.5 rounded-full", wallet.onChain ? "bg-[var(--primary)]" : "bg-[var(--destructive)]")} />
                  {wallet.onChain ? CHAIN.name : `Wrong network — switch to ${CHAIN.name}`}
                </span>
                {wallet.demo && <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold">Demo · read-only</span>}
              </div>
              <p className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[36px]">{id.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono-tabular text-[13px] text-[var(--muted-foreground)]">
                {short(wallet.address)}
                <button
                  type="button"
                  aria-label={copied ? "Address copied" : "Copy address"}
                  onClick={() => {
                    navigator.clipboard?.writeText(wallet.address!).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    });
                  }}
                  className={cn("flex size-8 items-center justify-center rounded-full transition-colors hover:text-[var(--foreground)]", focusRing)}
                >
                  {copied ? <IconCheck className="size-3.5" stroke={2} /> : <IconCopy className="size-3.5" stroke={1.75} />}
                </button>
                <a
                  href={`${CHAIN.explorer}/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View on the Robinhood Chain explorer (opens in a new tab)"
                  className={cn("flex size-8 items-center justify-center rounded-full transition-colors hover:text-[var(--foreground)]", focusRing)}
                >
                  <IconExternalLink className="size-3.5" stroke={1.75} />
                </a>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap lg:justify-end lg:text-right">
            <Stat label="Portfolio" value={portfolio !== null ? fmtValue(portfolio) : "—"} />
            <Stat label="ETH" value={ethAmount === null ? "—" : ethAmount > 0 && ethAmount < 0.0001 ? "<0.0001" : fmtEth(ethAmount, 4)} tick={live.changed.has("eth")} />
            <Stat label="Coins launched" value={rows ? fmtInt(rows.length) : "—"} />
            <Stat label="ETH in reserves" value={totals ? fmtEth(totals.vault) : "—"} />
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-6" aria-labelledby="holdings-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="holdings-title" className="text-[22px]">
              Holdings
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">Every token this wallet holds on {CHAIN.name}, read live from the chain.</p>
          </div>
          <LiveBadge block={live.block} updatedAt={live.updatedAt} />
        </div>

        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" aria-busy={live.holdings === null}>
          <div className="hidden grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr] gap-4 border-b border-[var(--border)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)] sm:grid">
            <span>Token</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Price</span>
            <span className="text-right">Value</span>
          </div>
          <ul>
            {ethAmount !== null && (
              <Row
                href={`${CHAIN.explorer}/address/${wallet.address}`}
                external
                icon={<EthMark />}
                name="Ether"
                symbol="ETH"
                amount={ethAmount}
                price={live.ethUsd || null}
                value={ethValue}
                tick={live.changed.has("eth")}
              />
            )}
            {live.holdings === null ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
            ) : (
              live.holdings.map((h) => (
                <HoldingRow key={h.address} h={h} zeep={zeepTokens.has(h.address)} tick={live.changed.has(h.address)} />
              ))
            )}
          </ul>
          {live.holdings !== null && live.holdings.length === 0 && (
            <p className="border-t border-[var(--border)] px-5 py-10 text-center text-[14px] text-[var(--muted-foreground)]">
              No tokens on {CHAIN.name} yet.{" "}
              <Link href="/explore" className="text-[var(--foreground)] underline-offset-4 hover:underline">
                Explore coins →
              </Link>
            </p>
          )}
        </div>
        {live.discoveryFailed && (
          <p role="status" className="mt-3 text-[12px] text-[var(--muted-foreground)]">
            The token index is unreachable right now, so only ZEEP coins and tokens already found are being checked. Balances shown are still live from the chain.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-10">
        <h2 className="mb-5 text-[22px]">Your NFT & art collections</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={rows === null}>
          {error ? (
            <div role="alert" className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[60px] text-center text-[var(--muted-foreground)]">
              Could not load your coins.
            </div>
          ) : rows === null ? (
            Array.from({ length: 3 }).map((_, i) => <CoinCardSkeleton key={i} />)
          ) : collections.length ? (
            collections.map((row) => <CoinCard key={row.token} row={row} />)
          ) : (
            <div className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[60px] text-center text-[var(--muted-foreground)]">
              No NFT or art coins launched yet.{" "}
              <Link href="/launch" className="text-[var(--primary)]">
                Launch one →
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pb-16">
        <h2 className="mb-5 text-[22px]">Your card reserves</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={rows === null}>
          {error ? (
            <div role="alert" className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[60px] text-center text-[var(--muted-foreground)]">
              Could not load your coins.
            </div>
          ) : rows === null ? (
            Array.from({ length: 3 }).map((_, i) => <CoinCardSkeleton key={i} />)
          ) : cards.length ? (
            cards.map((row) => <CoinCard key={row.token} row={row} />)
          ) : (
            <div className="col-span-full rounded-[var(--radius)] border border-dashed border-[var(--border)] py-[60px] text-center text-[var(--muted-foreground)]">
              No card reserves launched yet.{" "}
              <Link href="/cards" className="text-[var(--primary)]">
                Launch a card reserve →
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, tick }: { label: string; value: string; tick?: boolean }) {
  return (
    // dt first for valid <dl> order; flex-col-reverse puts the number on top
    <div className="flex flex-col-reverse">
      <dt className="mt-0.5 whitespace-nowrap text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">{label}</dt>
      <dd key={tick ? value : undefined} className={cn("font-mono-tabular text-[20px] font-semibold sm:text-[22px]", tick && "zeep-tick")}>
        {value}
      </dd>
    </div>
  );
}

/** "Live · block 91,209,983 · 2s ago" — ticks every second so freshness is visible. */
function LiveBadge({ block, updatedAt }: { block: number | null; updatedAt: number | null }) {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const t = window.setInterval(force, 1000);
    return () => clearInterval(t);
  }, []);
  const age = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;
  const stale = age !== null && age > 20;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--muted-foreground)]" role="status" aria-live="off">
      <span className="relative flex size-2">
        {!stale && updatedAt && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--primary)] opacity-60 motion-reduce:hidden" />}
        <span className={cn("relative inline-flex size-2 rounded-full", updatedAt && !stale ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]")} />
      </span>
      {updatedAt === null ? (
        "Connecting to chain…"
      ) : (
        <>
          <span className="font-semibold text-[var(--foreground)]">{stale ? "Reconnecting" : "Live"}</span>
          {block !== null && <span className="font-mono-tabular">block {block.toLocaleString("en-US")}</span>}
          <span className="font-mono-tabular">· {age}s ago</span>
        </>
      )}
    </div>
  );
}

function HoldingRow({ h, zeep, tick }: { h: Holding; zeep: boolean; tick: boolean }) {
  const href = zeep ? `/coin/${h.address}` : h.priceSource === "pons" ? ponsUrl(h.address) : `${CHAIN.explorer}/token/${h.address}`;
  return (
    <Row
      href={href}
      external={!zeep}
      icon={<TokenIcon srcs={h.icons} symbol={h.symbol} />}
      name={h.name}
      symbol={h.symbol}
      badge={zeep ? "ZEEP" : h.priceSource === "pons" ? "Pons" : null}
      amount={h.amount}
      price={h.priceUsd}
      value={h.valueUsd}
      tick={tick}
    />
  );
}

function Row(props: {
  href: string;
  external?: boolean;
  icon: React.ReactNode;
  name: string;
  symbol: string;
  badge?: string | null;
  amount: number;
  price: number | null;
  value: number | null;
  tick?: boolean;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        {props.icon}
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{props.name}</span>
            {props.badge && (
              <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 py-px text-[10px] font-semibold text-[var(--muted-foreground)]">{props.badge}</span>
            )}
          </span>
          <span className="block truncate font-mono-tabular text-[12px] text-[var(--muted-foreground)]">${props.symbol}</span>
        </span>
      </span>
      <span key={props.tick ? props.amount : undefined} className={cn("text-right font-mono-tabular text-[14px]", props.tick && "zeep-tick")}>
        {fmtAmount(props.amount)}
        <span className="block text-[12px] text-[var(--muted-foreground)] sm:hidden">{props.value !== null ? fmtValue(props.value) : "—"}</span>
      </span>
      <span className="hidden text-right font-mono-tabular text-[13px] text-[var(--muted-foreground)] sm:block">{props.price ? (props.price >= 1 ? `$${props.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : fmtUsd(props.price)) : "—"}</span>
      <span className="hidden text-right font-mono-tabular text-[14px] sm:block">{props.value !== null ? fmtValue(props.value) : "—"}</span>
    </>
  );
  const cls = cn(
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr]",
    focusRing,
  );
  return (
    <li className="border-t border-[var(--border)] first:border-t-0">
      {props.external ? (
        <a href={props.href} target="_blank" rel="noopener noreferrer" className={cls}>
          {body}
        </a>
      ) : (
        <Link href={props.href} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="flex items-center gap-3 border-t border-[var(--border)] px-5 py-3.5 first:border-t-0">
      <span className="size-9 animate-pulse rounded-full bg-[var(--border)]" />
      <span className="h-3.5 w-32 animate-pulse rounded bg-[var(--border)]" />
      <span className="ml-auto h-3.5 w-20 animate-pulse rounded bg-[var(--border)]" />
    </li>
  );
}

/** Tries each logo URL in turn (a dead IPFS link falls through to the next),
 * then a monogram if none load. */
function TokenIcon({ srcs, symbol }: { srcs: string[]; symbol: string }) {
  const [failed, setFailed] = React.useState(0);
  const src = srcs[failed];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        key={src}
        src={src}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        onError={() => setFailed((n) => n + 1)}
        className="size-9 shrink-0 rounded-full border border-[var(--border)] bg-black object-cover"
      />
    );
  }
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[#141414] font-display text-[13px] font-bold">
      {(symbol.replace(/[^a-z0-9]/gi, "")[0] || "?").toUpperCase()}
    </span>
  );
}

function EthMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/tokens/eth.webp" alt="" width={36} height={36} className="size-9 shrink-0 rounded-full border border-[var(--border)] bg-[#141414] object-contain p-1.5" />
  );
}
