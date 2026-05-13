import type { LoginInput, RegisterStudentInput, UserRecord } from "@kagie/shared";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api";
import { clearCachedUser, clearStoredTokens, getCachedUser, getStoredTokens, saveCachedUser, saveTokens } from "../lib/storage";
import { createOfflineGuest, isOfflineGuest } from "./offlineGuest";

type SessionContextValue = {
  user: UserRecord | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterStudentInput) => Promise<void>;
  continueOffline: (fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isGuest: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  async function hydrateFromStorage() {
    try {
      const nextUser = await apiClient.restoreSession();
      if (nextUser) {
        setUser(nextUser);
      } else {
        const cachedUser = await getCachedUser();
        setUser(isOfflineGuest(cachedUser) ? cachedUser : null);
      }
      setLoading(false);
    } catch (error) {
      console.warn("Kagie mobile session restore failed:", error);
      const cachedUser = await getCachedUser();
      setUser(isOfflineGuest(cachedUser) ? cachedUser : null);
      setLoading(false);
    }
  }

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  async function login(input: LoginInput) {
    const session = await apiClient.login(input);
    await saveTokens(session.tokens.accessToken, session.tokens.refreshToken);
    await saveCachedUser(session.user);
    setUser(session.user);
  }

  async function register(input: RegisterStudentInput) {
    const session = await apiClient.register(input);
    await saveTokens(session.tokens.accessToken, session.tokens.refreshToken);
    await saveCachedUser(session.user);
    setUser(session.user);
  }

  async function continueOffline(fullName?: string) {
    const guest = createOfflineGuest(fullName);
    await clearStoredTokens();
    await saveCachedUser(guest);
    setUser(guest);
  }

  async function logout() {
    const tokens = await getStoredTokens();
    if (tokens.refreshToken) {
      try {
        await apiClient.logout(tokens.refreshToken);
      } catch (error) {
        console.warn("Kagie mobile logout warning:", error);
      }
    } else {
      await clearStoredTokens();
      await clearCachedUser();
    }
    setUser(null);
  }

  async function refreshProfile() {
    const nextUser = await apiClient.restoreSession();
    setUser(nextUser);
  }

  const value = useMemo<SessionContextValue>(() => ({
    user,
    loading,
    login,
    register,
    continueOffline,
    logout,
    refreshProfile,
    isGuest: isOfflineGuest(user)
  }), [user, loading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return context;
}
