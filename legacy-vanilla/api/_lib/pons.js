// Pons V2 addresses and launch-call decoding, shared by server functions.

const { Interface, getAddress } = require('ethers');

const FACTORY = getAddress('0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e');
const ROUTER = getAddress('0xe33E9E479dF8802cb0866d5d05258bEc4cF62948');
const SALT_PREFIX = '0x' + Buffer.from('ZEEP').toString('hex');

const SOCIALS = '(string twitter, string telegram, string discord, string website, string farcaster)';
const LAUNCH_PARAMS = `(string name, string symbol, string logo, string description, ${SOCIALS} socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 expectedEconomics, bytes32 salt)`;

const launchIface = new Interface([
  `function launchToken(${LAUNCH_PARAMS} params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)`,
  `function launchAndBuy(${LAUNCH_PARAMS} params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)`,
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)'
]);

module.exports = { FACTORY, ROUTER, SALT_PREFIX, launchIface };
