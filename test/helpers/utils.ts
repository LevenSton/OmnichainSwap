import { HARDHAT_CHAINID } from './constants';
import hre from 'hardhat';

export function getChainId(): number {
  return hre.network.config.chainId || HARDHAT_CHAINID;
}

let snapshotId: string = '0x1';
export async function takeSnapshot() {
  snapshotId = await hre.ethers.provider.send('evm_snapshot', []);
}

export async function revertToSnapshot() {
  await hre.ethers.provider.send('evm_revert', [snapshotId]);
}