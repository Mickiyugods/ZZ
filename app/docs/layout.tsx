import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Docs · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Docs",
  description: "How ZEEP coins, reserves, fees and the Gacha Station work — and what is live today.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
