/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  // BSC Proxy: 0x8aab583A03578d20F615f2DE2366b6b475040A24
  // Base Proxy: 0x7645f840A483721B4a48dC1D97566AE87DF0A612
  const omnichainSwapProxy = "";
  const safeAddr = "";
  const currentOwner = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).owner();
  console.log("Current owner:", currentOwner);

  const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).transferOwnership(safeAddr);
  await tx.wait();

  const newOwner = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).owner();
  console.log("New owner:", newOwner);

  console.log("Ownership transferred to Safe");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['SetWhitelist']

export default deployFn
