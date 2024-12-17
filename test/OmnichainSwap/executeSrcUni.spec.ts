import { expect } from 'chai';
import {
    makeSuiteCleanRoom,
    user,
    deployer,
    omnichainSwapProxyContract,
    mockTokenAddress,
    dstTokenAddress,
    dstChainId,
    abiCoder,
    mockToken,
    userAddress,
    omnichainSwapProxyAddress,
    _weth,
    _usdt,
    oneHourLater
} from '../__setup.spec';
import { ERRORS } from '../helpers/errors';
import { ethers } from 'hardhat';
import { MAX_UINT256, SOURCE_MSG_SENDER } from '../helpers/constants';
import { CommandType, RoutePlanner } from '../helpers/planner';
import { MockToken__factory } from '../../typechain-types';

makeSuiteCleanRoom('Execute OmnichainSwap ', function () {
    context('Generic', function () {
        const mintMockAmount = ethers.parseEther("1000000");
        let planner: RoutePlanner

        beforeEach(async function () {
            planner = new RoutePlanner()
        });

        context('Negatives', function () {
            it('User should fail to executeSrcUni if emergePause.',   async function () {
                await expect(omnichainSwapProxyContract.connect(deployer).emergePause()).to.be.not.reverted;
                await expect(omnichainSwapProxyContract.connect(user).executeSrcUniByUser(mockTokenAddress, dstTokenAddress, dstChainId, 1000, "0x00")).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.EnforcedPause);
            });
        })

        context('Scenarios', function () {
            it('Get correct variable if executeSrcUni success', async function () {
                await expect(mockToken.connect(user).mint(userAddress, mintMockAmount)).to.be.not.reverted;
                await expect(mockToken.connect(user).approve(omnichainSwapProxyAddress, MAX_UINT256)).to.be.not.reverted;
                planner.addCommand(CommandType.V2_SWAP_EXACT_IN, [
                    omnichainSwapProxyAddress,
                    mintMockAmount,
                    0,
                    [mockTokenAddress, _weth, _usdt],
                    SOURCE_MSG_SENDER,
                ])
                const { commands, inputs } = planner

                const functionSelector = ethers.id('execute(bytes,bytes[],uint256)').slice(0, 10);
                // const param1 = '0x00'
                // const param2 = abiCoder.encode(['address', 'uint256', 'uint256', 'bytes', 'bool'], [omnichainSwapProxyAddress, mintMockAmount, 0, '0x00', false]);
                //const param2 = ['0x00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000004aa44a1e6bc873a7000000000000000000000000000000000000000000000000094ddda4186ee4d400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002b2816a491dd0b7a88d84cbded842a618e590168880027104200000000000000000000000000000000000006000000000000000000000000000000000000000000']
                //const param3 = 1721535251
                const beforeSrcTokenBalance = await mockToken.balanceOf(omnichainSwapProxyAddress);
                const beforeUsdtTokenBalance = await MockToken__factory.connect(_usdt, user).balanceOf(omnichainSwapProxyAddress);
                const encodedParams = abiCoder.encode(['bytes', 'bytes[]', 'uint256'], [commands, inputs, oneHourLater]);
                const data = functionSelector + encodedParams.slice(2);
                await expect(omnichainSwapProxyContract.connect(user).executeSrcUniByUser(mockTokenAddress, dstTokenAddress, dstChainId, mintMockAmount, data)).to.be.not.reverted;
                const afterSrcTokenBalance = await mockToken.balanceOf(omnichainSwapProxyAddress);
                const afterUsdtTokenBalance = await MockToken__factory.connect(_usdt, user).balanceOf(omnichainSwapProxyAddress);
                expect(afterSrcTokenBalance).to.be.equal(beforeSrcTokenBalance);
                expect(afterUsdtTokenBalance).to.be.greaterThan(beforeUsdtTokenBalance);

            });
        })
    })
})