// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ISeaportBasic, BasicOrderParameters} from "./interfaces/ISeaportBasic.sol";

/// @title ZeepVault
/// @notice One vault per coin. Holds the coin's share of trading fees and the NFTs
/// it buys with them. Mirrors vaul.app's documented vault rules exactly:
///   - pays only through Seaport 1.6 (the `seaport` address is fixed at deploy time)
///   - never pays above a keeper-posted price ceiling, which expires after 1 hour
///   - reverts unless it ends up owning the exact NFT from its own collection
///   - rejects NFTs from any other collection
///   - has NO withdraw function — ETH leaves only as payment for an NFT purchase
/// Receives ETH only from its ZeepFeeRouter (the harvest() split) and, once a
/// giveaway resolves, hands a purchased NFT to the ZeepRaffle contract (raffle
/// policy), or never moves it again (hold), or burns it (burn) — see ZeepRaffle.sol.
contract ZeepVault is ReentrancyGuard, Ownable {
    address public immutable collection;
    address public immutable seaport;
    address public keeper;
    address public outcomeHandler; // ZeepRaffle for "raffle"/"burn" policies; address(0) for "hold"

    uint256 public priceCeiling;
    uint256 public ceilingExpiresAt;

    event Funded(uint256 amount);
    event CeilingPosted(uint256 ceiling, uint256 expiresAt);
    event Purchased(uint256 indexed tokenId, uint256 price);
    event KeeperUpdated(address indexed keeper);
    event OutcomeHandlerUpdated(address indexed handler);
    event NftHandedOff(uint256 indexed tokenId, address indexed to);

    error NotKeeper();
    error CeilingExpired();
    error OverCeiling();
    error WrongCollection();
    error PurchaseFailed();
    error DidNotReceiveNft();
    error NoCeilingPosted();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(address _collection, address _seaport, address _keeper, address _owner) Ownable(_owner) {
        collection = _collection;
        seaport = _seaport;
        keeper = _keeper;
    }

    receive() external payable {
        emit Funded(msg.value);
    }

    /// @notice The keeper posts a spend ceiling sourced from the collection's live
    /// floor. Expires after 1 hour so a stale ceiling can never be reused.
    function postCeiling(uint256 ceiling) external onlyKeeper {
        priceCeiling = ceiling;
        ceilingExpiresAt = block.timestamp + 1 hours;
        emit CeilingPosted(ceiling, ceilingExpiresAt);
    }

    /// @notice Fulfils a Seaport 1.6 basic order (ETH -> single ERC721) for the
    /// vault's own collection, bounded by the posted ceiling, and verifies the
    /// vault actually ends up owning the exact token before returning.
    function buy(BasicOrderParameters calldata order, uint256 tokenId) external onlyKeeper nonReentrant {
        if (ceilingExpiresAt == 0) revert NoCeilingPosted();
        if (block.timestamp > ceilingExpiresAt) revert CeilingExpired();
        if (order.offerToken != collection) revert WrongCollection();
        if (order.offerIdentifier != tokenId) revert WrongCollection();
        if (order.considerationAmount > priceCeiling) revert OverCeiling();

        // Consume the ceiling before the external call (checks-effects-interactions).
        uint256 price = order.considerationAmount;
        priceCeiling = 0;
        ceilingExpiresAt = 0;

        bool ok = ISeaportBasic(seaport).fulfillBasicOrder{value: price}(order);
        if (!ok) revert PurchaseFailed();
        if (IERC721(collection).ownerOf(tokenId) != address(this)) revert DidNotReceiveNft();

        emit Purchased(tokenId, price);
    }

    /// @notice Owner-controlled (the ZeepLauncher/registry) key rotation — e.g. if
    /// the keeper's hot wallet needs to be replaced. Cannot touch funds directly.
    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    /// @notice Set once, at launch, to the coin's ZeepRaffle contract (raffle/burn
    /// policies) or left as address(0) forever (hold policy).
    function setOutcomeHandler(address _handler) external onlyOwner {
        require(outcomeHandler == address(0), "outcome handler already set");
        outcomeHandler = _handler;
        emit OutcomeHandlerUpdated(_handler);
    }

    /// @notice The only way an NFT ever leaves this vault: handed to the policy
    /// contract that was locked in at launch (raffle winner delivery or burn).
    /// Never callable by the keeper, never an arbitrary address.
    function handOffToOutcome(uint256 tokenId) external nonReentrant {
        require(msg.sender == outcomeHandler, "not outcome handler");
        IERC721(collection).safeTransferFrom(address(this), outcomeHandler, tokenId);
        emit NftHandedOff(tokenId, outcomeHandler);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // Deliberately no withdraw()/rescue() function for ETH or the collection's
    // NFTs. This is intentional, not an oversight — see the contract's docstring.
}
