import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Gacha Station · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Gacha Station",
  description: "Crack sealed Pokémon and One Piece packs from Collector Crypt and pull a real graded card.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
