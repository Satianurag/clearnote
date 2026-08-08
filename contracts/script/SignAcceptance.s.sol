// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

/// @notice Signs EIP-712 InvoiceAcceptance for testnet E2E (obligor = deployer).
contract SignAcceptance is Script {
    bytes32 private constant ACCEPTANCE_TYPEHASH =
        keccak256(
            "InvoiceAcceptance(bytes32 invoiceId,address obligor,uint256 faceValue,uint64 dueDate,uint256 deadline)"
        );

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function run(address registry, bytes32 invoiceId, uint256 faceValue, uint64 dueDate, uint256 deadline)
        external
        returns (bytes memory sig)
    {
        uint256 pk = vm.envUint("WALLET_A_PRIVATE_KEY");
        address obligor = vm.addr(pk);

        bytes32 structHash = keccak256(
            abi.encode(ACCEPTANCE_TYPEHASH, invoiceId, obligor, faceValue, dueDate, deadline)
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("ClearNote")),
                keccak256(bytes("1")),
                block.chainid,
                registry
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        sig = abi.encodePacked(r, s, v);
        console2.logBytes(sig);
    }
}
