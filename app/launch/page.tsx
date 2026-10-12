"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { byCategory, findCollection, type Category } from "@/lib/collections";
import { VAULT, MAX_CREATOR_TAX_BPS } from "@/lib/config";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { useToast } from "@/lib/toast";
import * as chain from "@/lib/chain";
import { registerCoin } from "@/lib/api";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const STEPS = [
  { key: "coin", label: "Coin", sub: "Name and image" },
  { key: "collection", label: "Collection", sub: "What it collects" },
  { key: "rules", label: "Rules", sub: "NFTs and tax" },
  { key: "confirm", label: "Confirm", sub: "Check and launch" },
] as const;

const TAX_PRESETS = [0, 100, 200, 300];
const CATS: [Category, string][] = [
  ["pfp", "PFP"],
  ["art", "Art"],
  ["cards", "Cards"],
];
const POLICY_LABEL: Record<string, string> = { raffle: "Raffle to holders", hold: "Hold in vault", burn: "Burn" };

type Policy = "raffle" | "hold" | "burn";

export default function LaunchPage() {
  const router = useRouter();
  const wallet = useWallet();
  const toast = useToast();

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [logo, setLogo] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [twitter, setTwitter] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [category, setCategory] = React.useState<Category>("pfp");
  const [collectionSlug, setCollectionSlug] = React.useState("");
  const [collectionSearch, setCollectionSearch] = React.useState("");
  const [customCollectionName, setCustomCollectionName] = React.useState("");
  const [policy, setPolicy] = React.useState<Policy>("raffle");
  const [creatorTaxBps, setCreatorTaxBps] = React.useState(100);
  const [busy, setBusy] = React.useState(false);
  const [launchStatus, setLaunchStatus] = React.useState("");

  React.useEffect(() => {
    document.title = "Launch · ZEEP";
  }, []);

  React.useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("collection");
    if (!slug) return;
    const found = findCollection(slug);
    if (found) {
      setCollectionSlug(found.slug);
      setCategory(found.category);
      setCollectionSearch(found.name);
    }
  }, []);

  const collection = findCollection(collectionSlug);
  const collectionName = collection ? collection.name : customCollectionName;
  const ready = Boolean(name && symbol && collectionName && policy);

  async function doLaunch() {
    if (!ready) return toast("Fill in every step first", "error");
    setBusy(true);
    try {
      setLaunchStatus("Preparing…");
      const result = await chain.launch(
        { name, symbol, logo, description, twitter, website, creatorTaxBps },
        (s) => setLaunchStatus({ prepare: "Preparing…", sign: "Confirm in wallet…", confirm: "Waiting for confirmation…" }[s] || "Working…"),
      );
      setLaunchStatus("Registering vault…");
      await registerCoin({
        hash: result.hash,
        collectionName,
        collectionSlug: collectionSlug || collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        chain: collection?.chain || "ethereum",
        category,
        policy,
      });
      toast("Coin launched", "success");
      router.push(result.token ? `/coin/${result.token}` : "/explore");
    } catch (err) {
      const e = err as { code?: number | string; message?: string };
      toast(e?.code === 4001 || e?.code === "ACTION_REJECTED" ? "Transaction rejected" : e.message || "Launch failed", "error");
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[760px] px-6 pb-20 pt-12">
      <h1 className="text-[38px]">Launch a coin</h1>
      <p className="mt-2.5 text-[var(--muted-foreground)]">
        Create a Pons coin on Robinhood Chain whose trading fees fund a vault. Fill in four short steps, then confirm one
        transaction.
      </p>

      <div className="my-7 flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] sm:flex-row" role="list" aria-label="Launch steps">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            role="listitem"
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex flex-1 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-4 sm:border-b-0 sm:border-r last:border-0",
              i === step && "bg-[rgba(255,255,255,.08)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                i === step ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : i < step ? "bg-[#a1a1aa] text-[var(--primary-foreground)]" : "bg-[var(--border)] text-[var(--muted-foreground)]",
              )}
            >
              {i < step ? <IconCheck className="size-[14px]" stroke={3} /> : i + 1}
            </span>
            <span>
              <span className="block text-[14px] font-semibold">
                {s.label}
                {i < step && <span className="sr-only"> (completed)</span>}
              </span>
              <span className="block text-[12px] text-[var(--muted-foreground)]">{s.sub}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-7">
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <Field label="Coin name" required>
              <input className="input" maxLength={64} placeholder="e.g. Charizard Fund" aria-required="true" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ticker" required>
                <input className="input" maxLength={16} placeholder="e.g. CHZD" aria-required="true" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Logo URL" hint="optional">
                <input type="url" className="input" placeholder="https://…" autoComplete="off" value={logo} onChange={(e) => setLogo(e.target.value)} />
              </Field>
            </div>
            <Field label="Description" hint="optional">
              <textarea className="input" rows={3} maxLength={2048} placeholder="What is this coin about?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="X / Twitter" hint="optional">
                <input className="input" placeholder="@handle" autoComplete="off" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
              </Field>
              <Field label="Website" hint="optional">
                <input type="url" className="input" placeholder="https://…" autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {CATS.map(([k, label]) => (
                  <Pill key={k} active={category === k} onClick={() => { setCategory(k); setCollectionSlug(""); setCollectionSearch(""); }}>
                    {label}
                  </Pill>
                ))}
              </div>
            </Field>
            <Field label="Collection to collect">
              <input
                type="search"
                className="input mb-2.5"
                placeholder={`Search ${byCategory(category).length} collections by name`}
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {byCategory(category)
                  .filter((c) => (collectionSearch ? c.name.toLowerCase().includes(collectionSearch.toLowerCase()) : true))
                  .slice(0, collectionSearch ? undefined : 24)
                  .map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={collectionSlug === c.slug}
                    onClick={() => { setCollectionSlug(c.slug); setCustomCollectionName(""); }}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] p-3 text-left",
                      focusRing,
                      collectionSlug === c.slug && "border-[var(--primary)] bg-[rgba(255,255,255,.07)]",
                    )}
                  >
                    <span className="size-[34px] shrink-0 rounded-lg bg-[var(--border)]" />
                    <span>
                      <span className="block text-[13px] font-semibold">{c.name}</span>
                      <span className="block font-mono-tabular text-[11px] text-[var(--muted-foreground)]">{c.chain} · floor {c.floor}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                Only listed collections can be linked. Don&apos;t see yours? Enter it below and we&apos;ll review it.
              </p>
            </Field>
            <Field label="Or name a collection manually">
              <input
                className="input"
                placeholder="e.g. Pokémon · Jungle Set"
                value={customCollectionName}
                onChange={(e) => { setCustomCollectionName(e.target.value); if (e.target.value) setCollectionSlug(""); }}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <Field label="What happens to what the vault buys">
              <div className="flex flex-wrap gap-2">
                {(["raffle", "hold", "burn"] as Policy[]).map((p) => (
                  <Pill key={p} active={policy === p} onClick={() => setPolicy(p)}>
                    {POLICY_LABEL[p]}
                  </Pill>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">Fixed at launch. ZEEP never offers a way to change it afterwards.</p>
            </Field>
            <Field label="Creator tax" hint="on every trade, paid to you in ETH">
              <div className="flex flex-wrap gap-2">
                {TAX_PRESETS.map((bps) => (
                  <Pill key={bps} active={creatorTaxBps === bps} onClick={() => setCreatorTaxBps(bps)}>
                    {(bps / 100).toFixed(0)}%
                  </Pill>
                ))}
                <Pill active={!TAX_PRESETS.includes(creatorTaxBps)} onClick={() => setCreatorTaxBps(50)}>
                  Custom
                </Pill>
              </div>
              {!TAX_PRESETS.includes(creatorTaxBps) && (
                <input
                  type="number"
                  className="input mt-2.5 max-w-[140px]"
                  min={0}
                  max={MAX_CREATOR_TAX_BPS / 100}
                  step={0.25}
                  value={(creatorTaxBps / 100).toFixed(2)}
                  onChange={(e) => setCreatorTaxBps(Math.max(0, Math.min(MAX_CREATOR_TAX_BPS, Math.round(Number(e.target.value) * 100))))}
                />
              )}
              <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">Capped at {(MAX_CREATOR_TAX_BPS / 100).toFixed(0)}% by ZEEP.</p>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <Field label="Name"><div>{name || <span className="text-[var(--muted-foreground)]">—</span>}</div></Field>
            <Field label="Ticker"><div className="font-mono-tabular">{symbol || <span className="text-[var(--muted-foreground)]">—</span>}</div></Field>
            <Field label="Collects"><div>{collectionName || <span className="text-[var(--muted-foreground)]">Not set</span>}</div></Field>
            <Field label="Outcome"><div>{POLICY_LABEL[policy]}</div></Field>
            {!ready && (
              <p role="alert" className="text-[13px] text-[var(--destructive)]">
                Fill in every step before launching.
              </p>
            )}
            {!wallet.connected ? (
              <button type="button" onClick={openWallet} className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)]", focusRing)}>
                Connect wallet to launch
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !ready}
                onClick={doLaunch}
                aria-busy={busy}
                className={cn("flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50", focusRing)}
              >
                {busy ? launchStatus || "Working…" : "Launch coin"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6">
        <Row label="Collects" value={collectionName || "—"} />
        <Row label="Outcome" value={POLICY_LABEL[policy]} />
        <Row label="Creator tax" value={`${(creatorTaxBps / 100).toFixed(2)}%`} />
        <Row label="Supply" value="1,000,000,000" />
        <div className="mt-4 text-[12px] text-[var(--muted-foreground)]">Every 1 ETH traded</div>
        <div className="my-4 flex h-2 overflow-hidden rounded-full bg-[var(--border)]">
          <span style={{ width: `${VAULT.vaultBps / 100}%` }} className="h-full bg-[var(--primary)]" />
          <span style={{ width: `${VAULT.protocolBps / 100}%` }} className="h-full bg-[var(--muted-foreground)]" />
        </div>
        <Row label="Collection vault" value={`${(VAULT.vaultBps / 10000).toFixed(2)} ETH`} />
        <Row label="ZEEP treasury" value={`${(VAULT.protocolBps / 10000).toFixed(2)} ETH`} />
        <p className="mt-2.5 text-[12px] text-[var(--muted-foreground)]">
          Pons charges its own trade fee and passes a share to the fee router. The router sends 80% to the vault, 20% to the
          treasury. Gas and any Pons launch-block tax are not included.
        </p>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold disabled:opacity-40", focusRing)}
        >
          Back
        </button>
        {step < 3 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            className={cn("flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-[14px] font-semibold text-[var(--primary-foreground)]", focusRing)}
          >
            Continue
          </button>
        )}
      </div>
    </section>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold">
        {label}
        {required && (
          <span className="text-[var(--destructive)]" aria-hidden="true">
            {" "}
            *
          </span>
        )}{" "}
        {hint && <span className="font-normal text-[var(--muted-foreground)]">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--muted-foreground)]",
        focusRing,
        active && "border-[var(--primary)] bg-[rgba(255,255,255,.08)] text-[var(--primary)]",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] py-2.5 text-[14px] last:border-0">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-mono-tabular">{value}</span>
    </div>
  );
}
