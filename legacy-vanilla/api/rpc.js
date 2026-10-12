// Read-only JSON-RPC gateway with upstream failover. Only safe read methods pass through.

const rpc = require('./_lib/rpc');
const { allow } = require('./_lib/limit');

const ALLOWED = new Set([
  'eth_call', 'eth_chainId', 'eth_blockNumber', 'eth_getBalance',
  'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getBlockByNumber',
  'eth_getLogs'
]);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 65536) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Method not allowed' })); }
  if (!allow(req, res, 'rpc', 120)) return;

  let body;
  try { body = await readJson(req); } catch { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Invalid body' })); }
  const calls = Array.isArray(body) ? body : [body];
  for (const c of calls) {
    if (!ALLOWED.has(c.method)) { res.statusCode = 403; return res.end(JSON.stringify({ error: `Method not allowed: ${c.method}` })); }
  }
  try {
    const out = await rpc.send(body);
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'RPC upstream failed' }));
  }
};
