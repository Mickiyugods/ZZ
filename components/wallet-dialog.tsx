"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { IconX } from "@tabler/icons-react";
import { walletDialogStore } from "@/lib/walletDialogStore";
import { useWallet } from "@/lib/useWallet";
import { DEMO_WALLET_ENABLED, PRIVY_ENABLED } from "@/lib/wallet";
import { walletIdentity } from "@/lib/identity";
import { WalletAvatar } from "@/components/wallet-avatar";
import { ethBalance } from "@/lib/chain";
import { short } from "@/lib/format";
import { CHAIN } from "@/lib/config";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function subscribe(cb: () => void) {
  walletDialogStore.addEventListener("change", cb);
  return () => walletDialogStore.removeEventListener("change", cb);
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const btnBase = cn("flex min-h-11 w-full items-center justify-center rounded-full px-5 text-[14px] font-semibold", focusRing);

export function WalletDialog() {
  const open = useSyncExternalStore(subscribe, () => walletDialogStore.open, () => false);
  const wallet = useWallet();
  const toast = useToast();
  const [balance, setBalance] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = "wallet-dialog-title";

  React.useEffect(() => {
    if (!open || !wallet.connected || !wallet.address) return;
    setBalance(null);
    ethBalance(wallet.address)
      .then((wei) => setBalance(`${(Number(wei) / 1e18).toFixed(4)} ETH`))
      .catch(() => setBalance("—"));
  }, [open, wallet.connected, wallet.address]);

  const close = React.useCallback(() => walletDialogStore.hide(), []);

  // dev-only demo wallet survives reloads (no-op unless DEMO_WALLET_ENABLED)
  React.useEffect(() => wallet.restoreDemo(), [wallet]);

  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;

  function connect() {
    close();
    try {
      wallet.connect();
    } catch {
      toast("Wallet connect isn't ready yet — try again in a moment", "error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-[380px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-[22px] outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close dialog"
          className={cn("absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]", focusRing)}
        >
          <IconX className="size-[18px]" stroke={1.75} />
        </button>

        {wallet.connected && wallet.address ? (
          <>
            <h3 id={titleId} className="mb-4 pr-8 text-[17px] font-semibold">
              Your wallet
            </h3>
            <div className="mb-4 flex items-center gap-3.5">
              <WalletAvatar address={wallet.address} size={60} />
              <div className="min-w-0">
                <div className="truncate font-display text-[18px] font-bold leading-tight">{walletIdentity(wallet.address).name}</div>
                <div className="mt-0.5 font-mono-tabular text-[13px] text-[var(--muted-foreground)]">{short(wallet.address)}</div>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between gap-3 rounded-[calc(var(--radius)-4px)] border border-[var(--border)] px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                {wallet.onChain ? CHAIN.name : `Wrong network — switch to ${CHAIN.name}`}
                {wallet.demo && (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold">Demo · read-only</span>
                )}
              </div>
              <div className="shrink-0 font-mono-tabular text-[14px]">{balance ?? "…"}</div>
            </div>
            {!wallet.onChain && (
              <button
                type="button"
                className={cn(btnBase, "mb-2 bg-[var(--primary)] text-[var(--primary-foreground)]")}
                onClick={async () => {
                  try {
                    await wallet.ensureChain();
                    close();
                  } catch (err) {
                    toast((err as Error).message, "error");
                  }
                }}
              >
                Switch to Robinhood Chain
              </button>
            )}
            <Link
              href="/profile"
              onClick={close}
              className={cn(btnBase, "mb-2", wallet.onChain ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#e5e5e5]" : "border border-[var(--border)]")}
            >
              View profile
            </Link>
            <button
              type="button"
              className={cn(btnBase, "mb-2 border border-[var(--border)]")}
              onClick={() => {
                navigator.clipboard?.writeText(wallet.address!).then(() => toast("Address copied", "success")).catch(() => {});
              }}
            >
              Copy address
            </button>
            <button
              type="button"
              className={cn(btnBase, "border border-[var(--border)]")}
              onClick={() => {
                wallet.disconnect();
                close();
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <h3 id={titleId} className="mb-3.5 pr-8 text-[17px] font-semibold">
              Connect a wallet
            </h3>
            <p className="mb-3.5 text-[13px] text-[var(--muted-foreground)]">
              ZEEP runs on {CHAIN.name}. Connect a browser wallet or sign in with email — Privy will prompt to add or switch network if needed.
            </p>
            {PRIVY_ENABLED ? (
              <button
                type="button"
                className={cn(btnBase, "bg-[var(--primary)] text-[var(--primary-foreground)]")}
                onClick={connect}
                disabled={!wallet.ready}
              >
                {wallet.ready ? "Connect" : "Loading…"}
              </button>
            ) : DEMO_WALLET_ENABLED ? (
              <>
                <button
                  type="button"
                  className={cn(btnBase, "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#e5e5e5]")}
                  onClick={() => {
                    wallet.connectDemo();
                    toast("Demo wallet connected", "success");
                  }}
                >
                  Connect demo wallet
                </button>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                  Dev preview only: Privy isn&apos;t configured (<code className="font-mono-tabular">NEXT_PUBLIC_PRIVY_APP_ID</code>), so this connects a read-only demo wallet. It can&apos;t sign anything.
                </p>
              </>
            ) : (
              <button type="button" className={cn(btnBase, "cursor-not-allowed border border-[var(--border)] text-[var(--muted-foreground)]")} disabled>
                Wallet connect unavailable
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
