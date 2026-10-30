<p align="center">
  <img src="./logo.jpg" alt="VerifyBOT Logo" width="280" style="border-radius: 20px; box-shadow: 0 0 35px rgba(0, 240, 255, 0.4);" />
</p>

# VerifyBOT — Smart Contract Risk Analyzer & On-Chain Audit Registry

VerifyBOT is a decentralized smart contract security intelligence tool for **Bohr Chain (BOT Chain)**. It empowers users, traders, and developers to investigate smart contracts for centralization backdoors, proxy mutability, privileged permissions, and honeypot traps before depositing funds.

---

## ⚡ Key Highlights

- **Gas-Only Economic Model**: Users pay zero protocol fees to VerifyBOT — only standard Bohr network gas.
- **On-Chain Audit Trail (`VerifyBOTRegistry.sol`)**:
  - `requestScan(address target)`: Commits scan requests on Bohr Chain.
  - `checkReport(address target)`: Submits an on-chain transaction before retrieving existing audits.
  - `publishReport(...)`: Commits cryptographic Keccak-256 hashes of audited reports.
- **Cryptographic Tamper-Proof Verification**:
  - The frontend computes the deterministic report hash client-side and matches it against the on-chain committed hash in the registry.
- **Comprehensive Risk Analysis Engine**:
  - 🔑 **Ownership Centralization**: Single-owner wallets, multi-sig vs EOA, renounced status.
  - 🔄 **Upgradeability & Proxies**: EIP-1967 implementation slots, admin slots, UUPS patterns, and low-level `DELEGATECALL` instructions.
  - 🛑 **Privileged Functions**: Token minting capabilities, trading pauses, wallet blacklisting, dynamic fee setters, and emergency withdraws.
  - 📜 **Source Code Verification**: Detects whether contract source code is verified on BohrScan or closed-source bytecode.
  - ⚠️ **Suspicious Patterns**: `SELFDESTRUCT` opcodes, honeypot transfer traps, and drain vectors.

---

## 🔗 Live BOT Chain Deployments

| Component | Network | Address / URL |
| :--- | :--- | :--- |
| **VerifyBOTRegistry** | BOT Chain Mainnet (Chain ID: `677`) | [`0x9e785Ad3Bf508ff1119c62EbC7D7A7D06621f0DF`](https://scan.botchain.ai/address/0x9e785Ad3Bf508ff1119c62EbC7D7A7D06621f0DF#code) |
| **BOT Chain RPC** | BOT Chain Mainnet | `https://rpc.botchain.ai` |
| **Native Token** | BOT | 18 Decimals |
| **BotScan Explorer** | BOT Chain Explorer | [https://scan.botchain.ai](https://scan.botchain.ai) |
| **Technical Whitepaper** | Documentation | [WHITEPAPER.md](./WHITEPAPER.md) |
| **Frontend Web App** | Local Dev | `http://localhost:3000` |

---

## 🔒 Security Disclaimer & Important Limitation

> **Important limitation**: A report hash proves that the displayed report matches the committed report in VerifyBOTRegistry. It does not prove that the report is accurate, and a clean scan cannot guarantee that a smart contract is safe. Always conduct independent due diligence before interacting with any DeFi protocol.

---

## 🛠 Project Structure

```
verifyBot/
├── WHITEPAPER.md                 # Complete technical whitepaper
├── logo.jpg                      # VerifyBOT brand emblem
├── standard_json_input.json      # Standard JSON input for BohrScan contract verification
├── VerifyBOTRegistry_flattened.sol # Flattened single-file contract
├── contracts/
│   ├── contracts/
│   │   └── VerifyBOTRegistry.sol # On-chain registry contract
│   ├── scripts/
│   │   └── deploy.js             # Deployment script for Bohr Chain
│   ├── test/
│   │   └── VerifyBOTRegistry.test.js # 100% test suite
│   └── hardhat.config.js         # Bohr Hardhat config
└── frontend/
    ├── public/
    │   └── logo.jpg              # Web app brand asset
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   ├── analyze/      # Backend static analysis & on-chain hash lookup
    │   │   │   └── commit-report/# Oracle report commit endpoint
    │   │   ├── layout.tsx
    │   │   ├── page.tsx          # Full risk analyzer interactive UI
    │   │   └── globals.css       # Custom Vanilla CSS cyber theme
    │   ├── config/
    │   │   └── bohr.ts           # Bohr Chain Viem definition
    │   ├── context/
    │   │   └── Web3Provider.tsx  # Reown AppKit + Wagmi provider
    │   └── lib/
    │       └── analyzer.ts       # Bytecode & source risk inspection engine
    └── next.config.ts            # Secure environment variable bridge
```
