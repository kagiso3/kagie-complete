import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSession } from "../session/SessionProvider";
import { mobileConfig } from "../config";

export function AuthScreen() {
  const { login, register } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ fullName, phone, email, password });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not continue with Kagie authentication.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.brand}>Kagie</Text>
            <Text style={styles.title}>South African tertiary applications, now in your pocket.</Text>
            <Text style={styles.copy}>Sign in to continue your application journey or create a student account and start a fresh draft.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Pressable onPress={() => setMode("login")} style={[styles.toggle, mode === "login" && styles.toggleActive]}>
                <Text style={[styles.toggleText, mode === "login" && styles.toggleTextActive]}>Login</Text>
              </Pressable>
              <Pressable onPress={() => setMode("register")} style={[styles.toggle, mode === "register" && styles.toggleActive]}>
                <Text style={[styles.toggleText, mode === "register" && styles.toggleTextActive]}>Register</Text>
              </Pressable>
            </View>

            {mode === "register" ? (
              <>
                <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#6b7280" value={fullName} onChangeText={setFullName} />
                <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor="#6b7280" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </>
            ) : null}

            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#6b7280" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280" value={password} onChangeText={setPassword} secureTextEntry />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={submit} style={[styles.submit, submitting && styles.submitDisabled]} disabled={submitting}>
              <Text style={styles.submitText}>{submitting ? "Please wait..." : mode === "login" ? "Continue to Kagie" : "Create Kagie account"}</Text>
            </Pressable>

            {!mobileConfig.isDevRuntime && mobileConfig.usesLocalApiBaseUrl ? (
              <Text style={styles.warning}>
                This build is still connected to a local Kagie API. Set a live EXPO_PUBLIC_API_BASE_URL before creating the Play Store bundle.
              </Text>
            ) : (
              <Text style={styles.helper}>
                One profile, one dashboard, one guided path to your tertiary applications.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#f5f7fb" },
  content: { padding: 20, gap: 16 },
  hero: {
    padding: 22,
    borderRadius: 30,
    backgroundColor: "#c90000",
    gap: 10
  },
  brand: { color: "#ffd66f", fontSize: 16, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "900", lineHeight: 34 },
  copy: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 21 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 4
  },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  toggle: { flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: "#f4f7fb", alignItems: "center" },
  toggleActive: { backgroundColor: "#e6f4ff" },
  toggleText: { color: "#64748b", fontWeight: "700" },
  toggleTextActive: { color: "#1273c9" },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  error: { color: "#b91c1c", fontSize: 13, lineHeight: 18 },
  submit: { backgroundColor: "#2fa4ff", borderRadius: 18, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  helper: { color: "#64748b", fontSize: 12, lineHeight: 18 }
  ,
  warning: { color: "#b45309", fontSize: 12, lineHeight: 18, fontWeight: "700" }
});
