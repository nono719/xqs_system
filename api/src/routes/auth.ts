import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db";
import { validateBody } from "../middlewares/validate";
import { signToken, jwtAuth } from "../middlewares/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(64),
  role: z.enum(["donor", "org_admin"]).default("donor")
});

router.post("/register", validateBody(registerSchema), (req, res) => {
  const { email, password, role } = req.body as z.infer<typeof registerSchema>;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "EMAIL_EXISTS", message: "邮箱已注册" });
  }
  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?,?,?,?,?)"
  ).run(id, email, hash, role, new Date().toISOString());
  res.json({ id, email, role });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", validateBody(loginSchema), (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = db
    .prepare(
      "SELECT id, email, password_hash, role, org_id, disabled FROM users WHERE email = ?"
    )
    .get(email) as any;
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "账号或密码错误" });
  if (user.disabled) return res.status(403).json({ error: "USER_DISABLED", message: "账号已被禁用" });
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "账号或密码错误" });
  }
  const token = signToken({ id: user.id, email: user.email, role: user.role, org_id: user.org_id });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, org_id: user.org_id } });
});

router.get("/me", jwtAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
