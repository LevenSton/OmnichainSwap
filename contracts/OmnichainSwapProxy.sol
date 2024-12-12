// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OmnichainSwapStorage} from "./OmnichainSwapStorage.sol";
import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";
import {IWETH9} from "./interfaces/IWETH9.sol";

contract OmnichainSwapProxy is
    PausableUpgradeable,
    OwnableUpgradeable,
    OmnichainSwapStorage
{
    using SafeERC20 for IERC20;

    error InvalidRouter();
    error NotWhitelistedToken();
    error InvalidParam();

    event SwapCompleted(
        address indexed user,
        address indexed srcToken,
        address indexed dstToken,
        uint256 srcAmount,
        uint256 usdtAmount,
        uint256 desChainId
    );

    event SendTokenTo(
        address indexed user,
        address indexed token,
        address indexed to,
        address desToken,
        uint256 desChainId,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier isWhitelisted(address token, uint256 desChainId) {
        if (whitelistTokens[token][desChainId] == address(0)) {
            revert NotWhitelistedToken();
        }
        _;
    }

    function initialize(
        address _universalRouter,
        address _usdt,
        address _weth9,
        address _initialOwner,
        address _receiveFundAddress
    ) external initializer {
        if (
            _universalRouter == address(0) ||
            _initialOwner == address(0) ||
            _usdt == address(0) ||
            _weth9 == address(0)
        ) {
            revert InvalidRouter();
        }
        __Pausable_init();
        __Ownable_init(_initialOwner);
        UNIVERSAL_ROUTER = _universalRouter;
        USDT = _usdt;
        WETH9 = _weth9;
        receiveFundAddress = _receiveFundAddress;
    }

    /// @notice Swap tokens from srcToken to USDT, and emit SwapCompleted event
    /// @param srcToken The source token address
    /// @param dstToken The destination token address
    /// @param desChainId The destination chain id
    /// @param amount The amount of srcToken to swap
    /// @param commands The commands to execute on the router
    /// @param inputs The inputs for the commands
    /// @param deadline The deadline for the swap
    function execute(
        address srcToken,
        address dstToken,
        uint256 desChainId,
        uint256 amount,
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable whenNotPaused {
        clearBalanceBeforeSwap(srcToken);

        if (msg.value > 0) {
            require(srcToken == WETH9, "Invalid srcToken");
            require(msg.value == amount, "Invalid amount");
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            require(srcToken != WETH9, "Invalid srcToken");
            IERC20(srcToken).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        uint256 beforesrcTokenBalance = IERC20(srcToken).balanceOf(
            address(this)
        );
        uint256 allowance = IERC20(srcToken).allowance(
            address(this),
            UNIVERSAL_ROUTER
        );
        if (allowance < amount) {
            IERC20(srcToken).forceApprove(UNIVERSAL_ROUTER, type(uint256).max);
        }
        IUniversalRouter(UNIVERSAL_ROUTER).execute(commands, inputs, deadline);

        uint256 afterSrcTokenBalance = IERC20(srcToken).balanceOf(
            address(this)
        );
        if (afterSrcTokenBalance > 0) {
            if (srcToken == WETH9) {
                IWETH9(WETH9).withdraw(afterSrcTokenBalance);
                payable(msg.sender).transfer(afterSrcTokenBalance);
            } else {
                IERC20(srcToken).safeTransfer(msg.sender, afterSrcTokenBalance);
            }
        }
        uint256 realSrcAmount = beforesrcTokenBalance - afterSrcTokenBalance;
        uint256 usdtBalance = IERC20(USDT).balanceOf(address(this));
        require(usdtBalance > 0, "Invalid swap amount");
        IERC20(USDT).safeTransfer(receiveFundAddress, usdtBalance);

        emit SwapCompleted(
            msg.sender,
            srcToken,
            dstToken,
            realSrcAmount,
            usdtBalance,
            desChainId
        );
    }

    function sendTokenTo(
        address token,
        address to,
        uint256 desChainId,
        uint256 amount
    ) external whenNotPaused isWhitelisted(token, desChainId) {
        if (to == address(0)) {
            revert InvalidParam();
        }
        IERC20(token).safeTransferFrom(msg.sender, receiveFundAddress, amount);
        emit SendTokenTo(
            msg.sender,
            token,
            to,
            whitelistTokens[token][desChainId],
            desChainId,
            amount
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

    function clearBalanceBeforeSwap(address srcToken) private {
        uint256 usdtBalance = IERC20(USDT).balanceOf(address(this));
        if (usdtBalance > 0) {
            IERC20(USDT).safeTransfer(receiveFundAddress, usdtBalance);
        }
        uint256 wethTokenBalance = IERC20(WETH9).balanceOf(address(this));
        if (wethTokenBalance > 0) {
            IERC20(WETH9).safeTransfer(receiveFundAddress, wethTokenBalance);
        }
        uint256 srcTokenBalance = IERC20(srcToken).balanceOf(address(this));
        if (srcTokenBalance > 0) {
            IERC20(srcToken).safeTransfer(receiveFundAddress, srcTokenBalance);
        }
    }
}
