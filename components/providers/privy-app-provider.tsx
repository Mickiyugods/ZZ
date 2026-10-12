"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { robinhoodChain } from "@/lib/privyChain";
import { WalletBridge } from "./wallet-bridge";

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
          accentColor: "#D6FF3F",
        },
        defaultChain: robinhoodChain,
        supportedChains: [robinhoodChain],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <WalletBridge />
      {children}
    </PrivyProvider>
  );
}
