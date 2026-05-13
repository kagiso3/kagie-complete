import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { ROLES } from "@kagie/shared";
import { AdminScreen } from "./src/screens/AdminScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { SessionProvider, useSession } from "./src/session/SessionProvider";
import { colors } from "./src/theme";

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar style="light" />
      <View style={styles.loadingBadge}>
        <Text style={styles.loadingBadgeText}>K</Text>
      </View>
      <ActivityIndicator color="#ffffff" />
      <Text style={styles.loadingTitle}>Opening Kagie Android</Text>
      <Text style={styles.loadingCopy}>Loading your secure session and mobile dashboard.</Text>
    </SafeAreaView>
  );
}

function MobileRoot() {
  const { loading, user } = useSession();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) return <AuthScreen />;
  return user.role === ROLES.USER ? <DashboardScreen /> : <AdminScreen />;
}

export default function App() {
  return (
    <SessionProvider>
      <MobileRoot />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14
  },
  loadingBadge: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  loadingBadgeText: {
    color: colors.brand,
    fontSize: 36,
    fontWeight: "900"
  },
  loadingTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900"
  },
  loadingCopy: {
    color: "rgba(255,255,255,0.88)",
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 280
  }
});
