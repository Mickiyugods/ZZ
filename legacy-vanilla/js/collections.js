// Sample collections a vault can be paired with. Placeholder data for the launch
// wizard and the Card Vaults page until a real NFT/graded-card indexer is wired in
// (see CLAUDE.md "Vault execution"). No artwork is used anywhere, only text labels.

export const COLLECTIONS = [
  { slug: 'pudgy-penguins', name: 'Pudgy Penguins', chain: 'ethereum', category: 'pfp', floor: '6.21 ETH' },
  { slug: 'milady-maker', name: 'Milady Maker', chain: 'ethereum', category: 'pfp', floor: '1.9 ETH' },
  { slug: 'cash-cats', name: 'Cash Cats', chain: 'robinhood', category: 'pfp', floor: '0.17 ETH' },
  { slug: 'quithans', name: 'Quithans', chain: 'ethereum', category: 'art', floor: '1.9 ETH' },
  { slug: 'bored-apes', name: 'Bored Ape-ish', chain: 'ethereum', category: 'pfp', floor: '12.9 SOL' },
  { slug: 'pokemon-151', name: 'Pokémon · 151 Base Set', chain: 'ethereum', category: 'cards', floor: '0.8 ETH' },
  { slug: 'pokemon-base-charizard', name: 'Pokémon · Base Set Charizard (graded)', chain: 'ethereum', category: 'cards', floor: '4.2 ETH' },
  { slug: 'one-piece-romance-dawn', name: 'One Piece · OP-01 Romance Dawn', chain: 'ethereum', category: 'cards', floor: '0.3 ETH' },
  { slug: 'one-piece-paramount-war', name: 'One Piece · OP-02 Paramount War', chain: 'ethereum', category: 'cards', floor: '0.25 ETH' }
];

export const byCategory = (cat) => COLLECTIONS.filter((c) => c.category === cat);
export const findCollection = (slug) => COLLECTIONS.find((c) => c.slug === slug);
