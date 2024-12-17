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

contract OmnichainSwapProxy is
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    OmnichainSwapStorage
{
    using SafeERC20 for IERC20;

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

    error NotWhitelistedToken();
    error InvalidParam();
    error InvalidSignatureLength();
    error InvalidSignature();
    error UniExecuteFailed();
    error USDTUnExpected();
    error DstTokenUnExpected();

    event SwapCompleted(
        address indexed user,
        address indexed srcToken,
        address indexed dstToken,
        uint256 srcAmount,
        uint256 usdtAmount,
        uint256 dstChainId
    );

    event SendTokenToByUser(
        address indexed user,
        address indexed token,
        address indexed to,
        address dstToken,
        uint256 fromChainId,
        uint256 dstChainId,
        uint256 amount
    );

    event SendTokenToByProtocol(
        address indexed caller,
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 fromChainId,
        bytes32 txHash
    );

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
            signers.push(_signers[i]);
            authorized[_signers[i]] = true;
        }
    }

    /// @notice Swap tokens from srcToken to USDT, and emit SwapCompleted event
    /// @param srcToken The source token address
    /// @param dstToken The destination token address
    /// @param dstChainId The destination chain id
    /// @param srcAmount The amount of srcToken to swap
    /// @param callUnidata The call data for the universal router
    function executeSrcUniByUser(
        address srcToken,
        address dstToken,
        uint256 dstChainId,
        uint256 srcAmount,
        bytes calldata callUnidata
    ) external payable whenNotPaused nonReentrant {
        if (msg.value > 0) {
            require(srcToken == WETH9, "Invalid srcToken");
            require(msg.value == srcAmount, "Invalid amount");
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            require(srcToken != WETH9, "Invalid srcToken");
            IERC20(srcToken).safeTransferFrom(
                msg.sender,
                address(this),
                srcAmount
            );
        }

        uint256 realSrcAmount;
        uint256 usdtBalance;
        {
            uint256 beforesrcTokenBalance = IERC20(srcToken).balanceOf(
                address(this)
            );
            uint256 usdtBeforeBalance = IERC20(USDT).balanceOf(address(this));
            if (
                IERC20(srcToken).allowance(address(this), PERMIT2) < srcAmount
            ) {
                IERC20(srcToken).forceApprove(PERMIT2, type(uint256).max);
                IAllowanceTransfer(PERMIT2).approve(
                    srcToken,
                    UNIVERSAL_ROUTER,
                    type(uint160).max,
                    type(uint48).max
                );
            }
            (bool success, ) = UNIVERSAL_ROUTER.call(callUnidata);
            if (!success) {
                revert UniExecuteFailed();
            }

            uint256 afterSrcTokenBalance = IERC20(srcToken).balanceOf(
                address(this)
            );
            if (afterSrcTokenBalance > 0) {
                if (srcToken == WETH9) {
                    IWETH9(WETH9).withdraw(afterSrcTokenBalance);
                    payable(msg.sender).transfer(afterSrcTokenBalance);
                } else {
                    IERC20(srcToken).safeTransfer(
                        msg.sender,
                        afterSrcTokenBalance
                    );
                }
            }
            realSrcAmount = beforesrcTokenBalance - afterSrcTokenBalance;
            uint256 usdtAfterBalance = IERC20(USDT).balanceOf(address(this));
            usdtBalance = usdtAfterBalance - usdtBeforeBalance;
            require(usdtBalance > 0, "Invalid swap amount");
        }

        emit SwapCompleted(
            msg.sender,
            srcToken,
            dstToken,
            realSrcAmount,
            usdtBalance,
            dstChainId
        );
    }

    function executeDstUniByProtocol(
        address receiptAddress,
        address dstToken,
        uint256 amount,
        uint256 fromChainId,
        bytes32 txHash,
        bytes calldata callUnidata,
        bytes[] calldata signatures
    ) external payable whenNotPaused {
        recover(
            buildExecuteDstUniByProtocolSeparator(
                msg.sender,
                receiptAddress,
                dstToken,
                amount,
                fromChainId,
                txHash
            ),
            signatures
        );
        if (receiptAddress == address(0)) {
            revert InvalidParam();
        }
        if (IERC20(USDT).allowance(address(this), PERMIT2) < amount) {
            IERC20(USDT).forceApprove(PERMIT2, type(uint256).max);
            IAllowanceTransfer(PERMIT2).approve(
                USDT,
                UNIVERSAL_ROUTER,
                type(uint160).max,
                type(uint48).max
            );
        }
        uint256 usdtBeforeBalance = IERC20(USDT).balanceOf(address(this));
        uint256 beforeDstTokenBalance = IERC20(dstToken).balanceOf(
            receiptAddress
        );
        (bool success, ) = UNIVERSAL_ROUTER.call(callUnidata);
        if (!success) {
            revert UniExecuteFailed();
        }
        uint256 usdtAfterBalance = IERC20(USDT).balanceOf(address(this));
        if (usdtAfterBalance - usdtBeforeBalance != amount) {
            revert USDTUnExpected();
        }
        uint256 afterDstTokenBalance = IERC20(dstToken).balanceOf(
            receiptAddress
        );
        if (afterDstTokenBalance <= beforeDstTokenBalance) {
            revert DstTokenUnExpected();
        }
    }

    function sendTokenToByUser(
        address token,
        address to,
        uint256 dstChainId,
        uint256 amount
    ) external whenNotPaused isWhitelisted(token, dstChainId) {
        if (to == address(0)) {
            revert InvalidParam();
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit SendTokenToByUser(
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
        IERC20(token).safeTransfer(to, amount);
        emit SendTokenToByProtocol(
            msg.sender,
            token,
            to,
            amount,
            fromChainId,
            txHash
        );
    }

    function rescueTokens(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, balance);
    }

    function rescueEth() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool suc, ) = msg.sender.call{value: amount}("");
        require(suc, "Failed to transfer eth");
    }

    function emergePause() external onlyOwner {
        _pause();
    }

    function unPause() external onlyOwner {
        _unpause();
    }

    function recover(
        bytes32 hash,
        bytes[] calldata signatures
    ) private view returns (bool) {
        uint256 length = signers.length;
        require(
            length > 0 && length == signatures.length,
            "Invalid signature length"
        );
        address[] memory signed = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            address signer = calSigner(hash, signatures[i]);
            require(authorized[signer], "Invalid signer");
            for (uint256 j = 0; j < i; j++) {
                require(signed[j] != signer, "Duplicated");
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

    /// @notice Builds a domain separator using the current chainId and contract address.
    function _buildDomainSeparator(
        bytes32 typeHash,
        bytes32 nameHash
    ) private view returns (bytes32) {
        return
            keccak256(abi.encode(typeHash, nameHash, CHAIN_ID, address(this)));
    }
}
