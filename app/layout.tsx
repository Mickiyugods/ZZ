import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { SiteFooter } from "@/components/site-footer";
import { WalletDialog } from "@/components/wallet-dialog";
import { TitleEnforcer } from "@/components/title-enforcer";
import { RouteProgress } from "@/components/route-progress";
import { PrivyAppProvider } from "@/components/providers/privy-app-provider";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  // Absolute base for share-card/OG URLs. Set NEXT_PUBLIC_SITE_URL to the live
  // domain on Vercel; VERCEL_URL covers preview deploys.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3473"),
  ),
  // Per-page titles render as "Explore · ZEEP" etc.; the home/default uses the
  // full tagline. (Client pages also set document.title on navigation.)
  title: {
    default: "ZEEP — memecoins with a reserve inside",
    template: "%s · ZEEP",
  },
  description:
    "Launch a coin on Robinhood Chain, link it to any listed NFT collection, and let a share of every trade buy real NFTs for a raffle, hold or burn.",
  openGraph: {
    type: "website",
    title: "ZEEP — memecoins with a reserve inside",
    description: "A coin with a reserve inside. Trading fees buy real NFTs and graded cards for holders.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <PrivyAppProvider>
          <ToastProvider>
            <RouteProgress />
            <div className="flex min-h-dvh items-start">
              <AppSidebar />
              <div className="min-w-0 flex-1">
                <Topbar />
                <main id="main-content" tabIndex={-1}>
                  {children}
                </main>
                <SiteFooter />
              </div>
            </div>
            <WalletDialog />
            <TitleEnforcer />
          </ToastProvider>
        </PrivyAppProvider>
      </body>
    </html>
  );
}
