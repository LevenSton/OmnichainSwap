// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

abstract contract OmnichainSwapStorage {
    uint256 internal CHAIN_ID;

    uint256 public eventIndex;
    address public relayer;
    address public tomoRouter;
    mapping(bytes => bool) public usedHash;
    mapping(address => bool) public whitelistTokens;
}
