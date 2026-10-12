import { esc, fmtEth, fmtInt, timeAgo, policyLabel } from '../ui.js';
import { listCoins } from '../api.js';

export function coinCard(r) {
  const logo = r.logo ? `<img src="${esc(r.logo)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '';
  return `
  <a class="coin-card" href="/coin/${esc(r.token)}" data-link>
    <div class="coin-thumb">${logo}<span class="policy-pill policy-${esc(r.policy)}">${esc(policyLabel(r.policy))}</span></div>
    <div class="coin-body">
      <div class="name-row"><span class="name">${esc(r.name)}</span></div>
      <div class="coin-chain"><span class="chip"></span>${esc(r.chain)}</div>
      <div class="collects-row">Collects <strong>${esc(r.collection_name)}</strong></div>
      <div class="vault-row">
        <span class="dim">Vault</span>
        <span>${fmtEth(r.vault_eth)} ETH <span class="dim">· ${fmtInt(r.nfts_held)} NFTs</span></span>
      </div>
    </div>
  </a>`;
}

export default async function explore(host) {
  host.innerHTML = `
    <section class="wrap explore-head">
      <h1>Explore</h1>
      <div class="filter-row">
        <div class="tabs" id="tabs">
          <button data-list="new" class="active">New</button>
          <button data-list="top">Top vault</button>
          <button data-list="nfts">Most NFTs</button>
        </div>
      </div>
      <input class="search-input" id="search" type="text" placeholder="Search by name, ticker or collection">
      <div class="explore-stats" id="stats">
        <div class="stat"><div class="label">Coins</div><div class="num">—</div></div>
        <div class="stat"><div class="label">ETH in vaults</div><div class="num">—</div></div>
        <div class="stat"><div class="label">NFTs held</div><div class="num">—</div></div>
        <div class="stat"><div class="label">Fees awaiting</div><div class="num">—</div></div>
      </div>
    </section>
    <section class="wrap" style="padding-bottom:64px">
      <div class="coin-grid" id="grid"><div class="dim">Loading…</div></div>
    </section>
  `;

  let list = 'new';
  let search = '';
  let t;

  async function load() {
    const grid = host.querySelector('#grid');
    grid.innerHTML = `<div class="dim">Loading…</div>`;
    try {
      const data = await listCoins({ list, search });
      host.querySelector('#stats').innerHTML = `
        <div class="stat"><div class="label">Coins</div><div class="num">${fmtInt(data.coins)}</div></div>
        <div class="stat"><div class="label">ETH in vaults</div><div class="num">${fmtEth(data.vaultEth)}</div></div>
        <div class="stat"><div class="label">NFTs held</div><div class="num">${fmtInt(data.nftsHeld)}</div></div>
        <div class="stat"><div class="label">Fees awaiting</div><div class="num">${fmtEth(data.feesAwaiting)} ETH</div></div>`;
      grid.innerHTML = data.rows.length ? data.rows.map(coinCard).join('') :
        `<div class="empty-state" style="grid-column:1/-1">No coins match yet.</div>`;
    } catch {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Could not load the registry.</div>`;
    }
  }

  host.querySelector('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-list]');
    if (!btn) return;
    host.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    list = btn.dataset.list;
    load();
  });
  host.querySelector('#search').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { search = e.target.value; load(); }, 250);
  });

  load();
}
