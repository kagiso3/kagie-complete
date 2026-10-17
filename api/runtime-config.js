function trim(value) {
  return String(value || "").trim();
}

// Supabase anon keys are public browser credentials. Vercel env vars still win,
// but this fallback keeps login alive if Production envs are accidentally empty.
const PUBLIC_SUPABASE_FALLBACK = {
  url: "https://ztfcxnowjtvonltevrqe.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0ZmN4bm93anR2b25sdGV2cnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTU1NDIsImV4cCI6MjA4ODkzMTU0Mn0.gNQNE1OpKr9Nkph6bd4JGZ_Yt3A9w1MtpZoGDYqnQxw"
};

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = trim(value).toLowerCase();
  if (!normalized) return fallback;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_error) {
    return null;
  }
}

function isPublicSupabaseKey(key) {
  if (/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return true;
  const payload = decodeJwtPayload(key);
  return String(key || '').split('.').length === 3 && payload?.role === 'anon';
}

function normalizeSupabaseUrl(url, anonKey) {
  const direct = trim(url).replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(direct)) return direct;

  const ref = trim(decodeJwtPayload(anonKey)?.ref);
  if (/^[a-z0-9-]+$/i.test(ref)) return `https://${ref}.supabase.co`;

  return "";
}

module.exports = async function runtimeConfig(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Method not allowed." }));
    return;
  }

  const supabaseUrl = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.KAGIE_PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_FALLBACK.url,
    process.env.SUPABASE_ANON_KEY || process.env.KAGIE_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_FALLBACK.anonKey
  );
  const configuredSupabaseKey = trim(
    process.env.SUPABASE_ANON_KEY ||
    process.env.KAGIE_PUBLIC_SUPABASE_ANON_KEY ||
    PUBLIC_SUPABASE_FALLBACK.anonKey
  );
  // Never expose a service-role or secret key through a misnamed environment variable.
  const supabaseAnonKey = isPublicSupabaseKey(configuredSupabaseKey) ? configuredSupabaseKey : '';
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
        verificationMessage: trim(process.env.KAGIE_PAYMENT_VERIFICATION_MESSAGE) || "After you transfer, Kagie verifies your payment manually. Use your Kagie reference and upload proof of payment.",
        yocoEnabled: toBoolean(process.env.KAGIE_YOCO_ENABLED, false) && Boolean(trim(process.env.YOCO_SECRET_KEY) && trim(process.env.YOCO_WEBHOOK_SECRET)) && ["test", "live"].includes(trim(process.env.YOCO_MODE || process.env.YOCO_ENV)),
        yocoPaymentLink: "",
        yocoProviderLabel: "Yoco secure checkout",
        payfastEnabled: toBoolean(process.env.KAGIE_PAYFAST_ENABLED, false),
        payfastProviderLabel: trim(process.env.KAGIE_PAYFAST_PROVIDER_LABEL) || "PayFast secure checkout"
      },
      supabase: {
        enabled: Boolean(supabaseUrl && supabaseAnonKey),
        url: supabaseUrl,
        anonKey: supabaseAnonKey
      }
    }
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};
