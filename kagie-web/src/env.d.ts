import type { LegacyApi } from "./lib/types";

declare global {
  interface Window {
    KagieAPI?: LegacyApi;
    KagieData?: Record<string, unknown>;
    KagieNativeOAuth?: { version: number };
    KagieNativeOAuthReturning?: boolean;
    supabase?: {
      createClient: (...args: unknown[]) => unknown;
    };
  }
}

export {};
