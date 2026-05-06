const REST_PAGE_SIZE = 1000;
const REST_MAX_PAGES = 20;

function json(statusCode, payload, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
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

function bearerHeaders(apiKey, token, extras = {}) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    ...extras
  };
}

function extendHeaders(headers, extras = {}) {
  return {
    ...(headers || {}),
    ...extras
  };
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

async function getProfileSnapshot(supabaseUrl, serviceRoleKey, userId) {
  return getProfileSnapshotWithHeaders(supabaseUrl, adminHeaders(serviceRoleKey), userId);
}

async function getProfileSnapshotWithHeaders(supabaseUrl, headers, userId) {
  if (!userId) return null;
  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/profiles?id=eq.${encodeFilter(userId)}&select=id,role,full_name&limit=1`,
    {
      method: "GET",
      headers
    }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function supabaseFetchAllRows(supabaseUrl, basePath, headers) {
  const collected = [];
  const separator = basePath.includes("?") ? "&" : "?";
  for (let page = 0; page < REST_MAX_PAGES; page += 1) {
    const from = page * REST_PAGE_SIZE;
    const to = from + REST_PAGE_SIZE - 1;
    const path = `${basePath}${separator}limit=${REST_PAGE_SIZE}&offset=${from}`;
    const rows = await supabaseFetch(supabaseUrl, path, {
      method: "GET",
      headers: extendHeaders(headers, { Range: `${from}-${to}` })
    });
    const pageRows = Array.isArray(rows) ? rows : [];
    collected.push(...pageRows);
    if (pageRows.length < REST_PAGE_SIZE) break;
  }
  return collected;
}

async function findAuthUserByEmail(supabaseUrl, serviceRoleKey, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const users = await listAllAuthUsers(supabaseUrl, serviceRoleKey);
  return users.find((user) => normalizeEmail(user?.email) === normalizedEmail) || null;
}

async function listAllAuthUsers(supabaseUrl, serviceRoleKey) {
  const collected = [];
  for (let page = 1; page <= 50; page += 1) {
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

    collected.push(...users);
    if (users.length < 200) break;
  }

  return collected;
}

function isMasterAdminActor(actor, profileRole = "") {
  const role = String(actor?.app_metadata?.role || actor?.user_metadata?.role || profileRole || "").trim().toLowerCase();
  if (role === "master_admin") return true;
  const email = normalizeEmail(actor?.email || "");
  return ["kagisowitness79@gmail.com", "masteradmin@kagie.app"].includes(email);
}

function normalizeKagieRole(roleArg, fallbackRole = "user") {
  const role = String(roleArg || "").trim().toLowerCase();
  if (!role) return fallbackRole;
  if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(role)) {
    return "master_admin";
  }
  if (["assistant_admin", "assistant", "assistant admin", "assistant-admin", "assistantadmin", "admin", "administrator", "staff", "support", "support_staff", "support-staff", "support staff"].includes(role)) {
    return "assistant_admin";
  }
  if (["user", "learner", "student", "authenticated"].includes(role)) {
    return "user";
  }
  return fallbackRole;
}

function isStaffActor(actor, profileRole = "") {
  const role = normalizeKagieRole(actor?.app_metadata?.role || actor?.user_metadata?.role || profileRole || "", "user");
  return role === "master_admin" || role === "assistant_admin" || isMasterAdminActor(actor, profileRole);
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (!["GET", "POST", "DELETE"].includes(event.httpMethod)) {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    return json(500, { message: "Live admin setup is not complete on this site yet. Add SUPABASE_URL and either SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY to the server environment, then redeploy." }, origin);
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

  try {
    const authApiKey = serviceRoleKey || anonKey;
    const actor = await supabaseFetch(supabaseUrl, "/auth/v1/user", {
      method: "GET",
      headers: bearerHeaders(authApiKey, token)
    });

    const readHeaders = serviceRoleKey ? adminHeaders(serviceRoleKey) : bearerHeaders(anonKey, token);
    const actorProfile = await getProfileSnapshotWithHeaders(supabaseUrl, readHeaders, actor?.id).catch(() => null);
    const masterActor = isMasterAdminActor(actor, actorProfile?.role || "");
    const staffActor = isStaffActor(actor, actorProfile?.role || "");

    if (event.httpMethod === "GET") {
      if (!staffActor) {
        return json(403, { message: "Only Kagie staff can view assistant accounts." }, origin);
      }

      const [authUsers, profileRows] = await Promise.all([
        serviceRoleKey ? listAllAuthUsers(supabaseUrl, serviceRoleKey) : Promise.resolve([]),
        supabaseFetchAllRows(
          supabaseUrl,
          "/rest/v1/profiles?select=id,role,full_name,email,phone,created_at,updated_at&order=created_at.desc",
          readHeaders
        ).catch(() => [])
      ]);

      const assistantProfiles = Array.isArray(profileRows)
        ? profileRows.filter((row) => normalizeKagieRole(row?.role || "", "user") === "assistant_admin")
        : [];
      const profileMap = new Map(assistantProfiles.map((row) => [String(row?.id || "").trim(), row || {}]));
      const items = [];
      const seen = new Set();

      const pushAssistant = (entry) => {
        const key = String(entry?.id || entry?.email || "").trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push(entry);
      };

      authUsers.forEach((user) => {
        const profile = profileMap.get(String(user?.id || "").trim()) || {};
        const role = normalizeKagieRole(
          user?.app_metadata?.role || user?.user_metadata?.role || profile?.role || "",
          "user"
        );
        if (role !== "assistant_admin") return;
        pushAssistant({
          id: String(user?.id || "").trim(),
          role: "assistant_admin",
          fullName: String(profile?.full_name || user?.user_metadata?.full_name || user?.email || "Kagie Assistant").trim(),
          email: normalizeEmail(user?.email || profile?.email || ""),
          phone: String(profile?.phone || user?.user_metadata?.phone || "").trim(),
          createdAt: user?.created_at || profile?.created_at || "",
          updatedAt: user?.updated_at || profile?.updated_at || user?.created_at || ""
        });
      });

      assistantProfiles.forEach((profile) => {
        pushAssistant({
          id: String(profile?.id || "").trim(),
          role: "assistant_admin",
          fullName: String(profile?.full_name || profile?.email || "Kagie Assistant").trim(),
          email: normalizeEmail(profile?.email || ""),
          phone: String(profile?.phone || "").trim(),
          createdAt: profile?.created_at || "",
          updatedAt: profile?.updated_at || profile?.created_at || ""
        });
      });

      items.sort((left, right) => String(left?.fullName || left?.email || "").localeCompare(String(right?.fullName || right?.email || "")));
      return json(200, { data: items }, origin);
    }

    if (!masterActor) {
      return json(403, { message: "Only a Kagie master admin can manage assistant accounts." }, origin);
    }

    if (!serviceRoleKey) {
      return json(500, { message: "Assistant account changes require SUPABASE_SERVICE_ROLE_KEY. Viewing assistants still works, but create/delete needs the secure server key." }, origin);
    }

    if (event.httpMethod === "DELETE") {
      const assistantId = String(body.assistantId || body.id || "").trim();
      const email = normalizeEmail(body.email);
      if (!assistantId && !email) {
        return validationError("Assistant id or email is required.", origin);
      }

      const filters = assistantId
        ? `id=eq.${encodeFilter(assistantId)}`
        : "";

      let assistantRows;
      if (assistantId) {
        assistantRows = await supabaseFetch(
          supabaseUrl,
          `/rest/v1/profiles?${filters}&select=id,role&limit=1`,
          {
            method: "GET",
            headers: adminHeaders(serviceRoleKey)
          }
        );
      } else {
        const assistantAuthUser = await findAuthUserByEmail(supabaseUrl, serviceRoleKey, email);
        if (!assistantAuthUser?.id) {
          assistantRows = [];
        } else {
          assistantRows = await supabaseFetch(
            supabaseUrl,
            `/rest/v1/profiles?id=eq.${encodeFilter(assistantAuthUser.id)}&select=id,role&limit=1`,
            {
              method: "GET",
              headers: adminHeaders(serviceRoleKey)
            }
          );
        }
      }

      const assistant = Array.isArray(assistantRows) ? assistantRows[0] || null : null;
      if (!assistant) {
        return json(404, { message: "Assistant account not found." }, origin);
      }
      if (normalizeKagieRole(assistant.role || "", "user") !== "assistant_admin") {
        return json(400, { message: "Only assistant accounts can be removed here." }, origin);
      }

      const assistantUserId = String(assistant.id || "").trim();
      const timestamp = new Date().toISOString();

      await Promise.allSettled([
        supabaseFetch(
          supabaseUrl,
          `/rest/v1/applications?assistant_id=eq.${encodeFilter(assistantUserId)}`,
          {
            method: "PATCH",
            headers: adminHeaders(serviceRoleKey, {
              "Content-Type": "application/json",
              Prefer: "return=minimal"
            }),
            body: JSON.stringify({
              assistant_id: null,
              updated_at: timestamp
            })
          }
        ),
        supabaseFetch(
          supabaseUrl,
          `/rest/v1/user_profiles?user_id=eq.${encodeFilter(assistantUserId)}`,
          {
            method: "DELETE",
            headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
          }
        ),
        supabaseFetch(
          supabaseUrl,
          `/rest/v1/guardian_profiles?user_id=eq.${encodeFilter(assistantUserId)}`,
          {
            method: "DELETE",
            headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
          }
        ),
        supabaseFetch(
          supabaseUrl,
          `/rest/v1/school_profiles?user_id=eq.${encodeFilter(assistantUserId)}`,
          {
            method: "DELETE",
            headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
          }
        ),
        supabaseFetch(
          supabaseUrl,
          `/rest/v1/carts?user_id=eq.${encodeFilter(assistantUserId)}`,
          {
            method: "DELETE",
            headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
          }
        )
      ]);

      await supabaseFetch(supabaseUrl, `/auth/v1/admin/users/${encodeURIComponent(assistantUserId)}`, {
        method: "DELETE",
        headers: adminHeaders(serviceRoleKey)
      });

      return json(200, {
        data: {
          id: assistantUserId,
          removed: true
        }
      }, origin);
    }

    const fullName = String(body.fullName || "").trim();
    const email = normalizeEmail(body.email);
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (fullName.length < 2) return validationError("Assistant full name is required.", origin);
    if (!isValidEmail(email)) return validationError("Use a real assistant email address, for example name@kagie.app.", origin);
    if (password.length < 6) return validationError("Assistant password must be at least 6 characters.", origin);

    const existingAuthUser = await findAuthUserByEmail(supabaseUrl, serviceRoleKey, email);
    const existingRole = existingAuthUser?.app_metadata?.role || existingAuthUser?.user_metadata?.role || "";
    if (existingAuthUser) {
      if (existingRole && normalizeKagieRole(existingRole, "user") !== "assistant_admin") {
        return json(409, { message: "This email is already used by a non-assistant Kagie account." }, origin);
      }

      const existingUserId = String(existingAuthUser.id || "").trim();
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
                role: "assistant_admin"
              },
              app_metadata: {
                role: "assistant_admin"
              }
            })
          }
        );

        return json(200, {
          data: {
            id: existingUserId,
            role: "assistant_admin",
            fullName,
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
        await Promise.allSettled([
          supabaseFetch(
            supabaseUrl,
            `/rest/v1/user_profiles?user_id=eq.${encodeFilter(existingUserId)}`,
            {
              method: "DELETE",
              headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
            }
          ),
          supabaseFetch(
            supabaseUrl,
            `/rest/v1/guardian_profiles?user_id=eq.${encodeFilter(existingUserId)}`,
            {
              method: "DELETE",
              headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
            }
          ),
          supabaseFetch(
            supabaseUrl,
            `/rest/v1/school_profiles?user_id=eq.${encodeFilter(existingUserId)}`,
            {
              method: "DELETE",
              headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
            }
          ),
          supabaseFetch(
            supabaseUrl,
            `/rest/v1/carts?user_id=eq.${encodeFilter(existingUserId)}`,
            {
              method: "DELETE",
              headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
            }
          )
        ]);
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
          role: "assistant_admin"
        },
        app_metadata: {
          role: "assistant_admin"
        }
      })
    });

    const userId = created.id;

    return json(201, {
      data: {
        id: userId,
        role: "assistant_admin",
        fullName,
        email,
        phone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }, origin);
  } catch (error) {
    const statusCode = typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;

    let message = error instanceof Error ? error.message : "Assistant creation failed.";
    if (
      /profiles_id_fkey/i.test(String(message)) ||
      (/foreign key constraint/i.test(String(message)) && /profiles/i.test(String(message))) ||
      (/update or delete on table/i.test(String(message)) && /users/i.test(String(message)) && /profiles/i.test(String(message)))
    ) {
      message = "Live profile policy conflict blocked assistant creation. Kagie should switch to the direct assistant signup fallback on the latest deploy.";
    }
    return json(statusCode, { message }, origin);
  }
};
