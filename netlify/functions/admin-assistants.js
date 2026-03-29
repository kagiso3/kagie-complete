const { createClient } = require("@supabase/supabase-js");

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

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    const authResult = await client.auth.getUser(token);
    if (authResult.error || !authResult.data.user) {
      return json(401, { message: authResult.error?.message || "Supabase access token rejected." }, origin);
    }

    const actor = authResult.data.user;
    const actorProfileResult = await client
      .from("profiles")
      .select("id, role")
      .eq("id", actor.id)
      .maybeSingle();

    if (actorProfileResult.error) {
      return json(500, { message: actorProfileResult.error.message || "Could not verify Kagie role." }, origin);
    }

    if (!actorProfileResult.data || actorProfileResult.data.role !== "master_admin") {
      return json(403, { message: "Only a Kagie master admin can create assistant accounts." }, origin);
    }

    const created = await client.auth.admin.createUser({
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
    });

    if (created.error || !created.data.user) {
      const message = created.error?.message || "Could not create the assistant auth account.";
      const statusCode = /already/i.test(message) ? 409 : 500;
      return json(statusCode, { message }, origin);
    }

    const userId = created.data.user.id;
    const profileUpsert = await client
      .from("profiles")
      .upsert({
        id: userId,
        full_name: fullName,
        email,
        phone,
        role: "assistant_admin"
      })
      .select("*")
      .single();

    const [userProfileResult, guardianProfileResult, schoolProfileResult, cartResult] = await Promise.all([
      client.from("user_profiles").upsert({ user_id: userId }),
      client.from("guardian_profiles").upsert({ user_id: userId }),
      client.from("school_profiles").upsert({ user_id: userId }),
      client.from("carts").upsert({ user_id: userId }, { onConflict: "user_id" })
    ]);

    const errors = [
      profileUpsert.error,
      userProfileResult.error,
      guardianProfileResult.error,
      schoolProfileResult.error,
      cartResult.error
    ].filter(Boolean);

    if (errors.length) {
      await client.auth.admin.deleteUser(userId).catch(() => {});
      return json(500, { message: errors[0].message || "Could not finish creating the assistant profile." }, origin);
    }

    const profile = profileUpsert.data || {};

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
    return json(500, { message: error instanceof Error ? error.message : "Assistant creation failed." }, origin);
  }
};
