/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();

  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");
  const relayer = ''
  const tomoRouter = '0x7AB2646211348736A825E289F9EDA06FCA603DE6'
  const tomoProtocol = '0xBDE814EBD17A0B25C39EE16A8B2FF48D1628E503'

  const proxy = await upgrades.deployProxy(OmnichainSwapProxy, [deployer.address, relayer, tomoRouter]);
  await proxy.waitForDeployment()
  
  const proxyAddress = await proxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['DeployOmnichainSwapProxy']

export default deployFn
