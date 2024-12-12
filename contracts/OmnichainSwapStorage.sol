// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

abstract contract OmnichainSwapStorage {
    // uniswap universal router address
    address internal UNIVERSAL_ROUTER;
    address internal USDT;
    address internal WETH9;
    address internal receiveFundAddress;

    mapping(address => mapping(uint256 => address)) whitelistTokens;
}
