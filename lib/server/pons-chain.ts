// Fallback for coins Pons' API hasn't indexed yet — typically a ZEEP coin in the
// first moments after launch. Reads the coin's real Pons V2 curve straight from
// chain and returns it in the same shape as Pons' launch API, so the coin page
// shows the true starting state (no trades yet: price = virtual quote reserve /
// virtual token reserve = 1.68 ETH / 1B, 0% of 4.2 ETH) instead of nothing.
// Fields only Pons' indexer knows (trade count, volume) come back as null.

import { Interface, formatEther, ZeroAddress } from "ethers";
import { call } from "./rpc";
import { FACTORY, factoryReadAbi } from "./pons";
import { ethUsd } from "./eth-usd";

const factory = new Interface(factoryReadAbi);
const curve = new Interface([
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function graduated() view returns (bool)",
]);

const SUPPLY = 1_000_000_000;

async function read(iface: Interface, to: string, fn: string, args: unknown[] = []) {
  const data = iface.encodeFunctionData(fn, args);
  const out = (await call("eth_call", [{ to, data }, "latest"])) as string;
  return iface.decodeFunctionResult(fn, out);
}

export async function chainLaunch(token: string) {
  try {
    const [l] = await read(factory, FACTORY, "getLaunchedToken", [token]);
    if (!l.exists || l.pairToken !== ZeroAddress) return null; // ZEEP only launches ETH-pair coins
    const c = l.curve as string;
    const [[q, t], [rq], [th], [grad]] = await Promise.all([
      read(curve, c, "getReserves"),
      read(curve, c, "realQuoteReserve"),
      read(curve, c, "graduationThreshold"),
      read(curve, c, "graduated"),
    ]);
    const qe = Number(formatEther(q));
    const te = Number(formatEther(t));
    const raised = Number(formatEther(rq));
    const threshold = Number(formatEther(th));
    const price = te > 0 ? qe / te : 0; // spot; with no trades this is exactly Pons' starting price
    const usd = await ethUsd();
    const fresh = raised === 0; // nothing bought yet → genuinely zero trades / volume
    return {
      address: token.toLowerCase(),
      stage: grad ? "graduated" : "curve",
      deployer: String(l.deployer).toLowerCase(),
      createdAt: null,
      lastTradeAt: null,
      progress: threshold > 0 ? Math.min(1, raised / threshold) : 0,
      raisedQuote: raised,
      thresholdQuote: threshold,
      priceQuote: price,
      priceUsd: price * usd,
      marketCapQuote: price * SUPPLY,
      marketCapUsd: price * SUPPLY * usd,
      volumeQuote: fresh ? 0 : null,
      volumeUsd: fresh ? 0 : null,
      tradeCount: fresh ? 0 : null,
      creatorTaxBps: Number(l.creatorTaxBps),
      curve: c.toLowerCase(),
      pool: null,
      totalSupply: SUPPLY,
      graduatedAt: null,
      quoteUsd: usd,
      source: "chain",
    };
  } catch {
    return null;
  }
}
