import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Explore · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Explore",
  description: "Every coin launched on ZEEP, with the reserve it is building and the NFTs it holds.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
