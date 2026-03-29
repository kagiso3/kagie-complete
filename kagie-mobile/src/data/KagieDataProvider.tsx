import type { ApplicationMark, ApplicationRecord } from "@kagie/shared";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api";
import type {
  CartSummary,
  CheckoutInput,
  DashboardSummary,
  InstitutionInput,
  MobileCatalog,
  ProfileSnapshot,
  SupportSnapshot
} from "../types/mobile";
import { useSession } from "../session/SessionProvider";

type KagieDataContextValue = {
  catalog: MobileCatalog | null;
  draft: ApplicationRecord | null;
  dashboard: DashboardSummary | null;
  cart: CartSummary | null;
  notifications: DashboardSummary["notifications"];
  support: SupportSnapshot | null;
  profile: ProfileSnapshot | null;
  loading: boolean;
  syncing: boolean;
  hydrate: () => Promise<void>;
  ensureWorkingDraft: () => Promise<ApplicationRecord>;
  saveSection: (section: "learner" | "parent" | "school", payload: Record<string, string | number | null>) => Promise<ApplicationRecord>;
  saveMarks: (subjects: ApplicationMark[]) => Promise<ApplicationRecord>;
  selectPackage: (packageId: string) => Promise<ApplicationRecord>;
  addInstitution: (payload: InstitutionInput) => Promise<ApplicationRecord>;
  removeInstitution: (institutionId: string) => Promise<ApplicationRecord>;
  clearCart: () => Promise<ApplicationRecord>;
  checkout: (payload: CheckoutInput) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  sendSupportMessage: (message: string) => Promise<void>;
  requestCallback: (payload: { phone: string; preferredTime?: string; note?: string }) => Promise<void>;
  requestService: (serviceId: string) => Promise<void>;
};

const KagieDataContext = createContext<KagieDataContextValue | null>(null);

export function KagieDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [catalog, setCatalog] = useState<MobileCatalog | null>(null);
  const [draft, setDraft] = useState<ApplicationRecord | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [notifications, setNotifications] = useState<DashboardSummary["notifications"]>([]);
  const [support, setSupport] = useState<SupportSnapshot | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function hydrate() {
    if (!user) {
      setCatalog(null);
      setDraft(null);
      setDashboard(null);
      setCart(null);
      setNotifications([]);
      setSupport(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextCatalog, latest, nextDashboard, nextCart, nextNotifications, nextSupport, nextProfile] = await Promise.all([
        apiClient.getCatalog(),
        apiClient.getLatestApplication(),
        apiClient.getDashboard(),
        apiClient.getCart(),
        apiClient.getNotifications(),
        apiClient.getSupport(),
        apiClient.getProfile()
      ]);

      setCatalog(nextCatalog);
      setDraft(latest && latest.status === "Draft" ? latest : null);
      setDashboard(nextDashboard);
      setCart(nextCart);
      setNotifications(nextNotifications);
      setSupport(nextSupport);
      setProfile(nextProfile);
    } catch (error) {
      console.warn("Kagie mobile hydrate warning:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    hydrate();
  }, [user?.id]);

  async function ensureWorkingDraft() {
    if (draft && draft.status === "Draft") {
      return draft;
    }

    setSyncing(true);
    try {
      const nextDraft = await apiClient.ensureDraft();
      setDraft(nextDraft);
      const [nextDashboard, nextCart, nextProfile] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getCart(),
        apiClient.getProfile()
      ]);
      const nextNotifications = await apiClient.getNotifications();
      setDashboard(nextDashboard);
      setCart(nextCart);
      setProfile(nextProfile);
      setNotifications(nextNotifications);
      return nextDraft;
    } finally {
      setSyncing(false);
    }
  }

  async function runDraftMutation(action: (applicationId: string) => Promise<ApplicationRecord>) {
    const currentDraft = await ensureWorkingDraft();
    setSyncing(true);
    try {
      const nextDraft = await action(currentDraft.id);
      setDraft(nextDraft);
      const [nextDashboard, nextCart, nextProfile, nextNotifications] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getCart(),
        apiClient.getProfile(),
        apiClient.getNotifications()
      ]);
      setDashboard(nextDashboard);
      setCart(nextCart);
      setProfile(nextProfile);
      setNotifications(nextNotifications);
      return nextDraft;
    } finally {
      setSyncing(false);
    }
  }

  async function saveSection(section: "learner" | "parent" | "school", payload: Record<string, string | number | null>) {
    return runDraftMutation((applicationId) => apiClient.saveFormSection(applicationId, section, payload));
  }

  async function saveMarks(subjects: ApplicationMark[]) {
    return runDraftMutation((applicationId) => apiClient.saveMarks(applicationId, subjects));
  }

  async function selectPackage(packageId: string) {
    return runDraftMutation((applicationId) => apiClient.selectPackage(applicationId, packageId));
  }

  async function addInstitution(payload: InstitutionInput) {
    return runDraftMutation((applicationId) => apiClient.addInstitution(applicationId, payload));
  }

  async function removeInstitution(institutionId: string) {
    return runDraftMutation((applicationId) => apiClient.removeInstitution(applicationId, institutionId));
  }

  async function clearCart() {
    if (!cart?.applicationId) {
      throw new Error("There is no active Kagie cart to clear.");
    }
    setSyncing(true);
    try {
      const nextDraft = await apiClient.clearCart(cart.applicationId);
      setDraft(nextDraft);
      const [nextDashboard, nextCart, nextNotifications] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getCart(),
        apiClient.getNotifications()
      ]);
      setDashboard(nextDashboard);
      setCart(nextCart);
      setNotifications(nextNotifications);
      setProfile(await apiClient.getProfile());
      return nextDraft;
    } finally {
      setSyncing(false);
    }
  }

  async function checkout(payload: CheckoutInput) {
    if (!cart?.applicationId) {
      throw new Error("There is no application ready for checkout.");
    }

    setSyncing(true);
    try {
      await apiClient.checkout(cart.applicationId, payload);
      const [latest, nextDashboard, nextCart, nextNotifications, nextSupport, nextProfile] = await Promise.all([
        apiClient.getLatestApplication(),
        apiClient.getDashboard(),
        apiClient.getCart(),
        apiClient.getNotifications(),
        apiClient.getSupport(),
        apiClient.getProfile()
      ]);
      setDraft(latest && latest.status === "Draft" ? latest : null);
      setDashboard(nextDashboard);
      setCart(nextCart);
      setNotifications(nextNotifications);
      setSupport(nextSupport);
      setProfile(nextProfile);
    } finally {
      setSyncing(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    await apiClient.markNotificationRead(notificationId);
    const nextNotifications = await apiClient.getNotifications();
    setNotifications(nextNotifications);
    setDashboard((current) => current ? {
      ...current,
      notifications: nextNotifications.slice(0, 5),
      unreadCount: nextNotifications.filter((item) => !item.read).length
    } : current);
  }

  async function sendSupportMessage(message: string) {
    setSyncing(true);
    try {
      const nextSupport = await apiClient.sendSupportMessage(message);
      setSupport(nextSupport);
      const nextNotifications = await apiClient.getNotifications();
      setNotifications(nextNotifications);
      setDashboard((current) => current ? {
        ...current,
        notifications: nextNotifications.slice(0, 5),
        unreadCount: nextNotifications.filter((item) => !item.read).length
      } : current);
    } finally {
      setSyncing(false);
    }
  }

  async function requestCallback(payload: { phone: string; preferredTime?: string; note?: string }) {
    setSyncing(true);
    try {
      await apiClient.requestCallback(payload);
      const [nextSupport, nextNotifications] = await Promise.all([
        apiClient.getSupport(),
        apiClient.getNotifications()
      ]);
      setSupport(nextSupport);
      setNotifications(nextNotifications);
      setDashboard((current) => current ? {
        ...current,
        notifications: nextNotifications.slice(0, 5),
        unreadCount: nextNotifications.filter((item) => !item.read).length
      } : current);
    } finally {
      setSyncing(false);
    }
  }

  async function requestService(serviceId: string) {
    setSyncing(true);
    try {
      const result = await apiClient.requestService(serviceId);
      setSupport(result.support);
      const nextNotifications = await apiClient.getNotifications();
      setNotifications(nextNotifications);
      setDashboard((current) => current ? {
        ...current,
        notifications: nextNotifications.slice(0, 5),
        unreadCount: nextNotifications.filter((item) => !item.read).length
      } : current);
    } finally {
      setSyncing(false);
    }
  }

  const value = useMemo<KagieDataContextValue>(() => ({
    catalog,
    draft,
    dashboard,
    cart,
    notifications,
    support,
    profile,
    loading,
    syncing,
    hydrate,
    ensureWorkingDraft,
    saveSection,
    saveMarks,
    selectPackage,
    addInstitution,
    removeInstitution,
    clearCart,
    checkout,
    markNotificationRead,
    sendSupportMessage,
    requestCallback,
    requestService
  }), [catalog, draft, dashboard, cart, notifications, support, profile, loading, syncing]);

  return <KagieDataContext.Provider value={value}>{children}</KagieDataContext.Provider>;
}

export function useKagieData() {
  const context = useContext(KagieDataContext);
  if (!context) {
    throw new Error("useKagieData must be used inside KagieDataProvider.");
  }
  return context;
}
