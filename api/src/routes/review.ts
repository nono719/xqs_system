import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { jwtAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import { validateBody } from "../middlewares/validate";

const router = Router();

/** 待领取任务列表 */
router.get("/tasks", jwtAuth, requireRole("reviewer", "admin"), (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM review_tasks WHERE status='pending' ORDER BY created_at ASC")
    .all();
  res.json({ tasks: rows });
});

/** 我领取的任务 */
router.get("/tasks/mine", jwtAuth, requireRole("reviewer", "admin"), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM review_tasks WHERE reviewer_id=? ORDER BY claimed_at DESC")
    .all(req.user!.id);
  res.json({ tasks: rows });
});

/** 任务详情 + 业务对象 */
router.get("/tasks/:id", jwtAuth, requireRole("reviewer", "admin"), (req, res) => {
  const task = db.prepare("SELECT * FROM review_tasks WHERE id=?").get(req.params.id) as any;
  if (!task) return res.status(404).json({ error: "NOT_FOUND" });
  let detail: any = null;
  if (task.biz_type === "org") {
    detail = db.prepare("SELECT * FROM organizations WHERE id=?").get(task.biz_id);
  } else if (task.biz_type === "project") {
    detail = db.prepare("SELECT * FROM projects WHERE id=?").get(task.biz_id);
  }
  res.json({ task, detail });
});

/** 领取 */
router.post("/tasks/:id/claim", jwtAuth, requireRole("reviewer", "admin"), (req, res) => {
  const r = db
    .prepare(
      "UPDATE review_tasks SET status='claimed', reviewer_id=?, claimed_at=? WHERE id=? AND status='pending'"
    )
    .run(req.user!.id, new Date().toISOString(), req.params.id);
  if (r.changes === 0)
    return res.status(409).json({ error: "TASK_CLAIMED", message: "任务已被领取" });
  res.json({ ok: true });
});

/** 放弃 */
router.post("/tasks/:id/release", jwtAuth, requireRole("reviewer", "admin"), (req, res) => {
  const r = db
    .prepare(
      "UPDATE review_tasks SET status='pending', reviewer_id=NULL, claimed_at=NULL WHERE id=? AND reviewer_id=?"
    )
    .run(req.params.id, req.user!.id);
  if (r.changes === 0) return res.status(400).json({ error: "INVALID_STATE" });
  res.json({ ok: true });
});

/** 决策 */
router.post(
  "/tasks/:id/decide",
  jwtAuth,
  requireRole("reviewer", "admin"),
  validateBody(
    z.object({
      result: z.enum(["approved", "rejected"]),
      reject_reason: z.string().max(512).optional()
    })
  ),
  (req, res) => {
    const task = db.prepare("SELECT * FROM review_tasks WHERE id=?").get(req.params.id) as any;
    if (!task) return res.status(404).json({ error: "NOT_FOUND" });
    if (task.status !== "claimed" || task.reviewer_id !== req.user!.id)
      return res.status(403).json({ error: "FORBIDDEN" });
    const { result, reject_reason } = req.body;
    if (result === "rejected" && !reject_reason)
      return res.status(400).json({ error: "REASON_REQUIRED", message: "驳回必须填写原因" });
    const now = new Date().toISOString();

    db.prepare(
      "UPDATE review_tasks SET status='done', result=?, reject_reason=?, completed_at=? WHERE id=?"
    ).run(result, reject_reason ?? null, now, task.id);

    // 同步业务对象状态
    if (task.biz_type === "org") {
      db.prepare("UPDATE organizations SET status=? WHERE id=?").run(result, task.biz_id);
    } else if (task.biz_type === "project") {
      if (result === "approved") {
        db.prepare("UPDATE projects SET status='approved', updated_at=? WHERE id=?").run(
          now,
          task.biz_id
        );
      } else {
        db.prepare(
          "UPDATE projects SET status='rejected', reject_reason=?, updated_at=? WHERE id=?"
        ).run(reject_reason ?? null, now, task.biz_id);
      }
    }
    res.json({ ok: true });
  }
);

export default router;
