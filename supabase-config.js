(function () {
  if (!window.KagieAPI || typeof window.KagieAPI.configureSupabase !== "function") return;

  const SITE_CONFIG = {
    appName: "Kagie",
    apiBaseUrl: "",
    supportPhone: "0660550764",
    supportEmail: "kagisowitness79@gmail.com",
    payments: {
      merchantName: "Kagie",
      bankName: "Capitec",
      accountNumber: "1863038521",
      accountType: "Savings",
      branchCode: "470010",
      referencePrefix: "KAG",
      verificationMessage: "Payments are verified manually after checkout."
    },
    supabase: {
      url: "https://ztfcxnowjtvonltevrqe.supabase.co",
      anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0ZmN4bm93anR2b25sdGV2cnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTU1NDIsImV4cCI6MjA4ODkzMTU0Mn0.gNQNE1OpKr9Nkph6bd4JGZ_Yt3A9w1MtpZoGDYqnQxw"
    }
  };

  function trim(value) {
    return String(value || "").trim();
  }

  function normalizeBaseUrl(url) {
    return trim(url).replace(/\/+$/, "");
  }

  function buildAssistantEndpoint() {
    const explicitBase = normalizeBaseUrl(SITE_CONFIG.apiBaseUrl);
    if (window.location.protocol === "file:" || window.location.hostname === "localhost") {
      return "http://localhost:4000/v1/admin/assistants";
    }
    if (explicitBase) {
      return `${explicitBase}/v1/admin/assistants`;
    }
    return `${window.location.origin}/v1/admin/assistants`;
  }

  function buildPublicSettings() {
    const patch = {
      appName: SITE_CONFIG.appName || "Kagie",
      payments: {
        merchantName: trim(SITE_CONFIG.payments?.merchantName),
        bankName: trim(SITE_CONFIG.payments?.bankName),
        accountNumber: trim(SITE_CONFIG.payments?.accountNumber),
        accountType: trim(SITE_CONFIG.payments?.accountType),
        branchCode: trim(SITE_CONFIG.payments?.branchCode),
        referencePrefix: trim(SITE_CONFIG.payments?.referencePrefix),
        verificationMessage: trim(SITE_CONFIG.payments?.verificationMessage)
      }
    };

    if (trim(SITE_CONFIG.supportPhone)) patch.supportPhone = trim(SITE_CONFIG.supportPhone);
    if (trim(SITE_CONFIG.supportEmail)) patch.supportEmail = trim(SITE_CONFIG.supportEmail);

    return patch;
  }

  if (typeof window.KagieAPI.saveSettings === "function") {
    window.KagieAPI.saveSettings(buildPublicSettings());
  }

  try {
    console.info("Supabase URL configured:", Boolean(SITE_CONFIG.supabase.url));
    console.info("Supabase anon key configured:", Boolean(SITE_CONFIG.supabase.anonKey));
  } catch (_) { /* ignore logging issues */ }

  window.KagieAPI.configureSupabase({
    enabled: true,
    url: SITE_CONFIG.supabase.url,
    anonKey: SITE_CONFIG.supabase.anonKey,
    adminCreateAssistantEndpoint: buildAssistantEndpoint()
  });
})();
