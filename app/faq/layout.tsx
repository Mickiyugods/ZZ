import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "FAQ · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about launching, fees, reserves, raffles and the Gacha Station.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
