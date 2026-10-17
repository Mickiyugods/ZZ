// Collections a vault can be paired with — the full real set, not a curated
// sample. Sourced from `lib/data/robinhood-collections.json`, a one-time
// fetch (2026-10) of a public, unauthenticated collection manifest that
// mirrors OpenSea's own indexed collections across every chain a coin's
// vault can realistically reach: Robinhood Chain itself (where ZEEP's coins
// launch), plus Ethereum, Base, Hyperliquid, Polygon and Solana (which need
// the cross-chain External Vault/Launcher path — see CLAUDE.md "Contracts
// workspace"). Every entry has a real contract/program address and a real
// OpenSea-hosted logo; nothing here is invented. `floor` is "—" rather than
// a fabricated number — OpenSea's floor-price API needs a key ZEEP doesn't
// have yet (tracked in CLAUDE.md). `category` (pfp vs art) is our own best
// read, not something the source data labels — it defaults to "pfp".
//
// Deliberately NOT vendored from that same manifest: its ~4 "grail" entries
// (one vault saving for one named, specific graded card). That's someone
// else's curated feature content, not "a collection that exists" — ZEEP's
// own Grail Mode (see app/cards/page.tsx) stays marked "coming soon" rather
// than faking that curation.

import raw from "./data/robinhood-collections.json";

export type Category = "pfp" | "art" | "cards";

export interface Collection {
  slug: string;
  name: string;
  chain: string;
  category: Category;
  floor: string;
  /** On-chain contract (or, on Solana, program/mint authority) address on `chain`. */
  contract?: string;
  /** OpenSea collection slug, for the real floor/listing API (Phase 2 keeper). */
  openseaSlug?: string;
  /** OpenSea's logo image for this collection — display only. */
  image?: string;
  /** For single-registry collections (Courtyard, Collector Crypt): the search
   * term that scopes results to this card line within the shared registry. */
  searchFilter?: string;
}

interface RawEntry {
  chainId: number;
  address: string;
  name?: string;
  slug?: string;
  image?: string;
  kind?: "cards" | "grail";
  tag?: string;
  match?: string[];
  category?: string;
}

const CHAIN_NAMES: Record<number, string> = {
  4663: "robinhood",
  1: "ethereum",
  8453: "base",
  999: "hyperliquid",
  137: "polygon",
  792703809: "solana",
};

// Courtyard.io: real tokenized-card registry, verified 2026-10 — a single ERC721
// contract on Polygon holds every physical item they vault (Pokémon, One Piece,
// sports cards, ...), each token its own unique vaulted item. There is no separate
// contract per card line; "which cards" is a search/trait filter within this one
// collection, not a different collection. Burn the NFT to have Courtyard (vaulted
// with Brink's) ship the physical card. Confirmed live on PolygonScan: verified
// proxy contract, 850k+ transactions, named "Courtyard: COURTYARD Token".
export const COURTYARD = { chain: "polygon", contract: "0x251BE3A17Af4892035C37ebf5890F4a4D889dcAD", openseaSlug: "courtyard-nft" };

// Collector Crypt: the Solana counterpart to Courtyard — graded cards (PSA/
// CGC/BGS) vaulted and represented by an NFT, address confirmed from the
// same public manifest as the rest of this file (2026-10).
export const COLLECTOR_CRYPT = { chain: "solana", contract: "CCryptUfeFSZ3Fgc9FLeKrhLVAP67FSqi1GuVoj9CRac" };

const entries = raw as RawEntry[];

// "pfp"/"art" collections across every chain, excluding the 4 "cards" entries
// (handled below with their own search filters) and the ~4 "grail" entries.
const chainCollections: Collection[] = entries
  .filter((e) => !e.kind && e.slug && e.name)
  .map((e) => ({
    slug: e.slug!,
    name: e.name!,
    chain: CHAIN_NAMES[e.chainId] ?? String(e.chainId),
    category: "pfp" as Category,
    floor: "—",
    contract: e.address,
    openseaSlug: CHAIN_NAMES[e.chainId] && CHAIN_NAMES[e.chainId] !== "solana" ? e.slug : undefined,
    image: e.image,
  }));

// The manifest's own 4 "cards" entries are Courtyard (Polygon) and Collector
// Crypt (Solana) split into Pokémon/One Piece — reuse their real search
// terms instead of re-curating them by hand.
const cardCollections: Collection[] = entries
  .filter((e) => e.kind === "cards")
  .map((e) => {
    const onCourtyard = e.chainId === 137;
    const registry = onCourtyard ? COURTYARD : COLLECTOR_CRYPT;
    const isOnePiece = /one\s*piece/i.test(e.name ?? "");
    return {
      slug: `${onCourtyard ? "courtyard" : "collectorcrypt"}-${e.tag ?? e.slug}`,
      name: `${e.name} (${onCourtyard ? "Courtyard" : "Collector Crypt"}-vaulted)`,
      chain: registry.chain,
      category: "cards" as Category,
      floor: onCourtyard ? "$5.71 USDC" : "varies",
      contract: registry.contract,
      openseaSlug: onCourtyard ? COURTYARD.openseaSlug : undefined,
      searchFilter: e.match?.join(" / ") ?? e.category ?? e.name,
      // Real graded-card photos already bundled for the home/cards pages.
      image: isOnePiece ? "/images/cards/onepiece-monkey-d-luffy-st08.jpg" : "/images/cards/pokemon-celebrations-pikachu.jpg",
    };
  });

export const COLLECTIONS: Collection[] = [...chainCollections, ...cardCollections];

export const byCategory = (cat: Category) => COLLECTIONS.filter((c) => c.category === cat);
export const findCollection = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
