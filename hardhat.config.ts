import dotenv from 'dotenv';
import hardhatIgnition from '@nomicfoundation/hardhat-ignition';
import hardhatVerify from '@nomicfoundation/hardhat-verify';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';

dotenv.config();

/** @type {import('hardhat/types').HardhatUserConfig} */
const config = {
  plugins: [hardhatIgnition, hardhatVerify, hardhatEthers],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "shanghai",
    },
  },

  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },

    baseSepolia: {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },

    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Exclude LiquidationHook from compilation if it causes issues
  // It can be compiled separately with Foundry which handles @uniswap imports better
  // To compile it: forge build --contracts contracts/hooks/LiquidationHook.sol
};

export default config;
