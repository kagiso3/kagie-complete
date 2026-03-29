import type {
  ApplicationMark,
  ApplicationRecord,
  AuthSession,
  LoginInput,
  RegisterStudentInput,
  UserRecord
} from "@kagie/shared";
import { mobileConfig } from "../config";
import type {
  CartSummary,
  CheckoutInput,
  DashboardSummary,
  InstitutionInput,
  MobileCatalog,
  ProfileSnapshot,
  SupportSnapshot
} from "../types/mobile";
import { clearStoredTokens, getStoredTokens, saveTokens } from "./storage";

type ApiEnvelope<T> = {
  data: T;
};

async function request<T>(path: string, init?: RequestInit, accessToken?: string) {
  const response = await fetch(`${mobileConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {})
    }
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((json as { message?: string }).message || "The Kagie API request failed.");
  }

  return (json as ApiEnvelope<T>).data;
}

async function refreshTokens(refreshToken: string) {
  const session = await request<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
  await saveTokens(session.tokens.accessToken, session.tokens.refreshToken);
  return session;
}

async function withSession<T>(path: string, init?: RequestInit) {
  const stored = await getStoredTokens();
  let accessToken = stored.accessToken;

  if (!accessToken && stored.refreshToken) {
    const refreshed = await refreshTokens(stored.refreshToken);
    accessToken = refreshed.tokens.accessToken;
  }

  if (!accessToken) {
    throw new Error("No Kagie session is available on this device.");
  }

  try {
    return await request<T>(path, init, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!stored.refreshToken || !/token|jwt|expired|401|access/i.test(message)) {
      throw error;
    }

    const refreshed = await refreshTokens(stored.refreshToken);
    return request<T>(path, init, refreshed.tokens.accessToken);
  }
}

export const apiClient = {
  register: (input: RegisterStudentInput) =>
    request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    }),

  login: (input: LoginInput) =>
    request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    }),

  refresh: (refreshToken: string) =>
    request<AuthSession>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    }),

  me: (accessToken: string) =>
    request<UserRecord>("/auth/me", {
      method: "GET"
    }, accessToken),

  logout: async (refreshToken: string) => {
    try {
      return await request<{ success: boolean }>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      });
    } finally {
      await clearStoredTokens();
    }
  },

  restoreSession: async () => {
    const stored = await getStoredTokens();
    if (!stored.accessToken && !stored.refreshToken) return null;

    try {
      if (stored.accessToken) {
        return await request<UserRecord>("/auth/me", { method: "GET" }, stored.accessToken);
      }
      if (stored.refreshToken) {
        const session = await refreshTokens(stored.refreshToken);
        return session.user;
      }
      return null;
    } catch (_error) {
      if (!stored.refreshToken) {
        await clearStoredTokens();
        return null;
      }

      try {
        const session = await refreshTokens(stored.refreshToken);
        return session.user;
      } catch {
        await clearStoredTokens();
        return null;
      }
    }
  },

  getCatalog: () => withSession<MobileCatalog>("/applications/catalog"),
  getLatestApplication: () => withSession<ApplicationRecord | null>("/applications/me/latest"),
  ensureDraft: () => withSession<ApplicationRecord>("/applications/me/draft", { method: "POST" }),
  saveFormSection: (applicationId: string, section: "learner" | "parent" | "school", payload: Record<string, string | number | null>) =>
    withSession<ApplicationRecord>(`/applications/me/${applicationId}/forms/${section}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  saveMarks: (applicationId: string, subjects: ApplicationMark[]) =>
    withSession<ApplicationRecord>(`/applications/me/${applicationId}/forms/marks`, {
      method: "PUT",
      body: JSON.stringify({ subjects })
    }),
  selectPackage: (applicationId: string, packageId: string) =>
    withSession<ApplicationRecord>(`/applications/me/${applicationId}/package`, {
      method: "PATCH",
      body: JSON.stringify({ packageId })
    }),
  addInstitution: (applicationId: string, payload: InstitutionInput) =>
    withSession<ApplicationRecord>(`/applications/me/${applicationId}/institutions`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  removeInstitution: (applicationId: string, institutionId: string) =>
    withSession<ApplicationRecord>(`/applications/me/${applicationId}/institutions/${institutionId}`, {
      method: "DELETE"
    }),
  getDashboard: () => withSession<DashboardSummary>("/applications/me/dashboard"),
  getCart: () => withSession<CartSummary>("/applications/me/cart"),
  clearCart: (applicationId: string) =>
    withSession<ApplicationRecord>(`/applications/me/${applicationId}/cart`, {
      method: "DELETE"
    }),
  checkout: (applicationId: string, payload: CheckoutInput) =>
    withSession<{ application: ApplicationRecord } & { payment: unknown }>(`/applications/me/${applicationId}/checkout`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getNotifications: () => withSession<DashboardSummary["notifications"]>("/applications/me/notifications"),
  markNotificationRead: (notificationId: string) =>
    withSession(`/applications/me/notifications/${notificationId}/read`, {
      method: "POST"
    }),
  getSupport: () => withSession<SupportSnapshot>("/applications/me/support"),
  sendSupportMessage: (message: string) =>
    withSession<SupportSnapshot>("/applications/me/support/messages", {
      method: "POST",
      body: JSON.stringify({ message })
    }),
  requestCallback: (payload: { phone: string; preferredTime?: string; note?: string }) =>
    withSession("/applications/me/support/callback", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  requestService: (serviceId: string) =>
    withSession<{ service: unknown; support: SupportSnapshot }>("/applications/me/services/request", {
      method: "POST",
      body: JSON.stringify({ serviceId })
    }),
  getProfile: () => withSession<ProfileSnapshot>("/applications/me/profile")
};
