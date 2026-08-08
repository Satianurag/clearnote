// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}
