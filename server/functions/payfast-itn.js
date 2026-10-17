const { assertPaymentAmount, clearPaidCart, settlePayment } = require("./_payment-settlement");
const crypto = require("crypto");

const PAYMENT_NOTE_PREFIX = "__KAGIE_PAYMENT_META__";

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
    checkoutCartId: "",
    checkoutCartItemIds: [],
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
      checkoutCartId: trim(payload?.checkoutCartId),
      checkoutCartItemIds: Array.isArray(payload?.checkoutCartItemIds) ? payload.checkoutCartItemIds.map(trim).filter(Boolean) : [],
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
    checkoutCartId: trim(payment?.checkoutCartId),
    checkoutCartItemIds: Array.isArray(payment?.checkoutCartItemIds) ? payment.checkoutCartItemIds.map(trim).filter(Boolean) : [],
    discountAmount: Number(payment?.discountAmount || 0)
  };
  const hasMeta = Object.entries(meta).some(([key, value]) => key !== "customerNote" && value);
  return hasMeta ? `${PAYMENT_NOTE_PREFIX}${JSON.stringify(meta)}` : meta.customerNote;
}

function readRawBody(event) {
  if (!event.body) return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : String(event.body);
}

function parseFormBody(rawBody) {
  const params = new URLSearchParams(rawBody);
  const body = {};
  for (const [key, value] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(body, key)) throw new Error("Duplicate PayFast notification field.");
    Object.defineProperty(body, key, { value, enumerable: true });
  }
  return body;
}

function urlEncode(value) {
  return encodeURIComponent(String(value ?? "")).replace(/[!'()*~]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, "+");
}

function buildSignatureString(data, passphrase) {
  const filtered = Object.entries(data)
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${urlEncode(value)}`)
    .join("&");
  return passphrase ? `${filtered}&passphrase=${urlEncode(passphrase)}` : filtered;
}

function verifyPayFastSignature(data, passphrase) {
  const provided = trim(data?.signature).toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(provided)) return { ok: false, message: "Invalid PayFast signature." };
  const expected = crypto.createHash("md5").update(buildSignatureString(data, passphrase)).digest("hex").toLowerCase();
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return { ok: false, message: "Invalid PayFast signature." };
  return { ok: true };
}

async function verifyWithPayFast(rawBody, validateUrl) {
  const response = await fetch(validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildSignatureString(parseFormBody(rawBody), "")
  });
  const text = trim(await response.text());
  return response.ok && text === "VALID";
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
  const assignedAssistantId = trim(application?.assistant_id);
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
  const origin = event.headers?.origin || event.headers?.Origin || "*";
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true }, origin);
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." }, origin);
  const supabaseUrl = trim(process.env.SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const merchantId = trim(process.env.PAYFAST_MERCHANT_ID);
  const passphrase = trim(process.env.PAYFAST_PASSPHRASE);
  const validateUrl = trim(process.env.PAYFAST_VALIDATE_URL || "https://www.payfast.co.za/eng/query/validate");
  if (!supabaseUrl || !serviceRoleKey || !merchantId) return json(500, { message: "PayFast ITN configuration is missing on the server." }, origin);
  if (!["https://www.payfast.co.za/eng/query/validate", "https://sandbox.payfast.co.za/eng/query/validate"].includes(validateUrl)) return json(500, { message: "PayFast validation URL is not configured correctly." }, origin);
  const rawBody = readRawBody(event);
  let body;
  try { body = parseFormBody(rawBody); } catch { return json(400, { message: "Invalid PayFast notification fields." }, origin); }
  const verification = verifyPayFastSignature(body, passphrase);
  if (!verification.ok) return json(403, { message: verification.message }, origin);
  // merchant_key belongs to the outbound checkout, not to PayFast's ITN payload.
  if (trim(body.merchant_id) !== merchantId) return json(403, { message: "Invalid PayFast merchant details." }, origin);
  let remoteValid;
  try { remoteValid = await verifyWithPayFast(rawBody, validateUrl); } catch { return json(503, { message: "PayFast validation is temporarily unavailable. Please retry." }, origin); }
  if (!remoteValid) return json(403, { message: "PayFast could not verify this payment notification." }, origin);
  const checkoutId = trim(body.m_payment_id);
  const paymentStatusRaw = trim(body.payment_status).toUpperCase();
  const paymentId = trim(body.pf_payment_id);
  if (!checkoutId || !paymentId || !["COMPLETE", "FAILED", "CANCELLED"].includes(paymentStatusRaw)) return json(400, { message: "PayFast payment notification is incomplete." }, origin);
  const isSuccess = paymentStatusRaw === "COMPLETE";
  try {
    const rows = await supabaseFetch(supabaseUrl, "/rest/v1/payments?gateway_checkout_id=eq." + encodeFilter(checkoutId) + "&select=*&limit=1", { method: "GET", headers: adminHeaders(serviceRoleKey) });
    const paymentRow = Array.isArray(rows) ? rows[0] : null;
    if (!paymentRow) return json(503, { message: "Payment checkout is not ready. Please retry this notification." }, origin);
    const meta = parsePaymentNoteState(paymentRow.note);
    if (trim(paymentRow.provider || meta.gatewayProvider) !== "payfast" || trim(paymentRow.method) !== "PayFast Checkout" || trim(paymentRow.gateway_checkout_id || meta.gatewayCheckoutId) !== checkoutId || trim(body.custom_str2) !== trim(paymentRow.reference)) return json(409, { message: "PayFast payment does not match this checkout." }, origin);
    assertPaymentAmount(paymentRow, body.amount_gross, "ZAR");
    const appRows = await supabaseFetch(supabaseUrl, "/rest/v1/applications?id=eq." + encodeFilter(paymentRow.application_id) + "&select=id,user_id,status,payment_status,submitted_at,payment_note,assistant_id&limit=1", { method: "GET", headers: adminHeaders(serviceRoleKey) });
    const application = Array.isArray(appRows) ? appRows[0] : null;
    if (!application) return json(503, { message: "Payment application is not ready. Please retry this notification." }, origin);
    if (body.custom_str1 && trim(body.custom_str1) !== trim(application.user_id)) return json(409, { message: "PayFast payment owner does not match this checkout." }, origin);
    const nextMeta = { ...meta, gatewayProvider: "payfast", gatewayCheckoutId: checkoutId, gatewayPaymentId: paymentId, gatewayStatus: paymentStatusRaw, reviewedAt: nowISO(), verifiedAt: isSuccess ? meta.verifiedAt || nowISO() : meta.verifiedAt };
    const result = await settlePayment((path, payload) => supabaseFetch(supabaseUrl, path, { method: "POST", headers: adminHeaders(serviceRoleKey, { "Content-Type": "application/json" }), body: JSON.stringify(payload) }), paymentRow, { provider: "payfast", checkoutId, paymentId, gatewayStatus: paymentStatusRaw, success: isSuccess, amount: Number(body.amount_gross), currency: "ZAR", note: serializePaymentNoteState(nextMeta), failureReason: isSuccess ? "" : paymentStatusRaw });
    if (isSuccess && !result.application_already_paid) await clearPaidCart(nextMeta, application.user_id,
      path => supabaseFetch(supabaseUrl, path, { method: "GET", headers: adminHeaders(serviceRoleKey) }),
      (path, method, value) => supabaseFetch(supabaseUrl, path, { method, headers: adminHeaders(serviceRoleKey, { "Content-Type": "application/json", Prefer: "return=minimal" }), ...(value ? { body: JSON.stringify(value) } : {}) }));
    if (result?.applied && result.application_already_paid) {
      await bestEffortNotification(supabaseUrl, serviceRoleKey, application.user_id, "Payment received for review", "This application already has a verified payment. Kagie needs to review this additional payment. Your cart is still available.", "warning");
      await bestEffortStaffAlerts(supabaseUrl, serviceRoleKey, application, "Additional payment needs review", "An additional verified payment was received for an application that is already paid. Review the payment records and arrange reconciliation.", "warning");
    } else if (result?.applied) {
      await bestEffortNotification(supabaseUrl, serviceRoleKey, application.user_id, isSuccess ? "PayFast payment verified" : "PayFast payment not completed", isSuccess ? "Your Kagie payment has been verified. Complete any remaining application details from your Dashboard." : "Your PayFast payment did not complete. Your cart is still available so you can retry payment.", isSuccess ? "success" : "warning");
      await bestEffortStaffAlerts(supabaseUrl, serviceRoleKey, application, isSuccess ? "Learner payment verified" : "Learner payment did not complete", "A learner PayFast payment was updated. Open Kagie to review the application payment.", isSuccess ? "success" : "warning");
      if (isSuccess) await bestEffortPromoRedemption(supabaseUrl, serviceRoleKey, nextMeta.promoCode, application.user_id);
    }
    return json(200, { ok: true, ...(result?.duplicate ? { duplicate: true } : {}), ...(result?.application_already_paid ? { needsReview: true } : {}) }, origin);
  } catch (error) {
    return json(error?.status === 409 ? 409 : 503, { message: error?.status === 409 ? "Payment amount or currency does not match this checkout." : "Kagie could not settle this PayFast payment. Please retry the notification." }, origin);
  }
};
