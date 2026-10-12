// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Matches lib/config.ts's ABI string exactly (same Pons V2 deployment MONETA and
// Vaul both launch through on Robinhood Chain).

struct Socials {
    string twitter;
    string telegram;
    string discord;
    string website;
    string farcaster;
}

struct LaunchParams {
    string name;
    string symbol;
    string logo;
    string description;
    Socials socials;
    address creatorFeeRecipient;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    bytes32 expectedEconomics;
    bytes32 salt;
}

interface IPonsFactory {
    function launchToken(LaunchParams calldata params, uint256 launchConfigId, address pairToken, address[] calldata snipeTaxExemptions)
        external
        payable
        returns (address token, address curve);

    function previewLaunchEconomics(uint256 launchConfigId, address pairToken) external view returns (bytes32);
    function launchFee() external view returns (uint256);
    function canLaunch(address launcher) external view returns (bool);
}
