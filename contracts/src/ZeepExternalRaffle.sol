// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ZeepExternalRaffle
/// @notice Same public, nobody-picks-the-winner draw as ZeepRaffle (snapshot ->
/// 15 min public -> commit a future block -> draw from its hash), but for an NFT
/// that lives on another chain. This contract can prove who won on Robinhood
/// Chain, but it cannot move an asset it doesn't hold — so `deliver()` verifies
/// the winner's Merkle proof and emits a durable, on-chain "this wallet proved it
/// won" event instead of transferring anything. The keeper (or the winner, from
/// the Giveaways page) then sends the real NFT on the target chain and the keeper
/// writes the receipt back with recordDelivery().
contract ZeepExternalRaffle {
    address public immutable vault; // the ZeepExternalVault that bought the NFT
    address public keeper;

    uint256 public constant SNAPSHOT_WAIT = 15 minutes;
    uint256 public constant COMMIT_LEAD_BLOCKS = 20;
    uint256 public constant DRAW_WINDOW_BLOCKS = 256;

    struct Giveaway {
        bytes32 merkleRoot;
        uint256 totalTickets;
        uint256 snapshotAt;
        uint256 commitBlock;
        uint256 winningTicket;
        bool committed;
        bool drawn;
        bool winnerVerified;
        address winner;
        bool delivered;
    }

    // externalTokenId (e.g. a Courtyard NFT id as a string hash) => giveaway
    mapping(bytes32 => Giveaway) public giveaways;

    event GiveawayOpened(bytes32 indexed tokenKey, string externalTokenId, bytes32 merkleRoot, uint256 totalTickets, uint256 snapshotAt);
    event DrawCommitted(bytes32 indexed tokenKey, uint256 targetBlock);
    event DrawCompleted(bytes32 indexed tokenKey, uint256 winningTicket);
    event WinnerVerified(bytes32 indexed tokenKey, address indexed winner);
    event DeliveryRecorded(bytes32 indexed tokenKey, address indexed winner, string targetChainTxHash);
    event KeeperUpdated(address indexed keeper);

    error NotKeeper();
    error AlreadyOpened();
    error NotOpened();
    error TooEarly();
    error AlreadyCommitted();
    error NotCommitted();
    error AlreadyDrawn();
    error NotDrawn();
    error TargetBlockNotMined();
    error CommitExpired();
    error BlockhashUnavailable();
    error WinnerNotVerified();
    error AlreadyVerified();
    error AlreadyDelivered();
    error TicketOutOfRange();
    error InvalidProof();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(address _vault, address _keeper) {
        vault = _vault;
        keeper = _keeper;
    }

    function tokenKey(string calldata externalTokenId) public pure returns (bytes32) {
        return keccak256(bytes(externalTokenId));
    }

    function openGiveaway(string calldata externalTokenId, bytes32 merkleRoot, uint256 totalTickets) external onlyKeeper {
        bytes32 key = tokenKey(externalTokenId);
        if (giveaways[key].snapshotAt != 0) revert AlreadyOpened();
        giveaways[key] = Giveaway({
            merkleRoot: merkleRoot,
            totalTickets: totalTickets,
            snapshotAt: block.timestamp,
            commitBlock: 0,
            winningTicket: 0,
            committed: false,
            drawn: false,
            winnerVerified: false,
            winner: address(0),
            delivered: false
        });
        emit GiveawayOpened(key, externalTokenId, merkleRoot, totalTickets, block.timestamp);
    }

    function commitDraw(string calldata externalTokenId) external {
        bytes32 key = tokenKey(externalTokenId);
        Giveaway storage g = giveaways[key];
        if (g.snapshotAt == 0) revert NotOpened();
        if (block.timestamp < g.snapshotAt + SNAPSHOT_WAIT) revert TooEarly();
        if (g.drawn) revert AlreadyDrawn();
        if (g.committed && block.number <= g.commitBlock + DRAW_WINDOW_BLOCKS) revert AlreadyCommitted();

        g.commitBlock = block.number + COMMIT_LEAD_BLOCKS;
        g.committed = true;
        emit DrawCommitted(key, g.commitBlock);
    }

    function draw(string calldata externalTokenId) external {
        bytes32 key = tokenKey(externalTokenId);
        Giveaway storage g = giveaways[key];
        if (!g.committed) revert NotCommitted();
        if (g.drawn) revert AlreadyDrawn();
        if (block.number <= g.commitBlock) revert TargetBlockNotMined();
        if (block.number > g.commitBlock + DRAW_WINDOW_BLOCKS) revert CommitExpired();

        bytes32 seed = blockhash(g.commitBlock);
        if (seed == bytes32(0)) revert BlockhashUnavailable();

        g.winningTicket = uint256(seed) % g.totalTickets;
        g.drawn = true;
        emit DrawCompleted(key, g.winningTicket);
    }

    /// @notice Anyone can prove a wallet's ticket range covers the winning ticket.
    /// This is the on-chain source of truth for who won — the keeper (or the
    /// winner themselves, from the Giveaways page) is expected to watch for
    /// WinnerVerified and deliver the real NFT on the target chain.
    function verifyWinner(string calldata externalTokenId, address winner, uint256 ticketStart, uint256 ticketCount, bytes32[] calldata proof) external {
        bytes32 key = tokenKey(externalTokenId);
        Giveaway storage g = giveaways[key];
        if (!g.drawn) revert NotDrawn();
        if (g.winnerVerified) revert AlreadyVerified();
        if (g.winningTicket < ticketStart || g.winningTicket >= ticketStart + ticketCount) revert TicketOutOfRange();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(winner, ticketStart, ticketCount))));
        if (!MerkleProof.verify(proof, g.merkleRoot, leaf)) revert InvalidProof();

        g.winnerVerified = true;
        g.winner = winner;
        emit WinnerVerified(key, winner);
    }

    /// @notice The keeper writes back proof of delivery once the real NFT has
    /// been sent to the winner's wallet on the target chain.
    function recordDelivery(string calldata externalTokenId, string calldata targetChainTxHash) external onlyKeeper {
        bytes32 key = tokenKey(externalTokenId);
        Giveaway storage g = giveaways[key];
        if (!g.winnerVerified) revert WinnerNotVerified();
        if (g.delivered) revert AlreadyDelivered();
        g.delivered = true;
        emit DeliveryRecorded(key, g.winner, targetChainTxHash);
    }

    function setKeeper(address _keeper) external onlyKeeper {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }
}
