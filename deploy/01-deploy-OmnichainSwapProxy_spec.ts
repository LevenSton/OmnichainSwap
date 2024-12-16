/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  const _universalRouter = "0x5648CFdFF4b6519D6aE8Bb08A0179b3e588fCAa0"
  const _usdt = "0x55d398326f99059fF775485246999027B3197955"
  const _weth9 = "0x55d398326f99059fF775485246999027B3197955"
  const _initialOwner = deployer.address
  const _signers = [deployer.address]
  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");

  const proxy = await upgrades.deployProxy(OmnichainSwapProxy, [_universalRouter, _usdt, _weth9, _initialOwner, _signers]);
  await proxy.waitForDeployment()
  
  const proxyAddress = await proxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['DeployOmnichainSwapProxy']

export default deployFn
