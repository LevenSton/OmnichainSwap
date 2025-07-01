// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

abstract contract OmnichainSwapStorage {
    uint256 internal CHAIN_ID;

    bytes32 internal constant DOMAIN_NAME = keccak256("OmnichainBridge");
    bytes32 internal constant EIP712_REVISION_HASH = keccak256("1");
    bytes32 public constant CROSS_CHAIN_SWAP_BY_PROTOCOL_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "CrossChainSwapByProtocol(address srcToken,address dstToken,address to,uint256 amount,uint256 fromChainId,uint256 dstChainId,bytes32 txHash)"
            )
        );
    bytes32 public constant WITHDRAW_TOKEN_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "WithdrawToken(address token,address to,uint256 amount)"
            )
        );
    bytes32 public constant WITHDRAW_ETH_TYPEHASH =
        keccak256(abi.encodePacked("WithdrawEth(address to,uint256 amount)"));
    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    uint256 public eventIndex;
    uint256 public validatorThreshold;
    address public withdrawer;
    address public tomoRouter;
    mapping(bytes => bool) public usedHash;
    mapping(address => bool) public whitelistTokens;
    mapping(address => uint256) public relayerApprovalAmount;
    mapping(address => bool) public validators;
}
