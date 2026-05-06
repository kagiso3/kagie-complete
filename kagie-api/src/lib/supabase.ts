import { createClient } from "@supabase/supabase-js";
import type { Role, UserRecord } from "@kagie/shared";
import { ROLES } from "@kagie/shared";
import { env } from "../config/env";

export type RemoteProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  profile_image?: string;
  created_at?: string;
  updated_at?: string;
};

let supabaseAdminClient: ReturnType<typeof createClient> | null = null;

function assertSupabaseConfig() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    const error = new Error("Supabase server configuration is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    (error as Error & { status: number }).status = 500;
    throw error;
  }
}

function assertSupabaseAuthConfig() {
  if (!env.supabaseUrl || (!env.supabaseAnonKey && !env.supabaseServiceRoleKey)) {
    const error = new Error("Supabase auth configuration is missing. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
    (error as Error & { status: number }).status = 500;
    throw error;
  }
}

export function getSupabaseAdminClient() {
  assertSupabaseConfig();
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminClient;
}

export function createSupabaseAuthClient() {
  assertSupabaseAuthConfig();
  return createClient(env.supabaseUrl, env.supabaseAnonKey || env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

export async function getSupabaseUserFromAccessToken(accessToken: string) {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    const wrapped = new Error(error?.message || "Supabase access token is invalid.");
    (wrapped as Error & { status: number }).status = 401;
    throw wrapped;
  }
  return data.user;
}

export async function getSupabaseProfileById(userId: string): Promise<RemoteProfile | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    const wrapped = new Error(error.message || "Could not load Supabase profile.");
    (wrapped as Error & { status: number }).status = 500;
    throw wrapped;
  }
  return (data as RemoteProfile | null) || null;
}

export function mapSupabaseProfileToUserRecord(profile: RemoteProfile): UserRecord {
  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    createdAt: profile.created_at || new Date().toISOString(),
    updatedAt: profile.updated_at || new Date().toISOString()
  };
}

export async function assertSupabaseMasterAdmin(accessToken: string) {
  const user = await getSupabaseUserFromAccessToken(accessToken);
  const profile = await getSupabaseProfileById(user.id);
  if (!profile || profile.role !== ROLES.MASTER_ADMIN) {
    const error = new Error("Only a Kagie master admin can create assistant accounts.");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
  return { user, profile };
}
