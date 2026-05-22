import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db";
import { jwtAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validateBody } from "../middlewares/validate";
import { projectHash, progressHash } from "../services/hash";

const router = Router();

/** 提交机构入驻 —— 当前登录用户必须为 org_admin */
router.post(
  "/apply",
  jwtAuth,
  requireRole("org_admin"),
  validateBody(
    z.object({
      name: z.string().min(2).max(64),
      intro: z.string().max(1024).optional(),
      qualification_hash: z.string().optional()
    })
  ),
  (req, res) => {
    const { name, intro, qualification_hash } = req.body;
    const exist = db.prepare("SELECT id FROM organizations WHERE name = ?").get(name);
    if (exist) return res.status(409).json({ error: "ORG_EXISTS", message: "机构名称已存在" });
    const id = nanoid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO organizations (id, name, intro, qualification_hash, status, admin_user_id, created_at)
       VALUES (?,?,?,?,'pending',?,?)`
    ).run(id, name, intro ?? null, qualification_hash ?? null, req.user!.id, now);

    // 创建审核任务
    db.prepare(
      `INSERT INTO review_tasks (id, biz_type, biz_id, status, created_at) VALUES (?,?,?,?,?)`
    ).run(nanoid(), "org", id, "pending", now);

    // 用户绑定 org_id
    db.prepare("UPDATE users SET org_id = ? WHERE id = ?").run(id, req.user!.id);

    res.json({ id, status: "pending" });
  }
);

router.get("/me", jwtAuth, requireRole("org_admin"), (req, res) => {
  const org = db
    .prepare("SELECT * FROM organizations WHERE admin_user_id = ?")
    .get(req.user!.id);
  res.json({ organization: org ?? null });
});

/** 创建项目（草稿） */
router.post(
  "/projects",
  jwtAuth,
  requireRole("org_admin"),
  validateBody(
    z.object({
      name: z.string().min(2).max(128),
      target_amount: z.number().positive(),
      description: z.string().max(4096).optional()
    })
  ),
  (req, res) => {
    const org = db
      .prepare("SELECT id, status FROM organizations WHERE admin_user_id = ?")
      .get(req.user!.id) as any;
    if (!org) return res.status(403).json({ error: "NO_ORG", message: "请先提交机构入驻申请" });
    if (org.status !== "approved")
      return res.status(403).json({ error: "ORG_NOT_APPROVED", message: "机构未审批通过" });

    const { name, target_amount, description } = req.body;
    const now = new Date().toISOString();
    const id = nanoid();
    const infoHash = projectHash({
      name,
      targetAmount: target_amount,
      description: description ?? null,
      createdAt: now
    });
    db.prepare(
      `INSERT INTO projects (id, org_id, name, target_amount, description, info_hash, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,'draft',?,?)`
    ).run(id, org.id, name, target_amount, description ?? null, infoHash, now, now);

    res.json({ id, info_hash: infoHash, status: "draft" });
  }
);

router.get("/projects", jwtAuth, requireRole("org_admin"), (req, res) => {
  const org = db
    .prepare("SELECT id FROM organizations WHERE admin_user_id = ?")
    .get(req.user!.id) as any;
  if (!org) return res.json({ projects: [] });
  const rows = db
    .prepare("SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC")
    .all(org.id);
  res.json({ projects: rows });
});

router.put(
  "/projects/:id",
  jwtAuth,
  requireRole("org_admin"),
  validateBody(
    z.object({
      name: z.string().min(2).max(128).optional(),
      target_amount: z.number().positive().optional(),
      description: z.string().max(4096).optional()
    })
  ),
  (req, res) => {
    const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "NOT_FOUND" });
    const org = db
      .prepare("SELECT id FROM organizations WHERE admin_user_id = ?")
      .get(req.user!.id) as any;
    if (!org || org.id !== p.org_id) return res.status(403).json({ error: "FORBIDDEN" });
    if (p.status !== "draft" && p.status !== "rejected")
      return res.status(400).json({ error: "NOT_EDITABLE", message: "仅草稿/驳回的项目可编辑" });
    const now = new Date().toISOString();
    const merged = { ...p, ...req.body, updated_at: now };
    const newHash = projectHash({
      name: merged.name,
      targetAmount: merged.target_amount,
      description: merged.description ?? null,
      createdAt: p.created_at
    });
    db.prepare(
      `UPDATE projects SET name=?, target_amount=?, description=?, info_hash=?, updated_at=?, status='draft', reject_reason=NULL WHERE id=?`
    ).run(merged.name, merged.target_amount, merged.description, newHash, now, p.id);
    res.json({ id: p.id, info_hash: newHash, status: "draft" });
  }
);

/** 提交审核 */
router.post(
  "/projects/:id/submit",
  jwtAuth,
  requireRole("org_admin"),
  (req, res) => {
    const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "NOT_FOUND" });
    const org = db
      .prepare("SELECT id FROM organizations WHERE admin_user_id = ?")
      .get(req.user!.id) as any;
    if (!org || org.id !== p.org_id) return res.status(403).json({ error: "FORBIDDEN" });
    if (p.status !== "draft" && p.status !== "rejected")
      return res.status(400).json({ error: "NOT_SUBMITTABLE" });
    db.prepare("UPDATE projects SET status='pending_review', updated_at=? WHERE id=?").run(
      new Date().toISOString(),
      p.id
    );
    db.prepare(
      "INSERT INTO review_tasks (id, biz_type, biz_id, status, created_at) VALUES (?,?,?,?,?)"
    ).run(nanoid(), "project", p.id, "pending", new Date().toISOString());
    res.json({ ok: true });
  }
);

/** 项目激活（审核通过后手动发布） */
router.post(
  "/projects/:id/activate",
  jwtAuth,
  requireRole("org_admin"),
  (req, res) => {
    const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "NOT_FOUND" });
    if (p.status !== "approved")
      return res.status(400).json({ error: "INVALID_STATE", message: "仅审核通过的项目可激活" });
    db.prepare("UPDATE projects SET status='active', updated_at=? WHERE id=?").run(
      new Date().toISOString(),
      p.id
    );
    res.json({ ok: true });
  }
);

/** 关闭项目 */
router.post("/projects/:id/close", jwtAuth, requireRole("org_admin"), (req, res) => {
  const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!p) return res.status(404).json({ error: "NOT_FOUND" });
  if (p.status !== "active") return res.status(400).json({ error: "INVALID_STATE" });
  db.prepare("UPDATE projects SET status='closed', updated_at=? WHERE id=?").run(
    new Date().toISOString(),
    p.id
  );
  res.json({ ok: true });
});

/** 绑定链上 projectId（机构端在合约 createProject 后调用） */
router.post(
  "/projects/:id/bind-onchain",
  jwtAuth,
  requireRole("org_admin"),
  validateBody(z.object({ onchain_project_id: z.number().int().positive() })),
  (req, res) => {
    db.prepare("UPDATE projects SET onchain_project_id=? WHERE id=?").run(
      req.body.onchain_project_id,
      req.params.id
    );
    res.json({ ok: true });
  }
);

/** 发布项目进展 */
router.post(
  "/projects/:id/progress",
  jwtAuth,
  requireRole("org_admin"),
  validateBody(
    z.object({
      title: z.string().min(1).max(128),
      content: z.string().max(4096).optional()
    })
  ),
  (req, res) => {
    const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "NOT_FOUND" });
    if (p.status !== "active")
      return res.status(400).json({ error: "INVALID_STATE", message: "仅激活项目可发进展" });
    const id = nanoid();
    const now = new Date().toISOString();
    const hash = progressHash({
      progressId: id,
      projectId: p.id,
      title: req.body.title,
      content: req.body.content ?? null,
      createdAt: now
    });
    db.prepare(
      `INSERT INTO project_progress (id, project_id, title, content, progress_hash, created_at)
       VALUES (?,?,?,?,?,?)`
    ).run(id, p.id, req.body.title, req.body.content ?? null, hash, now);

    // 同步建立存证占位
    const evidenceId = nanoid();
    db.prepare(
      `INSERT INTO blockchain_evidence (id, biz_type, biz_id, data_hash, committed_at) VALUES (?,?,?,?,?)`
    ).run(evidenceId, "progress", id, hash, now);

    res.json({ id, progress_hash: hash, evidence_id: evidenceId });
  }
);

/** 回写进展存证 tx */
router.put(
  "/progress/:id/evidence",
  jwtAuth,
  requireRole("org_admin"),
  validateBody(
    z.object({
      tx_hash: z.string().min(10),
      block_number: z.number().int().nonnegative(),
      submitter_address: z.string().optional()
    })
  ),
  (req, res) => {
    const ev = db
      .prepare("SELECT * FROM blockchain_evidence WHERE biz_type='progress' AND biz_id=?")
      .get(req.params.id) as any;
    if (!ev) return res.status(404).json({ error: "NOT_FOUND" });
    db.prepare(
      "UPDATE blockchain_evidence SET tx_hash=?, block_number=?, submitter_address=? WHERE id=?"
    ).run(req.body.tx_hash, req.body.block_number, req.body.submitter_address ?? null, ev.id);
    res.json({ ok: true });
  }
);

export default router;
