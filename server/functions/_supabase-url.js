function trim(value) {
  return String(value || "").trim();
}

function decodeJwtRef(token) {
  const parts = trim(token).split(".");
  if (parts.length < 2) return "";

  try {
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return trim(decoded.ref);
  } catch (_error) {
    return "";
  }
}

function normalizeSupabaseUrl(value, ...tokens) {
  const keyRef = tokens.map(decodeJwtRef).find(Boolean) || "";
  const raw = trim(value)
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/auth\/v1$/i, "");

  if (!raw) return keyRef ? `https://${keyRef}.supabase.co` : "";

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const hostRef = host.endsWith(".supabase.co") ? host.split(".")[0] : "";

    if (keyRef && hostRef && hostRef !== keyRef) {
      return `https://${keyRef}.supabase.co`;
    }

    return parsed.origin;
  } catch (_error) {
    return keyRef ? `https://${keyRef}.supabase.co` : raw;
  }
}

module.exports = {
  normalizeSupabaseUrl,
  decodeJwtRef
};
