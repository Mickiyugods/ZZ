import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { SiteFooter } from "@/components/site-footer";
import { WalletDialog } from "@/components/wallet-dialog";
import { AiAgent } from "@/components/ai-agent";
import { PrivyAppProvider } from "@/components/providers/privy-app-provider";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: "ZEEP — memecoins with a vault inside",
  description:
    "Launch a coin on Robinhood Chain, link it to any listed NFT collection, and let a share of every trade buy real NFTs for a raffle, hold or burn.",
  openGraph: {
    type: "website",
    title: "ZEEP — memecoins with a vault inside",
    description: "A coin with a vault inside. Trading fees buy real NFTs and graded cards for holders.",
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
            <AiAgent />
          </ToastProvider>
        </PrivyAppProvider>
      </body>
    </html>
  );
}
