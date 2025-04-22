/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  const omnichainSwapProxy = "";
  const whitelistedToken = "";
  const whitelisted = true;
  const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setWhitelistToken(whitelistedToken, whitelisted);
  await tx.wait();
  console.log("Whitelist set");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['SetWhitelist']

export default deployFn
