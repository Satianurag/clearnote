// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title SanctionsRegistry
/// @notice OFAC SDN merkle roots with O(1) sanction reads for policy hooks.
contract SanctionsRegistry is AccessControl {
    struct RootRecord {
        bytes32 root;
        string sourceUri;
        uint64 publishedAt;
    }

    RootRecord[] private _roots;
    mapping(address => bool) private _sanctioned;

    event RootCommitted(bytes32 indexed root, string sourceUri, uint64 publishedAt);
    event SanctionedAdded(address indexed who);
    event SanctionedRemoved(address indexed who);

    error NotInSdnList(address wallet);
    error InvalidMerkleProof();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function commitRoot(bytes32 root, string calldata sourceUri, uint64 publishedAt)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _roots.push(RootRecord({root: root, sourceUri: sourceUri, publishedAt: publishedAt}));
        emit RootCommitted(root, sourceUri, publishedAt);
    }

    function addSanctioned(address who, bytes32[] calldata proof) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 root = _currentRoot();
        if (root == bytes32(0) || !_verify(proof, root, keccak256(abi.encodePacked(who)))) {
            revert NotInSdnList(who);
        }
        _sanctioned[who] = true;
        emit SanctionedAdded(who);
    }

    function removeSanctioned(address who) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _sanctioned[who] = false;
        emit SanctionedRemoved(who);
    }

    function isSanctioned(address who) external view returns (bool) {
        return _sanctioned[who];
    }

    function verifyInclusion(address who, bytes32[] calldata proof) external view returns (bool) {
        bytes32 root = _currentRoot();
        if (root == bytes32(0)) return false;
        return _verify(proof, root, keccak256(abi.encodePacked(who)));
    }

    function rootAt(uint256 index) external view returns (bytes32 root, string memory sourceUri, uint64 publishedAt) {
        RootRecord memory record = _roots[index];
        return (record.root, record.sourceUri, record.publishedAt);
    }

    function rootCount() external view returns (uint256) {
        return _roots.length;
    }

    function _currentRoot() internal view returns (bytes32) {
        if (_roots.length == 0) return bytes32(0);
        return _roots[_roots.length - 1].root;
    }

    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
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
