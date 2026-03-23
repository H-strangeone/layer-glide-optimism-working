require("@nomicfoundation/hardhat-toolbox");
const path = require('path');
<<<<<<< HEAD
require('dotenv').config(); // loads root .env
=======

>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
// Get environment variables for API keys and private keys
// If running on local machine, you need to:
// 1. Create a .env file in the project root
// 2. Add ALCHEMY_API_KEY and PRIVATE_KEY to it
// 3. Install dotenv: npm install dotenv
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Ensure private key starts with 0x
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY?.startsWith("0x")
  ? process.env.PRIVATE_KEY
  : `0x${process.env.PRIVATE_KEY}`;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || ""
  }
};
