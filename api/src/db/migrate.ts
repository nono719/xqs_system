import { db } from "./index";
import bcrypt from "bcryptjs";

/**
 * 论文 §4.3 数据库设计：8 张表
 * - users / organizations / projects / review_tasks
 * - donations / blockchain_evidence / project_progress / project_materials
 */
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('donor','org_admin','reviewer','admin')),
      org_id TEXT,
      created_at TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      intro TEXT,
      qualification_hash TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
      admin_user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      onchain_project_id INTEGER,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      raised_amount REAL NOT NULL DEFAULT 0,
      description TEXT,
      info_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','pending_review','approved','rejected','active','closed')) DEFAULT 'draft',
      reject_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS review_tasks (
      id TEXT PRIMARY KEY,
      biz_type TEXT NOT NULL CHECK(biz_type IN ('org','project')),
      biz_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','claimed','done')) DEFAULT 'pending',
      reviewer_id TEXT,
      result TEXT CHECK(result IN ('approved','rejected') OR result IS NULL),
      reject_reason TEXT,
      claimed_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      trace_code TEXT UNIQUE NOT NULL,
      project_id TEXT NOT NULL,
      donor_user_id TEXT,
      donor_address TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ETH',
      tx_hash TEXT,
      mode TEXT NOT NULL CHECK(mode IN ('demo','onchain')) DEFAULT 'onchain',
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS blockchain_evidence (
      id TEXT PRIMARY KEY,
      biz_type TEXT NOT NULL CHECK(biz_type IN ('donation','progress','project','org')),
      biz_id TEXT NOT NULL,
      data_hash TEXT NOT NULL,
      tx_hash TEXT,
      block_number INTEGER,
      submitter_address TEXT,
      committed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_biz ON blockchain_evidence(biz_type, biz_id);

    CREATE TABLE IF NOT EXISTS project_progress (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      progress_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS project_materials (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);

  // 种子默认 admin 账号
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@xqs.local");
  if (!existing) {
    const id = "admin-seed";
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?,?,?,?,?)`
    ).run(id, "admin@xqs.local", hash, "admin", new Date().toISOString());
    console.log("Seeded default admin: admin@xqs.local / admin123");
  }
}

if (require.main === module) {
  migrate();
  console.log("Migrate done.");
}
