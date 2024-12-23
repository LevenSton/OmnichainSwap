import { expect } from 'chai';
import { AbiCoder, Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import {
  revertToSnapshot,
  takeSnapshot,
} from './helpers/utils';
import { ERRORS } from './helpers/errors';
import { INonfungiblePositionManager__factory, IUniswapV2Router02__factory, MockToken, MockToken__factory, OmnichainSwapProxy, OmnichainSwapProxy__factory } from '../typechain-types';
import { MAX_UINT256 } from './helpers/constants';

export let accounts: Signer[];
export let deployer: Signer;
export let signer1: Signer;
export let signer2: Signer;
export let user: Signer;
export let deployerAddress: string;
export let signer1Address: string;
export let signer2Address: string;
export let userAddress: string;
export let mockToken: MockToken;
export let mockTokenAddress: string;
export let omnichainSwapProxyAddress: string;
export let abiCoder: AbiCoder;
export let omnichainSwapProxyContract: OmnichainSwapProxy;
export let mintAmount = ethers.parseEther("200000000");
export let currentTimestamp = parseInt((new Date().getTime() / 1000).toFixed(0))
export let oneHourLater = parseInt((new Date().getTime() / 1000).toFixed(0)) + 60*60

export let dstTokenAddress: string;
export let dstChainId: number;
export let _universalRouter: string;
export let _usdt: string;
export let _weth: string;
export let _permit2: string;

export function makeSuiteCleanRoom(name: string, tests: () => void) {
  describe(name, () => {
    beforeEach(async function () {
      await takeSnapshot();
    });
    tests();
    afterEach(async function () {
      await revertToSnapshot();
    });
  });
}

before(async function () {
  abiCoder = ethers.AbiCoder.defaultAbiCoder();
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  signer1 = accounts[1];
  signer2 = accounts[2];
  user = accounts[3];
  
  deployerAddress = await deployer.getAddress();
  signer1Address = await signer1.getAddress();
  signer2Address = await signer2.getAddress();
  userAddress = await user.getAddress();

  dstChainId = 1; //ethereum
  let dstToken = "0xB8c77482e45F1F44dE1745F52C74426C631bDD52"
  dstTokenAddress = ethers.zeroPadValue(dstToken, 32),

  mockToken = await new MockToken__factory(deployer).deploy();
  mockTokenAddress = await mockToken.getAddress();

  _universalRouter = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
  _usdt = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  _weth = "0x4200000000000000000000000000000000000006"
  _permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");
  const omnichainSwapProxy = await upgrades.deployProxy(OmnichainSwapProxy, [_universalRouter, _usdt, _weth, _permit2, deployerAddress, [signer1Address, signer2Address]]);
  const proxyAddress = await omnichainSwapProxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))

  omnichainSwapProxyContract = OmnichainSwapProxy__factory.connect(proxyAddress)
  omnichainSwapProxyAddress = await omnichainSwapProxyContract.getAddress();

  await expect(omnichainSwapProxyContract.connect(user).rescueTokens(_usdt)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).rescueEth()).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).emergePause()).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).unPause()).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).addSigner(userAddress)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).removeSigner(userAddress)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);

  //create univ3 and v2 pool
  const nonfungiblePositionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"
  const uniRouterV2 = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"
  await expect(mockToken.connect(deployer).mint(deployerAddress, mintAmount)).to.be.not.reverted;
  await expect(mockToken.connect(deployer).approve(nonfungiblePositionManagerAddress, MAX_UINT256)).to.be.not.reverted;
  await expect(mockToken.connect(deployer).approve(uniRouterV2, MAX_UINT256)).to.be.not.reverted;

  await IUniswapV2Router02__factory.connect(uniRouterV2, deployer).addLiquidityETH(mockTokenAddress, mintAmount / BigInt(2), 0, 0, deployerAddress, currentTimestamp + 10, { value: ethers.parseEther("100") });

  // 100000000 = 100 eth initial price for v3 pool
  const sqrtPriceX96 = BigInt("79228162514264337593543950")
  const sqrtPriceB96 = BigInt("79228162514264337593543950336000")
  let token0;
  let token1;
  let price;
  let amount0Desired;
  let amount1Desired;
  if (mockTokenAddress < _weth) {
    token0 = mockTokenAddress;
    token1 = _weth;
    price = sqrtPriceX96;
    amount0Desired = mintAmount / BigInt(2);
    amount1Desired = ethers.parseEther("100");
  } else { 
    token0 = _weth;
    token1 = mockTokenAddress;
    price = sqrtPriceB96;
    amount0Desired = ethers.parseEther("100");
    amount1Desired = mintAmount / BigInt(2);
  }
  await INonfungiblePositionManager__factory.connect(nonfungiblePositionManagerAddress, deployer).createAndInitializePoolIfNecessary(token0, token1, 10000, price);
  await INonfungiblePositionManager__factory.connect(nonfungiblePositionManagerAddress, deployer).mint({
    token0: token0,
    token1: token1,
    fee: 10000,
    tickLower: -887200,
    tickUpper: 887200,
    amount0Desired: amount0Desired,
    amount1Desired: amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployerAddress,
    deadline: currentTimestamp + 10
  }, { value: ethers.parseEther("100") });

  // const functionSelector = ethers.id('execute(bytes,bytes[],uint256)').slice(0, 10); // 取前4字节
  // const param1 = '0x0a00060c'
  // const param2 = ['0x0000000000000000000000002816a491dd0b7a88d84cbded842a618e59016888000000000000000000000000ffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000066c416e800000000000000000000000000000000000000000000000000000000000000000000000000000000000000003fc91a3afd70395cd496c647d5a6cc9d4b2b7fad00000000000000000000000000000000000000000000000000000000669c90f000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000041e43ad7ce4e9b8dff16bfae6160cb5248bce91582b57c646c9b8df77f6160a08176a329cbfae8d29edac3d934a4e706ac648b852d1f6d3c98c18af8c6ecfb8a261c00000000000000000000000000000000000000000000000000000000000000', '0x00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000004aa44a1e6bc873a7000000000000000000000000000000000000000000000000094ddda4186ee4d400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002b2816a491dd0b7a88d84cbded842a618e590168880027104200000000000000000000000000000000000006000000000000000000000000000000000000000000', '0x00000000000000000000000042000000000000000000000000000000000000060000000000000000000000005d64d14d2cf4fe5fe4e65b1c7e3d11e18d4930910000000000000000000000000000000000000000000000000000000000000019', '0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000094ddda4186ee4d4']
  // const param3 = 1721535251
  // const encodedParams = abiCoder.encode(['bytes', 'bytes[]', 'uint256'], [param1, param2, param3]);
  // const data2 = functionSelector + encodedParams.slice(2); // 去掉 0x
  // console.log("data2: ", data2)
});
