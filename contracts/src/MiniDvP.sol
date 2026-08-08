// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
}

contract MiniDvP {
    error CashLegFailed();

    function settle(
        address note,
        address cash,
        address seller,
        address buyer,
        uint256 noteAmt,
        uint256 cashAmt
    ) external {
        if (!IERC20(cash).transferFrom(buyer, seller, cashAmt)) revert CashLegFailed();
        IERC20(note).transferFrom(seller, buyer, noteAmt);
    }
}
