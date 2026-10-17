import type { ProtectedRouteKey } from "./types";

const protectedRoutes = new Set<ProtectedRouteKey>([
  "home", "apply", "application-packages", "application-form", "cart", "checkout",
  "dashboard", "accommodation", "transport"
]);

export function safeAuthNextRoute(value: string | null): ProtectedRouteKey {
  const route = String(value || "").replace(/^#\/?/, "").trim().toLowerCase();
  return protectedRoutes.has(route as ProtectedRouteKey) ? route as ProtectedRouteKey : "home";
}

export function readAuthReturn() {
  const url = new URL(window.location.href);
  const isCallback = url.searchParams.get("oauth") === "google";
  return {
    isCallback,
    failed: isCallback && Boolean(url.searchParams.get("error") || url.searchParams.get("error_code")),
    nextRoute: safeAuthNextRoute(url.searchParams.get("next") || url.hash)
  };
}

export function googleAuthRedirect(nextRoute: ProtectedRouteKey): string {
  const callback = new URL(window.location.pathname, window.location.origin);
  callback.searchParams.set("oauth", "google");
  callback.searchParams.set("next", safeAuthNextRoute(nextRoute));
  if (window.KagieNativeOAuth?.version === 1) callback.searchParams.set("native_auth", "1");
  return callback.toString();
}

export function clearAuthReturn() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("oauth") !== "google") return;
  for (const key of ["oauth", "next", "native_auth", "native_state", "code", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
