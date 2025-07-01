// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

library DataTypes {
    struct CrossChainSwapDataByUser {
        uint256 orderId;
        address srcToken;
        bytes dstToken;
        bytes32 to;
        uint256 dstChainId;
        uint256 amount;
    }

    struct CrossChainSwapDataByProtocol {
        address srcToken;
        address dstToken;
        address to;
        uint256 amount;
        uint256 fromChainId;
        uint256 dstChainId;
        bytes txHash;
        bytes routerCalldata;
    }
}
