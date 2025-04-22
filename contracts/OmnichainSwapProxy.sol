// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OmnichainSwapStorage} from "./OmnichainSwapStorage.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OmnichainSwapProxy is
    Pausable,
    ReentrancyGuard,
    Ownable,
    OmnichainSwapStorage
{
    using SafeERC20 for IERC20;
    address private constant NATIVE_ETH =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    error NotWhitelistedToken();
    error InvalidParam();
    error InvalidSignatureLength();
    error InvalidSignature();
    error UsedHash();
    error TransferFailed();
    error AlreadyExist();
    error NotExist();
    error DuplicatedSignature();
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
    event TokenWhitelisted(address indexed token, bool indexed whitelisted);

    modifier isWhitelisted(address token) {
        if (!whitelistTokens[token]) {
            revert NotWhitelistedToken();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() Ownable(msg.sender) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        CHAIN_ID = chainId;
        relayer = msg.sender;
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
        bytes memory dstToken,
        uint256 amount
    ) external payable whenNotPaused isWhitelisted(token) {
        if (to == bytes32(0) || dstChainId == CHAIN_ID || amount == 0) {
            revert InvalidParam();
        }
        if (msg.value > 0 && (token != NATIVE_ETH || amount != msg.value)) {
            revert InvalidParam();
        }
        if (token != NATIVE_ETH) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        emit SendTokenToByUser(
            orderId,
            eventIndex++,
            msg.sender,
            token,
            to,
            amount,
            CHAIN_ID,
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

    function setWhitelistToken(address token, bool whitelisted) external onlyOwner {
        whitelistTokens[token] = whitelisted;
        emit TokenWhitelisted(token, whitelisted);
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
