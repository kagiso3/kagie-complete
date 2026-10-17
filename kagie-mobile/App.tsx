import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  AppState,
  Animated,
  BackHandler,
  Linking,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import {
  googleCallbackFromDeepLink,
  googleNativeStatusScript,
  googleResumeScript,
  googleResumeUrl,
  googleStartFallbackScript,
  isGoogleAuthorizationUrl,
  isTrustedKagieUrl,
  NATIVE_OAUTH_MARKER_SCRIPT,
  NATIVE_OAUTH_PENDING_KEY,
  readGoogleOAuthIntent,
  readGoogleOAuthStart,
  type GoogleOAuthIntent
} from "./src/lib/native-oauth";

const DEFAULT_WEB_APP_URL = "https://kagie.app";
const rawWebAppUrl = String(process.env.EXPO_PUBLIC_KAGIE_WEB_APP_URL || DEFAULT_WEB_APP_URL).trim();
const WEB_APP_URL = rawWebAppUrl.replace(/\/+$/, "") || DEFAULT_WEB_APP_URL;

function isKagieWebUrl(url: string) {
  if (!url || url === "about:blank") return true;
  return isTrustedKagieUrl(url);
}

function LoadingView() {
  const rotation = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active) setReduceMotion(enabled);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    rotation.setValue(0);
    if (reduceMotion) return;
    const animation = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 1200,
      easing: Easing.linear,
      useNativeDriver: true
    }));
    animation.start();
    return () => { animation.stop(); rotation.stopAnimation(); };
  }, [reduceMotion, rotation]);

  return (
    <View style={styles.loadingOverlay} accessibilityRole="progressbar" accessibilityLabel="Loading Kagie" accessibilityLiveRegion="polite">
      <View style={styles.loadingLogo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.loadingWordmark}>
          <Image source={require("./assets/loading-logo-source.jpg")} style={styles.loadingWordmarkImage} />
          <View style={styles.loadingWordmarkTopMask} />
          <View style={styles.loadingWordmarkBottomMask} />
        </View>
        <Animated.View style={[styles.loadingArrow, { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
          <Image source={require("./assets/loading-arrow.png")} style={styles.loadingArrowImage} />
        </Animated.View>
      </View>
      <Text style={styles.loadingCopy}>Loading Kagie</Text>
    </View>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.errorScreen}>
      <StatusBar style="dark" backgroundColor="#f4f7fb" />
      <View style={styles.errorCard}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>K</Text>
        </View>
        <Text style={styles.errorTitle}>Kagie could not load</Text>
        <Text style={styles.errorCopy}>
          {message || "Check your connection and try again. The app uses the live Kagie web experience."}
        </Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [webViewUrl, setWebViewUrl] = useState(WEB_APP_URL);
  const [nativeReady, setNativeReady] = useState(false);
  const pendingOAuth = useRef<GoogleOAuthIntent | null>(null);
  const resumeOAuth = useRef<{ intent: GoogleOAuthIntent; callbackUrl: string } | null>(null);
  const nativeReadyRef = useRef(false);
  const queuedLink = useRef<string | null>(null);
  const oauthOperation = useRef(false);
  const currentWebUrl = useRef(WEB_APP_URL);
  const yocoNavigation = useRef(false);

  const handleNativeReturn = useCallback(async (url: string) => {
    const intent = pendingOAuth.current;
    const callbackUrl = googleCallbackFromDeepLink(url, intent);
    if (!intent || !callbackUrl) return;
    if (oauthOperation.current) { queuedLink.current = url; return; }
    // Consume synchronously so duplicate warm/cold notifications cannot replay.
    pendingOAuth.current = null;
    oauthOperation.current = true;
    try {
      await SecureStore.deleteItemAsync(NATIVE_OAUTH_PENDING_KEY);
      resumeOAuth.current = { intent, callbackUrl };
      setLoadError("");
      // Keep this WebView mounted. Its origin holds the SDK's PKCE verifier.
      const resumeUrl = googleResumeUrl(intent);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.location.replace(${JSON.stringify(resumeUrl)}); true;`);
      } else {
        setWebViewUrl(resumeUrl);
      }
    } catch {
      Alert.alert("Google sign-in", "Kagie could not resume sign-in securely. Please try again.");
    } finally {
      oauthOperation.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!nativeReadyRef.current) queuedLink.current = url;
      else void handleNativeReturn(url);
    });
    void (async () => {
      try {
        const [saved, initialUrl] = await Promise.all([
          SecureStore.getItemAsync(NATIVE_OAUTH_PENDING_KEY), Linking.getInitialURL()
        ]);
        if (!active) return;
        let stored: unknown = null;
        try { stored = saved ? JSON.parse(saved) : null; } catch { /* Invalid metadata cannot resume. */ }
        pendingOAuth.current = readGoogleOAuthIntent(stored);
        if (saved && !pendingOAuth.current) await SecureStore.deleteItemAsync(NATIVE_OAUTH_PENDING_KEY);
        const returnUrl = queuedLink.current || initialUrl;
        queuedLink.current = null;
        if (returnUrl) await handleNativeReturn(returnUrl);
      } catch {
        pendingOAuth.current = null;
      } finally {
        if (active) {
          nativeReadyRef.current = true;
          setNativeReady(true);
          const waiting = queuedLink.current;
          queuedLink.current = null;
          if (waiting) void handleNativeReturn(waiting);
        }
      }
    })();
    return () => { active = false; subscription.remove(); nativeReadyRef.current = false; };
  }, [handleNativeReturn]);

  const handleWebMessage = useCallback(async (event: WebViewMessageEvent) => {
    const { data, url } = event.nativeEvent;
    if (!isTrustedKagieUrl(url) || !isTrustedKagieUrl(currentWebUrl.current) || data.length > 20000) return;
    let payload: unknown;
    try { payload = JSON.parse(data); } catch { return; }
    if (payload && typeof payload === "object" &&
        (payload as { type?: unknown }).type === "kagie:oauth:restore-failed") {
      resumeOAuth.current = null;
      Alert.alert("Google sign-in", "Kagie could not restore sign-in in the app. Please try again.");
      setWebViewUrl(WEB_APP_URL);
      return;
    }
    const start = readGoogleOAuthStart(payload, url);
    if (!start || oauthOperation.current || resumeOAuth.current) return;
    if (pendingOAuth.current?.redirectTo === start.redirectTo) return;
    oauthOperation.current = true;
    const intent: GoogleOAuthIntent = {
      provider: start.provider, redirectTo: start.redirectTo, persist: start.persist, startedAt: start.startedAt
    };
    try {
      // Persist only callback metadata before switching apps; no code/verifier/tokens.
      await SecureStore.setItemAsync(NATIVE_OAUTH_PENDING_KEY, JSON.stringify(intent));
      pendingOAuth.current = intent;
      await Linking.openURL(start.authorizationUrl);
    } catch {
      pendingOAuth.current = null;
      await SecureStore.deleteItemAsync(NATIVE_OAUTH_PENDING_KEY).catch(() => undefined);
      webViewRef.current?.injectJavaScript(googleNativeStatusScript("error",
        "Kagie could not open your browser. Please try again or sign in with your email."));
      Alert.alert("Google sign-in", "Kagie could not open your browser. Please try again or sign in with your email.");
    } finally {
      oauthOperation.current = false;
      const waiting = queuedLink.current;
      queuedLink.current = null;
      if (waiting) void handleNativeReturn(waiting);
    }
  }, [handleNativeReturn]);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener("change", state => {
      if (resumeTimer) clearTimeout(resumeTimer);
      const pending = pendingOAuth.current;
      if (state !== "active" || !pending) return;
      // A real callback usually arrives with the foreground event. Give it a
      // moment to consume the intent before restoring a canceled browser UI.
      resumeTimer = setTimeout(() => {
        if (pendingOAuth.current?.redirectTo === pending.redirectTo &&
            !oauthOperation.current && !resumeOAuth.current) {
          webViewRef.current?.injectJavaScript(googleNativeStatusScript("resume"));
        }
      }, 750);
    });
    return () => { subscription.remove(); if (resumeTimer) clearTimeout(resumeTimer); };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      webViewRef.current?.goBack();
      return true;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigationChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (isTrustedKagieUrl(navState.url)) currentWebUrl.current = navState.url;
  }, []);

  const handleRetry = useCallback(() => {
    setLoadError("");
    setReloadKey((current) => current + 1);
  }, []);

  const handleShouldStart = useCallback((request: { url: string }) => {
    if (isKagieWebUrl(request.url)) { yocoNavigation.current = false; return true; }
    // Keep hosted checkout and its HTTPS bank authentication round trip in the
    // same WebView so Kagie's original session survives the return redirect.
    try {
      const url = new URL(request.url);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
          (url.hostname === 'c.yoco.com' || yocoNavigation.current)) {
        yocoNavigation.current = true;
        return true;
      }
    } catch { /* Normal external-link handling below rejects malformed URLs. */ }
    if (isGoogleAuthorizationUrl(request.url)) {
      // Older page navigation may race postMessage. Read its existing intent;
      // never infer the callback or remember-me choice from an external URL.
      webViewRef.current?.injectJavaScript(googleStartFallbackScript(request.url));
      return false;
    }
    if (request.url.startsWith("kagie:")) {
      void handleNativeReturn(request.url);
      return false;
    }
    try {
      if (["https:", "http:", "mailto:", "tel:"].includes(new URL(request.url).protocol)) {
        Linking.openURL(request.url).catch(() => undefined);
      }
    } catch { /* Ignore malformed or unsupported external links. */ }
    return false;
  }, [handleNativeReturn]);

  const handleLoadEnd = useCallback((url: string) => {
    if (isTrustedKagieUrl(url)) webViewRef.current?.injectJavaScript(NATIVE_OAUTH_MARKER_SCRIPT);
    const resume = resumeOAuth.current;
    if (!resume || url !== googleResumeUrl(resume.intent)) return;
    resumeOAuth.current = null;
    webViewRef.current?.injectJavaScript(googleResumeScript(resume.intent, resume.callbackUrl));
  }, []);

  if (loadError) {
    return <ErrorView message={loadError} onRetry={handleRetry} />;
  }

  if (!nativeReady) return <View style={styles.root}><LoadingView /></View>;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" backgroundColor="#f4f7fb" />
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: webViewUrl }}
        style={styles.webview}
        originWhitelist={["https://*", "kagie://*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        pullToRefreshEnabled
        startInLoadingState
        renderLoading={() => <LoadingView />}
        mixedContentMode="never"
        allowsBackForwardNavigationGestures
        onLoadStart={() => setLoadError("")}
        onNavigationStateChange={handleNavigationChange}
        onMessage={event => { void handleWebMessage(event); }}
        onLoadEnd={event => {
          if (!("description" in event.nativeEvent)) handleLoadEnd(event.nativeEvent.url);
        }}
        onShouldStartLoadWithRequest={handleShouldStart}
        onError={(event) => setLoadError(event.nativeEvent.description || "The Kagie web app did not load.")}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) {
            setLoadError(`Kagie returned ${event.nativeEvent.statusCode}. Try again shortly.`);
          }
        }}
        injectedJavaScriptBeforeContentLoaded={NATIVE_OAUTH_MARKER_SCRIPT}
        injectedJavaScript={NATIVE_OAUTH_MARKER_SCRIPT}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    paddingTop: Platform.OS === "android" ? 0 : undefined
  },
  webview: {
    flex: 1,
    backgroundColor: "#f4f7fb"
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff"
  },
  loadingLogo: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  loadingWordmark: { width: 165.6, height: 65.6, overflow: "hidden", backgroundColor: "#ffffff" },
  loadingWordmarkImage: { position: "absolute", width: 400, height: 400, left: -100, top: -159.2 },
  loadingWordmarkTopMask: { position: "absolute", right: 0, top: 0, width: 25.6, height: 20, backgroundColor: "#ffffff" },
  loadingWordmarkBottomMask: { position: "absolute", right: 0, top: 52.8, width: 25.6, height: 12.8, backgroundColor: "#ffffff" },
  loadingArrow: { width: 65.6, height: 65.6, marginLeft: -19.2, marginTop: -4.8 },
  loadingArrowImage: { width: "100%", height: "100%" },
  brandMark: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fd0505"
  },
  brandLetter: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900"
  },
  loadingCopy: {
    maxWidth: 270,
    color: "#5f7086",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f4f7fb"
  },
  errorCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 14,
    padding: 28,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)"
  },
  errorTitle: {
    color: "#132238",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center"
  },
  errorCopy: {
    color: "#5f7086",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  retryButton: {
    minHeight: 48,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#fd0505"
  },
  retryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  }
});
