const { getBearerToken, assertActiveActor, actorRole } = require("./_admin-auth");

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store"
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

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const token = getBearerToken(event.headers);
  if (!token) return json(401, { message: "Missing Supabase access token." }, origin);
  if (!supabaseUrl || !serviceRoleKey) return json(503, { message: "Secure admin status is not configured." }, origin);
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` }
    });
    if (!authResponse.ok) return json(401, { message: "Supabase session could not be verified." }, origin);
    const actor = await authResponse.json();
    if (!actor?.id) return json(401, { message: "Supabase session could not be verified." }, origin);
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(actor.id)}&select=*&limit=1`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
    });
    if (!profileResponse.ok) return json(503, { message: "Could not verify the current Kagie role." }, origin);
    const rows = await profileResponse.json();
    const profile = Array.isArray(rows) ? rows[0] : null;
    assertActiveActor(actor, profile);
    if (actorRole(actor, profile) !== "master_admin") return json(403, { message: "Only a Kagie master admin can view server setup status." }, origin);
  } catch (error) {
    return json(error?.status === 403 ? 403 : 503, { message: error?.status === 403 ? error.message : "Could not verify the current Kagie role." }, origin);
  }
  const yocoSecretKey = String(process.env.YOCO_SECRET_KEY || "").trim();
  const yocoWebhookSecret = String(process.env.YOCO_WEBHOOK_SECRET || "").trim();

  return json(200, {
    data: {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      secureAdminProvisioningReady: Boolean(supabaseUrl && serviceRoleKey),
      hasYocoSecretKey: Boolean(yocoSecretKey),
      hasYocoWebhookSecret: Boolean(yocoWebhookSecret),
      yocoCheckoutReady: Boolean(yocoSecretKey && yocoWebhookSecret)
    }
  }, origin);
};
