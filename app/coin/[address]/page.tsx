"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { ethers } from "ethers";
import { listCoins, listVaultEvents, runKeeperNow, type CoinRow, type VaultEvent } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { useToast } from "@/lib/toast";
import * as chain from "@/lib/chain";
import { DEFAULT_SLIPPAGE, SLIPPAGE_OPTIONS } from "@/lib/config";
import { short, fmtEth, fmtInt, timeAgo, policyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OnChainState {
  curve: string;
  graduated: boolean;
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
      setAmount("");
      setQuote(null);
    } catch (err) {
      const e = err as { code?: number | string; message?: string };
      toast(e?.code === 4001 || e?.code === "ACTION_REJECTED" ? "Transaction rejected" : e.message || "Trade failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (row === undefined) {
    return <div className="mx-auto max-w-[1180px] px-6 py-16 text-[var(--muted-foreground)]">Loading coin…</div>;
  }
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

  return (
    <>
      <section className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-4 px-6 pb-6 pt-10">
        <div className="size-14 rounded-2xl border border-[var(--border)] bg-[var(--card)]" />
        <div>
          <h1 className="text-[28px]">
            {row.name} <span className="font-mono-tabular text-[18px] text-[var(--muted-foreground)]">${row.symbol}</span>
          </h1>
          <div className="mt-1 font-mono-tabular text-[13px] text-[var(--muted-foreground)]">
            {short(row.token)} · {row.chain}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-6 px-6 pb-20 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Panel
            title="Reserve"
            action={
              <span className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                Simulated
              </span>
            }
          >
            <PanelRow label="Reserve balance" value={`${fmtEth(row.vault_eth)} ETH`} />
            <PanelRow label="NFTs held" value={fmtInt(row.nfts_held)} />
            <PanelRow label="Fees awaiting harvest" value={`${fmtEth(row.fees_awaiting)} ETH`} />
            <PanelRow label="Collects" value={row.collection_name} />
            <PanelRow label="Outcome" value={policyLabel(row.policy)} />
            <PanelRow label="Marketplace" value="Seaport 1.6 only" last />
            <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
              This reserve is reading real on-chain fee data, but purchases and draws are logged, not executed — no real ETH has
              moved yet.
            </p>
          </Panel>

          <Panel
            title="Reserve activity"
            className="mt-5"
            action={
              process.env.NODE_ENV !== "production" ? (
                <button
                  type="button"
                  onClick={doRunKeeper}
                  disabled={keeperBusy}
                  className={cn(
                    "rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold hover:border-[var(--primary)] disabled:opacity-50",
                    focusRing,
                  )}
                >
                  {keeperBusy ? "Running…" : "Run keeper now"}
                </button>
              ) : undefined
            }
          >
            {events === null ? (
              <div className="py-6 text-center text-[var(--muted-foreground)]">Loading…</div>
            ) : events.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-10 text-center text-[var(--muted-foreground)]">
                No reserve activity yet. Fees harvest automatically once this coin has real trades.
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {events.map((e, i) => (
                  <li key={e.id ?? i} className="flex items-start justify-between gap-3 border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] py-3 text-[13px] last:border-0">
                    <span>
                      <span className="font-semibold">{eventLabel(e)}</span>
                      {e.winner && <span className="block font-mono-tabular text-[12px] text-[var(--muted-foreground)]">to {short(e.winner)}</span>}
                      {e.type === "draw" && !e.winner && <span className="block text-[12px] text-[var(--muted-foreground)]">no buyers yet — winner pending</span>}
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">{timeAgo(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="About" className="mt-5">
            <p className="text-[14px] leading-relaxed text-[var(--muted-foreground)]">{row.description || "No description provided."}</p>
            <PanelRow label="Deployer" value={short(row.deployer)} />
            <PanelRow label="Launched" value={new Date(row.launched_at).toLocaleDateString()} last />
          </Panel>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
          {!onChain ? (
            <>
              <h2 className="mb-4 text-[16px] font-semibold">Trade</h2>
              <p className="text-[13px] text-[var(--muted-foreground)]">Live curve data is unavailable right now.</p>
            </>
          ) : (
            <>
              <div role="tablist" aria-label="Trade side" className="mb-4 flex gap-1 rounded-full border border-[var(--border)] p-1">
                {(["buy", "sell"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => { setTab(t); setAmount(""); setQuote(null); }}
                    className={cn(
                      "min-h-11 flex-1 rounded-full py-2 text-[13px] font-semibold capitalize",
                      focusRing,
                      tab === t ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label htmlFor="trade-amount" className="mb-2 block text-[13px] font-semibold">
                {tab === "buy" ? "You pay (ETH)" : "You sell (tokens)"}
              </label>
              <input
                id="trade-amount"
                type="number"
                inputMode="decimal"
                min={0}
                className={cn("input", focusRing)}
                placeholder="0.0"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
              />
              <span id="slippage-label" className="mb-2 mt-4 block text-[13px] font-semibold">
                Slippage
              </span>
              <div role="group" aria-labelledby="slippage-label" className="flex flex-wrap gap-2">
                {SLIPPAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    aria-pressed={slippage === s}
                    onClick={() => setSlippage(s)}
                    className={cn(
                      "flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--muted-foreground)]",
                      focusRing,
                      slippage === s && "border-[var(--primary)] bg-[rgba(255,255,255,.08)] text-[var(--primary)]",
                    )}
                  >
                    {s}%
                  </button>
                ))}
              </div>
              <div className="my-3 font-mono-tabular text-[13px] text-[var(--muted-foreground)]" aria-live="polite">
                {quote ? `Est. ${quote}` : ""}
              </div>
              {!wallet.connected ? (
                <button
                  onClick={openWallet}
                  className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)]", focusRing)}
                >
                  Connect wallet
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={doTrade}
                  aria-busy={busy}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold capitalize text-[var(--primary-foreground)] disabled:opacity-50",
                    focusRing,
                  )}
                >
                  {busy ? "Working…" : tab}
                </button>
              )}
              {onChain.graduated && <p className="mt-2.5 text-[12px] text-[var(--muted-foreground)]">This coin graduated — trade it on Pons directly.</p>}
            </>
          )}
        </div>
      </section>
    </>
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

function eventLabel(e: VaultEvent) {
  if (e.type === "harvest") return `Harvested ${fmtEth(e.amount_eth ?? 0, 5)} ETH in fees`;
  if (e.type === "purchase") return `Bought ${e.nft_label} for ${fmtEth(e.amount_eth ?? 0)} ETH`;
  return `Drew a winner for ${e.nft_label}`;
}

function PanelRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-3 text-[13px]", !last && "border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)]")}>
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
