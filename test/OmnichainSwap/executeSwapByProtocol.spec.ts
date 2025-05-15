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
    _native
} from '../__setup.spec';
import { ERRORS } from '../helpers/errors';
import { ethers, network } from 'hardhat';
import { FeeAmount, MAX_UINT256, MSG_SENDER, SOURCE_ROUTER, ZERO_ADDRESS } from '../helpers/constants';
import { CommandType, RoutePlanner } from '../helpers/planner';
import { ERC20__factory, IUniversalRouter__factory } from '../../typechain-types';
import { encodePathExactInput } from '../helpers/utils';

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
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotRelayer);
            });
            it('Should fail to crossChainSwapToByProtocol if emergePause.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).emergePause()).to.be.not.reverted;
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.EnforcedPause);
            });
            it('Should fail to crossChainSwapToByProtocol if not whitelist token.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: nowWhitelistERC20Token,
                    dstToken: nowWhitelistERC20Token,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotWhitelistedToken);
            });
            it('Should fail to crossChainSwapToByProtocol if invliad to.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: ZERO_ADDRESS,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if invliad chainid.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 31337,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if invliad amount.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: 0,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if invalid params.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0xa234",
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('Should fail to crossChainSwapToByProtocol if not enough balance.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0x",
                })).to.be.reverted
            });
        })

        context('Scenarios', function () {
            it('Get correct variable if crossChainSwapToByProtocol stable token success', async function () {
                const USDT = ERC20__factory.connect(_usdt)
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
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: _usdt,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: "0x",
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
            it('Get correct variable if crossChainSwapToByProtocol meme token success when swap failed, refund usdt back to user', async function () {
                const USDT = ERC20__factory.connect(_usdt)
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
                const MEME = ERC20__factory.connect(memeToken)

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

                const beforeUserMEMEBalance = await MEME.connect(user).balanceOf(userAddress);
                const beforeUserUSDTBalance = await USDT.connect(deployer).balanceOf(userAddress);
                const beforeProxyBalance = await USDT.connect(deployer).balanceOf(omnichainSwapProxyAddress);
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: memeToken,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: data,
                })).to.be.not.reverted
                const afterUserMEMEBalance = await MEME.connect(user).balanceOf(userAddress);
                const afterUserUSDTBalance = await USDT.connect(user).balanceOf(userAddress);
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeProxyBalance - afterProxyBalance).eq(crossAmount)
                expect(afterUserUSDTBalance - beforeUserUSDTBalance).eq(crossAmount)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('Get correct variable if crossChainSwapToByProtocol meme token success when swap success', async function () {
                const USDT = ERC20__factory.connect(_usdt)
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
                const MEME = ERC20__factory.connect(memeToken)

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

                const beforeUserMEMEBalance = await MEME.connect(user).balanceOf(userAddress);
                const beforeUserUSDTBalance = await USDT.connect(deployer).balanceOf(userAddress);
                const beforeProxyUSDTBalance = await USDT.connect(deployer).balanceOf(omnichainSwapProxyAddress);
                await expect(omnichainSwapProxyContract.connect(deployer).crossChainSwapToByProtocol({
                    srcToken: _usdt,
                    dstToken: memeToken,
                    to: userAddress,
                    amount: crossAmount,
                    fromChainId: 8453,
                    txHash: ethers.zeroPadValue(userAddress, 32),
                    routerCalldata: data,
                })).to.be.not.reverted
                const afterUserMEMEBalance = await MEME.connect(user).balanceOf(userAddress);
                const afterUserUSDTBalance = await USDT.connect(user).balanceOf(userAddress);
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeProxyUSDTBalance - afterProxyBalance).eq(crossAmount)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('Get correct variable when withdraw token success', async function () {
                const USDT = ERC20__factory.connect(_usdt)
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
                await expect(omnichainSwapProxyContract.connect(deployer).withdrawTokens(_usdt, userAddress, crossAmount)).to.be.not.reverted
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
                await expect(omnichainSwapProxyContract.connect(deployer).withdrawEth(deployerAddress, ethers.parseEther("1"))).to.be.not.reverted
                const afterProxyNativeBalance = await ethers.provider.getBalance(omnichainSwapProxyAddress);
                const afterDeployerNativeBalance = await ethers.provider.getBalance(deployerAddress);
                console.log("afterProxyNativeBalance: ", afterProxyNativeBalance)
                console.log("afterDeployerNativeBalance: ", afterDeployerNativeBalance)
                expect(beforeProxyNativeBalance - afterProxyNativeBalance).eq(ethers.parseEther("1"))
            });
        })
    })
})