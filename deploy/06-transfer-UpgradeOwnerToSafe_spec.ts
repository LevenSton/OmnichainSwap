/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'

import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {

  const proxyAddr = ""
  const safeAddr = ""

  console.log("Proxy address:", proxyAddr);
  console.log("Safe address:", safeAddr);
  
  const currentAdmin = await upgrades.erc1967.getAdminAddress(proxyAddr);
  console.log("Current admin address:", currentAdmin);

  const proxyAdminABI = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner) external"
  ];
  const proxyAdmin = new ethers.Contract(currentAdmin, proxyAdminABI, hre.ethers.provider);
  const currentOwner = await proxyAdmin.owner();
  console.log("Current upgrade owner:", currentOwner);
  
  //await upgrades.admin.transferProxyAdminOwnership(proxyAddr, safeAddr);

  const newOwner = await proxyAdmin.owner();
  console.log("New upgrade owner:", newOwner);
  
  console.log("Proxy admin ownership transferred to Safe!");
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['TransferUpgradeOwnerToSafe']

export default deployFn