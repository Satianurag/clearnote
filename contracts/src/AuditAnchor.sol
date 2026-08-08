// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AuditAnchor
/// @notice On-chain anchor for audit pack hashes (no PII on-chain).
contract AuditAnchor is AccessControl {
    struct AnchorRecord {
        bytes32 packHash;
        string uri;
        uint64 periodStart;
        uint64 periodEnd;
        uint64 anchoredAt;
    }

    AnchorRecord[] public anchors;

    event Anchored(
        uint256 indexed anchorId,
        bytes32 indexed packHash,
        string uri,
        uint64 periodStart,
        uint64 periodEnd
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function anchor(bytes32 packHash, string calldata uri, uint64 periodStart, uint64 periodEnd)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 anchorId)
    {
        anchorId = anchors.length;
        anchors.push(
            AnchorRecord({
                packHash: packHash,
                uri: uri,
                periodStart: periodStart,
                periodEnd: periodEnd,
                anchoredAt: uint64(block.timestamp)
            })
        );
        emit Anchored(anchorId, packHash, uri, periodStart, periodEnd);
    }

    function anchorCount() external view returns (uint256) {
        return anchors.length;
    }
}
