import type { Metadata } from "next";
import * as store from "@/lib/server/store";

// Per-coin <title> ("$PUDGY · ZEEP") and description, resolved on the server
// from the registry so the tab is right from the first paint and on every
// client-side navigation — the page itself is a client component.
export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  try {
    const rows = await store.list();
    const row = rows.find((r) => r.token.toLowerCase() === address.toLowerCase());
    if (row) {
      return {
        title: `$${row.symbol}`,
        description: `${row.name} ($${row.symbol}) on ZEEP — a Pons coin on Robinhood Chain that collects ${row.collection_name}.`,
      };
    }
  } catch {
    // registry not configured / unreachable — fall through to a generic title
  }
  return { title: "Coin" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
