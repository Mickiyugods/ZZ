"use client";

import * as React from "react";
import Link from "next/link";
import { listCoins, type CoinRow } from "@/lib/api";
import { fmtEth, fmtInt, short } from "@/lib/format";
import { CoinCard, CoinCardSkeleton } from "@/components/coin-card";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { ethBalance } from "@/lib/chain";
import { CHAIN } from "@/lib/config";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export default function ProfilePage() {
  const wallet = useWallet();
  const [rows, setRows] = React.useState<CoinRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [balance, setBalance] = React.useState<string | null>(null);


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

  React.useEffect(() => {
    if (!wallet.connected || !wallet.address) {
      setBalance(null);
      return;
    }
    setBalance(null);
    ethBalance(wallet.address)
      .then((wei) => setBalance(`${(Number(wei) / 1e18).toFixed(4)} ETH`))
      .catch(() => setBalance("—"));
  }, [wallet.connected, wallet.address]);

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

  if (!wallet.connected) {
    return (
      <section className="mx-auto max-w-[1180px] px-6 py-16 text-center">
        <h1 className="text-[34px] sm:text-[46px]">Your profile</h1>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[var(--muted-foreground)]">
          Connect a wallet to see the coins and collections you&apos;ve launched on ZEEP.
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

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pb-8 pt-14">
        <h1 className="text-[34px] sm:text-[46px]">Your profile</h1>
        <div className="mt-5 flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[13px] text-[var(--muted-foreground)]">
              {wallet.onChain ? CHAIN.name : `Wrong network — switch to ${CHAIN.name}`}
            </div>
            <div className="mt-1.5 font-mono-tabular text-[18px]">{short(wallet.address)}</div>
            <div className="mt-1 font-mono-tabular text-[var(--muted-foreground)]">{balance ?? "Balance …"}</div>
          </div>
          <div className="flex gap-6 sm:text-right">
            <div>
              <div className="font-mono-tabular text-[22px] font-semibold text-[var(--primary)]">
                {rows ? fmtInt(rows.length) : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">Coins launched</div>
            </div>
            <div>
              <div className="font-mono-tabular text-[22px] font-semibold text-[var(--primary)]">
                {totals ? fmtEth(totals.vault) : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">ETH in reserves</div>
            </div>
            <div>
              <div className="font-mono-tabular text-[22px] font-semibold text-[var(--primary)]">
                {totals ? fmtInt(totals.nfts) : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">NFTs held</div>
            </div>
          </div>
        </div>
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
