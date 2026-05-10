import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { KagieDataProvider, useKagieData } from "../data/KagieDataProvider";
import { HomeScreen } from "./HomeScreen";
import { ApplyScreen } from "./ApplyScreen";
import { CartScreen } from "./CartScreen";
import { DocumentsScreen } from "./DocumentsScreen";
import { InboxScreen } from "./InboxScreen";
import { ProfileScreen } from "./ProfileScreen";
import { ExploreScreen } from "./ExploreScreen";
import { colors } from "../theme";
import { SyncBanner } from "../components/ui";

type TabKey = "home" | "apply" | "docs" | "cart" | "inbox" | "explore" | "profile";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "apply", label: "Apply" },
  { key: "docs", label: "Docs" },
  { key: "cart", label: "Cart" },
  { key: "inbox", label: "Inbox" },
  { key: "explore", label: "Explore" },
  { key: "profile", label: "Profile" }
];

function DashboardShell() {
  const {
    loading,
    dashboard,
    offline,
    pendingDraftSync,
    lastSyncError,
    syncPendingDraft,
    syncNow,
    syncing,
    connection
  } = useKagieData();
  const [activeTab, setActiveTab] = useState<TabKey>("home");

  const screen = useMemo(() => {
    if (activeTab === "apply") return <ApplyScreen />;
    if (activeTab === "docs") return <DocumentsScreen />;
    if (activeTab === "cart") return <CartScreen />;
    if (activeTab === "inbox") return <InboxScreen />;
    if (activeTab === "explore") return <ExploreScreen />;
    if (activeTab === "profile") return <ProfileScreen />;
    return <HomeScreen />;
  }, [activeTab]);

  const connectionCopy = useMemo(() => {
    if (offline || connection.status === "offline") {
      return {
        message: connection.pendingSyncCount
          ? `You are offline. ${connection.pendingSyncCount} saved change${connection.pendingSyncCount === 1 ? "" : "s"} will sync when internet returns.`
          : "You are offline. Cached Kagie data is still available on this device.",
        actionLabel: "Retry"
      };
    }
    if (syncing || connection.status === "syncing") {
      return {
        message: connection.pendingSyncCount
          ? `Syncing ${connection.pendingSyncCount} saved Kagie change${connection.pendingSyncCount === 1 ? "" : "s"}...`
          : "Refreshing Kagie quietly in the background.",
        actionLabel: undefined
      };
    }
    if (pendingDraftSync || connection.pendingSyncCount > 0) {
      return {
        message: `${connection.pendingSyncCount || 1} saved change${(connection.pendingSyncCount || 1) === 1 ? "" : "s"} waiting to sync.`,
        actionLabel: "Sync now"
      };
    }
    if (connection.status === "weak") {
      return {
        message: "Connection is slow. Kagie will keep using cached data while it refreshes.",
        actionLabel: "Refresh"
      };
    }
    if (connection.status === "restored") {
      return {
        message: "Connection restored. Kagie is up to date.",
        actionLabel: undefined
      };
    }
    if (lastSyncError) {
      return {
        message: lastSyncError,
        actionLabel: "Retry"
      };
    }
    return null;
  }, [connection.pendingSyncCount, connection.status, lastSyncError, offline, pendingDraftSync, syncing]);

  if (loading && !dashboard) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color="#ffffff" />
        <Text style={styles.loadingTitle}>Syncing Kagie mobile</Text>
        <Text style={styles.loadingText}>Loading your dashboard, draft, and support inbox.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>Kagie</Text>
          <Text style={styles.topMeta}>
            {connection.status === "online" ? "Online" : connection.status === "restored" ? "Connection restored" : connection.status === "weak" ? "Weak connection" : connection.status === "offline" ? "Offline" : "Syncing"}
            {" | "}Unread alerts: {dashboard?.unreadCount ?? 0}
          </Text>
        </View>
        <View style={styles.topPill}>
          <Text style={styles.topPillText}>{dashboard?.latestApplication?.status || "Draft"}</Text>
        </View>
      </View>

      {connectionCopy ? (
        <View style={styles.noticeWrap}>
          <SyncBanner
            status={offline ? "offline" : connection.status}
            message={connectionCopy.message}
            actionLabel={connectionCopy.actionLabel}
            loading={syncing}
            onAction={connectionCopy.actionLabel ? () => {
              if (pendingDraftSync && !offline) return syncPendingDraft();
              return syncNow();
            } : undefined}
          />
        </View>
      ) : null}

      <View style={styles.body}>{screen}</View>

      <View style={styles.nav}>
        {tabs.map((tab) => (
          <View key={tab.key} style={styles.navItem}>
            <Pressable onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.navLabel, activeTab === tab.key && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

export function DashboardScreen() {
  return (
    <KagieDataProvider>
      <DashboardShell />
    </KagieDataProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  body: {
    flex: 1
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24
  },
  loadingTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900"
  },
  loadingText: {
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    maxWidth: 290
  },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(217,227,241,0.8)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  brand: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "900"
  },
  topMeta: {
    color: colors.textMuted
  },
  topPill: {
    backgroundColor: "#fff2d0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  topPillText: {
    color: "#8a5d00",
    fontWeight: "800",
    fontSize: 12
  },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: "rgba(217,227,241,0.8)",
    paddingVertical: 10
  },
  navItem: {
    width: "25%",
    alignItems: "center"
  },
  navLabel: {
    color: colors.textMuted,
    fontWeight: "700",
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  navLabelActive: {
    color: colors.sky
  },
  noticeWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8
  }
});
