function trim(value) {
  return String(value || "").trim();
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_error) {
    return null;
  }
}

function normalizeSupabaseUrl(url, serviceRoleKey, anonKey) {
  const direct = trim(url).replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(direct)) return direct;

  for (const key of [anonKey, serviceRoleKey]) {
    const ref = trim(decodeJwtPayload(key)?.ref);
    if (/^[a-z0-9-]+$/i.test(ref)) return `https://${ref}.supabase.co`;
  }

  return "";
}

module.exports = {
  normalizeSupabaseUrl
};
