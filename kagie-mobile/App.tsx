import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { ROLES } from "@kagie/shared";
import { mobileConfig } from "./src/config";
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

function ConfigScreen({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return (
    <SafeAreaView style={styles.configScreen}>
      <StatusBar style="dark" />
      <View style={styles.configCard}>
        <Text style={styles.configEyebrow}>Kagie Android</Text>
        <Text style={styles.configTitle}>{title}</Text>
        <Text style={styles.configCopy}>{message}</Text>
        <View style={styles.configMetaWrap}>
          <Text style={styles.configMetaLabel}>Current API target</Text>
          <Text style={styles.configMetaValue}>{mobileConfig.apiBaseUrl || "Not configured"}</Text>
        </View>
        <Text style={styles.configHint}>
          Set `EXPO_PUBLIC_KAGIE_API_BASE_URL` or `EXPO_PUBLIC_API_BASE_URL` to a live Kagie `/v1` API before shipping this build.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function MobileRoot() {
  const { loading, user } = useSession();

  if (!mobileConfig.apiBaseUrl) {
    return (
      <ConfigScreen
        title="Kagie mobile still needs an API"
        message="This Android build is now native, but it cannot authenticate or sync learner data until EXPO_PUBLIC_API_BASE_URL points to the live Kagie API."
      />
    );
  }

  if (!mobileConfig.isDevRuntime && mobileConfig.usesLocalApiBaseUrl) {
    return (
      <ConfigScreen
        title="Replace the local API before release"
        message="This production build is still pointing at a local development server. Set EXPO_PUBLIC_API_BASE_URL to your live Kagie /v1 endpoint before publishing the APK or AAB."
      />
    );
  }

  if (!mobileConfig.isDevRuntime && mobileConfig.usesRetiredHostApiBaseUrl) {
    return (
      <ConfigScreen
        title="Use a stable Kagie API host"
        message="This Android build is pointing at an old Kagie host. Use the live Vercel /v1 API URL before publishing."
      />
    );
  }

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
  },
  configScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    justifyContent: "center"
  },
  configCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  configEyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1
  },
  configTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  configCopy: {
    color: colors.textMuted,
    lineHeight: 21
  },
  configMetaWrap: {
    backgroundColor: "#f7f9fd",
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  configMetaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  configMetaValue: {
    color: colors.text,
    fontWeight: "800"
  },
  configHint: {
    color: colors.brandDark,
    lineHeight: 20
  }
});
