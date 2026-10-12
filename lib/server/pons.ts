// Pons V2 addresses and launch-call decoding, shared by server routes.

import { Interface, getAddress } from "ethers";

export const FACTORY = getAddress("0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e");
export const ROUTER = getAddress("0xe33E9E479dF8802cb0866d5d05258bEc4cF62948");
export const ESCROW = getAddress("0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e");
export const SALT_PREFIX = "0x" + Buffer.from("ZEEP").toString("hex");

// Read-only: the escrow's claimable balance for a creatorFeeRecipient. No private
// key needed — only the recipient itself can actually claim() this.
export const escrowAbi = ["function balanceOf(address recipient) view returns (uint256)"];

export const factoryReadAbi = [
  "function getLaunchedToken(address token) view returns ((address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists))",
];

const SOCIALS = "(string twitter, string telegram, string discord, string website, string farcaster)";
const LAUNCH_PARAMS = `(string name, string symbol, string logo, string description, ${SOCIALS} socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 expectedEconomics, bytes32 salt)`;

export const launchIface = new Interface([
  `function launchToken(${LAUNCH_PARAMS} params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)`,
  `function launchAndBuy(${LAUNCH_PARAMS} params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)`,
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
]);
