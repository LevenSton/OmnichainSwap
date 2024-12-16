import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from 'dotenv'
import 'hardhat-deploy'
dotenv.config()

const deployer = process.env.DEPLOY_PRIVATE_KEY || '0x' + '11'.repeat(32)
const governance = process.env.GOVERNANCE_PRIVATE_KEY || '0x' + '11'.repeat(32)
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
        url: "https://base-mainnet.g.alchemy.com/v2/4Iv_6-FcdIG3mzg0rr2Bk2r0ti5jl3vB",
        blockNumber: 23204970,
      },
      gas: 16000000,
    },
    linea_testnet: {
      chainId: 59140,
      url: process.env.LINEA_TEST_RPC_URL || '',
      accounts: [deployer, governance],
      gasPrice: 2000000000,
      gas: 2000000,
    },
    linea_mainnet: {
      chainId: 59144,
      url: process.env.LINEA_RPC_URL || '',
      accounts: [deployer, governance],
      gasPrice: 2000000000,
      gas: 2000000,
    },
    baseMain: {
      chainId: 8453,
      url: process.env.BASE_MAIN_RPC_URL || '',
      accounts: [deployer, governance],
    },
    baseSepolia: {
      chainId: 84532,
      url: process.env.BASE_TEST_RPC_URL || '',
      accounts: [deployer, governance],
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