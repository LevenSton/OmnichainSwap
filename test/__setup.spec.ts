import { expect } from 'chai';
import { AbiCoder, Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import {
  revertToSnapshot,
  takeSnapshot,
} from './helpers/utils';
import { ERRORS } from './helpers/errors';
import { OmnichainSwapProxy, OmnichainSwapProxy__factory } from '../typechain-types';
import { MAX_UINT256 } from './helpers/constants';

export let accounts: Signer[];
export let deployer: Signer;
export let user: Signer;
export let relayer: Signer;
export let withdrawer: Signer;
export let validator1: Signer;
export let validator2: Signer;
export let validator3: Signer;
export let deployerAddress: string;
export let userAddress: string;
export let relayerAddress: string;
export let withdrawerAddress: string;
export let validator1Address: string;
export let validator2Address: string;
export let validator3Address: string;
export let omnichainSwapProxyAddress: string;
export let abiCoder: AbiCoder;
export let omnichainSwapProxyContract: OmnichainSwapProxy;
export let mintAmount = ethers.parseEther("200000000");
export let currentTimestamp = parseInt((new Date().getTime() / 1000).toFixed(0))
export let oneHourLater = parseInt((new Date().getTime() / 1000).toFixed(0)) + 60*60

export let dstTokenAddress: string;
export let dstChainId: number;
export let _tomoSwapRouter: string;
export let _usdt: string;
export let _native: string;

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
  user = accounts[1];
  relayer = accounts[2];
  withdrawer = accounts[3];
  
  const signer3 = accounts[4];
  const signer4 = accounts[5];
  const signer5 = accounts[6];
  
  const address3 = await signer3.getAddress();
  const address4 = await signer4.getAddress();
  const address5 = await signer5.getAddress();
  
  // sort by address
  const signers = [
    { signer: signer3, address: address3 },
    { signer: signer4, address: address4 },
    { signer: signer5, address: address5 }
  ];
  
  signers.sort((a, b) => a.address.localeCompare(b.address));
  
  // assign to validator1, validator2, validator3
  validator1 = signers[0].signer;
  validator2 = signers[1].signer;
  validator3 = signers[2].signer;
  
  deployerAddress = await deployer.getAddress();
  userAddress = await user.getAddress();
  relayerAddress = await relayer.getAddress();
  withdrawerAddress = await withdrawer.getAddress();
  validator1Address = await validator1.getAddress();
  validator2Address = await validator2.getAddress();
  validator3Address = await validator3.getAddress();
  
  console.log("Validator addresses (sorted):");
  console.log("validator1:", validator1Address);
  console.log("validator2:", validator2Address);
  console.log("validator3:", validator3Address);
  
  _tomoSwapRouter = "0x1628d966d33b32f9a97ef7bB773546e363C19b26";
  _usdt = "0x55d398326f99059fF775485246999027B3197955"

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");
  const omnichainSwapProxy = await upgrades.deployProxy(OmnichainSwapProxy, [deployerAddress, deployerAddress, _tomoSwapRouter]);
  const proxyAddress = await omnichainSwapProxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))

  omnichainSwapProxyContract = OmnichainSwapProxy__factory.connect(proxyAddress)
  omnichainSwapProxyAddress = await omnichainSwapProxyContract.getAddress();
  console.log("omnichainSwapProxyAddress: ", omnichainSwapProxyAddress)

  await omnichainSwapProxyContract.connect(deployer).setValidator([validator1Address, validator2Address, validator3Address], true);
  await omnichainSwapProxyContract.connect(deployer).setValidatorThreshold(2);
  await omnichainSwapProxyContract.connect(deployer).setRelayerApprovalAmount(relayerAddress, _usdt, ethers.parseEther("1000000"));
  await omnichainSwapProxyContract.connect(deployer).setWithdrawer(withdrawerAddress);
  await omnichainSwapProxyContract.connect(deployer).setWhitelistDstChainId([8453], true);

  await expect(omnichainSwapProxyContract.connect(user).withdrawTokens(_usdt, userAddress, 1000)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotWithdrawer);
  await expect(omnichainSwapProxyContract.connect(user).withdrawEth(userAddress, 1000)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.NotWithdrawer);
  await expect(omnichainSwapProxyContract.connect(user).emergePause()).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).unPause()).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).setWhitelistToken(_usdt, true)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).setTomoRouter(_usdt)).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);
  await expect(omnichainSwapProxyContract.connect(user).setRelayerApprovalAmount(userAddress, _usdt, ethers.parseEther("1000000"))).to.be.revertedWithCustomError(omnichainSwapProxyContract, ERRORS.OwnableUnauthorizedAccount);

  const isUsdtWhitelist = await omnichainSwapProxyContract.connect(deployer).whitelistTokens(_usdt);
  expect(isUsdtWhitelist).to.be.equal(false);
  await expect(omnichainSwapProxyContract.connect(deployer).setWhitelistToken(_usdt, true)).to.be.not.reverted
  const afterIsUsdtWhitelist = await omnichainSwapProxyContract.connect(deployer).whitelistTokens(_usdt);
  expect(afterIsUsdtWhitelist).to.be.equal(true);
});
