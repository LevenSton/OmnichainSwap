// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

library DataTypes {
    struct ExecuteSrcData {
        uint256 orderId;
        address srcToken;
        bytes dstToken;
        bytes32 to;
        uint256 dstChainId;
        uint256 srcAmount;
        uint256 minAmountOut;
        bytes callUnidata;
    }

    struct ForwardUniData {
        uint256 orderId;
        address srcToken;
        address dstToken;
        address receiver;
        uint256 srcAmount;
        bytes callUnidata;
    }

    struct ExecuteDstData {
        address receiptAddress;
        address dstToken;
        uint256 amount;
        uint256 fromChainId;
        bytes txHash;
        bytes callUnidata;
        bytes[] signatures;
    }
}
