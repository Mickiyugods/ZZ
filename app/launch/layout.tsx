import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Launch · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Launch",
  description: "Launch a coin on Robinhood Chain through Pons and pair it with an NFT or graded-card collection.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
