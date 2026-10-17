(function () {
  window.KagieCheckoutPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const money = (v) => `R${Number(v || 0).toLocaleString("en-ZA")}`;
  const materialIcon = (name) => `<span class="material-symbols-rounded" aria-hidden="true">${esc(name)}</span>`;
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff", "support-staff", "support staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(value)) return "master_admin";
    return value || "user";
  };
  const redirectByRole = (user) => {
    const role = normalizeRole(user?.role);
    if (role === "assistant_admin") {
      window.location.href = "assistant/dashboard.html";
      return;
    }
    if (role === "master_admin") {
      window.location.href = "master-admin/dashboard.html";
      return;
    }
    window.location.href = "login.html";
  };

  const TRANSFER_METHOD = "Bank Transfer";
  const MAX_PROOF_BYTES = 8 * 1024 * 1024;
  const ACCEPTED_PROOF_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const ACCEPTED_PROOF_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

  const METHOD_GUIDES = {
    [TRANSFER_METHOD]: {
      title: "Bank transfer",
      lines: [
        "Transfer the exact Kagie total shown on this checkout.",
        "Use the Kagie payment reference so staff can match your transfer quickly.",
        "Attach proof here or upload it from Upload Documents after confirming."
      ]
    }
  };

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  }

  function buildSuggestedReference(user, application, settings, orderSeed) {
    const prefix = firstNonEmpty(settings?.payments?.referencePrefix, settings?.appName, "KAG")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6) || "KAG";
    const seed = firstNonEmpty(
      application?.id,
      orderSeed,
      user?.supabaseUserId,
      user?.id,
      `${Date.now()}`
    ).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const tail = seed.slice(-6) || "000001";
    return `${prefix}-${tail}`;
  }

  function getMerchantDetails(settings) {
    return {
      merchantName: firstNonEmpty(settings?.payments?.merchantName, settings?.appName, "Kagie"),
      bankName: firstNonEmpty(settings?.payments?.bankName),
      accountNumber: firstNonEmpty(settings?.payments?.accountNumber),
      accountType: firstNonEmpty(settings?.payments?.accountType, "Business Account"),
      branchCode: firstNonEmpty(settings?.payments?.branchCode),
      verificationMessage: firstNonEmpty(
        settings?.payments?.verificationMessage,
        "After you transfer, Kagie verifies your payment manually. Use your Kagie reference and upload proof of payment."
      ),
      supportPhone: firstNonEmpty(settings?.supportPhone),
      supportEmail: firstNonEmpty(settings?.supportEmail)
    };
  }

  function hasCompleteBankingDetails(details) {
    return Boolean(details?.bankName && details?.accountNumber && details?.branchCode);
  }

  function splitCart(cart) {
    const packs = cart.filter((item) => item.type === "application_pack");
    const promos = cart.filter((item) => Boolean(item?.isPromoDiscount || item?.promoCode));
    const services = cart.filter((item) => !promos.includes(item) && (item.type === "service" || item.type === "service_request"));
    const others = cart.filter((item) => !packs.includes(item) && !services.includes(item) && !promos.includes(item));
    const institutionsCount = packs.reduce((sum, item) => sum + Number(item.institutionCount || item.institutions?.length || 0), 0);
    return {
      packs,
      services,
      promos,
      others,
      institutionsCount
    };
  }

  const CART_SIGNATURE_IGNORED_KEYS = new Set([
    "syncState", "sync_state", "createdAt", "created_at", "updatedAt", "updated_at", "savedAt", "saved_at"
  ]);

  function cartSignatureSnapshot(value, seen = new WeakSet()) {
    if (value === undefined || typeof value === "function" || typeof value === "symbol") return undefined;
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) {
      const result = value.map((entry) => cartSignatureSnapshot(entry, seen));
      seen.delete(value);
      return result;
    }
    const result = {};
    Object.keys(value).sort().forEach((key) => {
      if (CART_SIGNATURE_IGNORED_KEYS.has(key)) return;
      const nextValue = cartSignatureSnapshot(value[key], seen);
      if (nextValue !== undefined) result[key] = nextValue;
    });
    seen.delete(value);
    return result;
  }

  function buildCartSignature(cart, pricing) {
    const items = (Array.isArray(cart) ? cart : []).map((item, index) => ({
      key: firstNonEmpty(item?.clientKey, item?.id, `${item?.type || "item"}-${index}`),
      type: firstNonEmpty(item?.type, "item"),
      applicationId: firstNonEmpty(item?.applicationId, item?.application?.id),
      name: firstNonEmpty(item?.packName, item?.serviceName, item?.name),
      quantity: Math.max(1, Number(item?.quantity || 1)),
      price: Number(item?.price ?? item?.packPrice ?? item?.unitPrice ?? 0),
      promoCode: firstNonEmpty(item?.promoCode),
      details: cartSignatureSnapshot(item)
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

    return JSON.stringify({
      items,
      subtotal: Number(pricing?.subtotal || 0),
      discount: Number(pricing?.discount || 0),
      total: Number(pricing?.total || 0),
      promoCode: firstNonEmpty(pricing?.promo?.code),
      promo: cartSignatureSnapshot(pricing?.promo || null)
    });
  }

  const PACK_RECOVERY_TOMBSTONE_PREFIX = "kagie_pack_recovery_tombstone_";

  function packRecoveryStorageKey(userId) {
    const userKey = String(userId || "learner").replace(/[^a-z0-9_-]/gi, "").slice(-48) || "learner";
    return `${PACK_RECOVERY_TOMBSTONE_PREFIX}${userKey}`;
  }

  function packRecoveryDescriptor(source) {
    if (!source || typeof source !== "object") return null;
    const isApplication = Boolean(source.package && String(source.type || "").trim().toLowerCase() !== "application_pack");
    const applicationId = String(
      source.applicationId || source.application?.id || (isApplication ? source.id : "") || ""
    ).trim();
    if (!applicationId) return null;
    const pack = source.package && typeof source.package === "object"
      ? source.package
      : (source.selectedPackage && typeof source.selectedPackage === "object" ? source.selectedPackage : source);
    const packKey = String(
      source.packageCode || pack.code || source.packageId || pack.packageId || pack.id ||
      source.packName || pack.packName || source.name || pack.name || ""
    ).trim().toLowerCase();
    const rawPrice = Number(source.packPrice ?? source.price ?? pack.packPrice ?? pack.price ?? 0);
    return {
      applicationId,
      packKey,
      price: Number.isFinite(rawPrice) ? rawPrice : 0
    };
  }

  function isPackRecoverySuppressed(userId, application) {
    const descriptor = packRecoveryDescriptor(application);
    if (!descriptor) return false;
    try {
      const stored = JSON.parse(window.localStorage?.getItem(packRecoveryStorageKey(userId)) || "null");
      if (!stored || String(stored.applicationId || "") !== descriptor.applicationId) return false;
      if (stored.packKey && descriptor.packKey && stored.packKey !== descriptor.packKey) return false;
      if (Number.isFinite(Number(stored.price)) && Number(stored.price) !== descriptor.price) return false;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function createOrderReferenceSeed() {
    return `ORDER-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function orderReferenceStorageKey(userId) {
    const userKey = String(userId || "learner").replace(/[^a-z0-9_-]/gi, "").slice(-48) || "learner";
    return `kagie_checkout_reference_${userKey}`;
  }

  function resolveOrderReferenceSeed(userId, cartSignature, fallbackSeed) {
    const nextFallback = fallbackSeed || createOrderReferenceSeed();
    if (!cartSignature) return nextFallback;
    try {
      const key = orderReferenceStorageKey(userId);
      const stored = JSON.parse(window.localStorage?.getItem(key) || "null");
      if (stored?.cartSignature === cartSignature && stored?.seed) return String(stored.seed);
      const seed = createOrderReferenceSeed();
      window.localStorage?.setItem(key, JSON.stringify({ cartSignature, seed }));
      return seed;
    } catch (_error) {
      return nextFallback;
    }
  }

  function clearOrderReferenceSeed(userId) {
    try {
      window.localStorage?.removeItem(orderReferenceStorageKey(userId));
    } catch (_error) {
      // A blocked storage write must not interrupt checkout confirmation.
    }
  }

  function evaluateCheckoutGate(pack, latestApplication) {
    const learner = latestApplication?.forms?.learner || pack?.learner || {};
    const parent = latestApplication?.forms?.parent || pack?.parentData || {};
    const school = latestApplication?.forms?.school || pack?.school || {};
    const marks = Array.isArray(latestApplication?.forms?.marks?.subjects)
      ? latestApplication.forms.marks.subjects
      : (Array.isArray(pack?.marks) ? pack.marks : []);
    const institutions = Array.isArray(latestApplication?.institutions)
      ? latestApplication.institutions
      : (Array.isArray(pack?.institutions) ? pack.institutions : []);

    const checks = {
      learner: Boolean(learner?.fullNames && learner?.surname && (learner?.cellphone || learner?.email)),
      parent: Boolean(parent?.guardianFullNames && parent?.guardianCell1),
      school: Boolean(school?.schoolName && school?.schoolProvince && school?.completionYear),
      marks: Array.isArray(marks) && marks.length > 0,
      institutions: Array.isArray(institutions) && institutions.length > 0
    };

    const labels = {
      learner: "learner details",
      parent: "parent or guardian details",
      school: "school information",
      marks: "marks",
      institutions: "at least one institution choice"
    };

    const missing = Object.keys(checks).filter((key) => !checks[key]).map((key) => labels[key]);
    return {
      ready: missing.length === 0,
      missing,
      checks
    };
  }

  function renderMethodGuide(method) {
    const guide = METHOD_GUIDES[method] || METHOD_GUIDES[TRANSFER_METHOD];
    return `
      <div>
        <div class="guide-title">How to do a bank transfer</div>
        <ol class="guide-list">
          ${guide.lines.map((line) => `<li><span>${esc(line)}</span></li>`).join("")}
        </ol>
      </div>
      <div class="checkout-bank-art" aria-hidden="true">${materialIcon("account_balance")}</div>
    `;
  }

  function renderBankingPanel(details) {
    const hasBankDetails = hasCompleteBankingDetails(details);

    if (!hasBankDetails) {
      return `
        <div class="banking-status warn">Official Kagie banking details are temporarily unavailable.</div>
        <p class="banking-copy">Checkout is paused until the bank name, account number, and branch code are available. Contact Kagie support if you need help.</p>
      `;
    }

    return `
      <div class="bank-grid">
        <div class="bank-row"><span>Account name</span><strong>${esc(details.merchantName)}</strong></div>
        <div class="bank-row"><span>Bank</span><strong>${esc(details.bankName)}</strong></div>
        <div class="bank-row"><span>Account number</span><strong>${esc(details.accountNumber)}</strong></div>
        <div class="bank-row"><span>Account type</span><strong>${esc(details.accountType)}</strong></div>
        <div class="bank-row"><span>Branch code</span><strong>${esc(details.branchCode || "Use bank default branch code")}</strong></div>
      </div>
    `;
  }

  function describeCheckoutError(error) {
    const raw = String(error?.message || error || "").trim();
    const lower = raw.toLowerCase();
    if (!raw) return "Kagie could not complete checkout right now. Please try again in a moment.";
    if (lower.includes("method not allowed")) {
      return "Kagie checkout backend did not accept the payment request. Make sure you are opening the latest Kagie site and try again.";
    }
    if (lower.includes("stack depth limit exceeded") || lower.includes("infinite recursion") || lower.includes("policy") || lower.includes("row-level security")) {
      return "Kagie had a temporary live sync problem, but your work is still safe. Please try the payment step again.";
    }
    return raw;
  }

  function validateProofFile(file) {
    if (!file) return "";
    const name = String(file.name || "").toLowerCase();
    const hasAcceptedExtension = ACCEPTED_PROOF_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!ACCEPTED_PROOF_TYPES.has(file.type) && !hasAcceptedExtension) {
      return "Use PDF, JPG, JPEG, or PNG files for proof of payment.";
    }
    if (Number(file.size || 0) > MAX_PROOF_BYTES) {
      return "Keep proof of payment under 8 MB.";
    }
    return "";
  }

  function whatsappNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("0")) return `27${digits.slice(1)}`;
    return digits;
  }

  function intakeLabel(latestApplication, pack, settings) {
    const raw = firstNonEmpty(
      latestApplication?.intake,
      latestApplication?.intakeYear,
      latestApplication?.academicYear,
      pack?.intake,
      pack?.intakeYear,
      settings?.defaultIntake,
      String(new Date().getFullYear())
    );
    return /intake/i.test(raw) ? raw : `${raw} Intake`;
  }

  async function main() {
    const api = window.KagieAPI;
    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : (api.currentUser() || await api.restoreSession());
    if (!restored) {
      window.location.href = "login.html";
      return;
    }
    if (normalizeRole(restored.role) !== "user") {
      redirectByRole(restored);
      return;
    }

    if (window.__kagieRuntimeConfigPromise && typeof window.__kagieRuntimeConfigPromise.then === "function") {
      await window.__kagieRuntimeConfigPromise.catch((error) => {
        console.warn("Kagie checkout runtime settings fallback:", error);
      });
    }

    const user = api.requireRole("user");
    const profile = await (api.getProfileAsync
      ? api.getProfileAsync(user.id).catch((error) => {
          console.warn("Kagie checkout profile prefill fallback:", error);
          return null;
        })
      : Promise.resolve(api.getProfile ? api.getProfile(user.id) : null));
    const settings = api.getSettings ? api.getSettings() : {};
    const merchantDetails = getMerchantDetails(settings);
    const bankingReady = hasCompleteBankingDetails(merchantDetails);
    let orderReferenceSeed = createOrderReferenceSeed();
    const getItems = async () => {
      try {
        if (api.syncAppliedPromoCodeAsync) await api.syncAppliedPromoCodeAsync(user.id);
        else if (api.syncAppliedPromoCode) api.syncAppliedPromoCode(user.id);
      } catch (error) {
        console.warn("Kagie checkout promo sync fallback:", error);
      }
      return api.getCartAsync ? api.getCartAsync(user.id) : (api.getCart(user.id) || []);
    };
    const getPricing = async (cart) => {
      try {
        if (Array.isArray(cart) && api.getCartPricingSummary) return api.getCartPricingSummary(user.id, cart);
        if (api.getCartPricingSummaryAsync) return await api.getCartPricingSummaryAsync(user.id);
        if (api.getCartPricingSummary) return api.getCartPricingSummary(user.id);
      } catch (error) {
        console.warn("Kagie checkout pricing fallback:", error);
      }

      const total = api.getCartTotalAsync ? await api.getCartTotalAsync(user.id) : api.getCartTotal(user.id);
      return { subtotal: total, discount: 0, total, promo: null };
    };
    const getLatestApplication = () => api.getLatestApplicationAsync ? api.getLatestApplicationAsync(user.id) : Promise.resolve(api.getLatestApplication(user.id));
    const getApplicationById = (applicationId) => {
      if (!applicationId) return Promise.resolve(null);
      if (api.getApplicationByIdAsync) return api.getApplicationByIdAsync(applicationId, user.id);
      if (api.getApplicationById) return Promise.resolve(api.getApplicationById(applicationId));
      return Promise.resolve(null);
    };
    const hasBillableItems = (cart) => {
      const { packs, services, others } = splitCart(Array.isArray(cart) ? cart : []);
      return Boolean(packs.length + services.length + others.length);
    };
    const shouldRecoverPackFromApplication = (application) => {
      if (!application || !application.package) return false;
      const status = String(application.status || "").trim().toLowerCase();
      const paymentStatus = String(application.paymentStatus || application.payment?.status || "").trim().toLowerCase();
      if (["application being processed", "submitted", "under review", "applied"].includes(status)) return false;
      if (["pending verification", "pending_verification", "verified"].includes(paymentStatus)) return false;
      if (isPackRecoverySuppressed(user.id, application)) return false;
      return true;
    };
    const resolvePackFromCatalog = async (packSource) => {
      const packs = api.getPackCatalogAsync
        ? await api.getPackCatalogAsync().catch(() => [])
        : (api.getPackCatalog ? api.getPackCatalog() : []);
      const sourceId = String(packSource?.id || packSource?.code || "").trim().toLowerCase();
      const sourceName = String(packSource?.name || packSource?.packName || "").trim().toLowerCase();
      return (Array.isArray(packs) ? packs : []).find((pack) => {
        const id = String(pack?.id || pack?.code || "").trim().toLowerCase();
        const name = String(pack?.name || pack?.packName || "").trim().toLowerCase();
        return (sourceId && id === sourceId) || (sourceName && name === sourceName);
      }) || null;
    };
    const recoverCartFromLatestApplication = async (application) => {
      if (!shouldRecoverPackFromApplication(application)) return null;
      const appPack = application.package || {};
      const catalogPack = await resolvePackFromCatalog(appPack);
      const packName = appPack.name || appPack.packName || catalogPack?.name || "Application Pack";
      const institutions = Array.isArray(application.institutions) ? application.institutions : [];
      const price = Number(appPack.price ?? appPack.packPrice ?? catalogPack?.price ?? 0);
      const recovered = {
        id: `pack_${application.id || user.id}`,
        clientKey: `pack_${application.id || user.id}`,
        applicationId: application.id || "",
        type: "application_pack",
        packageId: appPack.id || catalogPack?.id || "",
        packageCode: appPack.code || catalogPack?.code || "",
        name: packName,
        packName,
        price,
        packPrice: price,
        institutionLimit: appPack.institutionLimit ?? catalogPack?.institutionLimit ?? 0,
        institutionCount: institutions.length,
        institutions,
        learner: application.forms?.learner || {},
        parentData: application.forms?.parent || {},
        school: application.forms?.school || {},
        marks: Array.isArray(application.forms?.marks?.subjects) ? application.forms.marks.subjects : [],
        syncState: "recovered"
      };
      try {
        if (api.replaceApplicationPackCartItemAsync) return await api.replaceApplicationPackCartItemAsync(recovered, user.id);
      } catch (error) {
        console.warn("Kagie checkout live cart recovery fallback:", error);
      }
      try {
        if (api.addCartItem) {
          const existing = api.getCart ? (api.getCart(user.id) || []) : [];
          if (api.removeCartItem) {
            for (const entry of existing.filter((item) => item.type === "application_pack")) {
              api.removeCartItem(entry.id, user.id);
            }
          }
          api.addCartItem({ ...recovered, syncState: "local_recovered" }, user.id);
          return { ...recovered, syncState: "local_recovered" };
        }
      } catch (error) {
        console.warn("Kagie checkout local cart recovery failed:", error);
      }
      return null;
    };

    const el = {
      userAvatar: document.querySelector(".checkout-avatar"),
      heroTitle: $("heroTitle"),
      heroText: $("heroText"),
      totalMeta: $("totalMeta"),
      itemMeta: $("itemMeta"),
      statusMeta: $("statusMeta"),
      summary: $("summary"),
      orderChecklist: $("orderChecklist"),
      pricingSummary: $("pricingSummary"),
      payerName: $("payerName"),
      payerPhone: $("payerPhone"),
      reference: $("reference"),
      referenceHint: $("referenceHint"),
      method: $("method"),
      proofName: $("proofName"),
      proofFile: $("proofFile"),
      proofIntroBox: $("proofIntroBox"),
      proofNameWrap: $("proofNameWrap"),
      proofFileWrap: $("proofFileWrap"),
      confirmText: $("confirmText"),
      methodGuide: $("methodGuide"),
      bankingPanel: $("bankingPanel"),
      supportLine: $("supportLine"),
      confirmCheck: $("confirmCheck"),
      paymentNotice: $("paymentNotice"),
      payBanner: $("payBanner"),
      confirmBtn: $("confirmBtn"),
      checkoutForm: $("checkoutPaymentForm"),
      reviewActions: $("checkoutReviewActions"),
      reviewHint: $("checkoutReviewHint"),
      continuePaymentBtn: $("continuePaymentBtn"),
      paymentStepPanel: $("paymentStepPanel"),
      confirmationPanel: $("confirmationPanel"),
      confirmationTitle: $("confirmationTitle"),
      confirmationText: $("confirmationText"),
      confirmationReceipt: $("confirmationReceipt"),
      stepReview: $("checkoutStepReview"),
      stepPayment: $("checkoutStepPayment"),
      stepConfirmation: $("checkoutStepConfirmation"),
      proofUploadLink: $("proofUploadLink"),
      confirmationProofLink: $("confirmationProofLink"),
      supportWhatsApp: $("supportWhatsApp"),
      supportEmail: $("supportEmail")
    };

    let latestApplication = null;
    let submitting = false;
    let paymentSubmitted = false;
    let checkoutCompleted = false;
    let hasCurrentItems = false;
    let activeStep = "review";
    let submittedReceipt = null;
    let currentPricingTotal = 0;
    let currentPricing = { subtotal: 0, discount: 0, total: 0, promo: null };
    let currentCartSignature = "";
    let currentOrderApplication = null;
    let requiresSettledPackCleanup = false;
    let lastSuggestedReference = "";
    let checkoutRecoveryMessage = "";

    function setPaymentNotice(message, allowHtml = false) {
      if (!el.paymentNotice) return;
      if (allowHtml) el.paymentNotice.innerHTML = message;
      else el.paymentNotice.textContent = message;
    }

    function buildProofUploadHref(application) {
      const params = new URLSearchParams({ category: "proof_of_payment" });
      const applicationId = firstNonEmpty(application?.id);
      if (applicationId) params.set("applicationId", applicationId);
      return `upload.html?${params.toString()}`;
    }

    function syncProofUploadLinks(application) {
      const href = buildProofUploadHref(application);
      if (el.proofUploadLink) el.proofUploadLink.href = href;
      if (el.confirmationProofLink) el.confirmationProofLink.href = href;
    }

    function syncSupportLinks() {
      const phone = whatsappNumber(merchantDetails.supportPhone);
      if (el.supportWhatsApp) {
        if (phone) {
          const message = encodeURIComponent("Hello Kagie, I need help with my checkout.");
          el.supportWhatsApp.href = `https://wa.me/${phone}?text=${message}`;
          el.supportWhatsApp.target = "_blank";
          el.supportWhatsApp.rel = "noopener noreferrer";
          el.supportWhatsApp.hidden = false;
        } else {
          el.supportWhatsApp.hidden = true;
        }
      }

      if (el.supportEmail) {
        if (merchantDetails.supportEmail) {
          el.supportEmail.href = `mailto:${encodeURIComponent(merchantDetails.supportEmail)}?subject=${encodeURIComponent("Kagie checkout support")}`;
          el.supportEmail.hidden = false;
        } else {
          el.supportEmail.hidden = true;
        }
      }
    }

    function syncStepState(nextStep, options = {}) {
      const requested = ["review", "payment", "confirmation"].includes(nextStep) ? nextStep : "review";
      if (requested === "payment" && (
        !hasCurrentItems || checkoutCompleted || !bankingReady || currentPricingTotal <= 0 || requiresSettledPackCleanup
      )) {
        if (!options.silent) {
          el.reviewHint.textContent = requiresSettledPackCleanup
            ? "Remove the already-paid application package from your cart before paying for the new service."
            : currentPricingTotal <= 0 && hasCurrentItems
            ? "No bank transfer is required for a R0 order. Contact Kagie support to activate the fully discounted order."
            : !bankingReady
              ? "Checkout is paused until Kagie's complete banking details are available."
            : checkoutCompleted
              ? "This transfer has already been submitted for verification."
              : "Add a package or service to your cart before continuing to payment.";
        }
        return false;
      }
      if (requested === "confirmation" && !checkoutCompleted) {
        if (!options.silent) el.reviewHint.textContent = "Submit your transfer details before opening confirmation.";
        return false;
      }

      activeStep = requested;
      const steps = [el.stepReview, el.stepPayment, el.stepConfirmation];
      const activeIndex = { review: 0, payment: 1, confirmation: 2 }[activeStep];
      steps.forEach((step, index) => {
        if (!step) return;
        step.classList.toggle("is-active", index === activeIndex);
        step.classList.toggle("is-complete", index < activeIndex || (checkoutCompleted && index < 2));
        if (index === activeIndex) step.setAttribute("aria-current", "step");
        else step.removeAttribute("aria-current");
      });

      if (el.stepPayment) {
        const paymentUnavailable = !hasCurrentItems || checkoutCompleted || !bankingReady || currentPricingTotal <= 0 || requiresSettledPackCleanup;
        el.stepPayment.setAttribute("aria-disabled", String(paymentUnavailable));
        el.stepPayment.disabled = paymentUnavailable;
      }
      if (el.stepConfirmation) {
        el.stepConfirmation.setAttribute("aria-disabled", String(!checkoutCompleted));
        el.stepConfirmation.disabled = !checkoutCompleted;
      }

      document.querySelectorAll(".checkout-step-connector").forEach((connector, index) => {
        connector.classList.toggle("is-active", index < activeIndex || checkoutCompleted);
      });

      el.paymentStepPanel.hidden = activeStep !== "payment";
      el.confirmationPanel.hidden = activeStep !== "confirmation";
      el.reviewActions.hidden = activeStep !== "review" || !hasCurrentItems || checkoutCompleted;

      if (options.scroll) {
        const target = activeStep === "payment"
          ? el.paymentStepPanel
          : activeStep === "confirmation"
            ? el.confirmationPanel
            : el.summary?.closest(".checkout-card");
        if (target) {
          const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
          target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
          if (options.focus && typeof target.focus === "function") target.focus({ preventScroll: true });
        }
      }
      return true;
    }

    function renderConfirmation(application) {
      syncProofUploadLinks(application);
      const payment = application?.payment || {};
      const receipt = submittedReceipt || {};
      const amount = Number(receipt.amount ?? payment.amount ?? 0);
      const reference = firstNonEmpty(receipt.reference, payment.reference, buildSuggestedReference(user, application, settings, orderReferenceSeed));
      const method = firstNonEmpty(receipt.method, payment.method, TRANSFER_METHOD);
      const proofUploaded = Boolean(receipt.proofUploaded || payment.proofUploadedAt || payment.proofDocumentId);
      const verified = String(application?.paymentStatus || payment.status || "").trim().toLowerCase() === "verified";
      el.confirmationTitle.textContent = verified
        ? "Your payment has been verified"
        : "Your payment is awaiting verification";
      el.confirmationText.textContent = proofUploaded
        ? (verified
            ? "Kagie verified the transfer and updated your application payment status."
            : "Kagie saved your transfer details and proof of payment. Your application will update after the transfer is verified.")
        : "Kagie saved your transfer details. Upload proof of payment if you have not attached it yet so verification can move faster.";
      el.confirmationReceipt.innerHTML = `
        <div class="checkout-receipt-item"><span>Amount</span><strong>${esc(money(amount))}</strong></div>
        <div class="checkout-receipt-item"><span>Reference</span><strong>${esc(reference)}</strong></div>
        <div class="checkout-receipt-item"><span>Status</span><strong>${verified ? "Verified" : proofUploaded ? "Proof received" : "Pending verification"}</strong></div>
        <div class="checkout-receipt-item"><span>Method</span><strong>${esc(method)}</strong></div>
      `;
    }

    function syncReferenceHint() {
      const suggestedReference = buildSuggestedReference(user, currentOrderApplication, settings, orderReferenceSeed);
      el.referenceHint.textContent = `Suggested reference: ${suggestedReference}`;
      if (!el.reference.value.trim() || el.reference.value.trim() === lastSuggestedReference) {
        el.reference.value = suggestedReference;
      }
      lastSuggestedReference = suggestedReference;
    }

    function syncMethodPanel() {
      el.methodGuide.innerHTML = renderMethodGuide(el.method.value);
      el.bankingPanel.innerHTML = renderBankingPanel(merchantDetails);
      el.supportLine.textContent = "Kagie verifies transfers manually after proof or a matching bank reference is received.";
      el.proofIntroBox.classList.remove("hidden");
      el.proofNameWrap.classList.remove("hidden");
      el.proofFileWrap.classList.remove("hidden");
      el.confirmText.innerHTML = "I confirm that I have transferred, or will transfer, the exact total using this Kagie payment reference.";
      syncReferenceHint();
    }

    let checkoutGate = { ready: false, missing: [] };

    function syncPayBanner(hasCartItems) {
      if (!el.payBanner) return;
      if (!hasCartItems || currentPricingTotal <= 0) {
        el.payBanner.classList.add("hidden");
        el.payBanner.innerHTML = "";
        return;
      }

      const reference = el.reference?.value?.trim() || buildSuggestedReference(user, currentOrderApplication, settings, orderReferenceSeed);
      const promoLine = Number(currentPricing.discount || 0) > 0
        ? `Subtotal ${money(currentPricing.subtotal)} less ${money(currentPricing.discount)} promo discount.`
        : "This is the exact total from your current Kagie cart.";
      const paymentFlowLine = "Kagie will match the bank transfer to your reference and verify it manually.";
      const followUpLine = checkoutGate.ready
        ? paymentFlowLine
        : `Kagie will still follow up on ${checkoutGate.missing.join(", ")} after payment if needed.`;

      el.payBanner.innerHTML = `
        <p class="pay-banner-title">You are about to pay ${esc(money(currentPricingTotal))}</p>
        <p class="pay-banner-copy">${esc(promoLine)} ${esc(followUpLine)}</p>
        <div class="pay-banner-meta">
          <span class="pay-banner-chip">Bank transfer</span>
          <span class="pay-banner-chip">Reference ${esc(reference)}</span>
        </div>
      `;
      el.payBanner.classList.remove("hidden");
    }

    function syncButton(hasCartItems) {
      const ux = window.KagieUX;
      const zeroTotal = hasCartItems && currentPricingTotal <= 0;
      const unavailable = !hasCartItems || submitting || checkoutCompleted || !bankingReady || zeroTotal || requiresSettledPackCleanup;
      el.confirmBtn.disabled = unavailable;
      if (el.continuePaymentBtn) {
        el.continuePaymentBtn.disabled = unavailable;
        el.continuePaymentBtn.textContent = requiresSettledPackCleanup
          ? "Review cart first"
          : zeroTotal
            ? "No transfer required"
            : "Continue to payment";
      }
      if (submitting && ux?.setButtonLoading) {
        ux.setButtonLoading(el.confirmBtn, true, { busyText: "Submitting transfer..." });
      } else if (ux?.setButtonLoading) {
        ux.setButtonLoading(el.confirmBtn, false, { keepDisabled: unavailable });
        el.confirmBtn.textContent = requiresSettledPackCleanup
          ? "Review cart first"
          : zeroTotal
          ? "No transfer required"
          : hasCartItems
          ? `Confirm transfer ${money(currentPricingTotal)}`
          : "Confirm transfer";
      } else {
        el.confirmBtn.textContent = submitting
          ? "Submitting transfer..."
          : requiresSettledPackCleanup
            ? "Review cart first"
          : zeroTotal
            ? "No transfer required"
            : hasCartItems
              ? `Confirm transfer ${money(currentPricingTotal)}`
              : "Confirm transfer";
      }
      el.confirmBtn.style.opacity = unavailable ? ".7" : "1";
    }

    async function submitTransferPayment(payload) {
      if (typeof api.submitApplicationFromCartAsync === "function") return api.submitApplicationFromCartAsync(payload);
      if (typeof api.submitApplicationFromCart === "function") return api.submitApplicationFromCart(payload);
      if (typeof api.submitPayment === "function") return api.submitPayment(payload);
      throw new Error("Kagie payment submission is not available right now.");
    }

    async function savePaymentProof(applicationId, file, proofName) {
      if (!file) return null;
      const payload = {
        file,
        applicationId,
        category: "proof_of_payment",
        name: proofName || file.name || "Proof of payment",
        type: file.type || "",
        size: Number(file.size || 0)
      };
      if (typeof api.saveDocumentsAsync === "function") return api.saveDocumentsAsync(payload, user.id);
      if (typeof api.saveDocuments === "function") return api.saveDocuments(payload, user.id);
      throw new Error("Kagie document upload is not available right now.");
    }

    async function render() {
      let [cart, latest] = await Promise.all([
        getItems(),
        getLatestApplication().catch(() => null)
      ]);

      latestApplication = latest || latestApplication;
      checkoutRecoveryMessage = "";
      if (!hasBillableItems(cart)) {
        const recoveredItem = await recoverCartFromLatestApplication(latestApplication);
        if (recoveredItem) {
          cart = await getItems().catch(() => [recoveredItem]);
          if (!hasBillableItems(cart)) cart = [recoveredItem];
          checkoutRecoveryMessage = "We restored your selected package from your saved application draft.";
        }
      }
      const pricing = await getPricing(cart);
      currentPricing = pricing || currentPricing;
      currentPricingTotal = Number(pricing?.total || 0);

      const { packs, services, promos, others, institutionsCount } = splitCart(cart);
      const itemCount = packs.length + services.length + others.length;
      const leadPack = packs[0] || null;
      currentCartSignature = buildCartSignature(cart, pricing);
      if (itemCount) {
        orderReferenceSeed = resolveOrderReferenceSeed(user.id, currentCartSignature, orderReferenceSeed);
      }
      const cartApplicationId = firstNonEmpty(leadPack?.applicationId, leadPack?.application?.id).toLowerCase();
      const latestApplicationId = firstNonEmpty(latestApplication?.id).toLowerCase();
      const hasAdditionalCurrentItems = services.length > 0 || others.length > 0;
      const referencedApplication = !itemCount
        ? latestApplication
        : cartApplicationId === latestApplicationId && cartApplicationId
          ? latestApplication
          : cartApplicationId
            ? await getApplicationById(cartApplicationId).catch(() => null)
            : null;
      const normalizedPaymentStatus = String(
        referencedApplication?.paymentStatus || referencedApplication?.payment?.status || ""
      ).trim().toLowerCase();
      const pendingVerification = paymentSubmitted || ["pending verification", "pending_verification"].includes(normalizedPaymentStatus);
      const paymentVerified = normalizedPaymentStatus === "verified";
      const referencedPaymentAlreadySettled = pendingVerification || paymentVerified;
      requiresSettledPackCleanup = Boolean(itemCount && referencedPaymentAlreadySettled && hasAdditionalCurrentItems && leadPack);
      currentOrderApplication = requiresSettledPackCleanup ? null : referencedApplication;
      checkoutGate = evaluateCheckoutGate(leadPack, currentOrderApplication);
      const existingPaymentCompletesCurrentOrder = Boolean(
        referencedPaymentAlreadySettled && (
          !itemCount || (referencedApplication && packs.length === 1 && services.length === 0 && others.length === 0)
        )
      );
      checkoutCompleted = Boolean(paymentSubmitted || existingPaymentCompletesCurrentOrder);
      hasCurrentItems = Boolean(itemCount) && !checkoutCompleted;
      const completedApplication = checkoutCompleted ? (referencedApplication || latestApplication) : null;

      if (checkoutCompleted && !submittedReceipt) {
        submittedReceipt = {
          amount: Number(completedApplication?.payment?.amount || 0),
          reference: completedApplication?.payment?.reference || "",
          method: completedApplication?.payment?.method || TRANSFER_METHOD,
          proofUploaded: Boolean(completedApplication?.payment?.proofUploadedAt || completedApplication?.payment?.proofDocumentId)
        };
      }

      const displayName = firstNonEmpty(profile?.fullName, profile?.fullNames, user.fullName, user.name, "Student");
      el.heroTitle.textContent = `Hello, ${displayName}`;
      if (el.userAvatar) el.userAvatar.textContent = displayName.charAt(0).toUpperCase() || "K";
      el.heroText.textContent = itemCount
        ? (checkoutCompleted
            ? (paymentVerified ? "Your payment has been verified. You can continue from your Kagie home." : "Your transfer was submitted and is waiting for Kagie verification.")
            : requiresSettledPackCleanup
              ? "Remove the already-paid application package before paying for the new service, so it is not charged twice."
            : checkoutRecoveryMessage || (!checkoutGate.ready
            ? `You can still pay now. Kagie will follow up on ${checkoutGate.missing.join(", ")} while your application keeps moving.`
            : pricing.discount > 0
              ? `Your promo is active. Pay ${money(pricing.total)} and Kagie will track the rest.`
              : "Check your order, pay, and Kagie will track the rest."))
        : checkoutCompleted
          ? (paymentVerified ? "Your payment has been verified." : "Your payment was submitted. Kagie is checking it now.")
          : "There is nothing to pay for yet. Add a package or service first.";
      el.totalMeta.textContent = intakeLabel(currentOrderApplication, leadPack, settings);
      el.itemMeta.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
      el.statusMeta.textContent = checkoutCompleted
        ? (paymentVerified ? "Verified" : "Pending verification")
        : "Awaiting payment";

      el.payerName.value = firstNonEmpty(el.payerName.value, profile?.fullName, profile?.fullNames, user.fullName);
      el.payerPhone.value = firstNonEmpty(el.payerPhone.value, profile?.phone, profile?.cellphone, user.phone);
      const noticeMessage = checkoutCompleted
            ? paymentVerified
              ? `Your payment is verified. <a class="proof-link" href="home.html">Open Kagie home</a>`
              : `Transfer details submitted successfully. Kagie is waiting for proof or manual verification. <a class="proof-link" href="home.html">Open Kagie home</a>`
            : requiresSettledPackCleanup
              ? `This cart mixes an already-paid application package with new items. <a class="proof-link" href="cart.html">Review the cart and remove the paid package</a> before continuing.`
            : itemCount && currentPricingTotal <= 0
              ? "Your promo covers the full order, so no bank transfer is required. Contact Kagie support to activate the order without creating a R0 payment."
            : !bankingReady
              ? "Checkout is paused because Kagie's complete banking details are unavailable. Contact support before making a transfer."
            : !checkoutGate.ready && itemCount
            ? `Payment is still open even though ${esc(checkoutGate.missing.join(", "))} ${checkoutGate.missing.length === 1 ? "is" : "are"} still missing. Kagie assistants will see the gaps, contact the learner, and continue the application manually if needed.`
            : normalizedPaymentStatus === "rejected"
                ? `Your previous proof of payment was rejected${referencedApplication?.payment?.rejectionReason ? `: ${esc(referencedApplication.payment.rejectionReason)}` : ""}. Upload a clearer proof before confirming again.`
                : esc(merchantDetails.verificationMessage);
      setPaymentNotice(noticeMessage, true);

      const orderTitle = leadPack
        ? (leadPack.packName || leadPack.name || "Application package")
        : services[0]
          ? (services[0].serviceName || services[0].name || "Support service")
          : others[0]
            ? (others[0].name || others[0].serviceName || "Saved cart item")
            : checkoutCompleted
              ? "Transfer submitted"
              : "No items yet";
      const applicationPack = leadPack || completedApplication?.package || null;
      const packagePrice = Number(leadPack?.packPrice || leadPack?.price || applicationPack?.price || applicationPack?.packPrice || 0);
      el.summary.innerHTML = itemCount || checkoutCompleted
        ? `
          <div class="checkout-summary-top">
            <span class="checkout-summary-icon">${materialIcon(checkoutCompleted ? "receipt" : "shopping_bag")}</span>
            <div>
              <span class="checkout-summary-eyebrow">${checkoutCompleted ? "Submitted order" : `${itemCount} order item${itemCount === 1 ? "" : "s"}`}</span>
              <strong class="checkout-summary-title" title="${esc(orderTitle)}">${esc(orderTitle)}</strong>
            </div>
          </div>
          <div class="checkout-summary-rows">
            ${applicationPack ? `<div class="checkout-summary-row"><span>Application package</span><strong>${esc(money(packagePrice))}</strong></div>` : ""}
            <div class="checkout-summary-row"><span>Support services</span><strong>${services.length}</strong></div>
            <div class="checkout-summary-row"><span>Institutions linked</span><strong>${institutionsCount || completedApplication?.institutions?.length || 0}</strong></div>
            <div class="checkout-summary-row"><span>Other items</span><strong>${others.length}</strong></div>
          </div>
        `
        : `<div class="checkout-summary-empty"><span>Your cart is empty.<br><a class="proof-link" href="forms.html">Choose a package or service</a> to continue.</span></div>`;

      const receiptTotal = Number(submittedReceipt?.amount || completedApplication?.payment?.amount || 0);
      const displayTotal = itemCount ? Number(pricing.total || 0) : (checkoutCompleted ? receiptTotal : 0);
      const displaySubtotal = itemCount ? Number(pricing.subtotal || 0) : displayTotal;
      const displayDiscount = itemCount ? Number(pricing.discount || 0) : 0;
      el.pricingSummary.innerHTML = `
        <div class="checkout-summary-top">
          <span class="checkout-summary-icon">${materialIcon("payments")}</span>
          <div>
            <span class="checkout-summary-eyebrow">${checkoutCompleted ? "Submitted total" : "Payment total"}</span>
            <strong class="checkout-summary-title">${esc(money(displayTotal))}</strong>
          </div>
        </div>
        <div class="checkout-summary-rows">
          <div class="checkout-summary-row"><span>Subtotal</span><strong>${esc(money(displaySubtotal))}</strong></div>
          <div class="checkout-summary-row"><span>Discount</span><strong>${displayDiscount > 0 ? `-${esc(money(displayDiscount))}` : esc(money(0))}</strong></div>
          <div class="checkout-summary-row checkout-summary-row--total"><span>${checkoutCompleted ? "Submitted" : "Total due"}</span><strong>${esc(money(displayTotal))}</strong></div>
        </div>
        <div class="checkout-summary-extra"><span>${pricing.promo ? `Promo ${esc(pricing.promo.code)}` : "Bank transfer / EFT"}</span><strong>ZAR</strong></div>
      `;

      const hasPackage = Boolean(packs.length || (checkoutCompleted && currentOrderApplication?.package));
      const linkedInstitutionCount = institutionsCount || (checkoutCompleted ? currentOrderApplication?.institutions?.length : 0) || 0;
      const checklist = [
        { text: hasPackage ? "Application package ready" : "No package in cart yet", ready: hasPackage, icon: "inventory_2" },
        { text: checkoutGate.checks?.learner ? "Learner details saved" : "Learner details can be completed later", ready: checkoutGate.checks?.learner, icon: "badge" },
        { text: checkoutGate.checks?.parent ? "Parent details saved" : "Parent details can be completed later", ready: checkoutGate.checks?.parent, icon: "family_restroom" },
        { text: checkoutGate.checks?.school ? "School details saved" : "School details can be completed later", ready: checkoutGate.checks?.school, icon: "school" },
        { text: checkoutGate.checks?.marks ? "Marks saved" : "Marks can be completed later", ready: checkoutGate.checks?.marks, icon: "monitoring" },
        { text: `${linkedInstitutionCount} institution${linkedInstitutionCount === 1 ? "" : "s"} linked`, ready: checkoutGate.checks?.institutions, icon: "account_balance" },
        { text: `${services.length} paid service${services.length === 1 ? "" : "s"} included`, ready: services.length > 0, neutral: services.length === 0, icon: "design_services" },
        { text: pricing.promo ? `Promo ${pricing.promo.code} is active` : "No promo code applied", ready: Boolean(pricing.promo), neutral: !pricing.promo, icon: "sell" },
        { text: "Use the same payment reference everywhere", ready: true, icon: "tag" },
        { text: checkoutCompleted ? "Transfer submitted for verification" : "Kagie will verify the transfer manually", ready: checkoutCompleted, neutral: !checkoutCompleted, icon: "verified_user" }
      ];

      el.orderChecklist.innerHTML = checklist.map((item) => `
        <div class="check-item ${item.neutral ? "" : item.ready ? "is-ready" : "is-pending"}">
          <span class="checkout-check-icon">${materialIcon(item.ready ? "check" : item.icon)}</span>
          <span>${esc(item.text)}</span>
        </div>
      `).join("");
      syncMethodPanel();
      syncPayBanner(hasCurrentItems);
      syncButton(hasCurrentItems);
      if (el.reviewHint) {
        el.reviewHint.textContent = requiresSettledPackCleanup
          ? "Review your cart and remove the already-paid package before paying for the new service."
          : hasCurrentItems && currentPricingTotal <= 0
          ? "No bank transfer is required. Contact Kagie support to activate this fully discounted order."
          : hasCurrentItems && !bankingReady
          ? "Checkout is paused until Kagie's complete banking details are available."
          : hasCurrentItems
          ? `Continue when you are ready to submit ${money(currentPricingTotal)} for verification.`
          : checkoutCompleted
            ? "Your transfer is already in the verification queue."
            : "Add a package or service to your cart before continuing.";
      }
      syncProofUploadLinks(checkoutCompleted ? completedApplication : currentOrderApplication);
      // Empty orders have one clear next action, without transfer instructions.
      document.querySelectorAll(".checkout-followup, .checkout-bank").forEach((section) => {
        section.hidden = !hasCurrentItems && !checkoutCompleted;
      });
      if (checkoutCompleted) renderConfirmation(completedApplication);
      syncStepState(checkoutCompleted ? "confirmation" : (hasCurrentItems ? activeStep : "review"), { silent: true });
    }

    el.method.addEventListener("change", syncMethodPanel);
    if (el.reference) {
      el.reference.addEventListener("input", () => {
        syncPayBanner(hasCurrentItems);
      });
    }

    el.stepReview?.addEventListener("click", () => syncStepState("review", { scroll: true }));
    el.stepPayment?.addEventListener("click", () => syncStepState("payment", { scroll: true, focus: true }));
    el.stepConfirmation?.addEventListener("click", () => syncStepState("confirmation", { scroll: true, focus: true }));
    el.continuePaymentBtn?.addEventListener("click", () => syncStepState("payment", { scroll: true, focus: true }));

    el.checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting || checkoutCompleted) return;

      if (requiresSettledPackCleanup) {
        setPaymentNotice("Review your cart and remove the already-paid application package before paying for the new service.");
        return;
      }

      if (!bankingReady) {
        setPaymentNotice("Checkout is paused until Kagie's complete banking details are available. Contact support before making a transfer.");
        return;
      }

      if (currentPricingTotal <= 0) {
        setPaymentNotice("No bank transfer is required for this fully discounted order. Contact Kagie support to activate it without creating a R0 payment.");
        return;
      }

      if (!el.checkoutForm.checkValidity()) {
        setPaymentNotice("Complete the required payer and payment-reference fields, then confirm the transfer statement.");
        el.checkoutForm.reportValidity();
        return;
      }

      const method = el.method.value || TRANSFER_METHOD;
      let slowTimer = 0;
      submitting = true;
      syncButton(hasCurrentItems);

      try {
        let cart = await getItems();
        if (!hasBillableItems(cart)) {
          hasCurrentItems = false;
          syncStepState("review", { scroll: true, silent: true });
          if (el.reviewHint) el.reviewHint.textContent = "Your cart is empty. Add a package or service before continuing.";
          return;
        }

        const displayedTotal = currentPricingTotal;
        const freshPricing = await getPricing(cart);
        const freshTotal = Number(freshPricing?.total || 0);
        const freshCartSignature = buildCartSignature(cart, freshPricing);
        currentPricing = freshPricing || currentPricing;
        currentPricingTotal = freshTotal;
        if (Math.abs(freshTotal - displayedTotal) > 0.009 || freshCartSignature !== currentCartSignature) {
          await render();
          syncStepState("review", { scroll: true, silent: true });
          const changedTotalMessage = `Your order changed. Review the updated items and ${money(freshTotal)} total, then continue to payment again.`;
          if (el.reviewHint) el.reviewHint.textContent = changedTotalMessage;
          setPaymentNotice(changedTotalMessage);
          return;
        }

        slowTimer = window.setTimeout(() => {
          setPaymentNotice("Still submitting your transfer details, please wait...");
        }, 3200);

        const payerName = el.payerName.value.trim();
        const phone = el.payerPhone.value.trim();
        const reference = el.reference.value.trim();
        const note = $("note").value.trim();
        const proofFile = el.proofFile?.files?.[0] || null;
        const proofName = el.proofName?.value?.trim() || proofFile?.name || "";
        const proofError = validateProofFile(proofFile);
        const phoneDigits = phone.replace(/\D/g, "");

        if (phoneDigits.length < 9) {
          setPaymentNotice("Enter a valid payer phone number with at least 9 digits.");
          el.payerPhone.focus();
          return;
        }

        if (reference.length < 4) {
          setPaymentNotice("Enter the Kagie payment reference shown above.");
          el.reference.focus();
          return;
        }

        if (proofError) {
          setPaymentNotice(proofError);
          return;
        }

        if (!el.confirmCheck.checked) {
          setPaymentNotice("Please confirm that you will transfer using the Kagie payment reference.");
          return;
        }

        setPaymentNotice("Submitting transfer details. Please wait...");
        const updatedApplication = await submitTransferPayment({
          payerName,
          phone,
          reference,
          note,
          method: method || TRANSFER_METHOD
        });
        const submittedAmount = Number(updatedApplication?.payment?.amount ?? freshTotal);
        const proofUploadHref = esc(buildProofUploadHref(updatedApplication));

        let proofUploaded = false;
        let proofMessage = proofFile
          ? " Proof upload is being checked."
          : ` Upload proof of payment from <a class="proof-link" href="${proofUploadHref}">Upload Documents</a> if it is not attached yet.`;
        if (proofFile) {
          try {
            await savePaymentProof(updatedApplication?.id, proofFile, proofName);
            proofUploaded = true;
            proofMessage = " Proof of payment was uploaded for verification.";
            if (el.proofFile) el.proofFile.value = "";
            if (el.proofName) el.proofName.value = "";
          } catch (proofError) {
            console.warn("Kagie checkout proof upload failed:", proofError);
            proofMessage = ` Proof upload failed. Use <a class="proof-link" href="${proofUploadHref}">Upload Documents</a> to attach it.`;
          }
        }

        submittedReceipt = {
          amount: submittedAmount,
          reference,
          method,
          proofUploaded
        };
        paymentSubmitted = true;
        checkoutCompleted = true;
        hasCurrentItems = false;
        clearOrderReferenceSeed(user.id);
        el.confirmCheck.checked = false;
        try {
          await render();
        } catch (refreshError) {
          console.warn("Kagie checkout confirmation refresh fallback:", refreshError);
          latestApplication = updatedApplication || latestApplication;
          renderConfirmation(latestApplication);
          syncStepState("confirmation", { silent: true });
        }
        setPaymentNotice(`Transfer details submitted successfully. Kagie is waiting for manual verification.${proofMessage}`, true);
        syncStepState("confirmation", { scroll: true, focus: true });

      } catch (error) {
        console.error(error);
        setPaymentNotice(describeCheckoutError(error));
      } finally {
        if (slowTimer) window.clearTimeout(slowTimer);
        submitting = false;
        syncButton(hasCurrentItems);
      }
    });

    el.summary.innerHTML = window.KagieUX?.skeletonList?.({ rows: 3, lines: 2, pill: false }) || '<div class="empty">Loading your order...</div>';
    el.pricingSummary.innerHTML = window.KagieUX?.skeletonList?.({ rows: 1, lines: 3, avatar: false, pill: false }) || "";
    el.orderChecklist.innerHTML = window.KagieUX?.skeletonList?.({ rows: 5, lines: 1, avatar: false, pill: false }) || "";
    syncButton(false);
    syncSupportLinks();
    syncStepState("review", { silent: true });
    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const api = window.KagieAPI;
      const active = api?.currentUser?.();
      if (active && normalizeRole(active.role) !== "user") {
        redirectByRole(active);
        return;
      }
      const heroText = $("heroText");
      if (heroText) {
        heroText.textContent = "There was a short sync delay while loading checkout. Your cart is still safe.";
      }
      const paymentNotice = $("paymentNotice");
      if (paymentNotice) {
        paymentNotice.textContent = describeCheckoutError(error);
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
