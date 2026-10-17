import Link from "next/link";
import type { CoinRow } from "@/lib/api";
import { fmtEth, fmtInt, policyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const POLICY_COLOR: Record<string, string> = {
  raffle: "text-[var(--primary)]",
  hold: "text-[#6fb7ff]",
  burn: "text-[var(--destructive)]",
};

export function CoinCard({ row }: { row: CoinRow }) {
  return (
    <Link
      href={`/coin/${row.token}`}
      className="group overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="relative h-[140px] overflow-hidden bg-gradient-to-br from-[#171717] to-[#0a0a0a]">
        {row.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.logo} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:transform-none" />
        ) : null}
        <span
          className={cn(
            "absolute right-2.5 top-2.5 rounded-full border border-[var(--border)] bg-black/70 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm",
            POLICY_COLOR[row.policy],
          )}
        >
          {policyLabel(row.policy)}
        </span>
      </div>
      <div className="p-4">
        <span className="text-[16px] font-bold">{row.name}</span>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
          <span className="size-3.5 rounded-[4px] bg-[var(--border)]" />
          {row.chain}
        </div>
        <div className="mt-2.5 text-[13px] text-[var(--muted-foreground)]">
          Collects <strong className="font-semibold text-[var(--foreground)]">{row.collection_name}</strong>
        </div>
        <div className="mt-3.5 flex items-center justify-between border-t border-[var(--border)] pt-3 font-mono-tabular text-[13px]">
          <span className="text-[var(--muted-foreground)]">Reserve</span>
          <span>
            {fmtEth(row.vault_eth)} ETH <span className="text-[var(--muted-foreground)]">· {fmtInt(row.nfts_held)} NFTs</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CoinCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" aria-hidden="true">
      <div className="h-[140px] bg-[var(--secondary)]" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-2/3 rounded bg-[var(--secondary)]" />
        <div className="h-3 w-1/3 rounded bg-[var(--secondary)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--secondary)]" />
        <div className="mt-3.5 h-10 rounded bg-[var(--secondary)]" />
      </div>
    </div>
  );
}
