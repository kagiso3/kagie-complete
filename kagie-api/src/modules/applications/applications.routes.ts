import { Router } from "express";
import { z } from "zod";
import { ROLES, type ApplicationMark } from "@kagie/shared";
import {
  authenticateSupabase,
  requireSupabaseRole,
  type SupabaseAuthenticatedRequest
} from "../../middleware/supabase-auth";
import { ok } from "../../shared/http";
import {
  addInstitution,
  clearCart,
  ensureDraft,
  getCartSummary,
  getDashboardSummary,
  getLatestApplication,
  getNotifications,
  getPackCatalog,
  getProfileSnapshot,
  getReferenceCatalog,
  listInstitutions,
  getSupportSnapshot,
  markNotificationRead,
  removeInstitution,
  requestExtraService,
  requestCallback,
  saveFormSection,
  saveMarks,
  sendSupportMessage,
  setPackage,
  submitCheckout
} from "./applications.service";

const router = Router();

const marksSchema = z.array(
  z.object({
    id: z.string().optional(),
    subject: z.string().min(2),
    percent: z.number().min(0).max(100),
    level: z.number().min(1).max(7)
  })
);

const institutionSchema = z.object({
  institutionId: z.string().optional(),
  province: z.string().min(2),
  institutionType: z.string().min(2),
  institutionName: z.string().min(2),
  faculty: z.string().min(2),
  choice1: z.string().min(2),
  choice2: z.string().min(2),
  choice3: z.string().min(2),
  year: z.string().optional(),
  institutionStatus: z.string().optional(),
  closingDate: z.string().optional()
});

const checkoutSchema = z.object({
  payerName: z.string().min(2),
  phone: z.string().min(6),
  reference: z.string().min(2),
  method: z.enum(["EFT", "Cash Deposit", "Card Transfer", "Mobile Payment"]),
  note: z.string().optional()
});

router.use(authenticateSupabase);
router.use(requireSupabaseRole([ROLES.USER]));

router.get("/catalog", async (req, res) => {
  const query = z.object({
    year: z.string().optional(),
    status: z.string().optional(),
    province: z.string().optional(),
    type: z.string().optional(),
    search: z.string().optional()
  }).parse(req.query);
  return ok(res, await getReferenceCatalog(query));
});
router.get("/packs", async (_req, res) => ok(res, await getPackCatalog()));
router.get("/institutions", async (req, res) => {
  const query = z.object({
    year: z.string().optional(),
    status: z.string().optional(),
    province: z.string().optional(),
    type: z.string().optional(),
    search: z.string().optional()
  }).parse(req.query);
  return ok(res, await listInstitutions(query));
});

router.post("/me/draft", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await ensureDraft(req.supabaseAuth!.userId), 201);
});

router.get("/me/latest", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await getLatestApplication(req.supabaseAuth!.userId));
});

router.put("/me/:applicationId/forms/:section", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({
    applicationId: z.string().uuid(),
    section: z.enum(["learner", "parent", "school", "marks"])
  }).parse(req.params);

  if (params.section === "marks") {
    const payload = z.object({ subjects: marksSchema }).parse(req.body);
    const marks: ApplicationMark[] = payload.subjects.map((item, index) => ({
      id: item.id || `mark-${index + 1}`,
      subject: item.subject,
      percent: item.percent,
      level: item.level
    }));
    return ok(res, await saveMarks(req.supabaseAuth!.userId, params.applicationId, marks));
  }

  const payload = z.record(z.string(), z.union([z.string(), z.number(), z.null()])).parse(req.body);
  return ok(res, await saveFormSection(req.supabaseAuth!.userId, params.applicationId, params.section, payload));
});

router.patch("/me/:applicationId/package", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({ applicationId: z.string().uuid() }).parse(req.params);
  const body = z.object({ packageId: z.string().min(2) }).parse(req.body);
  return ok(res, await setPackage(req.supabaseAuth!.userId, params.applicationId, body.packageId));
});

router.post("/me/:applicationId/institutions", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({ applicationId: z.string().uuid() }).parse(req.params);
  const body = institutionSchema.parse(req.body);
  return ok(res, await addInstitution(req.supabaseAuth!.userId, params.applicationId, body), 201);
});

router.delete("/me/:applicationId/institutions/:institutionId", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({
    applicationId: z.string().uuid(),
    institutionId: z.string().uuid()
  }).parse(req.params);
  return ok(res, await removeInstitution(req.supabaseAuth!.userId, params.applicationId, params.institutionId));
});

router.get("/me/cart", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await getCartSummary(req.supabaseAuth!.userId));
});

router.delete("/me/:applicationId/cart", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({ applicationId: z.string().uuid() }).parse(req.params);
  return ok(res, await clearCart(req.supabaseAuth!.userId, params.applicationId));
});

router.post("/me/:applicationId/checkout", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({ applicationId: z.string().uuid() }).parse(req.params);
  const body = checkoutSchema.parse(req.body);
  return ok(res, await submitCheckout(req.supabaseAuth!.userId, params.applicationId, body), 201);
});

router.get("/me/dashboard", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await getDashboardSummary(req.supabaseAuth!.userId));
});

router.get("/me/notifications", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await getNotifications(req.supabaseAuth!.userId));
});

router.post("/me/notifications/:notificationId/read", async (req: SupabaseAuthenticatedRequest, res) => {
  const params = z.object({ notificationId: z.string().uuid() }).parse(req.params);
  return ok(res, await markNotificationRead(req.supabaseAuth!.userId, params.notificationId));
});

router.get("/me/support", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await getSupportSnapshot(req.supabaseAuth!.userId));
});

router.post("/me/support/messages", async (req: SupabaseAuthenticatedRequest, res) => {
  const body = z.object({ message: z.string().min(2) }).parse(req.body);
  return ok(res, await sendSupportMessage(req.supabaseAuth!.userId, body.message), 201);
});

router.post("/me/support/callback", async (req: SupabaseAuthenticatedRequest, res) => {
  const body = z.object({
    phone: z.string().min(6),
    preferredTime: z.string().optional(),
    note: z.string().optional()
  }).parse(req.body);
  return ok(res, await requestCallback(req.supabaseAuth!.userId, body.phone, body.preferredTime, body.note), 201);
});

router.post("/me/services/request", async (req: SupabaseAuthenticatedRequest, res) => {
  const body = z.object({ serviceId: z.string().min(2) }).parse(req.body);
  return ok(res, await requestExtraService(req.supabaseAuth!.userId, body.serviceId), 201);
});

router.get("/me/profile", async (req: SupabaseAuthenticatedRequest, res) => {
  return ok(res, await getProfileSnapshot(req.supabaseAuth!.userId));
});

export { router as applicationsRouter };
