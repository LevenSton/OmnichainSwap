/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  //fill to address here
  const to = "";
  const omnichainSwapProxy = "";
  const token = "";
  const amount = ethers.parseUnits("176.525946", 6);
  const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).withdrawTokens(token, to, amount);
  await tx.wait();
  console.log("WithdrawToken set");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['WithdrawToken']

export default deployFn
