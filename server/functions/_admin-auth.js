function getBearerToken(headers = {}) {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === "authorization");
  const match = String(entry?.[1] || "").trim().match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : "";
}

function isInactiveProfile(profile) {
  if (profile?.is_active === false) return true;
  return [profile?.account_status, profile?.status].some(value =>
    ["inactive", "disabled", "blocked", "suspended", "banned", "deleted"].includes(String(value || "").trim().toLowerCase())
  );
}

function assertActiveActor(actor, profile) {
  if (!actor?.id) {
    const error = new Error("Supabase session could not be verified.");
    error.status = 401;
    throw error;
  }
  if (!profile && actorRole(actor) !== "user") {
    const error = new Error("The Kagie staff profile is unavailable. Ask the server operator to restore the account profile.");
    error.status = 403;
    throw error;
  }
  const bannedUntil = Date.parse(actor.banned_until || "");
  if (isInactiveProfile(profile) || Boolean(actor.deleted_at) || (Number.isFinite(bannedUntil) && bannedUntil > Date.now())) {
    const error = new Error("This Kagie account is inactive or disabled.");
    error.status = 403;
    throw error;
  }
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(role)) return "master_admin";
  if (["assistant_admin", "assistant", "assistant admin", "assistant-admin", "assistantadmin", "admin", "administrator", "staff", "support", "support_staff", "support-staff", "support staff"].includes(role)) return "assistant_admin";
  return "user";
}

// app_metadata is set through the Auth admin API. user_metadata is editable by
// the account holder, so it must never be an authorization fallback.
function actorRole(actor) {
  return normalizeRole(actor?.app_metadata?.role || "");
}

module.exports = { getBearerToken, isInactiveProfile, assertActiveActor, actorRole };
