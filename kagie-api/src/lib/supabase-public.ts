import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

let supabasePublicClient: ReturnType<typeof createClient> | null = null;

function assertSupabasePublicConfig() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase public configuration is unavailable.");
  }
}

export function getSupabasePublicClient() {
  assertSupabasePublicConfig();
  if (!supabasePublicClient) {
    supabasePublicClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }
  return supabasePublicClient;
}
