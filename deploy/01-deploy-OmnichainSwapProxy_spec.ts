/* Imports: Internal */
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers, upgrades } from 'hardhat';

const deployFn: DeployFunction = async (hre) => {
  const [deployer] = await ethers.getSigners();
  
  // base "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"
  // bnb "0x4Dae2f939ACf50408e13d58534Ff8c2776d45265"
  // const _universalRouter = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"

  // base USDC "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  // BNB USD "0x55d398326f99059fF775485246999027B3197955"
  // const _usdt = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

  // bsc WETH "0x4200000000000000000000000000000000000006"
  // BNB WBNB "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
  // const _weth9 = "0x4200000000000000000000000000000000000006"

  // const _permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"
  // const _initialOwner = deployer.address
  // const _signers = ["0x19D1eC071E24479223e9432389694fbC242102A4"]
  const OmnichainSwapProxy = await ethers.getContractFactory("OmnichainSwapProxy");
  const relayer = '0x71e0ed0b9ca04eb987d3ab26fa60d1d53440326b'

  const proxy = await upgrades.deployProxy(OmnichainSwapProxy, [relayer]);
  await proxy.waitForDeployment()
  
  const proxyAddress = await proxy.getAddress()
  console.log("proxy address: ", proxyAddress)
  console.log("admin address: ", await upgrades.erc1967.getAdminAddress(proxyAddress))
  console.log("implement address: ", await upgrades.erc1967.getImplementationAddress(proxyAddress))
}

// This is kept during an upgrade. So no upgrade tag.
deployFn.tags = ['DeployOmnichainSwapProxy']

export default deployFn
