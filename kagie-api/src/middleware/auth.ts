import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload, Role } from "@kagie/shared";
import { env } from "../config/env";

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

function getBearerToken(req: Request) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Missing access token." });
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AuthTokenPayload;
    if (payload.type !== "access") {
      return res.status(401).json({ message: "Invalid token type." });
    }
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: error instanceof Error ? error.message : "Invalid access token."
    });
  }
}

export function requireRole(allowed: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (!allowed.includes(req.auth.role)) {
      return res.status(403).json({ message: "You do not have permission for this route." });
    }
    return next();
  };
}
