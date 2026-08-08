// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Non-view policy to probe STATICCALL vs CALL from A-Token hook.
contract StateWritePolicy {
    uint256 public counter;

    function canTransfer(
        address,
        address,
        address,
        uint256
    ) external returns (bool) {
        counter++;
        return true;
    }
}
