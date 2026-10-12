// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPonsFactory, LaunchParams} from "./interfaces/IPonsFactory.sol";
import {ZeepExternalVault} from "./ZeepExternalVault.sol";
import {ZeepFeeRouter} from "./ZeepFeeRouter.sol";
import {ZeepExternalRaffle} from "./ZeepExternalRaffle.sol";

/// @title ZeepExternalLauncher
/// @notice The counterpart to ZeepLauncher for coins that collect on a chain other
/// than Robinhood Chain — this is the one Pokémon/One Piece card launches use,
/// since tokenized graded cards (Courtyard and similar) live on Ethereum mainnet,
/// not Robinhood Chain. Same one-transaction guarantee: deploys the coin's
/// ZeepExternalVault, ZeepFeeRouter and ZeepExternalRaffle, and launches the Pons
/// coin, all atomically. Reuses ZeepFeeRouter as-is — a fee router doesn't care
/// what kind of vault it's funding.
contract ZeepExternalLauncher {
    address public immutable ponsFactory;
    address public immutable treasury;
    address public immutable escrow;
    address public immutable registryOwner;
    address public keeper;

    bytes4 public constant SALT_TAG = bytes4("ZEEP");

    event ExternalCoinLaunched(
        address indexed token,
        address indexed curve,
        address vault,
        address feeRouter,
        address raffle,
        string targetChain,
        string externalCollection
    );
    event KeeperUpdated(address indexed keeper);

    error BadSaltTag();

    constructor(address _ponsFactory, address _treasury, address _escrow, address _registryOwner, address _keeper) {
        ponsFactory = _ponsFactory;
        treasury = _treasury;
        escrow = _escrow;
        registryOwner = _registryOwner;
        keeper = _keeper;
    }

    /// @param targetChain e.g. "ethereum" — informational, read by the keeper to
    /// know which chain to bridge to and which OpenSea API region to query.
    /// @param externalCollection the collection identifier on that chain (a real
    /// address as a string for EVM chains, a program/collection id for Solana).
    function launch(LaunchParams memory params, uint256 launchConfigId, address pairToken, string calldata targetChain, string calldata externalCollection)
        external
        payable
        returns (address token, address curve, address vault, address feeRouter, address raffle)
    {
        if (bytes4(params.salt) != SALT_TAG) revert BadSaltTag();

        vault = address(new ZeepExternalVault(targetChain, externalCollection, keeper, registryOwner));
        feeRouter = address(new ZeepFeeRouter(vault, treasury, escrow));
        params.creatorFeeRecipient = feeRouter;

        (token, curve) = IPonsFactory(ponsFactory).launchToken{value: msg.value}(params, launchConfigId, pairToken, new address[](0));

        raffle = address(new ZeepExternalRaffle(vault, keeper));

        emit ExternalCoinLaunched(token, curve, vault, feeRouter, raffle, targetChain, externalCollection);
    }

    function setKeeper(address _keeper) external {
        require(msg.sender == registryOwner, "not registry owner");
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }
}
