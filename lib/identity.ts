// A wallet's ZEEP identity: one of the four ZEEP avatars plus a two-word
// display name, both derived from the address itself. Deterministic, so the
// same wallet always gets the same face and name on every device, with no
// account or storage — and different wallets get different ones.

const AVATARS = [1, 2, 3, 4].map((i) => `/images/avatars/zeep-avatar-${i}.webp`);

const ADJECTIVES = [
  "Lucky", "Diamond", "Golden", "Silent", "Swift", "Cosmic", "Brave", "Mellow",
  "Rapid", "Clever", "Bold", "Quiet", "Wild", "Sunny", "Lunar", "Solar",
  "Neon", "Velvet", "Iron", "Crystal", "Midnight", "Electric", "Frosty", "Hidden",
  "Royal", "Steady", "Nimble", "Mighty", "Gentle", "Rogue", "Stellar", "Turbo",
  "Patient", "Shiny", "Daring", "Calm", "Fearless", "Witty", "Atomic", "Polar",
  "Crimson", "Amber", "Jade", "Onyx", "Silver", "Copper", "Misty", "Blazing",
  "Humble", "Noble", "Funky", "Jolly", "Sly", "Zesty", "Breezy", "Cheeky",
  "Grand", "Prime", "Rare", "Mint", "Based", "Early", "Loyal", "Vivid",
];

const NOUNS = [
  "Otter", "Falcon", "Fox", "Whale", "Comet", "Panda", "Raven", "Tiger",
  "Pixel", "Rocket", "Badger", "Koala", "Hawk", "Lynx", "Wolf", "Orca",
  "Gecko", "Moose", "Bison", "Heron", "Puffin", "Mantis", "Cobra", "Jaguar",
  "Penguin", "Dolphin", "Owl", "Stag", "Yak", "Lemur", "Marten", "Ibis",
  "Collector", "Trader", "Captain", "Pilot", "Nomad", "Ranger", "Voyager", "Wizard",
  "Knight", "Ronin", "Scout", "Drifter", "Alchemist", "Ape", "Bull", "Bear",
  "Nova", "Quasar", "Meteor", "Nebula", "Orbit", "Vortex", "Glacier", "Canyon",
  "Harbor", "Summit", "Beacon", "Anchor", "Cipher", "Spark", "Ember", "Echo",
];

// FNV-1a over the lowercased address: tiny, synchronous, well-spread.
function hash(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface WalletIdentity {
  name: string;
  avatar: string;
}

export function walletIdentity(address: string): WalletIdentity {
  const h = hash(address.toLowerCase());
  return {
    avatar: AVATARS[h % AVATARS.length],
    // independent slices of the hash so the avatar doesn't predict the name
    name: `${ADJECTIVES[(h >>> 4) % ADJECTIVES.length]} ${NOUNS[(h >>> 12) % NOUNS.length]}`,
  };
}
