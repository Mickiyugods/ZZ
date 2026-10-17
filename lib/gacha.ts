// Typed client for Collector Crypt's Gacha Machine API, talking through our own
// /api/gacha/* proxy (see app/api/gacha/[...path]/route.ts). All calls are
// relative, so they work in the browser without CORS.
//
// Flow for cracking a pack (see lib/useGacha.ts for the wallet-signing glue):
//   1. generatePack(playerAddress, packType) -> { memo, transaction(base64) }
//   2. wallet signs the base64 tx (USDC transfer to the gacha wallet)
//   3. submitTransaction(signedBase64) -> lands the payment on Solana
//   4. openPack(memo) -> the won NFT (retry while WAITING_FOR_WEBHOOK)

export type Rarity = "common" | "uncommon" | "rare" | "epic";

export interface Machine {
  code: string; // pass as packType, e.g. "pokemon_50"
  name: string;
  shortName?: string;
  mobile_name?: string | null;
  thumbnailUrl?: string;
  imageNobg?: string | null;
  videoSrc?: string | null;
  videoNobgWeb?: string | null;
  menuCategory?: string; // "Pokemon" | "One Piece" | ...
  menuOrder?: number;
  public?: boolean;
  price: number; // USDC
  contains?: number;
  turboMode?: boolean;
  instantBuyback?: number;
  lowThreshold?: number;
  odds: Record<Rarity, number>;
  tierRanges?: Record<Rarity, { start: number; end: number }>;
  stock: Record<Rarity, number>;
  ev: number | null;
}

/** Display name for a machine category — the API spells it "Pokemon". */
export function categoryLabel(c?: string | null): string {
  if (!c) return "Other";
  return c === "Pokemon" ? "Pokémon" : c;
}

export interface GeneratePackResult {
  memo: string;
  transaction: string; // base64
}

export interface OpenPackResult {
  success: boolean;
  code?: "WAITING_FOR_WEBHOOK" | "TURBO_MODE_BUYBACK";
  memo?: string;
  transactionSignature?: string;
  nft_address?: string;
  nftWon?: {
    content?: { metadata?: { name?: string; description?: string; attributes?: unknown[] } };
    image?: string;
  };
  points?: number;
  roll?: number;
  rarity?: "Epic" | "Rare" | "Uncommon" | "Common";
  buybackAmount?: number;
}

export interface Winner {
  winner: string;
  prize_tier: number; // 1 Epic, 2 Rare, 3 Uncommon, 4 Common
  nft?: { content?: { files?: { uri?: string; cc_cdn?: string; cdn_uri?: string }[] }; image?: string };
  timestamp?: string | number;
  insuredValue?: number;
}

const BASE = "/api/gacha";

async function get<T>(path: string, search?: Record<string, string | number | undefined>): Promise<T> {
  const qs = search
    ? "?" +
      Object.entries(search)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await fetch(`${BASE}/${path}${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await safeErr(res)) || `Gacha GET ${path} failed (${res.status})`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await safeErr(res)) || `Gacha POST ${path} failed (${res.status})`);
  return res.json();
}

async function safeErr(res: Response): Promise<string | null> {
  try {
    const j = await res.clone().json();
    return j?.error || j?.message || j?.details || null;
  } catch {
    return null;
  }
}

export function getMachines(): Promise<{ machines: Machine[] }> {
  return get("machines");
}

export function generatePack(playerAddress: string, packType: string): Promise<GeneratePackResult> {
  return post("generatePack", { playerAddress, packType });
}

export function submitTransaction(signedTransaction: string): Promise<{ success: boolean; signature?: string; confirmationStatus?: string }> {
  return post("submitTransaction", { signedTransaction });
}

export function openPack(memo: string): Promise<OpenPackResult> {
  return post("openPack", { memo });
}

export function getPackStatus(memo: string): Promise<Record<string, unknown>> {
  return get("pack/status", { memo });
}

export function getRecentWinners(packType?: string): Promise<{ success: boolean; data: Winner[] }> {
  return get("getRecentWinners", { packType });
}

export const tierName: Record<number, string> = { 1: "Epic", 2: "Rare", 3: "Uncommon", 4: "Common" };

// Pull a usable image URL out of a winner's nested NFT shape.
export function winnerImage(w: Winner): string | null {
  const f = w.nft?.content?.files?.[0];
  return f?.cdn_uri || f?.cc_cdn || f?.uri || w.nft?.image || null;
}

/** A resized copy of a card image via Helius' public image CDN (the same CDN the
 * API already hands back). Card scans are often 1–3 MB / ~3000px; a 128px
 * thumbnail comes back around 7 KB. Falls back to the original on any odd URL. */
export function cardThumb(url: string | null, width: number): string | null {
  if (!url) return null;
  const opts = `width=${width},quality=75,fit=scale-down`;
  const m = url.match(/^https:\/\/cdn\.helius-rpc\.com\/cdn-cgi\/image\/[^/]*\/(https?:\/\/.+)$/);
  if (m) return `https://cdn.helius-rpc.com/cdn-cgi/image/${opts}/${m[1]}`;
  if (/^https?:\/\//.test(url)) return `https://cdn.helius-rpc.com/cdn-cgi/image/${opts}/${url}`;
  return url;
}
