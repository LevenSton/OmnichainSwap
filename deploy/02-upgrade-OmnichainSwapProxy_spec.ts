/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'

import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");

  const proxyAddr = "0x0Ea45E0D4989BaC7610A795E7645839Cd052cD5A"
  const proxy = await upgrades.upgradeProxy(proxyAddr, OmnichainSwapProxy);
  await proxy.waitForDeployment()

  const proxyAddress = await proxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['UpgradeOmnichainSwapProxy']

export default deployFn