import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "NFT Collections · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "NFT Collections",
  description: "438 real PFP and art collections a ZEEP coin can be paired with, across Robinhood Chain, Ethereum, Base, Solana and Hyperliquid.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
