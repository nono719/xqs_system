import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db";
import { jwtAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validateBody } from "../middlewares/validate";

const router = Router();

/** 创建审核员账号 */
router.post(
  "/reviewers",
  jwtAuth,
  requireRole("admin"),
  validateBody(z.object({ email: z.string().email(), password: z.string().min(6) })),
  (req, res) => {
    const { email, password } = req.body;
    const exist = db.prepare("SELECT id FROM users WHERE email=?").get(email);
    if (exist) return res.status(409).json({ error: "EMAIL_EXISTS" });
    const id = nanoid();
    db.prepare(
      "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?,?,?,?,?)"
    ).run(id, email, bcrypt.hashSync(password, 10), "reviewer", new Date().toISOString());
    res.json({ id, email, role: "reviewer" });
  }
);

/** 用户管理 */
router.get("/users", jwtAuth, requireRole("admin"), (_req, res) => {
  const rows = db
    .prepare(
      "SELECT id, email, role, org_id, disabled, created_at FROM users ORDER BY created_at DESC"
    )
    .all();
  res.json({ users: rows });
});

router.post(
  "/users/:id/disable",
  jwtAuth,
  requireRole("admin"),
  validateBody(z.object({ disabled: z.boolean() })),
  (req, res) => {
    db.prepare("UPDATE users SET disabled=? WHERE id=?").run(
      req.body.disabled ? 1 : 0,
      req.params.id
    );
    res.json({ ok: true });
  }
);

/** 待审批机构列表 */
router.get("/organizations", jwtAuth, requireRole("admin"), (_req, res) => {
  const rows = db.prepare("SELECT * FROM organizations ORDER BY created_at DESC").all();
  res.json({ organizations: rows });
});

/** 全平台项目列表（审计用） */
router.get("/projects", jwtAuth, requireRole("admin"), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, o.name AS org_name FROM projects p
       LEFT JOIN organizations o ON o.id = p.org_id
       ORDER BY p.created_at DESC`
    )
    .all();
  res.json({ projects: rows });
});

export default router;
