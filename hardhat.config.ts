import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

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
  }
};

export default config;
