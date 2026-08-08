// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ClearNoteController} from "../src/ClearNoteController.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract ControllerNoteToken {
    address public minter;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function setMinter(address minter_) external {
        minter = minter_;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter);
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(address account, uint256 amount) external {
        require(msg.sender == minter);
        balanceOf[account] -= amount;
        totalSupply -= amount;
    }
}

contract ClearNoteControllerTest is Test {
    InvoiceRegistry internal registry;
    ClearNoteController internal controller;
    ControllerNoteToken internal note;

    address internal admin;
    address internal issuer;
    address internal investor1;
    address internal investor2;
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
        issuer = makeAddr("issuer");
        investor1 = makeAddr("investor1");
        investor2 = makeAddr("investor2");
        obligorPk = 0xA11CE;
        obligor = vm.addr(obligorPk);

        registry = new InvoiceRegistry(admin);
        controller = new ClearNoteController(address(registry), admin, 1 days);
        note = new ControllerNoteToken();
        note.setMinter(address(controller));

        vm.startPrank(admin);
        registry.grantRole(registry.CONTROLLER_ROLE(), address(controller));
        controller.grantRole(controller.ISSUER_ROLE(), issuer);
        controller.setMaxInvestors(address(note), 2);
        controller.setMaxPositionBps(address(note), 10000);
        controller.setLockup(address(note), 1 days);
        vm.stopPrank();
    }

    function _registerAndAccept(bytes32 invoiceId) internal {
        InvoiceRegistry.Invoice memory inv = InvoiceRegistry.Invoice({
            docHash: invoiceId,
            pintProfileHash: keccak256("profile"),
            originator: issuer,
            obligor: obligor,
            faceValue: 100_000,
            dueDate: uint64(block.timestamp + 30 days),
            registeredAt: 0,
            currency: bytes3("SGD"),
            status: InvoiceRegistry.Status.None
        });

        vm.prank(issuer);
        registry.register(inv);

        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = _acceptanceDigest(invoiceId, inv.faceValue, inv.dueDate, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(obligorPk, digest);
        registry.acceptByObligor(invoiceId, deadline, abi.encodePacked(r, s, v));
    }

    function _acceptanceDigest(bytes32 invoiceId, uint256 faceValue, uint64 dueDate, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(ACCEPTANCE_TYPEHASH, invoiceId, obligor, faceValue, dueDate, deadline)
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

    function test_fullLifecycle() public {
        bytes32 invoiceId = keccak256("invoice-lifecycle");
        _registerAndAccept(invoiceId);

        vm.prank(issuer);
        controller.issueNote(invoiceId, address(note), investor1, 1_000);
        assertEq(controller.lockedUntil(address(note), investor1), uint64(block.timestamp + 1 days));

        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(admin);
        controller.pause(address(note));

        vm.prank(admin);
        controller.unpause(address(note));

        vm.prank(issuer);
        controller.settle(invoiceId, address(note));
        assertEq(note.totalSupply(), 0);
        assertEq(uint8(registry.get(invoiceId).status), uint8(InvoiceRegistry.Status.Settled));
    }

    function test_humanCannotMint() public {
        vm.prank(issuer);
        vm.expectRevert();
        note.mint(investor1, 1);
    }

    function test_issueTwice_sameInvoice() public {
        bytes32 invoiceId = keccak256("invoice-twice");
        _registerAndAccept(invoiceId);

        vm.startPrank(issuer);
        controller.issueNote(invoiceId, address(note), investor1, 100);
        vm.expectRevert(
            abi.encodeWithSelector(InvoiceRegistry.InvoiceAlreadyFinanced.selector, invoiceId, issuer)
        );
        controller.issueNote(invoiceId, address(note), investor2, 100);
        vm.stopPrank();
    }

    function test_issueWithoutObligorAccept() public {
        bytes32 invoiceId = keccak256("invoice-no-accept");
        InvoiceRegistry.Invoice memory inv = InvoiceRegistry.Invoice({
            docHash: invoiceId,
            pintProfileHash: keccak256("profile"),
            originator: issuer,
            obligor: obligor,
            faceValue: 100_000,
            dueDate: uint64(block.timestamp + 30 days),
            registeredAt: 0,
            currency: bytes3("SGD"),
            status: InvoiceRegistry.Status.None
        });
        vm.prank(issuer);
        registry.register(inv);

        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                InvoiceRegistry.WrongStatus.selector,
                uint8(InvoiceRegistry.Status.Registered),
                uint8(InvoiceRegistry.Status.ObligorAccepted)
            )
        );
        controller.issueNote(invoiceId, address(note), investor1, 100);
    }

    function test_onTransfer_onlyEscrow() public {
        vm.prank(investor1);
        vm.expectRevert();
        controller.onTransfer(address(note), investor1, investor2, 1);
    }

    function test_investorCountDecrements() public {
        bytes32 invoiceId = keccak256("invoice-count");
        _registerAndAccept(invoiceId);

        vm.prank(issuer);
        controller.issueNote(invoiceId, address(note), investor1, 1_000);
        assertEq(controller.investorCount(address(note)), 1);

        vm.prank(admin);
        bytes32 escrowRole = controller.ESCROW_ROLE();
        vm.prank(admin);
        controller.grantRole(escrowRole, admin);

        vm.startPrank(address(controller));
        note.burn(investor1, 1_000);
        note.mint(investor2, 1_000);
        vm.stopPrank();

        vm.prank(admin);
        controller.onTransfer(address(note), investor1, investor2, 1_000);
        assertEq(controller.investorCount(address(note)), 1);
        assertEq(note.balanceOf(investor1), 0);
        assertEq(note.balanceOf(investor2), 1_000);
    }

    function test_secondaryBuyerCanResellAfterOriginalLockup() public {
        bytes32 invoiceId = keccak256("invoice-secondary-lockup");
        _registerAndAccept(invoiceId);

        vm.prank(issuer);
        controller.issueNote(invoiceId, address(note), investor1, 1_000);
        assertEq(controller.lockedUntil(address(note), investor1), uint64(block.timestamp + 1 days));

        vm.warp(block.timestamp + 1 days + 1);

        vm.startPrank(admin);
        controller.grantRole(controller.ESCROW_ROLE(), admin);

        vm.startPrank(address(controller));
        note.burn(investor1, 1_000);
        note.mint(investor2, 1_000);
        vm.stopPrank();

        vm.prank(admin);
        controller.onTransfer(address(note), investor1, investor2, 1_000);
        vm.stopPrank();

        assertEq(controller.lockedUntil(address(note), investor2), 0);
        assertLt(controller.lockedUntil(address(note), investor1), uint64(block.timestamp));
    }
}
