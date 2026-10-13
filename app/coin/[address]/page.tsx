"use client";

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { ethers } from "ethers";
import { IconCopy, IconExternalLink, IconCoins, IconShoppingBag, IconTicket, IconPhoto } from "@tabler/icons-react";
import { listCoins, listVaultEvents, runKeeperNow, type CoinRow, type VaultEvent } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { useToast } from "@/lib/toast";
import * as chain from "@/lib/chain";
import { CHAIN, DEFAULT_SLIPPAGE, SLIPPAGE_OPTIONS } from "@/lib/config";
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

  // Coins are always Pons launches on Robinhood Chain itself — `row.chain` is
  // the *paired collection's* chain (it can be Ethereum/Base/Polygon/Solana/
  // Robinhood), a separate thing from where this token's own contract lives.
  const explorerUrl = `${CHAIN.explorer}/address/${row.token}`;
  const latestDraw = events?.find((e) => e.type === "draw") ?? null;
  const latestPurchase = events?.find((e) => e.type === "purchase") ?? null;

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pt-8">
        <Link href="/explore" className={cn("inline-flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]", focusRing)}>
          ← Back to Explore
        </Link>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pb-6 pt-4">
        <div className="flex flex-wrap items-center gap-4">
          {row.logo ? (
            <img src={row.logo} alt="" className="size-14 shrink-0 rounded-2xl border border-[var(--border)] object-cover" />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[18px] font-bold text-[var(--muted-foreground)]">
              {row.symbol.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[28px]">
              {row.name} <span className="font-mono-tabular text-[18px] text-[var(--muted-foreground)]">${row.symbol}</span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1.5 font-mono-tabular">
                {short(row.token)}
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(row.token).then(() => toast("Address copied", "success")).catch(() => {})}
                  aria-label="Copy contract address"
                  className={cn("text-[var(--muted-foreground)] hover:text-[var(--foreground)]", focusRing)}
                >
                  <IconCopy className="size-[14px]" stroke={1.75} />
                </button>
              </span>
              <span>·</span>
              <span>{CHAIN.name}</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className={cn("flex items-center gap-1 text-[var(--foreground)] hover:underline", focusRing)}
              >
                View on Explorer <IconExternalLink className="size-[13px]" stroke={1.75} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Launched by {short(row.deployer)}</Badge>
          <Badge>{row.collection_name}</Badge>
          <Badge>{policyLabel(row.policy)}</Badge>
          <Badge emphasis>Simulated</Badge>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pb-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.14)] sm:grid-cols-4">
          <StatCard label="Reserve balance" value={`${fmtEth(row.vault_eth)} ETH`} />
          <StatCard label="NFTs held" value={fmtInt(row.nfts_held)} />
          <StatCard label="Fees awaiting harvest" value={`${fmtEth(row.fees_awaiting)} ETH`} />
          <StatCard label="Outcome" value={policyLabel(row.policy)} />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-6 px-6 pb-20 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Panel
            title="Reserve"
            action={<Badge emphasis>Simulated</Badge>}
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
                  <li key={e.id ?? i} className="flex items-start gap-3 border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] py-3 text-[13px] last:border-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
                      <EventIcon type={e.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold">{eventLabel(e)}</span>
                        {e.simulated && (
                          <span className="rounded-full border border-[var(--border)] px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                            Simulated
                          </span>
                        )}
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

          <Panel title="About" className="mt-5">
            <p className="text-[14px] leading-relaxed text-[var(--muted-foreground)]">{row.description || "No description provided."}</p>
            <PanelRow label="Deployer" value={short(row.deployer)} />
            <PanelRow label="Contract address" value={short(row.token)} />
            <PanelRow label="Network" value={CHAIN.name} />
            <PanelRow label="Launched" value={new Date(row.launched_at).toLocaleDateString()} last />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
            {!onChain ? (
              <>
                <h2 className="mb-1 text-[16px] font-semibold">Trading unavailable</h2>
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  Live curve data for this coin isn&apos;t reachable right now, so buy/sell is turned off here. This never
                  invents a price or chart.
                </p>
                <div className="mt-4 flex h-28 items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--border)] text-[12px] text-[var(--muted-foreground)]">
                  Price chart — reserved for when live trading is available
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-4 text-[16px] font-semibold">Trade ${row.symbol}</h2>
                <div className="mb-4 flex h-24 items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--border)] text-[12px] text-[var(--muted-foreground)]">
                  Price chart — not wired up yet
                </div>
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

          <Panel title="NFT in reserve">
            {row.nfts_held > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                  <IconPhoto className="size-6" stroke={1.5} />
                </div>
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="font-semibold">{row.collection_name}</div>
                  {latestPurchase?.nft_label && <div className="font-mono-tabular text-[var(--muted-foreground)]">{latestPurchase.nft_label}</div>}
                  {latestPurchase?.amount_eth != null && (
                    <div className="mt-1 text-[12px] text-[var(--muted-foreground)]">Acquired for ≈ {fmtEth(latestPurchase.amount_eth)} ETH (simulated)</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-8 text-center text-[13px] text-[var(--muted-foreground)]">
                No NFTs acquired yet.
              </div>
            )}
            <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">Real artwork will show here once OpenSea API access is connected.</p>
          </Panel>

          <Panel title={row.policy === "raffle" ? "Raffle status" : "Outcome status"}>
            {row.policy === "raffle" ? (
              latestDraw ? (
                <div className="flex items-start gap-3 text-[13px]">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
                    <IconTicket className="size-[15px]" stroke={1.75} />
                  </span>
                  <span>
                    {latestDraw.winner ? (
                      <>
                        <span className="font-semibold">Winner drawn</span>
                        <span className="block font-mono-tabular text-[12px] text-[var(--muted-foreground)]">{short(latestDraw.winner)}</span>
                      </>
                    ) : (
                      <span className="font-semibold">No buyers yet — winner pending</span>
                    )}
                    <span className="block text-[12px] text-[var(--muted-foreground)]">{timeAgo(latestDraw.created_at)} · simulated</span>
                  </span>
                </div>
              ) : (
                <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-8 text-center text-[13px] text-[var(--muted-foreground)]">
                  Raffle not active yet.
                </div>
              )
            ) : row.policy === "hold" ? (
              <p className="text-[13px] text-[var(--muted-foreground)]">
                This reserve holds every NFT it acquires — no raffle is scheduled.
              </p>
            ) : (
              <p className="text-[13px] text-[var(--muted-foreground)]">
                This reserve burns every NFT it acquires once purchased — no raffle is scheduled.
              </p>
            )}
          </Panel>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--background)] px-5 py-4">
      <div className="font-mono-tabular text-[20px] font-bold leading-tight text-[var(--primary)]">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}

function Badge({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        emphasis ? "border-[var(--border)] bg-[var(--card)] uppercase tracking-wide text-[var(--muted-foreground)]" : "border-[var(--border)] text-[var(--foreground)]",
      )}
    >
      {children}
    </span>
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

function PanelRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-3 text-[13px]", !last && "border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)]")}>
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
