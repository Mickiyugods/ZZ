import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Contracts · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Contracts",
  description: "Every contract ZEEP coins touch on Robinhood Chain, and the status of ZEEP’s own reserve contracts.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
