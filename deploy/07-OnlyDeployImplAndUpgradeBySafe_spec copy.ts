/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'

import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {

  const [deployer] = await ethers.getSigners();
  console.log("deployer address: ", deployer.address)

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");

  const implAddress = await upgrades.deployImplementation(OmnichainSwapProxy);
  console.log("impl address: ", implAddress)
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['OnlyDeployImplAndUpgradeBySafe']

export default deployFn