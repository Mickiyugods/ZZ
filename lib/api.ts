// Calls to ZEEP's own /api routes.

export interface CoinRow {
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
  category: "pfp" | "art" | "cards";
  policy: "raffle" | "hold" | "burn";
  vault_eth: number;
  protocol_eth: number;
  nfts_held: number;
  fees_awaiting: number;
}

export interface CoinsResponse {
  coins: number;
  vaultEth: number;
  nftsHeld: number;
  feesAwaiting: number;
  rows: CoinRow[];
}

async function json<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Request failed (${r.status})`);
  return data as T;
}

export function listCoins(opts: { list?: "new" | "top" | "nfts"; search?: string; token?: string; deployer?: string } = {}) {
  const { list = "new", search = "", token = "", deployer = "" } = opts;
  const q = new URLSearchParams({
    list,
    ...(search ? { search } : {}),
    ...(token ? { token } : {}),
    ...(deployer ? { deployer } : {}),
  });
  return json<CoinsResponse>(`/api/tokens?${q}`);
}

export interface RegisterBody {
  hash: string;
  collectionName: string;
  collectionSlug: string;
  chain: string;
  category: string;
  policy: string;
}

export function registerCoin(body: RegisterBody) {
  return json<{ ok: boolean; token: string }>("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface VaultEvent {
  id?: number;
  token: string;
  type: "harvest" | "purchase" | "draw";
  amount_eth: number | null;
  nft_label: string | null;
  winner: string | null;
  block_hash: string | null;
  simulated: boolean;
  created_at: string;
}

export function listVaultEvents(token: string) {
  return json<{ events: VaultEvent[] }>(`/api/vault-events?token=${token}`);
}

// Dev-only: manually fire a keeper tick instead of waiting for the daily cron.
export function runKeeperNow() {
  return json<{ ok: true; log: string[] }>("/api/cron/keeper");
}

// Dev-only: append one simulated trade to the demo market (see /api/trades).
export function recordDemoTrade(token: string, side: "buy" | "sell", ethValue: number) {
  return json<{ trade: unknown }>("/api/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, side, ethValue }),
  });
}
