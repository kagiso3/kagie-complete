(function () {
  window.KagieCartPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
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
  const money = (value) => `ZAR ${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const PACK_RECOVERY_TOMBSTONE_PREFIX = "kagie_pack_recovery_tombstone_";
  const packRecoveryStorageKey = (userId) => {
    const userKey = String(userId || "learner").replace(/[^a-z0-9_-]/gi, "").slice(-48) || "learner";
    return `${PACK_RECOVERY_TOMBSTONE_PREFIX}${userKey}`;
  };
  const packRecoveryDescriptor = (source) => {
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
  };
  const suppressPackRecovery = (userId, source) => {
    const descriptor = packRecoveryDescriptor(source);
    if (!descriptor) return false;
    try {
      window.localStorage?.setItem(packRecoveryStorageKey(userId), JSON.stringify({
        ...descriptor,
        removedAt: new Date().toISOString()
      }));
      return true;
    } catch (_error) {
      return false;
    }
  };
  const isPackRecoverySuppressed = (userId, application) => {
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
  };
  const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof"];
  const GENDERS = ["Male", "Female", "Other"];
  const PASSENGER_TYPES = {
    adult: { label: "Adult", copy: "12 years and older", student: false },
    senior: { label: "Senior", copy: "Older than 60 years", student: false },
    child: { label: "Child", copy: "Younger than 12 years", student: false },
    student: { label: "Student", copy: "Registered student details are required", student: true },
    sapsandf: { label: "SAPSANDF", copy: "Official SAPS or SANDF details are required", student: false }
  };

  const isServiceItem = (item) => {
    const type = String(item?.type || "").trim().toLowerCase();
    if (type === "service" || type === "service_request") return true;
    return Boolean(item?.serviceCode || item?.serviceName);
  };
  const isTransportItem = (item) => String(item?.serviceCode || "").trim().toLowerCase() === "transport_assist" || Boolean(item?.transportDetails);
  const splitCart = (cart) => {
    const promos = cart.filter((item) => Boolean(item?.isPromoDiscount || item?.promoCode));
    const packs = cart.filter((item) => String(item?.type || "").trim().toLowerCase() === "application_pack");
    const services = cart.filter((item) => !packs.includes(item) && !promos.includes(item) && isServiceItem(item));
    const others = cart.filter((item) => !packs.includes(item) && !services.includes(item) && !promos.includes(item));
    return { packs, services, others, promos };
  };

  const evaluateCheckoutGate = (pack, latestApplication) => {
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
    return {
      ready: Object.values(checks).every(Boolean),
      missing: Object.keys(checks).filter((key) => !checks[key]).map((key) => labels[key])
    };
  };

  const normalizePassengerType = (value) => {
    const key = String(value || "").trim().toLowerCase();
    if (["adult", "adults"].includes(key)) return "adult";
    if (["senior", "seniors"].includes(key)) return "senior";
    if (["child", "children"].includes(key)) return "child";
    if (["student", "students"].includes(key)) return "student";
    if (["sapsandf", "saps", "sandf"].includes(key)) return "sapsandf";
    return "adult";
  };
  const passengerMeta = (type) => PASSENGER_TYPES[normalizePassengerType(type)] || PASSENGER_TYPES.adult;
  const defaultPassenger = (type, sequence) => ({
    type: normalizePassengerType(type),
    sequence,
    title: "",
    firstName: "",
    surname: "",
    mobile: "",
    emergencyContact: "",
    idType: "SA ID",
    idNumber: "",
    dateOfBirth: "",
    gender: "",
    withBaby: false,
    institutionName: "",
    studentNumber: ""
  });
  const deriveSouthAfricanIdMeta = (idNumber) => {
    const digits = String(idNumber || "").replace(/\D/g, "");
    if (digits.length !== 13) return null;
    const yearShort = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const day = Number(digits.slice(4, 6));
    if (!yearShort && yearShort !== 0) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const currentYear = new Date().getFullYear() % 100;
    const year = yearShort <= currentYear ? 2000 + yearShort : 1900 + yearShort;
    const serial = Number(digits.slice(6, 10));
    return {
      dateOfBirth: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      gender: serial >= 5000 ? "Male" : "Female"
    };
  };
  const parsePassengerManifest = (mixText, fallbackCount) => {
    const entries = [];
    String(mixText || "").split(/[,;]+/).forEach((part) => {
      const match = part.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) return;
      const count = Number(match[1] || 0);
      const type = normalizePassengerType(match[2]);
      for (let index = 0; index < count; index += 1) entries.push({ type });
    });
    if (entries.length) return entries;
    const count = Math.max(1, Number(fallbackCount || 1));
    return Array.from({ length: count }, () => ({ type: "adult" }));
  };
  const buildTransportDraft = (item) => {
    const source = Array.isArray(item?.passengerDetails) && item.passengerDetails.length
      ? item.passengerDetails
      : (Array.isArray(item?.transportDetails?.passengerDetails) ? item.transportDetails.passengerDetails : []);
    const manifest = source.length
      ? source.map((entry) => ({ type: normalizePassengerType(entry?.type) }))
      : parsePassengerManifest(
          item?.passengerMix || item?.transportDetails?.passengerMix,
          item?.passengers || item?.transportDetails?.passengerCount || 1
        );
    return manifest.map((entry, index) => ({
      ...defaultPassenger(entry.type, index + 1),
      ...(source[index] || {}),
      type: normalizePassengerType(source[index]?.type || entry.type),
      sequence: index + 1,
      withBaby: Boolean(source[index]?.withBaby)
    }));
  };
  const transportDraftSignature = (draft) => JSON.stringify(
    (draft || []).map((entry) => ({
      type: normalizePassengerType(entry.type),
      title: String(entry.title || "").trim(),
      firstName: String(entry.firstName || "").trim(),
      surname: String(entry.surname || "").trim(),
      mobile: String(entry.mobile || "").trim(),
      emergencyContact: String(entry.emergencyContact || "").trim(),
      idType: String(entry.idType || "SA ID").trim(),
      idNumber: String(entry.idNumber || "").trim(),
      dateOfBirth: String(entry.dateOfBirth || "").trim(),
      gender: String(entry.gender || "").trim(),
      withBaby: Boolean(entry.withBaby),
      institutionName: String(entry.institutionName || "").trim(),
      studentNumber: String(entry.studentNumber || "").trim()
    }))
  );
  const transportMixLabel = (draft) => {
    const counts = {};
    (draft || []).forEach((entry) => {
      const key = normalizePassengerType(entry.type);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).map((key) => `${counts[key]} ${passengerMeta(key).label}`).join(", ") || "1 Adult";
  };
  const validateTransportDraft = (draft) => {
    for (let index = 0; index < (draft || []).length; index += 1) {
      const entry = draft[index];
      const required = [
        ["title", "title"],
        ["firstName", "name"],
        ["surname", "surname"],
        ["mobile", "mobile number"],
        ["emergencyContact", "emergency number"],
        ["idType", "identification type"],
        ["idNumber", entry?.idType === "Passport" ? "passport number" : "SA ID number"],
        ["dateOfBirth", "date of birth"],
        ["gender", "gender"]
      ];
      for (const [field, label] of required) {
        if (!String(entry?.[field] || "").trim()) return `Passenger ${index + 1} still needs ${label}.`;
      }
      if (passengerMeta(entry.type).student) {
        if (!String(entry?.institutionName || "").trim()) return `Passenger ${index + 1} still needs the institution name.`;
        if (!String(entry?.studentNumber || "").trim()) return `Passenger ${index + 1} still needs the student number.`;
      }
    }
    return "";
  };
  const buildTransportNote = (draft) => {
    const students = (draft || []).filter((entry) => passengerMeta(entry.type).student);
    if (!students.length) return `Passenger details captured for ${transportMixLabel(draft)}.`;
    return `Passenger details captured. Student travellers: ${students.map((entry) => `${entry.firstName || "Student"} ${entry.surname || ""} | ${entry.institutionName || "Institution"} | ${entry.studentNumber || "Student number"}`).join(" ; ")}.`;
  };
  const routeCode = (item) => String(
    item?.transportDetails?.routeId ||
    item?.id ||
    item?.serviceCode ||
    "transport"
  ).replace(/^trans_/, "#").toUpperCase();

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
    const state = {
      transportItem: null,
      transportDraft: [],
      transportItemId: "",
      transportSavedSignature: "",
      transportDirty: false,
      transportMessage: "",
      transportTone: "",
      cartRecoveryMessage: "",
      cartItems: [],
      billableCount: 0,
      payableTotal: 0
    };
    async function runCartAction(button, key, busyText, task) {
      const run = async () => {
        try { return await task(); }
        catch (error) {
          console.warn("Kagie cart action failed:", error);
          const hint = $("cartHint");
          if (hint) hint.textContent = `Kagie could not finish this action: ${error.message || "Please try again."}`;
          return null;
        }
      };
      const ux = window.KagieUX;
      if (ux?.withButtonLock) {
        return ux.withButtonLock(button, key, busyText, run);
      }
      if (button?.dataset?.kagieBusy === "1") return null;
      const originalText = button?.textContent || "";
      const originalHTML = button?.innerHTML || "";
      if (button) {
        button.dataset.kagieBusy = "1";
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (busyText) button.textContent = busyText;
      }
      try {
        return await run();
      } finally {
        if (button?.isConnected) {
          delete button.dataset.kagieBusy;
          button.disabled = false;
          button.removeAttribute("aria-busy");
          if (busyText) {
            if (originalHTML) button.innerHTML = originalHTML;
            else button.textContent = originalText;
          }
        }
      }
    }

    const transportSummaryMarkup = (item, draft) => {
      const from = item?.departureCity || item?.transportDetails?.departureCity || "Departure";
      const to = item?.destinationCity || item?.transportDetails?.destinationCity || "Destination";
      const departureTime = item?.departureTime || item?.transportDetails?.departureTime || "TBC";
      const arrivalTime = item?.arrivalTime || item?.transportDetails?.arrivalTime || "TBC";
      const travelDate = item?.travelDate || item?.transportDetails?.travelDate || "Travel date pending";
      const tripType = item?.tripType || item?.transportDetails?.tripType || "One Way";
      const duration = item?.transportDetails?.duration || "Travel time pending";
      const company = item?.company || item?.transportDetails?.company || "Kagie transport";
      return `
        <div class="transport-summary-head">
          <div>
            <span class="badge">Transport ticket</span>
            <strong>${esc(company)}</strong>
            <div class="bag-meta">Service ${esc(routeCode(item))}</div>
          </div>
          <div class="transport-price">${esc(money(item?.price || item?.transportDetails?.totalFare || 0))}</div>
        </div>
        <div class="transport-route">
          <div>
            <small>From</small>
            <strong>${esc(from)}</strong>
            <small>${esc(`${travelDate} | ${departureTime}`)}</small>
          </div>
          <div class="transport-arrow">&rarr;<span>${esc(duration)}</span></div>
          <div>
            <small>To</small>
            <strong>${esc(to)}</strong>
            <small>${esc(arrivalTime)}</small>
          </div>
        </div>
        <div class="transport-grid three">
          <div class="transport-mini">
            <div>
              <span class="transport-mini-label">Trip type</span>
              <strong class="transport-mini-value">${esc(tripType)}</strong>
            </div>
            <span class="badge warn">${esc(item?.returnDate ? "Return set" : "Direct")}</span>
          </div>
          <div class="transport-mini">
            <div>
              <span class="transport-mini-label">Passengers</span>
              <strong class="transport-mini-value">${esc(String(draft.length))}</strong>
            </div>
            <span class="badge good">${esc(transportMixLabel(draft))}</span>
          </div>
          <div class="transport-mini">
            <div>
              <span class="transport-mini-label">Payment</span>
              <strong class="transport-mini-value">Ready after save</strong>
            </div>
            <span class="badge">${esc(money(item?.price || item?.transportDetails?.totalFare || 0))}</span>
          </div>
        </div>
      `;
    };
    const transportPassengerMarkup = (entry, index) => {
      const meta = passengerMeta(entry.type);
      return `
        <article class="transport-passenger-card">
          <div class="transport-passenger-head">
            <div>
              <strong>Passenger ${index + 1}</strong>
              <span>${esc(meta.label)} | ${esc(meta.copy)}</span>
            </div>
            <span class="transport-pill">${esc(meta.label)}</span>
          </div>
          <div class="transport-grid three">
            <div class="transport-field">
              <label>Title *</label>
              <select class="transport-select" data-passenger-index="${index}" data-passenger-field="title">
                <option value="">Select a title</option>
                ${TITLES.map((option) => `<option value="${esc(option)}" ${entry.title === option ? "selected" : ""}>${esc(option)}</option>`).join("")}
              </select>
            </div>
            <div class="transport-field">
              <label>Name *</label>
              <input class="transport-input" data-passenger-index="${index}" data-passenger-field="firstName" value="${esc(entry.firstName)}" placeholder="Enter name" />
            </div>
            <div class="transport-field">
              <label>Surname *</label>
              <input class="transport-input" data-passenger-index="${index}" data-passenger-field="surname" value="${esc(entry.surname)}" placeholder="Enter surname" />
            </div>
          </div>
          <div class="transport-grid">
            <div class="transport-field">
              <label>Mobile number *</label>
              <input class="transport-input" data-passenger-index="${index}" data-passenger-field="mobile" value="${esc(entry.mobile)}" placeholder="ZA +27 Enter mobile number" />
            </div>
            <div class="transport-field">
              <label>Emergency number *</label>
              <input class="transport-input" data-passenger-index="${index}" data-passenger-field="emergencyContact" value="${esc(entry.emergencyContact)}" placeholder="ZA +27 Enter emergency number" />
            </div>
          </div>
          <div class="transport-field full">
            <label>Identification type *</label>
            <div class="transport-choice-row">
              <button class="transport-choice ${entry.idType === "SA ID" ? "active" : ""}" type="button" data-choice-index="${index}" data-choice-field="idType" data-choice-value="SA ID">SA ID</button>
              <button class="transport-choice ${entry.idType === "Passport" ? "active" : ""}" type="button" data-choice-index="${index}" data-choice-field="idType" data-choice-value="Passport">Passport</button>
            </div>
          </div>
          <div class="transport-grid">
            <div class="transport-field">
              <label>${esc(entry.idType === "Passport" ? "Passport number *" : "SA ID number *")}</label>
              <input class="transport-input" data-passenger-index="${index}" data-passenger-field="idNumber" value="${esc(entry.idNumber)}" placeholder="Enter document number" />
              <div class="transport-hint">${esc(entry.idType === "SA ID" ? "A valid South African ID can fill the date of birth and gender for you." : "Use the same passport details shown on the travel document.")}</div>
            </div>
            <div class="transport-field">
              <label>Date of birth *</label>
              <input class="transport-input" type="date" data-passenger-index="${index}" data-passenger-field="dateOfBirth" value="${esc(entry.dateOfBirth)}" />
              <div class="transport-hint">Check the date before saving.</div>
            </div>
          </div>
          <div class="transport-grid">
            <div class="transport-field">
              <label>Gender *</label>
              <div class="transport-choice-row">
                ${GENDERS.map((option) => `<button class="transport-choice ${entry.gender === option ? "active" : ""}" type="button" data-choice-index="${index}" data-choice-field="gender" data-choice-value="${esc(option)}">${esc(option)}</button>`).join("")}
              </div>
            </div>
            <div class="transport-field">
              <label>With baby</label>
              <div class="transport-switch">
                <span class="transport-switch-copy">Select yes if traveling with an infant.</span>
                <input type="checkbox" data-passenger-index="${index}" data-passenger-field="withBaby" ${entry.withBaby ? "checked" : ""} />
              </div>
            </div>
          </div>
          ${meta.student ? `
            <div class="transport-grid">
              <div class="transport-field">
                <label>Institution *</label>
                <input class="transport-input" data-passenger-index="${index}" data-passenger-field="institutionName" value="${esc(entry.institutionName)}" placeholder="Enter university or college" />
              </div>
              <div class="transport-field">
                <label>Student number *</label>
                <input class="transport-input" data-passenger-index="${index}" data-passenger-field="studentNumber" value="${esc(entry.studentNumber)}" placeholder="Enter student number" />
              </div>
            </div>
          ` : ""}
        </article>
      `;
    };

    const getItems = async () => {
      try {
        if (api.syncAppliedPromoCodeAsync) await api.syncAppliedPromoCodeAsync(user.id);
        else if (api.syncAppliedPromoCode) api.syncAppliedPromoCode(user.id);
        return api.getCartAsync ? await api.getCartAsync(user.id) : (api.getCart(user.id) || []);
      } catch (error) {
        console.warn("Kagie cart sync fallback:", error);
        return api.getCart(user.id) || [];
      }
    };
    const getTotal = async () => {
      try {
        return api.getCartTotalAsync ? await api.getCartTotalAsync(user.id) : api.getCartTotal(user.id);
      } catch (error) {
        console.warn("Kagie cart total fallback:", error);
        return api.getCartTotal(user.id);
      }
    };
    const getPricing = async (cart) => {
      try {
        if (Array.isArray(cart) && api.getCartPricingSummary) return api.getCartPricingSummary(user.id, cart);
        return api.getCartPricingSummaryAsync
          ? await api.getCartPricingSummaryAsync(user.id)
          : (api.getCartPricingSummary ? api.getCartPricingSummary(user.id, cart) : { subtotal: await getTotal(), discount: 0, total: await getTotal(), promo: null });
      } catch (error) {
        console.warn("Kagie promo summary fallback:", error);
        const total = await getTotal();
        return { subtotal: total, discount: 0, total, promo: null };
      }
    };
    const getLatestApplication = () => api.getLatestApplicationAsync ? api.getLatestApplicationAsync(user.id) : Promise.resolve(api.getLatestApplication(user.id));
    const applicationEditHref = (item, step, application) => {
      const applicationId = String(item.applicationId || item.application?.id || "").trim();
      const type = String(item.applicationType || item.formValues?.applicationType?.type
        || (applicationId === application?.id ? application.applicationType : "") || "undergraduate").trim().toLowerCase();
      const specialized = ["late", "transfer", "bridging", "postgraduate"].includes(type);
      const params = new URLSearchParams({step:specialized ? (type === "late" ? "late" : "dynamic") : step, applicationType:type});
      if (applicationId) params.set("applicationId", applicationId);
      if (specialized) params.set("section", step === "pack" ? "package" : "institutions");
      return `forms.html?${params.toString()}`;
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
    const buildRecoveredPackCartItem = async (application) => {
      if (!shouldRecoverPackFromApplication(application)) return null;
      const appPack = application.package || {};
      const catalogPack = await resolvePackFromCatalog(appPack);
      const packName = appPack.name || appPack.packName || catalogPack?.name || "Application Pack";
      if (!String(packName || "").trim()) return null;
      const institutions = Array.isArray(application.institutions) ? application.institutions : [];
      const learner = application.forms?.learner || {};
      const parent = application.forms?.parent || {};
      const school = application.forms?.school || {};
      const marks = Array.isArray(application.forms?.marks?.subjects) ? application.forms.marks.subjects : [];
      const institutionLimit = appPack.institutionLimit ?? catalogPack?.institutionLimit ?? 0;
      const price = Number(appPack.price ?? appPack.packPrice ?? catalogPack?.price ?? 0);
      return {
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
        institutionLimit,
        institutionCount: institutions.length,
        institutions,
        learner,
        parentData: parent,
        school,
        marks,
        syncState: "recovered"
      };
    };
    const recoverCartFromLatestApplication = async (application) => {
      const recovered = await buildRecoveredPackCartItem(application);
      if (!recovered) return null;
      try {
        if (api.replaceApplicationPackCartItemAsync) {
          const saved = await api.replaceApplicationPackCartItemAsync(recovered, user.id);
          state.cartRecoveryMessage = "We restored your selected package from your saved application draft.";
          return saved || recovered;
        }
      } catch (error) {
        console.warn("Kagie cart live recovery fallback:", error);
      }
      try {
        const existing = api.getCart ? (api.getCart(user.id) || []) : [];
        if (api.removeCartItem) {
          for (const entry of existing.filter((item) => item.type === "application_pack")) {
            api.removeCartItem(entry.id, user.id);
          }
        }
        if (api.addCartItem) {
          api.addCartItem({ ...recovered, syncState: "local_recovered" }, user.id);
          state.cartRecoveryMessage = "We restored your selected package from this device.";
          return { ...recovered, syncState: "local_recovered" };
        }
      } catch (error) {
        console.warn("Kagie cart local recovery failed:", error);
      }
      return null;
    };
    const syncTransportState = (item) => {
      if (!item) {
        state.transportItem = null;
        state.transportDraft = [];
        state.transportItemId = "";
        state.transportSavedSignature = "";
        state.transportDirty = false;
        state.transportMessage = "";
        state.transportTone = "";
        return;
      }
      const nextDraft = buildTransportDraft(item);
      const nextSignature = transportDraftSignature(nextDraft);
      const itemId = String(item.id || "");
      const shouldReplaceDraft = state.transportItemId !== itemId || !state.transportDirty;
      state.transportItem = item;
      if (shouldReplaceDraft) {
        state.transportDraft = nextDraft;
        state.transportSavedSignature = nextSignature;
        state.transportDirty = false;
        if (state.transportItemId !== itemId) {
          state.transportMessage = "";
          state.transportTone = "";
        }
      }
      state.transportItemId = itemId;
    };
    const transportBlockingMessage = () => {
      if (!state.transportItem) return "";
      const validation = validateTransportDraft(state.transportDraft);
      if (validation) return validation;
      if (state.transportDirty) return "Save the transport passenger details before you continue to payment.";
      return "";
    };
    const refreshTransportUI = (rerenderForms = true) => {
      const sheet = $("transportEditorSheet");
      const summary = $("transportTripSummary");
      const forms = $("transportCartForms");
      const notice = $("transportCartNotice");
      const saveBtn = $("transportSaveBtn");
      const checkoutBtn = $("checkoutBtn");
      if (sheet) {
        sheet.classList.toggle("transport-empty", !state.transportItem);
        sheet.classList.toggle("transport-ready", Boolean(state.transportItem));
      }
      if (summary && (rerenderForms || !summary.innerHTML)) {
        summary.innerHTML = state.transportItem ? transportSummaryMarkup(state.transportItem, state.transportDraft) : `
          <div class="t-input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BCC3D6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>No transport added yet.</span>
          </div>
        `;
      }
      if (forms && rerenderForms) {
        forms.innerHTML = state.transportItem ? state.transportDraft.map((entry, index) => transportPassengerMarkup(entry, index)).join("") : "";
      }
      const blocking = transportBlockingMessage();
      const noticeText = state.transportMessage || (state.transportItem ? (blocking || "Transport passenger details are saved and ready for payment.") : "");
      const noticeTone = state.transportMessage ? state.transportTone : (blocking ? "err" : "ok");
      if (notice) {
        notice.textContent = noticeText;
        notice.className = noticeTone ? `transport-note ${noticeTone}` : "transport-note";
      }
      if (saveBtn) {
        saveBtn.disabled = !state.transportItem;
        saveBtn.style.opacity = state.transportItem ? "1" : ".6";
      }
      if (checkoutBtn) {
        const enabled = Boolean(state.billableCount);
        const checkoutLabel = $("checkoutBtnLabel");
        const label = state.transportItem && blocking
          ? "Review transport details to continue"
          : enabled
            ? `Continue to pay ${money(state.payableTotal)}`
            : "Continue to Payment";
        checkoutBtn.disabled = !enabled;
        checkoutBtn.style.opacity = enabled ? "1" : ".6";
        if (checkoutLabel) checkoutLabel.textContent = label;
        else checkoutBtn.textContent = label;
      }
    };
    const updateDraftField = (target) => {
      const index = Number(target?.dataset?.passengerIndex);
      const field = String(target?.dataset?.passengerField || "").trim();
      if (!Number.isInteger(index) || index < 0 || !field || !state.transportDraft[index]) return;
      state.transportDraft[index][field] = target.type === "checkbox" ? Boolean(target.checked) : target.value;
      if (field === "idNumber" && state.transportDraft[index].idType === "SA ID") {
        const derived = deriveSouthAfricanIdMeta(target.value);
        if (derived) {
          state.transportDraft[index].dateOfBirth = derived.dateOfBirth;
          state.transportDraft[index].gender = state.transportDraft[index].gender || derived.gender;
          state.transportDirty = transportDraftSignature(state.transportDraft) !== state.transportSavedSignature;
          state.transportMessage = "";
          state.transportTone = "";
          refreshTransportUI(true);
          return;
        }
      }
      state.transportDirty = transportDraftSignature(state.transportDraft) !== state.transportSavedSignature;
      state.transportMessage = "";
      state.transportTone = "";
      refreshTransportUI(false);
    };
    const chooseDraftValue = (target) => {
      const index = Number(target?.dataset?.choiceIndex);
      const field = String(target?.dataset?.choiceField || "").trim();
      const value = String(target?.dataset?.choiceValue || "").trim();
      if (!Number.isInteger(index) || index < 0 || !field || !value || !state.transportDraft[index]) return;
      state.transportDraft[index][field] = value;
      if (field === "idType" && value === "SA ID") {
        const derived = deriveSouthAfricanIdMeta(state.transportDraft[index].idNumber);
        if (derived) {
          state.transportDraft[index].dateOfBirth = derived.dateOfBirth;
          state.transportDraft[index].gender = state.transportDraft[index].gender || derived.gender;
        }
      }
      state.transportDirty = transportDraftSignature(state.transportDraft) !== state.transportSavedSignature;
      state.transportMessage = "";
      state.transportTone = "";
      refreshTransportUI(true);
    };

    async function render() {
      let [cart, latestApplication] = await Promise.all([
        getItems(),
        getLatestApplication().catch(() => null)
      ]);
      state.cartRecoveryMessage = "";
      if (!hasBillableItems(cart)) {
        const recoveredItem = await recoverCartFromLatestApplication(latestApplication);
        if (recoveredItem) {
          cart = await getItems().catch(() => api.getCart(user.id) || [recoveredItem]);
          if (!hasBillableItems(cart)) cart = [recoveredItem];
        }
      }
      const { packs, services, others } = splitCart(cart);
      state.cartItems = Array.isArray(cart) ? cart.slice() : [];
      const transportItem = [...services, ...others].find(isTransportItem) || null;
      syncTransportState(transportItem);
      const billableItemCount = packs.length + services.length + others.length;
      state.billableCount = billableItemCount;
      const instCount = packs.reduce((sum, item) => sum + Number(item.institutionCount || item.institutions?.length || 0), 0);
      const pricing = await getPricing(cart);
      state.payableTotal = Number(pricing?.total || 0);
      const leadPack = packs[0] || null;
      const checkoutGate = evaluateCheckoutGate(leadPack, latestApplication);
      const transportGate = transportBlockingMessage();
      if ($("cartCountBadge")) $("cartCountBadge").textContent = String(billableItemCount);
      if ($("totalPayAmount")) $("totalPayAmount").textContent = money(pricing.total);
      if ($("totalPayNote")) {
        $("totalPayNote").textContent = billableItemCount
          ? (pricing.discount > 0 ? `Promo discount applied. Pay ${money(pricing.total)} now.` : "Ready when you are.")
          : "No items in your cart yet.";
      }

      $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
      $("heroText").textContent = billableItemCount
        ? (state.cartRecoveryMessage || (transportItem ? "Your route is in the cart. Finish the passenger details here, then continue to payment." : "Check your bag, confirm the total, then continue to payment."))
        : "Your cart is empty right now.";
      if ($("itemMeta")) $("itemMeta").textContent = `${billableItemCount} item${billableItemCount === 1 ? "" : "s"}`;
      if ($("instMeta")) $("instMeta").textContent = `${instCount} institution${instCount === 1 ? "" : "s"}`;
      if ($("totalMeta")) $("totalMeta").textContent = pricing.discount > 0 ? `${money(pricing.total)} after discount` : `${money(pricing.total)} total`;
      $("cartHint").textContent = state.cartRecoveryMessage || (!billableItemCount
        ? "Your cart is empty. Return to forms or transport and add something first."
        : transportGate
          ? "Finish the transport passenger details above before you continue to payment."
          : packs.length
            ? (checkoutGate.ready
                ? "Everything in your bag is ready. Continue to payment when you are ready."
                : `You can still pay now. Kagie will follow up on ${checkoutGate.missing.join(", ")} afterwards.`)
            : "Review the total, then continue to payment when you are ready.");
      $("promoSummary").innerHTML = pricing.promo
        ? `<strong>${esc(pricing.promo.code)}</strong> applied.<br>Subtotal: ${esc(money(pricing.subtotal))}<br>Discount: ${esc(money(pricing.discount))}<br>Pay now: <strong>${esc(money(pricing.total))}</strong>${pricing.promo.offerNote ? `<br>${esc(pricing.promo.offerNote)}` : ""}`
        : "No promo code applied yet.";

      const snapshot = [
        `<div class="summary-tile"><div class="row"><strong>Bag summary</strong><span class="badge">${esc(billableItemCount)}</span></div><p>${esc(`${packs.length} package${packs.length === 1 ? "" : "s"}, ${services.length} service${services.length === 1 ? "" : "s"}, ${others.length} extra item${others.length === 1 ? "" : "s"}`)}</p></div>`,
        transportItem ? `<div class="summary-tile"><div class="row"><strong>Transport</strong><span class="badge ${transportGate ? "warn" : "good"}">${esc(transportGate ? "Needs details" : "Ready")}</span></div><p>${esc(`${transportItem.departureCity || transportItem.transportDetails?.departureCity || "Departure"} to ${transportItem.destinationCity || transportItem.transportDetails?.destinationCity || "Destination"} - ${transportMixLabel(state.transportDraft)}`)}</p></div>` : "",
        `<div class="summary-tile"><div class="row"><strong>Package status</strong><span class="badge ${packs.length ? "good" : "warn"}">${esc(packs.length ? "In cart" : "Pending")}</span></div><p>${esc(packs.length ? "Your selected package is already sitting in the cart." : "Choose a package first to continue.")}</p></div>`,
        `<div class="summary-tile"><div class="row"><strong>Follow-up</strong><span class="badge ${checkoutGate.ready ? "good" : ""}">${esc(checkoutGate.ready ? "Ready" : `${checkoutGate.missing.length} missing`)}</span></div><p>${esc(checkoutGate.ready ? "Your draft is already in a good state." : `Kagie assistants will follow up on ${checkoutGate.missing.join(", ")} after payment.`)}</p></div>`
      ].filter(Boolean);
      $("billSnapshot").innerHTML = snapshot.join("");

      const html = [];
      packs.forEach((item) => {
        const limitLabel = item.institutionLimit === "unlimited" ? "Unlimited" : item.institutionLimit || 0;
        const usedCount = Number(item.institutionCount || item.institutions?.length || 0);
        const remainingCount = item.institutionLimit === "unlimited" ? "Unlimited" : Math.max(0, Number(item.institutionLimit || 0) - usedCount);
        const institutions = Array.isArray(item.institutions) ? item.institutions : [];
        html.push(`
          <div class="item">
            <div class="row">
              <div class="bag-main">
                <span class="badge">Application package</span>
                <strong>${esc(item.packName || item.name || "Application Pack")}</strong>
                <div class="bag-meta">${esc(money(item.packPrice || item.price))} - Limit ${esc(limitLabel)} - ${esc(usedCount)} added - ${esc(remainingCount)} left</div>
              </div>
              <div class="bag-price">${esc(money(item.packPrice || item.price))}</div>
            </div>
            <div class="helper-note">${esc(institutions.length ? `${usedCount} institution choice${usedCount === 1 ? "" : "s"} are linked in your draft.` : "No institutions are linked yet. You can still add them later from the forms step.")}</div>
            <div class="footer">
              <a class="mini gold" href="${esc(applicationEditHref(item, "pack", latestApplication))}">Change package</a>
              <a class="mini" href="${esc(applicationEditHref(item, "apply", latestApplication))}">Edit institutions</a>
            </div>
            <div class="footer wide">
              <button class="mini red" data-remove="${esc(item.id)}" type="button">Remove package</button>
            </div>
          </div>
        `);
      });
      services.forEach((item) => {
        if (isTransportItem(item)) {
          html.push(`
            <div class="item">
              <div class="row">
                <div class="bag-main">
                  <span class="badge ${transportGate ? "warn" : "good"}">Transport</span>
                  <strong>${esc(item.serviceName || item.name || "Transport ticket")}</strong>
                  <div class="bag-meta">${esc(`${item.departureCity || item.transportDetails?.departureCity || "Departure"} to ${item.destinationCity || item.transportDetails?.destinationCity || "Destination"} - ${item.travelDate || item.transportDetails?.travelDate || "Travel date pending"}`)}</div>
                  <div class="helper-note">${esc(transportGate || `Passenger mix: ${transportMixLabel(state.transportDraft)}`)}</div>
                </div>
                <div class="bag-price">${esc(money(item.price || item.transportDetails?.totalFare || 0))}</div>
              </div>
              <div class="footer">
                <button class="mini gold" data-focus-transport="1" type="button">Edit details</button>
                <a class="mini" href="more-service/transport-assist.html">Change route</a>
              </div>
              <div class="footer wide">
                <button class="mini red" data-remove="${esc(item.id)}" type="button">Remove transport</button>
              </div>
            </div>
          `);
          return;
        }
        html.push(`
          <div class="item">
            <div class="row">
              <div class="bag-main">
                <span class="badge">Support service</span>
                <strong>${esc(item.serviceName || item.name || "Service")}</strong>
                <div class="bag-meta">${esc(item.serviceCode || "Kagie service")} - ${esc(money(item.price))}</div>
              </div>
              <div class="bag-price">${esc(money(item.price))}</div>
            </div>
            <div class="footer wide">
              <button class="mini red" data-remove="${esc(item.id)}" type="button">Remove service</button>
            </div>
          </div>
        `);
      });
      others.forEach((item) => html.push(`
        <div class="item">
          <div class="row">
            <div class="bag-main">
              <span class="badge">Saved item</span>
              <strong>${esc(item.name || item.packName || item.serviceName || "Kagie item")}</strong>
              <div class="bag-meta">${esc(item.type || "custom")} - ${esc(money(item.price || item.packPrice || 0))}</div>
            </div>
            <div class="bag-price">${esc(money(item.price || item.packPrice || 0))}</div>
          </div>
          <div class="footer wide">
            <button class="mini red" data-remove="${esc(item.id)}" type="button">Remove item</button>
          </div>
        </div>
      `));
      if (pricing.promo) {
        html.push(`
          <div class="item">
            <div class="row">
              <div class="bag-main">
                <span class="badge good">Promo applied</span>
                <strong>${esc(pricing.promo.code)}</strong>
                <div class="bag-meta">Subtotal ${esc(money(pricing.subtotal))} - Discount -${esc(money(pricing.discount))} - Total ${esc(money(pricing.total))}</div>
              </div>
              <div class="bag-price">-${esc(money(pricing.discount))}</div>
            </div>
            <div class="footer wide">
              <button class="mini red" id="promoInlineClear" type="button">Remove code</button>
            </div>
          </div>
        `);
      }

      $("list").innerHTML = html.length ? html.join("") : `
        <div class="empty-bag">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fd0505" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
            <path d="M9 11c0 1.66 1.34 3 3 3s3-1.34 3-3"/>
          </svg>
          <div class="empty-bag-title">Your cart is empty.</div>
          <div class="empty-bag-sub">Add a package or service first.</div>
        </div>
      `;
      $("clearCartBtn").disabled = !billableItemCount;
      $("clearCartBtn").style.opacity = billableItemCount ? "1" : ".6";
      refreshTransportUI();
    }

    $("list").addEventListener("click", async (event) => {
      if (event.target.id === "promoInlineClear") {
        await runCartAction(event.target, "promo-inline-clear", "Clearing...", async () => {
          if (api.clearAppliedPromoCodeAsync) await api.clearAppliedPromoCodeAsync(user.id);
          else if (api.clearAppliedPromoCode) api.clearAppliedPromoCode(user.id);
          await render();
        });
        return;
      }
      const focusTransport = event.target.getAttribute("data-focus-transport");
      if (focusTransport) {
        $("transportEditorSheet")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const id = event.target.getAttribute("data-remove");
      if (!id) return;
      await runCartAction(event.target, `cart-remove:${id}`, "Removing...", async () => {
        const removedItem = state.cartItems.find((item) => String(item?.id || "") === String(id)) || null;
        if (api.removeCartItemAsync) await api.removeCartItemAsync(id, user.id);
        else api.removeCartItem(id, user.id);
        if (String(removedItem?.type || "").trim().toLowerCase() === "application_pack") {
          const suppressed = suppressPackRecovery(user.id, removedItem);
          if (!suppressed) {
            const latestApplication = await getLatestApplication().catch(() => null);
            suppressPackRecovery(user.id, latestApplication);
          }
        }
        await render();
      });
    });
    $("transportCartForms")?.addEventListener("input", (event) => {
      const field = event.target.closest("[data-passenger-field]");
      if (!field) return;
      updateDraftField(field);
    });
    $("transportCartForms")?.addEventListener("change", (event) => {
      const field = event.target.closest("[data-passenger-field]");
      if (!field) return;
      updateDraftField(field);
    });
    $("transportCartForms")?.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-choice-value]");
      if (!choice) return;
      chooseDraftValue(choice);
    });
    $("transportSaveBtn")?.addEventListener("click", (event) => runCartAction(event.currentTarget, "transport-save", "Saving...", async () => {
      if (!state.transportItem) return;
      const validation = validateTransportDraft(state.transportDraft);
      if (validation) {
        state.transportMessage = validation;
        state.transportTone = "err";
        refreshTransportUI();
        return;
      }
      const detailRows = state.transportDraft.map((entry) => ({ ...entry }));
      const patch = {
        passengers: String(detailRows.length),
        passengerMix: transportMixLabel(detailRows),
        passengerDetails: detailRows,
        note: buildTransportNote(detailRows),
        transportDetails: {
          ...(state.transportItem.transportDetails || {}),
          passengerCount: detailRows.length,
          passengerMix: transportMixLabel(detailRows),
          passengerDetails: detailRows,
          totalFare: Number(state.transportItem.price || state.transportItem.transportDetails?.totalFare || 0)
        }
      };
      try {
        if (api.updateCartItemAsync) await api.updateCartItemAsync(state.transportItem.id, patch, user.id);
        else api.updateCartItem(state.transportItem.id, patch, user.id);
        state.transportSavedSignature = transportDraftSignature(detailRows);
        state.transportDirty = false;
        state.transportMessage = "Transport details saved. You can continue to payment now.";
        state.transportTone = "ok";
        await render();
      } catch (error) {
        console.error(error);
        state.transportMessage = error.message || "Could not save the transport details right now.";
        state.transportTone = "err";
        refreshTransportUI();
      }
    }));
    $("applyPromoBtn").addEventListener("click", (event) => runCartAction(event.currentTarget, "promo-apply", "Applying...", async () => {
      const code = $("promoCodeInput").value.trim();
      if (!code) return;
      try {
        if (api.applyPromoCodeAsync) await api.applyPromoCodeAsync(code, user.id);
        else if (api.applyPromoCode) api.applyPromoCode(code, user.id);
        $("promoCodeInput").value = "";
        await render();
      } catch (error) {
        $("promoSummary").textContent = error.message || "Could not apply that promo code.";
      }
    }));
    $("clearPromoBtn").addEventListener("click", (event) => runCartAction(event.currentTarget, "promo-clear", "Clearing...", async () => {
      if (api.clearAppliedPromoCodeAsync) await api.clearAppliedPromoCodeAsync(user.id);
      else if (api.clearAppliedPromoCode) api.clearAppliedPromoCode(user.id);
      $("promoCodeInput").value = "";
      await render();
    }));
    $("checkoutBtn").addEventListener("click", (event) => runCartAction(event.currentTarget, "checkout-open", "Preparing...", async () => {
      let cart = await getItems();
      let { packs, services, others } = splitCart(cart);
      if (!(packs.length + services.length + others.length)) {
        const latestApplication = await getLatestApplication().catch(() => null);
        const recoveredItem = await recoverCartFromLatestApplication(latestApplication);
        if (recoveredItem) {
          cart = await getItems().catch(() => [recoveredItem]);
          ({ packs, services, others } = splitCart(cart));
          await render();
        }
      }
      if (!(packs.length + services.length + others.length)) return;
      if (transportBlockingMessage()) {
        state.transportMessage = transportBlockingMessage();
        state.transportTone = "err";
        refreshTransportUI();
        $("transportEditorSheet")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.location.href = "checkout.html";
    }));
    $("clearCartBtn").addEventListener("click", (event) => runCartAction(event.currentTarget, "cart-clear", "Clearing...", async () => {
      const cart = await getItems();
      const { packs, services, others } = splitCart(cart);
      if (!(packs.length + services.length + others.length)) return;
      if (!confirm("Clear every item from your cart and start again?")) return;
      const recoverySource = packs[0] || await getLatestApplication().catch(() => null);
      if (api.clearCartAsync) await api.clearCartAsync(user.id);
      else api.clearCart(user.id);
      suppressPackRecovery(user.id, recoverySource);
      await render();
    }));

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const api = window.KagieAPI;
      const current = api?.currentUser?.();
      if (!current) {
        window.location.href = "login.html";
        return;
      }
      if (normalizeRole(current.role) !== "user") {
        redirectByRole(current);
        return;
      }
      const list = $("list");
      if (list) list.innerHTML = `<div class="empty">We could not refresh your cart right now, but your saved items on this device are still safe. Refresh once and try again.</div>`;
      const heroText = $("heroText");
      if (heroText) heroText.textContent = "There was a short sync delay. Your saved items are still safe.";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
