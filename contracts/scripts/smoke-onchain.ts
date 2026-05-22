/**
 * 端到端链上冒烟测试：模拟前端完整链上捐赠 + 存证流程
 *   1. 用账号 #1 createProject
 *   2. 用账号 #2 donate
 *   3. 用账号 #2 commitEvidence
 */
import { ethers } from "hardhat";

async function main() {
  const [org, donor] = await ethers.getSigners();
  const dep = require("../deployments/localhost.json");
  const Factory = await ethers.getContractFactory("CharityPlatform");
  const c = Factory.attach(dep.address);

  const infoHash = ethers.keccak256(ethers.toUtf8Bytes("smoke-project"));
  const target = ethers.parseEther("5");
  console.log("createProject...");
  const tx1 = await (c as any).connect(org).createProject(target, infoHash);
  const r1 = await tx1.wait(1);
  const ev1 = r1.logs.find((l: any) => l.fragment?.name === "ProjectCreated");
  const projectId = ev1.args.projectId;
  console.log("  projectId =", projectId.toString());

  console.log("donate 0.1 ETH...");
  const tx2 = await (c as any).connect(donor).donate(projectId, { value: ethers.parseEther("0.1") });
  const r2 = await tx2.wait(1);
  const ev2 = r2.logs.find((l: any) => l.fragment?.name === "DonationMade");
  console.log("  donationId =", ev2.args.donationId.toString());

  console.log("commitEvidence...");
  const key = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["string", "string"], ["donation", "smoke-1"])
  );
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes("payload-x"));
  const tx3 = await (c as any).connect(donor).commitEvidence(key, dataHash);
  const r3 = await tx3.wait(1);
  console.log("  evidence tx:", tx3.hash, "block:", r3.blockNumber);

  const ev = await c.evidences(key);
  console.log("  stored:", ev);
  console.log("ALL OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
