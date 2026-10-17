import type { Metadata } from "next";

// The page itself is a client component, so its <title> lives here (rendered
// as "Profile · ZEEP" by the root layout's title template).
export const metadata: Metadata = {
  title: "Profile",
  description: "The coins your connected wallet launched on ZEEP.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
