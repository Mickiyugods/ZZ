// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ZeepExternalVault
/// @notice For coins that collect on a chain other than Robinhood Chain — exactly
/// where real tokenized Pokémon / One Piece graded cards live today (e.g. Courtyard
/// collections on Ethereum mainnet). A Robinhood Chain contract cannot buy an NFT
/// on another chain directly, so this vault only does the part it safely can:
///   1. Announce — the keeper announces an exact withdrawal amount, publicly logged.
///   2. Wait 1 hour — funds cannot move until the wait elapses; `owner` (the
///      registry) can cancel if anything looks wrong, no reason required.
///   3. Execute — once the wait has passed, the keeper pulls the announced amount
///      into its own wallet on Robinhood Chain, to bridge from there.
///   4. Record — after bridging (via Relay) and buying on the target chain, the
///      keeper calls recordPurchase() with the real transaction hash there, so
///      every buy still has a public, on-chain-referenced receipt.
/// This is deliberately less trustless than ZeepVault: while funds are bridged and
/// the NFT sits on the target chain, they're in the keeper's custody there. The
/// delay, the cancel option and the on-chain receipt are what bound that risk —
/// they don't remove it. Mirrors vaul.app's own documented "Other chains" design
/// and its own stated risk disclosure for it.
contract ZeepExternalVault is ReentrancyGuard, Ownable {
    address public keeper;
    string public targetChain; // e.g. "ethereum", "base", "solana"
    string public externalCollection; // collection identifier on the target chain (address or program id — a string since it may not be a 20-byte EVM address, e.g. Solana)

    uint256 public constant WAIT_PERIOD = 1 hours;

    struct Withdrawal {
        uint256 amount;
        uint256 announcedAt;
        bool executed;
        bool cancelled;
    }

    uint256 public nextWithdrawalId;
    mapping(uint256 => Withdrawal) public withdrawals;

    event Funded(uint256 amount);
    event WithdrawalAnnounced(uint256 indexed id, uint256 amount, uint256 readyAt);
    event WithdrawalCancelled(uint256 indexed id);
    event WithdrawalExecuted(uint256 indexed id, uint256 amount, address to);
    event PurchaseRecorded(uint256 indexed withdrawalId, string targetChain, string externalCollection, string externalTokenId, uint256 priceWei, string targetChainTxHash);
    event KeeperUpdated(address indexed keeper);

    error NotKeeper();
    error InsufficientBalance();
    error AlreadyExecuted();
    error AlreadyCancelled();
    error StillWaiting();
    error WithdrawalNotExecuted();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(string memory _targetChain, string memory _externalCollection, address _keeper, address _owner) Ownable(_owner) {
        targetChain = _targetChain;
        externalCollection = _externalCollection;
        keeper = _keeper;
    }

    receive() external payable {
        emit Funded(msg.value);
    }

    /// @notice Keeper announces exactly how much it intends to bridge and spend.
    /// Publicly visible immediately; nothing moves for another hour minimum.
    function announceWithdrawal(uint256 amount) external onlyKeeper returns (uint256 id) {
        if (amount > address(this).balance) revert InsufficientBalance();
        id = nextWithdrawalId++;
        withdrawals[id] = Withdrawal({amount: amount, announcedAt: block.timestamp, executed: false, cancelled: false});
        emit WithdrawalAnnounced(id, amount, block.timestamp + WAIT_PERIOD);
    }

    /// @notice The registry owner can cancel an announced withdrawal at any time
    /// before it executes — no reason required. This is the safety valve for a
    /// compromised or misbehaving keeper.
    function cancelWithdrawal(uint256 id) external onlyOwner {
        Withdrawal storage w = withdrawals[id];
        if (w.executed) revert AlreadyExecuted();
        if (w.cancelled) revert AlreadyCancelled();
        w.cancelled = true;
        emit WithdrawalCancelled(id);
    }

    /// @notice After the wait elapses (and nobody cancelled), the keeper pulls the
    /// announced ETH to bridge it. This is the one real custody step in the whole
    /// ZEEP system — see the contract's docstring.
    function executeWithdrawal(uint256 id) external onlyKeeper nonReentrant {
        Withdrawal storage w = withdrawals[id];
        if (w.executed) revert AlreadyExecuted();
        if (w.cancelled) revert AlreadyCancelled();
        if (block.timestamp < w.announcedAt + WAIT_PERIOD) revert StillWaiting();

        w.executed = true;
        (bool ok, ) = keeper.call{value: w.amount}("");
        require(ok, "transfer failed");
        emit WithdrawalExecuted(id, w.amount, keeper);
    }

    /// @notice Writes back a public, permanent receipt once the keeper has bridged
    /// and bought on the target chain. `externalTokenId` and `targetChainTxHash`
    /// are strings rather than bytes32/uint256 so this works the same for EVM
    /// chains and Solana alike.
    function recordPurchase(uint256 withdrawalId, string calldata externalTokenId, uint256 priceWei, string calldata targetChainTxHash) external onlyKeeper {
        if (!withdrawals[withdrawalId].executed) revert WithdrawalNotExecuted();
        emit PurchaseRecorded(withdrawalId, targetChain, externalCollection, externalTokenId, priceWei, targetChainTxHash);
    }

    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    // No general withdraw() either — ETH leaves only through the announce-wait-
    // execute path above, same spirit as ZeepVault, adapted for the cross-chain case.
}
