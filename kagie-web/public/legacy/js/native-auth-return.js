/* Relay a browser OAuth code back to the app; never exchange it in this browser. */
(function () {
  "use strict";
  const source = new URL(window.location.href);
  if (source.searchParams.get("oauth") !== "google" || source.searchParams.get("native_auth") !== "1") return;
  if (window.KagieNativeOAuth?.version === 1) return;
  const fragment = new URLSearchParams(source.hash.replace(/^#/, ""));
  const code = source.searchParams.get("code") || fragment.get("code") || "";
  const error = source.searchParams.get("error") || fragment.get("error") || source.searchParams.get("error_code") || fragment.get("error_code") || "";
  const tokenKeys = ["access_token", "refresh_token", "provider_token", "provider_refresh_token"];
  const hasToken = tokenKeys.some(key => source.searchParams.has(key) || fragment.has(key));
  if (!code && !error && !hasToken) return;
  window.KagieNativeOAuthReturning = true;
  const state = source.searchParams.get("native_state") || "";
  const validState = /^[a-f0-9]{64}$/i.test(state);
  const validCode = /^[a-z0-9._~-]{1,2048}$/i.test(code);
  const destination = new URL("kagie://auth/google");
  let link = "";
  if (!hasToken && validState && (error || validCode)) {
    destination.searchParams.set("native_state", state);
    if (error) {
      destination.searchParams.set("error", /^[a-z0-9_.-]{1,120}$/i.test(error) ? error : "oauth_failed");
      const errorCode = source.searchParams.get("error_code") || fragment.get("error_code");
      if (errorCode && /^[a-z0-9_.-]{1,120}$/i.test(errorCode)) destination.searchParams.set("error_code", errorCode);
    } else destination.searchParams.set("code", code);
    link = destination.toString();
  }
  const clean = new URL(source);
  ["code", "error", "error_code", "error_description", "native_state", ...tokenKeys].forEach(key => clean.searchParams.delete(key));
  if (["code", "error", "error_code", "error_description", "native_state", ...tokenKeys].some(key => fragment.has(key))) clean.hash = "";
  window.history.replaceState(window.history.state, "", clean.pathname + clean.search + clean.hash);

  function renderReturn() {
    document.title = "Return to Kagie";
    const style = document.createElement("style");
    style.textContent = "*{box-sizing:border-box}body{margin:0;background:#f6f9fd;color:#10233d;font:16px/1.5 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.kagie-native-return{width:min(420px,100%);padding:32px;background:#fff;border:1px solid #e3ebf4;border-radius:16px;text-align:center}.kagie-native-return-mark{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 20px;border-radius:12px;background:#fd0505;color:#fff;font-size:34px;font-weight:800}.kagie-native-return h1{font-size:24px;line-height:1.3;margin:0 0 12px}.kagie-native-return p{color:#52657c;margin:0 0 24px}.kagie-native-return a{display:flex;align-items:center;justify-content:center;min-height:48px;padding:12px 20px;border-radius:10px;background:#fd0505;color:#fff;font-weight:650;text-decoration:none}.kagie-native-return a:focus-visible{outline:3px solid #2d9df9;outline-offset:4px}";
    document.head.appendChild(style);
    document.body.className = "";
    document.body.removeAttribute("data-kagie-page");
    document.body.replaceChildren();
    const panel = document.createElement("main");
    panel.className = "kagie-native-return";
    const mark = document.createElement("span"); mark.className = "kagie-native-return-mark"; mark.textContent = "K"; mark.setAttribute("aria-hidden", "true"); panel.appendChild(mark);
    const title = document.createElement("h1"); title.textContent = link ? "Returning to Kagie" : "Sign-in could not return to Kagie"; panel.appendChild(title);
    const copy = document.createElement("p"); copy.textContent = link ? "Tap below if the app does not open automatically." : "Open Kagie and try Google sign-in again."; panel.appendChild(copy);
    if (link) {
      const button = document.createElement("a"); button.id = "nativeOAuthReturn"; button.href = link; button.textContent = "Return to Kagie"; panel.appendChild(button);
    }
    document.body.appendChild(panel);
    if (link) {
      // Keep the visible link available when the browser requires a user gesture.
      try { window.location.assign(link); } catch (_) { /* The tap action remains available. */ }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderReturn, { once: true });
  else renderReturn();
})();
