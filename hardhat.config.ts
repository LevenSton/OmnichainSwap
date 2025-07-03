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
        url: "https://bsc-mainnet.infura.io/v3/0f1c366f33a745f5800681a33a66de3b",
        blockNumber: 52711980,
      },
      gas: 16000000,
      accounts: [
        {
          privateKey: "0xadfb1c6c11c4c8cd7c6c0592344759ced4fd7c8486a048de52a8e8d3877a67f9",
          balance: "10000000000000000000"
        },
        {
          privateKey: "0x4e75d4cc93e17ad494e22b5df726661af328d2bcc11ace1490189580d555a7e9",
          balance: "10000000000000000000"
        },{
          privateKey: "0xfde473ee81e04fb8203832f0e6c4985c198b2d3af7a1c49c7cd622f1fb37e9f1",
          balance: "10000000000000000000"
        },
        {
          privateKey: "0xcee688d50af91b4d0cbcdaa2b1c51b52ebea0b93ef46a4b44e01f01529164701",
          balance: "10000000000000000000"
        },{
          privateKey: "0xeec2a89fd689202fcdb0adf8af79065abdda43c9713e65d8f5bab57d9df7d1e7",
          balance: "10000000000000000000"
        },
        {
          privateKey: "0x11462f912c7b36c8b66521910ae7de7f1ed2521d392622d26dc6445b51adcfd7",
          balance: "10000000000000000000"
        },{
          privateKey: "0xd7d07404461652f356132980294d3e58edba705f976b3309035908af31111946",
          balance: "10000000000000000000"
        },
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