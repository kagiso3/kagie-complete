const { normalizeSupabaseUrl, decodeJwtRef } = require("./_supabase-url");

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL, serviceRoleKey, anonKey);
  const configuredRef = (() => {
    try {
      return new URL(supabaseUrl).hostname.split(".")[0] || "";
    } catch (_error) {
      return "";
    }
  })();
  const keyRef = decodeJwtRef(serviceRoleKey) || decodeJwtRef(anonKey);

  return json(200, {
    data: {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      secureAdminProvisioningReady: Boolean(supabaseUrl && serviceRoleKey),
      supabaseRefMatchesKey: Boolean(!configuredRef || !keyRef || configuredRef === keyRef)
    }
  }, origin);
};
