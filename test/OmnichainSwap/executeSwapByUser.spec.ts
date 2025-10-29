import { expect } from 'chai';
import {
    makeSuiteCleanRoom,
    user,
    deployer,
    omnichainSwapProxyContract,
    userAddress,
    omnichainSwapProxyAddress,
    _usdt,
    deployerAddress,
    _native
} from '../__setup.spec';
import { ERRORS } from '../helpers/errors';
import { ethers, network } from 'hardhat';
import { BYTES32_ZERO_ADDRESS, MAX_UINT256 } from '../helpers/constants';
import { IERC20__factory } from '../../typechain-types';

makeSuiteCleanRoom('Execute OmnichainSwap crossChainSwapToByUser', function () {
    context('Generic', function () {
        const crossAmount = ethers.parseEther("1");
        const nowWhitelistERC20Token = '0x232a7a48d1dd946617d82fab36b46a30f69df4a3'

        context('Negatives', function () {
            it('User should fail to crossChainSwapToByUser if src token not whitelist.',   async function () {
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: nowWhitelistERC20Token,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 8453,
                    amount: crossAmount
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotWhitelistedToken);
            });
            it('User should fail to crossChainSwapToByUser if emergePause.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).emergePause()).to.be.not.reverted;
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: nowWhitelistERC20Token,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 8453,
                    amount: crossAmount
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.EnforcedPause);
            });
            it('Should fail to initialize again.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).initialize(deployerAddress, deployerAddress, deployerAddress)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidInitialization);
            });
            it('User should fail to crossChainSwapToByUser if invalide to.',   async function () {
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: _usdt,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(BYTES32_ZERO_ADDRESS, 32),
                    dstChainId: 8453,
                    amount: crossAmount
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('User should fail to crossChainSwapToByUser if invalide chainId.',   async function () {
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: _usdt,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 31337,
                    amount: crossAmount
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('User should fail to crossChainSwapToByUser if amount = 0',   async function () {
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: _usdt,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 8453,
                    amount: 0
                })).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.InvalidParam);
            });
            it('User should fail to crossChainSwapToByUser if not enough usdt balance', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });

                await expect(USDT.connect(user).approve(omnichainSwapProxyAddress, MAX_UINT256)).to.be.not.reverted;
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: _usdt,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 8453,
                    amount: crossAmount
                })).to.be.not.reverted;
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
            it('User should fail to crossChainSwapToByUser if not approve usdt', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });
                const whaleSigner = await ethers.getSigner(bscBigHolder);
                const usdtContractWithWhale = USDT.connect(whaleSigner);
                const tx = await usdtContractWithWhale.transfer(userAddress, ethers.parseEther("10000"));
                await tx.wait();
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: _usdt,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 8453,
                    amount: crossAmount
                })).to.be.reverted;
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
        })

        context('Scenarios', function () {
            it('Get correct variable if crossChainSwapToByUser usdt success', async function () {
                const USDT = IERC20__factory.connect(_usdt)
                const bscBigHolder = '0x4B14BdC6c1CFD2eC9E947c31E12b8Cf6d26E3E75'
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [bscBigHolder],
                });
                const whaleSigner = await ethers.getSigner(bscBigHolder);
                const usdtContractWithWhale = USDT.connect(whaleSigner);
                const tx = await usdtContractWithWhale.transfer(userAddress, ethers.parseEther("10000"));
                await tx.wait();

                await expect(USDT.connect(user).approve(omnichainSwapProxyAddress, MAX_UINT256)).to.be.not.reverted;
                const beforeUserBalance = await USDT.connect(user).balanceOf(userAddress);
                const beforeProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                await expect(omnichainSwapProxyContract.connect(user).crossChainSwapToByUser({
                    orderId: 1,
                    srcToken: _usdt,
                    dstToken: "0xa234",
                    to: ethers.zeroPadValue(userAddress, 32),
                    dstChainId: 8453,
                    amount: crossAmount
                })).to.be.not.reverted
                const afterUserBalance = await USDT.connect(user).balanceOf(userAddress);
                const afterProxyBalance = await USDT.connect(user).balanceOf(omnichainSwapProxyAddress);
                expect(beforeUserBalance - afterUserBalance).eq(crossAmount)
                expect(afterProxyBalance - beforeProxyBalance).eq(crossAmount)
                
                await network.provider.request({
                    method: "hardhat_stopImpersonatingAccount",
                    params: [bscBigHolder],
                });
            });
        })
    })
})