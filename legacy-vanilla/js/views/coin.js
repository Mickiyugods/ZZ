import { esc, short, fmtEth, fmtInt, toast, policyLabel } from '../ui.js';
import { listCoins } from '../api.js';
import { wallet } from '../wallet.js';
import { openWallet } from '../app.js';
import * as chain from '../chain.js';
import { DEFAULT_SLIPPAGE, SLIPPAGE_OPTIONS } from '../config.js';

export default async function coin(host, address) {
  host.innerHTML = `<div class="wrap" style="padding:60px 0"><p class="dim">Loading coin…</p></div>`;

  let row, onChain;
  try {
    const data = await listCoins({});
    row = data.rows.find((r) => r.token.toLowerCase() === address.toLowerCase());
    if (!row) throw new Error('not found');
  } catch {
    host.innerHTML = `<div class="wrap" style="padding:60px 0;text-align:center">
      <h1>Coin not found</h1>
      <p class="dim" style="margin-top:10px">This address was not launched through ZEEP.</p>
      <a class="btn btn-primary" href="/explore" data-link style="margin-top:20px;display:inline-flex">Back to Explore</a>
    </div>`;
    return;
  }

  try { onChain = await chain.readToken(row.token); } catch { onChain = null; }

  document.title = `$${row.symbol} · ZEEP`;

  let tab = 'buy';
  let amount = '';
  let slippage = DEFAULT_SLIPPAGE;
  let quote = null;
  let busy = false;

  function render() {
    host.innerHTML = `
      <section class="wrap coin-head">
        <div class="logo"></div>
        <div>
          <h1>${esc(row.name)} <span class="dim mono" style="font-size:18px">$${esc(row.symbol)}</span></h1>
          <div class="dim mono" style="font-size:13px;margin-top:4px">${esc(short(row.token))} · ${esc(row.chain)}</div>
        </div>
      </section>

      <section class="wrap coin-detail-grid" style="padding-bottom:80px">
        <div>
          <div class="panel">
            <h3>Vault</h3>
            <div class="raffle-row"><span class="dim">Vault balance</span><span class="mono">${fmtEth(row.vault_eth)} ETH</span></div>
            <div class="raffle-row"><span class="dim">NFTs held</span><span class="mono">${fmtInt(row.nfts_held)}</span></div>
            <div class="raffle-row"><span class="dim">Fees awaiting harvest</span><span class="mono">${fmtEth(row.fees_awaiting)} ETH</span></div>
            <div class="raffle-row"><span class="dim">Collects</span><span>${esc(row.collection_name)}</span></div>
            <div class="raffle-row"><span class="dim">Outcome</span><span>${esc(policyLabel(row.policy))}</span></div>
            <div class="raffle-row"><span class="dim">Marketplace</span><span>Seaport 1.6 only</span></div>
          </div>
          <div class="panel">
            <h3>Draws</h3>
            <div class="empty-state">No draws yet. The vault raffles the moment it buys a piece from ${esc(row.collection_name)}.</div>
          </div>
          <div class="panel">
            <h3>About</h3>
            <p class="dim" style="font-size:14px;line-height:1.6">${esc(row.description || 'No description provided.')}</p>
            <div class="raffle-row"><span class="dim">Deployer</span><span class="mono">${esc(short(row.deployer))}</span></div>
            <div class="raffle-row"><span class="dim">Launched</span><span class="mono">${new Date(row.launched_at).toLocaleDateString()}</span></div>
          </div>
        </div>

        <div>
          <div class="panel" id="tradePanel"></div>
        </div>
      </section>
    `;
    renderTrade();
  }

  function renderTrade() {
    const panel = host.querySelector('#tradePanel');
    if (!onChain) {
      panel.innerHTML = `<h3>Trade</h3><p class="dim" style="font-size:13px">Live curve data is unavailable right now.</p>`;
      return;
    }
    panel.innerHTML = `
      <div class="tabs" style="margin-bottom:16px">
        <button data-tab="buy" class="${tab === 'buy' ? 'active' : ''}" style="flex:1">Buy</button>
        <button data-tab="sell" class="${tab === 'sell' ? 'active' : ''}" style="flex:1">Sell</button>
      </div>
      <div class="field">
        <label>${tab === 'buy' ? 'You pay (ETH)' : 'You sell (tokens)'}</label>
        <input type="number" id="amt" min="0" step="any" placeholder="0.0" value="${esc(amount)}">
      </div>
      <div class="field">
        <label>Slippage</label>
        <div class="pill-select">
          ${SLIPPAGE_OPTIONS.map((s) => `<button type="button" data-slip="${s}" class="${slippage === s ? 'active' : ''}">${s}%</button>`).join('')}
        </div>
      </div>
      <div class="dim mono" style="font-size:13px;margin:12px 0" id="quoteLine">${quote ? `Est. ${quote}` : ''}</div>
      ${!wallet.connected
        ? '<button class="btn btn-primary btn-block" id="goConnect">Connect wallet</button>'
        : `<button class="btn btn-primary btn-block" id="goTrade" ${busy ? 'disabled' : ''}>${busy ? 'Working…' : tab === 'buy' ? 'Buy' : 'Sell'}</button>`}
      ${onChain.graduated ? '<p class="hint" style="margin-top:10px">This coin graduated — trade it on Pons directly.</p>' : ''}
    `;
    panel.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; amount = ''; quote = null; renderTrade(); }));
    panel.querySelectorAll('[data-slip]').forEach((b) => b.addEventListener('click', () => { slippage = Number(b.dataset.slip); renderTrade(); }));
    panel.querySelector('#amt').addEventListener('input', async (e) => {
      amount = e.target.value;
      if (!amount || Number(amount) <= 0) { quote = null; return renderTrade(); }
      try {
        const { ethers } = await import('../lib.js');
        if (tab === 'buy') {
          const { out } = await chain.quoteBuy(row.curve, ethers.parseEther(amount));
          quote = `≈ ${ethers.formatUnits(out, 18)} ${row.symbol}`;
        } else {
          const { out } = await chain.quoteSell(row.curve, ethers.parseUnits(amount, 18));
          quote = `≈ ${ethers.formatEther(out)} ETH`;
        }
      } catch { quote = null; }
      const line = panel.querySelector('#quoteLine');
      if (line) line.textContent = quote ? `Est. ${quote}` : '';
    });
    panel.querySelector('#goConnect')?.addEventListener('click', openWallet);
    panel.querySelector('#goTrade')?.addEventListener('click', doTrade);
  }

  async function doTrade() {
    if (!amount || Number(amount) <= 0) return toast('Enter an amount', 'error');
    busy = true;
    renderTrade();
    try {
      const { ethers } = await import('../lib.js');
      if (tab === 'buy') {
        await chain.buy(row.curve, ethers.parseEther(amount), slippage);
      } else {
        await chain.sell(row.token, row.curve, ethers.parseUnits(amount, 18), slippage);
      }
      toast('Trade confirmed', 'success');
      amount = '';
      quote = null;
    } catch (err) {
      toast(err?.code === 4001 || err?.code === 'ACTION_REJECTED' ? 'Transaction rejected' : (err.message || 'Trade failed'), 'error');
    } finally {
      busy = false;
      renderTrade();
    }
  }

  render();
  wallet.addEventListener('change', renderTrade);
  return () => wallet.removeEventListener('change', renderTrade);
}
