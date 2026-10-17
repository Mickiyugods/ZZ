"use client";

import * as React from "react";
import Link from "next/link";
import { CHAIN, PONS, SEAPORT_1_6, ZEEP_DEPLOYMENT } from "@/lib/config";
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
  { name: "Seaport 1.6", address: SEAPORT_1_6, note: "Canonical address, identical on every EVM chain — not deployed by ZEEP" },
];

// The headline "On-chain" grid (Curato-style): ZEEP's own standing contracts
// first — read from env, so they flip from "Not deployed yet" to live the
// moment mainnet addresses are set — then the shared infra they sit on.
const ONCHAIN: { label: string; address: string; own: boolean }[] = [
  { label: "ZeepLauncher", address: ZEEP_DEPLOYMENT.launcher, own: true },
  { label: "ZeepExternalLauncher", address: ZEEP_DEPLOYMENT.externalLauncher, own: true },
  { label: "Treasury", address: ZEEP_DEPLOYMENT.treasury, own: true },
  { label: "Pons Factory", address: PONS.factory, own: false },
  { label: "Seaport 1.6", address: SEAPORT_1_6, own: false },
];

const DEPLOYED: Record<string, string> = {
  ZeepLauncher: ZEEP_DEPLOYMENT.launcher,
  ZeepExternalLauncher: ZEEP_DEPLOYMENT.externalLauncher,
};

function OnchainCard({ label, address }: { label: string; address: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3.5">
      <div className="text-[13px] font-semibold text-[var(--muted-foreground)]">{label}</div>
      {address ? (
        <a
          href={`${CHAIN.explorer}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          title={address}
          className={cn("mt-1.5 inline-flex items-center gap-1.5 font-mono-tabular text-[14px] font-semibold hover:underline", focusRing)}
        >
          {address.slice(0, 6)}…{address.slice(-4)} <span aria-hidden="true" className="text-[11px] text-[var(--muted-foreground)]">↗</span>
        </a>
      ) : (
        <div className="mt-1.5 text-[13px] font-semibold text-[var(--muted-foreground)]">Not deployed yet</div>
      )}
    </div>
  );
}

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

  return (
    <section className="mx-auto max-w-[860px] px-6 pb-20 pt-14">
      <h1 className="text-[38px]">Contracts</h1>
      <p className="mt-2.5 max-w-[560px] text-[var(--muted-foreground)]">
        Every address ZEEP's coins actually touch on {CHAIN.name}, and the status of ZEEP's own reserve contracts.
      </p>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[20px]">On-chain</h2>
          <span className="text-[12px] text-[var(--muted-foreground)]">No withdraw key over any reserve · read it yourself on {CHAIN.name}.</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ONCHAIN.map((c) => (
            <OnchainCard key={c.label} label={c.label} address={c.address} />
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
          Each coin&apos;s Vault, FeeRouter and Raffle get their own addresses at launch — shown on that coin&apos;s page, not here.
        </p>
      </div>

      <div className="mt-10">
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
          Built and tested (32/32 passing) — not audited, not deployed anywhere real, no keeper wallet funded. Every coin's
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
                  {DEPLOYED[c.name] ? (
                    <span className="rounded-full border border-[#4ade80]/40 px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-[#4ade80]">Live</span>
                  ) : (
                    <span className="rounded-full border border-[var(--border)] px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                      {c.name.includes("Launcher") ? "Not deployed" : "Per coin"}
                    </span>
                  )}
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

      <div className="mt-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-[16px] font-semibold">Who controls the treasury</h2>
        <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          ZeepFeeRouter&apos;s 20% split goes to a single wallet controlled by the ZEEP project owner — not a DAO, not a
          multisig, not a contract with its own governance. That wallet has no access to any coin&apos;s reserve; it only
          ever receives the protocol&apos;s own cut, the same mechanical way a reserve receives a coin&apos;s.{" "}
          {ZEEP_DEPLOYMENT.treasury ? (
            <>
              Treasury wallet: <CopyAddress address={ZEEP_DEPLOYMENT.treasury} />
            </>
          ) : (
            <>No address is listed yet because ZEEP&apos;s contracts aren&apos;t deployed — see &quot;On-chain&quot; above.</>
          )}
        </p>
      </div>
    </section>
  );
}
