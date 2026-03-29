import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { SessionProvider, useSession } from "./src/session/SessionProvider";
import { AuthScreen } from "./src/screens/AuthScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";

function AppShell() {
  const { loading, user } = useSession();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color="#ffffff" />
        <Text style={styles.loadingTitle}>Opening Kagie</Text>
        <Text style={styles.loadingText}>Restoring your application session and dashboard.</Text>
      </SafeAreaView>
    );
  }

  return user ? <DashboardScreen /> : <AuthScreen />;
}

export default function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#c90000",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  loadingTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800"
  },
  loadingText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280
  }
});
