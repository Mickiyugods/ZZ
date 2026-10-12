import { fmtEth, fmtInt } from '../ui.js';
import { listCoins } from '../api.js';
import { coinCard } from './explore.js';

export default async function cards(host) {
  host.innerHTML = `
    <section class="wrap tcg-hero">
      <h1>Vaults that hunt <span class="accent">real cards</span>.</h1>
      <p>Pair a coin with a Pokémon or One Piece listing on launch. Every trade feeds its vault, which buys graded cards on the open market and raffles them straight to holders.</p>
      <div class="tcg-tag-row">
        <span class="tcg-tag">Pokémon</span>
        <span class="tcg-tag">One Piece</span>
        <span class="tcg-tag">More sets soon</span>
      </div>
      <div style="margin-top:24px">
        <a class="btn btn-primary" href="/launch" data-link>Launch a card vault</a>
      </div>
    </section>

    <section class="wrap explore-stats" id="stats" style="margin:32px auto 8px">
      <div class="stat"><div class="label">Card vaults</div><div class="num">—</div></div>
      <div class="stat"><div class="label">ETH in vaults</div><div class="num">—</div></div>
      <div class="stat"><div class="label">Cards held</div><div class="num">—</div></div>
      <div class="stat"><div class="label">Fees awaiting</div><div class="num">—</div></div>
    </section>

    <section class="wrap section">
      <div class="coin-grid" id="grid"><div class="dim">Loading…</div></div>
    </section>
  `;

  try {
    const data = await listCoins({ list: 'new' });
    const rows = data.rows.filter((r) => r.category === 'cards');
    const totals = rows.reduce((a, r) => {
      a.vault += r.vault_eth || 0; a.nfts += r.nfts_held || 0; a.fees += r.fees_awaiting || 0; return a;
    }, { vault: 0, nfts: 0, fees: 0 });

    host.querySelector('#stats').innerHTML = `
      <div class="stat"><div class="label">Card vaults</div><div class="num">${fmtInt(rows.length)}</div></div>
      <div class="stat"><div class="label">ETH in vaults</div><div class="num">${fmtEth(totals.vault)}</div></div>
      <div class="stat"><div class="label">Cards held</div><div class="num">${fmtInt(totals.nfts)}</div></div>
      <div class="stat"><div class="label">Fees awaiting</div><div class="num">${fmtEth(totals.fees)} ETH</div></div>`;

    host.querySelector('#grid').innerHTML = rows.length ? rows.map(coinCard).join('') :
      `<div class="empty-state" style="grid-column:1/-1">No card vaults yet. <a href="/launch" data-link style="color:var(--lime)">Launch the first one →</a></div>`;
  } catch {
    host.querySelector('#grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1">Could not load card vaults.</div>`;
  }
}
