import { Router } from "express";
import { env } from "../../config/env";
import { ok } from "../../shared/http";

const router = Router();

router.get("/health", (_req, res) => {
  return ok(res, {
    service: "kagie-api",
    status: "ok",
    environment: env.nodeEnv,
    databaseProvider: env.databaseProvider,
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };
