// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ClearNotePolicy} from "../src/ClearNotePolicy.sol";

contract MockRouter {
    bytes4 internal revertSelector;

    function setRevert(bytes4 selector) external {
        revertSelector = selector;
    }

    function canTransfer(address, address, address, uint256) external view returns (bool) {
        if (revertSelector != bytes4(0)) {
            bytes4 sel = revertSelector;
            assembly ("memory-safe") {
                mstore(0, sel)
                revert(0, 4)
            }
        }
        return true;
    }
}

contract MockController {
    mapping(address => mapping(address => uint64)) internal locked;
    mapping(address => uint256) internal investorCounts;
    mapping(address => uint256) internal maxInvestorLimits;
    mapping(address => bool) internal paused;
    mapping(address => uint16) internal positionBps;

    function setLockedUntil(address token, address holder, uint64 until) external {
        locked[token][holder] = until;
    }

    function setInvestorCount(address token, uint256 count) external {
        investorCounts[token] = count;
    }

    function setMaxInvestors(address token, uint256 max) external {
        maxInvestorLimits[token] = max;
    }

    function setPaused(address token, bool value) external {
        paused[token] = value;
    }

    function setMaxPositionBps(address token, uint16 bps) external {
        positionBps[token] = bps;
    }

    function lockedUntil(address token, address holder) external view returns (uint64) {
        return locked[token][holder];
    }

    function investorCount(address token) external view returns (uint256) {
        return investorCounts[token];
    }

    function maxInvestors(address token) external view returns (uint256) {
        return maxInvestorLimits[token];
    }

    function isPaused(address token) external view returns (bool) {
        return paused[token];
    }

    function maxPositionBps(address token) external view returns (uint256) {
        uint16 bps = positionBps[token];
        return bps == 0 ? 10000 : bps;
    }
}

contract MockRegistry {
    mapping(address => bytes32) internal backing;

    function setBacking(address token, bytes32 invoiceId) external {
        backing[token] = invoiceId;
    }

    function backingOf(address noteToken) external view returns (bytes32) {
        return backing[noteToken];
    }
}

contract MockNoteToken {
    mapping(address => uint256) internal balances;
    uint256 internal supply;

    function setBalance(address holder, uint256 amount) external {
        balances[holder] = amount;
    }

    function setTotalSupply(uint256 amount) external {
        supply = amount;
    }

    function balanceOf(address holder) external view returns (uint256) {
        return balances[holder];
    }

    function totalSupply() external view returns (uint256) {
        return supply;
    }
}

contract MockApassRegistry {
    mapping(address => uint256) internal tiers;

    function setTier(address wallet, uint256 tier) external {
        tiers[wallet] = tier;
    }

    function getAPassData(address wallet) external view returns (uint256, uint256) {
        return (1, tiers[wallet]);
    }
}

contract MockApassRegistryReverts {
    function getAPassData(address) external pure {
        revert();
    }
}

contract ClearNotePolicyTest is Test {
    MockRouter internal router;
    MockController internal ctrl;
    MockRegistry internal reg;
    MockNoteToken internal token;
    MockApassRegistry internal apass;
    ClearNotePolicy internal policy;

    address internal admin;
    address internal alice;
    address internal bob;

    function setUp() public {
        admin = makeAddr("admin");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        router = new MockRouter();
        ctrl = new MockController();
        reg = new MockRegistry();
        token = new MockNoteToken();
        apass = new MockApassRegistry();

        policy = new ClearNotePolicy(
            address(router),
            address(ctrl),
            address(reg),
            address(apass),
            50,
            admin
        );

        reg.setBacking(address(token), keccak256("invoice-1"));
        token.setTotalSupply(1_000_000);
        ctrl.setMaxInvestors(address(token), 100);
        ctrl.setMaxPositionBps(address(token), 10000);
        ctrl.setInvestorCount(address(token), 0);
        apass.setTier(alice, 50);
        apass.setTier(bob, 50);
    }

    function _happyPath() internal {
        token.setBalance(bob, 0);
        ctrl.setLockedUntil(address(token), alice, 0);
        ctrl.setPaused(address(token), false);
        ctrl.setInvestorCount(address(token), 0);
        ctrl.setMaxInvestors(address(token), 100);
        ctrl.setMaxPositionBps(address(token), 10000);
        vm.startPrank(admin);
        policy.setSanctioned(bob, false);
        policy.setSanctioned(alice, false);
        vm.stopPrank();
    }

    function test_baseRevertBubblesUnchanged() public {
        router.setRevert(0x322fde89);
        _happyPath();

        vm.expectRevert(bytes4(0x322fde89));
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function test_noStateWrites() public {
        _happyPath();

        (bool success, bytes memory data) = address(policy).staticcall(
            abi.encodeWithSelector(policy.canTransfer.selector, address(token), alice, bob, 100)
        );

        assertTrue(success);
        assertTrue(abi.decode(data, (bool)));
    }

    function test_eachRule_revertsWithOwnSelector() public {
        _testPolicyNotConfigured();
        _testNoteNotBacked();
        _testTransfersPaused();
        _testLockupActive();
        _testPositionCapExceeded();
        _testInvestorLimitReached();
        _testSanctionedAddress();
    }

    function _testPolicyNotConfigured() internal {
        ClearNotePolicy unconfigured =
            new ClearNotePolicy(address(0), address(ctrl), address(reg), address(0), 0, admin);

        vm.expectRevert(ClearNotePolicy.PolicyNotConfigured.selector);
        unconfigured.canTransfer(address(token), alice, bob, 1);
    }

    function _testNoteNotBacked() internal {
        MockNoteToken unbacked = new MockNoteToken();
        unbacked.setTotalSupply(1_000_000);
        _happyPath();

        vm.expectRevert(abi.encodeWithSelector(ClearNotePolicy.NoteNotBacked.selector, address(unbacked)));
        policy.canTransfer(address(unbacked), alice, bob, 1);
    }

    function _testTransfersPaused() internal {
        _happyPath();
        ctrl.setPaused(address(token), true);

        vm.expectRevert(abi.encodeWithSelector(ClearNotePolicy.TransfersPaused.selector, address(token)));
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function _testLockupActive() internal {
        _happyPath();
        uint64 lockedUntil = uint64(block.timestamp + 1 days);
        ctrl.setLockedUntil(address(token), alice, lockedUntil);

        vm.expectRevert(
            abi.encodeWithSelector(ClearNotePolicy.LockupActive.selector, address(token), alice, lockedUntil)
        );
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function _testPositionCapExceeded() internal {
        _happyPath();
        token.setBalance(bob, 900_000);
        ctrl.setMaxPositionBps(address(token), 1000);

        uint256 cap = 1_000_000 * 1000 / 10000;
        uint256 newBalance = 900_000 + 200_000;

        vm.expectRevert(
            abi.encodeWithSelector(ClearNotePolicy.PositionCapExceeded.selector, bob, newBalance, cap)
        );
        policy.canTransfer(address(token), alice, bob, 200_000);
    }

    function _testInvestorLimitReached() internal {
        _happyPath();
        ctrl.setInvestorCount(address(token), 100);
        ctrl.setMaxInvestors(address(token), 100);
        token.setBalance(bob, 0);

        vm.expectRevert(
            abi.encodeWithSelector(ClearNotePolicy.InvestorLimitReached.selector, address(token), 100, 100)
        );
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function _testSanctionedAddress() internal {
        _happyPath();
        vm.prank(admin);
        policy.setSanctioned(bob, true);

        vm.expectRevert(abi.encodeWithSelector(ClearNotePolicy.SanctionedAddress.selector, bob));
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function test_returnFalseIsNotUsed() public view {
        string memory path = string.concat(vm.projectRoot(), "/contracts/src/ClearNotePolicy.sol");
        string memory src = vm.readFile(path);
        assertFalse(_canTransferReturnsFalse(src));
    }

    function testFuzz_inspect_matchesCanTransfer(address from, address to, uint256 amount) public {
        amount = bound(amount, 0, 1_000_000);
        _happyPath();

        if (from == address(0) || to == address(0)) {
            return;
        }

        (bool ok,,) = policy.inspect(address(token), from, to, amount);
        bool reverts = _canTransferReverts(address(token), from, to, amount);
        assertEq(ok, !reverts);
    }

    function test_burnPathSkipsOurRulesNotBase() public {
        MockNoteToken unbacked = new MockNoteToken();
        ctrl.setPaused(address(unbacked), true);
        ctrl.setLockedUntil(address(unbacked), alice, uint64(block.timestamp + 30 days));

        (bool ok,,) = policy.inspect(address(unbacked), alice, address(0), 100);
        assertTrue(ok);

        router.setRevert(0x322fde89);
        vm.expectRevert(bytes4(0x322fde89));
        policy.canTransfer(address(unbacked), alice, address(0), 100);
    }

    function test_unconfiguredFailsClosed() public {
        ClearNotePolicy unconfigured =
            new ClearNotePolicy(address(0), address(ctrl), address(reg), address(0), 0, admin);

        vm.expectRevert(ClearNotePolicy.PolicyNotConfigured.selector);
        unconfigured.canTransfer(address(token), alice, bob, 1);

        (bool ok,, string memory reason) = unconfigured.inspect(address(token), alice, bob, 1);
        assertFalse(ok);
        assertEq(reason, "Policy not configured (fail closed)");
    }

    function test_tierTooLow_reverts() public {
        _happyPath();
        apass.setTier(bob, 10);

        vm.expectRevert(abi.encodeWithSelector(ClearNotePolicy.TierTooLow.selector, bob, 50, 10));
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function test_apassRegistryRevert_failClosed() public {
        _happyPath();
        MockApassRegistryReverts broken = new MockApassRegistryReverts();
        vm.prank(admin);
        policy.setApassRegistry(address(broken));

        vm.expectRevert(abi.encodeWithSelector(ClearNotePolicy.ApassLookupFailed.selector, alice));
        policy.canTransfer(address(token), alice, bob, 100);
    }

    function test_apassRegistryRevert_skippedWhenMinTierZero() public {
        _happyPath();
        MockApassRegistryReverts broken = new MockApassRegistryReverts();
        vm.startPrank(admin);
        policy.setMinTier(0);
        policy.setApassRegistry(address(broken));
        vm.stopPrank();

        policy.canTransfer(address(token), alice, bob, 100);
    }

    function test_inspect_returnsCleanverseReason() public {
        router.setRevert(0xa6725971);

        (bool ok, bytes4 code, string memory reason) = policy.inspect(address(token), alice, bob, 1);
        assertFalse(ok);
        assertEq(code, bytes4(0xa6725971));
        assertEq(reason, "Recipient has no A-Pass (Cleanverse)");
    }

    function _canTransferReverts(address tokenAddr, address from, address to, uint256 amount) internal view returns (bool) {
        try policy.canTransfer(tokenAddr, from, to, amount) returns (bool) {
            return false;
        } catch {
            return true;
        }
    }

    function _canTransferReturnsFalse(string memory src) internal pure returns (bool) {
        uint256 start = _findSubstring(src, "function canTransfer");
        if (start == type(uint256).max) return false;

        uint256 brace = _findSubstringFrom(src, "{", start);
        if (brace == type(uint256).max) return false;

        uint256 depth = 0;
        for (uint256 i = brace; i < bytes(src).length; i++) {
            bytes1 c = bytes(src)[i];
            if (c == "{") depth++;
            if (c == "}") {
                depth--;
                if (depth == 0) {
                    return _containsReturnFalse(_slice(src, brace, i + 1));
                }
            }
        }
        return false;
    }

    function _containsReturnFalse(string memory body) internal pure returns (bool) {
        return _findSubstring(body, "return false") != type(uint256).max;
    }

    function _findSubstring(string memory haystack, string memory needle) internal pure returns (uint256) {
        return _findSubstringFrom(haystack, needle, 0);
    }

    function _findSubstringFrom(string memory haystack, string memory needle, uint256 from) internal pure returns (uint256) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return type(uint256).max;
        for (uint256 i = from; i <= h.length - n.length; i++) {
            bool matchAll = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    matchAll = false;
                    break;
                }
            }
            if (matchAll) return i;
        }
        return type(uint256).max;
    }

    function _slice(string memory src, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory b = bytes(src);
        bytes memory out = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = b[i];
        }
        return string(out);
    }
}
