const crypto = require("crypto");
const { normalizeSupabaseUrl } = require("./_supabase-url");

const PAYMENT_NOTE_PREFIX = "__KAGIE_PAYMENT_META__";
const WEBHOOK_THRESHOLD_SECONDS = 180;

const STATUS = {
  application: {
    PROCESSING: "Application being processed"
  },
  payment: {
    PENDING: "Payment Pending",
    VERIFIED: "Verified"
  }
};

function json(statusCode, payload, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization, webhook-id, webhook-timestamp, webhook-signature",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}

function trim(value) {
  return String(value || "").trim();
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

function nowISO() {
  return new Date().toISOString();
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

function parsePaymentNoteState(rawNote) {
  const fallback = {
    customerNote: String(rawNote || "").trim(),
    verificationNote: "",
    rejectionReason: "",
    proofDocumentId: "",
    proofFileName: "",
    proofUploadedAt: "",
    reviewedAt: "",
    verifiedAt: "",
    gatewayProvider: "",
    gatewayCheckoutId: "",
    gatewayPaymentId: "",
    gatewayStatus: "",
    promoCode: "",
    promoTitle: "",
    offerNote: "",
    discountAmount: 0
  };

  const source = String(rawNote || "").trim();
  if (!source.startsWith(PAYMENT_NOTE_PREFIX)) return fallback;

  try {
    const payload = JSON.parse(source.slice(PAYMENT_NOTE_PREFIX.length));
    return {
      customerNote: String(payload?.customerNote || ""),
      verificationNote: String(payload?.verificationNote || ""),
      rejectionReason: String(payload?.rejectionReason || ""),
      proofDocumentId: String(payload?.proofDocumentId || ""),
      proofFileName: String(payload?.proofFileName || ""),
      proofUploadedAt: String(payload?.proofUploadedAt || ""),
      reviewedAt: String(payload?.reviewedAt || ""),
      verifiedAt: String(payload?.verifiedAt || ""),
      gatewayProvider: String(payload?.gatewayProvider || ""),
      gatewayCheckoutId: String(payload?.gatewayCheckoutId || ""),
      gatewayPaymentId: String(payload?.gatewayPaymentId || ""),
      gatewayStatus: String(payload?.gatewayStatus || ""),
      promoCode: String(payload?.promoCode || ""),
      promoTitle: String(payload?.promoTitle || ""),
      offerNote: String(payload?.offerNote || ""),
      discountAmount: Number(payload?.discountAmount || 0)
    };
  } catch (_error) {
    return fallback;
  }
}

function serializePaymentNoteState(payment) {
  const meta = {
    customerNote: trim(payment?.customerNote),
    verificationNote: trim(payment?.verificationNote),
    rejectionReason: trim(payment?.rejectionReason),
    proofDocumentId: trim(payment?.proofDocumentId),
    proofFileName: trim(payment?.proofFileName),
    proofUploadedAt: trim(payment?.proofUploadedAt),
    reviewedAt: trim(payment?.reviewedAt),
    verifiedAt: trim(payment?.verifiedAt),
    gatewayProvider: trim(payment?.gatewayProvider),
    gatewayCheckoutId: trim(payment?.gatewayCheckoutId),
    gatewayPaymentId: trim(payment?.gatewayPaymentId),
    gatewayStatus: trim(payment?.gatewayStatus),
    promoCode: trim(payment?.promoCode),
    promoTitle: trim(payment?.promoTitle),
    offerNote: trim(payment?.offerNote),
    discountAmount: Number(payment?.discountAmount || 0)
  };
  const hasMeta = Object.entries(meta).some(([key, value]) => key !== "customerNote" && value);
  return hasMeta ? `${PAYMENT_NOTE_PREFIX}${JSON.stringify(meta)}` : meta.customerNote;
}

function getHeader(headers, key) {
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "";
}

function readRawBody(event) {
  if (!event.body) return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : String(event.body);
}

function parseFormBody(rawBody) {
  const params = new URLSearchParams(rawBody);
  const body = {};
  for (const [key, value] of params.entries()) body[key] = value;
  return body;
}

function urlEncode(value) {
  return encodeURIComponent(String(value || "").trim()).replace(/%20/g, "+");
}

function buildSignatureString(data, passphrase) {
  const filtered = Object.entries(data)
    .filter(([key, value]) => key !== "signature" && value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${key}=${urlEncode(value)}`)
    .join("&");
  return passphrase ? `${filtered}&passphrase=${urlEncode(passphrase)}` : filtered;
}

function verifyPayFastSignature(data, passphrase) {
  const provided = trim(data?.signature).toLowerCase();
  if (!provided) return { ok: false, message: "Missing PayFast signature." };
  const expected = crypto.createHash("md5").update(buildSignatureString(data, passphrase)).digest("hex").toLowerCase();
  if (expected !== provided) return { ok: false, message: "Invalid PayFast signature." };
  return { ok: true };
}

async function verifyWithPayFast(rawBody, validateUrl) {
  const response = await fetch(validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `cmd=_notify-validate&${rawBody}`
  });
  const text = trim(await response.text());
  return text === "VALID";
}

function parseWebhookSignature(signatureHeader) {
  const firstChunk = String(signatureHeader || "").split(" ")[0];
  if (!firstChunk) return "";
  const commaParts = firstChunk.split(",");
  if (commaParts.length > 1) return trim(commaParts[1]);
  return trim(firstChunk.replace(/^v1,?/, ""));
}

function verifyYocoWebhook(headers, rawBody, secret) {
  const webhookId = trim(getHeader(headers, "webhook-id"));
  const webhookTimestamp = trim(getHeader(headers, "webhook-timestamp"));
  const webhookSignature = parseWebhookSignature(getHeader(headers, "webhook-signature"));

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { ok: false, message: "Missing Yoco webhook verification headers." };
  }

  const timestampNumber = Number(webhookTimestamp);
  if (!Number.isFinite(timestampNumber)) {
    return { ok: false, message: "Invalid Yoco webhook timestamp." };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber);
  if (ageSeconds > WEBHOOK_THRESHOLD_SECONDS) {
    return { ok: false, message: "Yoco webhook timestamp is too old." };
  }

  const encodedSecret = String(secret || "").split("_").slice(1).join("_");
  const secretBytes = Buffer.from(encodedSecret, "base64");
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const actualBuffer = Buffer.from(webhookSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length) {
    return { ok: false, message: "Invalid Yoco webhook signature length." };
  }

  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { ok: false, message: "Invalid Yoco webhook signature." };
  }

  return { ok: true };
}

async function bestEffortNotification(supabaseUrl, serviceRoleKey, userId, title, message, type = "info") {
  if (!userId) return;
  await fetch(`${supabaseUrl}/rest/v1/notifications`, {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify([
      {
        user_id: userId,
        title,
        message,
        notification_type: type
      }
    ])
  }).catch(() => {});
}

async function bestEffortStaffAlerts(supabaseUrl, serviceRoleKey, application, title, message, type = "info") {
  const targetIds = new Set();
  const assignedAssistantId = trim(application?.assigned_assistant_id);
  if (assignedAssistantId) targetIds.add(assignedAssistantId);

  try {
    const profiles = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/profiles?role=eq.${encodeFilter("master_admin")}&select=id&limit=20`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    (Array.isArray(profiles) ? profiles : []).forEach((profile) => {
      const id = trim(profile?.id);
      if (id) targetIds.add(id);
    });
  } catch (_error) {
    return;
  }

  const rows = Array.from(targetIds)
    .filter((id) => id && id !== trim(application?.user_id))
    .map((id) => ({
      user_id: id,
      title,
      message,
      notification_type: type
    }));
  if (!rows.length) return;

  await fetch(`${supabaseUrl}/rest/v1/notifications`, {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify(rows)
  }).catch(() => {});
}

async function bestEffortPromoRedemption(supabaseUrl, serviceRoleKey, code, userId) {
  const promoCode = trim(code).toUpperCase();
  const targetUserId = trim(userId);
  if (!promoCode || !targetUserId) return;

  try {
    const rows = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/promo_campaigns?code=eq.${encodeFilter(promoCode)}&select=id,code,used_count,redeemed_user_ids&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    const promo = Array.isArray(rows) ? rows[0] || null : null;
    if (!promo) return;

    const redeemed = Array.isArray(promo.redeemed_user_ids) ? promo.redeemed_user_ids.map((entry) => trim(entry)).filter(Boolean) : [];
    if (redeemed.includes(targetUserId)) return;

    redeemed.push(targetUserId);
    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/promo_campaigns?id=eq.${encodeFilter(promo.id)}`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({
          used_count: Number(promo.used_count || 0) + 1,
          redeemed_user_ids: redeemed
        })
      }
    );
  } catch (_error) {
    return;
  }
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
  const merchantId = trim(process.env.PAYFAST_MERCHANT_ID);
  const merchantKey = trim(process.env.PAYFAST_MERCHANT_KEY);
  const passphrase = trim(process.env.PAYFAST_PASSPHRASE);
  const validateUrl = trim(process.env.PAYFAST_VALIDATE_URL || "https://www.payfast.co.za/eng/query/validate");

  if (!supabaseUrl || !serviceRoleKey || !merchantId || !merchantKey) {
    return json(500, { message: "PayFast ITN configuration is missing on the server." }, origin);
  }

  const rawBody = readRawBody(event);
  const body = parseFormBody(rawBody);
  const verification = verifyPayFastSignature(body, passphrase);
  if (!verification.ok) {
    return json(403, { message: verification.message }, origin);
  }
  if (trim(body.merchant_id) !== merchantId || trim(body.merchant_key) !== merchantKey) {
    return json(403, { message: "Invalid PayFast merchant details." }, origin);
  }

  const remoteValid = await verifyWithPayFast(rawBody, validateUrl).catch(() => false);
  if (!remoteValid) {
    return json(403, { message: "PayFast could not verify this payment notification." }, origin);
  }

  const applicationId = trim(body.m_payment_id);
  const paymentStatusRaw = trim(body.payment_status).toUpperCase();
  const paymentId = trim(body.pf_payment_id);
  const reference = trim(body.custom_str2 || body.item_name);

  if (!applicationId) {
    return json(200, { ok: true, ignored: true, reason: "missing_application_id" }, origin);
  }

  try {
    const paymentRows = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/payments?application_id=eq.${encodeFilter(applicationId)}&select=id,application_id,note,status,reference,method,amount,payer_name,phone&order=created_at.desc&limit=5`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    const paymentRow = Array.isArray(paymentRows) ? paymentRows.find((row) => trim(row.method) === "PayFast Checkout") || paymentRows[0] || null : null;

    if (!paymentRow) {
      return json(200, { ok: true, ignored: true, reason: "payment_not_found" }, origin);
    }

    const appRows = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(applicationId)}&select=id,user_id,status,payment_status,submitted_at,payment_note,assigned_assistant_id&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    const application = Array.isArray(appRows) ? appRows[0] || null : null;
    if (!application) {
      return json(200, { ok: true, ignored: true, reason: "application_not_found" }, origin);
    }

    const currentMeta = parsePaymentNoteState(paymentRow.note || application.payment_note || "");
    const isSuccess = paymentStatusRaw === "COMPLETE";
    const nextMeta = {
      ...currentMeta,
      gatewayProvider: "payfast",
      gatewayCheckoutId: application.id,
      gatewayPaymentId: paymentId,
      gatewayStatus: paymentStatusRaw || trim(body.payment_status),
      reviewedAt: nowISO(),
      verifiedAt: isSuccess ? nowISO() : currentMeta.verifiedAt
    };

    const note = serializePaymentNoteState(nextMeta);
    const paymentStatus = isSuccess ? STATUS.payment.VERIFIED : STATUS.payment.PENDING;

    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/payments?id=eq.${encodeFilter(paymentRow.id)}`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({
          note,
          reference: reference || paymentRow.reference,
          status: paymentStatus
        })
      }
    );

    const applicationPatch = {
      payment_note: note,
      payment_status: paymentStatus
    };

    if (isSuccess) {
      applicationPatch.status = STATUS.application.PROCESSING;
      applicationPatch.submitted_at = application.submitted_at || nowISO();
    }

    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(applicationPatch)
      }
    );

    if (isSuccess) {
      const carts = await supabaseFetch(
        supabaseUrl,
        `/rest/v1/carts?user_id=eq.${encodeFilter(application.user_id)}&select=id&limit=1`,
        {
          method: "GET",
          headers: adminHeaders(serviceRoleKey)
        }
      );
      const cart = Array.isArray(carts) ? carts[0] || null : null;
      if (cart?.id) {
        await Promise.allSettled([
          supabaseFetch(
            supabaseUrl,
            `/rest/v1/cart_items?cart_id=eq.${encodeFilter(cart.id)}`,
            {
              method: "DELETE",
              headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
            }
          ),
          supabaseFetch(
            supabaseUrl,
            `/rest/v1/carts?id=eq.${encodeFilter(cart.id)}`,
            {
              method: "PATCH",
              headers: adminHeaders(serviceRoleKey, {
                "Content-Type": "application/json",
                Prefer: "return=minimal"
              }),
              body: JSON.stringify({ total_amount: 0 })
            }
          )
        ]);
      }

      await bestEffortNotification(
        supabaseUrl,
        serviceRoleKey,
        application.user_id,
        "PayFast payment verified",
        "Your Kagie payment has been verified and your application is moving into processing.",
        "success"
      );
      await bestEffortStaffAlerts(
        supabaseUrl,
        serviceRoleKey,
        application,
        "Learner payment verified",
        `A learner PayFast payment was verified${reference ? ` for reference ${reference}` : ""}. Open Kagie to continue the application flow.`,
        "success"
      );
      await bestEffortPromoRedemption(supabaseUrl, serviceRoleKey, nextMeta.promoCode, application.user_id);
    } else {
      await bestEffortNotification(
        supabaseUrl,
        serviceRoleKey,
        application.user_id,
        "PayFast payment not completed",
        "Your PayFast payment did not complete. Your cart is still available so you can retry payment.",
        "warning"
      );
      await bestEffortStaffAlerts(
        supabaseUrl,
        serviceRoleKey,
        application,
        "Learner payment did not complete",
        `A learner PayFast payment did not complete${reference ? ` for reference ${reference}` : ""}. Check the learner payment lane if follow-up is needed.`,
        "warning"
      );
    }

    return json(200, { ok: true }, origin);
  } catch (error) {
    return json(typeof error?.status === "number" ? error.status : 500, {
      message: error?.message || "Could not process PayFast ITN."
    }, origin);
  }
};
