import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { colors, shadows } from "../theme";

export function AuthScreen() {
  const { login, register, continueOffline } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<"auth" | "offline" | null>(null);
  const actionLockedRef = useRef(false);
  const submitting = activeAction !== null;
  const authLoading = activeAction === "auth";
  const offlineLoading = activeAction === "offline";

  async function submit() {
    if (submitting || actionLockedRef.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address so we can find your account.");
      return;
    }
    if (!password) {
      setError("Enter your password to continue.");
      return;
    }
    if (mode === "register" && (fullName.trim().length < 2 || phone.trim().length < 6 || password.length < 8)) {
      setError("Add your full name, a valid phone number and a password with at least 8 characters.");
      return;
    }
    actionLockedRef.current = true;
    setError("");
    setActiveAction("auth");

    try {
      if (mode === "login") {
        await login({ email: email.trim(), password });
      } else {
        await register({ fullName: fullName.trim(), phone: phone.trim(), email: email.trim(), password });
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "";
      setError(/network|fetch|offline|connection|timeout/i.test(message)
        ? "We could not connect to Kagie. Check your connection and try again."
        : /incorrect|invalid.*password|credentials/i.test(message)
          ? "Your email or password does not match. Check your details and try again."
          : /already.*registered|already.*exists/i.test(message)
            ? "An account may already use these details. Try signing in."
            : /email.*confirm/i.test(message)
              ? "Check your email for your account confirmation link, then sign in."
              : "We could not continue right now. Please try again.");
    } finally {
      actionLockedRef.current = false;
      setActiveAction(null);
    }
  }

  async function startOffline() {
    if (submitting || actionLockedRef.current) return;
    actionLockedRef.current = true;
    setError("");
    setActiveAction("offline");

    try {
      await continueOffline(fullName || "Kagie Student");
    } catch (offlineError) {
      setError(offlineError instanceof Error ? offlineError.message : "Could not start Kagie offline mode.");
    } finally {
      actionLockedRef.current = false;
      setActiveAction(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>K</Text>
                <View style={styles.brandBadgeAccent} />
              </View>
              <Text style={styles.brand}>Kagie</Text>
            </View>
            <Text style={styles.title}>Apply once. Reach multiple institutions.</Text>
            <Text style={styles.copy}>Your applications, documents and student support together in one place.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => {
                  if (!submitting) { setMode("login"); setError(""); setPasswordVisible(false); }
                }}
                style={[styles.toggle, mode === "login" && styles.toggleActive, submitting && styles.toggleDisabled]}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting, selected: mode === "login" }}
              >
                <Text style={[styles.toggleText, mode === "login" && styles.toggleTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!submitting) { setMode("register"); setError(""); setPasswordVisible(false); }
                }}
                style={[styles.toggle, mode === "register" && styles.toggleActive, submitting && styles.toggleDisabled]}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting, selected: mode === "register" }}
              >
                <Text style={[styles.toggleText, mode === "register" && styles.toggleTextActive]}>Create account</Text>
              </Pressable>
            </View>

            <View style={styles.formHeader}>
              <Text style={styles.formTitle} accessibilityRole="header">{mode === "login" ? "Welcome back" : "Create your account"}</Text>
              <Text style={styles.copy}>{mode === "login" ? "Sign in to pick up where you left off." : "Start with your details. You can complete your profile from your dashboard."}</Text>
            </View>

            {mode === "register" ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <TextInput accessibilityLabel="Full name" style={[styles.input, submitting && styles.inputDisabled]} placeholder="Your first and last name" placeholderTextColor={colors.textMuted} value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" editable={!submitting} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Phone number</Text>
                  <TextInput accessibilityLabel="Phone number" style={[styles.input, submitting && styles.inputDisabled]} placeholder="e.g. 071 234 5678" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" editable={!submitting} />
                </View>
              </>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput accessibilityLabel="Email" style={[styles.input, submitting && styles.inputDisabled]} placeholder="you@example.com" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!submitting} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput accessibilityLabel="Password" style={[styles.input, styles.passwordInput, submitting && styles.inputDisabled]} placeholder={mode === "login" ? "Enter your password" : "Create a password"} placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} autoComplete={mode === "login" ? "current-password" : "new-password"} textContentType={mode === "login" ? "password" : "newPassword"} secureTextEntry={!passwordVisible} editable={!submitting} />
                <Pressable style={styles.passwordToggle} accessibilityRole="button" accessibilityLabel={passwordVisible ? "Hide password" : "Show password"} accessibilityState={{ disabled: submitting, selected: passwordVisible }} disabled={submitting} onPress={() => setPasswordVisible((current) => !current)}>
                  <Text style={styles.passwordToggleText}>{passwordVisible ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>
              {mode === "register" ? <Text style={styles.helper}>Use at least 8 characters. Choose a unique password for your account.</Text> : null}
            </View>

            {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}

            <Pressable
              onPress={submit}
              style={[styles.submit, submitting && styles.submitDisabled]}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: authLoading }}
            >
              <View style={styles.buttonContent}>
                {authLoading ? <ActivityIndicator color="#ffffff" size="small" /> : null}
                <Text style={styles.submitText}>
                  {authLoading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign in" : "Create account"}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={startOffline}
              style={[styles.offlineButton, submitting && styles.submitDisabled]}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: offlineLoading }}
            >
              <View style={styles.buttonContent}>
                {offlineLoading ? <ActivityIndicator color="#0f172a" size="small" /> : null}
                <Text style={styles.offlineButtonText}>{offlineLoading ? "Opening offline mode..." : "Continue in offline mode"}</Text>
              </View>
            </Pressable>

            {!mobileConfig.isDevRuntime && mobileConfig.usesLocalApiBaseUrl ? (
              <Text style={styles.warning}>
                Online sign-in is unavailable in this build. You can still use offline mode to save drafts on this phone.
              </Text>
            ) : !mobileConfig.apiBaseUrl ? (
              <Text style={styles.warning}>
                Online sign-in is unavailable in this build. You can still use offline mode to save drafts on this phone.
              </Text>
            ) : (
              <Text style={styles.helper}>
                Offline mode saves drafts on this phone. Sign in with internet access to sync your account.
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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 16, alignItems: "center" },
  hero: {
    padding: 23,
    borderRadius: 16,
    backgroundColor: colors.surfaceGlass,
    gap: 11,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    width: "100%",
    maxWidth: 540,
    ...shadows.lift
  },
  brandRow: {
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
  brand: { color: colors.brand, fontSize: 15, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 25, fontWeight: "800", lineHeight: 31 },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: 16,
    padding: 19,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    width: "100%",
    maxWidth: 540,
    ...shadows.card
  },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  toggle: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: "center" },
  toggleActive: { backgroundColor: colors.brand },
  toggleDisabled: { opacity: 0.62 },
  toggleText: { color: "#64748b", fontWeight: "700" },
  toggleTextActive: { color: "#ffffff" },
  formHeader: { gap: 6, marginBottom: 6 },
  formTitle: { color: colors.text, fontSize: 25, fontWeight: "800", lineHeight: 31 },
  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "600" },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 74 },
  passwordToggle: { position: "absolute", right: 5, top: 5, bottom: 5, minWidth: 58, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  passwordToggleText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: "#0f172a",
    borderWidth: 1,
    fontSize: 16,
    borderColor: colors.border
  },
  inputDisabled: { opacity: 0.62 },
  error: { color: colors.brandDark, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10, fontSize: 13, lineHeight: 19 },
  submit: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  offlineButton: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border
  },
  offlineButtonText: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  helper: { color: "#64748b", fontSize: 12, lineHeight: 18 }
  ,
  warning: { color: "#fd0505", fontSize: 12, lineHeight: 18, fontWeight: "700" }
});
