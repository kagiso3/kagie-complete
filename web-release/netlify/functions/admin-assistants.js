function json(statusCode, payload, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getBearerToken(headers) {
  const value = headers.authorization || headers.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function validationError(message, origin) {
  return json(400, { message }, origin);
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
    const error = new Error(payload.msg || payload.message || payload.error_description || payload.error || `Supabase request failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function adminHeaders(serviceRoleKey, extras = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extras
  };
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = process.env.SUPABASE_URL || "https://ztfcxnowjtvonltevrqe.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: "Supabase admin configuration is missing on the server." }, origin);
  }

  const token = getBearerToken(event.headers || {});
  if (!token) {
    return json(401, { message: "Missing Supabase access token." }, origin);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_error) {
    return validationError("Request body must be valid JSON.", origin);
  }

  const fullName = String(body.fullName || "").trim();
  const email = normalizeEmail(body.email);
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");

  if (fullName.length < 2) return validationError("Assistant full name is required.", origin);
  if (!email || !email.includes("@")) return validationError("A valid assistant email is required.", origin);
  if (password.length < 6) return validationError("Assistant password must be at least 6 characters.", origin);

  try {
    const actor = await supabaseFetch(supabaseUrl, "/auth/v1/user", {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`
      }
    });

    const actorId = actor.id;
    const actorProfile = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/profiles?id=eq.${encodeFilter(actorId)}&select=id,role&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    if (!Array.isArray(actorProfile) || !actorProfile[0] || actorProfile[0].role !== "master_admin") {
      return json(403, { message: "Only a Kagie master admin can create assistant accounts." }, origin);
    }

    const created = await supabaseFetch(supabaseUrl, "/auth/v1/admin/users", {
      method: "POST",
      headers: adminHeaders(serviceRoleKey, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "assistant_admin"
        },
        app_metadata: {
          role: "assistant_admin"
        }
      })
    });

    const userId = created.id;

    try {
      const profileRows = await supabaseFetch(supabaseUrl, "/rest/v1/profiles?on_conflict=id", {
        method: "POST",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify([
          {
            id: userId,
            full_name: fullName,
            email,
            phone,
            role: "assistant_admin"
          }
        ])
      });

      await Promise.all([
        supabaseFetch(supabaseUrl, "/rest/v1/user_profiles?on_conflict=user_id", {
          method: "POST",
          headers: adminHeaders(serviceRoleKey, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          }),
          body: JSON.stringify([{ user_id: userId }])
        }),
        supabaseFetch(supabaseUrl, "/rest/v1/guardian_profiles?on_conflict=user_id", {
          method: "POST",
          headers: adminHeaders(serviceRoleKey, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          }),
          body: JSON.stringify([{ user_id: userId }])
        }),
        supabaseFetch(supabaseUrl, "/rest/v1/school_profiles?on_conflict=user_id", {
          method: "POST",
          headers: adminHeaders(serviceRoleKey, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          }),
          body: JSON.stringify([{ user_id: userId }])
        }),
        supabaseFetch(supabaseUrl, "/rest/v1/carts?on_conflict=user_id", {
          method: "POST",
          headers: adminHeaders(serviceRoleKey, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          }),
          body: JSON.stringify([{ user_id: userId }])
        })
      ]);

      const profile = Array.isArray(profileRows) ? profileRows[0] || {} : {};

      return json(201, {
        data: {
          id: userId,
          role: "assistant_admin",
          fullName: profile.full_name || fullName,
          email: profile.email || email,
          phone: profile.phone || phone,
          createdAt: profile.created_at || new Date().toISOString(),
          updatedAt: profile.updated_at || new Date().toISOString()
        }
      }, origin);
    } catch (error) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: adminHeaders(serviceRoleKey)
      }).catch(() => {});

      throw error;
    }
  } catch (error) {
    const statusCode = typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;

    const message = error instanceof Error ? error.message : "Assistant creation failed.";
    return json(statusCode, { message }, origin);
  }
};
