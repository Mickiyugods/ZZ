// Deploys ZEEP's two launcher contracts (native-collection + external-chain) on
// Robinhood Chain. Both are pure infrastructure — per-coin Vault/FeeRouter/Raffle
// contracts are deployed on demand, one set per launch, by these launchers.
//
// Required parameters (see ignition/parameters/*.json — never commit real values):
//   ponsFactory   - Pons V2 factory on Robinhood Chain (same for every project; see lib/config.ts)
//   escrow        - Pons fee escrow (same)
//   seaport       - Seaport 1.6 (canonical cross-chain address)
//   treasury      - ZEEP's treasury wallet (receives the 20% protocol share)
//   registryOwner - can cancel External Vault withdrawals and rotate a vault's keeper; start as a single trusted wallet, move to a multisig before real volume
//   keeper        - the automated job's wallet (see lib/server/keeper.ts once it calls these contracts for real)
//
// Run: npx hardhat ignition deploy ignition/modules/ZeepCore.ts --network robinhood --parameters ignition/parameters/robinhood.json

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ZeepCore", (m) => {
  const ponsFactory = m.getParameter("ponsFactory");
  const escrow = m.getParameter("escrow");
  const seaport = m.getParameter("seaport");
  const treasury = m.getParameter("treasury");
  const registryOwner = m.getParameter("registryOwner");
  const keeper = m.getParameter("keeper");

  const launcher = m.contract("ZeepLauncher", [ponsFactory, seaport, treasury, escrow, registryOwner, keeper]);

  const externalLauncher = m.contract("ZeepExternalLauncher", [ponsFactory, treasury, escrow, registryOwner, keeper]);

  return { launcher, externalLauncher };
});
