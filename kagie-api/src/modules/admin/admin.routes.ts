import { Router } from "express";
import { z } from "zod";
import { requireSupabaseMasterAdmin } from "../../middleware/supabase-auth";
import { ok } from "../../shared/http";
import {
  addInstitutionByAdmin,
  createAssistantAccount,
  deleteInstitutionByAdmin,
  getInstitutionsForAdmin,
  updateInstitutionByAdmin
} from "./admin.service";

const router = Router();

const createAssistantSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().trim().optional().default(""),
  password: z.string().min(6)
});

const facultiesSchema = z.array(z.object({
  name: z.string().min(2),
  courses: z.array(z.string().min(2)).default([])
})).optional().default([]);

const statusOverrideSchema = z.enum(["auto", "open", "closing_soon", "closed"]);

const institutionSchema = z.object({
  name: z.string().min(2),
  shortName: z.string().optional().default(""),
  province: z.string().min(2),
  type: z.string().min(2),
  year: z.string().min(4),
  openingDate: z.string().optional().default(""),
  closingDate: z.string().optional().default(""),
  status: statusOverrideSchema.optional().default("auto"),
  isActive: z.boolean().optional().default(true),
  faculties: facultiesSchema
});

const institutionPatchSchema = institutionSchema.partial();

router.post("/assistants", requireSupabaseMasterAdmin(), async (req, res) => {
  const input = createAssistantSchema.parse(req.body);
  const user = await createAssistantAccount(input);
  return ok(res, user, 201);
});

router.get("/institutions", requireSupabaseMasterAdmin(), async (req, res) => {
  const query = z.object({
    year: z.string().optional(),
    status: z.string().optional(),
    province: z.string().optional(),
    type: z.string().optional(),
    search: z.string().optional()
  }).parse(req.query);
  return ok(res, await getInstitutionsForAdmin(query));
});

router.post("/institutions", requireSupabaseMasterAdmin(), async (req, res) => {
  const input = institutionSchema.parse(req.body);
  return ok(res, await addInstitutionByAdmin(input), 201);
});

router.patch("/institutions/:institutionId", requireSupabaseMasterAdmin(), async (req, res) => {
  const params = z.object({ institutionId: z.string().min(2) }).parse(req.params);
  const input = institutionPatchSchema.parse(req.body);
  return ok(res, await updateInstitutionByAdmin(params.institutionId, input));
});

router.delete("/institutions/:institutionId", requireSupabaseMasterAdmin(), async (req, res) => {
  const params = z.object({ institutionId: z.string().min(2) }).parse(req.params);
  return ok(res, await deleteInstitutionByAdmin(params.institutionId));
});

export { router as adminRouter };
