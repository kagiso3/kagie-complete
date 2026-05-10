import type {
  ApplicationMark,
  ApplicationRecord,
  CallbackRequestRecord,
  DocumentRecord,
  NotificationRecord,
  SupportMessageRecord,
  SupportThreadRecord
} from "@kagie/shared";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { apiClient, isNetworkUnavailableError } from "../lib/api";
import {
  clearPendingMobileActions,
  getPendingMobileActions,
  queuePendingMobileAction,
  type PendingMobileAction
} from "../lib/offlineActions";
import {
  applyDraftQueueItem,
  clearDraftQueue,
  createLocalDraft,
  getDraftQueue,
  getMobileDataCache,
  isLocalDraft,
  queueDraftMutation,
  saveMobileDataCache,
  type DraftQueueItem
} from "../lib/offlineDrafts";
import type {
  CartSummary,
  CheckoutInput,
  DashboardSectionLoading,
  DashboardSummary,
  InstitutionInput,
  MobileCatalog,
  MobileConnectionState,
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
  documents: DocumentRecord[];
  loading: boolean;
  syncing: boolean;
  offline: boolean;
  pendingDraftSync: boolean;
  lastSyncError: string;
  connection: MobileConnectionState;
  sectionLoading: DashboardSectionLoading;
  hydrate: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncPendingDraft: () => Promise<void>;
  ensureWorkingDraft: () => Promise<ApplicationRecord>;
  saveSection: (section: "learner" | "parent" | "school", payload: Record<string, string | number | null>) => Promise<ApplicationRecord>;
  saveMarks: (subjects: ApplicationMark[]) => Promise<ApplicationRecord>;
  selectPackage: (packageId: string) => Promise<ApplicationRecord>;
  addInstitution: (payload: InstitutionInput) => Promise<ApplicationRecord>;
  removeInstitution: (institutionId: string) => Promise<ApplicationRecord>;
  clearCart: () => Promise<ApplicationRecord>;
  checkout: (payload: CheckoutInput) => Promise<void>;
  uploadDocument: (input: {
    applicationId?: string;
    uri: string;
    documentType: string;
    fileName: string;
    mimeType: string;
  }, onProgress?: (progress: number) => void) => Promise<DocumentRecord>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  sendSupportMessage: (message: string) => Promise<void>;
  requestCallback: (payload: { phone: string; preferredTime?: string; note?: string }) => Promise<void>;
  requestService: (serviceId: string) => Promise<void>;
};

const KagieDataContext = createContext<KagieDataContextValue | null>(null);

type MobileCachePatch = Partial<{
  catalog: MobileCatalog | null;
  draft: ApplicationRecord | null;
  dashboard: DashboardSummary | null;
  cart: CartSummary | null;
  notifications: DashboardSummary["notifications"];
  support: SupportSnapshot | null;
  profile: ProfileSnapshot | null;
  documents: DocumentRecord[];
}>;

const createSectionLoading = (): DashboardSectionLoading => ({
  summary: true,
  applications: true,
  deadlines: true,
  notifications: true,
  accommodation: true,
  recommendations: true,
  support: true,
  profile: true,
  documents: true
});

const createConnectionState = (): MobileConnectionState => ({
  status: "syncing",
  latencyMs: null,
  lastCheckedAt: "",
  lastSuccessfulSyncAt: "",
  cacheSavedAt: "",
  pendingSyncCount: 0
});

function nowIso() {
  return new Date().toISOString();
}

function buildLocalThread(userId: string): SupportThreadRecord {
  const timestamp = nowIso();
  return {
    id: `local-thread-${userId}`,
    userId,
    assistantId: null,
    status: "open",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildLocalMessage(userId: string, threadId: string, tempId: string, message: string): SupportMessageRecord {
  const timestamp = nowIso();
  return {
    id: tempId,
    threadId,
    senderId: userId,
    senderRole: "user",
    message,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildLocalCallback(userId: string, tempId: string, payload: { phone: string; preferredTime?: string; note?: string }): CallbackRequestRecord {
  const timestamp = nowIso();
  return {
    id: tempId,
    userId,
    phone: payload.phone,
    preferredTime: payload.preferredTime,
    note: payload.note,
    status: "Pending",
    assignedAssistantId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildLocalNotification(userId: string, title: string, message: string, type: NotificationRecord["type"]): NotificationRecord {
  const timestamp = nowIso();
  return {
    id: `local-notification-${Date.now()}`,
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord) {
  return [incoming, ...current.filter((item) => item.id !== incoming.id)].slice(0, 20);
}

export function KagieDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [catalog, setCatalog] = useState<MobileCatalog | null>(null);
  const [draft, setDraft] = useState<ApplicationRecord | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [notifications, setNotifications] = useState<DashboardSummary["notifications"]>([]);
  const [support, setSupport] = useState<SupportSnapshot | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendingDraftSync, setPendingDraftSync] = useState(false);
  const [lastSyncError, setLastSyncError] = useState("");
  const [connection, setConnection] = useState<MobileConnectionState>(createConnectionState);
  const [sectionLoading, setSectionLoading] = useState<DashboardSectionLoading>(createSectionLoading);

  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const setSectionState = useCallback((key: keyof DashboardSectionLoading, value: boolean) => {
    setSectionLoading((current) => ({ ...current, [key]: value }));
  }, []);

  const updateConnection = useCallback((patch: Partial<MobileConnectionState> & { status?: MobileConnectionState["status"] }) => {
    setConnection((current) => ({ ...current, ...patch }));
  }, []);

  const cacheCurrentState = useCallback(async (overrides?: MobileCachePatch) => {
    if (!user) return;
    const previous = await getMobileDataCache(user.id).catch(() => null);
    const hasOverride = (key: keyof MobileCachePatch) => Object.prototype.hasOwnProperty.call(overrides || {}, key);

    await saveMobileDataCache(user.id, {
      catalog: hasOverride("catalog") ? overrides!.catalog! : previous?.catalog ?? catalog,
      draft: hasOverride("draft") ? overrides!.draft! : previous?.draft ?? draft,
      dashboard: hasOverride("dashboard") ? overrides!.dashboard! : previous?.dashboard ?? dashboard,
      cart: hasOverride("cart") ? overrides!.cart! : previous?.cart ?? cart,
      notifications: hasOverride("notifications") ? overrides!.notifications! : previous?.notifications ?? notifications,
      support: hasOverride("support") ? overrides!.support! : previous?.support ?? support,
      profile: hasOverride("profile") ? overrides!.profile! : previous?.profile ?? profile,
      documents: hasOverride("documents") ? overrides!.documents! : previous?.documents ?? documents
    }).catch(() => {});
  }, [catalog, dashboard, documents, draft, notifications, profile, support, cart, user]);

  const refreshPendingCounts = useCallback(async (userId: string) => {
    const [draftQueue, actionQueue] = await Promise.all([
      getDraftQueue(userId),
      getPendingMobileActions(userId)
    ]);
    const total = draftQueue.length + actionQueue.length;
    setPendingDraftSync(total > 0);
    updateConnection({ pendingSyncCount: total });
    return { draftQueue, actionQueue, total };
  }, [updateConnection]);

  const loadCachedState = useCallback(async (userId: string) => {
    const cached = await getMobileDataCache(userId);
    if (!cached) {
      await refreshPendingCounts(userId);
      return null;
    }

    setCatalog(cached.catalog);
    setDraft(cached.draft);
    setDashboard(cached.dashboard);
    setCart(cached.cart);
    setNotifications(cached.notifications || []);
    setSupport(cached.support);
    setProfile(cached.profile);
    setDocuments(cached.documents || []);
    updateConnection({ cacheSavedAt: cached.savedAt || "" });
    await refreshPendingCounts(userId);
    return cached;
  }, [refreshPendingCounts, updateConnection]);

  const applyConnectionProbe = useCallback((probe: { online: boolean; latencyMs: number | null }, synced = false) => {
    const timestamp = nowIso();
    setConnection((current) => {
      let nextStatus: MobileConnectionState["status"] = "online";
      if (!probe.online) nextStatus = "offline";
      else if (synced) nextStatus = current.status === "offline" ? "restored" : (probe.latencyMs && probe.latencyMs > 1600 ? "weak" : "online");
      else nextStatus = probe.latencyMs && probe.latencyMs > 1600 ? "weak" : "online";

      return {
        ...current,
        status: nextStatus,
        latencyMs: probe.latencyMs,
        lastCheckedAt: timestamp,
        lastSuccessfulSyncAt: synced && probe.online ? timestamp : current.lastSuccessfulSyncAt
      };
    });
  }, []);

  const syncPendingActions = useCallback(async () => {
    if (!user) return;
    const queue = await getPendingMobileActions(user.id);
    if (!queue.length) {
      await refreshPendingCounts(user.id);
      return;
    }

    for (const item of queue) {
      if (item.kind === "markNotificationRead") {
        await apiClient.markNotificationRead(item.notificationId);
      }
      if (item.kind === "sendSupportMessage") {
        await apiClient.sendSupportMessage(item.message);
      }
      if (item.kind === "requestCallback") {
        await apiClient.requestCallback(item.payload);
      }
      if (item.kind === "requestService") {
        await apiClient.requestService(item.serviceId);
      }
    }

    await clearPendingMobileActions(user.id);
    await refreshPendingCounts(user.id);
  }, [refreshPendingCounts, user]);

  const syncPendingDraft = useCallback(async () => {
    if (!user) return;
    const queue = await getDraftQueue(user.id);
    if (!queue.length) {
      await refreshPendingCounts(user.id);
      return;
    }

    setSyncing(true);
    updateConnection({ status: "syncing" });
    try {
      let remoteDraft = await apiClient.ensureDraft();
      for (const item of queue) {
        if (item.kind === "saveSection") {
          remoteDraft = await apiClient.saveFormSection(remoteDraft.id, item.section, item.payload);
        }
        if (item.kind === "saveMarks") {
          remoteDraft = await apiClient.saveMarks(remoteDraft.id, item.subjects);
        }
        if (item.kind === "selectPackage") {
          remoteDraft = await apiClient.selectPackage(remoteDraft.id, item.packageId);
        }
        if (item.kind === "addInstitution") {
          remoteDraft = await apiClient.addInstitution(remoteDraft.id, item.payload);
        }
        if (item.kind === "removeInstitution" && !item.institutionId.startsWith("local-")) {
          remoteDraft = await apiClient.removeInstitution(remoteDraft.id, item.institutionId);
        }
      }

      await clearDraftQueue(user.id);
      setDraft(remoteDraft);
      setOffline(false);
      setLastSyncError("");
      await cacheCurrentState({ draft: remoteDraft });
      await refreshPendingCounts(user.id);
    } catch (error) {
      if (isNetworkUnavailableError(error)) {
        setOffline(true);
        updateConnection({ status: "offline" });
      }
      setLastSyncError(error instanceof Error ? error.message : "Could not sync saved draft changes.");
      await refreshPendingCounts(user.id);
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, refreshPendingCounts, updateConnection, user]);

  const ensureWorkingDraft = useCallback(async () => {
    if (draft && draft.status === "Draft") {
      return draft;
    }

    setSyncing(true);
    updateConnection({ status: "syncing" });
    try {
      const nextDraft = await apiClient.ensureDraft();
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
      setOffline(false);
      setLastSyncError("");
      await cacheCurrentState({
        draft: nextDraft,
        dashboard: nextDashboard,
        cart: nextCart,
        profile: nextProfile,
        notifications: nextNotifications
      });
      return nextDraft;
    } catch (error) {
      if (!user || !isNetworkUnavailableError(error)) {
        throw error;
      }
      const localDraft = createLocalDraft(user.id);
      setDraft(localDraft);
      setOffline(true);
      setLastSyncError("You are offline. Kagie saved this draft on the device and will sync it when internet returns.");
      await cacheCurrentState({ draft: localDraft });
      await refreshPendingCounts(user.id);
      return localDraft;
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, dashboard, draft, profile, refreshPendingCounts, user]);

  const runDraftMutation = useCallback(async (queueItem: DraftQueueItem, action: (applicationId: string) => Promise<ApplicationRecord>) => {
    const currentDraft = await ensureWorkingDraft();
    setSyncing(true);
    updateConnection({ status: "syncing" });
    try {
      if (isLocalDraft(currentDraft)) {
        throw new Error("Kagie is offline or the API cannot be reached right now.");
      }
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
      setOffline(false);
      setLastSyncError("");
      await cacheCurrentState({
        draft: nextDraft,
        dashboard: nextDashboard,
        cart: nextCart,
        profile: nextProfile,
        notifications: nextNotifications
      });
      return nextDraft;
    } catch (error) {
      if (!user || !isNetworkUnavailableError(error)) {
        throw error;
      }
      const localDraft = applyDraftQueueItem(currentDraft, queueItem);
      await queueDraftMutation(user.id, queueItem);
      setDraft(localDraft);
      setOffline(true);
      setLastSyncError("You are offline. Kagie saved this change on the device and will sync it when internet returns.");
      await refreshPendingCounts(user.id);
      await cacheCurrentState({ draft: localDraft });
      return localDraft;
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, ensureWorkingDraft, refreshPendingCounts, updateConnection, user]);

  const performSyncCycle = useCallback(async ({ forceLoading = false }: { forceLoading?: boolean } = {}) => {
    if (!user) {
      setCatalog(null);
      setDraft(null);
      setDashboard(null);
      setCart(null);
      setNotifications([]);
      setSupport(null);
      setProfile(null);
      setDocuments([]);
      setOffline(false);
      setPendingDraftSync(false);
      setLastSyncError("");
      setLoading(false);
      setSectionLoading(createSectionLoading());
      setConnection(createConnectionState());
      return;
    }

    if (syncPromiseRef.current) return syncPromiseRef.current;

    const syncPromise = (async () => {
      const cached = await loadCachedState(user.id);
      const hasCache = Boolean(cached);
      setLoading(forceLoading ? !hasCache : false);
      setSectionLoading({
        summary: !cached?.dashboard,
        applications: !(cached?.draft || cached?.cart),
        deadlines: !cached?.catalog,
        notifications: !(cached?.notifications?.length),
        accommodation: !cached?.catalog,
        recommendations: !cached?.catalog,
        support: !cached?.support,
        profile: !cached?.profile,
        documents: !(cached?.documents?.length)
      });

      setSyncing(true);
      updateConnection({ status: "syncing" });
      setLastSyncError("");

      try {
        const probe = await apiClient.probeConnection();
        applyConnectionProbe(probe, false);

        try {
          await syncPendingDraft();
          await syncPendingActions();
        } catch (queueError) {
          if (isNetworkUnavailableError(queueError)) {
            throw queueError;
          }
          console.warn("Kagie Android queued sync warning:", queueError);
        }

        const nextDashboard = await apiClient.getDashboard();
        setDashboard(nextDashboard);
        setSectionState("summary", false);
        await cacheCurrentState({ dashboard: nextDashboard });

        const [latest, nextCart, nextProfile] = await Promise.all([
          apiClient.getLatestApplication(),
          apiClient.getCart(),
          apiClient.getProfile()
        ]);
        setDraft(latest && latest.status === "Draft" ? latest : null);
        setCart(nextCart);
        setProfile(nextProfile);
        setSectionState("applications", false);
        setSectionState("profile", false);
        await cacheCurrentState({
          draft: latest && latest.status === "Draft" ? latest : null,
          cart: nextCart,
          profile: nextProfile
        });

        const nextCatalog = await apiClient.getCatalog();
        setCatalog(nextCatalog);
        setSectionState("deadlines", false);
        setSectionState("accommodation", false);
        setSectionState("recommendations", false);
        await cacheCurrentState({ catalog: nextCatalog });

        const nextNotifications = await apiClient.getNotifications();
        setNotifications(nextNotifications);
        setSectionState("notifications", false);
        await cacheCurrentState({ notifications: nextNotifications });

        const nextSupport = await apiClient.getSupport();
        setSupport(nextSupport);
        setSectionState("support", false);
        await cacheCurrentState({ support: nextSupport });

        const nextDocuments = await apiClient.getDocuments();
        setDocuments(nextDocuments);
        setSectionState("documents", false);
        await cacheCurrentState({ documents: nextDocuments });

        setOffline(false);
        setLastSyncError("");
        applyConnectionProbe(await apiClient.probeConnection(), true);
      } catch (error) {
        console.warn("Kagie Android sync warning:", error);
        if (isNetworkUnavailableError(error)) {
          setOffline(true);
          updateConnection({ status: "offline", lastCheckedAt: nowIso() });
        }
        setLastSyncError(error instanceof Error ? error.message : "Kagie could not sync right now.");
        setSectionLoading((current) => ({
          summary: current.summary && !dashboard,
          applications: current.applications && !draft && !cart,
          deadlines: current.deadlines && !catalog,
          notifications: current.notifications && !notifications.length,
          accommodation: current.accommodation && !catalog,
          recommendations: current.recommendations && !catalog,
          support: current.support && !support,
          profile: current.profile && !profile,
          documents: current.documents && !documents.length
        }));
      } finally {
        setSyncing(false);
        setLoading(false);
      }
    })().finally(() => {
      syncPromiseRef.current = null;
    });

    syncPromiseRef.current = syncPromise;
    return syncPromise;
  }, [
    applyConnectionProbe,
    cacheCurrentState,
    catalog,
    dashboard,
    documents,
    draft,
    loadCachedState,
    notifications.length,
    profile,
    support,
    syncPendingActions,
    syncPendingDraft,
    setSectionState,
    updateConnection,
    user
  ]);

  useEffect(() => {
    void performSyncCycle({ forceLoading: true });
  }, [performSyncCycle, user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const probeAndRecover = async () => {
      try {
        const probe = await apiClient.probeConnection();
        if (cancelled) return;
        applyConnectionProbe(probe, false);
        if (!probe.online) {
          setOffline(true);
          return;
        }
        const { total } = await refreshPendingCounts(user.id);
        if (offline || total > 0) {
          await performSyncCycle();
        }
      } catch (_error) {
        if (!cancelled) {
          setOffline(true);
          updateConnection({ status: "offline", lastCheckedAt: nowIso() });
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void probeAndRecover();
    }, 25000);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextState;
      if (wasBackground && nextState === "active") {
        void probeAndRecover();
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      subscription.remove();
    };
  }, [applyConnectionProbe, offline, performSyncCycle, refreshPendingCounts, updateConnection, user]);

  const syncNow = useCallback(async () => {
    await performSyncCycle({ forceLoading: false });
  }, [performSyncCycle]);

  const saveSection = useCallback(async (section: "learner" | "parent" | "school", payload: Record<string, string | number | null>) => (
    runDraftMutation({ kind: "saveSection", section, payload }, (applicationId) => apiClient.saveFormSection(applicationId, section, payload))
  ), [runDraftMutation]);

  const saveMarks = useCallback(async (subjects: ApplicationMark[]) => (
    runDraftMutation({ kind: "saveMarks", subjects }, (applicationId) => apiClient.saveMarks(applicationId, subjects))
  ), [runDraftMutation]);

  const selectPackage = useCallback(async (packageId: string) => (
    runDraftMutation({ kind: "selectPackage", packageId }, (applicationId) => apiClient.selectPackage(applicationId, packageId))
  ), [runDraftMutation]);

  const addInstitution = useCallback(async (payload: InstitutionInput) => (
    runDraftMutation({ kind: "addInstitution", payload }, (applicationId) => apiClient.addInstitution(applicationId, payload))
  ), [runDraftMutation]);

  const removeInstitution = useCallback(async (institutionId: string) => (
    runDraftMutation({ kind: "removeInstitution", institutionId }, (applicationId) => apiClient.removeInstitution(applicationId, institutionId))
  ), [runDraftMutation]);

  const clearCart = useCallback(async () => {
    if (!cart?.applicationId) {
      throw new Error("There is no active Kagie cart to clear.");
    }
    setSyncing(true);
    updateConnection({ status: "syncing" });
    try {
      const nextDraft = await apiClient.clearCart(cart.applicationId);
      setDraft(nextDraft);
      const [nextDashboard, nextCart, nextNotifications, nextProfile] = await Promise.all([
        apiClient.getDashboard(),
        apiClient.getCart(),
        apiClient.getNotifications(),
        apiClient.getProfile()
      ]);
      setDashboard(nextDashboard);
      setCart(nextCart);
      setNotifications(nextNotifications);
      setProfile(nextProfile);
      setOffline(false);
      setLastSyncError("");
      await cacheCurrentState({
        draft: nextDraft,
        dashboard: nextDashboard,
        cart: nextCart,
        notifications: nextNotifications,
        profile: nextProfile
      });
      return nextDraft;
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, cart?.applicationId, updateConnection]);

  const checkout = useCallback(async (payload: CheckoutInput) => {
    if (!cart?.applicationId) {
      throw new Error("There is no application ready for checkout.");
    }

    setSyncing(true);
    updateConnection({ status: "syncing" });
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
      setOffline(false);
      setLastSyncError("");
      await cacheCurrentState({
        draft: latest && latest.status === "Draft" ? latest : null,
        dashboard: nextDashboard,
        cart: nextCart,
        notifications: nextNotifications,
        support: nextSupport,
        profile: nextProfile
      });
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, cart?.applicationId, updateConnection]);

  const uploadDocument = useCallback(async (input: {
    applicationId?: string;
    uri: string;
    documentType: string;
    fileName: string;
    mimeType: string;
  }, onProgress?: (progress: number) => void) => {
    const currentDraft = input.applicationId ? draft : await ensureWorkingDraft();
    const applicationId = input.applicationId || currentDraft?.id || "";
    if (!applicationId || applicationId.startsWith("local-")) {
      throw new Error("Document uploads need internet. Save the form draft now, then upload documents when Kagie reconnects.");
    }

    setSyncing(true);
    updateConnection({ status: "syncing" });
    try {
      const document = await apiClient.uploadDocumentFile(applicationId, {
        uri: input.uri,
        documentType: input.documentType,
        fileName: input.fileName,
        mimeType: input.mimeType
      }, onProgress);
      const nextDocuments = await apiClient.getDocuments();
      setDocuments(nextDocuments);
      setOffline(false);
      setLastSyncError("");
      await cacheCurrentState({ documents: nextDocuments });
      return document;
    } catch (error) {
      if (isNetworkUnavailableError(error)) {
        setOffline(true);
        updateConnection({ status: "offline" });
      }
      setLastSyncError(error instanceof Error ? error.message : "Could not upload the document.");
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, draft, ensureWorkingDraft, updateConnection]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const optimisticNotifications = notifications.map((item) => item.id === notificationId ? { ...item, read: true } : item);
    setNotifications(optimisticNotifications);
    setDashboard((current) => current ? {
      ...current,
      notifications: optimisticNotifications.slice(0, 5),
      unreadCount: optimisticNotifications.filter((item) => !item.read).length
    } : current);

    try {
      await apiClient.markNotificationRead(notificationId);
      await cacheCurrentState({
        notifications: optimisticNotifications,
        dashboard: dashboard ? {
          ...dashboard,
          notifications: optimisticNotifications.slice(0, 5),
          unreadCount: optimisticNotifications.filter((item) => !item.read).length
        } : dashboard
      });
    } catch (error) {
      if (!user || !isNetworkUnavailableError(error)) {
        throw error;
      }
      await queuePendingMobileAction(user.id, {
        kind: "markNotificationRead",
        notificationId,
        createdAt: nowIso()
      });
      setOffline(true);
      setLastSyncError("You are offline. Kagie queued this notification update and will sync it when internet returns.");
      await refreshPendingCounts(user.id);
    }
  }, [cacheCurrentState, dashboard, notifications, refreshPendingCounts, user]);

  const sendSupportMessage = useCallback(async (message: string) => {
    setSyncing(true);
    updateConnection({ status: "syncing" });
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
      await cacheCurrentState({
        support: nextSupport,
        notifications: nextNotifications
      });
    } catch (error) {
      if (!user || !isNetworkUnavailableError(error)) {
        throw error;
      }
      const tempId = `local-message-${Date.now()}`;
      const thread = support?.thread || buildLocalThread(user.id);
      const localMessage = buildLocalMessage(user.id, thread.id, tempId, message);
      const nextSupport: SupportSnapshot = {
        thread,
        messages: [...(support?.messages || []), localMessage],
        callbacks: support?.callbacks || []
      };
      const queuedNotification = buildLocalNotification(
        user.id,
        "Support message queued",
        "Your message is saved on this Android device and will sync when Kagie reconnects.",
        "info"
      );
      const nextNotifications = mergeNotifications(notifications, queuedNotification);
      setSupport(nextSupport);
      setNotifications(nextNotifications);
      setDashboard((current) => current ? {
        ...current,
        notifications: nextNotifications.slice(0, 5),
        unreadCount: nextNotifications.filter((item) => !item.read).length
      } : current);
      await queuePendingMobileAction(user.id, {
        kind: "sendSupportMessage",
        tempId,
        message,
        createdAt: nowIso()
      });
      setOffline(true);
      setLastSyncError("You are offline. Kagie queued your support message and will send it when internet returns.");
      await refreshPendingCounts(user.id);
      await cacheCurrentState({ support: nextSupport, notifications: nextNotifications });
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, notifications, refreshPendingCounts, support, updateConnection, user]);

  const requestCallback = useCallback(async (payload: { phone: string; preferredTime?: string; note?: string }) => {
    setSyncing(true);
    updateConnection({ status: "syncing" });
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
      await cacheCurrentState({
        support: nextSupport,
        notifications: nextNotifications
      });
    } catch (error) {
      if (!user || !isNetworkUnavailableError(error)) {
        throw error;
      }
      const tempId = `local-callback-${Date.now()}`;
      const nextSupport: SupportSnapshot = {
        thread: support?.thread || buildLocalThread(user.id),
        messages: support?.messages || [],
        callbacks: [...(support?.callbacks || []), buildLocalCallback(user.id, tempId, payload)]
      };
      const queuedNotification = buildLocalNotification(
        user.id,
        "Callback queued",
        "Your callback request is saved on this device and will sync when Kagie reconnects.",
        "info"
      );
      const nextNotifications = mergeNotifications(notifications, queuedNotification);
      setSupport(nextSupport);
      setNotifications(nextNotifications);
      setDashboard((current) => current ? {
        ...current,
        notifications: nextNotifications.slice(0, 5),
        unreadCount: nextNotifications.filter((item) => !item.read).length
      } : current);
      await queuePendingMobileAction(user.id, {
        kind: "requestCallback",
        tempId,
        payload,
        createdAt: nowIso()
      });
      setOffline(true);
      setLastSyncError("You are offline. Kagie queued this callback request and will sync it when internet returns.");
      await refreshPendingCounts(user.id);
      await cacheCurrentState({ support: nextSupport, notifications: nextNotifications });
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, notifications, refreshPendingCounts, support, updateConnection, user]);

  const requestService = useCallback(async (serviceId: string) => {
    setSyncing(true);
    updateConnection({ status: "syncing" });
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
      await cacheCurrentState({
        support: result.support,
        notifications: nextNotifications
      });
    } catch (error) {
      if (!user || !isNetworkUnavailableError(error)) {
        throw error;
      }
      const serviceName = catalog?.services.find((item) => item.id === serviceId)?.name || "Service request";
      const queuedNotification = buildLocalNotification(
        user.id,
        "Service request queued",
        `${serviceName} is saved on this device and will sync when Kagie reconnects.`,
        "info"
      );
      const nextNotifications = mergeNotifications(notifications, queuedNotification);
      setNotifications(nextNotifications);
      setDashboard((current) => current ? {
        ...current,
        notifications: nextNotifications.slice(0, 5),
        unreadCount: nextNotifications.filter((item) => !item.read).length
      } : current);
      await queuePendingMobileAction(user.id, {
        kind: "requestService",
        serviceId,
        createdAt: nowIso()
      });
      setOffline(true);
      setLastSyncError("You are offline. Kagie queued this service request and will sync it when internet returns.");
      await refreshPendingCounts(user.id);
      await cacheCurrentState({ notifications: nextNotifications });
    } finally {
      setSyncing(false);
    }
  }, [cacheCurrentState, catalog?.services, notifications, refreshPendingCounts, updateConnection, user]);

  const value = useMemo<KagieDataContextValue>(() => ({
    catalog,
    draft,
    dashboard,
    cart,
    notifications,
    support,
    profile,
    documents,
    loading,
    syncing,
    offline,
    pendingDraftSync,
    lastSyncError,
    connection,
    sectionLoading,
    hydrate: syncNow,
    syncNow,
    syncPendingDraft,
    ensureWorkingDraft,
    saveSection,
    saveMarks,
    selectPackage,
    addInstitution,
    removeInstitution,
    clearCart,
    checkout,
    uploadDocument,
    markNotificationRead,
    sendSupportMessage,
    requestCallback,
    requestService
  }), [
    addInstitution,
    cacheCurrentState,
    cart,
    checkout,
    clearCart,
    connection,
    dashboard,
    documents,
    draft,
    ensureWorkingDraft,
    lastSyncError,
    loading,
    markNotificationRead,
    notifications,
    offline,
    pendingDraftSync,
    profile,
    removeInstitution,
    requestCallback,
    requestService,
    saveMarks,
    saveSection,
    sectionLoading,
    selectPackage,
    sendSupportMessage,
    support,
    syncNow,
    syncPendingDraft,
    syncing,
    uploadDocument,
    catalog
  ]);

  return <KagieDataContext.Provider value={value}>{children}</KagieDataContext.Provider>;
}

export function useKagieData() {
  const context = useContext(KagieDataContext);
  if (!context) {
    throw new Error("useKagieData must be used inside KagieDataProvider.");
  }
  return context;
}
