/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  console.log("deployer address: ", deployer.address)

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");
  //bsc router address: 0xcF74F56112f260DdEe729753553FbD18509DEF8F
  //base router address: 0x7947e5f78E78190eE2d62E36F04Ca008C7b69Afd
  const tomoRouter = ''

  const proxy = await upgrades.deployProxy(OmnichainSwapProxy, [deployer.address, deployer.address, tomoRouter]);
  await proxy.waitForDeployment()
  
  const proxyAddress = await proxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['DeployOmnichainSwapProxy']

export default deployFn
