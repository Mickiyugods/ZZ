// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Test-only stand-in for the real Pons fee escrow. Lets tests fund a
/// recipient's claimable balance and then exercises the real claim()/balanceOf()
/// interface ZeepFeeRouter depends on.
contract MockPonsEscrow {
    mapping(address => uint256) public balanceOf;

    function fund(address recipient) external payable {
        balanceOf[recipient] += msg.value;
    }

    function claim() external {
        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "claim transfer failed");
    }
}
