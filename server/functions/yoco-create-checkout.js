const { config: yocoConfig, hostedUrl, diagnostic } = require('./_yoco');
const { reserveCheckout, completeCheckout } = require('./_payment-reservation');
const { assertActiveActor } = require('./_admin-auth');
const { priceCart, snapshot, orderSnapshot, safeReturnUrl, cartItemHash } = require("./_payment-checkout");
const PAYMENT_NOTE_PREFIX = "__KAGIE_PAYMENT_META__";

const STATUS = {
  application: {
    DRAFT: "Draft",
    PACKAGE_SELECTED: "Package Selected",
    AWAITING_PAYMENT: "Awaiting Payment",
    PENDING_DETAILS: "Pending Details",
    INCOMPLETE: "Incomplete",
    DOCUMENTS_MISSING: "Documents Missing",
    MISSING_DOCUMENTS: "Missing Documents",
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}

function validationError(message, origin, statusCode = 400) {
  return json(statusCode, { message }, origin);
}

function getBearerToken(headers) {
  const value = headers.authorization || headers.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

function trim(value) {
  return String(value || "").trim();
}


function normalizeRole(value) {
  const role = trim(value).toLowerCase();
  if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(role)) return "master_admin";
  if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff", "support-staff", "support staff"].includes(role)) return "assistant_admin";
  if (["user", "learner", "student", "authenticated"].includes(role)) return "user";
  return role || "user";
}

function normalizeApplicationTypeKey(value) {
  const type = trim(value).toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!type) return "";
  if (["late", "late_application", "late_applications"].includes(type)) return "late";
  if (["bridging", "bridge", "bridging_programme", "bridging_programmes"].includes(type)) return "bridging";
  if (["postgraduate", "post_graduate", "post_graduate_application", "post_graduate_applications", "post_grad", "postgrad"].includes(type)) return "postgraduate";
  if (["undergraduate", "undergrad", "under_graduate", "undergraduate_application", "undergraduate_applications", "under_graduate_application", "under_graduate_applications"].includes(type)) return "undergraduate";
  if (type.includes("transfer")) return "transfer";
  return type;
}

function remoteApplicationTypeKey(value) {
  const type = normalizeApplicationTypeKey(value);
  if (type === "postgraduate") return "POST_GRADUATE";
  if (type === "bridging") return "BRIDGING";
  if (type === "transfer") return "TRANSFER";
  if (type === "late") return "LATE";
  return "UNDERGRADUATE";
}

function cartPackageApplicationType(packageItem) {
  return normalizeApplicationTypeKey(
    packageItem?.applicationType ||
    packageItem?.application_type ||
    packageItem?.forms?.applicationType?.type ||
    packageItem?.formValues?.applicationType?.type ||
    packageItem?.package?.applicationType ||
    packageItem?.selectedPackage?.applicationType ||
    packageItem?.typeKey ||
    ""
  );
}

function checkoutStartStatus(currentStatus) {
  const status = trim(currentStatus);
  const keepStatuses = new Set([
    STATUS.application.PROCESSING,
    "Submitted",
    "Under Review",
    "Documents Required",
    "Awaiting Institution Fee",
    "Submitted to Institution",
    "Ready to Apply",
    "Applied",
    "Pending Feedback",
    "Accepted",
    "Rejected",
    "Cancelled"
  ]);
  return keepStatuses.has(status) ? "" : STATUS.application.AWAITING_PAYMENT;
}

function nowISO() {
  return new Date().toISOString();
}

function toAmountCents(value) {
  return Math.round(Number(value || 0) * 100);
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

function normalizeCartItem(row) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    sourceHash: cartItemHash(row),
    id: trim(row?.id || metadata.id),
    refId: trim(row?.ref_id || metadata.refId || metadata.remoteId),
    type: trim(row?.item_type || metadata.type || "custom"),
    name: trim(row?.name || metadata.name || metadata.packName || metadata.serviceName || metadata.institutionName || "Cart item"),
    price: Number(row?.price ?? metadata.price ?? metadata.packPrice ?? metadata.servicePrice ?? 0),
    quantity: Number(row?.quantity ?? metadata.quantity ?? 1),
    createdAt: row?.created_at || metadata.createdAt || nowISO()
  };
}

function getPromoCartItem(items) {
  return (Array.isArray(items) ? items : []).find((item) =>
    Boolean(item?.isPromoDiscount || trim(item?.promoCode))
  ) || null;
}

function buildInstitutionRows(applicationId, institutions) {
  return (Array.isArray(institutions) ? institutions : []).map((item) => ({
    application_id: applicationId,
    province: trim(item?.province),
    institution_type: trim(item?.institutionType),
    institution_name: trim(item?.institutionName || item?.name),
    application_fee: Number(item?.applicationFee ?? 0),
    application_fee_label: trim(item?.applicationFeeLabel),
    application_fee_note: trim(item?.applicationFeeNote),
    faculty: trim(item?.faculty),
    choice_1: trim(item?.choice1),
    choice_2: trim(item?.choice2),
    choice_3: trim(item?.choice3)
  }));
}

function normalizeInstitutionNameKey(value) {
  return trim(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isInstitutionClosed(row) {
  const manualStatus = trim(row?.manual_status || row?.application_status).toLowerCase();
  const closingDate = trim(row?.closing_date);
  if (row?.is_active === false || row?.is_visible === false) return true;
  if (manualStatus === "closed") return true;
  if (closingDate && /^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
    const today = new Date().toISOString().slice(0, 10);
    if (closingDate < today) return true;
  }
  return false;
}

async function assertInstitutionsOpen(supabaseUrl, serviceRoleKey, institutions) {
  const requested = (Array.isArray(institutions) ? institutions : [])
    .map((item) => ({
      name: trim(item?.institutionName || item?.name),
      year: trim(item?.year)
    }))
    .filter((item) => item.name);
  if (!requested.length) return;

  const rows = await supabaseFetch(supabaseUrl,
    "/rest/v1/institutions?select=*&limit=1000",
    { method: "GET", headers: adminHeaders(serviceRoleKey) });

  const catalog = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = `${normalizeInstitutionNameKey(row?.name)}|${trim(row?.year)}`;
    const fallbackKey = `${normalizeInstitutionNameKey(row?.name)}|`;
    catalog.set(key, row);
    if (!catalog.has(fallbackKey)) catalog.set(fallbackKey, row);
  });

  const closed = requested.find((item) => {
    const match = catalog.get(`${normalizeInstitutionNameKey(item.name)}|${item.year}`) || catalog.get(`${normalizeInstitutionNameKey(item.name)}|`);
    return !match || isInstitutionClosed(match);
  });
  if (closed) {
    const error = new Error("This institution is unavailable or applications are currently closed.");
    error.status = 409;
    throw error;
  }
}

async function getOrCreateCart(supabaseUrl, serviceRoleKey, userId) {
  const existing = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/carts?user_id=eq.${encodeFilter(userId)}&select=*&limit=1`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );

  if (Array.isArray(existing) && existing[0]) return existing[0];

  return supabaseFetch(supabaseUrl, "/rest/v1/carts", {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify([{ user_id: userId }])
  }).then((rows) => (Array.isArray(rows) ? rows[0] || null : null));
}

const APPLICATION_SELECT = "id,user_id,status,payment_status,payer_name,payer_phone,payment_reference,payment_method,payment_note,payment_amount,submitted_at,package_id,application_type";

async function getApplicationByIdForUser(supabaseUrl, serviceRoleKey, applicationId, userId) {
  const appId = trim(applicationId);
  if (!appId) return null;

  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/applications?id=eq.${encodeFilter(appId)}&user_id=eq.${encodeFilter(userId)}&select=${APPLICATION_SELECT}&limit=1`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getOrCreateDraftApplication(supabaseUrl, serviceRoleKey, userId, packageItem = null) {
  const requestedApplicationId = trim(
    packageItem?.applicationId ||
    packageItem?.appId ||
    packageItem?.draftId ||
    packageItem?.application?.id
  );
  const requestedApplicationType = cartPackageApplicationType(packageItem);

  const requestedApplication = await getApplicationByIdForUser(
    supabaseUrl,
    serviceRoleKey,
    requestedApplicationId,
    userId
  );
  if (requestedApplication) return requestedApplication;
  if (requestedApplicationId) {
    const error = new Error("This application is unavailable for your account.");
    error.status = 403;
    throw error;
  }

  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/applications?user_id=eq.${encodeFilter(userId)}&select=${APPLICATION_SELECT}&order=updated_at.desc&limit=20`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );

  const reusableStatuses = new Set([
    STATUS.application.DRAFT,
    STATUS.application.PACKAGE_SELECTED,
    STATUS.application.AWAITING_PAYMENT,
    STATUS.application.PENDING_DETAILS,
    STATUS.application.INCOMPLETE,
    STATUS.application.MISSING_DOCUMENTS,
    STATUS.application.DOCUMENTS_MISSING
  ]);
  const draft = (Array.isArray(rows) ? rows : []).find((row) =>
    reusableStatuses.has(row.status) &&
    !["Verified", "Paid", "Refunded"].includes(row.payment_status) &&
    (!requestedApplicationType || normalizeApplicationTypeKey(row.application_type) === requestedApplicationType)
  );
  if (draft) return draft;

  const createPayload = { user_id: userId };
  if (requestedApplicationType) {
    createPayload.application_type = remoteApplicationTypeKey(requestedApplicationType);
  }

  return supabaseFetch(supabaseUrl, "/rest/v1/applications", {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify([createPayload])
  }).then((createdRows) => (Array.isArray(createdRows) ? createdRows[0] || null : null));
}

async function findApplicationPackId(supabaseUrl, serviceRoleKey, packItem) {
  const directId = trim(packItem?.remoteId || packItem?.refId);
  if (directId) return directId;

  const code = trim(packItem?.code || packItem?.id).toLowerCase();
  const name = trim(packItem?.packName || packItem?.name).toLowerCase();
  if (!code && !name) return null;

  const rows = await supabaseFetch(
    supabaseUrl,
    "/rest/v1/application_packs?select=id,code,name&limit=50",
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );

  const match = (Array.isArray(rows) ? rows : []).find((row) => {
    const rowCode = trim(row?.code).toLowerCase();
    const rowName = trim(row?.name).toLowerCase();
    return (code && rowCode === code) || (name && rowName === name);
  });
  return match?.id || null;
}

async function saveApplicationInstitutions(supabaseUrl, serviceRoleKey, applicationId, institutions) {
  await assertInstitutionsOpen(supabaseUrl, serviceRoleKey, institutions);
  await supabaseFetch(supabaseUrl, '/rest/v1/rpc/replace_checkout_institutions', {
    method:'POST',headers:adminHeaders(serviceRoleKey,{'Content-Type':'application/json'}),
    body:JSON.stringify({p_application_id:applicationId,p_rows:buildInstitutionRows(applicationId,institutions)})
  });
}

function buildCheckoutUrls(body) {
  return {
    successUrl: trim(body?.successUrl),
    cancelUrl: trim(body?.cancelUrl),
    failureUrl: trim(body?.failureUrl)
  };
}

function isAllowedReturnUrl(url, origin) {
  try {
    return safeReturnUrl(url, origin, {publicOnly:(process.env.YOCO_MODE || process.env.YOCO_ENV)==="live"});
  } catch (_error) {
    return false;
  }
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let gateway;
  try { gateway = yocoConfig(); } catch (error) { diagnostic("configuration", error); return json(503, {message:error.message}, origin); }
  const yocoSecretKey = gateway.key;
  const yocoMode = gateway.mode;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: "Supabase payment configuration is missing on the server." }, origin);
  }
  if (!yocoSecretKey) {
    return json(500, { message: "Yoco secret key is missing on the server." }, origin);
  }

  const accessToken = getBearerToken(event.headers || {});
  if (!accessToken) {
    return json(401, { message: "Missing Supabase access token." }, origin);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_error) {
    return validationError("Request body must be valid JSON.", origin);
  }

  const payerName = trim(body?.payerName);
  const phone = trim(body?.phone);
  let reference = trim(body?.reference);
  const note = trim(body?.note);
  const urls = buildCheckoutUrls(body);

  if (payerName.length>160 || phone.length>30 || reference.length>100 || note.length>2000) return validationError("Payment details are too long. Shorten the reference or note.",origin);
  if (!payerName || !phone || !reference) {
    return validationError("Payer name, phone, and payment reference are required.", origin);
  }
  if (!urls.successUrl || !urls.cancelUrl || !urls.failureUrl) {
    return validationError("Success, cancel, and failure URLs are required.", origin);
  }
  if (!isAllowedReturnUrl(urls.successUrl, origin) || !isAllowedReturnUrl(urls.cancelUrl, origin) || !isAllowedReturnUrl(urls.failureUrl, origin)) {
    return validationError("Yoco return URLs must point back to this Kagie site.", origin);
  }

  try {
    const actor = await supabaseFetch(supabaseUrl, "/auth/v1/user", {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    const actorId = trim(actor?.id);
    if (!actorId) {
      return json(401, { message: "Could not verify the Kagie session." }, origin);
    }

    const profiles = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/profiles?id=eq.${encodeFilter(actorId)}&select=*&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    const profile = Array.isArray(profiles) ? profiles[0] || null : null;
    const actorRole = normalizeRole(
      actor?.app_metadata?.role ||
      actor?.role
    );
    if (!profile || actorRole !== "user") {
      return json(403, { message: "Only student accounts can start a Yoco checkout." }, origin);
    }
    assertActiveActor(actor, profile);

    const cart = await getOrCreateCart(supabaseUrl, serviceRoleKey, actorId);
    const cartItemsRaw = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/cart_items?cart_id=eq.${encodeFilter(cart.id)}&select=*&order=created_at.asc`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    const normalizedItems = (Array.isArray(cartItemsRaw) ? cartItemsRaw : []).map(normalizeCartItem);
    const pricing = await priceCart(normalizedItems, { userId: actorId, read: path => supabaseFetch(supabaseUrl, path, { method: "GET", headers: adminHeaders(serviceRoleKey) }) });
    const cartItems = pricing.items;
    if (!cartItems.length) {
      return validationError("Your cart is empty. Add a package or service before paying.", origin);
    }

    const promoItem = getPromoCartItem(cartItems);
    const subtotal = cartItems
      .filter((item) => Number(item.price || 0) > 0)
      .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const discountTotal = Math.abs(Number(promoItem?.price || 0));
    const amount = pricing.amount;
    const amountCents = toAmountCents(amount);
    const subtotalAmountCents = toAmountCents(subtotal);
    const totalDiscountCents = toAmountCents(discountTotal);
    if (amountCents < 200) {
      return validationError("Yoco requires a minimum payment of R2.00.", origin);
    }

    const packageItem = cartItems.find((item) => item.type === "application_pack") || null;
    const application = await getOrCreateDraftApplication(supabaseUrl, serviceRoleKey, actorId, packageItem);
    if (!application?.id) {
      return json(500, { message: "Kagie could not prepare your application draft for payment." }, origin);
    }

    if (["Verified", "Paid", "Refunded"].includes(application.payment_status)) {
      return validationError("This application is already paid. Start a new application before paying again.", origin, 409);
    }

    const institutionItems = cartItems.filter((item) => item.type === "institution");
    const institutions = Array.isArray(packageItem?.institutions) && packageItem.institutions.length
      ? packageItem.institutions
      : institutionItems.map((item) => ({
          institutionName: trim(item?.institutionName || item?.name),
          province: trim(item?.province),
          institutionType: trim(item?.institutionType),
          faculty: trim(item?.faculty),
          choice1: trim(item?.choice1),
          choice2: trim(item?.choice2),
          choice3: trim(item?.choice3),
          applicationFee: Number(item?.applicationFee || 0),
          applicationFeeLabel: trim(item?.applicationFeeLabel),
          applicationFeeNote: trim(item?.applicationFeeNote)
        }));

    await assertInstitutionsOpen(supabaseUrl, serviceRoleKey, institutions);
    const packageId = packageItem ? await findApplicationPackId(supabaseUrl, serviceRoleKey, packageItem) : null;

    const reservation = await reserveCheckout(supabaseUrl, serviceRoleKey, {
      applicationId: application.id, userId: actorId, provider: 'yoco', items: cartItems, cartId: cart.id,
      payerName, phone, reference, amount, urls, mode: yocoMode
    });
    if (reservation.response) return json(200, { data: reservation.response }, origin);
    if (!/^KAG-YOCO-[A-F0-9]{32}$/.test(reservation.reference || '')) throw Object.assign(new Error('Payment reference migration is required.'), { status: 503 });
    reference = reservation.reference;
    for (const name of ["successUrl", "cancelUrl", "failureUrl"]) { const u = new URL(urls[name]); u.searchParams.set("attempt", reservation.payment_id); urls[name] = u.href; }
    const baseNoteState = parsePaymentNoteState(application.payment_note || "");
    const paymentMeta = {
      ...baseNoteState,
      customerNote: note,
      ...snapshot(cartItems, cart.id),
      gatewayProvider: "yoco",
      gatewayStatus: "creating",
      promoCode: trim(promoItem?.promoCode),
      promoTitle: trim(promoItem?.promoTitle || promoItem?.title || promoItem?.name),
      offerNote: trim(promoItem?.offerNote),
      discountAmount: Math.abs(Number(promoItem?.price || 0))
    };

    if (packageItem) {
    const applicationType = cartPackageApplicationType(packageItem);
    const applicationPatch = {
      package_id: packageId,
      payer_name: payerName,
      payer_phone: phone,
      payment_reference: reference,
      payment_method: "Yoco Checkout",
      payment_note: serializePaymentNoteState(paymentMeta),
      payment_amount: amount,
      payment_status: STATUS.payment.PENDING
    };
    if (applicationType) applicationPatch.application_type = remoteApplicationTypeKey(applicationType);
    const nextCheckoutStatus = checkoutStartStatus(application.status);
    if (nextCheckoutStatus) applicationPatch.status = nextCheckoutStatus;

    const preparedRows = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}&payment_status=not.in.(Verified,Paid,Refunded)`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }),
        body: JSON.stringify(applicationPatch)
      }
    );
    if (!Array.isArray(preparedRows) || preparedRows.length !== 1) {
      return validationError("This application payment changed. Refresh before paying again.", origin, 409);
    }

    await saveApplicationInstitutions(supabaseUrl, serviceRoleKey, application.id, institutions);

    }

    const checkoutPayload = {
      amount: amountCents,
      currency: "ZAR",
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      failureUrl: urls.failureUrl,
      subtotalAmount: subtotalAmountCents || undefined,
      totalDiscount: totalDiscountCents || undefined,
      clientReferenceId: application.id,
      externalId: reservation.payment_id,
      metadata: {
        kagieApplicationId: application.id,
        kagieAttemptId: reservation.payment_id,
        kagieUserId: actorId,
        kagieReference: reference,
        kagiePromoCode: trim(promoItem?.promoCode),
        kagieMode: yocoMode || undefined
      }
    };

    const yocoResponse = await fetch(gateway.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${yocoSecretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `kagie-${reservation.payment_id}`
      },
      body: JSON.stringify(checkoutPayload),
      signal: AbortSignal.timeout(15000)
    });

    const yocoBody = await readResponse(yocoResponse);
    if (!yocoResponse.ok) {
      throw Object.assign(new Error('Yoco could not create checkout. Your payment reference is preserved; retry the same order or contact support.'), { status: 503, diagnosticCode: [401,403].includes(yocoResponse.status) ? 'YOCO_CREDENTIALS' : yocoResponse.status===405 ? 'YOCO_ENDPOINT' : 'YOCO_REQUEST', providerStatus:yocoResponse.status });
    }

    const checkoutId = trim(yocoBody?.id);
    const gatewayStatus = trim(yocoBody?.status || "created");
    const paymentId = trim(yocoBody?.paymentId);
    const redirectUrl = trim(yocoBody?.redirectUrl);

    if (!checkoutId || !hostedUrl(redirectUrl) || (yocoBody.processingMode && yocoBody.processingMode !== yocoMode) || (yocoBody.amount !== undefined && yocoBody.amount !== amountCents) || (yocoBody.currency !== undefined && yocoBody.currency !== "ZAR")) {
      throw new Error("Yoco checkout did not return a redirect URL.");
    }

    const finalPaymentMeta = {
      ...paymentMeta,
      gatewayCheckoutId: checkoutId,
      gatewayPaymentId: paymentId,
      gatewayStatus
    };
    const paymentPayload = {
      checkout_snapshot: orderSnapshot(cartItems, cart.id),
      user_id: actorId,
      payer_name: payerName,
      phone,
      reference,
      method: "Yoco Checkout",
      note: serializePaymentNoteState(finalPaymentMeta),
      amount,
      status: STATUS.payment.PENDING,
      provider: "yoco",
      gateway_checkout_id: checkoutId,
      gateway_payment_id: paymentId || null,
      gateway_status: gatewayStatus,
      currency: "ZAR",
      failure_reason: "",
      paid_at: null
    };

    // The durable reservation already owns the payment record.

    if (packageItem) {
    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}&payment_status=not.in.(Verified,Paid,Refunded)`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({
          payment_note: paymentPayload.note
        })
      }
    );

    }

    const completed = await completeCheckout(supabaseUrl, serviceRoleKey, reservation.payment_id, checkoutId, paymentPayload.note, {
        applicationId: application.id,
        paymentId: reservation.payment_id,
        reference,
        checkoutId,
        redirectUrl,
        status: gatewayStatus
    });
    return json(200, { data: completed }, origin);
  } catch (error) {
    diagnostic("checkout", error, { ...(error.providerStatus ? { providerStatus:error.providerStatus } : {}) });
    const statusCode = typeof error?.status === "number" ? error.status : 503;
    return json(statusCode, { message: statusCode < 500 ? error?.message || "Kagie could not start Yoco checkout." : "Kagie could not prepare this payment. Please try again or contact support." }, origin);
  }
};
