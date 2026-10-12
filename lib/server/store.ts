// Registry of coins launched through ZEEP, with their vault state.
// Production: Supabase table `zeep_coins` (see supabase/schema.sql) via its REST API.
// Local dev without Supabase keys: a JSON file in .data/ (git-ignored).

import fs from "fs";
import path from "path";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DEV_FILE = path.join(process.cwd(), ".data", "zeep-coins.json");
const DEV_EVENTS_FILE = path.join(process.cwd(), ".data", "zeep-vault-events.json");

export class NotConfigured extends Error {}

export interface CoinRecord {
  token: string;
  curve: string;
  deployer: string;
  tx_hash: string;
  block_number: number;
  launched_at: string;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  collection_name: string;
  collection_slug: string;
  chain: string;
  category: string;
  policy: string;
  vault_eth: number;
  protocol_eth: number;
  nfts_held: number;
  fees_awaiting: number;
  // Last-seen Pons escrow balance for this coin's creatorFeeRecipient, used to
  // compute "new fees since last check" for the simulated harvest. See lib/server/keeper.ts.
  last_harvested_escrow?: number;
}

export type VaultEventType = "harvest" | "purchase" | "draw";

export interface VaultEventRecord {
  id?: number;
  token: string;
  type: VaultEventType;
  amount_eth: number | null;
  nft_label: string | null;
  winner: string | null;
  block_hash: string | null;
  simulated: boolean;
  created_at: string;
}

function mode(): "supabase" | "file" {
  if (URL_ && KEY) return "supabase";
  if (process.env.NODE_ENV !== "production" || process.env.ZEEP_DEV) return "file";
  throw new NotConfigured("Coin registry is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)");
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const auth: Record<string, string> = KEY && KEY.startsWith("eyJ") ? { Authorization: `Bearer ${KEY}` } : {};
  return { apikey: KEY || "", ...auth, "Content-Type": "application/json", ...extra };
}

function readFile(): CoinRecord[] {
  try {
    return JSON.parse(fs.readFileSync(DEV_FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeFile(rows: CoinRecord[]) {
  fs.mkdirSync(path.dirname(DEV_FILE), { recursive: true });
  fs.writeFileSync(DEV_FILE, JSON.stringify(rows, null, 2));
}

export async function list(): Promise<CoinRecord[]> {
  if (mode() === "file") return readFile();
  const r = await fetch(`${URL_}/rest/v1/zeep_coins?select=*&order=launched_at.desc&limit=2000`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

export async function add(record: CoinRecord) {
  if (mode() === "file") {
    const rows = readFile();
    if (!rows.some((x) => x.token.toLowerCase() === record.token.toLowerCase())) {
      rows.push(record);
      writeFile(rows);
    }
    return;
  }
  const r = await fetch(`${URL_}/rest/v1/zeep_coins?on_conflict=token`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
}

export async function update(token: string, patch: Partial<CoinRecord>) {
  if (mode() === "file") {
    const rows = readFile();
    const row = rows.find((x) => x.token.toLowerCase() === token.toLowerCase());
    if (row) {
      Object.assign(row, patch);
      writeFile(rows);
    }
    return;
  }
  const r = await fetch(`${URL_}/rest/v1/zeep_coins?token=eq.${token}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
}

// ---- vault events (harvest / purchase / draw log) ----

function readEventsFile(): VaultEventRecord[] {
  try {
    return JSON.parse(fs.readFileSync(DEV_EVENTS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function writeEventsFile(rows: VaultEventRecord[]) {
  fs.mkdirSync(path.dirname(DEV_EVENTS_FILE), { recursive: true });
  fs.writeFileSync(DEV_EVENTS_FILE, JSON.stringify(rows, null, 2));
}

export async function addEvent(record: VaultEventRecord) {
  if (mode() === "file") {
    const rows = readEventsFile();
    rows.push({ ...record, id: (rows.at(-1)?.id || 0) + 1 });
    writeEventsFile(rows);
    return;
  }
  const r = await fetch(`${URL_}/rest/v1/zeep_vault_events`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
}

export async function listEvents(token?: string): Promise<VaultEventRecord[]> {
  if (mode() === "file") {
    const rows = readEventsFile();
    const filtered = token ? rows.filter((r) => r.token.toLowerCase() === token.toLowerCase()) : rows;
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  const filter = token ? `&token=eq.${token}` : "";
  const r = await fetch(`${URL_}/rest/v1/zeep_vault_events?select=*&order=created_at.desc&limit=200${filter}`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}
