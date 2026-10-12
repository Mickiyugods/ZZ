// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Minimal Seaport 1.6 interface: only the "basic order" path, which covers a
// straight ETH -> single ERC721 purchase (an OpenSea "buy now" fill). This is
// Seaport's real, stable ABI (unchanged since 1.1) — not a simplified stand-in.
// Full protocol: https://github.com/ProjectOpenSea/seaport

enum BasicOrderType {
    ETH_TO_ERC721_FULL_OPEN,
    ETH_TO_ERC721_PARTIAL_OPEN,
    ETH_TO_ERC721_FULL_RESTRICTED,
    ETH_TO_ERC721_PARTIAL_RESTRICTED,
    ETH_TO_ERC1155_FULL_OPEN,
    ETH_TO_ERC1155_PARTIAL_OPEN,
    ETH_TO_ERC1155_FULL_RESTRICTED,
    ETH_TO_ERC1155_PARTIAL_RESTRICTED,
    ERC20_TO_ERC721_FULL_OPEN,
    ERC20_TO_ERC721_PARTIAL_OPEN,
    ERC20_TO_ERC721_FULL_RESTRICTED,
    ERC20_TO_ERC721_PARTIAL_RESTRICTED,
    ERC20_TO_ERC1155_FULL_OPEN,
    ERC20_TO_ERC1155_PARTIAL_OPEN,
    ERC20_TO_ERC1155_FULL_RESTRICTED,
    ERC20_TO_ERC1155_PARTIAL_RESTRICTED,
    ERC721_TO_ERC20_FULL_OPEN,
    ERC721_TO_ERC20_PARTIAL_OPEN,
    ERC721_TO_ERC20_FULL_RESTRICTED,
    ERC721_TO_ERC20_PARTIAL_RESTRICTED,
    ERC1155_TO_ERC20_FULL_OPEN,
    ERC1155_TO_ERC20_PARTIAL_OPEN,
    ERC1155_TO_ERC20_FULL_RESTRICTED,
    ERC1155_TO_ERC20_PARTIAL_RESTRICTED
}

struct AdditionalRecipient {
    uint256 amount;
    address payable recipient;
}

struct BasicOrderParameters {
    address considerationToken;
    uint256 considerationIdentifier;
    uint256 considerationAmount;
    address payable offerer;
    address zone;
    address offerToken;
    uint256 offerIdentifier;
    uint256 offerAmount;
    BasicOrderType basicOrderType;
    uint256 startTime;
    uint256 endTime;
    bytes32 zoneHash;
    uint256 salt;
    bytes32 offererConduitKey;
    bytes32 fulfillerConduitKey;
    uint256 totalOriginalAdditionalRecipients;
    AdditionalRecipient[] additionalRecipients;
    bytes signature;
}

interface ISeaportBasic {
    function fulfillBasicOrder(BasicOrderParameters calldata parameters) external payable returns (bool fulfilled);
}
