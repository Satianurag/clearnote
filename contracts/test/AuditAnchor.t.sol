// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {AuditAnchor} from "../src/AuditAnchor.sol";

contract AuditAnchorTest is Test {
    AuditAnchor internal anchor;
    address internal admin = makeAddr("admin");

    function setUp() public {
        anchor = new AuditAnchor(admin);
    }

    function test_anchor_recordsHash() public {
        bytes32 hash = keccak256("pack");
        vm.prank(admin);
        uint256 id = anchor.anchor(hash, "file://pack.zip", 1, 2);
        assertEq(id, 0);
        assertEq(anchor.anchorCount(), 1);
        (bytes32 packHash,,,,) = anchor.anchors(0);
        assertEq(packHash, hash);
    }
}
