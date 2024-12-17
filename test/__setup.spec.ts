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

export let currentTimestamp = parseInt((new Date().getTime() / 1000 ).toFixed(0))

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

  mockToken = await new MockToken__factory(deployer).deploy();
  mockTokenAddress = await mockToken.getAddress();

  const _universalRouter = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
  const _usdt = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  const _weth = "0x4200000000000000000000000000000000000006"

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");
  const omnichainSwapProxy = await upgrades.deployProxy(OmnichainSwapProxy, [_universalRouter, _usdt, _weth, deployerAddress, [signer1Address, signer2Address]]);
  const proxyAddress = await omnichainSwapProxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))

  omnichainSwapProxyContract = OmnichainSwapProxy__factory.connect(proxyAddress)
  omnichainSwapProxyAddress = await omnichainSwapProxyContract.getAddress();

  await expect(omnichainSwapProxyContract.connect(user).rescueTokens(_usdt)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).rescueEth()).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);

  //create univ3 and v2 pool
  const nonfungiblePositionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"
  const uniRouterV2 = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"
  await expect(mockToken.connect(deployer).mint(deployerAddress, mintAmount)).to.be.not.reverted;
  await expect(mockToken.connect(deployer).approve(nonfungiblePositionManagerAddress, MAX_UINT256)).to.be.not.reverted;
  await expect(mockToken.connect(deployer).approve(uniRouterV2, MAX_UINT256)).to.be.not.reverted;

  console.log("balance: ", ethers.formatEther(await mockToken.balanceOf(deployerAddress)))

  await IUniswapV2Router02__factory.connect(uniRouterV2, deployer).addLiquidityETH(mockTokenAddress, mintAmount / BigInt(2), 0, 0, deployerAddress, currentTimestamp + 10, { value: ethers.parseEther("100") });
  console.log("balance: ", ethers.formatEther(await mockToken.balanceOf(deployerAddress)))
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
  console.log("token0: ", token0)
  console.log("token1: ", token1)
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
  console.log("balance: ", ethers.formatEther(await mockToken.balanceOf(deployerAddress)))
});
