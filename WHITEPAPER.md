# VerifyBOT Technical Whitepaper
### Decentralized Smart Contract Risk Analyzer & On-Chain Audit Registry for Bohr Chain (BOT Chain)

---

## 1. Executive Summary

As decentralized finance (DeFi), gaming protocols, and token standards flourish on the **Bohr Chain (BOT Chain)**, security diligence has become paramount. Smart contracts govern billions in capital, yet users routinely deposit funds into unverified, mutable, or maliciously configured contracts without visibility into their underlying permissions. 

Critical backdoors—such as centralized token minting, arbitrary proxy logic swaps, wallet blacklisting, hidden transfer taxes, and unconstrained administrative controls—are frequently concealed beneath standard user interfaces.

**VerifyBOT** is an on-chain risk analyzer and cryptographic verification registry native to Bohr Chain. VerifyBOT enables users, developers, and institutions to investigate any BOT Chain contract before committing capital. Built around a **zero-protocol-fee (gas-only)** economic model, VerifyBOT pairs automated static bytecode inspection with on-chain cryptographic audit anchoring in `VerifyBOTRegistry.sol`.

---

## 2. Problem Statement

Participating in newly launched smart contracts presents several systemic risks:

1. **Privileged Centralization & Hidden Backdoors**: Many tokens advertised as "decentralized" contain unrestricted owner functions that allow developers to mint unlimited supply, pause trading indefinitely, blacklist specific user wallets, or extract liquidity.
2. **Proxy Mutability & Logic Swapping**: Contracts employing proxy patterns (e.g., EIP-1967, UUPS, Beacon proxies) allow administrators to swap out the underlying implementation bytecode at any block height. An ostensibly safe contract can instantly be converted into a malicious drainer.
3. **Closed-Source & Bytecode Obfuscation**: Contracts operating on-chain without verified source code on BohrScan are black boxes. Decompiled opcodes often conceal dangerous instructions such as `SELFDESTRUCT` (0xFF) or unauthorized `DELEGATECALL` (0xF4) routines.
4. **Lack of Immutable Verification Records**: Users reviewing audit reports off-chain have no guarantee that the report has not been manipulated or altered post-scan. There is no proof that the analysis displayed on their screen represents the exact findings evaluated by the auditing engine.

---

## 3. VerifyBOT Architecture & System Design

VerifyBOT employs an asynchronous, dual-layer architecture combining an immutable on-chain registry with an off-chain automated risk engine.

```
+-------------------------------------------------------------------------+
|                       VerifyBOT Frontend (Web3)                         |
|  - Real-Time Risk Score Meter (0-100 & Categorical Tier)                |
|  - Five Pillars Security Breakdown & Opcode Inspection                  |
|  - Client-Side Keccak-256 Hash Integrity Validator                     |
+--------------------+--------------------------------+-------------------+
                     |                                ^
        1. requestScan(address)                       | 5. Retrieve & Verify
         [Gas-Only Network Tx]                        |    Report Hash
                     v                                |
+-----------------------------------------------------+-------------------+
|               VerifyBOTRegistry.sol (Bohr Chain)                        |
|        Contract Address: 0xBFCDDC2F013106eE4e882d6C5DD10409d00E76e3     |
|  - requestScan(address target) : Logs on-chain scan request             |
|  - checkReport(address target) : Records check transaction prior to view|
|  - publishReport(...)          : Commits cryptographic report hash      |
|  - verifyReportIntegrity(...)  : On-chain tamper-proof validation       |
+--------------------+--------------------------------+-------------------+
                     |                                ^
        2. ScanRequested Event                        | 4. publishReport(hash)
         Detected by Oracle Engine                    |    Committed On-Chain
                     v                                |
+-----------------------------------------------------+-------------------+
|               Backend Risk Analysis & Oracle Engine                     |
|  - Bohr JSON-RPC (eth_getCode, eth_getStorageAt, eth_call)              |
|  - BohrScan Blockscout API (Verified Source & ABI Inspection)           |
|  - Multi-Pillar Static Bytecode Analyzer                                |
|  - Canonical Deterministic Serialization & Keccak-256 Hashing           |
+-------------------------------------------------------------------------+
```

### 3.1 End-to-End Workflow

1. **User Initiation**: A user enters a target BOT Chain contract address into VerifyBOT.
2. **On-Chain Scan Request**: The user clicks **Scan Contract**, dispatching `requestScan(targetContract)` to `VerifyBOTRegistry.sol`. The user pays standard Bohr network gas only (no protocol fee).
3. **Automated Inspection**: The backend analyzer extracts deployed bytecode via the Bohr RPC (`eth_getCode`), queries BohrScan for verified source code, inspects storage slots for proxy patterns, and parses function signatures.
4. **Report Generation & Hashing**: A standardized security report is generated, and a deterministic Keccak-256 cryptographic hash is calculated over the canonical report payload.
5. **On-Chain Commitment**: The analyzer/oracle signs and submits `publishReport(targetAddress, reportHash, riskScore, metadataUri)` to the registry.
6. **Integrity Verification**: When viewing the report, the client application computes the hash client-side and validates it against `VerifyBOTRegistry.getReport(targetAddress).reportHash`. If the hashes match, a **Tamper-Proof Match** seal is displayed.
7. **On-Chain Check Log**: When inspecting an existing report, users dispatch `checkReport(targetContract)` on-chain, creating an audit log of community verification.

---

## 4. Smart Contract Architecture: `VerifyBOTRegistry.sol`

`VerifyBOTRegistry.sol` is the immutable single source of truth deployed on Bohr Chain.

### 4.1 Data Structures

```solidity
enum RiskScore {
    UNKNOWN,   // 0
    SAFE,      // 1 (0-15 risk points)
    LOW,       // 2 (16-35 risk points)
    MEDIUM,    // 3 (36-60 risk points)
    HIGH,      // 4 (61-80 risk points)
    CRITICAL   // 5 (81-100 risk points)
}

struct SecurityReport {
    bytes32 reportHash;      // Keccak-256 hash of the off-chain JSON audit report
    RiskScore riskScore;     // Categorical risk rating
    uint256 timestamp;       // Timestamp when report was committed
    uint256 checkCount;      // Number of on-chain verification checks requested
    address reporter;        // Authorized oracle/analyzer address
    string metadataUri;      // URI or CID pointing to full audit metadata
    bool exists;             // True if report has been published
}

struct ScanRequest {
    uint256 requestId;
    address targetContract;
    address requester;
    uint256 timestamp;
}
```

### 4.2 Core Interface

* **`requestScan(address targetContract) external returns (uint256 requestId)`**:
  Records a scan request on Bohr Chain, increments `totalScansCount`, and emits `ScanRequested`. Gas-only transaction.
* **`checkReport(address targetContract) external returns (bool)`**:
  Requires an existing report. Increments the target contract's `checkCount` and global `totalChecksCount`, emitting `ReportChecked`.
* **`publishReport(address targetContract, bytes32 reportHash, RiskScore riskScore, string calldata metadataUri) external`**:
  Restricted to authorized reporters and the contract owner. Commits the cryptographic hash and risk category to storage.
* **`verifyReportIntegrity(address targetContract, bytes32 clientComputedHash) external view returns (bool)`**:
  Compares an off-chain calculated hash against the on-chain committed report hash.

---

## 5. The Five Pillars of Smart Contract Risk Analysis

VerifyBOT evaluates contracts across five distinct security pillars:

### Pillar I: Ownership & Administrative Governance
* **Single Wallet Control**: Identifies whether administrative rights reside in a single Externally Owned Account (EOA).
* **Multi-Signature / Timelock Detection**: Checks if owner operations are guarded by governance contracts or multi-signature vaults.
* **Renounced Ownership**: Verifies if the contract owner is the zero address (`0x0000000000000000000000000000000000000000`), proving complete decentralization.

### Pillar II: Upgradeability & Proxy Architectures
* **ERC-1967 Implementation Slot**: Probes slot `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` using `eth_getStorageAt` to determine proxy targets.
* **Admin & Beacon Slots**: Probes slot `0xb5312768...` (Admin) and `0xa3f0ad74...` (Beacon).
* **UUPS Upgrade Pattern**: Detects `upgradeTo(address)` (`0x3659cfe6`) and `upgradeToAndCall(address,bytes)` (`0x4f1ef286`).
* **Opcode Inspection**: Identifies low-level `DELEGATECALL` (`0xF4`) instructions capable of executing external storage mutations.

### Pillar III: Privileged Functions & Capabilities
* **Arbitrary Minting**: Checks for `mint(address,uint256)` (`0x40c10f19`) and `mint(uint256)` (`0xa0712d68`), flagging potential token dilution risks.
* **Trading Pauses**: Identifies `pause()` (`0x8456cb59`) and `setPaused(bool)` (`0x16c38b34`) which can freeze user balances.
* **Wallet Blacklisting**: Detects `blacklist(address)` (`0xadf69d16`) and `blocklist(address)` selectors.
* **Dynamic Fee Manipulation**: Evaluates fee setter functions (`setFee`, `setTax`) that permit administrators to apply confiscatory transfer taxes.

### Pillar IV: Source Code Verification
* **BohrScan Explorer Reconciliation**: Queries BohrScan API to verify whether deployed bytecode correlates directly with human-auditable Solidity source code.
* **Closed-Source Blackbox Warning**: Flags unverified contracts where internal business logic cannot be publicly audited.

### Pillar V: Suspicious Bytecode & Malicious Patterns
* **`SELFDESTRUCT` Opcode (0xFF)**: Identifies contract suicide opcodes that can wipe bytecode from the blockchain and drain native BOT reserves.
* **Honeypot Logic Patterns**: Checks for transfer restriction routines that permit buy transactions while permanently reverting sell transactions.

---

## 6. Cryptographic Proof & Hash Integrity Model

To eliminate the risk of tampered or forged reports, VerifyBOT employs deterministic canonical serialization:

$$\text{CanonicalReport} = \text{Serialize}(\text{Address}, \text{RiskScore}, \text{PillarFindings}, \text{BytecodeSize})$$
$$\text{ReportHash} = \text{keccak256}(\text{CanonicalReport})$$

1. The backend oracle commits $\text{ReportHash}$ to `VerifyBOTRegistry.sol`.
2. When the frontend loads the report, it independently executes the identical canonical serialization and calculates $\text{ClientHash}$.
3. If $\text{ClientHash} \equiv \text{OnChainReport.reportHash}$, the user is guaranteed that the report has not been modified or tampered with since on-chain commitment.

---

## 7. Security Limitations & Disclaimer

> **Critical Limitation**: A verified report hash proves that the displayed audit matches the committed report in `VerifyBOTRegistry`. It does not prove that the report is infallible, and a clean scan cannot guarantee that a smart contract is safe from economic exploits, oracle manipulation, or novel vulnerability classes. Automated static analysis must complement, not replace, comprehensive human audits and independent risk diligence.

---

## 8. Network Deployment & Specifications

| Parameter | Specification |
| :--- | :--- |
| **Network** | BOT Chain Mainnet |
| **Chain ID** | `677` |
| **RPC Endpoint** | `https://rpc.botchain.ai` |
| **Native Token** | BOT (18 Decimals) |
| **Block Explorer** | [https://scan.botchain.ai](https://scan.botchain.ai) |
| **VerifyBOTRegistry Address** | [`0x9e785Ad3Bf508ff1119c62EbC7D7A7D06621f0DF`](https://scan.botchain.ai/address/0x9e785Ad3Bf508ff1119c62EbC7D7A7D06621f0DF#code) |
| **Compiler Version** | Solidity `v0.8.24+commit.e11b9ed9` (Runs: `200`) |

---

## 9. Roadmap

* **Phase 1 (Completed)**: Core `VerifyBOTRegistry.sol` deployment, 5-pillar static analysis engine, gas-only workflow, and cryptographic hash verification.
* **Phase 2**: Automated symbolic execution for dynamic reentrancy and flash loan attack simulation.
* **Phase 3**: Community decentralized reporter quorum (multi-oracle consensus for report publishing).
* **Phase 4**: Automated BohrScan Blockscout webhook integration for zero-delay contract ingestion upon deployment.
