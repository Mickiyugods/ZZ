// Wallet connection, backed by Privy (components/providers/wallet-bridge.tsx
// pushes Privy's React state into this plain EventTarget singleton). Kept as a
// module-level singleton — not a hook — because lib/chain.ts needs to grab a
// signer from plain async functions outside the React tree.

import { ethers } from "ethers";
import { CHAIN } from "./config";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/** Privy is only mounted when an app id is configured (privy-app-provider.tsx). */
export const PRIVY_ENABLED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
/** DEV-ONLY: without Privy, local previews can "connect" a read-only demo
 * wallet to show the connected UI. It can never sign, and never ships. */
export const DEMO_WALLET_ENABLED = !PRIVY_ENABLED && process.env.NODE_ENV !== "production";
// The deployer of the seeded local demo coin, so /profile has something to show.
const DEMO_ADDRESS = "0x83e92CdB45e8334B4B7f21251E820c9788042fDF";
const DEMO_KEY = "zeep.demoWallet";

interface WalletHandlers {
  login: () => void;
  logout: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
}

class WalletStore extends EventTarget {
  address: string | null = null;
  chainId: number | null = null;
  raw: Eip1193Provider | null = null;
  /** True once Privy has finished checking for a restored session. */
  ready = false;
  /** Connected to the dev-only demo wallet (read-only). */
  demo = false;

  private handlers: WalletHandlers | null = null;

  get connected() {
    return !!this.address;
  }
  get onChain() {
    return this.chainId === CHAIN.id;
  }

  /** Called by WalletBridge whenever Privy's auth/wallet state changes. */
  sync(next: { address: string | null; chainId: number | null; raw: Eip1193Provider | null }) {
    this.address = next.address;
    this.chainId = next.chainId;
    this.raw = next.raw;
    this.ready = true;
    this.emit();
  }

  /** Called once by WalletBridge to wire up Privy's login/logout/switchChain. */
  registerHandlers(handlers: WalletHandlers) {
    this.handlers = handlers;
  }

  connect() {
    if (!this.handlers) throw new Error("Wallet connector isn't ready yet");
    this.handlers.login();
  }

  connectDemo() {
    if (!DEMO_WALLET_ENABLED) return;
    this.address = DEMO_ADDRESS;
    this.chainId = CHAIN.id;
    this.raw = null;
    this.demo = true;
    this.ready = true;
    try {
      localStorage.setItem(DEMO_KEY, "1");
    } catch {}
    this.emit();
  }

  /** Re-connects the demo wallet after a reload (call once, client-side). */
  restoreDemo() {
    try {
      if (DEMO_WALLET_ENABLED && localStorage.getItem(DEMO_KEY) === "1") this.connectDemo();
    } catch {}
  }

  async disconnect() {
    if (this.demo) {
      this.address = this.chainId = this.raw = null;
      this.demo = false;
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {}
      this.emit();
      return;
    }
    if (!this.handlers) return;
    await this.handlers.logout();
  }

  async ensureChain() {
    if (this.demo) throw new Error("Demo wallet is read-only — it can't sign transactions");
    if (!this.raw) throw new Error("Connect a wallet first");
    if (this.chainId === CHAIN.id) return;
    if (!this.handlers) throw new Error("Wallet connector isn't ready yet");
    await this.handlers.switchChain(CHAIN.id);
  }

  async signer() {
    await this.ensureChain();
    return new ethers.BrowserProvider(this.raw as ethers.Eip1193Provider, CHAIN.id).getSigner();
  }

  private emit() {
    this.dispatchEvent(new Event("change"));
  }
}

export const wallet = new WalletStore();
