"use client";

import * as React from "react";
import Link from "next/link";
import { CHAIN, PONS, SEAPORT_1_6 } from "@/lib/config";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const GITHUB_SRC = "https://github.com/Mickiyugods/ZZ/blob/main/contracts/src";

interface LiveContract {
  name: string;
  address: string;
  note: string;
}

const LIVE_CONTRACTS: LiveContract[] = [
  { name: "Pons Factory", address: PONS.factory, note: "Launches every Pons coin, ZEEP's included" },
  { name: "Pons Router", address: PONS.router, note: "Launch-and-buy in one transaction" },
  { name: "Pons Escrow", address: PONS.escrow, note: "Holds claimable creator fees the reserve harvest reads" },
  { name: "Seaport 1.6", address: SEAPORT_1_6, note: "Canonical deployer address — same on every EVM chain, not deployed by ZEEP or Vaul" },
];

interface PendingContract {
  name: string;
  file: string;
  role: string;
}

const PENDING_CONTRACTS: PendingContract[] = [
  { name: "ZeepLauncher", file: "ZeepLauncher.sol", role: "One-tx launcher for Robinhood Chain collections — launches the coin, deploys Vault + FeeRouter + Raffle, wires them together" },
  { name: "ZeepExternalLauncher", file: "ZeepExternalLauncher.sol", role: "Same, for collections that don't live on Robinhood Chain (Courtyard, Collector Crypt)" },
  { name: "ZeepVault", file: "ZeepVault.sol", role: "Holds a coin's reserve share, Seaport-1.6-gated buy, no raw withdraw" },
  { name: "ZeepExternalVault", file: "ZeepExternalVault.sol", role: "Cross-chain variant — Announce → wait 1 hour → Execute, with owner-cancel" },
  { name: "ZeepFeeRouter", file: "ZeepFeeRouter.sol", role: "A coin's Pons creatorFeeRecipient; anyone can harvest() to split fees 80/20" },
  { name: "ZeepRaffle", file: "ZeepRaffle.sol", role: "Commit-reveal draw against a future block hash, weighted by holder balance" },
  { name: "ZeepExternalRaffle", file: "ZeepExternalRaffle.sol", role: "Cross-chain variant, records an off-chain delivery as an on-chain receipt" },
];

function CopyAddress({ address }: { address: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address).then(() => toast("Address copied", "success")).catch(() => {});
      }}
      className={cn("font-mono-tabular text-[13px] text-[var(--foreground)] underline-offset-2 hover:underline", focusRing)}
      title={address}
    >
      {address.slice(0, 10)}…{address.slice(-8)}
    </button>
  );
}

export default function ContractsPage() {
  React.useEffect(() => {
    document.title = "Contracts · ZEEP";
  }, []);

  return (
    <section className="mx-auto max-w-[860px] px-6 pb-20 pt-14">
      <h1 className="text-[38px]">Contracts</h1>
      <p className="mt-2.5 max-w-[560px] text-[var(--muted-foreground)]">
        Every address ZEEP's coins actually touch on {CHAIN.name}, and the status of ZEEP's own reserve contracts.
      </p>

      <div className="mt-8">
        <h2 className="text-[20px]">External infrastructure</h2>
        <p className="mt-1.5 text-[14px] text-[var(--muted-foreground)]">
          Shared public contracts ZEEP reads from or launches through — not deployed by ZEEP.
        </p>
        <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          {LIVE_CONTRACTS.map((c, i) => (
            <div
              key={c.name}
              className={cn("flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between", i > 0 && "border-t border-[var(--border)]")}
            >
              <div>
                <div className="text-[14px] font-semibold">{c.name}</div>
                <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">{c.note}</div>
              </div>
              <div className="flex items-center gap-3">
                <CopyAddress address={c.address} />
                <a
                  href={`${CHAIN.explorer}/address/${c.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("text-[12px] font-semibold text-[var(--primary)] hover:underline", focusRing)}
                >
                  Explorer ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-[20px]">ZEEP's reserve contracts</h2>
        <p className="mt-1.5 text-[14px] text-[var(--muted-foreground)]">
          Built and tested (28/28 passing) — not audited, not deployed anywhere real, no keeper wallet funded. Every coin's
          Vault, FeeRouter and Raffle are deployed fresh per launch by one of the two launchers below, so there's no single
          standing address to show even once this ships. Until then, the site runs the Phase 1.5 simulation described in{" "}
          <Link href="/docs" className="text-[var(--primary)] hover:underline">
            Docs
          </Link>
          .
        </p>
        <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          {PENDING_CONTRACTS.map((c, i) => (
            <div
              key={c.name}
              className={cn("flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between", i > 0 && "border-t border-[var(--border)]")}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-[14px] font-semibold">{c.name}</span>
                  <span className="rounded-full border border-[var(--border)] px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Not deployed
                  </span>
                </div>
                <div className="mt-0.5 max-w-[480px] text-[12px] text-[var(--muted-foreground)]">{c.role}</div>
              </div>
              <a
                href={`${GITHUB_SRC}/${c.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("shrink-0 text-[12px] font-semibold text-[var(--primary)] hover:underline", focusRing)}
              >
                Source ↗
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
