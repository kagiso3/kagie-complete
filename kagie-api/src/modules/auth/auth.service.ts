import type {
  AuthSession,
  BootstrapMasterAdminInput,
  LoginInput,
  RegisterStudentInput,
  Role,
  UserRecord
} from "@kagie/shared";
import { ROLES } from "@kagie/shared";
import {
  createSupabaseAuthClient,
  getSupabaseAdminClient,
  getSupabaseProfileById,
  mapSupabaseProfileToUserRecord
} from "../../lib/supabase";

type BasicUserDetails = {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
};

type RemoteAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function nowISO() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createError(message: string, status: number) {
  const error = new Error(message);
  (error as Error & { status: number }).status = status;
  return error;
}

function readMetadataString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function sessionToTokens(session: { access_token: string; refresh_token?: string | null } | null | undefined) {
  if (!session?.access_token || !session.refresh_token) {
    throw createError(
      "Supabase signup/login did not return a session. Disable email confirmation for the MVP or complete the email verification step first.",
      400
    );
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token
  };
}

async function ensureUserDataScaffold(userId: string, details: BasicUserDetails) {
  const client = getSupabaseAdminClient() as any;
  const timestamp = nowISO();

  const [profileResult, userProfileResult, guardianProfileResult, schoolProfileResult, cartResult] = await Promise.all([
    client
      .from("profiles")
      .upsert({
        id: userId,
        full_name: details.fullName,
        email: details.email,
        phone: details.phone,
        role: details.role,
        updated_at: timestamp
      })
      .select("*")
      .single(),
    client.from("user_profiles").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" }),
    client.from("guardian_profiles").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" }),
    client.from("school_profiles").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" }),
    client.from("carts").upsert({ user_id: userId, updated_at: timestamp }, { onConflict: "user_id" })
  ]);

  const writeErrors = [
    profileResult.error,
    userProfileResult.error,
    guardianProfileResult.error,
    schoolProfileResult.error,
    cartResult.error
  ].filter(Boolean);
  if (writeErrors.length) {
    throw createError(writeErrors[0]?.message || "Could not finish preparing the Kagie profile.", 500);
  }

  if (details.role === ROLES.USER) {
    const existingDraft = await client
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "Draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDraft.error) {
      throw createError(existingDraft.error.message || "Could not load the Kagie draft.", 500);
    }

    if (!existingDraft.data) {
      const createdDraft = await client.from("applications").insert({ user_id: userId }).select("id").single();
      if (createdDraft.error) {
        throw createError(createdDraft.error.message || "Could not create the starter Kagie draft.", 500);
      }
    }
  }

  const profile = profileResult.data;
  if (!profile) {
    throw createError("Kagie profile scaffold finished, but the profile record could not be returned.", 500);
  }

  return mapSupabaseProfileToUserRecord(profile);
}

async function hydrateUserRecord(userId: string) {
  const profile = await getSupabaseProfileById(userId);
  if (!profile) {
    throw createError("Kagie profile was not found for this authenticated user.", 404);
  }
  return mapSupabaseProfileToUserRecord(profile);
}

async function hydrateOrCreateUserRecord(user: RemoteAuthUser, fallbackRole: Role) {
  const details: BasicUserDetails = {
    fullName: readMetadataString(user.user_metadata, "full_name") || "Kagie User",
    email: normalizeEmail(user.email || ""),
    phone: readMetadataString(user.user_metadata, "phone"),
    role: (readMetadataString(user.user_metadata, "role") as Role) || fallbackRole
  };

  const existing = await getSupabaseProfileById(user.id);
  if (existing) {
    if (
      existing.full_name !== details.fullName
      || existing.email !== details.email
      || (details.phone && existing.phone !== details.phone)
      || existing.role !== details.role
    ) {
      return ensureUserDataScaffold(user.id, details);
    }
    return mapSupabaseProfileToUserRecord(existing);
  }

  return ensureUserDataScaffold(user.id, details);
}

export async function registerStudent(input: RegisterStudentInput): Promise<AuthSession> {
  const client = createSupabaseAuthClient();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role: ROLES.USER
      }
    }
  });

  if (error || !data.user) {
    throw createError(error?.message || "Could not create the Kagie student account.", error?.message?.toLowerCase().includes("already") ? 409 : 500);
  }

  const user = await ensureUserDataScaffold(data.user.id, {
    fullName,
    email,
    phone,
    role: ROLES.USER
  });

  return {
    user,
    tokens: sessionToTokens(data.session)
  };
}

export async function bootstrapMasterAdmin(input: BootstrapMasterAdminInput): Promise<AuthSession> {
  const client = getSupabaseAdminClient() as any;
  const existingMaster = await client
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .eq("role", ROLES.MASTER_ADMIN);

  if (existingMaster.error) {
    throw createError(existingMaster.error.message || "Could not check the Kagie admin roster.", 500);
  }
  if ((existingMaster.count || 0) > 0) {
    throw createError("A Kagie master admin already exists. Create future admins from protected routes.", 409);
  }

  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  const created = await client.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: ROLES.MASTER_ADMIN
    },
    app_metadata: {
      role: ROLES.MASTER_ADMIN
    }
  });

  if (created.error || !created.data.user) {
    throw createError(created.error?.message || "Could not create the Kagie master admin account.", created.error?.message?.toLowerCase().includes("already") ? 409 : 500);
  }

  const user = await ensureUserDataScaffold(created.data.user.id, {
    fullName,
    email,
    phone,
    role: ROLES.MASTER_ADMIN
  });

  const authClient = createSupabaseAuthClient();
  const session = await authClient.auth.signInWithPassword({
    email,
    password: input.password
  });

  if (session.error) {
    throw createError(session.error.message || "Master admin account was created, but the first login session could not be started.", 500);
  }

  return {
    user,
    tokens: sessionToTokens(session.data.session)
  };
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const client = createSupabaseAuthClient();
  const email = normalizeEmail(input.email);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.password
  });

  if (error || !data.user) {
    throw createError(error?.message || "Incorrect email or password.", 401);
  }

  const user = await hydrateOrCreateUserRecord(data.user as RemoteAuthUser, ROLES.USER);
  return {
    user,
    tokens: sessionToTokens(data.session)
  };
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const profile = await getSupabaseProfileById(userId);
  return profile ? mapSupabaseProfileToUserRecord(profile) : null;
}

export async function refresh(refreshToken: string): Promise<AuthSession> {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken
  } as any);

  if (error || !data.user) {
    throw createError(error?.message || "Refresh token is no longer valid.", 401);
  }

  const user = await hydrateOrCreateUserRecord(data.user as RemoteAuthUser, ROLES.USER);
  return {
    user,
    tokens: sessionToTokens(data.session)
  };
}

export async function logout(refreshToken: string) {
  const client = createSupabaseAuthClient();
  const refreshed = await client.auth.refreshSession({
    refresh_token: refreshToken
  } as any);

  if (refreshed.error) {
    throw createError(refreshed.error.message || "Refresh token is no longer valid.", 401);
  }

  const signOut = await client.auth.signOut();
  if (signOut.error) {
    throw createError(signOut.error.message || "Could not close the Kagie session.", 500);
  }

  return { success: true };
}
