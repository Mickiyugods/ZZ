// JSON-RPC over HTTP with upstream failover (server side only).

const UPSTREAMS = [
  process.env.RPC_URL,
  'https://robinhood-rpc.publicnode.com',
  'https://rpc.mainnet.chain.robinhood.com'
].filter(Boolean);

async function send(payload) {
  const body = JSON.stringify(payload);
  for (const url of UPSTREAMS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000)
      });
      if (r.ok) return await r.json();
    } catch {}
  }
  throw new Error('All RPC upstreams failed');
}

async function call(method, params = []) {
  const out = await send({ jsonrpc: '2.0', id: 1, method, params });
  if (out.error) throw new Error(out.error.message || 'RPC error');
  return out.result;
}

module.exports = { send, call };
