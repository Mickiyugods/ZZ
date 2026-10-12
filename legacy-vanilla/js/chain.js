// On-chain reads and writes against the Pons V2 factory, router and curves.
// The vault layer (collecting fees, buying NFTs, raffling) is tracked by the ZEEP
// registry off chain for now; see CLAUDE.md "Vault execution" for the phased plan.

import { ethers } from './lib.js';
import { CHAIN, PONS, ABI, SALT_TAG, MAX_CREATOR_TAX_BPS } from './config.js';
import { wallet } from './wallet.js';

function rpc(url) {
  const req = new ethers.FetchRequest(url);
  req.timeout = 10000;
  return new ethers.JsonRpcProvider(req, CHAIN.id, { staticNetwork: true, batchMaxCount: 20 });
}
const reader = new ethers.FallbackProvider([
  { provider: rpc(CHAIN.rpc), priority: 1, stallTimeout: 2500 },
  { provider: rpc(new URL('/api/rpc', location.origin).href), priority: 2, stallTimeout: 2500 }
], CHAIN.id, { quorum: 1 });

const factory = (runner = reader) => new ethers.Contract(PONS.factory, ABI.factory, runner);
const curveAt = (addr, runner = reader) => new ethers.Contract(addr, ABI.curve, runner);
const tokenAt = (addr, runner = reader) => new ethers.Contract(addr, ABI.token, runner);
const BPS = 10000n;

export async function ethBalance(address) {
  return reader.getBalance(address);
}

export async function readToken(token) {
  const t = tokenAt(token);
  const [launch, name, symbol] = await Promise.all([factory().getLaunchedToken(token), t.name(), t.symbol()]);
  if (!launch.exists) throw new Error('This address is not a Pons launch');
  const c = curveAt(launch.curve);
  const [reserves, realQuote, threshold, graduated, feeBps] = await Promise.all([
    c.getReserves(), c.realQuoteReserve(), c.graduationThreshold(), c.graduated(), c.feeBps()
  ]);
  const [quoteReserve, tokenReserve] = reserves;
  return {
    token: launch.token, curve: launch.curve, deployer: launch.deployer,
    creatorFeeRecipient: launch.creatorFeeRecipient, name, symbol,
    quoteReserve, tokenReserve, realQuote, threshold, graduated, feeBps
  };
}

export async function readCurve(curve) {
  const c = curveAt(curve);
  const [[quoteReserve, tokenReserve], realQuote, graduated] = await Promise.all([
    c.getReserves(), c.realQuoteReserve(), c.graduated()
  ]);
  return { quoteReserve, tokenReserve, realQuote, graduated };
}

export async function quoteBuy(curve, quoteIn, recipient = PONS.nativePair) {
  const c = curveAt(curve);
  const [[qr, tr], sellable, feeBps] = await Promise.all([c.getReserves(), c.sellableTokens(), c.feeBps()]);
  const fee = quoteIn * feeBps / BPS;
  const net = quoteIn - fee;
  let out = net > 0n ? net * tr / (qr + net) : 0n;
  if (out > sellable) out = sellable;
  return { out, fee };
}

export async function quoteSell(curve, tokensIn) {
  const c = curveAt(curve);
  const [[qr, tr], feeBps] = await Promise.all([c.getReserves(), c.feeBps()]);
  const gross = tokensIn > 0n ? tokensIn * qr / (tr + tokensIn) : 0n;
  const fee = gross * feeBps / BPS;
  return { out: gross - fee, fee };
}

const withSlippage = (amount, pct) => amount * BigInt(Math.round((100 - pct) * 100)) / BPS;

export async function buy(curve, quoteIn, slippagePct) {
  const signer = await wallet.signer();
  const me = await signer.getAddress();
  const { out } = await quoteBuy(curve, quoteIn, me);
  const tx = await curveAt(curve, signer).buy(quoteIn, withSlippage(out, slippagePct), me, { value: quoteIn });
  return tx.wait();
}

export async function sell(token, curve, tokensIn, slippagePct, onStep) {
  const signer = await wallet.signer();
  const me = await signer.getAddress();
  const t = tokenAt(token, signer);
  if ((await t.allowance(me, curve)) < tokensIn) {
    onStep?.('approve');
    await (await t.approve(curve, tokensIn)).wait();
  }
  onStep?.('sell');
  const { out } = await quoteSell(curve, tokensIn);
  const tx = await curveAt(curve, signer).sell(tokensIn, withSlippage(out, slippagePct), me);
  return tx.wait();
}

export async function launchFee() {
  try { return await factory().launchFee(); } catch { return null; }
}

// Launches a Pons coin. The caller (launch view) registers it with ZEEP afterwards,
// attaching the collection + raffle policy that Pons itself knows nothing about.
export async function launch(form, onStep) {
  const signer = await wallet.signer();
  const me = await signer.getAddress();
  const f = factory(signer);

  onStep?.('prepare');
  const [allowed, fee, economics] = await Promise.all([
    f.canLaunch(me),
    f.launchFee(),
    f.previewLaunchEconomics(PONS.launchConfigId, PONS.nativePair)
  ]);
  if (!allowed) throw new Error('Pons is not accepting launches from this wallet right now');

  const params = {
    name: form.name.slice(0, 64),
    symbol: form.symbol.slice(0, 16),
    logo: form.logo || '',
    description: form.description.slice(0, 2048),
    socials: { twitter: form.twitter || '', telegram: form.telegram || '', discord: '', website: form.website || '', farcaster: '' },
    creatorFeeRecipient: me,
    creatorTaxBps: Math.max(0, Math.min(MAX_CREATOR_TAX_BPS, Math.round(Number(form.creatorTaxBps) || 0))),
    buybackEnabled: false,
    expectedEconomics: economics,
    salt: ethers.hexlify(ethers.concat([ethers.toUtf8Bytes(SALT_TAG), ethers.randomBytes(32 - SALT_TAG.length)]))
  };

  onStep?.('sign');
  const args = [params, PONS.launchConfigId, PONS.nativePair, []];
  await f.launchToken.staticCall(...args, { value: fee });
  const tx = await f.launchToken(...args, { value: fee });

  onStep?.('confirm');
  const receipt = await tx.wait();
  const iface = new ethers.Interface(ABI.factory);
  for (const log of receipt.logs) {
    try {
      const ev = iface.parseLog(log);
      if (ev?.name === 'TokenLaunched') return { hash: tx.hash, token: ev.args.token, curve: ev.args.curve };
    } catch {}
  }
  return { hash: tx.hash, token: null, curve: null };
}
