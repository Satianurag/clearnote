// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract InvoiceRegistryTest is Test {
    InvoiceRegistry internal registry;

    address internal admin;
    address internal controller;
    address internal originator1;
    address internal originator2;
    address internal obligor;
    uint256 internal obligorPk;

    bytes32 internal constant ACCEPTANCE_TYPEHASH =
        keccak256(
            "InvoiceAcceptance(bytes32 invoiceId,address obligor,uint256 faceValue,uint64 dueDate,uint256 deadline)"
        );

    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    function setUp() public {
        admin = makeAddr("admin");
        controller = makeAddr("controller");
        originator1 = makeAddr("originator1");
        originator2 = makeAddr("originator2");
        obligorPk = 0xA11CE;
        obligor = vm.addr(obligorPk);

        registry = new InvoiceRegistry(admin);
        vm.startPrank(admin);
        registry.grantRole(registry.CONTROLLER_ROLE(), controller);
        vm.stopPrank();
    }

    function _sampleInvoice(address originator, bytes32 docHash) internal view returns (InvoiceRegistry.Invoice memory) {
        return InvoiceRegistry.Invoice({
            docHash: docHash,
            pintProfileHash: keccak256("pint-profile"),
            originator: originator,
            obligor: obligor,
            faceValue: 100_000,
            dueDate: uint64(block.timestamp + 30 days),
            registeredAt: 0,
            currency: bytes3("SGD"),
            status: InvoiceRegistry.Status.None
        });
    }

    function _typedDigest(
        bytes32 invoiceId,
        address obligorAddr,
        uint256 faceValue,
        uint64 dueDate,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(ACCEPTANCE_TYPEHASH, invoiceId, obligorAddr, faceValue, dueDate, deadline)
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("ClearNote")),
                keccak256(bytes("1")),
                block.chainid,
                address(registry)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _signAcceptance(
        bytes32 invoiceId,
        uint256 faceValue,
        uint64 dueDate,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 digest = _typedDigest(invoiceId, obligor, faceValue, dueDate, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(obligorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_register_happy() public {
        bytes32 docHash = keccak256("invoice-doc-1");
        InvoiceRegistry.Invoice memory inv = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.InvoiceRegistered(docHash, originator1, obligor);
        bytes32 invoiceId = registry.register(inv);

        assertEq(invoiceId, docHash);
        InvoiceRegistry.Invoice memory stored = registry.get(invoiceId);
        assertEq(uint8(stored.status), uint8(InvoiceRegistry.Status.Registered));
        assertEq(stored.originator, originator1);
        assertEq(stored.obligor, obligor);
    }

    function test_duplicateFinancing_isBlocked() public {
        bytes32 docHash = keccak256("invoice-doc-dup");
        InvoiceRegistry.Invoice memory inv1 = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        registry.register(inv1);

        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signAcceptance(docHash, inv1.faceValue, inv1.dueDate, deadline);
        registry.acceptByObligor(docHash, deadline, sig);

        vm.prank(controller);
        registry.markFinanced(docHash, makeAddr("note"), 1);

        InvoiceRegistry.Invoice memory inv2 = _sampleInvoice(originator2, docHash);
        vm.prank(originator2);
        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.DuplicateAttempted(docHash, originator2, originator1);
        bytes32 ret = registry.register(inv2);
        assertEq(ret, bytes32(0));
        assertEq(registry.duplicateAttempts(docHash), 1);
    }

    function test_obligorAccept_happy() public {
        bytes32 docHash = keccak256("invoice-accept");
        InvoiceRegistry.Invoice memory inv = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        registry.register(inv);

        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signAcceptance(docHash, inv.faceValue, inv.dueDate, deadline);

        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.ObligorAccepted(docHash, obligor, deadline);
        registry.acceptByObligor(docHash, deadline, sig);

        assertEq(uint8(registry.get(docHash).status), uint8(InvoiceRegistry.Status.ObligorAccepted));
    }

    function test_obligorAccept_wrongSigner() public {
        bytes32 docHash = keccak256("invoice-wrong-signer");
        InvoiceRegistry.Invoice memory inv = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        registry.register(inv);

        uint256 deadline = block.timestamp + 1 days;
        uint256 wrongPk = 0xB0B;
        bytes32 digest = _typedDigest(docHash, obligor, inv.faceValue, inv.dueDate, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(InvoiceRegistry.BadObligorSignature.selector);
        registry.acceptByObligor(docHash, deadline, sig);
    }

    function test_obligorAccept_expired() public {
        bytes32 docHash = keccak256("invoice-expired");
        InvoiceRegistry.Invoice memory inv = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        registry.register(inv);

        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signAcceptance(docHash, inv.faceValue, inv.dueDate, deadline);

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(InvoiceRegistry.AcceptanceExpired.selector);
        registry.acceptByObligor(docHash, deadline, sig);
    }

    function test_obligorAccept_replay() public {
        bytes32 docHash = keccak256("invoice-replay");
        InvoiceRegistry.Invoice memory inv = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        registry.register(inv);

        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signAcceptance(docHash, inv.faceValue, inv.dueDate, deadline);
        registry.acceptByObligor(docHash, deadline, sig);

        vm.expectRevert(
            abi.encodeWithSelector(
                InvoiceRegistry.WrongStatus.selector,
                uint8(InvoiceRegistry.Status.ObligorAccepted),
                uint8(InvoiceRegistry.Status.Registered)
            )
        );
        registry.acceptByObligor(docHash, deadline, sig);
    }

    function test_markFinanced_onlyController() public {
        bytes32 docHash = keccak256("invoice-controller");
        InvoiceRegistry.Invoice memory inv = _sampleInvoice(originator1, docHash);

        vm.prank(originator1);
        registry.register(inv);

        uint256 deadline = block.timestamp + 1 days;
        registry.acceptByObligor(docHash, deadline, _signAcceptance(docHash, inv.faceValue, inv.dueDate, deadline));

        address caller = makeAddr("random");
        bytes32 controllerRole = registry.CONTROLLER_ROLE();

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, caller, controllerRole)
        );
        vm.prank(caller);
        registry.markFinanced(docHash, makeAddr("note"), 1);
    }

    function testFuzz_registerNeverCollides(bytes32 docHashA, bytes32 docHashB) public {
        docHashA = keccak256(abi.encodePacked("a", docHashA));
        docHashB = keccak256(abi.encodePacked("b", docHashB));
        vm.assume(docHashA != docHashB);

        vm.prank(originator1);
        registry.register(_sampleInvoice(originator1, docHashA));

        vm.prank(originator2);
        registry.register(_sampleInvoice(originator2, docHashB));

        assertEq(registry.get(docHashA).originator, originator1);
        assertEq(registry.get(docHashB).originator, originator2);
        assertTrue(registry.get(docHashA).docHash != registry.get(docHashB).docHash);
    }
}
