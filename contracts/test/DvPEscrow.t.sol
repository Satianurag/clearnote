// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {DvPEscrow} from "../src/DvPEscrow.sol";
import {ClearNoteController} from "../src/ClearNoteController.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

contract HarnessERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint8 public decimals;

    constructor(uint8 dec) {
        decimals = dec;
    }

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address spender, uint256 amt) external returns (bool) {
        allowance[msg.sender][spender] = amt;
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        if (balanceOf[from] < amt) return false;
        if (allowance[from][msg.sender] < amt) return false;
        balanceOf[from] -= amt;
        allowance[from][msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

contract DvPEscrowTest is Test {
    InvoiceRegistry internal registry;
    ClearNoteController internal controller;
    DvPEscrow internal escrow;
    HarnessERC20 internal note;
    HarnessERC20 internal cash;

    address internal admin;
    address internal seller;
    address internal buyer;
    address internal buyerNoApass;

    function setUp() public {
        admin = makeAddr("admin");
        seller = makeAddr("seller");
        buyer = makeAddr("buyer");
        buyerNoApass = makeAddr("buyerNoApass");

        registry = new InvoiceRegistry(admin);
        controller = new ClearNoteController(address(registry), admin, 0);
        escrow = new DvPEscrow(address(controller), admin);

        note = new HarnessERC20(18);
        cash = new HarnessERC20(6);

        vm.startPrank(admin);
        controller.grantRole(controller.ESCROW_ROLE(), address(escrow));
        vm.stopPrank();

        note.mint(seller, 1_000e18);
        cash.mint(buyer, 100_000_000); // 100 USDC
        cash.mint(buyerNoApass, 100_000_000);

        vm.prank(seller);
        note.approve(address(escrow), type(uint256).max);
        vm.prank(buyer);
        cash.approve(address(escrow), type(uint256).max);
        vm.prank(buyerNoApass);
        cash.approve(address(escrow), type(uint256).max);
    }

    function test_fill_happy() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 100e18, 1e6, 1e18, expiry);

        uint256 units = 1e18;
        uint256 cashBeforeBuyer = cash.balanceOf(buyer);
        uint256 cashBeforeSeller = cash.balanceOf(seller);

        vm.prank(buyer);
        escrow.fill(id, units);

        assertEq(note.balanceOf(buyer), units);
        assertEq(note.balanceOf(seller), 1_000e18 - units);
        uint256 cashPaid = (units * 1e6) / 1e18;
        assertEq(cash.balanceOf(buyer), cashBeforeBuyer - cashPaid);
        assertEq(cash.balanceOf(seller), cashBeforeSeller + cashPaid);
        assertEq(controller.investorCount(address(note)), 1);
    }

    function test_nonCompliantBuyer_cashUntouched() public {
        // Simulate note transferFrom failure (e.g. policy revert) by revoking seller approval
        vm.prank(seller);
        note.approve(address(escrow), 0);

        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 10e18, 1e6, 1e18, expiry);

        uint256 buyerCashBefore = cash.balanceOf(buyerNoApass);
        uint256 sellerCashBefore = cash.balanceOf(seller);

        vm.prank(buyerNoApass);
        vm.expectRevert(DvPEscrow.CashLegFailed.selector);
        escrow.fill(id, 1e18);

        assertEq(cash.balanceOf(buyerNoApass), buyerCashBefore);
        assertEq(cash.balanceOf(seller), sellerCashBefore);
    }

    function test_partialFill_twice_closes() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 100e18, 1e6, 10e18, expiry);

        vm.prank(buyer);
        escrow.fill(id, 60e18);
        vm.prank(buyer);
        escrow.fill(id, 40e18);

        (, , , , , , uint256 remaining, bool active) = escrow.offerOf(id);
        assertEq(remaining, 0);
        assertFalse(active);
        assertEq(note.balanceOf(buyer), 100e18);
    }

    function test_belowMinFill() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 100e18, 1e6, 50e18, expiry);

        vm.prank(buyer);
        vm.expectRevert(DvPEscrow.BelowMinFill.selector);
        escrow.fill(id, 10e18);
    }

    function test_expiredOffer() public {
        uint64 expiry = uint64(block.timestamp + 100);
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 10e18, 1e6, 1e18, expiry);

        vm.warp(block.timestamp + 101);
        vm.prank(buyer);
        vm.expectRevert(DvPEscrow.OfferExpired.selector);
        escrow.fill(id, 1e18);
    }

    function test_cancelThenFill() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 10e18, 1e6, 1e18, expiry);

        vm.prank(seller);
        escrow.cancel(id);

        vm.prank(buyer);
        vm.expectRevert(DvPEscrow.OfferInactive.selector);
        escrow.fill(id, 1e18);
    }

    function test_mixedDecimals_cashMath() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        // 1 note unit (1e18) at 1.5 USDC per unit → pricePerUnit = 1.5e6
        vm.prank(seller);
        uint256 id = escrow.postOffer(address(note), address(cash), 2e18, 1_500_000, 1e18, expiry);

        vm.prank(buyer);
        escrow.fill(id, 2e18);

        assertEq(cash.balanceOf(seller), 3_000_000); // 3 USDC
        assertEq(note.balanceOf(buyer), 2e18);
    }
}
