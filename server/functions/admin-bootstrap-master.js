const { getBearerToken, assertActiveActor, actorRole } = require("./_admin-auth");

function json(statusCode, payload, origin = "*") {
  return { statusCode, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "private, no-store"
  }, body: JSON.stringify(payload) };
}

async function request(supabaseUrl, path, headers, method = "GET", body) {
  const response = await fetch(supabaseUrl + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch (_error) { payload = {}; }
  if (!response.ok) {
    const error = new Error(payload.msg || payload.message || payload.error_description || "Master admin provisioning failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || "*";
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true }, origin);
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." }, origin);

  // Initial setup belongs to the server operator. A public first-admin race or
  // an email-address match must never authorize account creation or recovery.
  const token = getBearerToken(event.headers);
  if (!token) return json(401, { message: "Sign in as an active Kagie master admin to provision another master admin. Initial setup requires the server operator." }, origin);
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !key) return json(500, { message: "Secure admin provisioning is not configured." }, origin);
  const adminHeaders = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };

  try {
    const actor = await request(supabaseUrl, "/auth/v1/user", { apikey: key, Authorization: "Bearer " + token });
    if (!actor?.id) return json(401, { message: "Supabase session could not be verified." }, origin);
    const actorRows = await request(supabaseUrl, "/rest/v1/profiles?id=eq." + encodeURIComponent(actor.id) + "&select=*&limit=1", adminHeaders);
    const actorProfile = Array.isArray(actorRows) ? actorRows[0] : null;
    assertActiveActor(actor, actorProfile);
    if (actorRole(actor, actorProfile) !== "master_admin") return json(403, { message: "Only an active Kagie master admin can provision another master admin." }, origin);

    let body;
    try {
      body = JSON.parse(event.body || "{}");
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    } catch (_error) { return json(400, { message: "Request body must be a JSON object." }, origin); }
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    if (fullName.length < 2) return json(400, { message: "Master admin full name is required." }, origin);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { message: "Use a valid master admin email address." }, origin);
    if (password.length < 8) return json(400, { message: "Master admin password must be at least 8 characters." }, origin);

    // Auth's unique email constraint makes concurrent requests safe. Existing
    // accounts are never updated, renamed, password-reset, or deleted here.
    const created = await request(supabaseUrl, "/auth/v1/admin/users", adminHeaders, "POST", {
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, phone },
      app_metadata: { role: "master_admin" }
    });
    if (!created?.id) throw new Error("The master admin account could not be created.");
    try {
      await request(supabaseUrl, "/rest/v1/profiles?on_conflict=id", { ...adminHeaders, Prefer: "resolution=merge-duplicates,return=minimal" }, "POST", {
        id: created.id, full_name: fullName, role: "master_admin"
      });
    } catch (error) {
      // Roll back only the account created by this request, never an existing
      // account. A failed rollback is reported to the operator through logs.
      await request(supabaseUrl, "/auth/v1/admin/users/" + encodeURIComponent(created.id), adminHeaders, "DELETE").catch(() => {
        console.error("New master admin profile could not be saved; account cleanup requires operator attention.");
      });
      throw error;
    }
    return json(201, { data: { id: created.id, role: "master_admin", fullName, email, phone, createdAt: created.created_at || new Date().toISOString() } }, origin);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if ([409, 422].includes(status) || /already|registered|exists/i.test(String(error?.message || ""))) {
      return json(409, { message: "This email already belongs to a Kagie account. Use normal sign-in or password recovery; provisioning does not reset existing accounts." }, origin);
    }
    return json(status, { message: status >= 500 ? "Master admin provisioning could not be completed." : error?.message || "Master admin provisioning failed." }, origin);
  }
};
