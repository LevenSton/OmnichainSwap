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
    using SafeERC20 for IERC20;

    error NotWhitelistedToken();
    error InvalidParam();
    error UsedHash();
    error TransferFailed();
    error NotRelayer();
    error FailedGetBackTokenFromTomoRouter();
    error SwapFailedFromTomoRouter();
    error SrcTokenBalanceNotCorrect();

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

    event RelayerChanged(address indexed prevRelayer, address indexed newRelayer);
    event TomoRouterChanged(address indexed prevTomoRouter, address indexed newTomoRouter);
    event TokenWhitelisted(address indexed token, bool indexed whitelisted);
    event EthWithdrawn(address indexed to, uint256 amount);
    event Erc20TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

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
        address _relayer,
        address _tomoRouter
    ) external initializer {
        if (_initialOwner == address(0) || _relayer == address(0) || _tomoRouter == address(0)) {
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
        relayer = _relayer;
        tomoRouter = _tomoRouter;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert NotRelayer();
        }
        _;
    }

    /** User user stable coin to swap meme token on dst chain.
     *  only can use stable coin in phase1, USDT/USDC
     */
    function crossChainSwapToByUser(
        DataTypes.CrossChainSwapDataByUser calldata data
    ) external whenNotPaused nonReentrant isWhitelisted(data.srcToken) {
        if (data.to == bytes32(0) || 
            data.dstChainId == CHAIN_ID || 
            data.amount == 0
        ) {
            revert InvalidParam();
        }
        IERC20(data.srcToken).safeTransferFrom(msg.sender, address(this), data.amount);
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
    ) external payable whenNotPaused nonReentrant onlyRelayer isWhitelisted(data.srcToken) {
        if (data.to == address(0) || 
            data.fromChainId == CHAIN_ID || 
            data.amount == 0
        ) {
            revert InvalidParam();
        }
        if (usedHash[data.txHash]) {
            revert UsedHash();
        }
        usedHash[data.txHash] = true;
        // no need to swap, just send stable coin to user
        if(data.srcToken == data.dstToken && data.routerCalldata.length == 0){
            _sendTokenToUser(data);
        }else if(data.srcToken != data.dstToken && data.routerCalldata.length != 0){
            // need use stablecoin to swap to token and send to user
            _swapTokenAndSendTo(data);
        }else{
            revert InvalidParam();
        }
    }

    function withdrawTokens(address token, address to, uint256 amount) external onlyOwner {
        if(token == address(0) || to == address(0) || amount == 0){
            revert InvalidParam();
        }
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (amount > balance) {
            revert TransferFailed();
        }
        IERC20(token).safeTransfer(to, amount);
        emit Erc20TokenWithdrawn(token, to, amount);
    }

    function setWhitelistToken(address token, bool whitelisted) external onlyOwner {
        whitelistTokens[token] = whitelisted;
        emit TokenWhitelisted(token, whitelisted);
    }

    function withdrawEth(address to, uint256 amount) external onlyOwner {
        if(to == address(0) || amount == 0){
            revert InvalidParam();
        }
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

    function setRelayer(address _relayer) external onlyOwner {
        address prevRelayer = relayer;
        relayer = _relayer;
        emit RelayerChanged(prevRelayer, _relayer);
    }

    function setTomoRouter(address _tomoRouter) external onlyOwner {
        address prevTomoRouter = tomoRouter;
        tomoRouter = _tomoRouter;
        emit TomoRouterChanged(prevTomoRouter, tomoRouter);
    }

    function emergePause() external onlyOwner {
        _pause();
    }

    function unPause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}

    // private function
    function _sendTokenToUser(DataTypes.CrossChainSwapDataByProtocol calldata data) private {
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

    function _swapTokenAndSendTo(DataTypes.CrossChainSwapDataByProtocol calldata data) private {
        uint256 beforeSrcTokenBalance = IERC20(data.srcToken).balanceOf(
            address(this)
        );
        uint256 beforeDstTokenBalance = IERC20(data.dstToken).balanceOf(
            address(this)
        );
        IERC20(data.srcToken).safeTransfer(tomoRouter, data.amount);
        (bool success, ) = tomoRouter.call(data.routerCalldata);
        bool swapSuccess = true;
        uint256 swapAmount = 0;
        // if swap failed, get back coin from tomo router contract
        if (!success) {
            bytes memory commands = abi.encodePacked(
                bytes1(uint8(TRANSFER))
            );
            bytes[] memory inputs = new bytes[](1);
            inputs[0] = abi.encode(data.srcToken, address(this), data.amount);
            IUniversalRouter(tomoRouter).execute(commands, inputs);
            uint256 afterSrcTokenBalance = IERC20(data.srcToken).balanceOf(
                address(this)
            );
            // check balance correct
            if(afterSrcTokenBalance != beforeSrcTokenBalance){
                revert FailedGetBackTokenFromTomoRouter();
            }
            //send coin back to user as refund
            IERC20(data.srcToken).safeTransfer(data.to, data.amount);
            swapSuccess = false;
        }else{
            uint256 afterSrcTokenBalance = IERC20(data.srcToken).balanceOf(
                address(this)
            );
            if(beforeSrcTokenBalance - afterSrcTokenBalance != data.amount){
                revert SrcTokenBalanceNotCorrect();
            }
            uint256 afterDstTokenBalance = IERC20(data.dstToken).balanceOf(
                address(this)
            );
            swapAmount = afterDstTokenBalance - beforeDstTokenBalance;
            if(swapAmount == 0){
                revert SwapFailedFromTomoRouter();
            }
            //send swap token to user after swap success.
            IERC20(data.dstToken).safeTransfer(data.to, data.amount);
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
}
