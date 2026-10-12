// Registry of coins launched through ZEEP, with their vault state.
// Production: Supabase table `zeep_coins` (see supabase/schema.sql) via its REST API.
// Local dev without Supabase keys: a JSON file in .data/ (only when started by dev.js).

const fs = require('fs');
const path = require('path');

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DEV_FILE = path.join(__dirname, '..', '..', '.data', 'zeep-coins.json');

class NotConfigured extends Error {}

function mode() {
  if (URL_ && KEY) return 'supabase';
  if (process.env.ZEEP_DEV) return 'file';
  throw new NotConfigured('Coin registry is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)');
}

function headers(extra = {}) {
  const auth = KEY && KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {};
  return { apikey: KEY, ...auth, 'Content-Type': 'application/json', ...extra };
}

function readFile() {
  try { return JSON.parse(fs.readFileSync(DEV_FILE, 'utf8')); } catch { return []; }
}
function writeFile(rows) {
  fs.mkdirSync(path.dirname(DEV_FILE), { recursive: true });
  fs.writeFileSync(DEV_FILE, JSON.stringify(rows, null, 2));
}

async function list() {
  if (mode() === 'file') return readFile();
  const r = await fetch(`${URL_}/rest/v1/zeep_coins?select=*&order=launched_at.desc&limit=2000`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

// Inserts once per token; a repeat registration is a no-op.
async function add(record) {
  if (mode() === 'file') {
    const rows = readFile();
    if (!rows.some((x) => x.token.toLowerCase() === record.token.toLowerCase())) {
      rows.push(record);
      writeFile(rows);
    }
    return;
  }
  const r = await fetch(`${URL_}/rest/v1/zeep_coins?on_conflict=token`, {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
}

// Updates mutable vault fields only (vault_eth, protocol_eth, nfts_held, fees_awaiting).
async function update(token, patch) {
  if (mode() === 'file') {
    const rows = readFile();
    const row = rows.find((x) => x.token.toLowerCase() === token.toLowerCase());
    if (row) { Object.assign(row, patch); writeFile(rows); }
    return;
  }
  const r = await fetch(`${URL_}/rest/v1/zeep_coins?token=eq.${token}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
}

async function ping(table = 'zeep_coins') {
  if (mode() === 'file') return 'ok';
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, { headers: headers(), signal: AbortSignal.timeout(8000) });
  if (r.ok) return 'ok';
  if (r.status === 404) return 'missing';
  throw new Error(`Supabase ${r.status}`);
}

module.exports = { list, add, update, ping, headers, NotConfigured };
