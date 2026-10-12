// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPonsEscrow {
    function claim() external;
    function balanceOf(address recipient) external view returns (uint256);
}

/// @title ZeepFeeRouter
/// @notice One per coin. Set as the coin's `creatorFeeRecipient` on the Pons
/// factory at launch. Its only job: pull this coin's claimable creator fees from
/// the Pons escrow and split them 80% to the coin's ZeepVault, 20% to the ZEEP
/// treasury, in one transaction. `harvest()` is public — anyone can call it (the
/// keeper does, roughly every 30 minutes, but a holder impatient for a draw can
/// call it too). There is no function that can redirect the split anywhere else.
contract ZeepFeeRouter is ReentrancyGuard {
    address public immutable vault;
    address public immutable treasury;
    address public immutable escrow;

    uint16 public constant VAULT_BPS = 8000;
    uint16 public constant BPS_DENOMINATOR = 10000;

    event Harvested(uint256 total, uint256 toVault, uint256 toTreasury);

    error NothingToHarvest();
    error TransferFailed();

    constructor(address _vault, address _treasury, address _escrow) {
        vault = _vault;
        treasury = _treasury;
        escrow = _escrow;
    }

    /// @notice Claims this router's balance from the Pons fee escrow (if any) and
    /// immediately forwards the fixed 80/20 split. Reverts if there is nothing to
    /// move, so a harvest only ever appears on chain when it actually did something.
    function harvest() external nonReentrant {
        uint256 claimable = IPonsEscrow(escrow).balanceOf(address(this));
        if (claimable > 0) {
            IPonsEscrow(escrow).claim();
        }

        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToHarvest();

        uint256 toVault = (bal * VAULT_BPS) / BPS_DENOMINATOR;
        uint256 toTreasury = bal - toVault;

        (bool okVault, ) = vault.call{value: toVault}("");
        if (!okVault) revert TransferFailed();
        (bool okTreasury, ) = treasury.call{value: toTreasury}("");
        if (!okTreasury) revert TransferFailed();

        emit Harvested(bal, toVault, toTreasury);
    }

    /// @dev Accepts the optional creator tax (paid directly in ETH alongside Pons
    /// trades, not through the escrow) and anything else sent its way; `harvest()`
    /// sweeps the whole balance regardless of source.
    receive() external payable {}
}
