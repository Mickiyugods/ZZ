// Browser-wallet connection via EIP-6963 discovery (MetaMask, Rabby, Coinbase, OKX...).

import { ethers } from './lib.js';
import { CHAIN } from './config.js';

const KEY = 'zeep.wallet';
const found = new Map(); // rdns -> { info, provider }

window.addEventListener('eip6963:announceProvider', (e) => {
  found.set(e.detail.info.rdns, e.detail);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

function remember(value) {
  try { value ? localStorage.setItem(KEY, value) : localStorage.removeItem(KEY); } catch {}
}
function recalled() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

class Wallet extends EventTarget {
  constructor() {
    super();
    this.address = null;
    this.chainId = null;
    this.raw = null;
    this.rdns = null;
  }

  list() {
    const out = [...found.values()];
    if (!out.length && window.ethereum) {
      out.push({ info: { rdns: 'injected', name: 'Browser wallet', icon: '' }, provider: window.ethereum });
    }
    return out;
  }

  get connected() { return !!this.address; }
  get onChain() { return this.chainId === CHAIN.id; }

  async connect(rdns) {
    const entry = this.list().find((w) => w.info.rdns === rdns);
    if (!entry) throw new Error('Wallet not found');
    const accounts = await entry.provider.request({ method: 'eth_requestAccounts' });
    await this._attach(entry, accounts);
  }

  async restore() {
    const rdns = recalled();
    if (!rdns) return;
    await new Promise((r) => setTimeout(r, 150));
    const entry = this.list().find((w) => w.info.rdns === rdns);
    if (!entry) return;
    try {
      const accounts = await entry.provider.request({ method: 'eth_accounts' });
      if (accounts.length) await this._attach(entry, accounts);
    } catch {}
  }

  disconnect() {
    this._detach();
    this.address = null;
    this.chainId = null;
    this.raw = null;
    this.rdns = null;
    remember(null);
    this._emit();
  }

  async _attach(entry, accounts) {
    this._detach();
    this.raw = entry.provider;
    this.rdns = entry.info.rdns;
    this.address = ethers.getAddress(accounts[0]);
    this.chainId = Number(await this.raw.request({ method: 'eth_chainId' }));
    remember(this.rdns);

    this._onAccounts = (list) => {
      if (!list.length) return this.disconnect();
      this.address = ethers.getAddress(list[0]);
      this._emit();
    };
    this._onChain = (hex) => { this.chainId = Number(hex); this._emit(); };
    this.raw.on?.('accountsChanged', this._onAccounts);
    this.raw.on?.('chainChanged', this._onChain);
    this._emit();
  }

  _detach() {
    if (!this.raw) return;
    this.raw.removeListener?.('accountsChanged', this._onAccounts);
    this.raw.removeListener?.('chainChanged', this._onChain);
  }

  async ensureChain() {
    if (!this.raw) throw new Error('Connect a wallet first');
    const current = Number(await this.raw.request({ method: 'eth_chainId' }));
    if (current === CHAIN.id) return;
    try {
      await this.raw.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hex }] });
    } catch (err) {
      if (err.code !== 4902 && err?.data?.originalError?.code !== 4902) throw new Error('Switch to Robinhood Chain in your wallet');
      await this.raw.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CHAIN.hex, chainName: CHAIN.name, nativeCurrency: CHAIN.currency,
          rpcUrls: [CHAIN.rpc], blockExplorerUrls: [CHAIN.explorer]
        }]
      });
    }
    this.chainId = CHAIN.id;
    this._emit();
  }

  async signer() {
    await this.ensureChain();
    return new ethers.BrowserProvider(this.raw, CHAIN.id).getSigner();
  }

  _emit() { this.dispatchEvent(new Event('change')); }
}

export const wallet = new Wallet();
