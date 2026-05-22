import { Router } from "express";
import { db } from "../db";

const router = Router();

/** 公开 —— 仅返回激活项目 */
router.get("/", (req, res) => {
  const status = (req.query.status as string) || "active";
  const rows = db
    .prepare(
      `SELECT p.id, p.org_id, p.onchain_project_id, p.name, p.target_amount, p.raised_amount,
              p.description, p.info_hash, p.status, p.created_at, o.name AS org_name
       FROM projects p LEFT JOIN organizations o ON o.id = p.org_id
       WHERE p.status = ? ORDER BY p.created_at DESC`
    )
    .all(status);
  res.json({ projects: rows });
});

router.get("/:id", (req, res) => {
  const p = db
    .prepare(
      `SELECT p.*, o.name AS org_name FROM projects p
       LEFT JOIN organizations o ON o.id = p.org_id WHERE p.id=?`
    )
    .get(req.params.id) as any;
  if (!p) return res.status(404).json({ error: "NOT_FOUND" });
  const progress = db
    .prepare("SELECT * FROM project_progress WHERE project_id=? ORDER BY created_at ASC")
    .all(p.id);
  res.json({ project: p, progress });
});

export default router;
