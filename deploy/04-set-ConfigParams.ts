/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';
import { OmnichainSwapProxy__factory } from '../typechain-types';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  // BSC Proxy: 0x8aab583A03578d20F615f2DE2366b6b475040A24
  // Base Proxy: 0x7645f840A483721B4a48dC1D97566AE87DF0A612
  const omnichainSwapProxy = "";
  //fill validators address here
  const validators = ["", "", ""];
  const isValids = true;
  // set validator
  const tx = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setValidator(validators, isValids);
  await tx.wait();
  console.log("SetValidator set");

  // set validator threshold
  const validatorThreshold = 2;
  const tx1 = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setValidatorThreshold(validatorThreshold);
  await tx1.wait();
  console.log("SetThreshold set");

  // set whitelist tokens
  const refundStableCoinThreshold = ethers.parseUnits("10000", 6);
  const tx2 = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setRefundStableCoinThreshold(refundStableCoinThreshold);
  await tx2.wait();
  console.log("SetRefundStableCoinThreshold set");

  // set whitelist dst chain ids
  //fill whitelist dst chain ids here
  const whitelistDstChainIds = [56, 1, 195];
  const whitelisted = true;
  const tx3 = await OmnichainSwapProxy__factory.connect(omnichainSwapProxy, deployer).setWhitelistDstChainId(whitelistDstChainIds, whitelisted);
  await tx3.wait();
  console.log("SetWhitelistDstChainId set");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['SetConfigParams']

export default deployFn
