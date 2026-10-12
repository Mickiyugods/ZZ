// Records a coin in the ZEEP registry after checking its launch on chain.
// Body: { hash, collectionName, collectionSlug, chain, category, policy }
// Accepted only if the tx called the Pons factory or router, succeeded, emitted
// TokenLaunched from the factory, and used a salt starting with "ZEEP".

const { getAddress } = require('ethers');
const rpc = require('./_lib/rpc');
const store = require('./_lib/store');
const { allow } = require('./_lib/limit');
const { FACTORY, ROUTER, SALT_PREFIX, launchIface } = require('./_lib/pons');

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2048) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const clip = (s, n) => String(s || '').slice(0, n);
const POLICIES = new Set(['raffle', 'hold', 'burn']);
const CATEGORIES = new Set(['pfp', 'art', 'cards']);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!allow(req, res, 'register', 12)) return;

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: 'Invalid body' });
  }
  const { hash, collectionName, collectionSlug, chain, category, policy } = body;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash || '')) return send(res, 400, { error: 'Invalid transaction hash' });
  if (!collectionName || !collectionSlug) return send(res, 400, { error: 'Missing collection' });
  if (!POLICIES.has(policy)) return send(res, 400, { error: 'Invalid policy' });
  if (category && !CATEGORIES.has(category)) return send(res, 400, { error: 'Invalid category' });

  try {
    const tx = await rpc.call('eth_getTransactionByHash', [hash]);
    if (!tx) return send(res, 404, { error: 'Transaction not found yet' });

    const to = (tx.to || '').toLowerCase();
    if (to !== FACTORY.toLowerCase() && to !== ROUTER.toLowerCase()) {
      return send(res, 422, { error: 'Not a Pons launch transaction' });
    }

    let parsed;
    try { parsed = launchIface.parseTransaction({ data: tx.input, value: tx.value }); } catch {}
    if (!parsed || !['launchToken', 'launchAndBuy'].includes(parsed.name)) {
      return send(res, 422, { error: 'Not a Pons launch transaction' });
    }
    const params = parsed.args[0];
    if (!String(params.salt).toLowerCase().startsWith(SALT_PREFIX)) {
      return send(res, 422, { error: 'This coin was not launched through ZEEP' });
    }

    const receipt = await rpc.call('eth_getTransactionReceipt', [hash]);
    if (!receipt) return send(res, 404, { error: 'Transaction not confirmed yet' });
    if (receipt.status !== '0x1') return send(res, 422, { error: 'Launch transaction failed' });

    let launched = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== FACTORY.toLowerCase()) continue;
      try {
        const ev = launchIface.parseLog(log);
        if (ev?.name === 'TokenLaunched') { launched = ev.args; break; }
      } catch {}
    }
    if (!launched) return send(res, 422, { error: 'No TokenLaunched event in this transaction' });

    const block = await rpc.call('eth_getBlockByNumber', [receipt.blockNumber, false]);
    const record = {
      token: getAddress(launched.token),
      curve: getAddress(launched.curve),
      deployer: getAddress(launched.deployer),
      tx_hash: hash.toLowerCase(),
      block_number: Number(receipt.blockNumber),
      launched_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      name: clip(params.name, 64),
      symbol: clip(params.symbol, 16),
      logo: clip(params.logo, 512),
      description: clip(params.description, 2048),
      collection_name: clip(collectionName, 128),
      collection_slug: clip(collectionSlug, 128),
      chain: clip(chain || 'ethereum', 32),
      category: clip(category || 'pfp', 16),
      policy,
      vault_eth: 0,
      protocol_eth: 0,
      nfts_held: 0,
      fees_awaiting: 0
    };
    await store.add(record);
    return send(res, 200, { ok: true, token: record.token });
  } catch (err) {
    if (err instanceof store.NotConfigured) return send(res, 503, { error: err.message });
    console.error(err);
    return send(res, 502, { error: 'Could not verify the launch right now' });
  }
};
