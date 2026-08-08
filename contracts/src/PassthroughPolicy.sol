// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract PassthroughPolicy {
    bool public allow = true;
    address public lastFrom;
    address public lastTo;
    uint256 public lastAmt;

    function setAllow(bool a) external {
        allow = a;
    }

    // Cleanverse compliance router interface: canTransfer(token, from, to, amount)
    function canTransfer(address token, address from, address to, uint256 amount) external returns (bool) {
        lastFrom = from;
        lastTo = to;
        lastAmt = amount;
        return allow;
    }
}
