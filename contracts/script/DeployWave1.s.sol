// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {ClearNoteController} from "../src/ClearNoteController.sol";
import {ClearNotePolicy} from "../src/ClearNotePolicy.sol";
import {SanctionsRegistry} from "../src/SanctionsRegistry.sol";

/// @notice Deploy core Wave-1 contracts to Monad testnet from wallet A.
contract DeployWave1 is Script {
    address internal constant BASE_ROUTER = 0x36489bE45fa84f70a0c2BDB11D824Be608CB12Dd;
    address internal constant APASS_REGISTRY = 0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9;
    address internal constant SAFE = 0xB544D5eFB15fBaE3b3Ad4B1ec3594FfEB0926593;

    function run() external {
        uint256 deployerKey = vm.envUint("WALLET_A_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        InvoiceRegistry registry = new InvoiceRegistry(deployer);
        ClearNoteController controller = new ClearNoteController(address(registry), deployer, 0);
        ClearNotePolicy policy = new ClearNotePolicy(
            BASE_ROUTER,
            address(controller),
            address(registry),
            APASS_REGISTRY,
            50,
            deployer
        );
        SanctionsRegistry sanctions = new SanctionsRegistry(deployer);

        registry.grantRole(registry.CONTROLLER_ROLE(), address(controller));
        controller.grantRole(controller.ISSUER_ROLE(), deployer);

        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), SAFE);
        controller.grantRole(controller.DEFAULT_ADMIN_ROLE(), SAFE);
        policy.grantRole(policy.DEFAULT_ADMIN_ROLE(), SAFE);
        sanctions.grantRole(sanctions.DEFAULT_ADMIN_ROLE(), SAFE);

        vm.stopBroadcast();

        console2.log("InvoiceRegistry", address(registry));
        console2.log("ClearNoteController", address(controller));
        console2.log("ClearNotePolicy", address(policy));
        console2.log("SanctionsRegistry", address(sanctions));
        console2.log("Deployer", deployer);
    }
}
