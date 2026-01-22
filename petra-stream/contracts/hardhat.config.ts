import "dotenv/config";
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    shannon: {
      url: process.env.SOMNIA_RPC_URL || process.env.SOMNIA_TEST_HTTP || "https://your-somnia-rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 50312 // Somnia testnet chainId (update if yours differs)
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || ""
  },
  paths: {
    sources: "./contracts",       // where your Solidity files are
    tests: "./contracts/test",    // 👈 tells Hardhat your tests live here
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;
