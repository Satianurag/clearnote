// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CleanverseCompliancePool
/// @notice Ownable compliance pool shell for Cleanverse Validator /validator/register (owner = deployer EOA).
/// @dev Extended with validator-facing hooks once on-chain register requirements are confirmed.
contract CleanverseCompliancePool is Ownable {
    address public immutable validator;
    address public immutable policy;

    event PoolConfigured(address indexed validator, address indexed policy);

    constructor(address validator_, address policy_, address owner_) Ownable(owner_) {
        validator = validator_;
        policy = policy_;
        emit PoolConfigured(validator_, policy_);
    }
}
