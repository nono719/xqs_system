import crypto from "crypto";

/** SHA-256 十六进制，论文 §6.2.2 关键算法 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * 按固定字段顺序计算捐赠 data_hash（论文 §6.3 踩坑：必须固定顺序）
 * donationId → projectId → amount → currency → donorAddress → createdAt
 */
export function donationHash(d: {
  donationId: string;
  projectId: string;
  amount: number;
  currency: string;
  donorAddress: string | null;
  createdAt: string;
}): string {
  return sha256(
    JSON.stringify({
      donationId: d.donationId,
      projectId: d.projectId,
      amount: d.amount,
      currency: d.currency,
      donorAddress: d.donorAddress ?? null,
      createdAt: d.createdAt
    })
  );
}

/** 项目元数据哈希 */
export function projectHash(p: {
  name: string;
  targetAmount: number;
  description: string | null;
  createdAt: string;
}): string {
  return sha256(
    JSON.stringify({
      name: p.name,
      targetAmount: p.targetAmount,
      description: p.description ?? null,
      createdAt: p.createdAt
    })
  );
}

/** 项目进度哈希 */
export function progressHash(g: {
  progressId: string;
  projectId: string;
  title: string;
  content: string | null;
  createdAt: string;
}): string {
  return sha256(
    JSON.stringify({
      progressId: g.progressId,
      projectId: g.projectId,
      title: g.title,
      content: g.content ?? null,
      createdAt: g.createdAt
    })
  );
}
