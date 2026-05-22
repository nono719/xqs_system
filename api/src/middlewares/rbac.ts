import { Request, Response, NextFunction } from "express";
import { Role } from "./auth";

/** 论文 §4.4：基于角色的访问控制 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "未登录" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "权限不足" });
    }
    next();
  };
}
