// Calls to ZEEP's own /api functions.

async function json(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export function listCoins({ list = 'new', search = '' } = {}) {
  const q = new URLSearchParams({ list, ...(search ? { search } : {}) });
  return json(`/api/tokens?${q}`);
}

export function registerCoin(body) {
  return json('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
