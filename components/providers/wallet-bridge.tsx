"use client";

import * as React from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { wallet } from "@/lib/wallet";

// Keeps lib/wallet.ts's plain singleton in sync with Privy's React state, and
// wires its connect/disconnect/ensureChain methods to Privy's actual login,
// logout and per-wallet switchChain calls. Mounted once, inside PrivyProvider.
export function WalletBridge() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const active = wallets[0] ?? null;

  React.useEffect(() => {
    wallet.registerHandlers({
      login,
      logout,
      switchChain: async (chainId) => {
        if (!active) throw new Error("Connect a wallet first");
        await active.switchChain(chainId);
      },
    });
  }, [login, logout, active]);

  React.useEffect(() => {
    if (!ready) return;
    if (!authenticated || !active) {
      wallet.sync({ address: null, chainId: null, raw: null });
      return;
    }

    let cancelled = false;
    let detach: (() => void) | null = null;

    (async () => {
      const provider = await active.getEthereumProvider();
      if (cancelled) return;

      const refresh = async () => {
        const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
        wallet.sync({ address: active.address, chainId: Number(chainIdHex), raw: provider });
      };

      const onChainChanged = () => void refresh();
      const onAccountsChanged = () => void refresh();
      provider.on?.("chainChanged", onChainChanged);
      provider.on?.("accountsChanged", onAccountsChanged);
      detach = () => {
        provider.removeListener?.("chainChanged", onChainChanged);
        provider.removeListener?.("accountsChanged", onAccountsChanged);
      };

      await refresh();
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [ready, authenticated, active]);

  return null;
}
