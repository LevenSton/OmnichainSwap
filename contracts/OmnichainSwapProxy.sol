// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OmnichainSwapStorage} from "./OmnichainSwapStorage.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";

contract OmnichainSwapProxy is
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    OmnichainSwapStorage
{
    uint256 constant TRANSFER = 0x05;
    address private constant NATIVE_ETH =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    using SafeERC20 for IERC20;

    error NotWhitelistedToken();
    error InvalidParam();
    error UsedHash();
    error TransferFailed();
    error NotRelayerOrInsufficientApproval();
    error NotWithdrawer();
    error FailedGetBackTokenFromTomoRouter();
    error SwapFailedFromTomoRouter();
    error SrcTokenBalanceNotCorrect();
    error SignatureInvalid();
    error DuplicateSignerOrSignaturesNotSorted();

    event CrossChainSwapToByUser(
        uint256 indexed orderId,
        uint256 indexed eventIndex,
        address indexed user,
        address token,
        bytes32 to,
        uint256 amount,
        uint256 fromChainId,
        uint256 dstChainId,
        bytes dstToken
    );

    event CrossChainSwapToByProtocol(
        uint256 indexed eventIndex,
        address indexed caller,
        address indexed srcToken,
        address dstToken,
        address to,
        uint256 amount,
        uint256 dstAmount,
        uint256 fromChainId,
        bytes txHash,
        bool success
    );

    event RelayerApprovalAmountChanged(
        address indexed relayer,
        address indexed token,
        uint256 indexed amount
    );
    event TomoRouterChanged(
        address indexed prevTomoRouter,
        address indexed newTomoRouter
    );
    event TokenWhitelisted(address indexed token, bool indexed whitelisted);
    event EthWithdrawn(address indexed to, uint256 amount);
    event Erc20TokenWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount
    );
    event WithdrawerChanged(
        address indexed prevWithdrawer,
        address indexed newWithdrawer
    );
    event ValidatorThresholdChanged(
        uint256 indexed prevValidatorThreshold,
        uint256 indexed newValidatorThreshold
    );
    event ValidatorChanged(address indexed validator, bool indexed isValid);
    event WhitelistDstChainIdChanged(
        uint256 indexed dstChainId,
        bool indexed whitelisted
    );

    //only stable coin is in whitelist. eg: USDT/USDC
    modifier isWhitelisted(address token) {
        if (!whitelistTokens[token]) {
            revert NotWhitelistedToken();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _initialOwner,
        address _withdrawer,
        address _tomoRouter
    ) external initializer {
        if (
            _initialOwner == address(0) ||
            _withdrawer == address(0) ||
            _tomoRouter == address(0)
        ) {
            revert InvalidParam();
        }
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init(_initialOwner);
        CHAIN_ID = chainId;
        withdrawer = _withdrawer;
        tomoRouter = _tomoRouter;
    }

    modifier onlyRelayer(
        address _relayer,
        address _token,
        uint256 _amount
    ) {
        if (relayerApprovalAmount[_relayer][_token] < _amount) {
            revert NotRelayerOrInsufficientApproval();
        }
        _;
    }

    modifier onlyWithdrawer() {
        if (msg.sender != withdrawer) {
            revert NotWithdrawer();
        }
        _;
    }

    /** User user stable coin to swap meme token on dst chain.
     *  only can use stable coin in phase1, USDT/USDC
     */
    function crossChainSwapToByUser(
        DataTypes.CrossChainSwapDataByUser calldata data
    ) external whenNotPaused nonReentrant isWhitelisted(data.srcToken) {
        if (
            data.to == bytes32(0) ||
            data.dstChainId == CHAIN_ID ||
            data.amount == 0
        ) {
            revert InvalidParam();
        }
        IERC20(data.srcToken).safeTransferFrom(
            msg.sender,
            address(this),
            data.amount
        );
        emit CrossChainSwapToByUser(
            data.orderId,
            eventIndex++,
            msg.sender,
            data.srcToken,
            data.to,
            data.amount,
            CHAIN_ID,
            data.dstChainId,
            data.dstToken
        );
    }

    function crossChainSwapToByProtocol(
        DataTypes.CrossChainSwapDataByProtocol calldata data
    )
        external
        payable
        whenNotPaused
        nonReentrant
        onlyRelayer(msg.sender, data.srcToken, data.amount)
        isWhitelisted(data.srcToken)
    {
        if (
            validatorThreshold == 0 ||
            data.signatures.length < validatorThreshold
        ) {
            revert SignatureInvalid();
        }

        _validateCrossChainSwapToByProtocolSignatures(data);
        if (
            data.to == address(0) ||
            data.fromChainId == CHAIN_ID ||
            data.dstChainId != CHAIN_ID ||
            data.amount == 0
        ) {
            revert InvalidParam();
        }
        if (usedHash[data.txHash]) {
            revert UsedHash();
        }
        usedHash[data.txHash] = true;
        relayerApprovalAmount[msg.sender][data.srcToken] -= data.amount;
        // no need to swap, just send stable coin to user
        if (data.srcToken == data.dstToken && data.routerCalldata.length == 0) {
            _sendTokenToUser(data);
        } else if (
            data.srcToken != data.dstToken && data.routerCalldata.length != 0
        ) {
            // need use stablecoin to swap to token and send to user
            _swapTokenAndSendTo(data);
        } else {
            revert InvalidParam();
        }
    }

    function withdrawTokens(
        address token,
        address to,
        uint256 amount,
        DataTypes.EIP712Signature[] calldata signatures
    ) external onlyWithdrawer {
        if (token == address(0) || to == address(0) || amount == 0) {
            revert InvalidParam();
        }
        if (validatorThreshold == 0 || signatures.length < validatorThreshold) {
            revert SignatureInvalid();
        }
        _validateWithdrawTokenSignatures(token, to, amount, signatures);

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (amount > balance) {
            revert TransferFailed();
        }
        IERC20(token).safeTransfer(to, amount);
        emit Erc20TokenWithdrawn(token, to, amount);
    }

    function withdrawEth(
        address to,
        uint256 amount,
        DataTypes.EIP712Signature[] calldata signatures
    ) external onlyWithdrawer {
        if (to == address(0) || amount == 0) {
            revert InvalidParam();
        }
        if (validatorThreshold == 0 || signatures.length < validatorThreshold) {
            revert SignatureInvalid();
        }
        _validateWithdrawEthSignatures(to, amount, signatures);
        uint256 balance = address(this).balance;
        if (amount > balance) {
            revert TransferFailed();
        }
        (bool suc, ) = payable(to).call{value: amount}("");
        if (!suc) {
            revert TransferFailed();
        }
        emit EthWithdrawn(to, amount);
    }

    function setWhitelistToken(
        address token,
        bool whitelisted
    ) external onlyOwner {
        whitelistTokens[token] = whitelisted;
        emit TokenWhitelisted(token, whitelisted);
    }

    function setWhitelistDstChainId(
        uint256 dstChainId,
        bool whitelisted
    ) external onlyOwner {
        whitelistDstChainIds[dstChainId] = whitelisted;
        emit WhitelistDstChainIdChanged(dstChainId, whitelisted);
    }

    function setValidatorThreshold(
        uint256 _validatorThreshold
    ) external onlyOwner {
        if (_validatorThreshold == 0) {
            revert InvalidParam();
        }
        uint256 prevValidatorThreshold = validatorThreshold;
        validatorThreshold = _validatorThreshold;
        emit ValidatorThresholdChanged(
            prevValidatorThreshold,
            validatorThreshold
        );
    }

    function setValidator(
        address _validator,
        bool _isValid
    ) external onlyOwner {
        if (_validator == address(0)) {
            revert InvalidParam();
        }
        validators[_validator] = _isValid;
        emit ValidatorChanged(_validator, _isValid);
    }

    function setRelayerApprovalAmount(
        address _relayer,
        address _token,
        uint256 _amount
    ) external onlyOwner {
        if (_relayer == address(0) || _token == address(0) || _amount == 0) {
            revert InvalidParam();
        }
        relayerApprovalAmount[_relayer][_token] = _amount;
        emit RelayerApprovalAmountChanged(_relayer, _token, _amount);
    }

    function setTomoRouter(address _tomoRouter) external onlyOwner {
        if (_tomoRouter == address(0)) {
            revert InvalidParam();
        }
        address prevTomoRouter = tomoRouter;
        tomoRouter = _tomoRouter;
        emit TomoRouterChanged(prevTomoRouter, tomoRouter);
    }

    function setWithdrawer(address _withdrawer) external onlyOwner {
        if (_withdrawer == address(0)) {
            revert InvalidParam();
        }
        address prevWithdrawer = withdrawer;
        withdrawer = _withdrawer;
        emit WithdrawerChanged(prevWithdrawer, _withdrawer);
    }

    function emergePause() external onlyOwner {
        _pause();
    }

    function unPause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}

    // private function
    function _sendTokenToUser(
        DataTypes.CrossChainSwapDataByProtocol calldata data
    ) private {
        IERC20(data.srcToken).safeTransfer(data.to, data.amount);
        emit CrossChainSwapToByProtocol(
            eventIndex++,
            msg.sender,
            data.srcToken,
            data.dstToken,
            data.to,
            data.amount,
            data.amount,
            data.fromChainId,
            data.txHash,
            true
        );
    }

    function _getContractBalance(
        address dstToken
    ) private view returns (uint256) {
        uint256 beforeDstTokenBalance;
        if (dstToken == NATIVE_ETH) {
            beforeDstTokenBalance = address(this).balance;
        } else {
            beforeDstTokenBalance = IERC20(dstToken).balanceOf(address(this));
        }
        return beforeDstTokenBalance;
    }

    function _sendDstTokenToUser(
        address dstToken,
        address to,
        uint256 amount
    ) private {
        if (dstToken == NATIVE_ETH) {
            (bool suc, ) = payable(to).call{value: amount}("");
            if (!suc) {
                revert TransferFailed();
            }
        } else {
            IERC20(dstToken).safeTransfer(to, amount);
        }
    }

    function _swapTokenAndSendTo(
        DataTypes.CrossChainSwapDataByProtocol calldata data
    ) private {
        uint256 beforeSrcTokenBalance = IERC20(data.srcToken).balanceOf(
            address(this)
        );
        uint256 beforeDstTokenBalance = _getContractBalance(data.dstToken);
        IERC20(data.srcToken).safeTransfer(tomoRouter, data.amount);
        (bool success, ) = tomoRouter.call(data.routerCalldata);
        bool swapSuccess = true;
        uint256 swapAmount = 0;
        // if swap failed, get back coin from tomo router contract
        if (!success) {
            bytes memory commands = abi.encodePacked(bytes1(uint8(TRANSFER)));
            bytes[] memory inputs = new bytes[](1);
            inputs[0] = abi.encode(data.srcToken, address(this), data.amount);
            IUniversalRouter(tomoRouter).execute(commands, inputs);
            uint256 afterSrcTokenBalance = IERC20(data.srcToken).balanceOf(
                address(this)
            );
            // check balance correct
            if (afterSrcTokenBalance != beforeSrcTokenBalance) {
                revert FailedGetBackTokenFromTomoRouter();
            }
            //send coin back to user as refund, first phase not need to refund, refund by manual
            //IERC20(data.srcToken).safeTransfer(data.to, data.amount);
            swapSuccess = false;
        } else {
            uint256 afterSrcTokenBalance = IERC20(data.srcToken).balanceOf(
                address(this)
            );
            if (beforeSrcTokenBalance - afterSrcTokenBalance != data.amount) {
                revert SrcTokenBalanceNotCorrect();
            }
            uint256 afterDstTokenBalance = _getContractBalance(data.dstToken);
            swapAmount = afterDstTokenBalance - beforeDstTokenBalance;
            if (swapAmount == 0) {
                revert SwapFailedFromTomoRouter();
            }
            //send swap token to user after swap success.
            _sendDstTokenToUser(data.dstToken, data.to, swapAmount);
        }
        emit CrossChainSwapToByProtocol(
            eventIndex++,
            msg.sender,
            data.srcToken,
            data.dstToken,
            data.to,
            data.amount,
            swapAmount,
            data.fromChainId,
            data.txHash,
            swapSuccess
        );
    }

    function _validateWithdrawTokenSignatures(
        address token,
        address to,
        uint256 amount,
        DataTypes.EIP712Signature[] calldata signatures
    ) private view {
        _validateOrderedMultiSignatures(
            _calculateDigest(
                keccak256(
                    abi.encode(WITHDRAW_TOKEN_TYPEHASH, token, to, amount)
                )
            ),
            signatures
        );
    }

    function _validateWithdrawEthSignatures(
        address to,
        uint256 amount,
        DataTypes.EIP712Signature[] calldata signatures
    ) private view {
        _validateOrderedMultiSignatures(
            _calculateDigest(
                keccak256(abi.encode(WITHDRAW_ETH_TYPEHASH, to, amount))
            ),
            signatures
        );
    }

    function _validateCrossChainSwapToByProtocolSignatures(
        DataTypes.CrossChainSwapDataByProtocol calldata data
    ) private view {
        _validateOrderedMultiSignatures(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        CROSS_CHAIN_SWAP_BY_PROTOCOL_TYPEHASH,
                        data.srcToken,
                        data.dstToken,
                        data.to,
                        data.amount,
                        data.fromChainId,
                        data.dstChainId
                    )
                )
            ),
            data.signatures
        );
    }

    /**
     * @dev validate multi signatures
     * @param digest the EIP712 digest to validate (already calculated)
     * @param signatures the signatures to validate (must be sorted in ascending order)
     */
    function _validateOrderedMultiSignatures(
        bytes32 digest,
        DataTypes.EIP712Signature[] calldata signatures
    ) private view {
        address previousSigner = address(0);

        for (uint256 i = 0; i < signatures.length; i++) {
            address currentSigner = ecrecover(
                digest,
                signatures[i].v,
                signatures[i].r,
                signatures[i].s
            );

            if (currentSigner == address(0) || !validators[currentSigner]) {
                revert SignatureInvalid();
            }

            // check if the signatures are sorted in ascending order and no duplicates
            if (currentSigner <= previousSigner) {
                revert DuplicateSignerOrSignaturesNotSorted();
            }

            previousSigner = currentSigner;
        }
    }

    /**
     * @dev Calculates EIP712 DOMAIN_SEPARATOR based on the current contract and chain ID.
     */
    function _calculateDomainSeparator() private view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    DOMAIN_NAME,
                    EIP712_REVISION_HASH,
                    CHAIN_ID,
                    address(this)
                )
            );
    }

    /**
     * @dev Calculates EIP712 digest based on the current DOMAIN_SEPARATOR.
     *
     * @param hashedMessage The message hash from which the digest should be calculated.
     *
     * @return bytes32 A 32-byte output representing the EIP712 digest.
     */
    function _calculateDigest(
        bytes32 hashedMessage
    ) private view returns (bytes32) {
        bytes32 digest;
        unchecked {
            digest = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _calculateDomainSeparator(),
                    hashedMessage
                )
            );
        }
        return digest;
    }
}
