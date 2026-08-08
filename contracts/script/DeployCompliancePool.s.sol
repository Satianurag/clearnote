// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {CleanverseCompliancePool} from "../src/CleanverseCompliancePool.sol";

contract DeployCompliancePool is Script {
    function run() external returns (address pool) {
        address validator = vm.envAddress("CLEANVERSE_VALIDATOR");
        address policy = vm.envAddress("CLEARNOTE_POLICY");
        address owner = vm.envAddress("POOL_OWNER");
        vm.startBroadcast();
        pool = address(new CleanverseCompliancePool(validator, policy, owner));
        vm.stopBroadcast();
    }
}
