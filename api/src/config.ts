import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  dbPath: process.env.DB_PATH || path.join(process.cwd(), "data", "charity.db"),
  chain: {
    rpcUrl: process.env.CHAIN_RPC_URL || "http://127.0.0.1:8545",
    chainId: Number(process.env.CHAIN_ID) || 31337,
    contractAddress: process.env.CONTRACT_ADDRESS || ""
  }
};

// 若已部署，从 abis/CharityPlatform.json 读取地址覆盖
const abiPath = path.join(__dirname, "abis", "CharityPlatform.json");
if (fs.existsSync(abiPath)) {
  try {
    const info = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    if (info.address) config.chain.contractAddress = info.address;
    if (info.chainId) config.chain.chainId = info.chainId;
  } catch {
    /* ignore */
  }
}
