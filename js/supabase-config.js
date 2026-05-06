(function () {
  if (!window.KagieAPI || typeof window.KagieAPI.configureSupabase !== "function") return;

  const STATIC_PUBLIC_CONFIG = {
    appName: "Kagie",
    apiBaseUrl: "",
    supportPhone: "0761041962",
    supportEmail: "kagisowitness79@gmail.com",
    payments: {
      merchantName: "Kagie",
      bankName: "Capitec",
      accountNumber: "1863038521",
      accountType: "Savings",
      branchCode: "470010",
      referencePrefix: "KAG",
      verificationMessage: "Payments are verified manually after checkout.",
      yocoEnabled: true,
      yocoPaymentLink: "https://pay.yoco.com/kagie-app",
      yocoProviderLabel: "Yoco secure checkout",
      payfastEnabled: false,
      payfastProviderLabel: "PayFast secure checkout"
    },
    supabase: {
      enabled: false,
      url: "",
      anonKey: ""
    }
  };

  const RUNTIME_CACHE_KEY = "kagie_runtime_config_v1";

  function trim(value) {
    return String(value || "").trim();
  }

  function normalizeBaseUrl(url) {
    return trim(url).replace(/\/+$/, "");
  }

  function toBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    const normalized = trim(value).toLowerCase();
    if (!normalized) return Boolean(fallback);
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    return Boolean(fallback);
  }

  function readRuntimeCache() {
    try {
      const source = localStorage.getItem(RUNTIME_CACHE_KEY) || sessionStorage.getItem(RUNTIME_CACHE_KEY) || "";
      if (!source) return null;
      const parsed = JSON.parse(source);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function writeRuntimeCache(payload) {
    try {
      const serialized = JSON.stringify(payload || {});
      localStorage.setItem(RUNTIME_CACHE_KEY, serialized);
      sessionStorage.setItem(RUNTIME_CACHE_KEY, serialized);
    } catch (_error) {
      // Ignore storage write failures.
    }
  }

  function getLocalApiBaseOverride() {
    try {
      return normalizeBaseUrl(localStorage.getItem("kagie_api_base_url") || "");
    } catch (_error) {
      return "";
    }
  }

  function resolveApiBaseUrl(runtimeConfig) {
    const explicitBase = normalizeBaseUrl(runtimeConfig?.apiBaseUrl || STATIC_PUBLIC_CONFIG.apiBaseUrl || "");
    if (explicitBase) return explicitBase;
    if (window.location.protocol === "file:") {
      return getLocalApiBaseOverride() || "http://localhost:3000";
    }
    return normalizeBaseUrl(window.location.origin);
  }

  function buildRuntimeConfigEndpoint() {
    return `${resolveApiBaseUrl(STATIC_PUBLIC_CONFIG)}/api/runtime-config`;
  }

  function buildAppEndpoint(runtimeConfig, path) {
    const suffix = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    return `${resolveApiBaseUrl(runtimeConfig)}${suffix}`;
  }

  function mergeRuntimeConfig(runtimeConfig) {
    return {
      ...STATIC_PUBLIC_CONFIG,
      ...(runtimeConfig || {}),
      payments: {
        ...STATIC_PUBLIC_CONFIG.payments,
        ...(runtimeConfig?.payments || {})
      },
      supabase: {
        ...STATIC_PUBLIC_CONFIG.supabase,
        ...(runtimeConfig?.supabase || {})
      }
    };
  }

  function applyRuntimeConfig(runtimeConfig) {
    const merged = mergeRuntimeConfig(runtimeConfig);

    if (typeof window.KagieAPI.saveSettings === "function") {
      window.KagieAPI.saveSettings({
        appName: trim(merged.appName) || "Kagie",
        supportPhone: trim(merged.supportPhone),
        supportEmail: trim(merged.supportEmail),
        payments: {
          merchantName: trim(merged.payments?.merchantName),
          bankName: trim(merged.payments?.bankName),
          accountNumber: trim(merged.payments?.accountNumber),
          accountType: trim(merged.payments?.accountType),
          branchCode: trim(merged.payments?.branchCode),
          referencePrefix: trim(merged.payments?.referencePrefix),
          verificationMessage: trim(merged.payments?.verificationMessage),
          yocoEnabled: toBoolean(merged.payments?.yocoEnabled, true),
          yocoCheckoutEndpoint: buildAppEndpoint(merged, "/v1/payments/yoco/checkout"),
          yocoPaymentLink: trim(merged.payments?.yocoPaymentLink),
          yocoProviderLabel: trim(merged.payments?.yocoProviderLabel),
          payfastEnabled: toBoolean(merged.payments?.payfastEnabled, false),
          payfastProviderLabel: trim(merged.payments?.payfastProviderLabel),
          payfastCheckoutEndpoint: buildAppEndpoint(merged, "/v1/payments/payfast/checkout")
        }
      });
    }

    window.KagieAPI.configureSupabase({
      enabled: Boolean(merged.supabase?.enabled !== false && trim(merged.supabase?.url) && trim(merged.supabase?.anonKey)),
      url: trim(merged.supabase?.url),
      anonKey: trim(merged.supabase?.anonKey),
      adminUsersEndpoint: buildAppEndpoint(merged, "/v1/admin/users"),
      adminAssistantsEndpoint: buildAppEndpoint(merged, "/v1/admin/assistants"),
      adminConfigStatusEndpoint: buildAppEndpoint(merged, "/v1/admin/config/status"),
      adminCreateAssistantEndpoint: buildAppEndpoint(merged, "/v1/admin/assistants"),
      adminBootstrapMasterEndpoint: buildAppEndpoint(merged, "/v1/auth/admin/master-admin/bootstrap"),
      adminMarketingBroadcastEndpoint: buildAppEndpoint(merged, "/v1/admin/marketing/broadcast")
    });

    if (typeof document !== "undefined" && typeof document.dispatchEvent === "function") {
      document.dispatchEvent(new CustomEvent("kagie:runtime-config-ready", {
        detail: {
          apiBaseUrl: resolveApiBaseUrl(merged),
          supabaseEnabled: Boolean(trim(merged.supabase?.url) && trim(merged.supabase?.anonKey))
        }
      }));
    }

    return merged;
  }

  async function fetchRuntimeConfig() {
    const response = await fetch(buildRuntimeConfigEndpoint(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || "Could not load Kagie runtime configuration.");
    }
    return payload?.data || payload || {};
  }

  const cachedConfig = readRuntimeCache();
  if (cachedConfig) {
    applyRuntimeConfig(cachedConfig);
  } else {
    applyRuntimeConfig(STATIC_PUBLIC_CONFIG);
  }

  window.__kagieRuntimeConfigPromise = window.__kagieRuntimeConfigPromise || (async () => {
    try {
      const runtimeConfig = await fetchRuntimeConfig();
      writeRuntimeCache(runtimeConfig);
      return applyRuntimeConfig(runtimeConfig);
    } catch (error) {
      if (!cachedConfig) {
        console.warn("Kagie runtime config fallback is active:", error?.message || error);
      }
      return cachedConfig ? applyRuntimeConfig(cachedConfig) : applyRuntimeConfig(STATIC_PUBLIC_CONFIG);
    }
  })();
})();
