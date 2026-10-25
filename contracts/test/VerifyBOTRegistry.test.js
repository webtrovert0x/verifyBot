const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VerifyBOTRegistry", function () {
  let registry;
  let owner;
  let reporter;
  let user1;
  let user2;
  const targetContract = "0x358d360A6b59b4d45CC96A012A083f6196CA9d45";

  beforeEach(async function () {
    [owner, reporter, user1, user2] = await ethers.getSigners();
    const VerifyBOTRegistry = await ethers.getContractFactory("VerifyBOTRegistry");
    registry = await VerifyBOTRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("should deploy with the deployer as owner and authorized reporter", async function () {
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.authorizedReporters(owner.address)).to.be.true;
    expect(await registry.totalScansCount()).to.equal(0);
    expect(await registry.totalReportsCount()).to.equal(0);
  });

  it("should allow users to request a scan (gas only)", async function () {
    const tx = await registry.connect(user1).requestScan(targetContract);
    const receipt = await tx.wait();

    expect(await registry.totalScansCount()).to.equal(1);

    const requesters = await registry.getRequesters(targetContract);
    expect(requesters.length).to.equal(1);
    expect(requesters[0]).to.equal(user1.address);

    const req = await registry.scanRequests(1);
    expect(req.targetContract).to.equal(targetContract);
    expect(req.requester).to.equal(user1.address);
  });

  it("should reject scan request for address zero", async function () {
    await expect(
      registry.connect(user1).requestScan(ethers.ZeroAddress)
    ).to.be.revertedWith("VerifyBOT: invalid target address");
  });

  it("should allow owner to authorize a new reporter", async function () {
    await registry.connect(owner).setReporter(reporter.address, true);
    expect(await registry.authorizedReporters(reporter.address)).to.be.true;
  });

  it("should allow an authorized reporter to publish a report", async function () {
    await registry.connect(owner).setReporter(reporter.address, true);

    const reportHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ audit: "safe" })));
    const riskScore = 1; // SAFE
    const metadataUri = "ipfs://QmTest123";

    await expect(
      registry.connect(reporter).publishReport(targetContract, reportHash, riskScore, metadataUri)
    )
      .to.emit(registry, "ReportPublished")
      .withArgs(targetContract, reportHash, riskScore, reporter.address, (await ethers.provider.getBlock("latest")).timestamp + 1);

    expect(await registry.hasReport(targetContract)).to.be.true;
    expect(await registry.totalReportsCount()).to.equal(1);

    const report = await registry.getReport(targetContract);
    expect(report.reportHash).to.equal(reportHash);
    expect(report.riskScore).to.equal(riskScore);
    expect(report.reporter).to.equal(reporter.address);
    expect(report.exists).to.be.true;
  });

  it("should reject non-reporters from publishing reports", async function () {
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("random"));
    await expect(
      registry.connect(user1).publishReport(targetContract, reportHash, 1, "")
    ).to.be.revertedWith("VerifyBOT: caller is not authorized reporter");
  });

  it("should allow users to submit checkReport transaction before retrieving existing report", async function () {
    // Publish first
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("test-report"));
    await registry.connect(owner).publishReport(targetContract, reportHash, 2, "ipfs://hash");

    // User checks report
    await expect(registry.connect(user1).checkReport(targetContract))
      .to.emit(registry, "ReportChecked")
      .withArgs(targetContract, user1.address, 1, (await ethers.provider.getBlock("latest")).timestamp + 1);

    expect(await registry.totalChecksCount()).to.equal(1);
    const report = await registry.getReport(targetContract);
    expect(report.checkCount).to.equal(1);
  });

  it("should reject checkReport if no report exists yet", async function () {
    await expect(
      registry.connect(user1).checkReport(targetContract)
    ).to.be.revertedWith("VerifyBOT: report does not exist yet");
  });

  it("should verify report integrity correctly", async function () {
    const originalData = JSON.stringify({ audit: "verified", risk: "LOW" });
    const correctHash = ethers.keccak256(ethers.toUtf8Bytes(originalData));
    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("tampered data"));

    await registry.connect(owner).publishReport(targetContract, correctHash, 2, "uri");

    expect(await registry.verifyReportIntegrity(targetContract, correctHash)).to.be.true;
    expect(await registry.verifyReportIntegrity(targetContract, wrongHash)).to.be.false;
  });
});
