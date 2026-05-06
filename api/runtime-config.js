function trim(value) {
  return String(value || "").trim();
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = trim(value).toLowerCase();
  if (!normalized) return fallback;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

module.exports = async function runtimeConfig(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Method not allowed." }));
    return;
  }

  const payload = {
    data: {
      appName: trim(process.env.KAGIE_APP_NAME) || "Kagie",
      apiBaseUrl: trim(process.env.KAGIE_API_BASE_URL),
      supportPhone: trim(process.env.KAGIE_SUPPORT_PHONE) || "0761041962",
      supportEmail: trim(process.env.KAGIE_SUPPORT_EMAIL) || "kagisowitness79@gmail.com",
      payments: {
        merchantName: trim(process.env.KAGIE_MERCHANT_NAME) || "Kagie",
        bankName: trim(process.env.KAGIE_BANK_NAME) || "Capitec",
        accountNumber: trim(process.env.KAGIE_BANK_ACCOUNT_NUMBER) || "1863038521",
        accountType: trim(process.env.KAGIE_BANK_ACCOUNT_TYPE) || "Savings",
        branchCode: trim(process.env.KAGIE_BANK_BRANCH_CODE) || "470010",
        referencePrefix: trim(process.env.KAGIE_PAYMENT_REFERENCE_PREFIX) || "KAG",
        verificationMessage: trim(process.env.KAGIE_PAYMENT_VERIFICATION_MESSAGE) || "Payments are verified manually after checkout.",
        yocoEnabled: toBoolean(process.env.KAGIE_YOCO_ENABLED, true),
        yocoPaymentLink: trim(process.env.KAGIE_YOCO_PAYMENT_LINK) || "https://pay.yoco.com/kagie-app",
        yocoProviderLabel: trim(process.env.KAGIE_YOCO_PROVIDER_LABEL) || "Yoco secure checkout",
        payfastEnabled: toBoolean(process.env.KAGIE_PAYFAST_ENABLED, false),
        payfastProviderLabel: trim(process.env.KAGIE_PAYFAST_PROVIDER_LABEL) || "PayFast secure checkout"
      },
      supabase: {
        enabled: Boolean(trim(process.env.SUPABASE_URL) && trim(process.env.SUPABASE_ANON_KEY)),
        url: trim(process.env.SUPABASE_URL),
        anonKey: trim(process.env.SUPABASE_ANON_KEY)
      }
    }
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.end(JSON.stringify(payload));
};
