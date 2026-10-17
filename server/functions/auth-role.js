const { normalizeSupabaseUrl } = require("./_supabase-url");
const { getBearerToken, assertActiveActor, actorRole } = require("./_admin-auth");

function json(statusCode, payload, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function adminHeaders(serviceRoleKey, extras = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extras
  };
}

function bearerHeaders(apiKey, token, extras = {}) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    ...extras
  };
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

async function supabaseFetch(supabaseUrl, path, options) {
  const response = await fetch(`${supabaseUrl}${path}`, options);
  const payload = await readResponse(response);
  if (!response.ok) {
    const error = new Error(
      payload.msg ||
      payload.message ||
      payload.error_description ||
      payload.error ||
      `Supabase request failed with ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function getOwnProfile(supabaseUrl, serviceRoleKey, userId, anonKey, token) {
  if (!userId) return null;
  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/profiles?id=eq.${encodeFilter(userId)}&select=*&limit=1`,
    {
      method: "GET",
      headers: serviceRoleKey ? adminHeaders(serviceRoleKey) : bearerHeaders(anonKey, token)
    }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || "*";

  if (event.httpMethod === "OPTIONS") return json(200, { ok: true }, origin);
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_ANON_KEY);
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !anonKey) {
    return json(500, { message: "Supabase authentication is not configured on this deployment." }, origin);
  }

  const token = getBearerToken(event.headers || {});
  if (!token) return json(401, { message: "Missing Supabase access token." }, origin);

  try {
    const authUser = await supabaseFetch(supabaseUrl, "/auth/v1/user", {
      method: "GET",
      headers: bearerHeaders(anonKey, token)
    });
    if (!authUser?.id) return json(401, { message: "Supabase session could not be verified." }, origin);

    const profile = await getOwnProfile(supabaseUrl, serviceRoleKey, authUser.id, anonKey, token);
    assertActiveActor(authUser, profile);

    const email = normalizeEmail(authUser.email || profile?.email || "");
    const role = actorRole(authUser);

    return json(200, {
      data: {
        id: authUser.id,
        supabaseUserId: authUser.id,
        email,
        fullName: String(profile?.full_name || authUser?.user_metadata?.full_name || email || "Kagie user").trim(),
        phone: String(profile?.phone || authUser?.user_metadata?.phone || "").trim(),
        role,
        accountStatus: profile?.account_status || profile?.status || (profile?.is_active === false ? "inactive" : "active"),
        profile: profile ? { ...profile, role } : null
      }
    }, origin);
  } catch (error) {
    const statusCode = typeof error?.status === "number" ? error.status : 500;
    return json(statusCode, {
      message: statusCode >= 500 ? "Could not verify the current Kagie account. Please try again." : error?.message || "Could not resolve the authenticated Kagie role."
    }, origin);
  }
};
