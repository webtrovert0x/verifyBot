"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, isAddress } from "viem";
import registryArtifact from "@/contracts/VerifyBOTRegistry.json";
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Search,
  ExternalLink,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
  Layers,
  Fingerprint,
  Zap,
  Clock,
  Database,
} from "lucide-react";

interface Finding {
  id: string;
  category: string;
  severity: "SAFE" | "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  detected: boolean;
  scoreImpact: number;
  details?: string;
}

interface SecurityReport {
  targetContract: string;
  isContract: boolean;
  isSourceVerified: boolean;
  contractName?: string;
  compilerVersion?: string;
  license?: string;
  riskScoreNumber: number;
  riskCategory: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScoreEnum: number;
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
    proxyType?: string;
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
  reportHash: string;
}

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  registryArtifact.address ||
  "0xBFCDDC2F013106eE4e882d6C5DD10409d00E76e3") as `0x${string}`;

export default function Home() {
  const { open } = useAppKit();
  const { isConnected, address: userWallet } = useAccount();

  // Search state
  const [inputAddress, setInputAddress] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [onChainReport, setOnChainReport] = useState<any>(null);
  const [isHashMatch, setIsHashMatch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [committingHash, setCommittingHash] = useState(false);
  const [commitSuccessTx, setCommitSuccessTx] = useState<string | null>(null);

  // Wagmi Contract Interactions
  const { writeContract, data: txHash, isPending: isTxPending, error: txError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Track on-chain total stats
  const { data: totalScans, refetch: refetchScans } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryArtifact.abi,
    functionName: "totalScansCount",
  });

  const { data: totalReports, refetch: refetchReports } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryArtifact.abi,
    functionName: "totalReportsCount",
  });

  const { data: totalChecks, refetch: refetchChecks } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: registryArtifact.abi,
    functionName: "totalChecksCount",
  });

  // Presets
  const presets = [
    {
      name: "VerifyBOTRegistry (Live Audit Registry)",
      address: "0xBFCDDC2F013106eE4e882d6C5DD10409d00E76e3",
    },
    {
      name: "TraceBOTRegistry (Forensics Contract)",
      address: "0x358d360A6b59b4d45CC96A012A083f6196CA9d45",
    },
  ];

  // Run backend analyzer
  const executeAnalysis = async (target: string) => {
    try {
      setLoadingAnalysis(true);
      setErrorMessage(null);
      setCommitSuccessTx(null);
      setSelectedAddress(target);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAddress: target }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze contract.");
      }

      setReport(data.analysis);
      setOnChainReport(data.onChainReport);
      setIsHashMatch(data.isHashMatch);
      refetchScans();
      refetchReports();
      refetchChecks();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during scan.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Submit on-chain requestScan transaction (Gas only)
  const handleRequestScan = async () => {
    if (!isAddress(inputAddress)) {
      setErrorMessage("Please enter a valid Bohr contract address.");
      return;
    }
    if (!isConnected) {
      open();
      return;
    }
    setErrorMessage(null);

    try {
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: registryArtifact.abi,
        functionName: "requestScan",
        args: [getAddress(inputAddress)],
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit requestScan transaction.");
    }
  };

  // Submit on-chain checkReport transaction (Gas only)
  const handleCheckReport = async () => {
    if (!isAddress(inputAddress)) {
      setErrorMessage("Please enter a valid Bohr contract address.");
      return;
    }
    if (!isConnected) {
      open();
      return;
    }
    setErrorMessage(null);

    try {
      writeContract({
        address: REGISTRY_ADDRESS,
        abi: registryArtifact.abi,
        functionName: "checkReport",
        args: [getAddress(inputAddress)],
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit checkReport transaction.");
    }
  };

  // Trigger analysis when on-chain transaction is confirmed
  useEffect(() => {
    if (isTxConfirmed && inputAddress && isAddress(inputAddress)) {
      executeAnalysis(inputAddress);
    }
  }, [isTxConfirmed]);

  // Handle wallet error
  useEffect(() => {
    if (txError) {
      setErrorMessage(txError.message || "Wallet transaction rejected.");
    }
  }, [txError]);

  // Commit report hash on-chain via backend oracle key
  const handleCommitReportOnChain = async () => {
    if (!report) return;
    try {
      setCommittingHash(true);
      setErrorMessage(null);

      const res = await fetch("/api/commit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAddress: report.targetContract,
          reportHash: report.reportHash,
          riskScoreEnum: report.riskScoreEnum,
          metadataUri: `ipfs://verifybot/${report.targetContract}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit report on-chain.");
      }

      setCommitSuccessTx(data.txHash);
      executeAnalysis(report.targetContract);
    } catch (err: any) {
      setErrorMessage(err.message || "Error committing report to registry.");
    } finally {
      setCommittingHash(false);
    }
  };

  const getScoreCardClass = (category: string) => {
    switch (category) {
      case "SAFE":
        return "score-card-safe";
      case "LOW":
        return "score-card-low";
      case "MEDIUM":
        return "score-card-medium";
      case "HIGH":
        return "score-card-high";
      default:
        return "score-card-critical";
    }
  };

  const getBadgeClass = (category: string) => {
    switch (category) {
      case "SAFE":
        return "badge-safe";
      case "LOW":
        return "badge-low";
      case "MEDIUM":
        return "badge-medium";
      case "HIGH":
        return "badge-high";
      default:
        return "badge-critical";
    }
  };

  return (
    <div>
      {/* Top Navigation */}
      <header className="navbar">
        <div className="container nav-inner">
          <div className="brand">
            <img
              src="/logo.jpg"
              alt="VerifyBOT"
              style={{ width: "36px", height: "36px", borderRadius: "8px", border: "1px solid var(--border-cyan)" }}
            />
            <span>VerifyBOT</span>
            <span className="brand-badge">BOT Chain</span>
          </div>

          <div className="nav-actions">
            <div className="network-pill">
              <span className="network-dot"></span>
              <span>Bohr Chain (968)</span>
            </div>

            <button
              onClick={() => open()}
              className={`btn ${isConnected ? "btn-outline" : "btn-primary"}`}
            >
              {isConnected
                ? `${userWallet?.slice(0, 6)}...${userWallet?.slice(-4)}`
                : "Connect Wallet"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container" style={{ paddingTop: "1.5rem" }}>
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-pill">
            <Zap size={14} />
            <span>Gas-Only Model • Zero Protocol Fees</span>
          </div>
          <h1>Investigate BOT Chain Smart Contracts</h1>
          <p>
            VerifyBOT analyzes smart contracts for ownership risks, proxy upgradeability backdoors,
            privileged functions, and verifies cryptographic integrity against on-chain reports.
          </p>
        </section>

        {/* Global Contract Stats Bar */}
        <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-box">
            <div className="stat-label">Registry Contract</div>
            <a
              href={`https://scan.bohr.life/address/${REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <span>{REGISTRY_ADDRESS.slice(0, 8)}...{REGISTRY_ADDRESS.slice(-6)}</span>
              <ExternalLink size={12} />
            </a>
            <div className="stat-sub">VerifyBOTRegistry on Bohr</div>
          </div>

          <div className="stat-box">
            <div className="stat-label">Total Scan Requests</div>
            <div className="stat-value">
              {totalScans ? totalScans.toString() : "0"}
            </div>
            <div className="stat-sub">Submitted on-chain</div>
          </div>

          <div className="stat-box">
            <div className="stat-label">Committed Reports</div>
            <div className="stat-value">
              {totalReports ? totalReports.toString() : "0"}
            </div>
            <div className="stat-sub">Hashes stored in registry</div>
          </div>

          <div className="stat-box">
            <div className="stat-label">On-Chain Checks</div>
            <div className="stat-value">
              {totalChecks ? totalChecks.toString() : "0"}
            </div>
            <div className="stat-sub">Verification requests logged</div>
          </div>
        </div>

        {/* Search Card */}
        <div className="search-card">
          <div className="search-label-row">
            <span style={{ fontWeight: 600, color: "#f8fafc" }}>Target Smart Contract Address</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Bohr EVM Address (0x...)</span>
          </div>

          <div className="search-input-group">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Paste contract address (e.g. 0x358d360A6b59b4d45CC96A012A083f6196CA9d45)"
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value.trim())}
              className="search-input"
            />
          </div>

          {/* Presets */}
          <div className="preset-row">
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Try Preset:</span>
            {presets.map((preset) => (
              <button
                key={preset.address}
                type="button"
                className="preset-btn"
                onClick={() => {
                  setInputAddress(preset.address);
                  executeAnalysis(preset.address);
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="action-btn-row">
            {/* 1. Request Scan (Gas Only) */}
            <button
              type="button"
              disabled={!inputAddress || isTxPending || isTxConfirming || loadingAnalysis}
              onClick={handleRequestScan}
              className="btn btn-primary"
            >
              {isTxPending || isTxConfirming ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Confirming on Bohr...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Scan Contract (Gas Only)</span>
                </>
              )}
            </button>

            {/* 2. Check Existing Report (Gas Only) */}
            <button
              type="button"
              disabled={!inputAddress || isTxPending || isTxConfirming || loadingAnalysis}
              onClick={handleCheckReport}
              className="btn btn-secondary"
            >
              <Database size={16} color="#00f0ff" />
              <span>Check On-Chain Report</span>
            </button>

            {/* 3. Fast Preview Analysis */}
            <button
              type="button"
              disabled={!inputAddress || loadingAnalysis}
              onClick={() => executeAnalysis(inputAddress)}
              className="btn btn-outline"
            >
              {loadingAnalysis ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Analyzing Bytecode...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Quick Read-Only Scan</span>
                </>
              )}
            </button>
          </div>

          {/* Alerts / Feedback */}
          {errorMessage && (
            <div className="callout callout-danger" style={{ marginTop: "1rem" }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {txHash && (
            <div className="callout callout-cyan" style={{ marginTop: "1rem" }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <span>{isTxConfirming ? "Transaction submitted to Bohr Chain, waiting for confirmation..." : "Transaction Confirmed on Bohr!"}</span>
                <a
                  href={`https://scan.bohr.life/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}
                >
                  <span>View BohrScan Tx</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {loadingAnalysis && (
          <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <RefreshCw size={36} color="#00f0ff" className="animate-spin" style={{ margin: "0 auto 1rem" }} />
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
              Investigating Target Contract
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "480px", margin: "0 auto" }}>
              Extracting bytecode from Bohr RPC, probing ERC-1967 storage slots, checking BohrScan verified source code,
              and calculating security risk factors...
            </p>
          </div>
        )}

        {/* Full Security Report Display */}
        {report && !loadingAnalysis && (
          <div>
            {/* Top Score & Cryptographic Card */}
            <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
              {/* Risk Score Card */}
              <div className={`score-card ${getScoreCardClass(report.riskCategory)}`}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                      Overall Risk Rating
                    </span>
                    <span className={`badge ${getBadgeClass(report.riskCategory)}`}>
                      {report.riskCategory} RISK
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <span className="score-number">{report.riskScoreNumber}</span>
                    <span style={{ fontSize: "1.25rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/ 100</span>
                  </div>

                  <p style={{ fontSize: "0.9rem", color: "#e2e8f0", lineHeight: 1.6 }}>{report.summary}</p>
                </div>

                <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  <div>Contract Size: {report.bytecodeSize} bytes</div>
                  <div>Verified Source: {report.isSourceVerified ? "YES" : "NO (Bytecode Only)"}</div>
                </div>
              </div>

              {/* Cryptographic Integrity Card */}
              <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="card-header">
                    <div className="card-title">
                      <Fingerprint size={20} color="#a855f7" />
                      <span>Cryptographic Hash Integrity</span>
                    </div>

                    {onChainReport && onChainReport.exists ? (
                      isHashMatch ? (
                        <span className="badge badge-safe">
                          <CheckCircle2 size={12} />
                          <span>Tamper-Proof Match</span>
                        </span>
                      ) : (
                        <span className="badge badge-critical">
                          <XCircle size={12} />
                          <span>Hash Mismatch</span>
                        </span>
                      )
                    ) : (
                      <span className="badge badge-medium">
                        <Clock size={12} />
                        <span>Uncommitted</span>
                      </span>
                    )}
                  </div>

                  {/* Hashes */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    <div style={{ background: "var(--bg-input)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                      <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Local Computed Report Hash:</div>
                      <div style={{ color: "var(--primary-cyan)", wordBreak: "break-all" }}>{report.reportHash}</div>
                    </div>

                    {onChainReport && onChainReport.exists && (
                      <div style={{ background: "var(--bg-input)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                        <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
                          Committed On-Chain Hash (Checked {onChainReport.checkCount} times):
                        </div>
                        <div style={{ color: "#c084fc", wordBreak: "break-all" }}>{onChainReport.reportHash}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Commit Action if uncommitted */}
                {(!onChainReport || !onChainReport.exists) && (
                  <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Publish this verified report hash to VerifyBOTRegistry on Bohr:
                    </span>
                    <button
                      type="button"
                      disabled={committingHash}
                      onClick={handleCommitReportOnChain}
                      className="btn btn-purple"
                    >
                      {committingHash ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Committing to Bohr...</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint size={14} />
                          <span>Commit Hash On-Chain</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {commitSuccessTx && (
                  <div className="callout callout-success" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
                    <span>Report Hash successfully committed to Bohr Chain!</span>
                    <a
                      href={`https://scan.bohr.life/tx/${commitSuccessTx}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontWeight: 600, marginLeft: "auto" }}
                    >
                      View Tx
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 4 Security Pillars Grid */}
            <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
              {/* 1. Ownership */}
              <div className="stat-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span className="stat-label">Ownership Control</span>
                  {report.ownership.isRenounced ? (
                    <span className="badge badge-safe">Renounced</span>
                  ) : report.ownership.hasOwner ? (
                    <span className="badge badge-medium">Single Owner</span>
                  ) : (
                    <span className="badge" style={{ background: "#1e293b", color: "#94a3b8" }}>None</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.95rem", color: "#fff", marginBottom: "0.35rem" }}>
                  {report.ownership.isRenounced ? (
                    <Unlock size={16} color="#10b981" />
                  ) : (
                    <Lock size={16} color="#f59e0b" />
                  )}
                  <span>
                    {report.ownership.isRenounced
                      ? "Zero Address (0x0)"
                      : report.ownership.ownerAddress
                      ? `${report.ownership.ownerAddress.slice(0, 6)}...${report.ownership.ownerAddress.slice(-4)}`
                      : "No Public Owner Slot"}
                  </span>
                </div>
                <div className="stat-sub">
                  {report.ownership.isRenounced
                    ? "Ownership renounced. No single wallet can alter settings."
                    : "Single administrative wallet has authority."}
                </div>
              </div>

              {/* 2. Upgradeability */}
              <div className="stat-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span className="stat-label">Upgradeability</span>
                  {report.upgradeability.isProxy ? (
                    <span className="badge badge-critical">Mutable Proxy</span>
                  ) : (
                    <span className="badge badge-safe">Immutable</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.95rem", color: "#fff", marginBottom: "0.35rem" }}>
                  <Layers size={16} color="#00f0ff" />
                  <span>
                    {report.upgradeability.isProxy
                      ? `Proxy (${report.upgradeability.proxyType || "Custom"})`
                      : "Direct Bytecode"}
                  </span>
                </div>
                <div className="stat-sub">
                  {report.upgradeability.isProxy
                    ? "Implementation logic can be changed by the administrator."
                    : "Bytecode logic cannot be swapped out underneath users."}
                </div>
              </div>

              {/* 3. Privileged Functions */}
              <div className="stat-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span className="stat-label">Privileged Powers</span>
                  <span className="badge" style={{ background: "#1e293b", color: "#cbd5e1", fontFamily: "var(--font-mono)" }}>
                    {[
                      report.privilegedFunctions.canMint ? "MINT" : null,
                      report.privilegedFunctions.canPause ? "PAUSE" : null,
                      report.privilegedFunctions.canBlacklist ? "BLACKLIST" : null,
                      report.privilegedFunctions.canChangeFees ? "FEES" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "STANDARD"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.95rem", color: "#fff", marginBottom: "0.35rem" }}>
                  <Cpu size={16} color="#c084fc" />
                  <span>
                    {report.privilegedFunctions.canMint
                      ? "Mint Function Detected"
                      : report.privilegedFunctions.canPause
                      ? "Pausable Logic"
                      : "Standard Privileges"}
                  </span>
                </div>
                <div className="stat-sub">
                  Special functions that permit arbitrary supply changes, trading halts, or user blacklists.
                </div>
              </div>

              {/* 4. Source Verification */}
              <div className="stat-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span className="stat-label">BohrScan Source</span>
                  {report.isSourceVerified ? (
                    <span className="badge badge-safe">Verified</span>
                  ) : (
                    <span className="badge badge-critical">Unverified</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.95rem", color: "#fff", marginBottom: "0.35rem" }}>
                  <CheckCircle2
                    size={16}
                    color={report.isSourceVerified ? "#10b981" : "#ef4444"}
                  />
                  <span>{report.contractName || "Unpublished"}</span>
                </div>
                <div className="stat-sub">
                  {report.isSourceVerified
                    ? "Source code matches compiled on-chain bytecode."
                    : "No public source published on BohrScan explorer."}
                </div>
              </div>
            </div>

            {/* Findings Breakdown */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <ShieldAlert size={20} color="#00f0ff" />
                  <span>Detected Risk Findings & Patterns ({report.findings.length})</span>
                </div>
              </div>

              <div>
                {report.findings.map((item) => (
                  <div key={item.id} className="finding-item">
                    <div className="finding-header">
                      <div className="finding-title">
                        {item.severity === "CRITICAL" ? (
                          <Flame size={16} color="#ef4444" />
                        ) : item.severity === "HIGH" ? (
                          <ShieldAlert size={16} color="#f97316" />
                        ) : item.severity === "MEDIUM" ? (
                          <AlertTriangle size={16} color="#f59e0b" />
                        ) : (
                          <CheckCircle2 size={16} color="#10b981" />
                        )}
                        <span>{item.title}</span>
                      </div>
                      <span className={`badge ${getBadgeClass(item.severity)}`}>
                        {item.severity}
                      </span>
                    </div>

                    <div className="finding-desc">{item.description}</div>
                    {item.details && (
                      <div className="finding-details">{item.details}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Important Limitation Banner */}
            <div className="callout callout-warning">
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ color: "#fbbf24" }}>Important limitation & Security Disclaimer: </strong>
                A report hash proves that the displayed report matches the committed report in VerifyBOTRegistry.
                It does not prove that the report is accurate, and a clean scan cannot guarantee that a smart contract
                is completely safe. Always conduct independent due diligence before depositing funds into any DeFi protocol.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div style={{ marginBottom: "0.5rem" }}>
            VerifyBOT • Smart Contract Risk Analyzer for Bohr Chain (BOT Chain)
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            Registry:{" "}
            <a
              href={`https://scan.bohr.life/address/${REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              {REGISTRY_ADDRESS}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
