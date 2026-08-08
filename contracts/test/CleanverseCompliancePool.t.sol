// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CleanverseCompliancePool} from "../src/CleanverseCompliancePool.sol";

contract CleanverseCompliancePoolTest is Test {
    address internal constant VALIDATOR = address(0xaC7e5179C2C7f03f209136886c172eb34F161792);
    address internal constant POLICY = address(0xa36F46f2631bc092E319d7Ab4cCAA97b9cD63890);
    address internal constant OWNER = address(0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB);

    function test_constructor_setsImmutablesAndOwner() public {
        CleanverseCompliancePool pool = new CleanverseCompliancePool(VALIDATOR, POLICY, OWNER);
        assertEq(pool.validator(), VALIDATOR);
        assertEq(pool.policy(), POLICY);
        assertEq(pool.owner(), OWNER);
    }

    function test_ownerCanTransferOwnership() public {
        CleanverseCompliancePool pool = new CleanverseCompliancePool(VALIDATOR, POLICY, OWNER);
        address next = address(0xBEEF);
        vm.prank(OWNER);
        pool.transferOwnership(next);
        assertEq(pool.owner(), next);
    }
}
