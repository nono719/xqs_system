import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/** 论文 §4.4：使用 zod 校验请求体 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "参数错误",
        details: result.error.flatten()
      });
    }
    req.body = result.data;
    next();
  };
}
