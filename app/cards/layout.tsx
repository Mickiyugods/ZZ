import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Card Collections · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Card Collections",
  description: "Coins whose reserves collect real graded Pokémon and One Piece cards.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
