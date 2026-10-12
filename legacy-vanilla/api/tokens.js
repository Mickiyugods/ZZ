// GET /api/tokens?list=new|top|nfts&search=...
// Returns the ZEEP coin registry (each coin plus its vault state) and platform totals.

const store = require('./_lib/store');

function sortRows(rows, list) {
  const out = [...rows];
  if (list === 'top') return out.sort((a, b) => (b.vault_eth || 0) - (a.vault_eth || 0));
  if (list === 'nfts') return out.sort((a, b) => (b.nfts_held || 0) - (a.nfts_held || 0));
  return out.sort((a, b) => new Date(b.launched_at) - new Date(a.launched_at));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const url = new URL(req.url, 'http://local');
    const list = url.searchParams.get('list') || 'new';
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const token = (url.searchParams.get('token') || '').trim().toLowerCase();

    let rows = await store.list();
    if (token) rows = rows.filter((r) => r.token.toLowerCase() === token);
    if (search) {
      rows = rows.filter((r) =>
        r.name?.toLowerCase().includes(search) ||
        r.symbol?.toLowerCase().includes(search) ||
        r.collection_name?.toLowerCase().includes(search)
      );
    }
    rows = sortRows(rows, list);

    const totals = rows.reduce((acc, r) => {
      acc.vaultEth += r.vault_eth || 0;
      acc.nftsHeld += r.nfts_held || 0;
      acc.feesAwaiting += r.fees_awaiting || 0;
      return acc;
    }, { vaultEth: 0, nftsHeld: 0, feesAwaiting: 0 });

    res.statusCode = 200;
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.end(JSON.stringify({ coins: rows.length, ...totals, rows }));
  } catch (e) {
    if (e instanceof store.NotConfigured) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ coins: 0, vaultEth: 0, nftsHeld: 0, feesAwaiting: 0, rows: [] }));
    }
    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Registry unavailable' }));
  }
};
