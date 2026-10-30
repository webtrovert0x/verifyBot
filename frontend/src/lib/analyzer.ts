import { keccak256, toHex, createPublicClient, http, getAddress } from "viem";
import { bohrTestnet } from "../config/bohr";

export interface Finding {
  id: string;
  category: "OWNERSHIP" | "UPGRADEABILITY" | "PRIVILEGED_FUNCTIONS" | "SOURCE_VERIFICATION" | "SUSPICIOUS_PATTERNS";
  severity: "SAFE" | "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  detected: boolean;
  scoreImpact: number;
  details?: string;
  codeSnippet?: string;
}

export interface SecurityReportData {
  targetContract: string;
  isContract: boolean;
  isSourceVerified: boolean;
  contractName?: string;
  compilerVersion?: string;
  license?: string;
  riskScoreNumber: number; // 0 - 100
  riskCategory: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScoreEnum: number; // 1 to 5 for Solidity contract
  summary: string;
  timestamp: number;
  bytecodeSize: number;
  findings: Finding[];
  ownership: {
    hasOwner: boolean;
    ownerAddress?: string;
    isRenounced: boolean;
    canTransferOwnership: boolean;
    canRenounceOwnership: boolean;
  };
  upgradeability: {
    isProxy: boolean;
    proxyType?: "EIP-1967" | "UUPS" | "Beacon" | "Custom";
    implementationAddress?: string;
    adminAddress?: string;
    hasDelegateCall: boolean;
  };
  privilegedFunctions: {
    canMint: boolean;
    canPause: boolean;
    canBlacklist: boolean;
    canChangeFees: boolean;
    hasEmergencyWithdraw: boolean;
  };
  reportHash: string; // Keccak-256 hash of canonical report summary
}

// Known Standard Storage Slots
const ERC1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ERC1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const ERC1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

// Known 4-byte Selectors
const SELECTORS = {
  // Ownership
  owner: "8da5cb5b",
  getOwner: "893d20e8",
  transferOwnership: "f2fde38b",
  renounceOwnership: "715018a6",
  // Upgradeability
  upgradeTo: "3659cfe6",
  upgradeToAndCall: "4f1ef286",
  // Privileged
  mint_address_uint: "40c10f19",
  mint_uint: "a0712d68",
  pause: "8456cb59",
  unpause: "3f4ba63a",
  setPaused: "16c38b34",
  blacklist: "adf69d16",
  blocklist: "07546172",
  setFee: "69e15409",
  setTax: "ea1d8213",
  setFees: "01f663ee",
  emergencyWithdraw: "5312ea8e",
  withdraw: "3ccfd60b",
};

export async function analyzeContract(targetAddress: string): Promise<SecurityReportData> {
  const checksumAddress = getAddress(targetAddress);
  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.botchain.ai";

  const publicClient = createPublicClient({
    chain: bohrTestnet,
    transport: http(rpcUrl),
  });

  // 1. Fetch Bytecode
  const bytecode = await publicClient.getBytecode({ address: checksumAddress });
  const isContract = Boolean(bytecode && bytecode !== "0x" && bytecode.length > 2);
  const cleanBytecode = (bytecode || "0x").toLowerCase().replace("0x", "");
  const bytecodeSize = cleanBytecode.length / 2;

  if (!isContract) {
    const findings: Finding[] = [
      {
        id: "EOA_OR_EMPTY",
        category: "SOURCE_VERIFICATION",
        severity: "CRITICAL",
        title: "No Contract Bytecode Found",
        description: "The requested address contains no deployed code. It is an Externally Owned Account (EOA) or an un-deployed address.",
        detected: true,
        scoreImpact: 90,
      },
    ];

    const reportHash = keccak256(toHex(JSON.stringify({ address: checksumAddress, isContract: false })));

    return {
      targetContract: checksumAddress,
      isContract: false,
      isSourceVerified: false,
      riskScoreNumber: 90,
      riskCategory: "CRITICAL",
      riskScoreEnum: 5,
      summary: "Address is not a smart contract on BOT Chain.",
      timestamp: Math.floor(Date.now() / 1000),
      bytecodeSize: 0,
      findings,
      ownership: {
        hasOwner: false,
        isRenounced: false,
        canTransferOwnership: false,
        canRenounceOwnership: false,
      },
      upgradeability: {
        isProxy: false,
        hasDelegateCall: false,
      },
      privilegedFunctions: {
        canMint: false,
        canPause: false,
        canBlacklist: false,
        canChangeFees: false,
        hasEmergencyWithdraw: false,
      },
      reportHash,
    };
  }

  // 2. Fetch BohrScan Source Verification info
  let isSourceVerified = false;
  let contractName = "Unknown Contract";
  let compilerVersion = "";
  let license = "Unspecified";

  try {
    const explorerBase = process.env.EXPLORER_URL || process.env.NEXT_PUBLIC_EXPLORER_URL || "https://scan.botchain.ai";
    const explorerApi = `${explorerBase}/api?module=contract&action=getsourcecode&address=${checksumAddress}`;
    const res = await fetch(explorerApi, { next: { revalidate: 30 } });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "1" && data.result && data.result[0]) {
        const item = data.result[0];
        if (item.SourceCode && item.SourceCode.trim().length > 0) {
          isSourceVerified = true;
          contractName = item.ContractName || contractName;
          compilerVersion = item.CompilerVersion || "";
          license = item.LicenseType || license;
        }
      }
    }
  } catch (err) {
    console.warn("BohrScan source verification check:", err);
  }

  // 3. Check Storage Slots for Proxies
  let isProxy = false;
  let proxyType: "EIP-1967" | "UUPS" | "Beacon" | "Custom" | undefined;
  let implementationAddress: string | undefined;
  let adminAddress: string | undefined;

  try {
    const implStorage = await publicClient.getStorageAt({
      address: checksumAddress,
      slot: ERC1967_IMPLEMENTATION_SLOT,
    });
    if (implStorage && implStorage !== "0x" && BigInt(implStorage) !== BigInt(0)) {
      isProxy = true;
      proxyType = "EIP-1967";
      implementationAddress = "0x" + implStorage.slice(26);
    }

    const adminStorage = await publicClient.getStorageAt({
      address: checksumAddress,
      slot: ERC1967_ADMIN_SLOT,
    });
    if (adminStorage && adminStorage !== "0x" && BigInt(adminStorage) !== BigInt(0)) {
      adminAddress = "0x" + adminStorage.slice(26);
    }
  } catch (e) {
    // storage read fallback
  }

  // 4. Selector & Opcode Analysis
  const hasOwnerFn = cleanBytecode.includes(SELECTORS.owner) || cleanBytecode.includes(SELECTORS.getOwner);
  const canTransferOwnership = cleanBytecode.includes(SELECTORS.transferOwnership);
  const canRenounceOwnership = cleanBytecode.includes(SELECTORS.renounceOwnership);

  // Read current owner address if readable
  let ownerAddress: string | undefined;
  let isRenounced = false;
  if (hasOwnerFn) {
    try {
      const raw = await publicClient.call({
        to: checksumAddress,
        data: `0x${SELECTORS.owner}`,
      });
      if (raw.data && raw.data.length >= 66) {
        ownerAddress = getAddress("0x" + raw.data.slice(26));
        isRenounced = ownerAddress === "0x0000000000000000000000000000000000000000";
      }
    } catch {
      // not callable or reverts
    }
  }

  // Upgradeability checks
  const hasUUPS = cleanBytecode.includes(SELECTORS.upgradeTo) || cleanBytecode.includes(SELECTORS.upgradeToAndCall);
  if (hasUUPS) {
    isProxy = true;
    proxyType = proxyType || "UUPS";
  }
  const hasDelegateCall = cleanBytecode.includes("f4"); // DELEGATECALL opcode

  // Privileged functions
  const canMint = cleanBytecode.includes(SELECTORS.mint_address_uint) || cleanBytecode.includes(SELECTORS.mint_uint);
  const canPause = cleanBytecode.includes(SELECTORS.pause) || cleanBytecode.includes(SELECTORS.setPaused);
  const canBlacklist = cleanBytecode.includes(SELECTORS.blacklist) || cleanBytecode.includes(SELECTORS.blocklist);
  const canChangeFees = cleanBytecode.includes(SELECTORS.setFee) || cleanBytecode.includes(SELECTORS.setTax) || cleanBytecode.includes(SELECTORS.setFees);
  const hasEmergencyWithdraw = cleanBytecode.includes(SELECTORS.emergencyWithdraw) || cleanBytecode.includes(SELECTORS.withdraw);

  // Suspicious Patterns
  const hasSelfDestruct = cleanBytecode.includes("ff"); // SELFDESTRUCT opcode

  // 5. Construct Findings & Risk Score
  const findings: Finding[] = [];
  let score = 0;

  // Source verification finding
  if (!isSourceVerified) {
    findings.push({
      id: "SOURCE_UNVERIFIED",
      category: "SOURCE_VERIFICATION",
      severity: "HIGH",
      title: "Unverified Smart Contract Source Code",
      description: "This contract has not published verified source code on BohrScan. Bytecode cannot be matched against human-audited source.",
      detected: true,
      scoreImpact: 35,
      details: "Closed-source contracts prevent complete auditing of business logic, fee parameters, and hidden rug-pull functions.",
    });
    score += 35;
  } else {
    findings.push({
      id: "SOURCE_VERIFIED",
      category: "SOURCE_VERIFICATION",
      severity: "SAFE",
      title: "Verified Source Code on BohrScan",
      description: `Contract source code is publicly verified. Name: ${contractName}, Compiler: ${compilerVersion}.`,
      detected: true,
      scoreImpact: -15,
      details: "Verified contracts allow open inspection of all logic and permissions.",
    });
  }

  // Ownership findings
  if (isRenounced) {
    findings.push({
      id: "OWNERSHIP_RENOUNCED",
      category: "OWNERSHIP",
      severity: "SAFE",
      title: "Ownership Has Been Renounced",
      description: "The contract owner is the zero address (0x0). No single wallet holds administrative control.",
      detected: true,
      scoreImpact: -10,
    });
  } else if (hasOwnerFn && ownerAddress) {
    findings.push({
      id: "CENTRALIZED_OWNER",
      category: "OWNERSHIP",
      severity: "MEDIUM",
      title: "Single Administrative Owner Wallet",
      description: `Contract control is concentrated in owner address: ${ownerAddress}.`,
      detected: true,
      scoreImpact: 20,
      details: "Check if this owner address is an EOA or a multi-signature safe before committing large funds.",
    });
    score += 20;
  }

  // Upgradeability findings
  if (isProxy) {
    findings.push({
      id: "UPGRADEABLE_PROXY",
      category: "UPGRADEABILITY",
      severity: "HIGH",
      title: `Upgradeable Contract Detected (${proxyType || "Proxy"})`,
      description: "An administrator can swap the underlying logic at any moment without deploying a new address.",
      detected: true,
      scoreImpact: 25,
      details: implementationAddress ? `Current implementation target: ${implementationAddress}` : undefined,
    });
    score += 25;
  } else if (hasDelegateCall) {
    findings.push({
      id: "DELEGATECALL_OPCODE",
      category: "UPGRADEABILITY",
      severity: "MEDIUM",
      title: "Contains Low-Level DelegateCall Opcode",
      description: "The contract contains DELEGATECALL instructions which execute code from other contract contexts in its own storage.",
      detected: true,
      scoreImpact: 15,
    });
    score += 15;
  }

  // Privileged function findings
  if (canMint) {
    findings.push({
      id: "MINT_CAPABILITY",
      category: "PRIVILEGED_FUNCTIONS",
      severity: "HIGH",
      title: "Arbitrary Token Minting Function Detected",
      description: "Contract contains mint() signatures which allow privileged accounts to generate additional tokens, potentially diluting holders.",
      detected: true,
      scoreImpact: 25,
    });
    score += 25;
  }

  if (canBlacklist) {
    findings.push({
      id: "BLACKLIST_CAPABILITY",
      category: "PRIVILEGED_FUNCTIONS",
      severity: "HIGH",
      title: "Wallet Blacklisting / Account Freezing Detected",
      description: "Administrator can block specific wallet addresses from trading, transferring, or withdrawing tokens.",
      detected: true,
      scoreImpact: 20,
    });
    score += 20;
  }

  if (canPause) {
    findings.push({
      id: "PAUSE_CAPABILITY",
      category: "PRIVILEGED_FUNCTIONS",
      severity: "MEDIUM",
      title: "Trading / Action Pausing Mechanism Detected",
      description: "Contract has pause() or setPaused() methods that allow an owner to halt user interactions.",
      detected: true,
      scoreImpact: 15,
    });
    score += 15;
  }

  if (canChangeFees) {
    findings.push({
      id: "FEE_MODIFICATION",
      category: "PRIVILEGED_FUNCTIONS",
      severity: "MEDIUM",
      title: "Dynamic Fee / Tax Configuration Detected",
      description: "Contract has functions to modify transaction fees or transfer taxes. Ensure limits or caps exist.",
      detected: true,
      scoreImpact: 15,
    });
    score += 15;
  }

  if (hasSelfDestruct) {
    findings.push({
      id: "SELFDESTRUCT_OPCODE",
      category: "SUSPICIOUS_PATTERNS",
      severity: "CRITICAL",
      title: "Contains SELFDESTRUCT Opcode (0xFF)",
      description: "Contract bytecode includes the SELFDESTRUCT instruction, which can permanently delete the contract code and drain its native BOT balance.",
      detected: true,
      scoreImpact: 35,
    });
    score += 35;
  }

  // Clamp score
  const finalScore = Math.max(0, Math.min(100, score));

  // Determine Category and Enum (1=SAFE, 2=LOW, 3=MEDIUM, 4=HIGH, 5=CRITICAL)
  let riskCategory: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  let riskScoreEnum: number;

  if (finalScore <= 15) {
    riskCategory = "SAFE";
    riskScoreEnum = 1;
  } else if (finalScore <= 35) {
    riskCategory = "LOW";
    riskScoreEnum = 2;
  } else if (finalScore <= 60) {
    riskCategory = "MEDIUM";
    riskScoreEnum = 3;
  } else if (finalScore <= 80) {
    riskCategory = "HIGH";
    riskScoreEnum = 4;
  } else {
    riskCategory = "CRITICAL";
    riskScoreEnum = 5;
  }

  const summary = `Analyzed ${isSourceVerified ? contractName : "unverified contract"} with bytecode size of ${bytecodeSize} bytes. Calculated risk score: ${finalScore}/100 (${riskCategory}).`;

  // Compute canonical deterministic report hash
  const canonicalData = {
    targetContract: checksumAddress,
    riskScoreNumber: finalScore,
    riskCategory,
    riskScoreEnum,
    isSourceVerified,
    isProxy,
    hasOwner: Boolean(hasOwnerFn && !isRenounced),
    canMint,
    canPause,
    canBlacklist,
    canChangeFees,
    hasSelfDestruct,
    bytecodeSize,
  };

  const reportHash = keccak256(toHex(JSON.stringify(canonicalData)));

  return {
    targetContract: checksumAddress,
    isContract: true,
    isSourceVerified,
    contractName,
    compilerVersion,
    license,
    riskScoreNumber: finalScore,
    riskCategory,
    riskScoreEnum,
    summary,
    timestamp: Math.floor(Date.now() / 1000),
    bytecodeSize,
    findings,
    ownership: {
      hasOwner: Boolean(hasOwnerFn),
      ownerAddress,
      isRenounced,
      canTransferOwnership,
      canRenounceOwnership,
    },
    upgradeability: {
      isProxy,
      proxyType,
      implementationAddress,
      adminAddress,
      hasDelegateCall,
    },
    privilegedFunctions: {
      canMint,
      canPause,
      canBlacklist,
      canChangeFees,
      hasEmergencyWithdraw,
    },
    reportHash,
  };
}
