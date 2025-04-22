/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  const omnichainSwapProxy = "";
  const newRelayer = "";
  const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setRelayer(newRelayer);
  await tx.wait();
  console.log("Relayer set");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['ChangeRelayer']

export default deployFn
