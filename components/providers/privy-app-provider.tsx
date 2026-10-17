"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { robinhoodChain } from "@/lib/privyChain";
import { WalletBridge } from "./wallet-bridge";

// Detects browser Solana wallets (Phantom, Solflare, …) so the gacha flow can
// pay in USDC on Solana. ZEEP's own core still runs on Robinhood Chain (EVM);
// Solana is scoped to the Collector Crypt gacha only.
const solanaConnectors = toSolanaWalletConnectors();

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  // No app id configured (e.g. local dev without the secret set) — render the
  // app with wallet connect disabled instead of crashing on a missing id.
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#FFFFFF",
          walletChainType: "ethereum-and-solana",
        },
        defaultChain: robinhoodChain,
        supportedChains: [robinhoodChain],
        externalWallets: { solana: { connectors: solanaConnectors } },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <WalletBridge />
      {children}
    </PrivyProvider>
  );
}
