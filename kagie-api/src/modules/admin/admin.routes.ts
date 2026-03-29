import { Router } from "express";
import { z } from "zod";
import { requireSupabaseMasterAdmin } from "../../middleware/supabase-auth";
import { ok } from "../../shared/http";
import { createAssistantAccount } from "./admin.service";

const router = Router();

const createAssistantSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().trim().optional().default(""),
  password: z.string().min(6)
});

router.post("/assistants", requireSupabaseMasterAdmin(), async (req, res) => {
  const input = createAssistantSchema.parse(req.body);
  const user = await createAssistantAccount(input);
  return ok(res, user, 201);
});

export { router as adminRouter };
