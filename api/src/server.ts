import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { config } from "./config";
import { migrate } from "./db/migrate";
import authRouter from "./routes/auth";
import orgRouter from "./routes/org";
import reviewRouter from "./routes/review";
import adminRouter from "./routes/admin";
import projectsRouter from "./routes/projects";
import donationsRouter from "./routes/donations";
import traceRouter from "./routes/trace";
import chainRouter from "./routes/chain";

migrate();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use("/auth", authRouter);
app.use("/org", orgRouter);
app.use("/review", reviewRouter);
app.use("/admin", adminRouter);
app.use("/projects", projectsRouter);
app.use("/donations", donationsRouter);
app.use("/trace", traceRouter);
app.use("/chain", chainRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL", message: err?.message ?? "服务异常" });
};
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[xqs/api] listening on http://localhost:${config.port}`);
  console.log(`[xqs/api] chain: ${config.chain.rpcUrl} (chainId ${config.chain.chainId})`);
  console.log(`[xqs/api] contract: ${config.chain.contractAddress || "(not deployed)"}`);
});
