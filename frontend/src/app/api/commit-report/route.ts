import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bohrTestnet } from "@/config/bohr";
import registryArtifact from "@/contracts/VerifyBOTRegistry.json";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetAddress, reportHash, riskScoreEnum, metadataUri } = body;

    if (!targetAddress || !reportHash || riskScoreEnum === undefined) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
    }

    const rawKey = process.env.PRIVATE_KEY?.trim();
    if (!rawKey) {
      return NextResponse.json({ error: "Backend private key not configured." }, { status: 500 });
    }

    const formattedKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);

    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.botchain.ai";
    const registryAddress = (process.env.CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
      registryArtifact.address) as `0x${string}`;

    const walletClient = createWalletClient({
      account,
      chain: bohrTestnet,
      transport: http(rpcUrl),
    });

    const publicClient = createPublicClient({
      chain: bohrTestnet,
      transport: http(rpcUrl),
    });

    const checksumTarget = getAddress(targetAddress);

    // Call publishReport on VerifyBOTRegistry
    const txHash = await walletClient.writeContract({
      address: registryAddress,
      abi: registryArtifact.abi,
      functionName: "publishReport",
      args: [checksumTarget, reportHash as `0x${string}`, Number(riskScoreEnum), metadataUri || "ipfs://verified"],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const explorerBase = process.env.EXPLORER_URL || process.env.NEXT_PUBLIC_EXPLORER_URL || "https://scan.botchain.ai";
    return NextResponse.json({
      success: true,
      txHash,
      status: receipt.status,
      blockNumber: Number(receipt.blockNumber),
      explorerUrl: `${explorerBase}/tx/${txHash}`,
    });
  } catch (error: any) {
    console.error("API /api/commit-report error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to commit report on-chain." },
      { status: 500 }
    );
  }
}
