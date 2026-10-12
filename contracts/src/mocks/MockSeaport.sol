// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ISeaportBasic, BasicOrderParameters} from "../interfaces/ISeaportBasic.sol";

/// @dev Test-only stand-in for Seaport 1.6. Just enough of fulfillBasicOrder to
/// exercise ZeepVault.buy(): pulls the NFT from the (pre-approving) offerer and
/// forwards the ETH to them, exactly like a real "buy now" fill would.
contract MockSeaport is ISeaportBasic {
    function fulfillBasicOrder(BasicOrderParameters calldata parameters) external payable override returns (bool fulfilled) {
        require(msg.value == parameters.considerationAmount, "wrong value sent");
        IERC721(parameters.offerToken).safeTransferFrom(parameters.offerer, msg.sender, parameters.offerIdentifier);
        (bool ok, ) = parameters.offerer.call{value: msg.value}("");
        require(ok, "pay offerer failed");
        return true;
    }
}
