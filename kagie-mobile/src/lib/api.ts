import type {
  ApplicationMark,
  ApplicationRecord,
  AuthSession,
  DocumentRecord,
  LoginInput,
  RegisterStudentInput,
  UserRecord
} from "@kagie/shared";
import * as FileSystem from "expo-file-system/legacy";
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
import { clearCachedUser, clearStoredTokens, getCachedUser, getStoredTokens, saveCachedUser, saveTokens } from "./storage";

type ApiEnvelope<T> = {
  data: T;
};

const NETWORK_ERROR_PATTERN = /network request failed|failed to fetch|internet|offline|timed out|abort|load failed|could not connect|connection/i;
const REQUEST_TIMEOUT_MS = 30000;

export function isNetworkUnavailableError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_PATTERN.test(message);
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string) {
  if (!mobileConfig.apiBaseUrl) {
    throw new Error("Kagie mobile is not connected to an API yet. Set EXPO_PUBLIC_API_BASE_URL before building this app.");
  }

  if (!mobileConfig.isDevRuntime && mobileConfig.usesLocalApiBaseUrl) {
    throw new Error("Kagie mobile is still pointed at a local API. Replace EXPO_PUBLIC_API_BASE_URL with your live /v1 URL before uploading to Google Play.");
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null;

  let response: Response;
  try {
    response = await fetch(`${mobileConfig.apiBaseUrl}${path}`, {
      ...init,
      signal: init?.signal || controller?.signal,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers || {})
      }
    });
  } catch (error) {
    throw new Error(isNetworkUnavailableError(error)
      ? "Kagie is offline or the API cannot be reached right now."
      : error instanceof Error ? error.message : "The Kagie API request could not be sent.");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((json as { message?: string }).message || "The Kagie API request failed.");
  }

  return (json as ApiEnvelope<T>).data;
}

async function probeConnection() {
  if (!mobileConfig.apiBaseUrl) {
    return {
      online: false,
      latencyMs: null
    };
  }

  const startedAt = Date.now();
  try {
    await fetch(`${mobileConfig.apiBaseUrl}/applications/catalog`, {
      method: "HEAD",
      cache: "no-store"
    });
    return {
      online: true,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    if (!isNetworkUnavailableError(error)) {
      return {
        online: true,
        latencyMs: Date.now() - startedAt
      };
    }
    return {
      online: false,
      latencyMs: null
    };
  }
}

async function refreshTokens(refreshToken: string) {
  const session = await request<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
  await saveTokens(session.tokens.accessToken, session.tokens.refreshToken);
  return session;
}

async function getSessionAccessToken() {
  const stored = await getStoredTokens();
  let accessToken = stored.accessToken;

  if (!accessToken && stored.refreshToken) {
    const refreshed = await refreshTokens(stored.refreshToken);
    accessToken = refreshed.tokens.accessToken;
  }

  if (!accessToken) {
    throw new Error("No Kagie session is available on this device.");
  }

  return accessToken;
}

async function withSession<T>(path: string, init?: RequestInit) {
  const stored = await getStoredTokens();
  const accessToken = await getSessionAccessToken();

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

function encodeHeaderValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

export const apiClient = {
  probeConnection,
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
      await clearCachedUser();
    }
  },

  restoreSession: async () => {
    const stored = await getStoredTokens();
    if (!stored.accessToken && !stored.refreshToken) return null;

    try {
      if (stored.accessToken) {
        const user = await request<UserRecord>("/auth/me", { method: "GET" }, stored.accessToken);
        await saveCachedUser(user);
        return user;
      }
      if (stored.refreshToken) {
        const session = await refreshTokens(stored.refreshToken);
        await saveCachedUser(session.user);
        return session.user;
      }
      return null;
    } catch (_error) {
      if (isNetworkUnavailableError(_error)) {
        return getCachedUser();
      }

      if (!stored.refreshToken) {
        await clearStoredTokens();
        return null;
      }

      try {
        const session = await refreshTokens(stored.refreshToken);
        await saveCachedUser(session.user);
        return session.user;
      } catch (error) {
        if (isNetworkUnavailableError(error)) {
          return getCachedUser();
        }
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
  getProfile: () => withSession<ProfileSnapshot>("/applications/me/profile"),
  getDocuments: () => withSession<DocumentRecord[]>("/applications/me/documents"),
  uploadDocumentFile: async (
    applicationId: string,
    input: {
      uri: string;
      documentType: string;
      fileName: string;
      mimeType: string;
    },
    onProgress?: (progress: number) => void
  ) => {
    const accessToken = await getSessionAccessToken();
    const uploadTask = FileSystem.createUploadTask(
      `${mobileConfig.apiBaseUrl}/applications/me/${applicationId}/documents`,
      input.uri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": input.mimeType,
          "X-Kagie-Document-Type": encodeHeaderValue(input.documentType),
          "X-Kagie-File-Name": encodeHeaderValue(input.fileName)
        }
      },
      (progress) => {
        const expected = progress.totalBytesExpectedToSend || 0;
        if (!expected) return;
        onProgress?.(Math.min(1, progress.totalBytesSent / expected));
      }
    );

    const result = await uploadTask.uploadAsync();
    if (!result) {
      throw new Error("Document upload was cancelled before Kagie received it.");
    }

    const json = JSON.parse(result.body || "{}") as Partial<ApiEnvelope<DocumentRecord>> & { message?: string };
    if (result.status < 200 || result.status >= 300 || !json.data) {
      throw new Error(json.message || "Kagie could not upload this document.");
    }

    onProgress?.(1);
    return json.data;
  },
  getAdminInstitutions: (query = "") =>
    withSession(`/admin/institutions${query}`),
  updateAdminInstitutionStatus: (institutionId: string, status: "open" | "closing_soon" | "closed" | "auto") =>
    withSession(`/admin/institutions/${institutionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    })
};
