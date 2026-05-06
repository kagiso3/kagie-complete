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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
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

async function getProfileSnapshot(supabaseUrl, serviceRoleKey, userId) {
  if (!userId) return null;
  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/profiles?id=eq.${encodeFilter(userId)}&select=id,role,full_name&limit=1`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findAuthUserByEmail(supabaseUrl, serviceRoleKey, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  for (let page = 1; page <= 5; page += 1) {
    const payload = await supabaseFetch(
      supabaseUrl,
      `/auth/v1/admin/users?page=${page}&per_page=200`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    const users = Array.isArray(payload?.users)
      ? payload.users
      : Array.isArray(payload)
        ? payload
        : [];

    const match = users.find((user) => normalizeEmail(user?.email) === normalizedEmail);
    if (match) return match;
    if (users.length < 200) break;
  }

  return null;
}

async function ensureProfileRecord(supabaseUrl, serviceRoleKey, userId, role, fullName, phone) {
  if (!userId) return null;

  const existing = await getProfileSnapshot(supabaseUrl, serviceRoleKey, userId).catch(() => null);
  if (existing) return existing;

  await supabaseFetch(
    supabaseUrl,
    "/rest/v1/profiles?on_conflict=id",
    {
      method: "POST",
      headers: adminHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      }),
      body: JSON.stringify({
        id: userId,
        full_name: fullName,
        role
      })
    }
  ).catch(() => null);

  return getProfileSnapshot(supabaseUrl, serviceRoleKey, userId).catch(() => null);
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: "Live admin setup is not complete on this site yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the server environment, then redeploy." }, origin);
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

  if (fullName.length < 2) return validationError("Master admin full name is required.", origin);
  if (!isValidEmail(email)) return validationError("Use a valid dedicated master admin email address, for example masteradmin@kagie.app.", origin);
  if (password.length < 6) return validationError("Master admin password must be at least 6 characters.", origin);

  try {
    const existingMasters = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/profiles?role=eq.${encodeFilter("master_admin")}&select=id,full_name&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    const existingMaster = Array.isArray(existingMasters) ? existingMasters[0] || null : null;
    if (existingMaster) {
      const existingUserId = String(existingMaster.id || "").trim();
      const existingAuthUser = existingUserId
        ? await supabaseFetch(
            supabaseUrl,
            `/auth/v1/admin/users/${encodeURIComponent(existingUserId)}`,
            {
              method: "GET",
              headers: adminHeaders(serviceRoleKey)
            }
          ).catch(() => null)
        : null;
      const existingEmail = normalizeEmail(existingAuthUser?.email);
      if (
        existingEmail &&
        existingEmail !== email &&
        existingEmail !== "kagie@app" &&
        existingEmail !== "kagie@kagie.app" &&
        existingEmail !== "kagisowitness79@gmail.com"
      ) {
        return json(409, { message: "A Kagie master admin already exists. Please use the normal login page." }, origin);
      }

      try {
        await supabaseFetch(
          supabaseUrl,
          `/auth/v1/admin/users/${encodeURIComponent(existingUserId)}`,
          {
            method: "GET",
            headers: adminHeaders(serviceRoleKey)
          }
        );

        await supabaseFetch(
          supabaseUrl,
          `/auth/v1/admin/users/${encodeURIComponent(existingUserId)}`,
          {
            method: "PUT",
            headers: adminHeaders(serviceRoleKey, {
              "Content-Type": "application/json"
            }),
            body: JSON.stringify({
              email,
              password,
              email_confirm: true,
              user_metadata: {
                full_name: fullName,
                phone,
                role: "master_admin"
              },
              app_metadata: {
                role: "master_admin"
              }
            })
          }
        );

        const repaired = await ensureProfileRecord(
          supabaseUrl,
          serviceRoleKey,
          existingUserId,
          "master_admin",
          fullName,
          phone
        ).catch(() => null);
        return json(200, {
          data: {
            id: existingUserId,
            role: "master_admin",
            fullName: repaired.full_name || fullName,
            email,
            phone,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            alreadyExists: true,
            repaired: true
          }
        }, origin);
      } catch (lookupError) {
        const status = typeof lookupError?.status === "number" ? lookupError.status : 500;
        if (status !== 404) throw lookupError;

        await supabaseFetch(
          supabaseUrl,
          `/rest/v1/profiles?id=eq.${encodeFilter(existingMaster.id)}`,
          {
            method: "DELETE",
            headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
          }
        );
      }
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
          phone,
          role: "master_admin"
        },
        app_metadata: {
          role: "master_admin"
        }
      })
    });

    const userId = created.id;

    try {
      const profile = await ensureProfileRecord(
        supabaseUrl,
        serviceRoleKey,
        userId,
        "master_admin",
        fullName,
        phone
      ).catch(() => null);

      return json(201, {
        data: {
          id: userId,
          role: "master_admin",
          fullName: profile.full_name || fullName,
          email,
          phone,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
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

    const message = error instanceof Error ? error.message : "Master admin setup failed.";
    return json(statusCode, { message }, origin);
  }
};
