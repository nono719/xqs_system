import { Router } from "express";
import { db } from "../db";

const router = Router();

/**
 * 论文 §6.2.3 溯源时间轴：
 *   trace_code → donations → blockchain_evidence + project_progress
 *   合并为统一 timeline { type, title, time, data }，按时间排序返回
 */
router.get("/:code", (req, res) => {
  const code = req.params.code;
  const donation = db
    .prepare(
      `SELECT d.*, p.name AS project_name, p.org_id, o.name AS org_name
       FROM donations d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN organizations o ON o.id = p.org_id
       WHERE d.trace_code = ?`
    )
    .get(code) as any;

  if (!donation) return res.status(404).json({ error: "NOT_FOUND", message: "溯源码不存在" });

  const donationEvidence = db
    .prepare("SELECT * FROM blockchain_evidence WHERE biz_type='donation' AND biz_id=?")
    .get(donation.id) as any;

  const progressRows = db
    .prepare("SELECT * FROM project_progress WHERE project_id=? ORDER BY created_at ASC")
    .all(donation.project_id) as any[];

  const progressEvidence = db
    .prepare(
      `SELECT * FROM blockchain_evidence WHERE biz_type='progress' AND biz_id IN (${progressRows
        .map(() => "?")
        .join(",") || "''"})`
    )
    .all(...progressRows.map((p: any) => p.id)) as any[];
  const evByBizId = new Map(progressEvidence.map((e: any) => [e.biz_id, e]));

  const timeline: any[] = [];

  timeline.push({
    type: "donation_created",
    title: "捐赠已创建",
    time: donation.created_at,
    data: {
      donation_id: donation.id,
      trace_code: donation.trace_code,
      amount: donation.amount,
      currency: donation.currency,
      donor_address: donation.donor_address,
      project_name: donation.project_name,
      org_name: donation.org_name,
      tx_hash: donation.tx_hash,
      mode: donation.mode
    }
  });

  if (donationEvidence) {
    timeline.push({
      type: "evidence_committed",
      title: "证据已上链",
      time: donationEvidence.committed_at,
      data: {
        data_hash: donationEvidence.data_hash,
        tx_hash: donationEvidence.tx_hash,
        block_number: donationEvidence.block_number,
        submitter_address: donationEvidence.submitter_address
      }
    });
  }

  for (const p of progressRows) {
    const ev = evByBizId.get(p.id);
    timeline.push({
      type: "project_progress",
      title: `项目进展：${p.title}`,
      time: p.created_at,
      data: {
        progress_id: p.id,
        content: p.content,
        progress_hash: p.progress_hash,
        tx_hash: ev?.tx_hash ?? null,
        block_number: ev?.block_number ?? null
      }
    });
  }

  timeline.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  res.json({
    trace_code: code,
    project: {
      id: donation.project_id,
      name: donation.project_name,
      org_name: donation.org_name
    },
    timeline
  });
});

export default router;
