const PAYMENT_NOTE_PREFIX = "__KAGIE_PAYMENT_META__";

const STATUS = {
  application: {
    DRAFT: "Draft",
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

function normalizeCartItem(row) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    id: trim(row?.id || metadata.id),
    refId: trim(row?.ref_id || metadata.refId || metadata.remoteId),
    type: trim(row?.item_type || metadata.type || "custom"),
    name: trim(row?.name || metadata.name || metadata.packName || metadata.serviceName || metadata.institutionName || "Cart item"),
    price: Number(row?.price ?? metadata.price ?? metadata.packPrice ?? metadata.servicePrice ?? 0),
    quantity: Number(row?.quantity || metadata.quantity || 1),
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

async function getOrCreateDraftApplication(supabaseUrl, serviceRoleKey, userId) {
  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/applications?user_id=eq.${encodeFilter(userId)}&select=id,user_id,status,payment_status,payer_name,payer_phone,payment_reference,payment_method,payment_note,payment_amount,submitted_at,package_id&order=updated_at.desc&limit=10`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );

  const draft = (Array.isArray(rows) ? rows : []).find((row) =>
    row.status === STATUS.application.DRAFT || row.status === STATUS.application.MISSING_DOCUMENTS
  );
  if (draft) return draft;

  return supabaseFetch(supabaseUrl, "/rest/v1/applications", {
    method: "POST",
    headers: adminHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    body: JSON.stringify([{ user_id: userId }])
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
  const existing = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/payments?application_id=eq.${encodeFilter(applicationId)}&select=*&order=created_at.desc&limit=1`,
    {
      method: "GET",
      headers: adminHeaders(serviceRoleKey)
    }
  );

  if (Array.isArray(existing) && existing[0]) {
    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/payments?id=eq.${encodeFilter(existing[0].id)}`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(paymentPayload)
      }
    );
    return existing[0].id;
  }

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

exports.handler = async (event) => {
  const origin = event.headers.origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed." }, origin);
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const yocoSecretKey = process.env.YOCO_SECRET_KEY || "";

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
  const reference = trim(body?.reference);
  const note = trim(body?.note);
  const urls = buildCheckoutUrls(body);

  if (!payerName || !phone || !reference) {
    return validationError("Payer name, phone, and payment reference are required.", origin);
  }
  if (!urls.successUrl || !urls.cancelUrl || !urls.failureUrl) {
    return validationError("Success, cancel, and failure URLs are required.", origin);
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
      `/rest/v1/profiles?id=eq.${encodeFilter(actorId)}&select=id,role,is_active,full_name,email,phone&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    const profile = Array.isArray(profiles) ? profiles[0] || null : null;
    const actorRole = normalizeRole(
      profile?.role ||
      actor?.app_metadata?.role ||
      actor?.user_metadata?.role ||
      actor?.role
    );
    if (!profile || actorRole !== "user") {
      return json(403, { message: "Only student accounts can start a Yoco checkout." }, origin);
    }
    if (profile.is_active === false) {
      return json(403, { message: "This Kagie account is currently inactive." }, origin);
    }

    const cart = await getOrCreateCart(supabaseUrl, serviceRoleKey, actorId);
    const cartItemsRaw = await supabaseFetch(
      supabaseUrl,
      `/rest/v1/cart_items?cart_id=eq.${encodeFilter(cart.id)}&select=*&order=created_at.asc`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );
    const cartItems = (Array.isArray(cartItemsRaw) ? cartItemsRaw : []).map(normalizeCartItem);
    if (!cartItems.length) {
      return validationError("Your cart is empty. Add a package or service before paying.", origin);
    }

    const promoItem = getPromoCartItem(cartItems);
    const subtotal = cartItems
      .filter((item) => Number(item.price || 0) > 0)
      .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const discountTotal = Math.abs(Number(promoItem?.price || 0));
    const amount = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const amountCents = toAmountCents(amount);
    const subtotalAmountCents = toAmountCents(subtotal);
    const totalDiscountCents = toAmountCents(discountTotal);
    if (amountCents < 200) {
      return validationError("Yoco requires a minimum payment of R2.00.", origin);
    }

    const application = await getOrCreateDraftApplication(supabaseUrl, serviceRoleKey, actorId);
    if (!application?.id) {
      return json(500, { message: "Kagie could not prepare your application draft for payment." }, origin);
    }

    const packageItem = cartItems.find((item) => item.type === "application_pack") || null;
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
          choice3: trim(item?.choice3)
        }));

    const packageId = packageItem ? await findApplicationPackId(supabaseUrl, serviceRoleKey, packageItem) : null;

    const baseNoteState = parsePaymentNoteState(application.payment_note || "");
    const paymentMeta = {
      ...baseNoteState,
      customerNote: note,
      gatewayProvider: "yoco",
      gatewayStatus: "creating",
      promoCode: trim(promoItem?.promoCode),
      promoTitle: trim(promoItem?.promoTitle || promoItem?.title || promoItem?.name),
      offerNote: trim(promoItem?.offerNote),
      discountAmount: Math.abs(Number(promoItem?.price || 0))
    };

    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}`,
      {
        method: "PATCH",
        headers: adminHeaders(serviceRoleKey, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({
          package_id: packageId,
          payer_name: payerName,
          payer_phone: phone,
          payment_reference: reference,
          payment_method: "Yoco Checkout",
          payment_note: serializePaymentNoteState(paymentMeta),
          payment_amount: amount,
          payment_status: STATUS.payment.PENDING
        })
      }
    );

    await saveApplicationInstitutions(supabaseUrl, serviceRoleKey, application.id, institutions);

    const checkoutPayload = {
      amount: amountCents,
      currency: "ZAR",
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      failureUrl: urls.failureUrl,
      subtotalAmount: subtotalAmountCents || undefined,
      totalDiscount: totalDiscountCents || undefined,
      clientReferenceId: application.id,
      externalId: application.id,
      metadata: {
        kagieApplicationId: application.id,
        kagieUserId: actorId,
        kagieReference: reference,
        kagiePromoCode: trim(promoItem?.promoCode)
      }
    };

    const yocoResponse = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${yocoSecretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `kagie-${application.id}-${reference}`.slice(0, 255)
      },
      body: JSON.stringify(checkoutPayload)
    });

    const yocoBody = await readResponse(yocoResponse);
    if (!yocoResponse.ok) {
      throw new Error(yocoBody?.message || yocoBody?.error || "Yoco checkout creation failed.");
    }

    const checkoutId = trim(yocoBody?.id);
    const gatewayStatus = trim(yocoBody?.status || "created");
    const paymentId = trim(yocoBody?.paymentId);
    const redirectUrl = trim(yocoBody?.redirectUrl);

    if (!checkoutId || !redirectUrl) {
      throw new Error("Yoco checkout did not return a redirect URL.");
    }

    const finalPaymentMeta = {
      ...paymentMeta,
      gatewayCheckoutId: checkoutId,
      gatewayPaymentId: paymentId,
      gatewayStatus
    };
    const paymentPayload = {
      payer_name: payerName,
      phone,
      reference,
      method: "Yoco Checkout",
      note: serializePaymentNoteState(finalPaymentMeta),
      amount,
      status: STATUS.payment.PENDING
    };

    await savePaymentRecord(supabaseUrl, serviceRoleKey, application.id, paymentPayload);
    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(application.id)}`,
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

    return json(200, {
      data: {
        applicationId: application.id,
        checkoutId,
        redirectUrl,
        status: gatewayStatus
      }
    }, origin);
  } catch (error) {
    const statusCode = typeof error?.status === "number" ? error.status : 500;
    return json(statusCode, { message: error?.message || "Kagie could not start Yoco checkout." }, origin);
  }
};
