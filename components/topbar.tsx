"use client";

import * as React from "react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { IconMenu2 } from "@tabler/icons-react";
import { mobileSidebarStore } from "@/lib/mobileSidebarStore";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { short } from "@/lib/format";
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
        <IconMenu2 className="size-[18px]" stroke={1.75} />
      </button>
      <Link href="/" className={cn("flex items-center gap-2 rounded-[var(--primitive-radius-control-sm,0.5rem)] font-display text-[17px] font-bold", focusRing)}>
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[var(--primary)] to-[#9fcb2a] text-[16px] font-bold text-[var(--primary-foreground)]">
          Z
        </span>
        ZEEP
      </Link>
      <button
        type="button"
        onClick={openWallet}
        className={cn(
          "flex min-h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold",
          focusRing,
          !wallet.connected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)]",
        )}
      >
        <span className={wallet.connected ? "font-mono-tabular" : ""}>{label}</span>
      </button>
    </header>
  );
}
