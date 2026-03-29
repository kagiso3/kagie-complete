import type { LoginInput, RegisterStudentInput, UserRecord } from "@kagie/shared";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api";
import { getStoredTokens, saveTokens } from "../lib/storage";

type SessionContextValue = {
  user: UserRecord | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterStudentInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  async function hydrateFromStorage() {
    try {
      const nextUser = await apiClient.restoreSession();
      setUser(nextUser);
      setLoading(false);
    } catch (error) {
      console.warn("Kagie mobile session restore failed:", error);
      setUser(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  async function login(input: LoginInput) {
    const session = await apiClient.login(input);
    await saveTokens(session.tokens.accessToken, session.tokens.refreshToken);
    setUser(session.user);
  }

  async function register(input: RegisterStudentInput) {
    const session = await apiClient.register(input);
    await saveTokens(session.tokens.accessToken, session.tokens.refreshToken);
    setUser(session.user);
  }

  async function logout() {
    const tokens = await getStoredTokens();
    if (tokens.refreshToken) {
      try {
        await apiClient.logout(tokens.refreshToken);
      } catch (error) {
        console.warn("Kagie mobile logout warning:", error);
      }
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
    logout,
    refreshProfile
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
