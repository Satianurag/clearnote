// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

contract Holder {
    function pull(address t, address from, uint256 a) external {
        IERC20(t).transferFrom(from, address(this), a);
    }

    function push(address t, address to, uint256 a) external {
        IERC20(t).transfer(to, a);
    }

    function ok(address t, address s, uint256 a) external {
        IERC20(t).approve(s, a);
    }
}
