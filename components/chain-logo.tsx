// Chain display name + logo, shared by /collections and the coin cards.
// Logos live in public/images/chains/ (the owner's chain-logo set); an unknown
// chain falls back to a monogram so nothing ever renders as an empty box.

export const CHAIN_META: Record<string, { label: string; logo: string }> = {
  robinhood: { label: "Robinhood Chain", logo: "/images/chains/robinhood.png" },
  ethereum: { label: "Ethereum", logo: "/images/chains/ethereum.png" },
  base: { label: "Base", logo: "/images/chains/base.png" },
  solana: { label: "Solana", logo: "/images/chains/solana.png" },
  hyperliquid: { label: "Hyperliquid", logo: "/images/chains/hyperliquid.png" },
  polygon: { label: "Polygon", logo: "/images/chains/polygon.png" },
};

export const CHAIN_ORDER = ["robinhood", "ethereum", "base", "solana", "hyperliquid", "polygon"];

export function chainLabel(chain: string): string {
  return CHAIN_META[chain]?.label ?? chain.charAt(0).toUpperCase() + chain.slice(1);
}

export function ChainLogo({ chain, size = 18 }: { chain: string; size?: number }) {
  const meta = CHAIN_META[chain];
  if (meta) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={meta.logo} alt="" width={size} height={size} loading="lazy" decoding="async" className="shrink-0 rounded-full object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full bg-[#1f1f1f] text-[10px] font-bold text-white" style={{ width: size, height: size }}>
      {chainLabel(chain).charAt(0)}
    </span>
  );
}
