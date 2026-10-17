import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { adminRouter } from "./modules/admin/admin.routes";
import { applicationsRouter } from "./modules/applications/applications.routes";
import { errorHandler, notFoundHandler } from "./shared/http";
import { authRouter } from "./modules/auth/auth.routes";
import { healthRouter } from "./modules/health/health.routes";
import { publicRouter } from "./modules/public/public.routes";

export function createApp() {
  const app = express();
  const isProduction = env.nodeEnv === "production";
  const allowedOrigins = new Set(env.allowedOrigins);
  const isLocalDevOrigin = (origin: string) => (
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^https:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
    /^http:\/\/10\.0\.2\.2:\d+$/.test(origin)
  );

  app.use(
    cors({
      origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/+$/, "");
        if (allowedOrigins.has(normalizedOrigin)) return callback(null, true);
        if (!isProduction && isLocalDevOrigin(normalizedOrigin)) return callback(null, true);
        return callback(Object.assign(new Error("Origin is not allowed by Kagie API CORS."), { status: 403 }));
      },
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      name: "Kagie API",
      version: "0.1.0",
      docs: {
        health: "/v1/health",
        publicStats: "/v1/public/stats",
        auth: "/v1/auth",
        applications: "/v1/applications",
        admin: "/v1/admin"
      }
    });
  });

  app.use("/v1", healthRouter);
  app.use("/v1/public", publicRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/applications", applicationsRouter);
  app.use("/v1/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
