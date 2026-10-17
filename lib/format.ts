export function short(addr?: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const nf = (digits: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function fmtEth(value: number | string | undefined, digits = 3) {
  const n = Number(value) || 0;
  return nf(digits).format(n);
}

export function fmtInt(value: number | string | undefined) {
  return nf(0).format(Number(value) || 0);
}

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Pons-style tiny price: 0.0000428 -> "0.0₄428" (subscript = count of zeros). */
export function subPrice(p: number): string {
  if (!isFinite(p) || p <= 0) return "0";
  if (p >= 0.001) return p.toPrecision(4).replace(/\.?0+$/, "");
  const m = p.toFixed(20).match(/^0\.(0+)/);
  if (!m) return p.toExponential(2);
  let zeros = m[1].length;
  // 3 significant digits, rounded (not truncated) like Pons; 0.0000999.6 -> 0.0001
  let digits = Math.round(p * 10 ** (zeros + 3));
  if (digits >= 1000) {
    zeros -= 1;
    digits = Math.round(p * 10 ** (zeros + 3));
  }
  if (zeros < 3) return p.toPrecision(3);
  const sub = String(zeros).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
  return `0.0${sub}${String(digits).replace(/0+$/, "") || "0"}`;
}

/** A per-token USD price, e.g. "$0.0₄428". */
export const fmtUsd = (p: number) => `$${subPrice(p)}`;

/** A large USD total in compact form, e.g. "$42.8K", "$1.20M". */
export function fmtUsdCompact(n: number): string {
  if (!isFinite(n) || n <= 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return fmtUsd(n);
}

/** Whole-dollar amount with en-US grouping regardless of the visitor's locale: 1000 -> "$1,000". */
export const fmtUsdWhole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Unix seconds -> "45s" / "19m" / "3h" / "2d", like Pons' trade list. */
export function ageShort(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function policyLabel(p: string) {
  return { raffle: "Raffle", hold: "Hold", burn: "Burn" }[p] || p;
}
