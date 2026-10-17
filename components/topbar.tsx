"use client";

import * as React from "react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BaselineDensityMediumIcon } from "@/components/icons/baseline-density-medium";
import { mobileSidebarStore } from "@/lib/mobileSidebarStore";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { short } from "@/lib/format";
import { walletIdentity } from "@/lib/identity";
import { WalletAvatar } from "@/components/wallet-avatar";
import { cn } from "@/lib/utils";

function subscribe(cb: () => void) {
  mobileSidebarStore.addEventListener("change", cb);
  return () => mobileSidebarStore.removeEventListener("change", cb);
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

export function Topbar() {
  const wallet = useWallet();
  const open = useSyncExternalStore(subscribe, () => mobileSidebarStore.open, () => false);
  const label = !wallet.connected ? "Connect wallet" : wallet.onChain ? short(wallet.address) : "Wrong network";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] px-4 backdrop-blur-md md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => mobileSidebarStore.toggle()}
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)]", focusRing)}
      >
        <BaselineDensityMediumIcon size={18} />
      </button>
      <Link href="/" className={cn("flex items-center gap-2 rounded-[var(--primitive-radius-control-sm,0.5rem)] font-display text-[17px] font-bold", focusRing)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/brand/zeep-logo.png" alt="ZEEP" decoding="async" className="size-8 object-contain" />
        ZEEP
      </Link>
      <button
        type="button"
        onClick={openWallet}
        aria-label={wallet.address ? `${walletIdentity(wallet.address).name} · ${label}` : undefined}
        className={cn(
          "flex min-h-11 items-center justify-center rounded-full text-[13px] font-semibold",
          focusRing,
          !wallet.connected ? "bg-[var(--primary)] px-4 text-[var(--primary-foreground)]" : "gap-2 border border-[var(--border)] py-1 pl-1 pr-3.5",
        )}
      >
        {wallet.address && <WalletAvatar address={wallet.address} size={34} />}
        <span className={wallet.connected ? "font-mono-tabular" : ""}>{label}</span>
      </button>
    </header>
  );
}
