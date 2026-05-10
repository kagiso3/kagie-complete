(function () {
  window.KagieCheckoutPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const money = (v) => `R${Number(v || 0).toLocaleString("en-ZA")}`;
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

  const METHOD_GUIDES = {
    "Yoco Checkout": {
      title: "Yoco secure checkout",
      lines: [
        "Kagie creates a secure Yoco checkout for this exact order.",
        "The amount is calculated on Kagie's server from your cart, not from browser input.",
        "After payment, Yoco confirms the result to Kagie automatically by webhook."
      ]
    }
  };

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  }

  function buildSuggestedReference(user, latestApplication, settings) {
    const prefix = firstNonEmpty(settings?.payments?.referencePrefix, settings?.appName, "KAG")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6) || "KAG";
    const seed = firstNonEmpty(
      latestApplication?.id,
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
        "Payments are confirmed automatically by Yoco after checkout."
      ),
      yocoEnabled: Boolean(settings?.payments?.yocoEnabled),
      yocoCheckoutEndpoint: firstNonEmpty(settings?.payments?.yocoCheckoutEndpoint),
      yocoPaymentLink: firstNonEmpty(settings?.payments?.yocoPaymentLink),
      yocoProviderLabel: firstNonEmpty(settings?.payments?.yocoProviderLabel, "Yoco secure checkout"),
      supportPhone: firstNonEmpty(settings?.supportPhone),
      supportEmail: firstNonEmpty(settings?.supportEmail)
    };
  }

  function isYocoMethod(method) {
    return String(method || "").trim() === "Yoco Checkout";
  }

  function readCheckoutReturnState() {
    const params = new URLSearchParams(window.location.search);
    return {
      provider: params.get("provider") || "",
      payment: params.get("payment") || "",
      checkoutId: params.get("checkoutId") || ""
    };
  }

  function buildCheckoutReturnUrl(paymentState) {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("provider", "yoco");
    url.searchParams.set("payment", paymentState);
    return url.toString();
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
    const guide = METHOD_GUIDES[method] || METHOD_GUIDES["Yoco Checkout"];
    return `
      <div class="guide-title">${esc(guide.title)}</div>
      <ul class="guide-list">
        ${guide.lines.map((line) => `<li>${esc(line)}</li>`).join("")}
      </ul>
    `;
  }

  function renderBankingPanel(details) {
    const hasBankDetails = Boolean(details.bankName || details.accountNumber || details.branchCode);
    const supportText = details.supportPhone || details.supportEmail
      ? [details.supportPhone ? `Call or WhatsApp: ${details.supportPhone}` : "", details.supportEmail ? `Email: ${details.supportEmail}` : ""].filter(Boolean).join(" | ")
      : "If you still need Kagie's banking details, request them from support before paying.";

    if (!hasBankDetails) {
      return `
        <div class="banking-status warn">Official Kagie banking details have not been added to settings yet.</div>
        <p class="banking-copy">Use the payment details shared by Kagie support, then come back here and capture the exact payment reference so verification can begin.</p>
        <p class="banking-copy">${esc(supportText)}</p>
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
      <p class="banking-copy">${esc(details.verificationMessage)}</p>
      <p class="banking-copy">${esc(supportText)}</p>
    `;
  }

  function describeCheckoutError(error) {
    const raw = String(error?.message || error || "").trim();
    const lower = raw.toLowerCase();
    if (!raw) return "Kagie could not complete checkout right now. Please try again in a moment.";
    if (lower.includes("stack depth limit exceeded") || lower.includes("infinite recursion") || lower.includes("policy") || lower.includes("row-level security")) {
      return "Kagie had a temporary live sync problem, but your work is still safe. Please try the payment step again.";
    }
    return raw;
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

    const user = api.requireRole("user");
    const settings = api.getSettings ? api.getSettings() : {};
    const merchantDetails = getMerchantDetails(settings);
    const getItems = () => api.getCartAsync ? api.getCartAsync(user.id) : Promise.resolve(api.getCart(user.id) || []);
    const getPricing = async () => {
      try {
        if (api.syncAppliedPromoCodeAsync) await api.syncAppliedPromoCodeAsync(user.id);
        else if (api.syncAppliedPromoCode) api.syncAppliedPromoCode(user.id);
      } catch (error) {
        console.warn("Kagie checkout promo sync fallback:", error);
      }

      try {
        if (api.getCartPricingSummaryAsync) return await api.getCartPricingSummaryAsync(user.id);
        if (api.getCartPricingSummary) return api.getCartPricingSummary(user.id);
      } catch (error) {
        console.warn("Kagie checkout pricing fallback:", error);
      }

      const total = api.getCartTotalAsync ? await api.getCartTotalAsync(user.id) : api.getCartTotal(user.id);
      return { subtotal: total, discount: 0, total, promo: null };
    };
    const getLatestApplication = () => api.getLatestApplicationAsync ? api.getLatestApplicationAsync(user.id) : Promise.resolve(api.getLatestApplication(user.id));

    const el = {
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
      confirmBtn: $("confirmBtn")
    };

    let latestApplication = null;
    let submitting = false;
    let paymentSubmitted = false;
    let currentPricingTotal = 0;
    let currentPricing = { subtotal: 0, discount: 0, total: 0, promo: null };
    const returnState = readCheckoutReturnState();

    function setPaymentNotice(message, allowHtml = false) {
      if (!el.paymentNotice) return;
      if (allowHtml) el.paymentNotice.innerHTML = message;
      else el.paymentNotice.textContent = message;
    }

    function renderReturnMessage() {
      if (returnState.provider === "yoco") {
        if (returnState.payment === "success") {
          return "Yoco returned you after payment. Kagie will update the dashboard as soon as the secure webhook confirms it.";
        }
        if (returnState.payment === "cancel") {
          return "Your Yoco payment was not completed. Your Kagie order is still saved and you can try again.";
        }
        if (returnState.payment === "failed") {
          return "Your Yoco payment did not complete. You can try again now and Kagie will keep the order ready.";
        }
      }
      return "";
    }

    function syncReferenceHint() {
      const suggestedReference = buildSuggestedReference(user, latestApplication, settings);
      el.referenceHint.textContent = `Suggested reference: ${suggestedReference}`;
      if (!el.reference.value.trim()) {
        el.reference.value = suggestedReference;
      }
    }

    function syncMethodPanel() {
      const hasCheckoutEndpoint = Boolean(merchantDetails.yocoCheckoutEndpoint);
      el.methodGuide.innerHTML = renderMethodGuide(el.method.value);
      el.bankingPanel.innerHTML = hasCheckoutEndpoint
        ? `<div class="guide-title">${esc(merchantDetails.yocoProviderLabel)}</div><div class="banking-copy">Kagie will create a secure Yoco checkout for this order and redirect you to Yoco.</div><div class="banking-copy">Do not close the Yoco page until it returns you to Kagie.</div>`
        : `<div class="guide-title">${esc(merchantDetails.yocoProviderLabel)}</div><div class="banking-copy">Yoco checkout has not been configured on this Kagie site yet.</div>`;
      el.supportLine.textContent = hasCheckoutEndpoint
        ? "Yoco confirms paid or failed payments directly to Kagie. You do not need to manually mark yourself as paid."
        : "Yoco payment is not available yet on this Kagie site.";
      el.proofIntroBox.classList.remove("hidden");
      el.proofNameWrap.classList.remove("hidden");
      el.proofFileWrap.classList.remove("hidden");
      el.confirmText.innerHTML = "I understand Kagie will redirect me to <strong>Yoco secure checkout</strong> and that payment is only confirmed after Yoco's server notification reaches Kagie.";
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

      const reference = el.reference?.value?.trim() || buildSuggestedReference(user, latestApplication, settings);
      const promoLine = Number(currentPricing.discount || 0) > 0
        ? `Subtotal ${money(currentPricing.subtotal)} less ${money(currentPricing.discount)} promo discount.`
        : "This is the exact total from your current Kagie cart.";
      const paymentFlowLine = "Kagie will redirect you to a secure Yoco checkout and wait for Yoco's server confirmation.";
      const followUpLine = checkoutGate.ready
        ? paymentFlowLine
        : `Kagie will still follow up on ${checkoutGate.missing.join(", ")} after payment if needed.`;

      el.payBanner.innerHTML = `
        <p class="pay-banner-title">You are about to pay ${esc(money(currentPricingTotal))}</p>
        <p class="pay-banner-copy">${esc(promoLine)} ${esc(followUpLine)}</p>
        <div class="pay-banner-meta">
          <span class="pay-banner-chip">Yoco secure checkout</span>
          <span class="pay-banner-chip">Reference ${esc(reference)}</span>
        </div>
      `;
      el.payBanner.classList.remove("hidden");
    }

    function syncButton(hasCartItems) {
      const onlineReady = Boolean(
        merchantDetails.yocoEnabled
        && merchantDetails.yocoCheckoutEndpoint
      );
      el.confirmBtn.disabled = !hasCartItems || submitting || !onlineReady;
      el.confirmBtn.textContent = submitting
        ? "Creating secure checkout..."
        : hasCartItems && onlineReady
          ? `Pay ${money(currentPricingTotal)} with Yoco`
          : "Continue to Yoco";
      el.confirmBtn.style.opacity = !hasCartItems || submitting || !onlineReady ? ".7" : "1";
    }

    async function startYocoCheckout(payload) {
      if (typeof api.startYocoCheckoutAsync !== "function") {
        throw new Error("Live Yoco checkout is not available on this Kagie site yet.");
      }
      return api.startYocoCheckoutAsync(payload);
    }

    async function render() {
      const [pricing, latest] = await Promise.all([
        getPricing(),
        getLatestApplication().catch(() => null)
      ]);
      const cart = await getItems();

      latestApplication = latest || latestApplication;
      currentPricing = pricing || currentPricing;
      currentPricingTotal = Number(pricing?.total || 0);

      const { packs, services, promos, others, institutionsCount } = splitCart(cart);
      const itemCount = packs.length + services.length + others.length;
      const leadPack = packs[0] || null;
      checkoutGate = evaluateCheckoutGate(leadPack, latestApplication);
      const pendingVerification = paymentSubmitted || returnState.payment === "success" || latest?.paymentStatus === "Pending Verification";

      el.heroTitle.textContent = `Hello, ${user.fullName || "Student"}`;
      el.heroText.textContent = itemCount
        ? (!checkoutGate.ready
            ? `You can still pay now. Kagie will follow up on ${checkoutGate.missing.join(", ")} while your application keeps moving.`
            : pricing.discount > 0
              ? `Your promo is active. Pay ${money(pricing.total)} and Kagie will track the rest.`
              : "Check your order, pay, and Kagie will track the rest.")
        : pendingVerification
          ? "Your payment was submitted. Kagie is checking it now."
          : "There is nothing to pay for yet. Add a package or service first.";
      el.totalMeta.textContent = pricing.discount > 0 ? `${money(pricing.total)} after discount` : `${money(pricing.total)} total`;
      el.itemMeta.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
      el.statusMeta.textContent = pendingVerification ? "Pending Verification" : (latest?.paymentStatus || "Awaiting payment");

      el.payerName.value = firstNonEmpty(el.payerName.value, user.fullName);
      el.payerPhone.value = firstNonEmpty(el.payerPhone.value, user.phone);
      const returnMessage = renderReturnMessage();
      const noticeMessage = returnMessage
        ? esc(returnMessage)
        : !checkoutGate.ready && itemCount
            ? `Payment is still open even though ${esc(checkoutGate.missing.join(", "))} ${checkoutGate.missing.length === 1 ? "is" : "are"} still missing. Kagie assistants will see the gaps, contact the learner, and continue the application manually if needed.`
            : pendingVerification
              ? `Payment submitted successfully. Kagie is waiting for secure confirmation. <a class="proof-link" href="home.html">Open Kagie home</a>`
              : latest?.paymentStatus === "Rejected"
                ? `Your previous proof of payment was rejected${latest?.payment?.rejectionReason ? `: ${esc(latest.payment.rejectionReason)}` : ""}. Upload a clearer proof before confirming again.`
                : esc(merchantDetails.verificationMessage);
      setPaymentNotice(noticeMessage, true);

      const checkoutReady = Boolean(merchantDetails.yocoEnabled && merchantDetails.yocoCheckoutEndpoint);
      const yocoAvailable = checkoutReady;
      const yocoOption = el.method.querySelector('option[value="Yoco Checkout"]');
      if (yocoOption && !yocoAvailable) {
        yocoOption.disabled = true;
      } else if (yocoOption && yocoAvailable && !isYocoMethod(el.method.value)) {
        el.method.value = "Yoco Checkout";
      }
      if (!yocoAvailable) {
        setPaymentNotice(
          "Instant online payment is not configured yet on this Kagie site."
        );
      } else if (checkoutReady && !returnMessage) {
        setPaymentNotice(
          `Kagie will create a secure Yoco checkout for ${esc(money(pricing.total))}. Yoco will confirm the payment directly to Kagie after checkout.`,
          true
        );
      }

      const summaryBlocks = [];

      if (leadPack) {
        summaryBlocks.push(`
          <div class="item highlight">
            <div class="item-top">
              <span class="tag red">Application pack</span>
              <strong>${esc(leadPack.packName || leadPack.name || "Selected pack")}</strong>
            </div>
            <p>Pack price: ${esc(money(leadPack.packPrice || leadPack.price || 0))}<br>Institution limit: ${esc(leadPack.institutionLimit === "unlimited" ? "Unlimited" : leadPack.institutionLimit || 0)}<br>Institutions selected: ${esc(leadPack.institutions?.length || leadPack.institutionCount || 0)}</p>
          </div>
        `);
      }

      services.forEach((item) => {
        summaryBlocks.push(`
          <div class="item">
            <div class="item-top">
              <span class="tag blue">Support service</span>
              <strong>${esc(item.serviceName || item.name || "Service")}</strong>
            </div>
            <p>Price: ${esc(money(item.price || 0))}<br>Service code: ${esc(item.serviceCode || item.refId || "-")}</p>
          </div>
        `);
      });

      others.forEach((item) => {
        summaryBlocks.push(`
          <div class="item">
            <div class="item-top">
              <span class="tag gold">${esc(item.type || "Cart item")}</span>
              <strong>${esc(item.name || item.packName || item.serviceName || "Saved item")}</strong>
            </div>
            <p>Price: ${esc(money(item.price || item.packPrice || 0))}</p>
          </div>
        `);
      });

      promos.forEach((item) => {
        summaryBlocks.push(`
          <div class="item highlight">
            <div class="item-top">
              <span class="tag blue">Promo or referral</span>
              <strong>${esc(item.promoTitle || item.title || item.name || item.promoCode || "Promo code")}</strong>
            </div>
            <p>Code: ${esc(item.promoCode || "-")}<br>Discount: -${esc(money(Math.abs(Number(item.price || 0))))}${item.offerNote ? `<br>${esc(item.offerNote)}` : ""}</p>
          </div>
        `);
      });

      el.summary.innerHTML = summaryBlocks.length
        ? summaryBlocks.join("")
        : `<div class="empty">Your cart is empty. Go back and add a package or service first.</div>`;

      el.pricingSummary.innerHTML = `
        <div class="item-top">
          <span class="tag blue">Payment total</span>
          <strong>${pricing.discount > 0 ? `${money(pricing.total)} to pay` : `${money(pricing.total)} total`}</strong>
        </div>
        <p>Subtotal: ${esc(money(pricing.subtotal))}<br>${pricing.discount > 0 ? `Discount: -${esc(money(pricing.discount))}<br>` : ""}Final total: ${esc(money(pricing.total))}${pricing.promo ? `<br>Active code: ${esc(pricing.promo.code)}${pricing.promo.offerNote ? ` | ${esc(pricing.promo.offerNote)}` : ""}` : ""}</p>
      `;

      const checklist = [
        `${packs.length ? "Package ready" : "No package in cart yet"}`,
        `${checkoutGate.checks?.learner ? "Learner details saved" : "Learner details can be completed later"}`,
        `${checkoutGate.checks?.parent ? "Parent details saved" : "Parent details can be completed later"}`,
        `${checkoutGate.checks?.school ? "School details saved" : "School details can be completed later"}`,
        `${checkoutGate.checks?.marks ? "Marks saved" : "Marks can be completed later"}`,
        `${institutionsCount} institution${institutionsCount === 1 ? "" : "s"} linked${checkoutGate.checks?.institutions ? "" : " | more can be added later"}`,
        `${services.length} paid service${services.length === 1 ? "" : "s"} included`,
        pricing.promo ? `Promo ${pricing.promo.code} is active on this order` : "No promo code applied",
        "Use the same payment reference everywhere",
        !checkoutGate.ready
          ? "Kagie assistants will still see the missing sections after payment"
        : latest?.paymentStatus === "Rejected"
          ? "Your last payment attempt was rejected, so retry Yoco checkout"
          : "Yoco will confirm payment directly to Kagie"
      ];

      el.orderChecklist.innerHTML = checklist.map((item) => `<div class="check-item">${esc(item)}</div>`).join("");
      syncMethodPanel();
      syncPayBanner(Boolean(itemCount));
      syncButton(Boolean(itemCount));
    }

    el.method.addEventListener("change", syncMethodPanel);
    if (el.reference) {
      el.reference.addEventListener("input", () => {
        syncPayBanner(currentPricingTotal > 0);
      });
    }

    el.confirmBtn.addEventListener("click", async () => {
      const cart = await getItems();
      if (!cart.length || submitting) return;
      const hasItems = Boolean(cart.length);

      const method = el.method.value;
      const usingYoco = isYocoMethod(method);
      let slowTimer = 0;

      try {
        submitting = true;
        syncButton(true);
        slowTimer = window.setTimeout(() => {
          setPaymentNotice("Still creating your secure checkout, please wait...");
        }, 3200);

        if (!usingYoco) {
          setPaymentNotice("Kagie currently supports instant online payment through Yoco only.");
          return;
        }

        const payerName = el.payerName.value.trim();
        const phone = el.payerPhone.value.trim();
        const reference = el.reference.value.trim();
        const note = $("note").value.trim();

        if (!payerName || !phone || !reference) {
          setPaymentNotice("Enter payer name, phone number, and the payment reference before starting Yoco checkout.");
          return;
        }

        if (!el.confirmCheck.checked) {
          setPaymentNotice("Please confirm that Kagie may redirect you to Yoco secure checkout.");
          return;
        }

        if (!merchantDetails.yocoEnabled || !merchantDetails.yocoCheckoutEndpoint) {
          throw new Error("Yoco checkout is not configured on this Kagie site yet.");
        }

        setPaymentNotice("Creating your secure Yoco checkout. Please wait...");
        const checkout = await startYocoCheckout({
          payerName,
          phone,
          reference,
          note,
          successUrl: buildCheckoutReturnUrl("success"),
          cancelUrl: buildCheckoutReturnUrl("cancel"),
          failureUrl: buildCheckoutReturnUrl("failed")
        });

        if (!checkout?.redirectUrl) {
          throw new Error("Yoco did not return a checkout redirect URL.");
        }

        paymentSubmitted = true;
        window.location.assign(checkout.redirectUrl);

      } catch (error) {
        console.error(error);
        setPaymentNotice(describeCheckoutError(error));
      } finally {
        if (slowTimer) window.clearTimeout(slowTimer);
        submitting = false;
        syncButton(hasItems);
      }
    });

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
