import { expect } from 'chai';
import {
    makeSuiteCleanRoom,
    user,
    deployer,
    omnichainSwapProxyContract,
    dstTokenAddress,
    dstChainId,
    abiCoder,
    userAddress,
    omnichainSwapProxyAddress,
    _usdt,
    oneHourLater,
    deployerAddress,
    _native,
    relayer,
    withdrawer
} from '../__setup.spec';
import { ERRORS } from '../helpers/errors';
import { ethers, network } from 'hardhat';
import { FeeAmount, MAX_UINT256, MSG_SENDER, SOURCE_ROUTER, ZERO_ADDRESS } from '../helpers/constants';
import { CommandType, RoutePlanner } from '../helpers/planner';
import { buildCrossChainSwapToByProtocolSeparator, buildRefundStableCoinSeparator, buildWithdrawTokenSeparator, encodePathExactInput } from '../helpers/utils';
import { IERC20__factory } from '../../typechain-types';

makeSuiteCleanRoom('Execute OmnichainSwap crossChainSwapToByProtocol', function () {
    context('Generic', function () {
        const crossAmount = ethers.parseEther("5");
        const nowWhitelistERC20Token = '0x232a7a48d1dd946617d82fab36b46a30f69df4a3'
        let planner: RoutePlanner

        beforeEach(async function () {
            planner = new RoutePlanner()
        });

        context('Negatives', function () {
            it('User should fail to crossChainSwapToByProtocol cause no permitssion.',   async function () {
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: nowWhitelistERC20Token,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                    signatures: []
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotRelayerOrInsufficientApproval);
            });
            it('Should fail to crossChainSwapToByProtocol if emergePause.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).emergePause()).to.be.not.reverted;
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                    signatures: []
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.EnforcedPause);
            });
            it('Should fail to crossChainSwapToByProtocol if not whitelist token.', async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).setWhitelistToken(_usdt, false)).to.be.not.reverted
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: nowWhitelistERC20Token,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                    signatures: []
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotWhitelistedToken);
            });
            it('Should fail to crossChainSwapToByProtocol if invliad to.', async function () {
                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, _usdt, ZERO_ADDRESS, crossAmount, 8453, 8453, txHashBytes);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: ZERO_ADDRESS,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 8453,
                    txHash: txHashBytes,
                    routerCalldata: "0xa234",
                    signatures: signatures
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if invliad chainid.', async function () {
                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, _usdt, userAddress, crossAmount, 31337, 8453, txHashBytes);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 31337,
                    dstChainId: 8453,
                    txHash: txHashBytes,
                    routerCalldata: "0xa234",
                    signatures: signatures
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if invliad amount.', async function () {
                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, _usdt, userAddress, 0n, 8453, 8453, txHashBytes);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: 0,
                    fromChainId: 8453,
                    dstChainId: 8453,
                    txHash: txHashBytes,
                    routerCalldata: "0xa234",
                    signatures: signatures
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if invalid params.', async function () {
                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, _usdt, userAddress, crossAmount, 8453, 8453, txHashBytes);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 8453,
                    txHash: txHashBytes,
                    routerCalldata: "0xa234",
                    signatures: signatures
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if not enough balance.', async function () {
                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator
                    (omnichainSwapProxyAddress, "OmnichainBridge", _usdt, _usdt, userAddress, crossAmount, 8453, 1, txHashBytes);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 1,
                    txHash: txHashBytes,
                    routerCalldata: "0x",
                    signatures: signatures
                })).to.be.reverted
            });
            it('Should fail to refundStableCoinIfSwapFailedOnDstChain if not enough balance.', async function () {
                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildRefundStableCoinSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, userAddress, crossAmount, txHashBytes);
                await expect(omnichainSwapProxyContract.connect(relayer).refundStableCoinIfSwapFailedOnDstChain({
                    token: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    txHash: txHashBytes,
                    signatures: signatures
                })).to.be.reverted
            });
            it('failed withdraw token if not enough balance.', async function () {
                await expect(omnichainSwapProxyContract.connect(withdrawer).withdrawTokens(_usdt, userAddress, crossAmount)).to.be.reverted;
            });
            it('failed withdraw token if params invalid.', async function () {
                await expect(omnichainSwapProxyContract.connect(withdrawer).withdrawTokens(ZERO_ADDRESS, userAddress, crossAmount)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);

                await expect(omnichainSwapProxyContract.connect(withdrawer).withdrawTokens(_usdt, ZERO_ADDRESS, crossAmount)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);

                await expect(omnichainSwapProxyContract.connect(withdrawer).withdrawTokens(_usdt, userAddress, 0)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
        })

        context('Scenarios', function () {
            it('Get correct variable if crossChainSwapToByProtocol stable token success', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });
                const whaleSigner = await ethers.getSigner(bscBigHolder);
                const usdtContractWithWhale = USDT.connect(whaleSigner);
                const tx = await usdtContractWithWhale.transfer(omnichainSwapProxyAddress, ethers.parseEther("10000"));
                await tx.wait();
                const beforeUserBalance = await USDT.connect(user).balanceOf(userAddress);
                const beforeProxyBalance = await USDT.connect(deployer).balanceOf(omnichainSwapProxyAddress);

                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, _usdt, userAddress, crossAmount, 8453, 56, txHashBytes);

                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 56,
                    txHash: txHashBytes,
                    routerCalldata: "0x",
                    signatures: signatures
                })).to.be.not.reverted
                const afterUserBalance = await USDT.connect(user).balanceOf(userAddress);
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeProxyBalance - afterProxyBalance).eq(crossAmount)
                expect(afterUserBalance - beforeUserBalance).eq(crossAmount)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('Get correct variable if crossChainSwapToByProtocol meme token success when swap failed, refund usdt back to proxy', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });
                const whaleSigner = await ethers.getSigner(bscBigHolder);
                const usdtContractWithWhale = USDT.connect(whaleSigner);
                const tx = await usdtContractWithWhale.transfer(omnichainSwapProxyAddress, ethers.parseEther("10000"));
                await tx.wait();

                const memeToken = "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" //SKYAI token
                const MEME = IERC20__factory.connect(memeToken)

                const v3Tokens = [_usdt, memeToken]
                planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
                    MSG_SENDER,
                    crossAmount,
                    MAX_UINT256,
                    encodePathExactInput(v3Tokens, FeeAmount.LOWEST),
                    SOURCE_ROUTER,
                ])
                const { commands, inputs } = planner
                const functionSelector = ethers.id('execute(bytes,bytes[])').slice(0, 10);
                const encodedParams = abiCoder.encode(['bytes', 'bytes[]'], [commands, inputs]);
                const data = functionSelector + encodedParams.slice(2);

                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, memeToken, userAddress, crossAmount, 8453, 56, txHashBytes);

                const beforeProxyBalance = await USDT.connect(deployer).balanceOf(omnichainSwapProxyAddress);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: memeToken,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 56,
                    txHash: txHashBytes,
                    routerCalldata: data,
                    signatures: signatures
                })).to.be.not.reverted
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeProxyBalance - afterProxyBalance).eq(0)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('Get correct variable if crossChainSwapToByProtocol meme token success when swap success', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });
                const whaleSigner = await ethers.getSigner(bscBigHolder);
                const usdtContractWithWhale = USDT.connect(whaleSigner);
                const tx = await usdtContractWithWhale.transfer(omnichainSwapProxyAddress, ethers.parseEther("10000"));
                await tx.wait();

                const memeToken = "0x92aa03137385F18539301349dcfC9EbC923fFb10" //SKYAI token
                const MEME = IERC20__factory.connect(memeToken)

                const v3Tokens = [_usdt, memeToken]
                planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
                    MSG_SENDER,
                    crossAmount,
                    0,
                    encodePathExactInput(v3Tokens, FeeAmount.LOW),
                    SOURCE_ROUTER,
                ])
                const { commands, inputs } = planner
                const functionSelector = ethers.id('execute(bytes,bytes[])').slice(0, 10);
                const encodedParams = abiCoder.encode(['bytes', 'bytes[]'], [commands, inputs]);
                const data = functionSelector + encodedParams.slice(2);

                const txHashHex = "0x742d35cc6ad4c3c76c85c4f1e7d4b4e1f8a8d2c3b4a5e6f7890123456789abcd"
                const txHashBytes = ethers.getBytes(txHashHex);
                const signatures = await buildCrossChainSwapToByProtocolSeparator(omnichainSwapProxyAddress, "OmnichainBridge", _usdt, memeToken, userAddress, crossAmount, 8453, 56, txHashBytes);

                const beforeProxyUSDTBalance = await USDT.connect(deployer).balanceOf(omnichainSwapProxyAddress);
                await expect(omnichainSwapProxyContract.connect(relayer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: memeToken,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    dstChainId: 56,
                    txHash: txHashBytes,
                    routerCalldata: data,
                    signatures: signatures
                })).to.be.not.reverted
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeProxyUSDTBalance - afterProxyBalance).eq(crossAmount)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('Get correct variable when withdraw token success', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });
                const whaleSigner = await ethers.getSigner(bscBigHolder);
                const usdtContractWithWhale = USDT.connect(whaleSigner);
                const tx = await usdtContractWithWhale.transfer(omnichainSwapProxyAddress, ethers.parseEther("10000"));
                await tx.wait();

                const beforeProxyUSDTBalance = await USDT.connect(deployer).balanceOf(omnichainSwapProxyAddress);
                const userUSDTBalance = await USDT.connect(deployer).balanceOf(userAddress);
                await expect(omnichainSwapProxyContract.connect(withdrawer).withdrawTokens(_usdt, userAddress, crossAmount)).to.be.not.reverted
                const afterUserUSDTBalance = await USDT.connect(user).balanceOf(userAddress);
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeProxyUSDTBalance - afterProxyBalance).eq(crossAmount)
                expect(afterUserUSDTBalance - userUSDTBalance).eq(crossAmount)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('Get correct variable when withdraw native token success', async function () {
                const tx = await user.sendTransaction({
                    to: omnichainSwapProxyAddress,
                    value: ethers.parseEther("2")
                })
                await tx.wait();
                const beforeProxyNativeBalance = await ethers.provider.getBalance(omnichainSwapProxyAddress);
                const beforeDeployerNativeBalance = await ethers.provider.getBalance(deployerAddress);
                console.log("beforeProxyNativeBalance: ", beforeProxyNativeBalance)
                console.log("beforeDeployerNativeBalance: ", beforeDeployerNativeBalance)
                await expect(omnichainSwapProxyContract.connect(withdrawer).withdrawEth(deployerAddress, ethers.parseEther("1"))).to.be.not.reverted
                const afterProxyNativeBalance = await ethers.provider.getBalance(omnichainSwapProxyAddress);
                const afterDeployerNativeBalance = await ethers.provider.getBalance(deployerAddress);
                console.log("afterProxyNativeBalance: ", afterProxyNativeBalance)
                console.log("afterDeployerNativeBalance: ", afterDeployerNativeBalance)
                expect(beforeProxyNativeBalance - afterProxyNativeBalance).eq(ethers.parseEther("1"))
            });
        })
    })
})