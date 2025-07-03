import { validator1, validator2, validator3 } from '../__setup.spec';
import { FeeAmount, HARDHAT_CHAINID } from './constants';
import hre from 'hardhat';
import { splitSignature } from '@ethersproject/bytes';

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

const FEE_SIZE = 3

// v3
export function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length != fees.length + 1) {
    throw new Error('path/fee lengths do not match')
  }

  let encoded = '0x'
  for (let i = 0; i < fees.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2)
    // 3 byte encoding of the fee
    encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
  }
  // encode the final token
  encoded += path[path.length - 1].slice(2)

  return encoded.toLowerCase()
}

export function encodePathExactInput(tokens: string[], fee: FeeAmount) {
  return encodePath(tokens, new Array(tokens.length - 1).fill(fee))
}

export async function buildWithdrawTokenSeparator(
  bridgeAddress: string,
  name: string,
  token: string,
  to: string,
  amount: bigint,
): Promise<{ v: number; r: string; s: string }[]> {
  const msgParams = buildWithdrawTokenParams(bridgeAddress, name, token, to, amount);
  return await getSig(msgParams);
}


const buildWithdrawTokenParams = (
  bridgeAddress: string,
  name: string,
  token: string,
  to: string,
  amount: bigint,
) => ({
  types: {
    WithdrawToken: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  domain: {
    name: name,
    version: '1',
    chainId: getChainId(),
    verifyingContract: bridgeAddress,
  },
  value: {
    token: token,
    to: to,
    amount: amount,
  },
});

export async function buildRefundStableCoinSeparator(
  bridgeAddress: string,
  name: string,
  token: string,
  to: string,
  amount: bigint,
  txHash: Uint8Array,
): Promise<{ v: number; r: string; s: string }[]> {
  const msgParams = buildRefundStableCoinParams(bridgeAddress, name, token, to, amount, txHash);
  return await getSig(msgParams);
}

const buildRefundStableCoinParams = (
  bridgeAddress: string,
  name: string,
  token: string,
  to: string,
  amount: bigint,
  txHash: Uint8Array,
) => ({
  types: {
    RefundStableCoin: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'txHash', type: 'bytes' },
    ],
  },
  domain: {
    name: name,
    version: '1',
    chainId: getChainId(),
    verifyingContract: bridgeAddress,
  },
  value: {
    token: token,
    to: to,
    amount: amount,
    txHash: txHash,
  },
});

export async function buildCrossChainSwapToByProtocolSeparator(
  bridgeAddress: string,
  name: string,
  srcToken: string,
  dstToken: string,
  to: string,
  amount: bigint,
  fromChainId: number,
  dstChainId: number,
  txHash: Uint8Array,
): Promise<{ v: number; r: string; s: string }[]> {
  const msgParams = buildCrossChainSwapToByProtocolParams(bridgeAddress, name, srcToken, dstToken, to, amount, fromChainId, dstChainId, txHash);
  return await getSig(msgParams);
}


const buildCrossChainSwapToByProtocolParams = (
  bridgeAddress: string,
  name: string,
  srcToken: string,
  dstToken: string,
  to: string,
  amount: bigint,
  fromChainId: number,
  dstChainId: number,
  txHash: Uint8Array,
) => ({
  types: {
    CrossChainSwapByProtocol: [
      { name: 'srcToken', type: 'address' },
      { name: 'dstToken', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'fromChainId', type: 'uint256' },
      { name: 'dstChainId', type: 'uint256' },
      { name: 'txHash', type: 'bytes' },
    ],
  },
  domain: {
    name: name,
    version: '1',
    chainId: getChainId(),
    verifyingContract: bridgeAddress,
  },
  value: {
    srcToken: srcToken,
    dstToken: dstToken,
    to: to,
    amount: amount,
    fromChainId: fromChainId,
    dstChainId: dstChainId,
    txHash: txHash,
  },
});

async function getSig(msgParams: {
  domain: any;
  types: any;
  value: any;
}): Promise<{ v: number; r: string; s: string }[]> {
  const sig1 = await validator1.signTypedData(msgParams.domain, msgParams.types, msgParams.value);
  const { v, r, s } = splitSignature(sig1);
  const sig2 = await validator2.signTypedData(msgParams.domain, msgParams.types, msgParams.value);
  const { v: v2, r: r2, s: s2 } = splitSignature(sig2);
  const sig3 = await validator3.signTypedData(msgParams.domain, msgParams.types, msgParams.value);
  const { v: v3, r: r3, s: s3 } = splitSignature(sig3);
  const signatures = [{ v, r, s }, { v: v2, r: r2, s: s2 }, { v: v3, r: r3, s: s3 }];

  return signatures;
}