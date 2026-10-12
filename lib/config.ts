// Chain, contract and API settings for ZEEP.

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  rpc: "https://robinhood-rpc.publicnode.com",
  explorer: "https://robinhoodchain.blockscout.com",
  currency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

// Pons V2 on Robinhood Chain. Coins are regular Pons launches; ZEEP adds a vault on top.
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  router: "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948",
  escrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
  locker: "0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952",
  site: "https://www.ponsfamily.com",
  launchConfigId: 0n,
  nativePair: "0x0000000000000000000000000000000000000000",
  supply: 1_000_000_000,
};

// First bytes of every ZEEP launch salt; /api/register only accepts launches carrying it.
export const SALT_TAG = "ZEEP";

// Seaport 1.6's canonical deterministic-deployer address — identical on every EVM
// chain it's deployed to (Robinhood Chain included), so this is shared public
// infrastructure, not anything ZEEP (or Vaul) deployed itself.
export const SEAPORT_1_6 = "0x0000000000000068F116a894984e2DB1123eB395";

export const VAULT = {
  vaultBps: 8000,
  protocolBps: 2000,
  ceilingTtlSeconds: 3600,
  market: "Seaport 1.6",
  outcomes: ["raffle", "hold", "burn"] as const,
};

export const SLIPPAGE_OPTIONS = [0.5, 1, 3, 5];
export const DEFAULT_SLIPPAGE = 3;
export const MAX_CREATOR_TAX_BPS = 500;

const SOCIALS = "(string twitter, string telegram, string discord, string website, string farcaster)";
const LAUNCH_PARAMS = `(string name, string symbol, string logo, string description, ${SOCIALS} socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 expectedEconomics, bytes32 salt)`;

export const ABI = {
  factory: [
    `function launchToken(${LAUNCH_PARAMS} params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)`,
    "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
    "function launchFee() view returns (uint256)",
    "function canLaunch(address launcher) view returns (bool)",
    "function getLaunchedToken(address token) view returns ((address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists))",
    "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
  ],
  router: [
    `function launchAndBuy(${LAUNCH_PARAMS} params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)`,
  ],
  curve: [
    "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
    "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
    "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
    "function realQuoteReserve() view returns (uint256)",
    "function graduationThreshold() view returns (uint256)",
    "function sellableTokens() view returns (uint256)",
    "function graduated() view returns (bool)",
    "function feeBps() view returns (uint256)",
  ],
  token: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
  ],
};
