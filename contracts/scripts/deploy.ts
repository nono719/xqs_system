import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log(`\n=== Deploying CharityPlatform to network: ${network.name} ===`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("CharityPlatform");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  console.log("CharityPlatform deployed to:", address);
  console.log("Deployment tx:", tx?.hash);

  // 写出部署信息，供后端/前端读取
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    address,
    deployer: deployer.address,
    deploymentTx: tx?.hash,
    deployedAt: new Date().toISOString()
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("Deployment info written to:", outFile);

  // 同步 ABI 给前端使用
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "CharityPlatform.sol",
    "CharityPlatform.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const webAbiDir = path.join(__dirname, "..", "..", "web", "src", "abis");
    const apiAbiDir = path.join(__dirname, "..", "..", "api", "src", "abis");
    for (const dir of [webAbiDir, apiAbiDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "CharityPlatform.json"),
        JSON.stringify({ abi: artifact.abi, address, chainId: out.chainId }, null, 2)
      );
    }
    console.log("ABI synced to web/ and api/");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
