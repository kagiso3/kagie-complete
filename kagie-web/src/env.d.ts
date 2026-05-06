import type { LegacyApi } from "./lib/types";

declare global {
  interface Window {
    KagieAPI?: LegacyApi;
    KagieData?: Record<string, unknown>;
    supabase?: {
      createClient: (...args: unknown[]) => unknown;
    };
  }
}

export {};
