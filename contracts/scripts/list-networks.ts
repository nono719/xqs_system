import hre from "hardhat";

async function main() {
  console.log("Configured networks:");
  for (const name of Object.keys(hre.config.networks)) {
    const n: any = (hre.config.networks as any)[name];
    console.log(`  - ${name}: chainId=${n.chainId ?? "?"}, url=${n.url ?? "(in-process)"}`);
  }
  console.log(`Current network: ${hre.network.name} (chainId ${hre.network.config.chainId ?? "?"})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
