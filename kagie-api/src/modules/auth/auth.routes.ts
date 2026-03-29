import { Router } from "express";
import { z } from "zod";
import { ROLES } from "@kagie/shared";
import {
  authenticateSupabase,
  requireSupabaseMasterAdmin,
  type SupabaseAuthenticatedRequest
} from "../../middleware/supabase-auth";
import { ok } from "../../shared/http";
import {
  bootstrapMasterAdmin,
  getUserById,
  login,
  logout,
  refresh,
  registerStudent
} from "./auth.service";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  password: z.string().min(8)
});

router.post("/register", async (req, res) => {
  const input = registerSchema.parse(req.body);
  return ok(res, await registerStudent(input), 201);
});

router.post("/login", async (req, res) => {
  const input = registerSchema.pick({ email: true, password: true }).parse(req.body);
  return ok(res, await login(input));
});

router.post("/refresh", async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  return ok(res, await refresh(body.refreshToken));
});

router.post("/logout", async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  return ok(res, await logout(body.refreshToken));
});

router.get("/me", authenticateSupabase, async (req: SupabaseAuthenticatedRequest, res) => {
  const user = req.supabaseAuth ? await getUserById(req.supabaseAuth.userId) : null;
  if (!user) {
    return res.status(404).json({ message: "Kagie session user not found." });
  }
  return ok(res, user);
});

router.post("/admin/master-admin/bootstrap", async (req, res) => {
  const input = registerSchema.parse(req.body);
  return ok(res, await bootstrapMasterAdmin(input), 201);
});

router.get(
  "/admin/roles",
  authenticateSupabase,
  requireSupabaseMasterAdmin(),
  (_req, res) => ok(res, Object.values(ROLES))
);

export { router as authRouter };
