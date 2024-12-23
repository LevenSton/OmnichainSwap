/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  const omnichainSwapProxy = "0x0Ea45E0D4989BaC7610A795E7645839Cd052cD5A";
  // const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).removeSigner(deployer.address);
  // await tx.wait();
  // console.log("Signer removed");

  // const newSigner = "0x19D1eC071E24479223e9432389694fbC242102A4"
  // const tx1 = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).addSigner(newSigner);
  // await tx1.wait();
  // console.log("addSigner");
  console.log(await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).signers(0));
  console.log(await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).signers(1));

}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['ChangeSigner']

export default deployFn
