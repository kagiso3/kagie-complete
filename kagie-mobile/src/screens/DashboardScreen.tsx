import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { KagieDataProvider, useKagieData } from "../data/KagieDataProvider";
import { HomeScreen } from "./HomeScreen";
import { ApplyScreen } from "./ApplyScreen";
import { CartScreen } from "./CartScreen";
import { DocumentsScreen } from "./DocumentsScreen";
import { InboxScreen } from "./InboxScreen";
import { ProfileScreen } from "./ProfileScreen";
import { ExploreScreen } from "./ExploreScreen";
import { colors, shadows } from "../theme";
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
        <View style={styles.loadingCard}>
          <View style={styles.loadingBadge}>
            <Text style={styles.loadingBadgeText}>K</Text>
          </View>
          <ActivityIndicator color={colors.sky} />
          <Text style={styles.loadingTitle}>Syncing Kagie mobile</Text>
          <Text style={styles.loadingText}>Loading your dashboard, draft, and support inbox.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>K</Text>
            <View style={styles.brandBadgeAccent} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>Kagie</Text>
            <Text style={styles.topMeta}>
              {connection.status === "online" ? "Online" : connection.status === "restored" ? "Connection restored" : connection.status === "weak" ? "Weak connection" : connection.status === "offline" ? "Offline" : "Syncing"}
              {" | "}Unread alerts: {dashboard?.unreadCount ?? 0}
            </Text>
          </View>
        </View>
        <View style={styles.topPill}>
          <Text style={styles.topPillEyebrow}>Application</Text>
          <Text style={styles.topPillText}>{dashboard?.latestApplication?.status || "Draft"}</Text>
        </View>
      </View>

      <View style={styles.navDock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.navItem, activeTab === tab.key && styles.navItemActive]}
            >
              <Text style={[styles.navLabel, activeTab === tab.key && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
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
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  loadingCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft
  },
  loadingBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    overflow: "hidden"
  },
  loadingBadgeText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900"
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  loadingText: {
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 290
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.surfaceGlass,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.borderSoft,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    ...shadows.card
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  brandBadgeAccent: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 18,
    height: 18,
    borderRadius: 7,
    backgroundColor: colors.sky
  },
  brandBadgeText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900"
  },
  brandCopy: {
    flex: 1,
    minWidth: 0
  },
  brand: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900"
  },
  topMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  topPill: {
    maxWidth: "40%",
    backgroundColor: colors.skySoft,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border
  },
  topPillEyebrow: {
    color: "#2d9df9",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "900",
    fontSize: 9
  },
  topPillText: {
    color: "#2d9df9",
    fontWeight: "900",
    fontSize: 12
  },
  navDock: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.card
  },
  nav: {
    paddingHorizontal: 7,
    gap: 6
  },
  navItem: {
    minWidth: 72,
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  navItemActive: {
    backgroundColor: colors.brand
  },
  navLabel: {
    color: colors.textMuted,
    fontWeight: "800",
    fontSize: 13
  },
  navLabelActive: {
    color: "#ffffff"
  },
  noticeWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8
  }
});
