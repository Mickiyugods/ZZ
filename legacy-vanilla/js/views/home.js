import { esc, fmtEth, fmtInt, policyLabel } from '../ui.js';
import { listCoins } from '../api.js';
import { coinCard } from './explore.js';

const MECH = [
  ['PAIRING', 'locked at launch'],
  ['FEE SPLIT', '80% vault / 20% protocol'],
  ['SPEND CAP', 'price ≤ posted ceiling'],
  ['CEILING TTL', 'expires in 1 hour'],
  ['MARKETPLACE', 'Seaport 1.6 only'],
  ['WITHDRAWALS', 'disabled by design'],
  ['HARVEST', 'callable by anyone'],
  ['DRAW SOURCE', 'future block hash'],
  ['OUTCOME', 'raffle, hold or burn'],
  ['ADMIN KEYS', 'none on the vault']
];

const STACK = [
  { name: 'Pudgy Penguins', price: '6.21 ETH' },
  { name: 'Cash Cats', price: '0.17 ETH' },
  { name: 'Milady Maker', price: '1.9 ETH' }
];

export default async function home(host) {
  host.innerHTML = `
    <section class="wrap hero">
      <div class="hero-grid">
        <div>
          <h1>Trade a coin.<br>Fund a <span class="accent">vault</span>.</h1>
          <p class="lead">Launch a coin on Robinhood Chain and link it to a real NFT collection. Most of every trading fee streams straight into an on-chain vault that can only buy that collection's cheapest piece — then raffles it, holds it, or burns it, exactly as set at launch.</p>
          <div class="hero-cta">
            <a class="btn btn-primary" href="/launch" data-link>Launch a coin</a>
            <a class="btn btn-ghost" href="/explore" data-link>Explore coins</a>
          </div>
          <div class="hero-note"><span class="dot"></span><span id="heroNote">Loading live totals…</span></div>
        </div>
        <div class="card-stack" id="stack"></div>
      </div>

      <div class="stats-strip" id="statsStrip">
        <div class="stat"><div class="num">—</div><div class="label">Coins launched</div></div>
        <div class="stat"><div class="num">—</div><div class="label">NFTs collected</div></div>
        <div class="stat"><div class="num">—</div><div class="label">ETH in vaults</div></div>
      </div>
    </section>

    <section class="wrap section">
      <div class="cards-teaser">
        <div>
          <span class="badge-new">New · Card Vaults</span>
          <h3>Vaults that hunt real cards.</h3>
          <p>Pair a coin with Pokémon or One Piece listings. Its vault stacks graded cards as it goes and raffles them straight to holders.</p>
        </div>
        <a class="btn btn-primary" href="/cards" data-link>See Card Vaults →</a>
      </div>
    </section>

    <section class="wrap section">
      <div class="section-head">
        <h2>How the vault works</h2>
        <p>Every launch is bound to these rules on day one. Nothing here can change after the coin ships.</p>
      </div>
      <div class="mech-grid">
        ${MECH.map(([k, v]) => `<div class="mech-cell"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}
      </div>
    </section>

    <section class="wrap section">
      <div class="section-head" style="display:flex;align-items:center;justify-content:space-between;max-width:none">
        <div>
          <h2>Recent launches</h2>
          <p>Freshest coins, straight off the factory.</p>
        </div>
        <a class="btn btn-ghost btn-sm" href="/explore" data-link>View all →</a>
      </div>
      <div class="coin-grid" id="recentGrid">
        <div class="dim" style="grid-column:1/-1">Loading…</div>
      </div>
    </section>
  `;

  const stack = host.querySelector('#stack');
  stack.innerHTML = STACK.map((c, i) => `
    <div class="stack-card" style="left:${8 + i * 26}%; top:${10 + i * 8}%; transform: rotate(${(i - 1) * 7}deg)">
      <div class="thumb"></div>
      <div class="name">${esc(c.name)}</div>
      <div class="price mono">${esc(c.price)}</div>
    </div>`).join('') + `
    <div class="stack-card center">
      <div class="thumb"></div>
      <div class="name">ZEEP vault</div>
      <div class="price mono">live</div>
    </div>`;

  try {
    const data = await listCoins({ list: 'new' });
    const strip = host.querySelector('#statsStrip');
    strip.innerHTML = `
      <div class="stat"><div class="num">${fmtInt(data.coins)}</div><div class="label">Coins launched</div></div>
      <div class="stat"><div class="num">${fmtInt(data.nftsHeld)}</div><div class="label">NFTs collected</div></div>
      <div class="stat"><div class="num">${fmtEth(data.vaultEth)}</div><div class="label">ETH in vaults</div></div>
    `;
    host.querySelector('#heroNote').textContent = `${fmtInt(data.coins)} coins live · ${fmtEth(data.vaultEth)} ETH working in vaults`;

    const grid = host.querySelector('#recentGrid');
    const rows = data.rows.slice(0, 6);
    grid.innerHTML = rows.length ? rows.map(coinCard).join('') : `
      <div class="empty-state" style="grid-column:1/-1">No coins launched yet. <a href="/launch" data-link style="color:var(--lime)">Be the first →</a></div>`;
  } catch {
    host.querySelector('#heroNote').textContent = 'Live totals unavailable right now.';
    host.querySelector('#recentGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1">Could not load coins. <a href="/" data-link style="color:var(--lime)">Retry</a></div>`;
  }
}
