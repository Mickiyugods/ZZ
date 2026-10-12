// On-chain reads and writes against the Pons V2 factory, router and curves.
// The vault layer (collecting fees, buying NFTs, raffling) is tracked by the ZEEP
// registry off chain for now; see CLAUDE.md "Vault execution" for the phased plan.

import { ethers } from "ethers";
import { CHAIN, PONS, ABI, SALT_TAG, MAX_CREATOR_TAX_BPS } from "./config";
import { wallet } from "./wallet";

function rpc(url: string) {
  const req = new ethers.FetchRequest(url);
  req.timeout = 10000;
  return new ethers.JsonRpcProvider(req, CHAIN.id, { staticNetwork: true, batchMaxCount: 20 });
}

function reader() {
  return new ethers.FallbackProvider(
    [
      { provider: rpc(CHAIN.rpc), priority: 1, stallTimeout: 2500 },
      { provider: rpc(new URL("/api/rpc", location.origin).href), priority: 2, stallTimeout: 2500 },
    ],
    CHAIN.id,
    { quorum: 1 },
  );
}
let _reader: ethers.FallbackProvider | null = null;
function getReader() {
  if (!_reader) _reader = reader();
  return _reader;
}

const factory = (runner: ethers.ContractRunner = getReader()) => new ethers.Contract(PONS.factory, ABI.factory, runner);
const curveAt = (addr: string, runner: ethers.ContractRunner = getReader()) => new ethers.Contract(addr, ABI.curve, runner);
const tokenAt = (addr: string, runner: ethers.ContractRunner = getReader()) => new ethers.Contract(addr, ABI.token, runner);
const BPS = 10000n;

export async function ethBalance(address: string) {
  return getReader().getBalance(address);
}

export async function readToken(token: string) {
  const t = tokenAt(token);
  const [launch, name, symbol] = await Promise.all([factory().getLaunchedToken(token), t.name(), t.symbol()]);
  if (!launch.exists) throw new Error("This address is not a Pons launch");
  const c = curveAt(launch.curve);
  const [reserves, realQuote, threshold, graduated, feeBps] = await Promise.all([
    c.getReserves(),
    c.realQuoteReserve(),
    c.graduationThreshold(),
    c.graduated(),
    c.feeBps(),
  ]);
  const [quoteReserve, tokenReserve] = reserves;
  return {
    token: launch.token as string,
    curve: launch.curve as string,
    deployer: launch.deployer as string,
    creatorFeeRecipient: launch.creatorFeeRecipient as string,
    name: name as string,
    symbol: symbol as string,
    quoteReserve: quoteReserve as bigint,
    tokenReserve: tokenReserve as bigint,
    realQuote: realQuote as bigint,
    threshold: threshold as bigint,
    graduated: graduated as boolean,
    feeBps: feeBps as bigint,
  };
}

export async function readCurve(curve: string) {
  const c = curveAt(curve);
  const [[quoteReserve, tokenReserve], realQuote, graduated] = await Promise.all([c.getReserves(), c.realQuoteReserve(), c.graduated()]);
  return { quoteReserve, tokenReserve, realQuote, graduated };
}

export async function quoteBuy(curve: string, quoteIn: bigint, recipient: string = PONS.nativePair) {
  const c = curveAt(curve);
  const [[qr, tr], sellable, feeBps] = await Promise.all([c.getReserves(), c.sellableTokens(), c.feeBps()]);
  const fee = (quoteIn * (feeBps as bigint)) / BPS;
  const net = quoteIn - fee;
  let out = net > 0n ? (net * (tr as bigint)) / ((qr as bigint) + net) : 0n;
  if (out > (sellable as bigint)) out = sellable as bigint;
  void recipient;
  return { out, fee };
}

export async function quoteSell(curve: string, tokensIn: bigint) {
  const c = curveAt(curve);
  const [[qr, tr], feeBps] = await Promise.all([c.getReserves(), c.feeBps()]);
  const gross = tokensIn > 0n ? (tokensIn * (qr as bigint)) / ((tr as bigint) + tokensIn) : 0n;
  const fee = (gross * (feeBps as bigint)) / BPS;
  return { out: gross - fee, fee };
}

const withSlippage = (amount: bigint, pct: number) => (amount * BigInt(Math.round((100 - pct) * 100))) / BPS;

export async function buy(curve: string, quoteIn: bigint, slippagePct: number) {
  const signer = await wallet.signer();
  const me = await signer.getAddress();
  const { out } = await quoteBuy(curve, quoteIn, me);
  const tx = await curveAt(curve, signer).buy(quoteIn, withSlippage(out, slippagePct), me, { value: quoteIn });
  return tx.wait();
}

export async function sell(token: string, curve: string, tokensIn: bigint, slippagePct: number, onStep?: (s: string) => void) {
  const signer = await wallet.signer();
  const me = await signer.getAddress();
  const t = tokenAt(token, signer);
  if ((await t.allowance(me, curve)) < tokensIn) {
    onStep?.("approve");
    await (await t.approve(curve, tokensIn)).wait();
  }
  onStep?.("sell");
  const { out } = await quoteSell(curve, tokensIn);
  const tx = await curveAt(curve, signer).sell(tokensIn, withSlippage(out, slippagePct), me);
  return tx.wait();
}

export async function launchFee() {
  try {
    return await factory().launchFee();
  } catch {
    return null;
  }
}

export interface LaunchForm {
  name: string;
  symbol: string;
  logo?: string;
  description: string;
  twitter?: string;
  website?: string;
  creatorTaxBps: number;
}

export async function launch(form: LaunchForm, onStep?: (s: string) => void) {
  const signer = await wallet.signer();
  const me = await signer.getAddress();
  const f = factory(signer);

  onStep?.("prepare");
  const [allowed, fee, economics] = await Promise.all([
    f.canLaunch(me),
    f.launchFee(),
    f.previewLaunchEconomics(PONS.launchConfigId, PONS.nativePair),
  ]);
  if (!allowed) throw new Error("Pons is not accepting launches from this wallet right now");

  const params = {
    name: form.name.slice(0, 64),
    symbol: form.symbol.slice(0, 16),
    logo: form.logo || "",
    description: form.description.slice(0, 2048),
    socials: { twitter: form.twitter || "", telegram: "", discord: "", website: form.website || "", farcaster: "" },
    creatorFeeRecipient: me,
    creatorTaxBps: Math.max(0, Math.min(MAX_CREATOR_TAX_BPS, Math.round(Number(form.creatorTaxBps) || 0))),
    buybackEnabled: false,
    expectedEconomics: economics,
    salt: ethers.hexlify(ethers.concat([ethers.toUtf8Bytes(SALT_TAG), ethers.randomBytes(32 - SALT_TAG.length)])),
  };

  onStep?.("sign");
  const args = [params, PONS.launchConfigId, PONS.nativePair, []] as const;
  await f.launchToken.staticCall(...args, { value: fee });
  const tx = await f.launchToken(...args, { value: fee });

  onStep?.("confirm");
  const receipt = await tx.wait();
  const iface = new ethers.Interface(ABI.factory);
  for (const log of receipt!.logs) {
    try {
      const ev = iface.parseLog(log);
      if (ev?.name === "TokenLaunched") return { hash: tx.hash as string, token: ev.args.token as string, curve: ev.args.curve as string };
    } catch {}
  }
  return { hash: tx.hash as string, token: null, curve: null };
}
