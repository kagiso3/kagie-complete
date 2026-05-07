const { normalizeSupabaseUrl } = require("./_supabase-url");

function json(statusCode, payload, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(roleArg, fallbackRole = "user") {
  const role = String(roleArg || "").trim().toLowerCase();
  if (!role) return fallbackRole;
  if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(role)) {
    return "master_admin";
  }
  if (["assistant_admin", "assistant", "assistant admin", "assistant-admin", "assistantadmin", "admin", "administrator", "staff", "support", "support_staff", "support-staff", "support staff"].includes(role)) {
    return "assistant_admin";
  }
  if (["user", "learner", "student", "authenticated"].includes(role)) return "user";
  return fallbackRole;
}

function getBearerToken(headers) {
  const value = headers.authorization || headers.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
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

async function getOwnProfile(supabaseUrl, serviceRoleKey, userId) {
  if (!serviceRoleKey || !userId) return null;
  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/profiles?id=eq.${encodeFilter(userId)}&select=*&limit=1`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function isInactiveProfile(profile) {
  if (!profile) return false;
  if (profile.is_active === false) return true;
  const status = String(profile.account_status || profile.status || "").trim().toLowerCase();
  return ["inactive", "disabled", "blocked", "suspended", "banned"].includes(status);
}

async function repairStaffMetadata(supabaseUrl, serviceRoleKey, authUser, profile, role) {
  if (!serviceRoleKey || !authUser?.id || !["master_admin", "assistant_admin"].includes(role)) return;
  const currentRole = normalizeRole(authUser?.app_metadata?.role || authUser?.user_metadata?.role || "", "");
  const profileRole = normalizeRole(profile?.role || "", "");
  const needsAuthRepair = currentRole !== role;
  const needsProfileRepair = !profile || profileRole !== role;
  const fullName = String(profile?.full_name || authUser?.user_metadata?.full_name || authUser?.email || "Kagie Staff").trim();
  const phone = String(profile?.phone || authUser?.user_metadata?.phone || "").trim();

  if (needsAuthRepair) {
    await supabaseFetch(
      supabaseUrl,
      `/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`,
      {
        method: "PUT",
        headers: adminHeaders(serviceRoleKey, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          email_confirm: true,
          user_metadata: {
            ...(authUser.user_metadata || {}),
            full_name: fullName,
            phone,
            role
          },
          app_metadata: {
            ...(authUser.app_metadata || {}),
            role
          }
        })
      }
    );
  }

  if (needsProfileRepair) {
    await supabaseFetch(
      supabaseUrl,
      "/rest/v1/profiles?on_conflict=id",
      {
        method: "POST",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify({
          id: authUser.id,
          user_id: authUser.id,
          email: normalizeEmail(authUser.email || profile?.email || ""),
          full_name: fullName,
          phone,
          role,
          is_active: true,
          updated_at: new Date().toISOString()
        })
      }
    ).catch(async (error) => {
      const message = String(error?.message || "");
      if (!/column|schema cache|Could not find/i.test(message)) throw error;
      await supabaseFetch(
        supabaseUrl,
        "/rest/v1/profiles?on_conflict=id",
        {
          method: "POST",
          headers: adminHeaders(serviceRoleKey, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal"
          }),
          body: JSON.stringify({
            id: authUser.id,
            full_name: fullName,
            role,
            updated_at: new Date().toISOString()
          })
        }
      );
    });
  }
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

    const profile = await getOwnProfile(supabaseUrl, serviceRoleKey, authUser.id).catch(() => null);
    if (isInactiveProfile(profile)) {
      return json(403, { message: "This Kagie account is inactive or disabled." }, origin);
    }

    const email = normalizeEmail(authUser.email || profile?.email || "");
    const role = normalizeRole(
      authUser?.app_metadata?.role ||
      authUser?.user_metadata?.role ||
      profile?.role ||
      (["kagisowitness79@gmail.com", "masteradmin@kagie.app"].includes(email) ? "master_admin" : ""),
      "user"
    );

    await repairStaffMetadata(supabaseUrl, serviceRoleKey, authUser, profile, role).catch((error) => {
      console.warn("Kagie staff metadata repair skipped:", error?.message || error);
    });

    return json(200, {
      data: {
        id: authUser.id,
        supabaseUserId: authUser.id,
        email,
        fullName: String(profile?.full_name || authUser?.user_metadata?.full_name || email || "Kagie user").trim(),
        phone: String(profile?.phone || authUser?.user_metadata?.phone || "").trim(),
        role,
        accountStatus: profile?.account_status || profile?.status || (profile?.is_active === false ? "inactive" : "active"),
        profile: profile || null
      }
    }, origin);
  } catch (error) {
    const statusCode = typeof error?.status === "number" ? error.status : 500;
    return json(statusCode, {
      message: error?.message || "Could not resolve the authenticated Kagie role."
    }, origin);
  }
};
