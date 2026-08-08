// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice View-only policy for STATICCALL from Cleanverse A-Token.
contract PassthroughPolicy {
    bool public allow = true;

    function setAllow(bool a) external {
        allow = a;
    }

    function canTransfer(
        address,
        address,
        address,
        uint256
    ) external view returns (bool) {
        return allow;
    }
}
