// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPonsFactory, LaunchParams} from "./interfaces/IPonsFactory.sol";
import {ZeepVault} from "./ZeepVault.sol";
import {ZeepFeeRouter} from "./ZeepFeeRouter.sol";
import {ZeepRaffle} from "./ZeepRaffle.sol";

/// @title ZeepLauncher
/// @notice Deploys a coin's whole vault stack and the Pons coin itself in one
/// transaction, matching vaul.app's documented flow: "one transaction creates the
/// coin on Pons plus its vault and fee router." After this call, the collection,
/// the outcome policy and the fee recipient are locked forever — nothing here, not
/// even this contract's owner, has a function to change them.
contract ZeepLauncher {
    enum Policy {
        Hold,
        Raffle,
        Burn
    }

    address public immutable ponsFactory;
    address public immutable seaport;
    address public immutable treasury;
    address public immutable escrow;
    address public immutable registryOwner; // can rotate a vault's keeper later; cannot touch funds or change policy
    address public keeper;

    // First 4 bytes of every ZEEP launch salt, matching lib/config.ts's SALT_TAG
    // so api/register-style verification keeps working unchanged.
    bytes4 public constant SALT_TAG = bytes4("ZEEP");

    event CoinLaunched(
        address indexed token,
        address indexed curve,
        address vault,
        address feeRouter,
        address raffle,
        address collection,
        Policy policy
    );
    event KeeperUpdated(address indexed keeper);

    error BadSaltTag();

    constructor(address _ponsFactory, address _seaport, address _treasury, address _escrow, address _registryOwner, address _keeper) {
        ponsFactory = _ponsFactory;
        seaport = _seaport;
        treasury = _treasury;
        escrow = _escrow;
        registryOwner = _registryOwner;
        keeper = _keeper;
    }

    /// @notice Launches a coin paired with `collection` under `policy`. `params`
    /// must carry a `salt` starting with the ZEEP tag (its `creatorFeeRecipient` is
    /// overwritten with the freshly-deployed fee router regardless of what's passed
    /// in). Forwards `msg.value` to Pons as the launch fee.
    function launch(LaunchParams memory params, uint256 launchConfigId, address pairToken, address collection, Policy policy)
        external
        payable
        returns (address token, address curve, address vault, address feeRouter, address raffle)
    {
        if (bytes4(params.salt) != SALT_TAG) revert BadSaltTag();

        // The launcher itself is the vault's *temporary* owner — just long enough
        // to wire the outcome handler atomically in this same transaction — then
        // hands ownership off to the real registryOwner below. Nothing external
        // can ever observe (or front-run) the vault in the gap, because there is
        // no gap: it's all one transaction.
        vault = address(new ZeepVault(collection, seaport, keeper, address(this)));
        feeRouter = address(new ZeepFeeRouter(vault, treasury, escrow));
        params.creatorFeeRecipient = feeRouter;

        (token, curve) = IPonsFactory(ponsFactory).launchToken{value: msg.value}(params, launchConfigId, pairToken, new address[](0));

        if (policy != Policy.Hold) {
            ZeepRaffle.Policy outcomePolicy = policy == Policy.Raffle ? ZeepRaffle.Policy.Raffle : ZeepRaffle.Policy.Burn;
            raffle = address(new ZeepRaffle(vault, collection, keeper, outcomePolicy));
            ZeepVault(payable(vault)).setOutcomeHandler(raffle);
        }

        ZeepVault(payable(vault)).transferOwnership(registryOwner);

        emit CoinLaunched(token, curve, vault, feeRouter, raffle, collection, policy);
    }

    /// @notice Registry-owner-gated: rotates the keeper address used for *new*
    /// launches going forward. Existing coins' vaults keep their own keeper until
    /// the registry owner calls `setKeeper` on each of them individually — a
    /// compromised keeper key can't be silently re-pointed at every vault at once.
    function setKeeper(address _keeper) external {
        require(msg.sender == registryOwner, "not registry owner");
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }
}
