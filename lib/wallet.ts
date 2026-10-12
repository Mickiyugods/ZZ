// Wallet connection, backed by Privy (components/providers/wallet-bridge.tsx
// pushes Privy's React state into this plain EventTarget singleton). Kept as a
// module-level singleton — not a hook — because lib/chain.ts needs to grab a
// signer from plain async functions outside the React tree.

import { ethers } from "ethers";
import { CHAIN } from "./config";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

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

  async disconnect() {
    if (!this.handlers) return;
    await this.handlers.logout();
  }

  async ensureChain() {
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
