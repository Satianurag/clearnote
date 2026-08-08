// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SanctionsRegistry} from "../src/SanctionsRegistry.sol";

contract SanctionsRegistryTest is Test {
    SanctionsRegistry internal registry;
    address internal admin;
    address internal wallet;

    function setUp() public {
        admin = makeAddr("admin");
        wallet = makeAddr("wallet");
        registry = new SanctionsRegistry(admin);
    }

    function test_verifyInclusion_nonMemberFails() public {
        bytes32 root = keccak256("root");
        vm.prank(admin);
        registry.commitRoot(root, "uri", uint64(block.timestamp));

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = keccak256("other");
        assertFalse(registry.verifyInclusion(wallet, proof));
    }

    function test_addSanctioned_badProofReverts() public {
        bytes32 root = keccak256("root");
        vm.prank(admin);
        registry.commitRoot(root, "uri", uint64(block.timestamp));

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = keccak256("bad");

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(SanctionsRegistry.NotInSdnList.selector, wallet));
        registry.addSanctioned(wallet, proof);
        assertFalse(registry.isSanctioned(wallet));
    }

    function test_rootHistory() public {
        vm.startPrank(admin);
        registry.commitRoot(keccak256("root1"), "uri1", 1);
        registry.commitRoot(keccak256("root2"), "uri2", 2);
        vm.stopPrank();

        assertEq(registry.rootCount(), 2);
        (bytes32 r0,, uint64 t0) = registry.rootAt(0);
        (bytes32 r1,, uint64 t1) = registry.rootAt(1);
        assertEq(r0, keccak256("root1"));
        assertEq(r1, keccak256("root2"));
        assertEq(t0, 1);
        assertEq(t1, 2);
    }

    function test_verifyInclusion_realProof() public {
        address who = makeAddr("sdn-member");
        bytes32 leaf = keccak256(abi.encodePacked(who));
        bytes32 root = leaf;

        vm.prank(admin);
        registry.commitRoot(root, "ofac-root.json", uint64(block.timestamp));

        bytes32[] memory proof = new bytes32[](0);
        assertTrue(registry.verifyInclusion(who, proof));

        vm.prank(admin);
        registry.addSanctioned(who, proof);
        assertTrue(registry.isSanctioned(who));
    }
}
