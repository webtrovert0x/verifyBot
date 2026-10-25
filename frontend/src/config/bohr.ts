import { defineChain } from "viem";

export const bohrTestnet = defineChain({
  id: 968,
  name: "Bohr Chain",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.bohr.life"],
    },
  },
  blockExplorers: {
    default: {
      name: "BohrScan",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://scan.bohr.life",
    },
  },
  testnet: true,
});
