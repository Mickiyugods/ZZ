"use client";

import * as React from "react";
import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { byCategory, findCollection, type Category } from "@/lib/collections";
import { VAULT, MAX_CREATOR_TAX_BPS, PONS_CREATOR_BASE_BPS } from "@/lib/config";
import { useWallet } from "@/lib/useWallet";
import { openWallet } from "@/lib/walletDialogStore";
import { useToast } from "@/lib/toast";
import * as chain from "@/lib/chain";
import { registerCoin } from "@/lib/api";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const STEPS = [
  { key: "coin", label: "Coin", sub: "What the coin is called" },
  { key: "collection", label: "Collection", sub: "What your fees buy" },
  { key: "rules", label: "Rules", sub: "Where NFTs go & your tax" },
  { key: "review", label: "Review", sub: "Check & launch" },
] as const;

// 0% … 10%, one button per whole percent.
const TAX_PRESETS = Array.from({ length: 11 }, (_, i) => i * 100);
const POLICY_LABEL: Record<string, string> = { raffle: "Raffle to holders", hold: "Hold in reserve", burn: "Burn" };
const POLICY_OPTIONS: { key: Policy; title: string; text: string }[] = [
  { key: "raffle", title: "Raffle to holders", text: "Every NFT the reserve buys is raffled to one holder, with odds proportional to their balance — bigger bags, better odds." },
  { key: "hold", title: "Hold in reserve", text: "The reserve keeps each NFT it buys. Holders own them collectively; nothing is given away or destroyed." },
  { key: "burn", title: "Burn", text: "Each NFT is sent to a burn address the instant it's bought — permanently removed, owned by no one." },
];
const CAT_CARDS: { key: Category; title: string; text: string }[] = [
  { key: "pfp", title: "PFP collection", text: "Collect a profile-picture collection at floor." },
  { key: "art", title: "Art collection", text: "Generative and one-of-one art." },
  { key: "cards", title: "Trading cards", text: "Real graded Pokémon & One Piece cards." },
];
// Pons's flat launch fee on Robinhood Chain.
const PONS_LAUNCH_FEE_ETH = 0.0005;

type Policy = "raffle" | "hold" | "burn";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
const MAX_IMAGE = 5 * 1024 * 1024;
const STEP_FIELDS: Record<number, string[]> = { 0: ["name", "symbol"], 1: ["collection"], 2: [], 3: [] };
const DEMO_TOKEN = "0xDE110a5e4b7C2F91ad6E3cC8f2b9D047aE5b0C21";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LaunchPage() {
  const wallet = useWallet();
  const toast = useToast();

  const [step, setStep] = React.useState(0);
  const [tried, setTried] = React.useState<Record<number, boolean>>({});
  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [logo, setLogo] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [twitter, setTwitter] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [telegram, setTelegram] = React.useState("");
  const [category, setCategory] = React.useState<Category>("pfp");
  const [collectionSlug, setCollectionSlug] = React.useState("");
  const [collectionSearch, setCollectionSearch] = React.useState("");
  const [customCollectionName, setCustomCollectionName] = React.useState("");
  const [policy, setPolicy] = React.useState<Policy>("raffle");
  const [creatorTaxBps, setCreatorTaxBps] = React.useState(100);
  const [busy, setBusy] = React.useState(false);
  const [launchStatus, setLaunchStatus] = React.useState("");
  const [result, setResult] = React.useState<{ token?: string; hash: string; demo?: boolean } | null>(null);
  const [demo, setDemo] = React.useState(false);

  const [uploadsEnabled, setUploadsEnabled] = React.useState<boolean | null>(null);
  const [logoPreview, setLogoPreview] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);


  React.useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((j) => setUploadsEnabled(Boolean(j?.enabled)))
      .catch(() => setUploadsEnabled(false));
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
  const preview = logoPreview || logo;

  // Per-1-ETH split: what reaches the coin's fee recipient is Pons' base creator
  // share (~0.75% of volume) plus the creator tax; the router sends 80% of that
  // to the reserve and 20% to the treasury.
  const creatorFrac = (PONS_CREATOR_BASE_BPS + creatorTaxBps) / 10000;
  const perEthReserve = (creatorFrac * (VAULT.vaultBps / 10000)).toFixed(4);
  const perEthTreasury = (creatorFrac * (VAULT.protocolBps / 10000)).toFixed(4);

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "Give your coin a name.";
  if (!symbol.trim()) errors.symbol = "Add a ticker.";
  if (!collectionName) errors.collection = "Pick a collection, or name one below.";

  const stepValid = (n: number) => (STEP_FIELDS[n] ?? []).every((k) => !errors[k]);
  const reachable = (n: number) => STEPS.slice(0, n).every((_, i) => stepValid(i));
  const ready = Boolean(name.trim() && symbol.trim() && collectionName);
  const showError = (key: string, forStep: number) => tried[forStep] && errors[key];

  function next() {
    setTried((t) => ({ ...t, [step]: true }));
    if (stepValid(step)) setStep((s) => Math.min(3, s + 1));
  }
  function goTo(n: number) {
    if (n <= step || reachable(n)) setStep(n);
  }

  async function pickImage(file?: File) {
    setUploadError(null);
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setUploadError("Use a PNG, JPG, WebP, GIF or SVG.");
    if (file.size > MAX_IMAGE) return setUploadError("Image must be under 5 MB.");
    setLogoPreview(URL.createObjectURL(file));
    if (!uploadsEnabled) {
      setUploadError("Uploads aren't set up here — paste an image URL instead.");
      return;
    }
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Image upload failed.");
      setLogo(json.url);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function doLaunch() {
    if (!ready) {
      setTried({ 0: true, 1: true, 2: true, 3: true });
      return toast("Fill in every step first", "error");
    }
    setBusy(true);
    try {
      if (demo) {
        for (const s of ["Preparing…", "Confirm in wallet…", "Waiting for confirmation…"]) {
          setLaunchStatus(s);
          await sleep(650);
        }
        setResult({ token: DEMO_TOKEN, hash: "0xdemo000000000000000000000000000000000000000000000000000000demo", demo: true });
        return;
      }
      setLaunchStatus("Preparing…");
      const res = await chain.launch(
        { name, symbol, logo, description, twitter, website, creatorTaxBps },
        (s) => setLaunchStatus({ prepare: "Preparing…", sign: "Confirm in wallet…", confirm: "Waiting for confirmation…" }[s] || "Working…"),
      );
      setLaunchStatus("Registering reserve…");
      await registerCoin({
        hash: res.hash,
        collectionName,
        collectionSlug: collectionSlug || collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        chain: collection?.chain || "ethereum",
        category,
        policy,
      });
      toast("Coin launched", "success");
      setResult({ token: res.token ?? undefined, hash: res.hash });
    } catch (err) {
      const e = err as { code?: number | string; message?: string };
      toast(e?.code === 4001 || e?.code === "ACTION_REJECTED" ? "Transaction rejected" : e.message || "Launch failed", "error");
      setBusy(false);
    }
  }

  if (result) return <SuccessScreen symbol={symbol} name={name} collectionName={collectionName} result={result} />;

  return (
    <section className="mx-auto max-w-[1080px] px-6 pb-20 pt-12">
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        <span className="size-1.5 rotate-45 bg-[var(--primary)]" /> New coin
      </p>
      <h1 className="mt-2.5 text-[38px]">
        Launch a <span className="text-[var(--primary)]">coin</span>
      </h1>
      <p className="mt-2 max-w-[520px] text-[var(--muted-foreground)]">
        Four steps, one transaction. Pair your coin with an NFT collection and decide where those NFTs go.
      </p>

      {/* step pills */}
      <div className="mt-7 flex flex-wrap items-center gap-2" role="list" aria-label="Launch steps">
        {STEPS.map((s, i) => {
          const done = i < step && stepValid(i);
          const active = i === step;
          const locked = i > step && !reachable(i);
          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                role="listitem"
                aria-current={active ? "step" : undefined}
                disabled={locked}
                onClick={() => goTo(i)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  focusRing,
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : done
                      ? "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--muted-foreground)]"
                      : locked
                        ? "cursor-not-allowed border-[var(--border)] text-[var(--muted-foreground)] opacity-50"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-[18px] items-center justify-center rounded-full font-mono-tabular text-[10px]",
                    active ? "bg-[var(--primary-foreground)]/20" : "bg-[var(--border)]",
                  )}
                >
                  {done ? <IconCheck className="size-[11px]" stroke={3} /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <span aria-hidden="true" className="hidden h-px w-4 bg-[var(--border)] sm:block" />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* ── form ─────────────────────────────────────────────── */}
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-7">
          <h2 className="text-[20px]">{STEPS[step].label}</h2>
          <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">{STEPS[step].sub}</p>
          <div className="mt-6">
            {step === 0 && (
              <div className="flex flex-col gap-5">
                <div className="inline-flex w-fit items-center justify-center rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] bg-[var(--background)] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/brand/pons-logo.png" alt="Pons" decoding="async" className="size-7 object-contain" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Coin name" required error={showError("name", 0) ? errors.name : undefined}>
                    <input className={cn("input", showError("name", 0) && "border-[var(--destructive)]")} maxLength={64} placeholder="e.g. Charizard Fund" aria-required="true" aria-invalid={!!showError("name", 0)} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Ticker" required error={showError("symbol", 0) ? errors.symbol : undefined}>
                    <input className={cn("input", showError("symbol", 0) && "border-[var(--destructive)]")} maxLength={16} placeholder="e.g. CHZD" aria-required="true" aria-invalid={!!showError("symbol", 0)} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
                  </Field>
                </div>

                <Field label="Coin image" hint="optional">
                  <Dropzone preview={preview} uploading={uploading} uploadsEnabled={uploadsEnabled} onPick={pickImage} />
                  {uploadError && <p className="mt-1.5 text-[12px] text-[var(--destructive)]">{uploadError}</p>}
                  <input
                    type="url"
                    className="input mt-2.5"
                    placeholder="…or paste an image URL (https://…)"
                    autoComplete="off"
                    value={logo}
                    onChange={(e) => {
                      setLogo(e.target.value);
                      setLogoPreview("");
                    }}
                  />
                </Field>

                <Field label="Description" hint="optional">
                  <textarea className="input" rows={3} maxLength={2048} placeholder="What this coin is for, and what its fees are buying." value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>

                <Field label="Links" hint="optional">
                  <div className="flex flex-col gap-2.5">
                    <input type="url" className="input" placeholder="Website URL" autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    <input className="input" placeholder="X / Twitter (@handle)" autoComplete="off" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
                    <input className="input" placeholder="Telegram link" autoComplete="off" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
                  </div>
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-5">
                <Field label="What your fees will buy">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {CAT_CARDS.map((c) => {
                      const active = category === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => { setCategory(c.key); setCollectionSlug(""); setCollectionSearch(""); }}
                          className={cn(
                            "rounded-[var(--radius)] border p-3.5 text-left transition-colors",
                            focusRing,
                            active ? "border-[var(--primary)] bg-[rgba(255,255,255,.07)]" : "border-[var(--border)] hover:border-[var(--muted-foreground)]",
                          )}
                        >
                          <span className="block text-[13px] font-semibold">{c.title}</span>
                          <span className="mt-1 block text-[12px] leading-relaxed text-[var(--muted-foreground)]">{c.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Collection to collect" required error={showError("collection", 1) ? errors.collection : undefined}>
                  <input
                    type="search"
                    className="input mb-2.5"
                    placeholder={`Search ${byCategory(category).length} collections by name`}
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {byCategory(category)
                      .filter((c) => (collectionSearch ? c.name.toLowerCase().includes(collectionSearch.toLowerCase()) : true))
                      .slice(0, collectionSearch ? undefined : 18)
                      .map((c) => (
                        <button
                          key={c.slug}
                          type="button"
                          aria-pressed={collectionSlug === c.slug}
                          onClick={() => { setCollectionSlug(c.slug); setCustomCollectionName(""); }}
                          className={cn(
                            "flex min-h-11 items-center gap-2.5 rounded-[var(--primitive-radius-control-sm,0.5rem)] border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--muted-foreground)]",
                            focusRing,
                            collectionSlug === c.slug && "border-[var(--primary)] bg-[rgba(255,255,255,.07)]",
                          )}
                        >
                          {c.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image} alt="" loading="lazy" decoding="async" className="size-[34px] shrink-0 rounded-lg object-cover" />
                          ) : (
                            <span className="size-[34px] shrink-0 rounded-lg bg-[var(--border)]" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold">{c.name}</span>
                            <span className="block font-mono-tabular text-[11px] text-[var(--muted-foreground)]">{c.chain} · floor {c.floor}</span>
                          </span>
                        </button>
                      ))}
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">Only listed collections can be linked. Don&apos;t see yours? Enter it below and we&apos;ll review it.</p>
                </Field>
                <Field label="Or name a collection manually">
                  <input className="input" placeholder="e.g. Pokémon · Jungle Set" value={customCollectionName} onChange={(e) => { setCustomCollectionName(e.target.value); if (e.target.value) setCollectionSlug(""); }} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <Field label="What happens to what the reserve buys">
                  <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="NFT payout policy">
                    {POLICY_OPTIONS.map((p) => {
                      const active = policy === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPolicy(p.key)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-[var(--radius)] border p-4 text-left transition-colors",
                            focusRing,
                            active ? "border-[var(--primary)] bg-[rgba(255,255,255,.07)]" : "border-[var(--border)] hover:border-[var(--muted-foreground)]",
                          )}
                        >
                          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", active ? "border-[var(--primary)]" : "border-[var(--border)]")}>
                            {active && <span className="size-2.5 rounded-full bg-[var(--primary)]" />}
                          </span>
                          <span>
                            <span className="block text-[14px] font-semibold">{p.title}</span>
                            <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--muted-foreground)]">{p.text}</span>
                          </span>
                        </button>
                      );
                    })}
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
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                    An extra cut of every trade, on top of the ~{(PONS_CREATOR_BASE_BPS / 100).toFixed(2)}% Pons already pays every creator from its 1% curve fee. Once ZEEP&apos;s reserve router is live, both are split 80% to the reserve and 20% to the treasury. Capped at {(MAX_CREATOR_TAX_BPS / 100).toFixed(0)}% and snapshotted at launch.
                  </p>
                </Field>

                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">Initial buy</span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Temporarily disabled</span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">You can buy your own coin straight after launching, from the coin page, at the ordinary price.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-4">
                <ReviewRow label="Name" value={name} onFix={() => goTo(0)} fix="Add a name" />
                <ReviewRow label="Ticker" value={symbol} onFix={() => goTo(0)} fix="Add a ticker" mono />
                <ReviewRow label="Collects" value={collectionName} onFix={() => goTo(1)} fix="Pick a collection" />
                <ReviewRow label="NFT policy" value={POLICY_LABEL[policy]} />
                <ReviewRow label="Creator tax" value={`${(creatorTaxBps / 100).toFixed(2)}%`} mono />
                <ReviewRow label="Initial buy" value="Off for now" />

                <div className="mt-1 overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
                  <div className="flex items-center justify-between px-4 py-3 text-[13px]">
                    <span className="text-[var(--muted-foreground)]">Pons launch fee</span>
                    <span className="font-mono-tabular">{PONS_LAUNCH_FEE_ETH.toFixed(4)} ETH</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--background)] px-4 py-3">
                    <span className="text-[14px] font-semibold">Total</span>
                    <span className="font-mono-tabular text-[14px] font-semibold">{PONS_LAUNCH_FEE_ETH.toFixed(4)} ETH</span>
                  </div>
                </div>
                <p className="-mt-1 text-[12px] text-[var(--muted-foreground)]">One transaction, plus gas.</p>

                <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                  <li>Your coin&apos;s earnings split <strong className="font-semibold text-[var(--foreground)]">80% to the {collectionName || "collection"} reserve, 20% to the treasury</strong>.</li>
                  <li>The collection is <strong className="font-semibold text-[var(--foreground)]">fixed for good</strong>. Supply is fixed at 1,000,000,000. Your tax is snapshotted at launch.</li>
                  <li>Once the bonding curve raises 4.20 ETH, the coin graduates to a locked Pons pool.</li>
                </ul>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  At {(creatorTaxBps / 100).toFixed(0)}% tax, every 1 ETH traded sends about{" "}
                  <span className="font-mono-tabular text-[var(--foreground)]">{perEthReserve} ETH</span> to the reserve and{" "}
                  <span className="font-mono-tabular text-[var(--foreground)]">{perEthTreasury} ETH</span> to the treasury. Estimate.
                </p>
                {/* Honest current state: Phase 2 router contracts aren't deployed yet (see CLAUDE.md "Vault execution"). */}
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-4 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                  <span className="font-semibold text-[var(--foreground)]">Where fees go today.</span> ZEEP&apos;s on-chain reserve router isn&apos;t deployed yet, so for now Pons pays your coin&apos;s creator fees to your own wallet, and ZEEP tracks the reserve in its registry. When the router goes live, fees route to it automatically.
                </div>

                <div className="mt-1">
                  <LaunchAction wallet={wallet} demo={demo} ready={ready} busy={busy} status={launchStatus} onLaunch={doLaunch} />
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                  You&apos;re launching a memecoin. It has no intrinsic value, can go to zero, and ZEEP promises nothing to its buyers. See the{" "}
                  <Link href="/docs" className="text-[var(--primary)] underline-offset-2 hover:underline">docs</Link>.
                </p>
              </div>
            )}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-[var(--border)] pt-5">
            {step === 0 ? (
              <Link href="/" className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold transition-colors hover:border-[var(--muted-foreground)]", focusRing)}>
                Cancel
              </Link>
            ) : (
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-[14px] font-semibold transition-colors hover:border-[var(--muted-foreground)]", focusRing)}>
                Back
              </button>
            )}
            {step < 3 && (
              <button type="button" onClick={next} className={cn("flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[#e5e5e5]", focusRing)}>
                Continue →
              </button>
            )}
          </div>
        </div>

        {/* ── live summary (sticky) ────────────────────────────── */}
        <aside className="lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Your coin · before launch</div>
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background)]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-[14px] font-bold text-[var(--muted-foreground)]">{symbol.slice(0, 1) || "?"}</span>
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate font-mono-tabular text-[15px] font-semibold">{symbol || "TICKER"}</div>
                <div className="truncate text-[12px] text-[var(--muted-foreground)]">{name || "Unnamed coin"}</div>
              </div>
            </div>
            <div className="px-5 pb-4">
              <SummaryRow label="Collects" value={collectionName || <span className="text-[var(--muted-foreground)]">not chosen</span>} />
              <SummaryRow label="Outcome" value={<span className="rounded-full border border-[var(--border)] px-2 py-[2px] text-[11px] font-semibold">{POLICY_LABEL[policy]}</span>} />
              <SummaryRow label="Creator tax" value={<span className="font-mono-tabular">{(creatorTaxBps / 100).toFixed(2)}%</span>} />
              <SummaryRow label="Supply" value={<span className="font-mono-tabular">1,000,000,000</span>} />
            </div>
            <div className="border-t border-[var(--border)] bg-[var(--background)] px-5 py-4">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                <span>Per 1 ETH traded</span>
                <span>estimate</span>
              </div>
              <div className="my-3 flex h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <span style={{ width: `${VAULT.vaultBps / 100}%` }} className="h-full bg-[var(--primary)]" />
                <span style={{ width: `${VAULT.protocolBps / 100}%` }} className="h-full bg-[var(--muted-foreground)]" />
              </div>
              <SummaryRow label="Collection reserve" value={<span className="font-mono-tabular">{perEthReserve} ETH</span>} dim />
              <SummaryRow label="ZEEP treasury" value={<span className="font-mono-tabular">{perEthTreasury} ETH</span>} dim />
              <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
                Pons pays every coin&apos;s creator ~{(PONS_CREATOR_BASE_BPS / 100).toFixed(2)}% of each trade from its 1% curve fee, plus your creator tax. Split 80% to the reserve and 20% to the treasury. Gas and the anti-snipe tax in a coin&apos;s first seconds aren&apos;t included.
              </p>
            </div>
          </div>

          {/* demo toggle — preview the connected launch flow without a wallet */}
          <button
            type="button"
            onClick={() => setDemo((d) => !d)}
            aria-pressed={demo}
            className={cn("mt-3 flex w-full min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors", focusRing, demo ? "border-[var(--primary)] bg-[rgba(255,255,255,.08)] text-[var(--primary)]" : "border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
          >
            <span className={cn("size-2 rounded-full", demo ? "bg-[#4ade80]" : "bg-[var(--muted-foreground)]")} />
            {demo ? "Demo mode on — nothing goes on-chain" : "Preview the launch flow (demo)"}
          </button>
        </aside>
      </div>
    </section>
  );
}

function SuccessScreen({ symbol, name, collectionName, result }: { symbol: string; name: string; collectionName: string; result: { token?: string; hash: string; demo?: boolean } }) {
  return (
    <section className="mx-auto max-w-[520px] px-6 pb-20 pt-16 text-center">
      <span className="font-mono-tabular text-[12px] uppercase tracking-wider text-[#4ade80]">{result.demo ? "Launched · demo" : "Launched"}</span>
      <h1 className="mt-2 text-[32px]">${symbol || "COIN"} is live</h1>
      <p className="mx-auto mt-3 max-w-[400px] text-[14px] text-[var(--muted-foreground)]">
        {name || "Your coin"} trades on Pons now. A share of every trade is set aside for {collectionName || "the collection"}&apos;s reserve.
      </p>
      {result.demo && (
        <p className="mx-auto mt-3 max-w-[400px] rounded-[var(--radius)] border border-dashed border-[var(--border)] px-4 py-2.5 text-[12px] text-[var(--muted-foreground)]">
          This is a demo — no transaction was sent and no coin was created.
        </p>
      )}
      <div className="mx-auto mt-6 space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-left text-[13px]">
        {[
          ["Coin", result.token],
          ["Transaction", result.hash],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <span className="text-[var(--muted-foreground)]">{k}</span>
            <span className="break-all text-right font-mono-tabular text-[12px]">{v ? `${v.slice(0, 10)}…${v.slice(-6)}` : "—"}</span>
          </div>
        ))}
      </div>
      <div className="mt-7 flex flex-col gap-2.5">
        {!result.demo && (
          <Link href={result.token ? `/coin/${result.token}` : "/explore"} className={cn("flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-[14px] font-semibold text-[var(--primary-foreground)] hover:bg-[#e5e5e5]", focusRing)}>
            Open the coin page
          </Link>
        )}
        <Link href={result.demo ? "/launch" : "/explore"} className={cn("flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-6 text-[14px] font-semibold transition-colors hover:border-[var(--muted-foreground)]", focusRing)}>
          {result.demo ? "Back to the form" : "Explore coins"}
        </Link>
      </div>
    </section>
  );
}

function LaunchAction({ wallet, demo, ready, busy, status, onLaunch }: { wallet: ReturnType<typeof useWallet>; demo: boolean; ready: boolean; busy: boolean; status: string; onLaunch: () => void }) {
  const toast = useToast();
  const base = cn("flex min-h-11 w-full items-center justify-center rounded-full px-5 text-[14px] font-semibold transition-colors", focusRing);
  const primary = "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#e5e5e5]";

  if (demo) {
    return (
      <>
        {!ready && <p role="alert" className="mb-2 text-[13px] text-[var(--destructive)]">Fill in every step first.</p>}
        <button type="button" disabled={busy || !ready} onClick={onLaunch} aria-busy={busy} className={cn(base, primary, "disabled:opacity-50")}>
          {busy ? status || "Working…" : "Launch coin (demo)"}
        </button>
      </>
    );
  }
  if (!wallet.connected) {
    return (
      <button type="button" onClick={openWallet} className={cn(base, primary)}>
        Connect wallet to launch
      </button>
    );
  }
  if (!wallet.onChain) {
    return (
      <button type="button" onClick={async () => { try { await wallet.ensureChain(); } catch (e) { toast((e as Error).message, "error"); } }} className={cn(base, primary)}>
        Switch to Robinhood Chain
      </button>
    );
  }
  return (
    <>
      {!ready && <p role="alert" className="mb-2 text-[13px] text-[var(--destructive)]">Fill in every step before launching.</p>}
      <button type="button" disabled={busy || !ready} onClick={onLaunch} aria-busy={busy} className={cn(base, primary, "disabled:opacity-50")}>
        {busy ? status || "Working…" : "Launch coin"}
      </button>
    </>
  );
}

function Dropzone({ preview, uploading, uploadsEnabled, onPick }: { preview: string; uploading: boolean; uploadsEnabled: boolean | null; onPick: (file?: File) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files?.[0]); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
      className={cn(
        "flex cursor-pointer items-center gap-4 rounded-[var(--radius)] border border-dashed p-4 transition-colors",
        focusRing,
        over ? "border-[var(--primary)] bg-[rgba(255,255,255,.05)]" : "border-[var(--border)] hover:border-[var(--muted-foreground)]",
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-[22px] text-[var(--muted-foreground)]">+</span>
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold">{uploading ? "Uploading…" : preview ? "Image added — click to change" : "Drop an image, or click to choose"}</div>
        <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
          PNG, JPG, WebP, GIF or SVG · up to 5 MB{uploadsEnabled === false ? " · or paste an image link below" : ""}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
    </div>
  );
}

function Field({ label, hint, required, error, children }: { label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold">
        {label}
        {required && <span className="text-[var(--destructive)]" aria-hidden="true"> *</span>}{" "}
        {hint && <span className="font-normal text-[var(--muted-foreground)]">{hint}</span>}
      </label>
      {children}
      {error && <p role="alert" className="mt-1.5 text-[12px] text-[var(--destructive)]">{error}</p>}
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
        "flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-4 text-[13px] font-semibold text-[var(--muted-foreground)] transition-colors",
        focusRing,
        active && "border-[var(--primary)] bg-[rgba(255,255,255,.08)] text-[var(--primary)]",
      )}
    >
      {children}
    </button>
  );
}

function ReviewRow({ label, value, onFix, fix, mono }: { label: string; value: string; onFix?: () => void; fix?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] pb-3 last:border-0 last:pb-0">
      <span className="text-[13px] text-[var(--muted-foreground)]">{label}</span>
      {value ? (
        <span className={cn("text-[14px]", mono && "font-mono-tabular")}>{value}</span>
      ) : (
        <button type="button" onClick={onFix} className="text-[13px] font-semibold text-[var(--destructive)] underline-offset-2 hover:underline">
          {fix} →
        </button>
      )}
    </div>
  );
}

function SummaryRow({ label, value, dim }: { label: string; value: React.ReactNode; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className={cn(dim ? "text-[var(--muted-foreground)]" : "text-[var(--muted-foreground)]")}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
