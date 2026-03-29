import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { KagieDataProvider, useKagieData } from "../data/KagieDataProvider";
import { HomeScreen } from "./HomeScreen";
import { ApplyScreen } from "./ApplyScreen";
import { CartScreen } from "./CartScreen";
import { InboxScreen } from "./InboxScreen";
import { ProfileScreen } from "./ProfileScreen";
import { ExploreScreen } from "./ExploreScreen";
import { colors } from "../theme";

type TabKey = "home" | "apply" | "cart" | "inbox" | "explore" | "profile";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "apply", label: "Apply" },
  { key: "cart", label: "Cart" },
  { key: "inbox", label: "Inbox" },
  { key: "explore", label: "Explore" },
  { key: "profile", label: "Profile" }
];

function DashboardShell() {
  const { loading, dashboard } = useKagieData();
  const [activeTab, setActiveTab] = useState<TabKey>("home");

  const screen = useMemo(() => {
    if (activeTab === "apply") return <ApplyScreen />;
    if (activeTab === "cart") return <CartScreen />;
    if (activeTab === "inbox") return <InboxScreen />;
    if (activeTab === "explore") return <ExploreScreen />;
    if (activeTab === "profile") return <ProfileScreen />;
    return <HomeScreen />;
  }, [activeTab]);

  if (loading) {
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
          <Text style={styles.topMeta}>Unread alerts: {dashboard?.unreadCount ?? 0}</Text>
        </View>
        <View style={styles.topPill}>
          <Text style={styles.topPillText}>{dashboard?.latestApplication?.status || "Draft"}</Text>
        </View>
      </View>

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
    width: "33.33%",
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
  }
});
