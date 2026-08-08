// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {ICleanverseRouter} from "./interfaces/ICleanverseRouter.sol";
import {IClearNoteController} from "./interfaces/IClearNoteController.sol";
import {IInvoiceRegistryView} from "./interfaces/IInvoiceRegistryView.sol";
import {IERC20Balance} from "./interfaces/IERC20Balance.sol";

/// @title ClearNotePolicy v3
/// @notice Decorator installed inside Cleanverse A-Tokens via setPolicy. BASE first, then read-only extensions.
/// @dev Deny by REVERT only. No state writes or events inside canTransfer (STATICCALL-safe).
contract ClearNotePolicy is AccessControl {
    bytes4 private constant APASS_DATA_SELECTOR = 0x6a069f61;

    address public immutable baseRouter;
    address public immutable controller;
    address public immutable registry;

    address public apassRegistry;
    uint256 public minTier;

    bytes32 public sdnRoot;
    uint64 public rootPublishedAt;
    string public sourceUri;

    mapping(address => bool) public sanctioned;

    event MinTierUpdated(uint256 minTier);
    event SanctionUpdated(address indexed wallet, bool sanctioned);
    event ApassRegistryUpdated(address indexed registry);
    event SdnRootCommitted(bytes32 root, uint64 publishedAt, string sourceUri);

    error TierTooLow(address wallet, uint256 required, uint256 actual);
    error SanctionedAddress(address wallet);
    error NotInSdnList(address wallet);
    error InvalidMerkleProof();
    error PositionCapExceeded(address wallet, uint256 newBalance, uint256 cap);
    error LockupActive(address token, address holder, uint64 lockedUntil);
    error InvestorLimitReached(address token, uint256 count, uint256 max);
    error TransfersPaused(address token);
    error NoteNotBacked(address token);
    error PolicyNotConfigured();
    error ApassLookupFailed(address wallet);

    constructor(
        address baseRouter_,
        address controller_,
        address registry_,
        address apassRegistry_,
        uint256 minTier_,
        address admin
    ) {
        baseRouter = baseRouter_;
        controller = controller_;
        registry = registry_;
        apassRegistry = apassRegistry_;
        minTier = minTier_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setMinTier(uint256 tier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minTier = tier;
        emit MinTierUpdated(tier);
    }

    function setApassRegistry(address registry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        apassRegistry = registry_;
        emit ApassRegistryUpdated(registry_);
    }

    function commitRoot(bytes32 root, uint64 publishedAt, string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sdnRoot = root;
        rootPublishedAt = publishedAt;
        sourceUri = uri;
        emit SdnRootCommitted(root, publishedAt, uri);
    }

    function setSanctioned(address wallet, bool value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sanctioned[wallet] = value;
        emit SanctionUpdated(wallet, value);
    }

    function addSanctioned(address who, bytes32[] calldata proof) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_verify(proof, sdnRoot, keccak256(abi.encodePacked(who)))) {
            revert NotInSdnList(who);
        }
        sanctioned[who] = true;
        emit SanctionUpdated(who, true);
    }

    function verifyInclusion(address who, bytes32[] calldata proof) external view returns (bool) {
        if (sdnRoot == bytes32(0)) return false;
        return _verify(proof, sdnRoot, keccak256(abi.encodePacked(who)));
    }

    /// @notice Pre-flight for Compliance Console UI.
    function inspect(address token, address from, address to, uint256 amount)
        external
        view
        returns (bool ok, bytes4 code, string memory reason)
    {
        try this.canTransfer(token, from, to, amount) returns (bool) {
            return (true, bytes4(0), "Transfer permitted");
        } catch (bytes memory err) {
            if (err.length >= 4) {
                code = bytes4(err);
                reason = _reasonFor(code);
            } else {
                code = bytes4(0);
                reason = "Unknown denial";
            }
            return (false, code, reason);
        }
    }

    /// @notice Policy hook — STATICCALL only. Deny by revert, never return false.
    function canTransfer(address token, address from, address to, uint256 amount) external view returns (bool) {
        if (baseRouter == address(0) || controller == address(0)) {
            revert PolicyNotConfigured();
        }

        ICleanverseRouter(baseRouter).canTransfer(token, from, to, amount);

        if (to == address(0)) {
            return true;
        }

        if (registry == address(0) || IInvoiceRegistryView(registry).backingOf(token) == bytes32(0)) {
            revert NoteNotBacked(token);
        }

        if (IClearNoteController(controller).isPaused(token)) {
            revert TransfersPaused(token);
        }

        if (from != address(0)) {
            uint64 locked = IClearNoteController(controller).lockedUntil(token, from);
            if (block.timestamp < locked) {
                revert LockupActive(token, from, locked);
            }
        }

        uint256 toBalance = IERC20Balance(token).balanceOf(to);
        uint256 supply = IERC20Balance(token).totalSupply();
        uint256 cap;
        if (supply == 0) {
            // First mint: no outstanding supply to cap against yet.
            cap = type(uint256).max;
        } else {
            cap = supply * IClearNoteController(controller).maxPositionBps(token) / 10000;
        }
        uint256 newBalance = toBalance + amount;
        if (newBalance > cap) {
            revert PositionCapExceeded(to, newBalance, cap);
        }

        if (toBalance == 0) {
            uint256 count = IClearNoteController(controller).investorCount(token);
            uint256 max = IClearNoteController(controller).maxInvestors(token);
            if (count >= max) {
                revert InvestorLimitReached(token, count, max);
            }
        }

        if (from != address(0)) {
            _enforceClearNote(from);
        }
        _enforceClearNote(to);

        return true;
    }

    function _enforceClearNote(address wallet) internal view {
        if (sanctioned[wallet]) {
            revert SanctionedAddress(wallet);
        }
        if (apassRegistry == address(0) || minTier == 0) {
            return;
        }

        (bool ok, bytes memory data) =
            apassRegistry.staticcall(abi.encodeWithSelector(APASS_DATA_SELECTOR, wallet));
        if (!ok || data.length < 64) {
            revert ApassLookupFailed(wallet);
        }

        (, uint256 tier) = abi.decode(data, (uint256, uint256));
        if (tier < minTier) {
            revert TierTooLow(wallet, minTier, tier);
        }
    }

    function _reasonFor(bytes4 code) internal pure returns (string memory) {
        if (code == 0xa6725971) return "Recipient has no A-Pass (Cleanverse)";
        if (code == 0x322fde89) return "Wallet frozen or A-Pass revoked (Cleanverse)";
        if (code == 0x51d86cca) return "Country not permitted by token rule (Cleanverse)";
        if (code == 0xaecc0dbe) return "A-Pass expired (Cleanverse)";
        if (code == TierTooLow.selector) return "Investor tier below required minimum";
        if (code == SanctionedAddress.selector) return "Address on sanctions list";
        if (code == PositionCapExceeded.selector) return "Position cap exceeded";
        if (code == LockupActive.selector) return "Transfer lockup still active";
        if (code == InvestorLimitReached.selector) return "Maximum investor count reached";
        if (code == TransfersPaused.selector) return "Token transfers paused";
        if (code == NoteNotBacked.selector) return "Note token has no invoice backing";
        if (code == PolicyNotConfigured.selector) return "Policy not configured (fail closed)";
        if (code == ApassLookupFailed.selector) return "A-Pass registry lookup failed (fail closed)";
        return "Transfer denied";
    }

    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        if (root == bytes32(0)) return false;
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            computed = computed <= p
                ? keccak256(abi.encodePacked(computed, p))
                : keccak256(abi.encodePacked(p, computed));
        }
        return computed == root;
    }
}
