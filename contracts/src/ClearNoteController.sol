// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {InvoiceRegistry} from "./InvoiceRegistry.sol";

interface INoteToken {
    function mint(address to, uint256 amount) external;
    function burn(address account, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @title ClearNoteController
/// @notice Write-side compliance state consumed by ClearNotePolicy via STATICCALL.
contract ClearNoteController is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    InvoiceRegistry public immutable registry;

    uint64 public defaultLockupSeconds;

    mapping(address => mapping(address => uint64)) public lockedUntil;
    mapping(address => uint256) public investorCount;
    mapping(address => uint32) public maxInvestors;
    mapping(address => uint16) public maxPositionBps;
    mapping(address => bool) public isPaused;
    mapping(address => uint64) public lockupSeconds;
    mapping(address => address) public primaryHolder;

    event NoteIssued(bytes32 indexed invoiceId, address indexed noteToken, address indexed to, uint256 units);
    event Paused(address indexed noteToken);
    event Unpaused(address indexed noteToken);
    event RecoveryExecuted(
        address indexed noteToken, address indexed lost, address indexed newWallet, uint256 units
    );
    event LockupUpdated(address indexed noteToken, uint64 seconds_);
    event MaxInvestorsUpdated(address indexed noteToken, uint32 max);
    event MaxPositionBpsUpdated(address indexed noteToken, uint16 bps);

    error TokenNotBacked(bytes32 invoiceId, address noteToken);

    constructor(address registry_, address admin, uint64 defaultLockupSeconds_) {
        registry = InvoiceRegistry(registry_);
        defaultLockupSeconds = defaultLockupSeconds_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function issueNote(bytes32 invoiceId, address noteToken, address to, uint256 units)
        external
        onlyRole(ISSUER_ROLE)
    {
        if (registry.isFinanced(invoiceId)) {
            InvoiceRegistry.Invoice memory financed = registry.get(invoiceId);
            revert InvoiceRegistry.InvoiceAlreadyFinanced(invoiceId, financed.originator);
        }

        InvoiceRegistry.Invoice memory inv = registry.get(invoiceId);
        if (inv.status != InvoiceRegistry.Status.ObligorAccepted) {
            revert InvoiceRegistry.WrongStatus(uint8(inv.status), uint8(InvoiceRegistry.Status.ObligorAccepted));
        }

        registry.markFinanced(invoiceId, noteToken, units);

        uint64 lockup = lockupSeconds[noteToken];
        if (lockup == 0) {
            lockup = defaultLockupSeconds;
        }
        lockedUntil[noteToken][to] = uint64(block.timestamp) + lockup;

        if (INoteToken(noteToken).balanceOf(to) == 0) {
            investorCount[noteToken]++;
        }

        primaryHolder[noteToken] = to;
        INoteToken(noteToken).mint(to, units);
        emit NoteIssued(invoiceId, noteToken, to, units);
    }

  /// @notice Called by DvPEscrow after a fill — policy hook cannot write investor state.
    function onTransfer(address noteToken, address from, address to, uint256 amount)
        external
        onlyRole(ESCROW_ROLE)
    {
        if (from != address(0)) {
            if (INoteToken(noteToken).balanceOf(from) == 0) {
                if (investorCount[noteToken] > 0) {
                    investorCount[noteToken]--;
                }
            }
        }
        if (to != address(0)) {
            uint256 toBal = INoteToken(noteToken).balanceOf(to);
            if (toBal == amount) {
                investorCount[noteToken]++;
            }
            // Lockup applies on primary issuance (issueNote), not secondary DvP fills —
            // resetting here blocked resales after the original holder's lockup expired.
        }
    }

    function pause(address noteToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isPaused[noteToken] = true;
        emit Paused(noteToken);
    }

    function unpause(address noteToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isPaused[noteToken] = false;
        emit Unpaused(noteToken);
    }

    function setLockup(address noteToken, uint64 seconds_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockupSeconds[noteToken] = seconds_;
        emit LockupUpdated(noteToken, seconds_);
    }

    function setMaxInvestors(address noteToken, uint32 n) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxInvestors[noteToken] = n;
        emit MaxInvestorsUpdated(noteToken, n);
    }

    function setMaxPositionBps(address noteToken, uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPositionBps[noteToken] = bps;
        emit MaxPositionBpsUpdated(noteToken, bps);
    }

    function settle(bytes32 invoiceId, address noteToken) external onlyRole(ISSUER_ROLE) {
        bytes32 backed = registry.backingOf(noteToken);
        if (backed != invoiceId) {
            revert TokenNotBacked(invoiceId, noteToken);
        }
        address holder = primaryHolder[noteToken];
        uint256 bal = INoteToken(noteToken).balanceOf(holder);
        if (bal > 0) {
            INoteToken(noteToken).burn(holder, bal);
        }
        registry.markSettled(invoiceId);
    }

    /// @notice Move notes from a lost wallet to a replacement wallet (supervised admin flow).
    /// @dev Frozen wallets cannot burn — Cleanverse BASE reverts burn with `0x322fde89`.
    ///      Supervised 3-step runbook (Safe multisig):
    ///      1. Unfreeze `lost` on the A-Token (Cleanverse admin / token `unfreeze` or equivalent).
    ///      2. Call `recover(noteToken, lost, newWallet, units)` on this controller.
    ///      3. Re-freeze `lost` if your compliance policy requires the old wallet to stay frozen.
    function recover(address noteToken, address lost, address newWallet, uint256 units)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        INoteToken(noteToken).burn(lost, units);
        if (INoteToken(noteToken).balanceOf(newWallet) == 0) {
            investorCount[noteToken]++;
        }
        INoteToken(noteToken).mint(newWallet, units);
        emit RecoveryExecuted(noteToken, lost, newWallet, units);
    }
}
