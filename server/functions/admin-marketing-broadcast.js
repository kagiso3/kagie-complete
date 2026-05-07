const { normalizeSupabaseUrl } = require("./_supabase-url");

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

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0")) return `+27${cleaned.slice(1)}`;
  if (cleaned.startsWith("27")) return `+${cleaned}`;
  return cleaned ? `+${cleaned}` : "";
}

function normalizeSiteEnvUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
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

function normalizeCategory(valueArg) {
  const value = String(valueArg || "").trim().toLowerCase();
  if (value === "bursary_updates") return "bursary_updates";
  if (value === "internships") return "internships";
  if (value === "closing_dates") return "closing_dates";
  if (value === "application_reopenings") return "application_reopenings";
  if (value === "late_applications") return "late_applications";
  return "general_updates";
}

function normalizeAudience(valueArg) {
  return String(valueArg || "").trim().toLowerCase() === "all_accounts" ? "all_accounts" : "learners";
}

function normalizeChannels(valueArg) {
  const value = valueArg && typeof valueArg === "object" ? valueArg : {};
  return {
    inApp: value.inApp !== false,
    email: Boolean(value.email),
    sms: Boolean(value.sms)
  };
}

function uniqueRecipientsBy(users, selector) {
  const map = new Map();
  users.forEach((user) => {
    const key = selector(user);
    if (key) map.set(key, user);
  });
  return Array.from(map.values());
}

function toAbsoluteUrl(candidate, siteUrl) {
  const value = String(candidate || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (!siteUrl) return value;
  return `${siteUrl.replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
}

function buildEmailHtml(title, message, ctaLabel, ctaHref) {
  const safeTitle = String(title || "").trim();
  const safeMessage = String(message || "").trim().replace(/\n/g, "<br>");
  const button = ctaLabel && ctaHref
    ? `<p style="margin:24px 0 0"><a href="${ctaHref}" style="display:inline-block;padding:12px 18px;border-radius:14px;background:#2fa4ff;color:#ffffff;text-decoration:none;font-weight:700">${ctaLabel}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Roboto,Arial,sans-serif;color:#10203a"><div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px;box-shadow:0 18px 42px rgba(15,23,42,.10)"><div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#e8f4ff;color:#2fa4ff;font-weight:700;font-size:12px">Kagie Update</div><h1 style="margin:18px 0 12px;font-size:28px;line-height:1.15">${safeTitle}</h1><p style="margin:0;font-size:16px;line-height:1.8;color:#42526b">${safeMessage}</p>${button}<p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#6b7c95">You received this update because you have a Kagie account.</p></div></body></html>`;
}

function buildPlainTextMessage(title, message, ctaLabel, ctaHref) {
  return [
    String(title || "").trim(),
    "",
    String(message || "").trim(),
    ctaLabel && ctaHref ? "" : null,
    ctaLabel && ctaHref ? `${ctaLabel}: ${ctaHref}` : null,
    "",
    "Kagie"
  ].filter((item) => item !== null).join("\n");
}

async function runInBatches(items, batchSize, handler) {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.allSettled(batch.map(handler));
    results.push(...batchResults);
  }
  return results;
}

async function sendEmails(recipients, payload, siteUrl) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.MARKETING_FROM_EMAIL || "";
  const replyTo = process.env.MARKETING_REPLY_TO_EMAIL || "";
  if (!recipients.length) {
    return { eligible: 0, sent: 0, warnings: [] };
  }
  if (!apiKey || !from) {
    return { eligible: recipients.length, sent: 0, warnings: ["Email delivery is waiting for RESEND_API_KEY and MARKETING_FROM_EMAIL on the server."] };
  }

  const ctaHref = toAbsoluteUrl(payload.ctaHref, siteUrl);
  const html = buildEmailHtml(payload.title, payload.message, payload.ctaLabel, ctaHref);
  const text = buildPlainTextMessage(payload.title, payload.message, payload.ctaLabel, ctaHref);
  const results = await runInBatches(recipients, 15, async (recipient) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [normalizeEmail(recipient.email)],
        subject: payload.title,
        html,
        text,
        reply_to: replyTo ? [replyTo] : undefined
      })
    });
    if (!response.ok) {
      const errorPayload = await readResponse(response);
      throw new Error(errorPayload.message || `Email request failed with ${response.status}`);
    }
    return true;
  });

  return {
    eligible: recipients.length,
    sent: results.filter((item) => item.status === "fulfilled").length,
    warnings: results.some((item) => item.status === "rejected") ? ["Some emails could not be delivered. Check the email delivery provider logs."] : []
  };
}

async function sendSms(recipients, payload, siteUrl) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_FROM_NUMBER || "";
  if (!recipients.length) {
    return { eligible: 0, sent: 0, warnings: [] };
  }
  if (!accountSid || !authToken || !from) {
    return { eligible: recipients.length, sent: 0, warnings: ["SMS delivery is waiting for TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER on the server."] };
  }

  const ctaHref = toAbsoluteUrl(payload.ctaHref, siteUrl);
  const text = buildPlainTextMessage(payload.title, payload.message, payload.ctaLabel, ctaHref);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const results = await runInBatches(recipients, 15, async (recipient) => {
    const body = new URLSearchParams({
      To: normalizePhone(recipient.phone),
      From: from,
      Body: text
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) {
      const errorPayload = await readResponse(response);
      throw new Error(errorPayload.message || `SMS request failed with ${response.status}`);
    }
    return true;
  });

  return {
    eligible: recipients.length,
    sent: results.filter((item) => item.status === "fulfilled").length,
    warnings: results.some((item) => item.status === "rejected") ? ["Some SMS messages could not be delivered. Check the SMS delivery provider logs."] : []
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_ANON_KEY);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: "Live admin setup is not complete on this site yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the server environment, then redeploy." }, origin);
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

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const type = String(body.type || "info").trim().toLowerCase() || "info";
  const category = normalizeCategory(body.category);
  const audience = normalizeAudience(body.audience);
  const channels = normalizeChannels(body.channels || body);
  const ctaLabel = String(body.ctaLabel || "").trim();
  const ctaHref = String(body.ctaHref || "").trim();

  if (!title) return validationError("Broadcast title is required.", origin);
  if (!message) return validationError("Broadcast message is required.", origin);
  if (!channels.inApp && !channels.email && !channels.sms) {
    return validationError("Choose at least one delivery channel.", origin);
  }

  try {
    const actor = await supabaseFetch(supabaseUrl, "/auth/v1/user", {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`
      }
    });

    const actorRows = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/profiles?id=eq.${encodeFilter(actor.id)}&select=id,role,full_name,email&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    const actorProfile = Array.isArray(actorRows) ? actorRows[0] || null : null;
    if (!actorProfile || actorProfile.role !== "master_admin") {
      return json(403, { message: "Only a Kagie master admin can send marketing broadcasts." }, origin);
    }

    const filters = audience === "all_accounts" ? "is_active=eq.true" : "role=eq.user&is_active=eq.true";
    const recipientsRaw = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/profiles?${filters}&select=id,full_name,email,phone,role`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    const recipients = Array.isArray(recipientsRaw) ? recipientsRaw : [];

    let inAppDelivered = 0;
    if (channels.inApp && recipients.length) {
      const notificationRows = recipients.map((recipient) => ({
        user_id: recipient.id,
        title,
        message,
        notification_type: type,
        is_read: false
      }));
      await supabaseFetch(supabaseUrl, "/rest/v1/notifications", {
        method: "POST",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(notificationRows)
      });
      inAppDelivered = notificationRows.length;
    }

    const emailRecipients = uniqueRecipientsBy(recipients.filter((recipient) => normalizeEmail(recipient.email)), (recipient) => normalizeEmail(recipient.email));
    const smsRecipients = uniqueRecipientsBy(recipients.filter((recipient) => normalizePhone(recipient.phone)), (recipient) => normalizePhone(recipient.phone));
    const forwardedHost = String(event.headers["x-forwarded-host"] || "").trim();
    const siteUrl = normalizeSiteEnvUrl(process.env.URL)
      || normalizeSiteEnvUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      || normalizeSiteEnvUrl(process.env.VERCEL_URL)
      || (forwardedHost ? `https://${forwardedHost}` : origin);

    const emailResult = channels.email
      ? await sendEmails(emailRecipients, { title, message, ctaLabel, ctaHref }, siteUrl)
      : { eligible: emailRecipients.length, sent: 0, warnings: [] };
    const smsResult = channels.sms
      ? await sendSms(smsRecipients, { title, message, ctaLabel, ctaHref }, siteUrl)
      : { eligible: smsRecipients.length, sent: 0, warnings: [] };

    const warnings = []
      .concat(emailResult.warnings || [])
      .concat(smsResult.warnings || []);

    return json(200, {
      data: {
        title,
        category,
        audience,
        totalRecipients: recipients.length,
        inAppDelivered,
        emailEligible: emailResult.eligible || 0,
        emailSent: emailResult.sent || 0,
        smsEligible: smsResult.eligible || 0,
        smsSent: smsResult.sent || 0,
        warnings,
        channels
      }
    }, origin);
  } catch (error) {
    const statusCode = typeof error?.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : "Marketing broadcast failed.";
    return json(statusCode, { message }, origin);
  }
};
