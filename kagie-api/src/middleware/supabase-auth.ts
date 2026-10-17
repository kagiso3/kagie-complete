import type { NextFunction, Request, Response } from "express";
import type { Role } from "@kagie/shared";
import { assertSupabaseMasterAdmin, assertSupabaseUserActive, getTrustedSupabaseRole, getSupabaseProfileById, getSupabaseUserFromAccessToken } from "../lib/supabase";

export type SupabaseAuthenticatedRequest = Request & {
  supabaseAuth?: {
    userId: string;
    email: string;
    role: Role;
  };
};

function getBearerToken(req: Request) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function authenticateSupabase(req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Missing Supabase access token." });
  }

  try {
    const user = await getSupabaseUserFromAccessToken(token);
    const profile = await getSupabaseProfileById(user.id);
    if (!profile) return res.status(403).json({ message: "Kagie profile is unavailable." });
    assertSupabaseUserActive(user, profile);
    req.supabaseAuth = {
      userId: user.id,
      email: user.email || "",
      role: getTrustedSupabaseRole(user)
    };
    return next();
  } catch (error) {
    const status = (error as { status?: number })?.status === 403 ? 403 : 401;
    return res.status(status).json({ message: status === 403 ? "This Kagie account is unavailable. Contact support." : "Supabase access token rejected." });
  }
}

export function requireSupabaseRole(allowed: Role[]) {
  return (req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.supabaseAuth) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (!allowed.includes(req.supabaseAuth.role)) {
      return res.status(403).json({ message: "You do not have permission for this route." });
    }
    return next();
  };
}

export function requireSupabaseMasterAdmin() {
  return async (req: SupabaseAuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: "Missing Supabase access token." });
    }

    try {
      const { user, profile } = await assertSupabaseMasterAdmin(token);
      req.supabaseAuth = {
        userId: user.id,
        email: user.email || "",
        role: profile.role
      };
      return next();
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 403;

      return res.status(status).json({
        message: status >= 500 ? "Kagie could not complete this request. Please try again." : error instanceof Error ? error.message : "You do not have permission for this route."
      });
    }
  };
}
