import { Router } from "express";
import path from "path";
import fs from "fs";
import { config } from "../config";

const router = Router();

router.get("/contract", (_req, res) => {
  const abiPath = path.join(__dirname, "..", "abis", "CharityPlatform.json");
  if (!fs.existsSync(abiPath)) {
    return res.json({
      address: config.chain.contractAddress,
      chainId: config.chain.chainId,
      rpcUrl: config.chain.rpcUrl,
      abi: []
    });
  }
  const info = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  res.json({
    address: info.address || config.chain.contractAddress,
    chainId: info.chainId || config.chain.chainId,
    rpcUrl: config.chain.rpcUrl,
    abi: info.abi
  });
});

export default router;
