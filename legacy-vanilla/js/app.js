// ZEEP — router, header and wallet dialog.

import { wallet } from './wallet.js';
import { $, $$, esc, short, toast } from './ui.js';
import { ethBalance } from './chain.js';
import { CHAIN } from './config.js';
import home from './views/home.js';
import explore from './views/explore.js';
import launch from './views/launch.js';
import coin from './views/coin.js';
import cards from './views/cards.js';

const routes = [
  { match: /^\/$/, view: home, nav: 'home', title: 'ZEEP — memecoins with a vault inside' },
  { match: /^\/explore\/?$/, view: explore, nav: 'explore', title: 'Explore · ZEEP' },
  { match: /^\/cards\/?$/, view: cards, nav: 'cards', title: 'Card Vaults · ZEEP' },
  { match: /^\/launch\/?$/, view: launch, nav: 'launch', title: 'Launch · ZEEP' },
  { match: /^\/coin\/(0x[0-9a-fA-F]{40})\/?$/, view: coin, nav: 'explore', title: 'ZEEP' }
];

let cleanup = null;
let renderSeq = 0;

async function render() {
  const view = $('#view');
  cleanup?.();
  cleanup = null;
  const seq = ++renderSeq;

  const path = location.pathname;
  const route = routes.find((r) => r.match.test(path));
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', !!route && a.dataset.nav === route.nav));
  $('#menuToggle')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-open');

  if (!route) {
    document.title = 'Not found · ZEEP';
    view.innerHTML = `<section class="wrap" style="padding:80px 0;text-align:center">
      <h1 style="font-size:36px">This vault is empty</h1>
      <p class="dim" style="margin-top:10px">That page doesn't exist.</p>
      <a class="btn btn-primary" style="margin-top:20px" href="/" data-link>Back home</a>
    </section>`;
    return;
  }
  document.title = route.title;
  const params = path.match(route.match).slice(1);
  const host = document.createElement('div');
  view.replaceChildren(host);
  window.scrollTo(0, 0);
  const done = (await route.view(host, ...params)) || null;
  if (seq !== renderSeq) return done?.();
  cleanup = done;
}

export function go(href) {
  if (href === location.pathname + location.search) return;
  history.pushState(null, '', href);
  render();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.preventDefault();
  go(url.pathname + url.search);
});
window.addEventListener('popstate', render);

$('#menuToggle')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
$('#sidebarBackdrop')?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

// ── wallet button(s) + dialog ─────────────────────────────────
// Two buttons share the same markup: one lives in the desktop sidebar, one in the
// mobile topbar (the sidebar itself is off-canvas on mobile, so its button is hidden there).

function paintWalletButton() {
  $$('.wallet-btn').forEach((btn) => {
    if (!wallet.connected) {
      btn.className = btn.classList.contains('btn-sm') ? 'btn btn-primary btn-sm wallet-btn' : 'btn btn-ghost btn-block wallet-btn';
      btn.textContent = 'Connect wallet';
      return;
    }
    btn.className = btn.classList.contains('btn-sm') ? 'btn btn-ghost btn-sm wallet-btn' : 'btn btn-ghost btn-block wallet-btn';
    btn.innerHTML = wallet.onChain
      ? `<span class="mono">${esc(short(wallet.address))}</span>`
      : `Wrong network`;
  });
}

let dlg = null;
function dialogEl() {
  if (dlg) return dlg;
  dlg = document.createElement('div');
  dlg.className = 'dialog-backdrop';
  dlg.hidden = true;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) return closeWallet();
    const opt = e.target.closest('[data-rdns]');
    if (opt) {
      opt.disabled = true;
      try {
        await wallet.connect(opt.dataset.rdns);
        closeWallet();
        if (!wallet.onChain) await wallet.ensureChain().catch(() => toast('Switch to Robinhood Chain in your wallet to trade', 'error'));
      } catch (err) {
        toast(err?.code === 4001 ? 'Connection rejected' : 'Could not connect this wallet', 'error');
        opt.disabled = false;
      }
    }
    if (e.target.closest('[data-switch]')) {
      try { await wallet.ensureChain(); closeWallet(); } catch (err) { toast(err.message, 'error'); }
    }
    if (e.target.closest('[data-disconnect]')) {
      wallet.disconnect();
      closeWallet();
    }
    if (e.target.closest('[data-copy]')) {
      navigator.clipboard?.writeText(wallet.address).then(() => toast('Address copied', 'success')).catch(() => {});
    }
  });
  return dlg;
}
function closeWallet() { dialogEl().hidden = true; }

export function openWallet() {
  const el = dialogEl();
  if (wallet.connected) {
    el.innerHTML = `<div class="dialog">
      <h3>Your wallet</h3>
      <div class="field">
        <div class="dim" style="font-size:13px">${wallet.onChain ? CHAIN.name : 'Wrong network — switch to ' + CHAIN.name}</div>
        <div class="mono" style="font-size:16px;margin-top:6px">${esc(short(wallet.address))}</div>
        <div class="mono dim" style="margin-top:8px" id="wdBal">Balance …</div>
      </div>
      ${wallet.onChain ? '' : '<button class="btn btn-primary btn-block" data-switch>Switch to Robinhood Chain</button>'}
      <button class="btn btn-ghost btn-block" data-copy style="margin-top:8px">Copy address</button>
      <button class="btn btn-ghost btn-block" data-disconnect style="margin-top:8px">Disconnect</button>
    </div>`;
    ethBalance(wallet.address).then((wei) => {
      const b = $('#wdBal', el);
      if (b) b.textContent = `${(Number(wei) / 1e18).toFixed(4)} ETH`;
    }).catch(() => {});
  } else {
    const list = wallet.list();
    el.innerHTML = `<div class="dialog">
      <h3>Connect a wallet</h3>
      <p class="dim" style="font-size:13px;margin-bottom:14px">ZEEP runs on ${esc(CHAIN.name)}. Your wallet may ask to add or switch to it.</p>
      ${list.length ? list.map((w) => `
        <button class="wallet-opt" data-rdns="${esc(w.info.rdns)}">
          ${w.info.icon ? `<img src="${esc(w.info.icon)}" width="22" height="22" alt="">` : '<span class="mark" style="width:22px;height:22px;font-size:12px">W</span>'}
          <span>${esc(w.info.name)}</span>
        </button>`).join('') : `<p class="dim" style="font-size:13px">No browser wallet found. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener" style="color:var(--lime)">MetaMask</a> or <a href="https://rabby.io" target="_blank" rel="noopener" style="color:var(--lime)">Rabby</a>.</p>`}
    </div>`;
  }
  el.hidden = false;
}

$$('.wallet-btn').forEach((btn) => btn.addEventListener('click', () => openWallet()));
wallet.addEventListener('change', paintWalletButton);

paintWalletButton();
wallet.restore();
render();
