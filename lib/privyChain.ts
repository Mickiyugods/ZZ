// Robinhood Chain as a viem Chain object, for Privy's PrivyProvider config
// (supportedChains/defaultChain want viem Chain shapes, not the plain CHAIN
// constant lib/config.ts uses for ethers/contract calls elsewhere).

import { defineChain } from "viem";
import { CHAIN } from "./config";

export const robinhoodChain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.currency,
  rpcUrls: { default: { http: [CHAIN.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: CHAIN.explorer } },
});
