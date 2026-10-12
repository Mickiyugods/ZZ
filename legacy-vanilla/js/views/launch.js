import { esc, fmtEth, toast } from '../ui.js';
import { COLLECTIONS, byCategory, findCollection } from '../collections.js';
import { VAULT, MAX_CREATOR_TAX_BPS } from '../config.js';
import { wallet } from '../wallet.js';
import { openWallet, go } from '../app.js';
import * as chain from '../chain.js';
import { registerCoin } from '../api.js';

const STEPS = [
  { key: 'coin', label: 'Coin', sub: 'Name and image' },
  { key: 'collection', label: 'Collection', sub: 'What it collects' },
  { key: 'rules', label: 'Rules', sub: 'NFTs and tax' },
  { key: 'confirm', label: 'Confirm', sub: 'Check and launch' }
];
const TAX_PRESETS = [0, 100, 200, 300];
const CATS = [['pfp', 'PFP'], ['art', 'Art'], ['cards', 'Cards']];

export default function launch(host) {
  const state = {
    step: 0,
    name: '', symbol: '', logo: '', description: '', twitter: '', website: '',
    category: 'pfp', collectionSlug: '', customCollectionName: '',
    policy: 'raffle', creatorTaxBps: 100,
    busy: false, launchStatus: ''
  };

  function render() {
    const collection = findCollection(state.collectionSlug);
    host.innerHTML = `
      <section class="wrap" style="padding:48px 0 80px;max-width:760px">
        <h1 style="font-size:38px">Launch a coin</h1>
        <p class="dim" style="margin-top:10px">Create a Pons coin on Robinhood Chain whose trading fees fund a vault. Fill in four short steps, then confirm one transaction.</p>

        <div class="wizard-steps">
          ${STEPS.map((s, i) => `
            <div class="wizard-step ${i === state.step ? 'active' : ''} ${i < state.step ? 'done' : ''}">
              <span class="idx">${i < state.step ? '✓' : i + 1}</span>
              <span><span class="label-main">${esc(s.label)}</span><br><span class="label-sub">${esc(s.sub)}</span></span>
            </div>`).join('')}
        </div>

        <div class="form-panel" id="stepHost"></div>

        <div class="summary-panel" style="margin-top:20px">
          <div class="summary-row"><span class="dim">Collects</span><span class="v">${collection ? esc(collection.name) : state.customCollectionName ? esc(state.customCollectionName) : '—'}</span></div>
          <div class="summary-row"><span class="dim">Outcome</span><span class="v">${{ raffle: 'Raffle to holders', hold: 'Hold in vault', burn: 'Burn' }[state.policy]}</span></div>
          <div class="summary-row"><span class="dim">Creator tax</span><span class="v">${(state.creatorTaxBps / 100).toFixed(2)}%</span></div>
          <div class="summary-row"><span class="dim">Supply</span><span class="v">1,000,000,000</span></div>
          <div class="dim" style="font-size:12px;margin-top:14px">Every 1 ETH traded</div>
          <div class="flow-bar"><span style="width:80%;background:var(--lime)"></span><span style="width:20%;background:var(--text-faint)"></span></div>
          <div class="summary-row"><span class="dim">Collection vault</span><span class="v">${(VAULT.vaultBps / 10000).toFixed(2)} ETH</span></div>
          <div class="summary-row"><span class="dim">ZEEP treasury</span><span class="v">${(VAULT.protocolBps / 10000).toFixed(2)} ETH</span></div>
          <p class="dim" style="font-size:12px;margin-top:10px">Pons charges its own trade fee and passes a share to the fee router. The router sends 80% to the vault, 20% to the treasury. Gas and any Pons launch-block tax are not included.</p>
        </div>
      </section>
    `;
    renderStep();
  }

  function renderStep() {
    const el = host.querySelector('#stepHost');
    if (state.step === 0) {
      el.innerHTML = `
        <div class="field">
          <label>Coin name</label>
          <input type="text" id="f-name" maxlength="64" placeholder="e.g. Charizard Fund" value="${esc(state.name)}">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Ticker</label>
            <input type="text" id="f-symbol" maxlength="16" placeholder="e.g. CHZD" value="${esc(state.symbol)}">
          </div>
          <div class="field">
            <label>Logo URL</label>
            <input type="text" id="f-logo" placeholder="https://…" value="${esc(state.logo)}">
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea id="f-desc" rows="3" maxlength="2048" placeholder="What is this coin about?">${esc(state.description)}</textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label>X / Twitter <span class="dim">(optional)</span></label>
            <input type="text" id="f-twitter" placeholder="@handle" value="${esc(state.twitter)}">
          </div>
          <div class="field">
            <label>Website <span class="dim">(optional)</span></label>
            <input type="text" id="f-website" placeholder="https://…" value="${esc(state.website)}">
          </div>
        </div>`;
      el.querySelector('#f-name').oninput = (e) => state.name = e.target.value;
      el.querySelector('#f-symbol').oninput = (e) => state.symbol = e.target.value.toUpperCase();
      el.querySelector('#f-logo').oninput = (e) => state.logo = e.target.value;
      el.querySelector('#f-desc').oninput = (e) => state.description = e.target.value;
      el.querySelector('#f-twitter').oninput = (e) => state.twitter = e.target.value;
      el.querySelector('#f-website').oninput = (e) => state.website = e.target.value;
    }

    if (state.step === 1) {
      const list = byCategory(state.category);
      el.innerHTML = `
        <div class="field">
          <label>Category</label>
          <div class="pill-select" id="cat-pills">
            ${CATS.map(([k, label]) => `<button type="button" data-cat="${k}" class="${state.category === k ? 'active' : ''}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>Collection to collect</label>
          <div class="collection-grid" id="col-grid">
            ${list.map((c) => `
              <button type="button" class="collection-pick ${state.collectionSlug === c.slug ? 'active' : ''}" data-slug="${esc(c.slug)}">
                <span class="ic"></span>
                <span><span class="nm">${esc(c.name)}</span><br><span class="fl">${esc(c.chain)} · floor ${esc(c.floor)}</span></span>
              </button>`).join('')}
          </div>
          <p class="hint">Only listed collections can be linked. Don't see yours? Enter it below and we'll review it.</p>
        </div>
        <div class="field">
          <label>Or name a collection manually</label>
          <input type="text" id="f-custom" placeholder="e.g. Pokémon · Jungle Set" value="${esc(state.customCollectionName)}">
        </div>`;
      el.querySelector('#cat-pills').onclick = (e) => {
        const b = e.target.closest('button[data-cat]');
        if (!b) return;
        state.category = b.dataset.cat;
        state.collectionSlug = '';
        remount();
      };
      el.querySelector('#col-grid').onclick = (e) => {
        const b = e.target.closest('button[data-slug]');
        if (!b) return;
        state.collectionSlug = b.dataset.slug;
        state.customCollectionName = '';
        remount();
      };
      el.querySelector('#f-custom').oninput = (e) => {
        state.customCollectionName = e.target.value;
        if (e.target.value) state.collectionSlug = '';
      };
    }

    if (state.step === 2) {
      el.innerHTML = `
        <div class="field">
          <label>What happens to what the vault buys</label>
          <div class="pill-select" id="policy-pills">
            <button type="button" data-p="raffle" class="${state.policy === 'raffle' ? 'active' : ''}">Raffle to holders</button>
            <button type="button" data-p="hold" class="${state.policy === 'hold' ? 'active' : ''}">Hold in vault</button>
            <button type="button" data-p="burn" class="${state.policy === 'burn' ? 'active' : ''}">Burn</button>
          </div>
          <p class="hint">Fixed at launch. ZEEP never offers a way to change it afterwards.</p>
        </div>
        <div class="field">
          <label>Creator tax <span class="dim">on every trade, paid to you in ETH</span></label>
          <div class="pill-select" id="tax-pills">
            ${TAX_PRESETS.map((bps) => `<button type="button" data-bps="${bps}" class="${state.creatorTaxBps === bps ? 'active' : ''}">${(bps / 100).toFixed(0)}%</button>`).join('')}
            <button type="button" data-custom class="${!TAX_PRESETS.includes(state.creatorTaxBps) ? 'active' : ''}">Custom</button>
          </div>
          ${!TAX_PRESETS.includes(state.creatorTaxBps) ? `<input type="number" id="f-tax" min="0" max="${MAX_CREATOR_TAX_BPS / 100}" step="0.25" value="${(state.creatorTaxBps / 100).toFixed(2)}" style="margin-top:10px;max-width:140px">` : ''}
          <p class="hint">Capped at ${(MAX_CREATOR_TAX_BPS / 100).toFixed(0)}% by ZEEP.</p>
        </div>`;
      el.querySelector('#policy-pills').onclick = (e) => {
        const b = e.target.closest('button[data-p]');
        if (!b) return;
        state.policy = b.dataset.p;
        remount();
      };
      el.querySelector('#tax-pills').onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.bps !== undefined) state.creatorTaxBps = Number(b.dataset.bps);
        else state.creatorTaxBps = 50;
        remount();
      };
      const taxInput = el.querySelector('#f-tax');
      if (taxInput) taxInput.oninput = (e) => { state.creatorTaxBps = Math.max(0, Math.min(MAX_CREATOR_TAX_BPS, Math.round(Number(e.target.value) * 100))); };
    }

    if (state.step === 3) {
      const collection = findCollection(state.collectionSlug);
      const collectionName = collection ? collection.name : state.customCollectionName;
      const ready = state.name && state.symbol && collectionName && state.policy;
      el.innerHTML = `
        <div class="field"><label>Name</label><div>${esc(state.name) || '<span class="dim">—</span>'}</div></div>
        <div class="field"><label>Ticker</label><div class="mono">${esc(state.symbol) || '<span class="dim">—</span>'}</div></div>
        <div class="field"><label>Collects</label><div>${esc(collectionName) || '<span class="dim">Not set</span>'}</div></div>
        <div class="field"><label>Outcome</label><div>${{ raffle: 'Raffle to holders', hold: 'Hold in vault', burn: 'Burn' }[state.policy]}</div></div>
        ${!ready ? '<p class="hint" style="color:var(--red)">Fill in every step before launching.</p>' : ''}
        ${!wallet.connected ? '<button type="button" class="btn btn-primary btn-block" id="connectBtn">Connect wallet to launch</button>' :
          `<button type="button" class="btn btn-primary btn-block" id="launchBtn" ${state.busy || !ready ? 'disabled' : ''}>${state.busy ? (state.launchStatus || 'Working…') : 'Launch coin'}</button>`}
      `;
      el.querySelector('#connectBtn')?.addEventListener('click', openWallet);
      el.querySelector('#launchBtn')?.addEventListener('click', doLaunch);
    }
  }

  async function doLaunch() {
    const collection = findCollection(state.collectionSlug);
    const collectionName = collection ? collection.name : state.customCollectionName;
    if (!state.name || !state.symbol || !collectionName) return toast('Fill in every step first', 'error');
    state.busy = true;
    try {
      state.launchStatus = 'Preparing…';
      renderStep();
      const result = await chain.launch({
        name: state.name, symbol: state.symbol, logo: state.logo, description: state.description,
        twitter: state.twitter, website: state.website, creatorTaxBps: state.creatorTaxBps
      }, (step) => {
        state.launchStatus = { prepare: 'Preparing…', sign: 'Confirm in wallet…', confirm: 'Waiting for confirmation…' }[step] || 'Working…';
        renderStep();
      });
      state.launchStatus = 'Registering vault…';
      renderStep();
      await registerCoin({
        hash: result.hash,
        collectionName,
        collectionSlug: state.collectionSlug || collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        chain: collection?.chain || 'ethereum',
        category: state.category,
        policy: state.policy
      });
      toast('Coin launched', 'success');
      go(result.token ? `/coin/${result.token}` : '/explore');
    } catch (err) {
      toast(err?.code === 4001 || err?.code === 'ACTION_REJECTED' ? 'Transaction rejected' : (err.message || 'Launch failed'), 'error');
      state.busy = false;
      renderStep();
    }
  }

  function wizardNav() {
    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    nav.innerHTML = `
      <button class="btn btn-ghost" id="prevBtn" ${state.step === 0 ? 'disabled' : ''}>Back</button>
      ${state.step < 3 ? '<button class="btn btn-primary" id="nextBtn">Continue</button>' : ''}
    `;
    return nav;
  }

  function mount() {
    render();
    const panel = host.querySelector('.form-panel');
    panel.after(wizardNav());
    bindNav();
  }

  function bindNav() {
    const prev = host.querySelector('#prevBtn');
    const next = host.querySelector('#nextBtn');
    prev?.addEventListener('click', () => { state.step = Math.max(0, state.step - 1); remount(); });
    next?.addEventListener('click', () => { state.step = Math.min(3, state.step + 1); remount(); });
  }

  function remount() {
    render();
    const panel = host.querySelector('.form-panel');
    panel.after(wizardNav());
    bindNav();
  }

  mount();
  wallet.addEventListener('change', renderStep);
  return () => wallet.removeEventListener('change', renderStep);
}
