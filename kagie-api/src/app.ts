import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { adminRouter } from "./modules/admin/admin.routes";
import { applicationsRouter } from "./modules/applications/applications.routes";
import { errorHandler, notFoundHandler } from "./shared/http";
import { authRouter } from "./modules/auth/auth.routes";
import { healthRouter } from "./modules/health/health.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
        if (!origin || origin === "null") return callback(null, true);
        if (origin === env.webAppUrl) return callback(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        if (/^https:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed by Kagie API CORS."));
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
        auth: "/v1/auth",
        applications: "/v1/applications",
        admin: "/v1/admin"
      }
    });
  });

  app.use("/v1", healthRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/applications", applicationsRouter);
  app.use("/v1/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
