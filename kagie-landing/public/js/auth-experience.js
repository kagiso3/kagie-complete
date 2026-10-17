(function () {
  "use strict";
  const learnerRoutes = new Set([
    "home.html", "Dashboard.html", "forms.html", "apply.html", "cart.html", "checkout.html",
    "profile.html", "upload.html", "documents.html", "payment.html", "recommendation.html",
    "updates.html", "notifications.html", "notification.html", "career-guidance.html",
    "prospectus.html", "personal-assistance.html", "more-service/index.html",
    "more-service/accommodation-assist.html", "more-service/transport-assist.html",
    "more-service/funding-assist.html", "more-service/available-bursaries.html",
    "more-service/bursary-details.html", "more-service/funding-checklist.html",
    "more-service/funding-guide.html", "more-service/funding-requirements.html",
    "more-service/funding-support.html", "more-service/help-support.html",
    "more-service/re-apply.html", "more-service/change-email.html",
    "more-service/forgot-pin.html", "more-service/forgot-student-number.html"
  ]);

  function safeNext(value) {
    if (!String(value || "").trim()) return "";
    try {
      const target = new URL(String(value).trim(), window.location.origin + "/");
      const route = target.pathname.replace(/^\/+/, "");
      if (target.origin !== window.location.origin || !learnerRoutes.has(route)) return "";
      return route + target.search + target.hash;
    } catch (_) { return ""; }
  }

  function fieldError(input, text) {
    if (!input) return;
    const error = document.getElementById(input.id + "Error");
    if (text) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = text || "";
      error.hidden = !text;
    }
  }

  function clearErrors(form) {
    form.querySelectorAll("input, select, textarea").forEach(input => fieldError(input, ""));
  }

  function bindFieldFeedback(form) {
    const clear = event => {
      if (event.target.matches("input, select, textarea")) fieldError(event.target, "");
    };
    form.addEventListener("input", clear);
    form.addEventListener("change", clear);
  }

  function showMessage(node, text, type) {
    node.setAttribute("role", type === "error" ? "alert" : "status");
    node.textContent = text || "";
    node.className = "message" + (type ? " " + type : "");
  }

  function buttonLabel(button, text) {
    const label = button.querySelector(".auth-button-label");
    if (label) label.textContent = text;
    else button.textContent = text;
  }


  function googleRedirectUrl(next) {
    const target = new URL("/login.html", window.location.origin);
    target.searchParams.set("app", "1");
    target.searchParams.set("oauth", "google");
    if (window.KagieNativeOAuth?.version === 1) target.searchParams.set("native_auth", "1");
    const route = safeNext(next);
    if (route) target.searchParams.set("next", route);
    return target.toString();
  }

  function oauthErrorMessage() {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const error = query.get("error") || fragment.get("error") || query.get("error_code") || fragment.get("error_code");
    if (!error) return "";
    if (/access_denied|user_cancelled|user_canceled/i.test(error)) return "Google sign-in was canceled. Try again or sign in with your email.";
    return "Google sign-in could not be completed. Try again or sign in with your email.";
  }

  function clearOAuthCallbackParams() {
    const target = new URL(window.location.href);
    ["code", "oauth", "error", "error_code", "error_description", "native_auth", "native_state"].forEach(key => target.searchParams.delete(key));
    const fragment = new URLSearchParams(target.hash.replace(/^#/, ""));
    if (["access_token", "refresh_token", "provider_token", "provider_refresh_token", "error", "error_code", "error_description"].some(key => fragment.has(key))) target.hash = "";
    window.history.replaceState({}, document.title, target.pathname + target.search + target.hash);
  }

  window.KagieAccountUI = Object.freeze({ safeNext, fieldError, clearErrors, bindFieldFeedback, showMessage, buttonLabel, googleRedirectUrl, oauthErrorMessage, clearOAuthCallbackParams });
})();
