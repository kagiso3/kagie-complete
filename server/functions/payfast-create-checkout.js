const { reserveCheckout, completeCheckout } = require('./_payment-reservation');
const { priceCart, snapshot, orderSnapshot, safeReturnUrl } = require("./_payment-checkout");
const crypto = require("crypto");

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

function nowISO() {
  return new Date().toISOString();
}

function toAmount(value) {
  return Number(value || 0).toFixed(2);
}

function urlEncode(value) {
  return encodeURIComponent(String(value || "").trim()).replace(/[!'()*~]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, "+");
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

function normalizeCartItem(row) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
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
    row.payment_status !== STATUS.payment.VERIFIED &&
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

  await supabaseFetch(
    supabaseUrl,
    `/rest/v1/application_institutions?application_id=eq.${encodeFilter(applicationId)}`,
    {
      method: "DELETE",
      headers: adminHeaders(serviceRoleKey, { Prefer: "return=minimal" })
    }
  );

  const rows = buildInstitutionRows(applicationId, institutions);
  if (!rows.length) return;

  await supabaseFetch(supabaseUrl, "/rest/v1/application_institutions", {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify(rows)
  });
}

async function savePaymentRecord(supabaseUrl, serviceRoleKey, applicationId, paymentPayload) {
  return supabaseFetch(supabaseUrl, "/rest/v1/payments", {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify([
      {
        application_id: applicationId,
        ...paymentPayload
      }
    ])
  }).then((rows) => (Array.isArray(rows) ? rows[0]?.id || null : null));
}

function buildCheckoutUrls(body) {
  return {
    successUrl: trim(body?.successUrl),
    cancelUrl: trim(body?.cancelUrl),
    failureUrl: trim(body?.failureUrl)
  };
}

function splitName(fullName) {
  const value = trim(fullName);
  if (!value) return { firstName: "Kagie", lastName: "Student" };
  const parts = value.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Kagie",
    lastName: parts.slice(1).join(" ") || "Student"
  };
}

function buildItemName(cartItems) {
  const packageItem = cartItems.find((item) => item.type === "application_pack");
  if (packageItem) return trim(packageItem.packName || packageItem.name || "Kagie application package");
  const serviceItem = cartItems.find((item) => item.type === "service" || item.type === "service_request");
  if (serviceItem) return trim(serviceItem.serviceName || serviceItem.name || "Kagie services");
  return "Kagie checkout";
}

function buildItemDescription(cartItems) {
  const lines = [];
  const packageItem = cartItems.find((item) => item.type === "application_pack");
  if (packageItem) lines.push(trim(packageItem.packName || packageItem.name || "Application package"));
  const services = cartItems
    .filter((item) => item.type === "service" || item.type === "service_request")
    .map((item) => trim(item.serviceName || item.name))
    .filter(Boolean);
  if (services.length) lines.push(`Services: ${services.slice(0, 3).join(", ")}`);
  return trim(lines.join(" | ")).slice(0, 255) || "Kagie application support";
}

function buildPayFastFields(baseFields, passphrase) {
  const filtered = Object.entries(baseFields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .reduce((acc, [key, value]) => {
      acc[key] = String(value).trim();
      return acc;
    }, {});

  const signatureString = Object.entries(filtered)
    .map(([key, value]) => `${key}=${urlEncode(value)}`)
    .join("&");

  const finalString = passphrase
    ? `${signatureString}&passphrase=${urlEncode(passphrase)}`
    : signatureString;

  return {
    ...filtered,
    signature: crypto.createHash("md5").update(finalString).digest("hex")
  };
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
  const merchantId = trim(process.env.PAYFAST_MERCHANT_ID);
  const merchantKey = trim(process.env.PAYFAST_MERCHANT_KEY);
  const passphrase = trim(process.env.PAYFAST_PASSPHRASE);
  const processUrl = trim(process.env.PAYFAST_PROCESS_URL || "https://www.payfast.co.za/eng/process");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { message: "Supabase payment configuration is missing on the server." }, origin);
  }
  if (!merchantId || !merchantKey) {
    return json(500, { message: "PayFast merchant settings are missing on the server." }, origin);
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
  const reference = trim(body?.reference);
  const note = trim(body?.note);
  const urls = buildCheckoutUrls(body);

  if (!payerName || !phone || !reference) {
    return validationError("Payer name, phone, and payment reference are required.", origin);
  }
  if (!urls.successUrl || !urls.cancelUrl || !urls.failureUrl) {
    return validationError("Success, cancel, and failure URLs are required.", origin);
  }
  if (![urls.successUrl, urls.cancelUrl, urls.failureUrl].every(url => safeReturnUrl(url, origin, { publicOnly: true }))) {
    return validationError("PayFast needs a live public Kagie URL. Please deploy Kagie before using PayFast.", origin);
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
    if (!profile || profile.role !== "user") {
      return json(403, { message: "Only student accounts can start a PayFast checkout." }, origin);
    }
    require('./_admin-auth').assertActiveActor(actor, profile);

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
    const amount = pricing.amount;
    if (amount < 5) {
      return validationError("PayFast needs a minimum Kagie payment amount of R5.00.", origin);
    }

    const packageItem = cartItems.find((item) => item.type === "application_pack") || null;
    const application = await getOrCreateDraftApplication(supabaseUrl, serviceRoleKey, actorId, packageItem);
    if (!application?.id) {
      return json(500, { message: "Kagie could not prepare your application draft for payment." }, origin);
    }

    if (application.payment_status === STATUS.payment.VERIFIED) {
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
      applicationId: application.id, userId: actorId, provider: 'payfast', items: cartItems, cartId: cart.id,
      payerName, phone, reference, amount, urls
    });
    if (reservation.response) return json(200, { data: reservation.response }, origin);
    const checkoutAttemptId = reservation.payment_id;
    const baseNoteState = parsePaymentNoteState(application.payment_note || "");
    const paymentMeta = {
      ...baseNoteState,
      customerNote: note,
      ...snapshot(cartItems, cart.id),
      gatewayProvider: "payfast",
      gatewayCheckoutId: checkoutAttemptId,
      gatewayStatus: "creating",
      promoCode: trim(promoItem?.promoCode),
      promoTitle: trim(promoItem?.promoTitle || promoItem?.title || promoItem?.name),
      offerNote: trim(promoItem?.offerNote),
      discountAmount: Math.abs(Number(promoItem?.price || 0))
    };

    const preparedRows = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}&payment_status=not.in.(Verified,Refunded)`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }),
        body: JSON.stringify({
          package_id: packageId,
          payer_name: payerName,
          payer_phone: phone,
          payment_reference: reference,
          payment_method: "PayFast Checkout",
          payment_note: serializePaymentNoteState(paymentMeta),
          payment_amount: amount,
          payment_status: STATUS.payment.PENDING
        })
      }
    );
    if (!Array.isArray(preparedRows) || preparedRows.length !== 1) {
      return validationError("This application payment changed. Refresh before paying again.", origin, 409);
    }

    await saveApplicationInstitutions(supabaseUrl, serviceRoleKey, application.id, institutions);

    const paymentPayload = {
      checkout_snapshot: orderSnapshot(cartItems, cart.id),
      id: checkoutAttemptId,
      user_id: actorId,
      provider: "payfast",
      gateway_checkout_id: checkoutAttemptId,
      gateway_status: "created",
      currency: "ZAR",
      payer_name: payerName,
      phone,
      reference,
      method: "PayFast Checkout",
      note: serializePaymentNoteState(paymentMeta),
      amount,
      status: STATUS.payment.PENDING
    };

    // The durable reservation already owns the payment record.


    const baseUrl = new URL(urls.successUrl).origin;
    const notifyUrl = `${baseUrl.replace(/\/$/, "")}/v1/payments/payfast/itn`;
    const { firstName, lastName } = splitName(payerName || profile.full_name || "Kagie Student");
    const fields = buildPayFastFields({
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      notify_url: notifyUrl,
      name_first: firstName,
      name_last: lastName,
      email_address: trim(profile.email || actor?.email || ""),
      cell_number: phone,
      m_payment_id: checkoutAttemptId,
      amount: toAmount(amount),
      item_name: buildItemName(cartItems),
      item_description: buildItemDescription(cartItems),
      custom_str1: actorId,
      custom_str2: reference,
      custom_str3: trim(promoItem?.promoCode),
      custom_str4: trim(packageItem?.packName || packageItem?.name),
      custom_str5: "Kagie checkout"
    }, passphrase);

    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}&payment_status=not.in.(Verified,Refunded)`,
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

    const completed = await completeCheckout(supabaseUrl, serviceRoleKey, reservation.payment_id, checkoutAttemptId, paymentPayload.note, {
        applicationId: application.id,
        processUrl,
        fields
    });
    return json(200, { data: completed }, origin);
  } catch (error) {
    const statusCode = typeof error?.status === "number" ? error.status : 500;
    return json(statusCode, { message: statusCode < 500 ? error?.message || "Kagie could not start PayFast checkout." : "Kagie could not prepare this payment. Please try again or contact support." }, origin);
  }
};
