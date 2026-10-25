import type { Metadata } from "next";
import "./globals.css";
import Web3Provider from "@/context/Web3Provider";

export const metadata: Metadata = {
  title: "VerifyBOT | Smart Contract Risk Analyzer on BOT Chain",
  description:
    "Investigate BOT Chain smart contracts for ownership risks, proxy upgradeability, privileged functions, and cryptographic on-chain verification.",
  keywords: [
    "VerifyBOT",
    "Bohr",
    "BOT Chain",
    "Smart Contract Audit",
    "Risk Analyzer",
    "Security Scanner",
    "DeFi Security",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
