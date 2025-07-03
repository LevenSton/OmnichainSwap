// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

library DataTypes {
    /**
     * @notice A struct containing the necessary information to reconstruct an EIP-712 typed data signature.
     *
     * @param v The signature's recovery parameter.
     * @param r The signature's r parameter.
     * @param s The signature's s parameter
     */
    struct EIP712Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
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
        EIP712Signature[] signatures;
    }

    struct RefundStableCoinData {
        address token;
        address to;
        uint256 amount;
        bytes txHash;
        EIP712Signature[] signatures;
    }
}
