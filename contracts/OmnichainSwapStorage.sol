// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

abstract contract OmnichainSwapStorage {
    address public relayer;
    mapping(bytes => bool) public usedHash;
    mapping(address => bool) public whitelistTokens;
    uint256 public eventIndex;
}
