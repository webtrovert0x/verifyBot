require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: __dirname + "/.env" });
require("dotenv").config({ path: __dirname + "/../.env.local" });

const rawKey = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.trim() : "";
const formattedKey =
  rawKey && rawKey !== "your_private_key_here"
    ? rawKey.startsWith("0x")
      ? rawKey
      : `0x${rawKey}`
    : null;

const accounts = formattedKey ? [formattedKey] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    bohr: {
      url: process.env.RPC_URL || "https://rpc.bohr.life",
      chainId: 968,
      accounts: accounts,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      bohr: "empty",
    },
    customChains: [
      {
        network: "bohr",
        chainId: 968,
        urls: {
          apiURL: "https://scan.bohr.life/api",
          browserURL: "https://scan.bohr.life",
        },
      },
    ],
  },
};
