// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OmnichainSwapStorage} from "./OmnichainSwapStorage.sol";

contract OmnichainSwapProxy is
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    OmnichainSwapStorage
{
    using SafeERC20 for IERC20;
    address private constant NATIVE_ETH =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    error NotWhitelistedToken();
    error InvalidParam();
    error UsedHash();
    error TransferFailed();
    error NotRelayer();

    event SendTokenToByUser(
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

    event SendTokenToByProtocol(
        uint256 indexed eventIndex,
        address indexed caller,
        address indexed token,
        address to,
        uint256 amount,
        uint256 fromChainId,
        bytes txHash
    );

    event RelayerChanged(address indexed prevRelayer, address indexed newRelayer);
    event TokenWhitelisted(address indexed srcToken, uint256 indexed dstChainId, bytes indexed dstToken);

    modifier isWhitelisted(address token, uint256 dstChainId) {
        if (whitelistTokens[token][dstChainId].length == 0) {
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
        address _relayer
    ) external initializer {
        if (_initialOwner == address(0) || _relayer == address(0)) {
            revert InvalidParam();
        }
        __Pausable_init();
        __ReentrancyGuard_init();
        __Ownable_init(_initialOwner);
        relayer = _relayer;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert NotRelayer();
        }
        _;
    }

    function sendTokenToByUser(
        uint256 orderId,
        address token,
        bytes32 to,
        uint256 dstChainId,
        uint256 amount
    ) external payable whenNotPaused isWhitelisted(token, dstChainId) {
        if (to == bytes32(0) || dstChainId == block.chainid || amount == 0) {
            revert InvalidParam();
        }
        if(token != NATIVE_ETH && msg.value > 0){
            revert InvalidParam();
        }
        if(token == NATIVE_ETH && msg.value != amount){
            revert InvalidParam();
        }
        if (token != NATIVE_ETH) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        bytes memory dstToken = whitelistTokens[token][dstChainId];
        emit SendTokenToByUser(
            orderId,
            eventIndex++,
            msg.sender,
            token,
            to,
            amount,
            block.chainid,
            dstChainId,
            dstToken
        );
    }

    function sendTokenToByProtocol(
        address token,
        address to,
        uint256 amount,
        uint256 fromChainId,
        bytes memory txHash
    ) external whenNotPaused onlyRelayer {
        if (usedHash[txHash]) {
            revert UsedHash();
        }
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

    function withdrawTokens(address token, address to, uint256 amount) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (amount > balance) {
            revert TransferFailed();
        }
        IERC20(token).safeTransfer(to, amount);
    }

    function setWhitelistToken(address[] calldata tokens, uint256[] calldata chainIds, bytes[] calldata dstTokens) external onlyOwner {
        if(tokens.length == 0 || tokens.length != chainIds.length || chainIds.length != dstTokens.length){
            revert InvalidParam();
        }
        for(uint256 i = 0; i < tokens.length; i++){
            address srcToken = tokens[i];
            uint256 dstChainId = chainIds[i];
            bytes calldata dstToken = dstTokens[i];
            if(srcToken == address(0) || dstToken.length == 0){
                revert InvalidParam();
            }
            whitelistTokens[srcToken][dstChainId] = dstToken;
            emit TokenWhitelisted(srcToken, dstChainId, dstToken);
        }
    }

    function withdrawEth(address to, uint256 amount) external onlyOwner {
        uint256 balance = address(this).balance;
        if (amount > balance) {
            revert TransferFailed();
        }
        (bool suc, ) = payable(to).call{value: amount}("");
        if (!suc) {
            revert TransferFailed();
        }
    }

    function setRelayer(address _relayer) external onlyOwner {
        if(_relayer == address(0)){
            revert InvalidParam();
        }
        address prevRelayer = relayer;
        relayer = _relayer;
        emit RelayerChanged(prevRelayer, _relayer);
    }

    function emergePause() external onlyOwner {
        _pause();
    }

    function unPause() external onlyOwner {
        _unpause();
    }
}
