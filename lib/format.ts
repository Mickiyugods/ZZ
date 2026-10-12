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

export function policyLabel(p: string) {
  return { raffle: "Raffle", hold: "Hold", burn: "Burn" }[p] || p;
}
