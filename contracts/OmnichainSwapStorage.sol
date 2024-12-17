// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

abstract contract OmnichainSwapStorage {
    bytes32 internal DOMAIN_SEPARATOR;
    uint256 internal CHAIN_ID;

    // uniswap universal router address
    address internal UNIVERSAL_ROUTER;
    address internal PERMIT2;
    address internal USDT;
    address internal WETH9;
    address internal receiveFundAddress;

    address public relayer;
    address[] public signers;
    mapping(address => bool) public authorized;
    uint256 public threshold;

    mapping(address => mapping(uint256 => address)) whitelistTokens;
}
