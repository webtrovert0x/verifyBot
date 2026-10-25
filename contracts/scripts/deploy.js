const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("----------------------------------------------------");
  console.log("🚀 Deploying VerifyBOTRegistry to Bohr Chain...");
  console.log("----------------------------------------------------");

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("❌ Deployer account not found! Check PRIVATE_KEY in .env.local");
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`👤 Deployer Address: ${deployer.address}`);
  console.log(`💰 Account Balance:  ${hre.ethers.formatEther(balance)} BOT`);

  const VerifyBOTRegistry = await hre.ethers.getContractFactory("VerifyBOTRegistry");
  const registry = await VerifyBOTRegistry.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log(`✅ VerifyBOTRegistry deployed to: ${contractAddress}`);
  console.log(`🔗 BohrScan Explorer: https://scan.bohr.life/address/${contractAddress}`);

  // Save deployment artifact
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentData = {
    contract: "VerifyBOTRegistry",
    address: contractAddress,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentDir, `deployment-${hre.network.name}.json`),
    JSON.stringify(deploymentData, null, 2)
  );

  // Update .env.local with CONTRACT_ADDRESS
  const envPath = path.join(__dirname, "../../.env.local");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");
    envContent = envContent.replace(
      /CONTRACT_ADDRESS=.*/,
      `CONTRACT_ADDRESS=${contractAddress}`
    );
    fs.writeFileSync(envPath, envContent);
    console.log(`📝 Updated CONTRACT_ADDRESS in .env.local`);
  }

  console.log("----------------------------------------------------");
  console.log("🎉 Deployment Complete!");
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
