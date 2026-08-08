// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IClearNoteController {
    function lockedUntil(address token, address holder) external view returns (uint64);
    function investorCount(address token) external view returns (uint256);
    function maxInvestors(address token) external view returns (uint256);
    function maxPositionBps(address token) external view returns (uint256);
    function isPaused(address token) external view returns (bool);
}
