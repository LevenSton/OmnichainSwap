/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  // BSC Proxy: 0x8aab583A03578d20F615f2DE2366b6b475040A24
  // Base Proxy: 0x7645f840A483721B4a48dC1D97566AE87DF0A612
  const omnichainSwapProxy = "";
  const newRelayer = "";
  // BASE USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  const stableCoin = "";
  const amount = ethers.parseUnits("1000", 6);
  const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setRelayerApprovalAmount(newRelayer, stableCoin, amount);
  await tx.wait();
  console.log("RelayerApprovalAmount set");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['SetRelayerApprovalAmount']

export default deployFn
