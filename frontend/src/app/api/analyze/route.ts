import { NextRequest, NextResponse } from "next/server";
import { analyzeContract } from "@/lib/analyzer";
import { createPublicClient, http, getAddress } from "viem";
import { bohrTestnet } from "@/config/bohr";
import registryArtifact from "@/contracts/VerifyBOTRegistry.json";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetAddress } = body;

    if (!targetAddress || typeof targetAddress !== "string") {
      return NextResponse.json({ error: "Invalid targetAddress provided." }, { status: 400 });
    }

    let checksummedTarget: `0x${string}`;
    try {
      checksummedTarget = getAddress(targetAddress) as `0x${string}`;
    } catch {
      return NextResponse.json({ error: "Invalid Ethereum/Bohr address format." }, { status: 400 });
    }

    // 1. Run local risk analysis engine
    const analysis = await analyzeContract(checksummedTarget);

    // 2. Query on-chain VerifyBOTRegistry
    const registryAddress = (process.env.CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
      registryArtifact.address) as `0x${string}`;

    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.botchain.ai";
    const publicClient = createPublicClient({
      chain: bohrTestnet,
      transport: http(rpcUrl),
    });

    let onChainReport: any = null;
    let isHashMatch = false;

    if (registryAddress) {
      try {
        const rawReport = (await publicClient.readContract({
          address: registryAddress,
          abi: registryArtifact.abi,
          functionName: "getReport",
          args: [checksummedTarget],
        })) as any;

        if (rawReport && rawReport.exists) {
          onChainReport = {
            reportHash: rawReport.reportHash,
            riskScore: Number(rawReport.riskScore),
            timestamp: Number(rawReport.timestamp),
            checkCount: Number(rawReport.checkCount),
            reporter: rawReport.reporter,
            metadataUri: rawReport.metadataUri,
            exists: true,
          };

          isHashMatch = onChainReport.reportHash.toLowerCase() === analysis.reportHash.toLowerCase();
        }
      } catch (err) {
        console.warn("Could not query on-chain report:", err);
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      onChainReport,
      isHashMatch,
      registryAddress,
    });
  } catch (error: any) {
    console.error("API /api/analyze error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze contract." },
      { status: 500 }
    );
  }
}
