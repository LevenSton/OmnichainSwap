import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from 'dotenv'
import 'hardhat-deploy'
dotenv.config()

const deployer = process.env.DEPLOY_PRIVATE_KEY || '0x' + '11'.repeat(32)
const BASE_BLOCK_EXPLORER_KEY = process.env.BASE_BLOCK_EXPLORER_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.28',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://bnb-mainnet.g.alchemy.com/v2/ANAxZRbw8c4K6cGKOLRvJZqpWF0_jYtZ",
        blockNumber: 49588702,
      },
      gas: 16000000,
      accounts: [
        {
          privateKey: "0xadfb1c6c11c4c8cd7c6c0592344759ced4fd7c8486a048de52a8e8d3877a67f9", // 这是一个测试私钥，实际使用请替换
          balance: "10000000000000000000" // 10 BNB (以 wei 为单位)
        },
        {
          privateKey: "0x4e75d4cc93e17ad494e22b5df726661af328d2bcc11ace1490189580d555a7e9", // 这是一个测试私钥，实际使用请替换
          balance: "10000000000000000000" // 10 BNB (以 wei 为单位)
        }
      ]
    },
    linea_testnet: {
      chainId: 59140,
      url: process.env.LINEA_TEST_RPC_URL || '',
      accounts: [deployer],
      gasPrice: 2000000000,
      gas: 2000000,
    },
    linea_mainnet: {
      chainId: 59144,
      url: process.env.LINEA_RPC_URL || '',
      accounts: [deployer],
      gasPrice: 2000000000,
      gas: 2000000,
    },
    baseMain: {
      chainId: 8453,
      url: process.env.BASE_MAIN_RPC_URL || '',
      accounts: [deployer],
    },
    baseSepolia: {
      chainId: 84532,
      url: process.env.BASE_TEST_RPC_URL || '',
      accounts: [deployer],
    },
    bsc: {
      chainId: 56,
      url: process.env.BSC_MAINNET_RPC_URL || '',
      accounts: [deployer],
    },
  },
  paths: {
    deploy: './deploy',
    deployments: './deployments',
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    governance: {
      default: 1,
    }
  },
  etherscan: {
    apiKey: {
      baseSepolia: BASE_BLOCK_EXPLORER_KEY,
      baseMainnet: BASE_BLOCK_EXPLORER_KEY,
    },
    customChains: [
      {
        network: "baseMainnet",
        chainId: 8453,
        urls: {
         apiURL: "https://api.basescan.org/api",
         browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
         apiURL: "https://api-sepolia.basescan.org/api",
         browserURL: "https://sepolia.basescan.org/"
        }
      }
    ]
  },
};

export default config;