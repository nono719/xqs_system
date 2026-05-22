import { Router } from "express";
import { z } from "zod";
import { customAlphabet, nanoid } from "nanoid";
import { db } from "../db";
import { jwtAuth } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { donationHash } from "../services/hash";

const router = Router();

/**
 * 论文 §6.3：trace_code 用 nanoid(12) 大小写字母+数字，固定长度 12
 * 默认 nanoid 字符集已含 -_，这里换成更友好的字符集
 */
const traceNano = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", 12);

const createSchema = z.object({
  project_id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("ETH"),
  donor_address: z.string().nullable().optional(),
  tx_hash: z.string().nullable().optional(),
  mode: z.enum(["demo", "onchain"]).default("onchain")
});

/** 论文 §6.2.2 核心：创建捐赠记录 + 生成 trace_code + 计算 data_hash + 创建存证占位 */
router.post("/", jwtAuth, validateBody(createSchema), (req, res) => {
  const data = req.body as z.infer<typeof createSchema>;

  const project = db
    .prepare("SELECT * FROM projects WHERE id=?")
    .get(data.project_id) as any;
  if (!project) return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
  if (project.status !== "active")
    return res.status(400).json({ error: "PROJECT_INACTIVE", message: "项目当前不可捐赠" });

  const donationId = nanoid();
  const traceCode = traceNano();
  const now = new Date().toISOString();

  // 1. 写入捐赠记录
  db.prepare(
    `INSERT INTO donations (id, trace_code, project_id, donor_user_id, donor_address, amount, currency, tx_hash, mode, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    donationId,
    traceCode,
    data.project_id,
    req.user!.id,
    data.donor_address ?? null,
    data.amount,
    data.currency ?? "ETH",
    data.tx_hash ?? null,
    data.mode,
    now
  );

  // 2. 累加项目已筹金额
  db.prepare("UPDATE projects SET raised_amount = raised_amount + ?, updated_at=? WHERE id=?").run(
    data.amount,
    now,
    data.project_id
  );

  // 3. 计算 data_hash（论文 §6.3 固定字段顺序）
  const dataHash = donationHash({
    donationId,
    projectId: data.project_id,
    amount: data.amount,
    currency: data.currency ?? "ETH",
    donorAddress: data.donor_address ?? null,
    createdAt: now
  });

  // 4. 存证占位（tx_hash 与 block_number 留空，待前端调 commitEvidence 后回写）
  const evidenceId = nanoid();
  db.prepare(
    `INSERT INTO blockchain_evidence (id, biz_type, biz_id, data_hash, tx_hash, block_number, submitter_address, committed_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(evidenceId, "donation", donationId, dataHash, null, null, data.donor_address ?? null, now);

  res.json({
    id: donationId,
    trace_code: traceCode,
    data_hash: dataHash,
    evidence_id: evidenceId
  });
});

/** 回写存证 tx_hash 与 block_number */
router.put(
  "/:id/evidence",
  jwtAuth,
  validateBody(
    z.object({
      tx_hash: z.string().min(10),
      block_number: z.number().int().nonnegative(),
      submitter_address: z.string().optional()
    })
  ),
  (req, res) => {
    const ev = db
      .prepare("SELECT * FROM blockchain_evidence WHERE biz_type='donation' AND biz_id=?")
      .get(req.params.id) as any;
    if (!ev) return res.status(404).json({ error: "NOT_FOUND" });
    db.prepare(
      "UPDATE blockchain_evidence SET tx_hash=?, block_number=?, submitter_address=? WHERE id=?"
    ).run(req.body.tx_hash, req.body.block_number, req.body.submitter_address ?? null, ev.id);
    res.json({ ok: true });
  }
);

/** 我的捐赠 */
router.get("/mine", jwtAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.*, p.name AS project_name
       FROM donations d LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.donor_user_id=? ORDER BY d.created_at DESC`
    )
    .all(req.user!.id);
  res.json({ donations: rows });
});

export default router;
