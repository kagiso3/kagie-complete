(function () {
  window.KagieCheckoutPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const money = (v) => `R${Number(v || 0).toLocaleString("en-ZA")}`;

  const METHOD_GUIDES = {
    EFT: {
      title: "EFT payment",
      lines: [
        "Use the Kagie payment reference exactly as shown below.",
        "Complete your transfer from your banking app or online banking profile.",
        "After payment, keep your proof of payment ready for upload if Kagie asks for it."
      ]
    },
    "Cash Deposit": {
      title: "Cash deposit",
      lines: [
        "Deposit the exact amount using Kagie's official banking details.",
        "Enter the deposit slip or reference number in the payment reference field.",
        "Upload your proof of payment afterwards so verification can happen faster."
      ]
    },
    "Card Transfer": {
      title: "Card or branch transfer",
      lines: [
        "Use the account details supplied by Kagie and keep the bank confirmation message.",
        "Enter the bank reference, card transfer reference, or terminal reference below.",
        "Kagie will mark the payment as pending verification until the record is checked."
      ]
    },
    "Mobile Payment": {
      title: "Mobile payment",
      lines: [
        "Pay from your mobile banking or instant transfer app using the Kagie reference.",
        "Enter the transfer reference exactly as it appears in your banking confirmation.",
        "If you receive a screenshot or proof, upload it from the documents page afterwards."
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
        "Payments are verified manually after checkout."
      ),
      supportPhone: firstNonEmpty(settings?.supportPhone),
      supportEmail: firstNonEmpty(settings?.supportEmail)
    };
  }

  function splitCart(cart) {
    const packs = cart.filter((item) => item.type === "application_pack");
    const services = cart.filter((item) => item.type === "service" || item.type === "service_request");
    const others = cart.filter((item) => !packs.includes(item) && !services.includes(item));
    const institutionsCount = packs.reduce((sum, item) => sum + Number(item.institutionCount || item.institutions?.length || 0), 0);
    return {
      packs,
      services,
      others,
      institutionsCount
    };
  }

  function renderMethodGuide(method) {
    const guide = METHOD_GUIDES[method] || METHOD_GUIDES.EFT;
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

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const settings = api.getSettings ? api.getSettings() : {};
    const merchantDetails = getMerchantDetails(settings);
    const getItems = () => api.getCartAsync ? api.getCartAsync(user.id) : Promise.resolve(api.getCart(user.id) || []);
    const getTotal = () => api.getCartTotalAsync ? api.getCartTotalAsync(user.id) : Promise.resolve(api.getCartTotal(user.id));
    const getLatestApplication = () => api.getLatestApplicationAsync ? api.getLatestApplicationAsync(user.id) : Promise.resolve(api.getLatestApplication(user.id));

    const el = {
      heroTitle: $("heroTitle"),
      heroText: $("heroText"),
      totalMeta: $("totalMeta"),
      itemMeta: $("itemMeta"),
      statusMeta: $("statusMeta"),
      summary: $("summary"),
      orderChecklist: $("orderChecklist"),
      payerName: $("payerName"),
      payerPhone: $("payerPhone"),
      reference: $("reference"),
      referenceHint: $("referenceHint"),
      method: $("method"),
      methodGuide: $("methodGuide"),
      bankingPanel: $("bankingPanel"),
      supportLine: $("supportLine"),
      confirmCheck: $("confirmCheck"),
      paymentNotice: $("paymentNotice"),
      confirmBtn: $("confirmBtn")
    };

    let latestApplication = null;
    let submitting = false;

    function syncReferenceHint() {
      const suggestedReference = buildSuggestedReference(user, latestApplication, settings);
      el.referenceHint.textContent = `Suggested reference: ${suggestedReference}`;
      if (!el.reference.value.trim()) {
        el.reference.value = suggestedReference;
      }
    }

    function syncMethodPanel() {
      el.methodGuide.innerHTML = renderMethodGuide(el.method.value);
      el.bankingPanel.innerHTML = renderBankingPanel(merchantDetails);
      el.supportLine.textContent = merchantDetails.verificationMessage;
      syncReferenceHint();
    }

    function syncButton(hasCartItems) {
      el.confirmBtn.disabled = !hasCartItems || submitting;
      el.confirmBtn.textContent = submitting ? "Submitting payment..." : "Confirm payment";
      el.confirmBtn.style.opacity = !hasCartItems || submitting ? ".7" : "1";
    }

    async function render() {
      const [cart, total, latest] = await Promise.all([
        getItems(),
        getTotal(),
        getLatestApplication().catch(() => null)
      ]);

      latestApplication = latest || latestApplication;

      const { packs, services, others, institutionsCount } = splitCart(cart);
      const itemCount = cart.length;
      const leadPack = packs[0] || null;

      el.heroTitle.textContent = `Hello, ${user.fullName || "Student"}`;
      el.heroText.textContent = itemCount
        ? "Review your order, use the correct payment reference, then confirm so Kagie can start verification."
        : "There are no items ready for payment yet. Add a pack or service first.";
      el.totalMeta.textContent = `${money(total)} total`;
      el.itemMeta.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
      el.statusMeta.textContent = latest?.paymentStatus || "Awaiting payment";

      el.payerName.value = firstNonEmpty(el.payerName.value, user.fullName);
      el.payerPhone.value = firstNonEmpty(el.payerPhone.value, user.phone);
      el.paymentNotice.textContent = merchantDetails.verificationMessage;

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

      el.summary.innerHTML = summaryBlocks.length
        ? summaryBlocks.join("")
        : `<div class="empty">Your cart is empty. Go back to Forms or More Service to add something before paying.</div>`;

      const checklist = [
        `${packs.length ? "Application pack ready" : "No application pack in cart yet"}`,
        `${institutionsCount} institution${institutionsCount === 1 ? "" : "s"} linked to this checkout`,
        `${services.length} paid service${services.length === 1 ? "" : "s"} included`,
        "Use the same payment reference in your bank transfer and in Kagie",
        "Upload proof of payment later from Upload Documents if Kagie requests it"
      ];

      el.orderChecklist.innerHTML = checklist.map((item) => `<div class="check-item">${esc(item)}</div>`).join("");
      syncMethodPanel();
      syncButton(Boolean(itemCount));
    }

    el.method.addEventListener("change", syncMethodPanel);

    el.confirmBtn.addEventListener("click", async () => {
      const cart = await getItems();
      if (!cart.length || submitting) return;

      const payerName = el.payerName.value.trim();
      const phone = el.payerPhone.value.trim();
      const reference = el.reference.value.trim();
      const method = el.method.value;
      const note = [el.paymentNotice.textContent.trim(), $("note").value.trim()].filter(Boolean).join("\n\n");

      if (!payerName || !phone || !reference) {
        alert("Enter payer name, phone number, and payment reference before confirming payment.");
        return;
      }

      if (!el.confirmCheck.checked) {
        alert("Please confirm that you used the correct Kagie payment reference.");
        return;
      }

      try {
        submitting = true;
        syncButton(true);

        const updated = api.submitApplicationFromCartAsync
          ? await api.submitApplicationFromCartAsync({ payerName, phone, reference, method, note })
          : api.submitApplicationFromCart({ payerName, phone, reference, method, note });

        alert(`Payment submitted successfully. Application status: ${updated.status}. Payment status: ${updated.paymentStatus}.`);
        window.location.href = "Dashboard.html";
      } catch (error) {
        alert(error.message || "Kagie could not submit your payment right now.");
      } finally {
        submitting = false;
        syncButton(Boolean((await getItems()).length));
      }
    });

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load checkout.");
      window.location.href = "login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
