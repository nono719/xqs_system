import { expect } from "chai";
import { ethers } from "hardhat";
import { CharityPlatform } from "../typechain-types";

describe("CharityPlatform", () => {
  let contract: CharityPlatform;
  let org: any;
  let donor: any;
  let other: any;

  const infoHash = ethers.keccak256(ethers.toUtf8Bytes("project info v1"));

  beforeEach(async () => {
    [org, donor, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CharityPlatform");
    contract = (await Factory.connect(org).deploy()) as unknown as CharityPlatform;
    await contract.waitForDeployment();
  });

  describe("createProject", () => {
    it("creates a project and emits ProjectCreated", async () => {
      const target = ethers.parseEther("10");
      await expect(contract.connect(org).createProject(target, infoHash))
        .to.emit(contract, "ProjectCreated")
        .withArgs(1, org.address, target, infoHash, (t: bigint) => typeof t === "bigint");

      const p = await contract.getProject(1);
      expect(p[0]).to.equal(org.address);
      expect(p[1]).to.equal(target);
      expect(p[2]).to.equal(0n);
      expect(p[3]).to.equal(true);
      expect(p[4]).to.equal(infoHash);
    });

    it("rejects zero target", async () => {
      await expect(contract.createProject(0, infoHash)).to.be.revertedWith("target=0");
    });

    it("rejects zero infoHash", async () => {
      await expect(
        contract.createProject(ethers.parseEther("1"), ethers.ZeroHash)
      ).to.be.revertedWith("infoHash=0");
    });
  });

  describe("donate", () => {
    beforeEach(async () => {
      await contract.connect(org).createProject(ethers.parseEther("10"), infoHash);
    });

    it("accepts donation and emits DonationMade", async () => {
      const amount = ethers.parseEther("1");
      await expect(contract.connect(donor).donate(1, { value: amount }))
        .to.emit(contract, "DonationMade")
        .withArgs(1, 1, donor.address, amount, (t: bigint) => typeof t === "bigint");

      const p = await contract.getProject(1);
      expect(p[2]).to.equal(amount);
      expect(await contract.donationCount()).to.equal(1n);
    });

    it("rejects donation to non-existent project", async () => {
      await expect(
        contract.connect(donor).donate(99, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("not found");
    });

    it("rejects donation with zero value", async () => {
      await expect(contract.connect(donor).donate(1, { value: 0 })).to.be.revertedWith(
        "amount=0"
      );
    });

    it("rejects donation to inactive project", async () => {
      await contract.connect(org).setProjectActive(1, false);
      await expect(
        contract.connect(donor).donate(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("inactive");
    });
  });

  describe("setProjectActive", () => {
    beforeEach(async () => {
      await contract.connect(org).createProject(ethers.parseEther("10"), infoHash);
    });

    it("toggles active by creator", async () => {
      await contract.connect(org).setProjectActive(1, false);
      const p = await contract.getProject(1);
      expect(p[3]).to.equal(false);
    });

    it("rejects toggle by non-creator", async () => {
      await expect(contract.connect(other).setProjectActive(1, false)).to.be.revertedWith(
        "not org"
      );
    });
  });

  describe("commitEvidence", () => {
    it("stores evidence and emits", async () => {
      const key = ethers.keccak256(ethers.toUtf8Bytes("donation:1"));
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("payload"));
      await expect(contract.connect(donor).commitEvidence(key, dataHash))
        .to.emit(contract, "EvidenceCommitted")
        .withArgs(key, dataHash, donor.address, (t: bigint) => typeof t === "bigint");

      const ev = await contract.evidences(key);
      expect(ev[0]).to.equal(dataHash);
      expect(ev[1]).to.equal(donor.address);
    });

    it("rejects zero key or dataHash", async () => {
      const k = ethers.keccak256(ethers.toUtf8Bytes("k"));
      const d = ethers.keccak256(ethers.toUtf8Bytes("d"));
      await expect(contract.commitEvidence(ethers.ZeroHash, d)).to.be.revertedWith("key=0");
      await expect(contract.commitEvidence(k, ethers.ZeroHash)).to.be.revertedWith("dataHash=0");
    });
  });
});
