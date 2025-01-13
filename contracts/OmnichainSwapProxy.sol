// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OmnichainSwapStorage} from "./OmnichainSwapStorage.sol";
import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";
import {IWETH9} from "./interfaces/IWETH9.sol";
import {IAllowanceTransfer} from "./interfaces/IAllowanceTransfer.sol";
import {DataTypes} from "./libraries/DataTypes.sol";

contract OmnichainSwapProxy is
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    OmnichainSwapStorage
{
    using SafeERC20 for IERC20;

    address private constant NATIVE_ETH =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    bytes32 private constant DOMAIN_NAM_HASH = keccak256("OmnichainSwapProxy");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant EXECUTE_DST_UNI_BY_PROTOCOL_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "executeDstUniByProtocol(address caller,address receiptAddress,address dstToken,uint256 amount,uint256 fromChainId,bytes32 txHash)"
            )
        );
    bytes32 public constant SEND_TOKEN_TO_BY_PROTOCOL_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "sendTokenToByProtocol(address caller,address token,address to,uint256 amount,uint256 fromChainId,bytes32 txHash)"
            )
        );

    bytes32 public constant REFUND_USDT_BY_PROTOCOL_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "refundUSDT(address caller,address to,bytes32 txHash,uint256 amount)"
            )
        );

    error NotWhitelistedToken();
    error InvalidParam();
    error InvalidSignatureLength();
    error InvalidSignature();
    error UniExecuteFailed();
    error USDTUnExpected();
    error SrcTokenUnExpected();
    error DstTokenUnExpected();
    error UsedHash();
    error TransferFailed();
    error AlreadyExist();
    error NotExist();
    error DuplicatedSignature();

    event SwapCompleted(
        uint256 indexed eventIndex,
        address indexed user,
        address indexed srcToken,
        bytes32 dstToken,
        uint256 orderId,
        bytes32 to,
        uint256 srcAmount,
        uint256 minAmountOut,
        uint256 usdtAmount,
        uint256 dstChainId
    );

    event ExecDstUniByProtocol(
        uint256 indexed eventIndex,
        address indexed receiptAddress,
        address indexed dstToken,
        uint256 fromChainId,
        uint256 amount,
        uint256 amountOut,
        bytes32 txHash
    );

    event SendTokenToByUser(
        uint256 indexed eventIndex,
        address indexed user,
        address indexed token,
        address to,
        address dstToken,
        uint256 fromChainId,
        uint256 dstChainId,
        uint256 amount
    );

    event SendTokenToByProtocol(
        uint256 indexed eventIndex,
        address indexed caller,
        address indexed token,
        address to,
        uint256 amount,
        uint256 fromChainId,
        bytes32 txHash
    );

    event ForwardToUniswap(
        uint256 indexed eventIndex,
        address indexed user,
        address indexed srcToken,
        address dstToken,
        uint256 orderId,
        address receiver,
        uint256 srcAmount,
        uint256 dstAmount
    );

    event RefundUSDT(
        uint256 indexed eventIndex,
        address indexed caller,
        address indexed to,
        uint256 amount,
        bytes32 txHash
    );

    event SignerAdded(address indexed caller, address indexed account);
    event SignerRemoved(address indexed caller, address indexed account);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier isWhitelisted(address token, uint256 dstChainId) {
        if (whitelistTokens[token][dstChainId] == address(0)) {
            revert NotWhitelistedToken();
        }
        _;
    }

    function initialize(
        address _universalRouter,
        address _usdt,
        address _weth9,
        address _permit2,
        address _initialOwner,
        address[] calldata _signers
    ) external initializer {
        if (
            _universalRouter == address(0) ||
            _initialOwner == address(0) ||
            _usdt == address(0) ||
            _weth9 == address(0) ||
            _permit2 == address(0) ||
            _signers.length == 0
        ) {
            revert InvalidParam();
        }
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init(_initialOwner);

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        CHAIN_ID = chainId;
        DOMAIN_SEPARATOR = _buildDomainSeparator(
            DOMAIN_TYPEHASH,
            DOMAIN_NAM_HASH
        );

        UNIVERSAL_ROUTER = _universalRouter;
        USDT = _usdt;
        WETH9 = _weth9;
        PERMIT2 = _permit2;
        for (uint256 i = 0; i < _signers.length; i++) {
            if (_signers[i] == address(0)) {
                revert InvalidParam();
            }
            indexes[_signers[i]] = signers.length;
            signers.push(_signers[i]);
            authorized[_signers[i]] = true;
        }
    }

    /// @notice Swap tokens from srcToken to USDT, and emit SwapCompleted event
    function executeSrcUniByUser(
        DataTypes.ExecuteSrcData calldata data
    ) external payable whenNotPaused nonReentrant {
        if (data.dstChainId == CHAIN_ID) {
            revert InvalidParam();
        }
        _transferAssetTo(data.srcAmount, data.srcToken);
        uint256 usdtBalance = data.srcAmount;
        if (data.srcToken != USDT) {
            uint256 usdtBeforeBalance = IERC20(USDT).balanceOf(address(this));
            _forwardSwap(data.srcToken, data.srcAmount, data.callUnidata);
            uint256 usdtAfterBalance = IERC20(USDT).balanceOf(address(this));
            usdtBalance = usdtAfterBalance - usdtBeforeBalance;
            if (usdtBalance == 0) {
                revert USDTUnExpected();
            }
        }

        emit SwapCompleted(
            eventIndex++,
            msg.sender,
            data.srcToken,
            data.dstToken,
            data.orderId,
            data.to,
            data.srcAmount,
            data.minAmountOut,
            usdtBalance,
            data.dstChainId
        );
    }

    function forwardToUniswap(
        DataTypes.ForwardUniData calldata data
    ) external payable whenNotPaused nonReentrant {
        if (
            data.dstToken == address(0) ||
            data.srcToken == address(0) ||
            data.receiver == address(0) ||
            data.srcAmount == 0 ||
            data.dstToken == data.srcToken
        ) {
            revert InvalidParam();
        }
        _transferAssetTo(data.srcAmount, data.srcToken);
        address realDstToken = data.dstToken;
        if (data.dstToken == NATIVE_ETH) {
            realDstToken = WETH9;
        }
        uint256 beforeDstTokenBalance = IERC20(realDstToken).balanceOf(
            address(this)
        );
        _forwardSwap(data.srcToken, data.srcAmount, data.callUnidata);
        uint256 afterDstTokenBalance = IERC20(realDstToken).balanceOf(
            address(this)
        );
        if (afterDstTokenBalance <= beforeDstTokenBalance) {
            revert DstTokenUnExpected();
        }
        uint256 amountOut = afterDstTokenBalance - beforeDstTokenBalance;
        if (data.dstToken == NATIVE_ETH) {
            IWETH9(WETH9).withdraw(amountOut);
            (bool suc, ) = payable(data.receiver).call{value: amountOut}("");
            if (!suc) {
                revert TransferFailed();
            }
        } else {
            IERC20(realDstToken).safeTransfer(data.receiver, amountOut);
        }
        emit ForwardToUniswap(
            eventIndex++,
            msg.sender,
            data.srcToken,
            data.dstToken,
            data.orderId,
            data.receiver,
            data.srcAmount,
            afterDstTokenBalance - beforeDstTokenBalance
        );
    }

    function executeDstUniByProtocol(
        DataTypes.ExecuteDstData calldata data
    ) external payable whenNotPaused {
        {
            if (usedHash[data.txHash]) {
                revert UsedHash();
            }
            if (data.receiptAddress == address(0)) {
                revert InvalidParam();
            }
            usedHash[data.txHash] = true;
            recover(
                buildExecuteDstUniByProtocolSeparator(
                    msg.sender,
                    data.receiptAddress,
                    data.dstToken,
                    data.amount,
                    data.fromChainId,
                    data.txHash
                ),
                data.signatures
            );
            if (IERC20(USDT).allowance(address(this), PERMIT2) < data.amount) {
                IERC20(USDT).forceApprove(PERMIT2, type(uint256).max);
                IAllowanceTransfer(PERMIT2).approve(
                    USDT,
                    UNIVERSAL_ROUTER,
                    type(uint160).max,
                    type(uint48).max
                );
            }
        }
        address realDstToken = data.dstToken;
        if (data.dstToken == NATIVE_ETH) {
            realDstToken = WETH9;
        }
        uint256 beforeDstTokenBalance = IERC20(realDstToken).balanceOf(
            address(this)
        );
        _forwardSwap(USDT, data.amount, data.callUnidata);
        uint256 afterDstTokenBalance = IERC20(realDstToken).balanceOf(
            address(this)
        );
        if (afterDstTokenBalance <= beforeDstTokenBalance) {
            revert DstTokenUnExpected();
        }
        uint256 amountOut = afterDstTokenBalance - beforeDstTokenBalance;
        if (data.dstToken == NATIVE_ETH) {
            IWETH9(WETH9).withdraw(amountOut);
            (bool suc, ) = payable(data.receiptAddress).call{value: amountOut}(
                ""
            );
            if (!suc) {
                revert TransferFailed();
            }
        } else {
            IERC20(data.dstToken).safeTransfer(data.receiptAddress, amountOut);
        }
        emit ExecDstUniByProtocol(
            eventIndex++,
            data.receiptAddress,
            data.dstToken,
            data.fromChainId,
            data.amount,
            amountOut,
            data.txHash
        );
    }

    function sendTokenToByUser(
        address token,
        address to,
        uint256 dstChainId,
        uint256 amount
    ) external payable whenNotPaused isWhitelisted(token, dstChainId) {
        if (to == address(0) || dstChainId == CHAIN_ID || amount == 0) {
            revert InvalidParam();
        }
        if (msg.value > 0 && (token != NATIVE_ETH || amount != msg.value)) {
            revert InvalidParam();
        }
        if (token != NATIVE_ETH) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        emit SendTokenToByUser(
            eventIndex++,
            msg.sender,
            token,
            to,
            whitelistTokens[token][dstChainId],
            CHAIN_ID,
            dstChainId,
            amount
        );
    }

    function sendTokenToByProtocol(
        address token,
        address to,
        uint256 amount,
        uint256 fromChainId,
        bytes32 txHash,
        bytes[] calldata signatures
    ) external whenNotPaused {
        if (usedHash[txHash]) {
            revert UsedHash();
        }
        recover(
            buildSendTokenToByProtocolSeparator(
                msg.sender,
                token,
                to,
                amount,
                fromChainId,
                txHash
            ),
            signatures
        );
        if (to == address(0)) {
            revert InvalidParam();
        }
        usedHash[txHash] = true;
        if (token != NATIVE_ETH) {
            IERC20(token).safeTransfer(to, amount);
        } else {
            (bool suc, ) = payable(to).call{value: amount}("");
            if (!suc) {
                revert TransferFailed();
            }
        }
        emit SendTokenToByProtocol(
            eventIndex++,
            msg.sender,
            token,
            to,
            amount,
            fromChainId,
            txHash
        );
    }

    function withdrawTokens(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, balance);
    }

    function withdrawEth() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool suc, ) = msg.sender.call{value: amount}("");
        if (!suc) {
            revert TransferFailed();
        }
    }

    function refundUSDT(
        address to,
        bytes32 txHash,
        uint256 amount,
        bytes[] calldata signatures
    ) external {
        if (usedHash[txHash]) {
            revert UsedHash();
        }
        if (to == address(0)) {
            revert InvalidParam();
        }
        recover(
            buildRefundUSDTSeparator(msg.sender, to, txHash, amount),
            signatures
        );
        usedHash[txHash] = true;
        IERC20(USDT).safeTransfer(to, amount);
        emit RefundUSDT(eventIndex++, msg.sender, to, amount, txHash);
    }

    function emergePause() external onlyOwner {
        _pause();
    }

    function unPause() external onlyOwner {
        _unpause();
    }

    function addSigner(address account) external onlyOwner {
        if (authorized[account]) {
            revert AlreadyExist();
        }
        indexes[account] = signers.length;
        authorized[account] = true;
        signers.push(account);
        emit SignerAdded(msg.sender, account);
    }

    function removeSigner(address account) external onlyOwner {
        if (!authorized[account] || indexes[account] >= signers.length) {
            revert NotExist();
        }

        uint256 index = indexes[account];
        uint256 lastIndex = signers.length - 1;

        if (index != lastIndex) {
            address lastAddr = signers[lastIndex];
            signers[index] = lastAddr;
            indexes[lastAddr] = index;
        }

        delete authorized[account];
        delete indexes[account];
        signers.pop();

        emit SignerRemoved(msg.sender, account);
    }

    function _transferAssetTo(uint256 srcAmount, address srcToken) private {
        if (msg.value > 0) {
            if (msg.value != srcAmount || srcToken != NATIVE_ETH) {
                revert InvalidParam();
            }
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            IERC20(srcToken).safeTransferFrom(
                msg.sender,
                address(this),
                srcAmount
            );
        }
    }

    function _forwardSwap(
        address srcToken,
        uint256 srcAmount,
        bytes calldata callUnidata
    ) private {
        address realSrcToken = srcToken;
        if (srcToken == NATIVE_ETH) {
            realSrcToken = WETH9;
        }
        uint256 beforesrcTokenBalance = IERC20(realSrcToken).balanceOf(
            address(this)
        );
        if (
            IERC20(realSrcToken).allowance(address(this), PERMIT2) < srcAmount
        ) {
            IERC20(realSrcToken).forceApprove(PERMIT2, type(uint256).max);
            IAllowanceTransfer(PERMIT2).approve(
                realSrcToken,
                UNIVERSAL_ROUTER,
                type(uint160).max,
                type(uint48).max
            );
        }
        (bool success, ) = UNIVERSAL_ROUTER.call(callUnidata);
        if (!success) {
            revert UniExecuteFailed();
        }

        uint256 afterSrcTokenBalance = IERC20(realSrcToken).balanceOf(
            address(this)
        );
        if (beforesrcTokenBalance - afterSrcTokenBalance != srcAmount) {
            revert SrcTokenUnExpected();
        }
    }

    function recover(
        bytes32 hash,
        bytes[] calldata signatures
    ) private view returns (bool) {
        uint256 length = signers.length;
        if (length == 0 || length != signatures.length) {
            revert InvalidParam();
        }
        address[] memory signed = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            address signer = calSigner(hash, signatures[i]);
            if (!authorized[signer]) {
                revert InvalidSignature();
            }
            for (uint256 j = 0; j < i; j++) {
                if (signed[j] == signer) {
                    revert DuplicatedSignature();
                }
            }
            signed[i] = signer;
        }
        return true;
    }

    function calSigner(
        bytes32 hash,
        bytes calldata signature
    ) private pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (signature.length == 65) {
            (r, s) = abi.decode(signature, (bytes32, bytes32));
            v = uint8(signature[64]);
        } else {
            revert InvalidSignatureLength();
        }
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    function buildExecuteDstUniByProtocolSeparator(
        address caller,
        address receiptAddress,
        address dstToken,
        uint256 amount,
        uint256 fromChainId,
        bytes32 txHash
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            EXECUTE_DST_UNI_BY_PROTOCOL_TYPEHASH,
                            caller,
                            receiptAddress,
                            dstToken,
                            amount,
                            fromChainId,
                            txHash
                        )
                    )
                )
            );
    }

    function buildSendTokenToByProtocolSeparator(
        address caller,
        address token,
        address to,
        uint256 amount,
        uint256 fromChainId,
        bytes32 txHash
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            SEND_TOKEN_TO_BY_PROTOCOL_TYPEHASH,
                            caller,
                            token,
                            to,
                            amount,
                            fromChainId,
                            txHash
                        )
                    )
                )
            );
    }

    function buildRefundUSDTSeparator(
        address caller,
        address to,
        bytes32 txHash,
        uint256 amount
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            REFUND_USDT_BY_PROTOCOL_TYPEHASH,
                            caller,
                            to,
                            txHash,
                            amount
                        )
                    )
                )
            );
    }

    /// @notice Builds a domain separator using the current chainId and contract address.
    function _buildDomainSeparator(
        bytes32 typeHash,
        bytes32 nameHash
    ) private view returns (bytes32) {
        return
            keccak256(abi.encode(typeHash, nameHash, CHAIN_ID, address(this)));
    }
}
