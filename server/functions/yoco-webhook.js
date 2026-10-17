const { diagnostic, bodyHash } = require('./_yoco');
const { assertPaymentAmount, clearPaidCart } = require("./_payment-settlement");
const crypto = require("crypto");

const PAYMENT_NOTE_PREFIX = "__KAGIE_PAYMENT_META__";
const WEBHOOK_THRESHOLD_SECONDS = 180;


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
  const response = await fetch(`${supabaseUrl}${path}`, {signal:AbortSignal.timeout(10000),...options});
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

function getHeader(headers, key) {
  const match = Object.keys(headers || {}).find(name => name.toLowerCase() === key.toLowerCase());
  return match ? headers[match] : "";
}

function readRawBody(event) {
  if (!event.body) return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : String(event.body);
}

function parseWebhookSignatures(signatureHeader) {
  return String(signatureHeader || '').split(/\s+/).filter(part=>/^v1,[A-Za-z0-9+/]+={0,2}$/.test(part)).map(part=>part.slice(3));
}

function verifyYocoWebhook(headers, rawBody, secret) {
  const webhookId = trim(getHeader(headers, "webhook-id"));
  const webhookTimestamp = trim(getHeader(headers, "webhook-timestamp"));
  const webhookSignatures = parseWebhookSignatures(getHeader(headers, "webhook-signature"));

  if (!webhookId || !webhookTimestamp || !webhookSignatures.length) {
    return { ok: false, message: "Missing Yoco webhook verification headers." };
  }

  const timestampNumber = Number(webhookTimestamp);
  if (!/^\d{10}$/.test(webhookTimestamp) || !Number.isSafeInteger(timestampNumber)) {
    return { ok: false, message: "Invalid Yoco webhook timestamp." };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber);
  if (ageSeconds > WEBHOOK_THRESHOLD_SECONDS) {
    return { ok: false, message: "Yoco webhook timestamp is too old." };
  }

  const encodedSecret = String(secret || "").split("_").slice(1).join("_");
  const secretBytes = Buffer.from(encodedSecret, "base64");
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(String(secret)) || secretBytes.length < 16 || secretBytes.toString("base64").replace(/=+$/, "") !== encodedSecret.replace(/=+$/, "")) {
    return { ok: false, message: "Yoco webhook secret is not configured correctly." };
  }
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature);
  const matched = webhookSignatures.some((signature) => {
    const actualBuffer = Buffer.from(signature);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  });
  if (!matched) {
    return { ok: false, message: "Invalid Yoco webhook signature." };
  }

  return { ok: true };
}

function extractCheckoutId(body, payload) {
  return trim(
    payload?.metadata?.checkoutId ||
    payload?.metadata?.checkout_id ||
    payload?.metadata?.kagieCheckoutId ||
    payload?.checkoutId ||
    payload?.checkout_id ||
    body?.metadata?.checkoutId ||
    body?.checkoutId
  );
}

function extractPaymentId(payload) {
  return trim(payload?.id || payload?.paymentId || payload?.payment_id);
}

function extractFailureReason(payload) {
  return trim(payload?.failureReason || payload?.failure_reason || payload?.errorMessage || payload?.message);
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


async function findPaymentByCheckoutId(supabaseUrl, serviceRoleKey, checkoutId) {
  const rows = await supabaseFetch(supabaseUrl, "/rest/v1/payments?gateway_checkout_id=eq." + encodeFilter(checkoutId) + "&select=*&limit=1", { method: "GET", headers: adminHeaders(serviceRoleKey) });
  return Array.isArray(rows) ? rows[0] || null : null;
}


exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "*";
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true }, origin);
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed." }, origin);
  const supabaseUrl = trim(process.env.SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const webhookSecret = trim(process.env.YOCO_WEBHOOK_SECRET);
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) return json(500, { message: "Yoco webhook configuration is missing on the server." }, origin);
  const rawBody = readRawBody(event);
  const verification = verifyYocoWebhook(event.headers || {}, rawBody, webhookSecret);
  if (!verification.ok) return json(403, { message: verification.message }, origin);
  let body;
  try { body = JSON.parse(rawBody || "{}"); } catch { return json(400, { message: "Yoco webhook body must be valid JSON." }, origin); }
  const eventType = trim(body?.type);
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  if (["refund.succeeded", "refund.failed"].includes(eventType)) {
    const expectedMode=trim(process.env.YOCO_MODE || process.env.YOCO_ENV);
    if (payload.currency !== 'ZAR' || !Number.isSafeInteger(payload.amount) || payload.amount<=0 ||
        !trim(body.id) || !trim(payload.id) || !extractCheckoutId(body,payload) ||
        payload.status !== (eventType==='refund.succeeded'?'succeeded':'failed') ||
        (!['test','live'].includes(expectedMode) || payload.mode!==expectedMode)) return json(409,{message:'Refund notification does not match the configured gateway.'},origin);
    try {
      await supabaseFetch(supabaseUrl,'/rest/v1/rpc/process_yoco_refund_event',{
        method:'POST',headers:adminHeaders(serviceRoleKey,{'Content-Type':'application/json'}),
        body:JSON.stringify({p_checkout_id:extractCheckoutId(body,payload),p_event_id:body.id,p_event_type:eventType,p_mode:payload.mode,
          p_delivery_id:trim(getHeader(event.headers,'webhook-id')),p_payload_hash:bodyHash(rawBody),
          p_details:{amount:payload.amount,currency:payload.currency,refundId:payload.id,refundableAmount:payload.refundableAmount??null}})
      });
      return json(200,{ok:true,needsReview:true},origin);
    } catch { return json(503,{message:'Refund reconciliation is not ready. Please retry this notification.'},origin); }
  }
  if (!["payment.succeeded", "payment.failed"].includes(eventType)) return json(200, { ok: true, ignored: true }, origin);
  const checkoutId = extractCheckoutId(body, payload);
  const paymentId = extractPaymentId(payload);
  const gatewayStatus = trim(payload.status);
  const isSuccessful = eventType === "payment.succeeded";
  const eventId = trim(body?.id);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(eventId) || !/^[A-Za-z0-9_-]{1,200}$/.test(checkoutId) || !/^[A-Za-z0-9_-]{1,200}$/.test(paymentId) || gatewayStatus !== (isSuccessful ? "succeeded" : "failed")) return json(400, { message: "Yoco payment notification is incomplete." }, origin);
  try {
    const paymentRow = await findPaymentByCheckoutId(supabaseUrl, serviceRoleKey, checkoutId);
    // A callback can arrive before checkout creation has finished saving its row.
    // Ask Yoco to retry rather than permanently acknowledging a missing payment.
    if (!paymentRow) return json(503, { message: "Payment checkout is not ready. Please retry this notification." }, origin);
    const meta = parsePaymentNoteState(paymentRow.note);
    if (trim(paymentRow.provider || meta.gatewayProvider) !== "yoco" || trim(paymentRow.method) !== "Yoco Checkout" || trim(paymentRow.gateway_checkout_id || meta.gatewayCheckoutId) !== checkoutId) return json(409, { message: "Yoco payment does not match this checkout." }, origin);
    if (!Number.isSafeInteger(payload.amount)) return json(409, {message:"Yoco amount must be integer cents."}, origin);
    assertPaymentAmount(paymentRow, payload.amount, payload.currency, true);
    const expectedMode = trim(process.env.YOCO_MODE || process.env.YOCO_ENV);
    if (!["test", "live"].includes(expectedMode) || trim(payload.mode) !== expectedMode || paymentRow.gateway_mode !== expectedMode) return json(409, { message: "Yoco payment mode does not match this checkout." }, origin);
    if ((payload.metadata?.kagieAttemptId && payload.metadata.kagieAttemptId !== paymentRow.id) || (payload.metadata?.kagieApplicationId && payload.metadata.kagieApplicationId !== paymentRow.application_id) || (payload.metadata?.kagieUserId && payload.metadata.kagieUserId !== paymentRow.user_id)) return json(409, {message:'Yoco payment identity does not match this checkout.'}, origin);
    const appRows = await supabaseFetch(supabaseUrl, "/rest/v1/applications?id=eq." + encodeFilter(paymentRow.application_id) + "&select=id,user_id,status,payment_status,submitted_at,payment_note,assistant_id&limit=1", { method: "GET", headers: adminHeaders(serviceRoleKey) });
    const application = Array.isArray(appRows) ? appRows[0] : null;
    if (!application) return json(503, { message: "Payment application is not ready. Please retry this notification." }, origin);
    const nextMeta = { ...meta, gatewayProvider: "yoco", gatewayCheckoutId: checkoutId, gatewayPaymentId: paymentId, gatewayStatus, reviewedAt: nowISO(), verifiedAt: isSuccessful ? meta.verifiedAt || nowISO() : meta.verifiedAt };
    const result = await supabaseFetch(supabaseUrl, '/rest/v1/rpc/process_yoco_payment_event', {
      method:'POST', headers:adminHeaders(serviceRoleKey, {'Content-Type':'application/json'}),
      body:JSON.stringify({p_event_id:eventId,p_delivery_id:trim(getHeader(event.headers,'webhook-id')),p_payload_hash:bodyHash(rawBody),
        p_payment_id:paymentRow.id,p_checkout_id:checkoutId,p_gateway_payment_id:paymentId,p_gateway_status:gatewayStatus,
        p_success:isSuccessful,p_amount_cents:payload.amount,p_currency:payload.currency,p_mode:payload.mode,
        p_note:serializePaymentNoteState(nextMeta),p_failure_reason:isSuccessful?'':extractFailureReason(payload)||gatewayStatus})
    });
    if (!result || typeof result.applied !== 'boolean' || typeof result.duplicate !== 'boolean') throw new Error('Missing transactional event confirmation');
    if (isSuccessful && !result.application_already_paid) {
      await clearPaidCart({...nextMeta,purchasedProducts:paymentRow.checkout_snapshot?.products}, application.user_id,
        path => supabaseFetch(supabaseUrl, path, { method: "GET", headers: adminHeaders(serviceRoleKey) }),
        (path, method, value) => supabaseFetch(supabaseUrl, path, { method, headers: adminHeaders(serviceRoleKey, { "Content-Type": "application/json", Prefer: "return=minimal" }), ...(value ? { body: JSON.stringify(value) } : {}) }));
    }
    if (result?.applied && result.application_already_paid) {
      await bestEffortNotification(supabaseUrl, serviceRoleKey, application.user_id, "Payment received for review", "This application already has a verified payment. Kagie needs to review this additional payment. Your cart is still available.", "warning");
      await bestEffortStaffAlerts(supabaseUrl, serviceRoleKey, application, "Additional payment needs review", "An additional verified payment was received for an application that is already paid. Review the payment records and arrange reconciliation.", "warning");
    } else if (result?.applied) {
      await bestEffortNotification(supabaseUrl, serviceRoleKey, application.user_id, isSuccessful ? "Yoco payment verified" : "Yoco payment not completed", isSuccessful ? "Your Kagie payment has been verified. Complete any remaining application details from your Dashboard." : "Your Yoco payment did not complete. Your cart is still available so you can retry payment.", isSuccessful ? "success" : "warning");
      await bestEffortStaffAlerts(supabaseUrl, serviceRoleKey, application, isSuccessful ? "Learner payment verified" : "Learner payment did not complete", "A learner Yoco payment was updated. Open Kagie to review the application payment.", isSuccessful ? "success" : "warning");
    }
    return json(200, { ok: true, ...(result?.duplicate ? { duplicate: true } : {}), ...(result?.application_already_paid ? { needsReview: true } : {}) }, origin);
  } catch (error) {
    diagnostic("webhook", error, { eventId, checkoutId });
    return json(error?.status === 409 || ['22023','23505'].includes(error?.payload?.code) ? 409 : 503, { message: "Kagie could not settle this Yoco payment. Please retry the notification." }, origin);
  }
};
