// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LaunchParams} from "../interfaces/IPonsFactory.sol";

/// @dev Test-only stand-in for the real Pons V2 factory. Deploys a trivial ERC20
/// so ZeepLauncher's full flow (deploy vault+router+raffle, then launch the coin,
/// then wire the outcome handler) can be exercised without the real Pons bytecode.
contract MockToken {
    string public name;
    string public symbol;
    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }
}

contract MockPonsFactory {
    uint256 public launchFeeAmount = 0.0005 ether;
    bool public allowed = true;

    event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold);

    function launchFee() external view returns (uint256) {
        return launchFeeAmount;
    }

    function canLaunch(address) external view returns (bool) {
        return allowed;
    }

    function previewLaunchEconomics(uint256, address) external pure returns (bytes32) {
        return bytes32(0);
    }

    function launchToken(LaunchParams calldata params, uint256 launchConfigId, address pairToken, address[] calldata)
        external
        payable
        returns (address token, address curve)
    {
        require(msg.value >= launchFeeAmount, "insufficient launch fee");
        token = address(new MockToken(params.name, params.symbol));
        curve = address(new MockToken("curve", "CURVE")); // just needs an address, not real curve behaviour
        emit TokenLaunched(token, curve, msg.sender, pairToken, launchConfigId, 0);
    }
}
