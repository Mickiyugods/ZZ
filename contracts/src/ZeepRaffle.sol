// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IZeepVault {
    function handOffToOutcome(uint256 tokenId) external;
}

/// @title ZeepRaffle
/// @notice The ZeepVault's `outcomeHandler` for "raffle" and "burn" policy coins
/// (never deployed for "hold" coins — those NFTs just stay in the vault forever).
/// Nobody — not the creator, not the keeper, not ZEEP — picks a raffle winner.
///
/// Raffle, in five public steps, exactly matching vaul.app's documented design:
///  1. Snapshot: the keeper posts a Merkle root over every holder's ticket range
///     (tickets = token balance at snapshot time; off-chain, published alongside
///     proofs so anyone can verify their own range independently).
///  2. The snapshot must sit public for 15 minutes before a draw can start.
///  3. Commit: anyone calls commitDraw(), pinning a block 20 blocks in the future.
///     Nobody — including whoever calls it — can know that block's hash yet.
///  4. Draw: anyone calls draw() once that block exists; the winning ticket comes
///     from its hash. If nobody draws within 256 blocks the commit expires and can
///     be retried, so a draw can never be griefed shut forever.
///  5. Delivery: the winner (or anyone on their behalf) calls deliver() with their
///     Merkle proof; the contract verifies their ticket range covers the winning
///     ticket and forwards the NFT straight from the vault to their wallet.
contract ZeepRaffle is ReentrancyGuard, IERC721Receiver, Ownable {
    enum Policy {
        Raffle,
        Burn
    }

    address public immutable vault;
    address public immutable collection;
    address public keeper;
    Policy public immutable policy;

    uint256 public constant SNAPSHOT_WAIT = 15 minutes;
    uint256 public constant COMMIT_LEAD_BLOCKS = 20;
    uint256 public constant DRAW_WINDOW_BLOCKS = 256;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    struct Giveaway {
        bytes32 merkleRoot; // leaf = keccak256(abi.encodePacked(wallet, ticketStart, ticketCount))
        uint256 totalTickets;
        uint256 snapshotAt;
        uint256 commitBlock;
        uint256 winningTicket;
        bool committed;
        bool drawn;
        bool delivered;
    }

    mapping(uint256 => Giveaway) public giveaways; // tokenId => giveaway

    event GiveawayOpened(uint256 indexed tokenId, bytes32 merkleRoot, uint256 totalTickets, uint256 snapshotAt);
    event DrawCommitted(uint256 indexed tokenId, uint256 targetBlock);
    event DrawCompleted(uint256 indexed tokenId, uint256 winningTicket);
    event Delivered(uint256 indexed tokenId, address indexed winner);
    event Burned(uint256 indexed tokenId);
    event KeeperUpdated(address indexed keeper);

    error NotKeeper();
    error WrongPolicy();
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
    error AlreadyDelivered();
    error TicketOutOfRange();
    error InvalidProof();
    error ZeroTickets();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(address _vault, address _collection, address _keeper, Policy _policy, address _owner) Ownable(_owner) {
        vault = _vault;
        collection = _collection;
        keeper = _keeper;
        policy = _policy;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /// @notice Burn-policy coins skip the whole ticket system: the keeper pulls the
    /// NFT from the vault and sends it straight to the burn address.
    function burnNow(uint256 tokenId) external onlyKeeper nonReentrant {
        if (policy != Policy.Burn) revert WrongPolicy();
        IZeepVault(vault).handOffToOutcome(tokenId);
        IERC721(collection).safeTransferFrom(address(this), BURN_ADDRESS, tokenId);
        emit Burned(tokenId);
    }

    /// @notice Opens a raffle for one purchased NFT. `merkleRoot` commits to the
    /// full ticket-range list (published off-chain with proofs); `totalTickets`
    /// is the sum of every eligible wallet's balance at snapshot time. Only real
    /// holder wallets get tickets — the curve, pools and the vault itself never do.
    function openGiveaway(uint256 tokenId, bytes32 merkleRoot, uint256 totalTickets) external onlyKeeper {
        if (policy != Policy.Raffle) revert WrongPolicy();
        if (giveaways[tokenId].snapshotAt != 0) revert AlreadyOpened();
        if (totalTickets == 0) revert ZeroTickets();
        giveaways[tokenId] = Giveaway({
            merkleRoot: merkleRoot,
            totalTickets: totalTickets,
            snapshotAt: block.timestamp,
            commitBlock: 0,
            winningTicket: 0,
            committed: false,
            drawn: false,
            delivered: false
        });
        emit GiveawayOpened(tokenId, merkleRoot, totalTickets, block.timestamp);
    }

    /// @notice Anyone may call this — pins a block 20 blocks ahead as the future
    /// randomness source. Re-callable if a prior commit's window lapsed unused.
    function commitDraw(uint256 tokenId) external {
        Giveaway storage g = giveaways[tokenId];
        if (g.snapshotAt == 0) revert NotOpened();
        if (block.timestamp < g.snapshotAt + SNAPSHOT_WAIT) revert TooEarly();
        if (g.drawn) revert AlreadyDrawn();
        if (g.committed && block.number <= g.commitBlock + DRAW_WINDOW_BLOCKS) revert AlreadyCommitted();

        g.commitBlock = block.number + COMMIT_LEAD_BLOCKS;
        g.committed = true;
        emit DrawCommitted(tokenId, g.commitBlock);
    }

    /// @notice Anyone may call this once the committed block exists. The winning
    /// ticket is `blockhash(commitBlock) % totalTickets` — nobody controlled that
    /// hash when commitDraw() was called, including whoever calls draw() now.
    function draw(uint256 tokenId) external {
        Giveaway storage g = giveaways[tokenId];
        if (!g.committed) revert NotCommitted();
        if (g.drawn) revert AlreadyDrawn();
        if (block.number <= g.commitBlock) revert TargetBlockNotMined();
        if (block.number > g.commitBlock + DRAW_WINDOW_BLOCKS) revert CommitExpired();

        bytes32 seed = blockhash(g.commitBlock);
        if (seed == bytes32(0)) revert BlockhashUnavailable();

        g.winningTicket = uint256(seed) % g.totalTickets;
        g.drawn = true;
        emit DrawCompleted(tokenId, g.winningTicket);
    }

    /// @notice The winner (or anyone delivering on their behalf) proves their
    /// published ticket range covers the winning ticket and receives the NFT
    /// straight from the vault. Callable exactly once per giveaway.
    function deliver(uint256 tokenId, address winner, uint256 ticketStart, uint256 ticketCount, bytes32[] calldata proof) external nonReentrant {
        Giveaway storage g = giveaways[tokenId];
        if (!g.drawn) revert NotDrawn();
        if (g.delivered) revert AlreadyDelivered();
        if (g.winningTicket < ticketStart || g.winningTicket >= ticketStart + ticketCount) revert TicketOutOfRange();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(winner, ticketStart, ticketCount))));
        if (!MerkleProof.verify(proof, g.merkleRoot, leaf)) revert InvalidProof();

        g.delivered = true;
        IZeepVault(vault).handOffToOutcome(tokenId);
        IERC721(collection).safeTransferFrom(address(this), winner, tokenId);
        emit Delivered(tokenId, winner);
    }

    /// @notice Registry-owner-gated, same recovery path as ZeepVault.setKeeper —
    /// so a compromised or lost keeper key can be rotated out here independently
    /// of the vault, instead of leaving the old key in control of this contract.
    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }
}
