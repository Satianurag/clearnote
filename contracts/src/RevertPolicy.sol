// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

error PolicyDenied(address from, address to, uint256 amount);

contract RevertPolicy {
    bool public allow = true;

    function setAllow(bool a) external {
        allow = a;
    }

    function canTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool) {
        if (!allow) revert PolicyDenied(from, to, amount);
        return true;
    }
}
