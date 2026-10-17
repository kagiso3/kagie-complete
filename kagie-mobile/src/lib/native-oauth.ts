import { URL } from "react-native-url-polyfill";

// Native transports OAuth metadata and a one-use code. The PKCE verifier and
// authenticated session remain in the trusted WebView's origin storage.
export const GOOGLE_AUTH_ORIGIN = "https://ztfcxnowjtvonltevrqe.supabase.co";
export const OAUTH_INTENT_KEY = "kagie_oauth_intent";
export const NATIVE_OAUTH_PENDING_KEY = "kagie_native_google_pending_v1";
export const OAUTH_MAX_AGE_MS = 15 * 60 * 1000;
export const KAGIE_HOSTS = new Set([
  "kagie.app", "www.kagie.app",
  "kagie-complete-kagisowitness79-9153s-projects.vercel.app"
]);
const CALLBACK_PATHS = new Set(["/login.html", "/", "/index.html", "/app", "/app/", "/app/index.html"]);
const RESULT_KEYS = new Set(["native_state", "code", "error", "error_code", "error_description"]);

export type GoogleOAuthIntent = {
  provider: "google";
  redirectTo: string;
  persist: boolean;
  startedAt: number;
};
export type GoogleOAuthStart = GoogleOAuthIntent & { authorizationUrl: string };

function parseUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value || value.length > 16384) return null;
  try { return new URL(value); } catch { return null; }
}

export function isTrustedKagieUrl(value: string): boolean {
  const url = parseUrl(value);
  return Boolean(url && url.protocol === "https:" && KAGIE_HOSTS.has(url.hostname.toLowerCase()) &&
    !url.username && !url.password && !url.port);
}

function isNativeGoogleCallback(url: URL): boolean {
  return isTrustedKagieUrl(url.href) && CALLBACK_PATHS.has(url.pathname) && !url.hash &&
    url.searchParams.getAll("oauth").length === 1 && url.searchParams.get("oauth") === "google" &&
    url.searchParams.getAll("native_auth").length === 1 && url.searchParams.get("native_auth") === "1" &&
    url.searchParams.getAll("native_state").length === 1 &&
    /^[a-zA-Z0-9_-]{32,128}$/.test(url.searchParams.get("native_state") || "") &&
    !["code", "error", "error_code", "error_description", "access_token", "refresh_token"].some(key => url.searchParams.has(key));
}

export function readGoogleOAuthIntent(value: unknown, now = Date.now()): GoogleOAuthIntent | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const age = now - Number(item.startedAt);
  const callback = parseUrl(item.redirectTo);
  if (item.provider !== "google" || typeof item.persist !== "boolean" ||
      typeof item.startedAt !== "number" || !Number.isFinite(age) || age < 0 || age > OAUTH_MAX_AGE_MS ||
      !callback || !isNativeGoogleCallback(callback)) return null;
  return { provider: "google", redirectTo: callback.href, persist: item.persist, startedAt: item.startedAt };
}

export function isGoogleAuthorizationUrl(value: string): boolean {
  const url = parseUrl(value);
  return Boolean(url && url.origin === GOOGLE_AUTH_ORIGIN && url.pathname === "/auth/v1/authorize" &&
    !url.username && !url.password && !url.hash &&
    url.searchParams.getAll("provider").length === 1 && url.searchParams.get("provider") === "google");
}

export function readGoogleOAuthStart(value: unknown, senderUrl: string, now = Date.now()): GoogleOAuthStart | null {
  if (!value || typeof value !== "object" || !isTrustedKagieUrl(senderUrl)) return null;
  const item = value as Record<string, unknown>;
  if (item.type !== "kagie:oauth:start" || item.version !== 1 || typeof item.authorizationUrl !== "string" ||
      !isGoogleAuthorizationUrl(item.authorizationUrl)) return null;
  const intent = readGoogleOAuthIntent(item, now);
  const authorization = parseUrl(item.authorizationUrl);
  if (!intent || !authorization) return null;
  const sender = new URL(senderUrl);
  const callback = new URL(intent.redirectTo);
  if (sender.origin !== callback.origin || !CALLBACK_PATHS.has(sender.pathname) ||
      authorization.searchParams.getAll("redirect_to").length !== 1 ||
      authorization.searchParams.get("redirect_to") !== intent.redirectTo ||
      authorization.searchParams.getAll("code_challenge").length !== 1 ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(authorization.searchParams.get("code_challenge") || "") ||
      authorization.searchParams.getAll("code_challenge_method").length !== 1 ||
      authorization.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256") return null;
  return { ...intent, authorizationUrl: authorization.href };
}

// The target and persistence choice come exclusively from the saved intent.
export function googleCallbackFromDeepLink(value: string, pending: GoogleOAuthIntent | null, now = Date.now()): string | null {
  const intent = readGoogleOAuthIntent(pending, now);
  const link = parseUrl(value);
  if (!intent || !link || link.protocol !== "kagie:" || link.hostname !== "auth" ||
      link.pathname !== "/google" || link.username || link.password || link.port || link.hash) return null;
  for (const key of link.searchParams.keys()) {
    if (!RESULT_KEYS.has(key) || link.searchParams.getAll(key).length !== 1) return null;
  }
  const target = new URL(intent.redirectTo);
  if (link.searchParams.get("native_state") !== target.searchParams.get("native_state")) return null;
  const code = link.searchParams.get("code");
  const error = link.searchParams.get("error") || link.searchParams.get("error_code");
  if ((!code && !error) || (code && error) || (code && !/^[A-Za-z0-9._~-]{1,2048}$/.test(code))) return null;
  for (const key of ["error", "error_code", "error_description"]) {
    const text = link.searchParams.get(key);
    if (text !== null && (!text || text.length > (key === "error_description" ? 1024 : 256) || /[\u0000-\u001f\u007f]/.test(text))) return null;
  }
  target.searchParams.delete("native_auth");
  for (const key of ["code", "error", "error_code", "error_description"]) {
    const text = link.searchParams.get(key);
    if (text !== null) target.searchParams.set(key, text);
  }
  return target.href;
}

export function googleResumeUrl(intent: GoogleOAuthIntent): string {
  return new URL("/splash.html?native_oauth_resume=1", intent.redirectTo).href;
}

export const NATIVE_OAUTH_MARKER_SCRIPT = "window.KAGIE_NATIVE_ANDROID = true; window.KagieNativeOAuth = Object.freeze({version:1}); true;";

export function googleNativeStatusScript(status: "error" | "resume", message = ""): string {
  const detail = { version: 1, ...(message ? { message } : {}) };
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(`kagie:native-oauth-${status}`)}, {detail:${JSON.stringify(detail)}})); true;`;
}

export function googleResumeScript(intent: GoogleOAuthIntent, callbackUrl: string): string {
  const target = new URL(callbackUrl);
  const origin = new URL(intent.redirectTo).origin;
  if (target.origin !== origin || target.searchParams.has("native_auth")) throw new Error("Invalid native OAuth return target.");
  // onLoadEnd runs this on the harmless same-origin splash, then navigates to
  // the callback. Restoration therefore precedes SDK initialization on Android.
  return `(function(){if(window.location.origin !== ${JSON.stringify(origin)} || window.location.pathname !== '/splash.html' || window.location.search !== '?native_oauth_resume=1') return; try { sessionStorage.setItem(${JSON.stringify(OAUTH_INTENT_KEY)}, ${JSON.stringify(JSON.stringify(intent))}); window.location.replace(${JSON.stringify(callbackUrl)}); } catch (_) { window.ReactNativeWebView.postMessage(JSON.stringify({type:'kagie:oauth:restore-failed',version:1})); }})(); true;`;
}

export function googleStartFallbackScript(authorizationUrl: string): string {
  if (!isGoogleAuthorizationUrl(authorizationUrl)) throw new Error("Invalid Google authorization target.");
  return `(function(){try{var intent=JSON.parse(sessionStorage.getItem(${JSON.stringify(OAUTH_INTENT_KEY)}) || 'null'); if(intent) window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({},intent,{type:'kagie:oauth:start',version:1,authorizationUrl:${JSON.stringify(authorizationUrl)}})));}catch(_){}})(); true;`;
}
