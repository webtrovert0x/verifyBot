import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Allows user to define PROJECT_ID in .env.local without exposing 'NEXT_PUBLIC_' prefix in the file
    NEXT_PUBLIC_PROJECT_ID:
      process.env.PROJECT_ID ||
      process.env.REOWN_PROJECT_ID ||
      "d9690df1851903b53a4f8c440127edec",
    NEXT_PUBLIC_RPC_URL: process.env.RPC_URL || "https://rpc.botchain.ai",
    NEXT_PUBLIC_CHAIN_ID: process.env.CHAIN_ID || "677",
    NEXT_PUBLIC_EXPLORER_URL: process.env.EXPLORER_URL || "https://scan.botchain.ai",
    NEXT_PUBLIC_CONTRACT_ADDRESS:
      process.env.CONTRACT_ADDRESS || "0x9e785Ad3Bf508ff1119c62EbC7D7A7D06621f0DF",
  },
  serverExternalPackages: ["pino", "pino-pretty"],
  turbopack: {},
};

export default nextConfig;
