import type { CreateAssistantInput, UserRecord } from "@kagie/shared";
import { ROLES } from "@kagie/shared";
import { getSupabaseAdminClient } from "../../lib/supabase";
import {
  addInstitutionCatalogEntry,
  deleteInstitutionCatalogEntry,
  listInstitutions,
  updateInstitutionCatalogEntry
} from "../applications/applications.service";

function nowISO() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createAssistantAccount(input: CreateAssistantInput): Promise<UserRecord> {
  const client = getSupabaseAdminClient() as any;
  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim();
  const password = input.password;

  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: ROLES.ASSISTANT_ADMIN
    },
    app_metadata: {
      role: ROLES.ASSISTANT_ADMIN
    }
  });

  if (created.error || !created.data.user) {
    const wrapped = new Error(created.error?.message || "Could not create the assistant auth account.");
    (wrapped as Error & { status: number }).status = created.error?.message?.toLowerCase().includes("already") ? 409 : 500;
    throw wrapped;
  }

  const userId = created.data.user.id;
  const timestamp = nowISO();

  const [profileResult, userProfileResult, guardianProfileResult, schoolProfileResult, cartResult] = await Promise.all([
    client
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName,
        email,
        phone,
        role: ROLES.ASSISTANT_ADMIN,
        updated_at: timestamp
      })
      .select("*")
      .single(),
    client.from("user_profiles").upsert({ user_id: userId }),
    client.from("guardian_profiles").upsert({ user_id: userId }),
    client.from("school_profiles").upsert({ user_id: userId }),
    client.from("carts").upsert({ user_id: userId }, { onConflict: "user_id" })
  ]);

  const writeErrors = [profileResult.error, userProfileResult.error, guardianProfileResult.error, schoolProfileResult.error, cartResult.error].filter(Boolean);
  if (writeErrors.length) {
    const wrapped = new Error(writeErrors[0]?.message || "Could not finish creating the assistant profile.");
    (wrapped as Error & { status: number }).status = 500;
    throw wrapped;
  }

  const profile = profileResult.data as {
    full_name: string;
    email: string;
    phone?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;

  if (!profile) {
    const wrapped = new Error("Assistant auth account was created, but the Kagie profile record was not returned.");
    (wrapped as Error & { status: number }).status = 500;
    throw wrapped;
  }

  return {
    id: userId,
    role: ROLES.ASSISTANT_ADMIN,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone || "",
    createdAt: profile.created_at || timestamp,
    updatedAt: profile.updated_at || timestamp
  };
}

export async function getInstitutionsForAdmin(filters?: {
  year?: string;
  status?: string;
  province?: string;
  type?: string;
  search?: string;
}) {
  return listInstitutions({
    ...(filters || {}),
    includeInactive: true
  });
}

export async function addInstitutionByAdmin(input: {
  name: string;
  shortName?: string;
  province: string;
  type: string;
  year: string;
  openingDate?: string;
  closingDate?: string;
  status?: "auto" | "open" | "closing_soon" | "closed";
  isActive?: boolean;
  faculties?: Array<{ name: string; courses: string[] }>;
}) {
  return addInstitutionCatalogEntry({
    name: input.name,
    shortName: input.shortName,
    province: input.province,
    type: input.type,
    year: input.year,
    openingDate: input.openingDate,
    closingDate: input.closingDate,
    isActive: input.isActive,
    faculties: input.faculties,
    manualStatus: input.status === "auto" ? "" : input.status
  });
}

export async function updateInstitutionByAdmin(id: string, patch: {
  name?: string;
  shortName?: string;
  province?: string;
  type?: string;
  year?: string;
  openingDate?: string;
  closingDate?: string;
  status?: "auto" | "open" | "closing_soon" | "closed";
  isActive?: boolean;
  faculties?: Array<{ name: string; courses: string[] }>;
}) {
  return updateInstitutionCatalogEntry(id, {
    ...patch,
    manualStatus: patch.status === "auto" ? "" : patch.status
  });
}

export async function deleteInstitutionByAdmin(id: string) {
  return deleteInstitutionCatalogEntry(id);
}
