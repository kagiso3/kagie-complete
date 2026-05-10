(function () {
  window.KagieAssistantApplicantViewPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff", "support-staff", "support staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(value)) return "master_admin";
    return value || "user";
  };
  const dt = (value) => {
    if (!value) return "No date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const chip = (status) => {
    const text = String(status || "").toLowerCase();
    if (text.includes("accept") || text.includes("approve") || text.includes("resolve")) return "c-green";
    if (text.includes("reject")) return "c-red";
    if (text.includes("missing") || text.includes("pending")) return "c-yellow";
    if (text.includes("draft") || text.includes("review")) return "c-orange";
    return "c-blue";
  };
  const normalizeApp = (app) => ({
    ...app,
    assignedAssistantId: app?.assignedAssistantId || app?.assistantId || null,
    items: Array.isArray(app?.items) && app.items.length ? app.items : Array.isArray(app?.institutions) ? app.institutions : []
  });
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const yesNoLabel = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (text === "yes") return "Yes";
    if (text === "no") return "No";
    return "-";
  };
  const digitsOnly = (value) => String(value || "").replace(/\D+/g, "");
  const telHref = (value) => {
    const digits = digitsOnly(value);
    return digits ? `tel:${digits}` : "";
  };
  const mailtoHref = (value) => {
    const email = String(value || "").trim();
    return email ? `mailto:${email}` : "";
  };
  const whatsappHref = (value, message = "Hello from Kagie.") => {
    const digits = digitsOnly(value);
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "";
  };
  const openableLink = (value) => /^(https?:|data:|blob:)/i.test(String(value || "").trim());
  async function attachDocumentLinks(api, docsArg) {
    const docs = Array.isArray(docsArg) ? docsArg : [];
    const client = api?.initSupabaseClient ? api.initSupabaseClient() : null;
    return Promise.all(docs.map(async (doc) => {
      const direct = String(doc?.fileUrl || doc?.dataUrl || "").trim();
      if (!direct) return { ...doc, openUrl: "" };
      if (openableLink(direct) || !client) return { ...doc, openUrl: direct };
      try {
        const signed = await client.storage.from("kagie-documents").createSignedUrl(direct, 60 * 60 * 6);
        return { ...doc, openUrl: signed?.data?.signedUrl || "" };
      } catch (error) {
        console.warn("Applicant document link fallback:", error);
        return { ...doc, openUrl: "" };
      }
    }));
  }
  function summarizeApplication(appArg, docsArg) {
    const app = appArg || {};
    const docs = Array.isArray(docsArg) ? docsArg : [];
    const learner = app?.forms?.learner || {};
    const parent = app?.forms?.parent || {};
    const school = app?.forms?.school || {};
    const marks = Array.isArray(app?.forms?.marks?.subjects) ? app.forms.marks.subjects : [];
    const institutions = Array.isArray(app?.items) && app.items.length ? app.items : [];
    const checks = {
      learner: Boolean((learner?.fullNames || learner?.fullName) && (learner?.email || learner?.cellphone || learner?.phone)),
      parent: Boolean((parent?.guardianFullNames || parent?.guardianName) && (parent?.guardianCell1 || parent?.guardianPhone)),
      school: Boolean(school?.schoolName && school?.schoolProvince && school?.completionYear),
      marks: marks.length > 0,
      institutions: institutions.length > 0,
      documents: docs.length > 0
    };
    const labels = {
      learner: "learner details",
      parent: "guardian details",
      school: "school details",
      marks: "marks",
      institutions: "institution choices",
      documents: "uploaded documents"
    };
    const missing = Object.keys(checks).filter((key) => !checks[key]).map((key) => labels[key]);
    const readiness = Math.round((Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100);
    return { checks, missing, readiness, marks };
  }

  async function main() {
    const api = window.KagieAPI;
    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : await api.restoreSession();
    if (!restored || normalizeRole(restored.role) !== "assistant_admin") {
      window.location.href = "../login.html";
      return;
    }

    const assistant = api.requireRole("assistant_admin");
    const params = new URLSearchParams(window.location.search);
    const appId = params.get("id");
    const requestedUserId = params.get("userId");
    const el = {
      hero: $("hero"),
      layout: $("layout"),
      details: $("details"),
      progressDetails: $("progressDetails"),
      payment: $("payment"),
      institutions: $("institutions"),
      marks: $("marks"),
      documents: $("documents"),
      statusSelect: $("statusSelect"),
      noteInput: $("noteInput"),
      controlForm: $("controlForm"),
      controlMsg: $("controlMsg"),
      notes: $("notes"),
      portalAccessList: $("portalAccessList"),
      portalAccessForm: $("portalAccessForm"),
      portalAccessEntryId: $("portalAccessEntryId"),
      portalInstitutionName: $("portalInstitutionName"),
      portalLink: $("portalLink"),
      portalApplicationNumber: $("portalApplicationNumber"),
      portalStudentNumber: $("portalStudentNumber"),
      portalUsername: $("portalUsername"),
      portalPassword: $("portalPassword"),
      portalDeliveryNote: $("portalDeliveryNote"),
      portalAccessNote: $("portalAccessNote"),
      portalAccessResetBtn: $("portalAccessResetBtn"),
      portalAccessMsg: $("portalAccessMsg"),
      support: $("support"),
      supportForm: $("supportForm"),
      supportMessage: $("supportMessage"),
      supportMsg: $("supportMsg"),
      callbacks: $("callbacks"),
      logoutBtn: $("logoutBtn")
    };

    const setMessage = (node, text, type) => {
      node.textContent = text || "";
      node.className = type ? `msg ${type}` : "msg";
    };
    const activeForms = new WeakSet();
    const activeButtons = new Set();
    const runFormAction = async (event, messageNode, busyText, task) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form || activeForms.has(form)) return;
      activeForms.add(form);
      const button = event.submitter || form.querySelector('button[type="submit"]');
      const originalText = button?.textContent || "";
      const slowTimer = window.setTimeout(() => setMessage(messageNode, "Still processing, please wait...", "ok"), 3200);
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (busyText) button.textContent = busyText;
      }
      try {
        await task();
      } finally {
        window.clearTimeout(slowTimer);
        activeForms.delete(form);
        if (button?.isConnected) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          if (busyText) button.textContent = originalText;
        }
      }
    };
    const runButtonAction = async (button, key, busyText, task) => {
      const lockKey = String(key || button?.dataset?.doc || button?.dataset?.call || "button-action");
      if (activeButtons.has(lockKey)) return;
      activeButtons.add(lockKey);
      const originalText = button?.textContent || "";
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (busyText) button.textContent = busyText;
      }
      try {
        await task();
      } finally {
        activeButtons.delete(lockKey);
        if (button?.isConnected) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          if (busyText) button.textContent = originalText;
        }
      }
    };
    const detailBoxes = (pairs) => pairs.map(([label, value]) => `
      <div class="box">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(value || "-")}</div>
      </div>
    `).join("");
    let portalAccessEntries = [];
    const emptyPortalEntry = () => ({
      id: "",
      institutionName: "",
      portalLink: "",
      applicationNumber: "",
      studentNumber: "",
      username: "",
      password: "",
      deliveryNote: "",
      note: ""
    });
    const normalizePortalEntry = (entry) => ({
      ...emptyPortalEntry(),
      ...(entry || {})
    });
    const portalEntryHasValue = (entry) => Boolean(
      entry.institutionName ||
      entry.portalLink ||
      entry.applicationNumber ||
      entry.studentNumber ||
      entry.username ||
      entry.password ||
      entry.deliveryNote ||
      entry.note
    );
    const fillPortalForm = (entryArg) => {
      const entry = normalizePortalEntry(entryArg);
      el.portalAccessEntryId.value = entry.id || "";
      el.portalInstitutionName.value = entry.institutionName || "";
      el.portalLink.value = entry.portalLink || "";
      el.portalApplicationNumber.value = entry.applicationNumber || "";
      el.portalStudentNumber.value = entry.studentNumber || "";
      el.portalUsername.value = entry.username || "";
      el.portalPassword.value = entry.password || "";
      el.portalDeliveryNote.value = entry.deliveryNote || "";
      el.portalAccessNote.value = entry.note || "";
    };
    const readPortalForm = () => normalizePortalEntry({
      id: el.portalAccessEntryId.value.trim(),
      institutionName: el.portalInstitutionName.value.trim(),
      portalLink: el.portalLink.value.trim(),
      applicationNumber: el.portalApplicationNumber.value.trim(),
      studentNumber: el.portalStudentNumber.value.trim(),
      username: el.portalUsername.value.trim(),
      password: el.portalPassword.value.trim(),
      deliveryNote: el.portalDeliveryNote.value.trim(),
      note: el.portalAccessNote.value.trim()
    });
    const portalStatus = (entry) => {
      if (entry.password) return { label: "Ready", className: "c-green" };
      if (entry.deliveryNote) return { label: "Check learner inbox", className: "c-yellow" };
      return { label: "Saved", className: "c-blue" };
    };
    const renderPortalAccess = () => {
      if (!el.portalAccessList) return;
      el.portalAccessList.innerHTML = portalAccessEntries.length ? portalAccessEntries.map((entry) => {
        const status = portalStatus(entry);
        return `
          <div class="item">
            <div class="row">
              <div>
                <div class="title">${esc(entry.institutionName || "Institution portal")}</div>
                <div class="meta">
                  Portal: ${esc(entry.portalLink || "-")}<br>
                  Application no: ${esc(entry.applicationNumber || "-")}<br>
                  Student no: ${esc(entry.studentNumber || "-")}<br>
                  Username: ${esc(entry.username || "-")}<br>
                  Password / PIN: ${esc(entry.password || "-")}<br>
                  How learner gets it: ${esc(entry.deliveryNote || "-")}<br>
                  Note: ${esc(entry.note || "-")}
                </div>
              </div>
              <span class="chip ${status.className}">${esc(status.label)}</span>
            </div>
            <div class="action-row">
              ${entry.portalLink ? `<a class="mini blue" href="${esc(entry.portalLink)}" target="_blank" rel="noopener">Open portal</a>` : ""}
              <button class="mini yellow" type="button" data-portal-edit="${esc(entry.id)}">Edit</button>
              <button class="mini red" type="button" data-portal-remove="${esc(entry.id)}">Remove</button>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No institution portal details saved yet.</div>';
    };

    async function loadViewData() {
      let targetUserId = String(requestedUserId || "").trim();
      let rawApp = appId ? (api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
      let app = rawApp ? normalizeApp(rawApp) : null;
      if (!app && targetUserId) {
        const latest = api.getLatestApplicationAsync
          ? await api.getLatestApplicationAsync(targetUserId).catch(() => api.getLatestApplication(targetUserId))
          : api.getLatestApplication(targetUserId);
        app = latest ? normalizeApp(latest) : null;
      }
      if (!app && targetUserId) {
        try {
          const ensured = api.ensureDraftAsync
            ? await api.ensureDraftAsync(targetUserId)
            : (api.ensureDraft ? api.ensureDraft(targetUserId) : null);
          app = ensured ? normalizeApp(ensured) : null;
        } catch (error) {
          console.warn("Could not prepare a learner draft for assistant view:", error);
        }
      }
      if (!app) return { app: null };
      targetUserId = String(app.userId || targetUserId || "").trim();

      const profile = api.getProfileAsync ? await api.getProfileAsync(targetUserId).catch(() => (api.getProfile(targetUserId) || {})) : (api.getProfile(targetUserId) || {});
      const user = api.getUserById(targetUserId) || api.getUserBySupabaseId?.(targetUserId) || {};
      const [docs, notes, portalAccess, reviews, supportMessages, callbackItems, learnerSupport] = await Promise.all([
        api.getDocumentsByUserAsync ? api.getDocumentsByUserAsync(targetUserId) : api.getDocumentsByUser(targetUserId),
        api.getApplicationNotesAsync ? api.getApplicationNotesAsync(app.id) : api.getApplicationNotes(app.id),
        api.getApplicationPortalAccessAsync ? api.getApplicationPortalAccessAsync(app.id) : api.getApplicationPortalAccess(app.id),
        api.getDocumentReviewsForUserAsync ? api.getDocumentReviewsForUserAsync(targetUserId) : api.getDocumentReviewsForUser(targetUserId),
        api.getSupportMessagesAsync ? api.getSupportMessagesAsync(`support_${targetUserId}`) : api.getSupportMessages(`support_${targetUserId}`),
        (api.getCallRequestsAsync ? api.getCallRequestsAsync() : api.getCallRequests()).then((items) => (items || []).filter((item) => item.requesterId === targetUserId)),
        api.getApplicationLearnerSupportAsync ? api.getApplicationLearnerSupportAsync(app.id) : api.getApplicationLearnerSupport(app.id)
      ]);
      const docsWithLinks = await attachDocumentLinks(api, docs || []);

      return {
        app,
        profile,
        user: user || api.getUserBySupabaseId?.(targetUserId) || {},
        docs: docsWithLinks,
        notes: notes || [],
        portalAccess: portalAccess || [],
        learnerSupport: learnerSupport || {},
        reviews: reviews || [],
        supportMessages: supportMessages || [],
        callbackItems: callbackItems || []
      };
    }

    async function render() {
      const { app, profile, user, docs, notes, portalAccess, learnerSupport, reviews, supportMessages, callbackItems } = await loadViewData();
      if (!app) {
        el.hero.innerHTML = '<div class="hero-row"><div><h2>Application not found</h2><p>This applicant record could not be loaded.</p></div></div>';
        return;
      }

      el.layout.hidden = false;
      const learnerForm = { ...(app.forms?.learner || {}), ...(learnerSupport || {}) };
      const parentForm = app.forms?.parent || {};
      const schoolForm = app.forms?.school || {};
      const summary = summarizeApplication(app, docs);
      portalAccessEntries = Array.isArray(portalAccess) ? portalAccess.map(normalizePortalEntry) : [];
      const knownUsers = api.getUsers ? api.getUsers() : [];
      const assignedAssistant = knownUsers.find((candidate) => {
        const ref = String(app.assignedAssistantId || "").trim().toLowerCase();
        if (!ref) return false;
        return [candidate?.id, candidate?.supabaseUserId, candidate?.email]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase())
          .includes(ref);
      }) || null;
      const learnerPhone = firstFilled(learnerForm.cellphone, learnerForm.phone, profile.phone, user.phone, user.cellphone);
      const learnerEmail = firstFilled(learnerForm.email, profile.email, user.email);
      const callHref = telHref(learnerPhone);
      const emailHref = mailtoHref(learnerEmail);
      const learnerWhatsappHref = whatsappHref(learnerPhone, `Hello ${firstFilled(learnerForm.fullNames, user.fullName, "learner")}, this is Kagie support.`);
      el.hero.innerHTML = `
        <div class="hero-row">
          <div>
            <h2>${esc(user.fullName || app.applicant || "Applicant")}</h2>
            <p>Email: ${esc(learnerEmail || "-")}<br>Phone: ${esc(learnerPhone || "-")}<br>Application ID: ${esc(app.id)}<br>Assigned assistant: ${esc(assignedAssistant?.fullName || "Unassigned")}<br>Viewing as: ${esc(assistant.fullName || "Assistant")}<br>Payment reference: ${esc(app.payment?.reference || "-")}</p>
            <div class="action-row" style="margin-top:14px">
              ${callHref ? `<a class="mini green" href="${callHref}">Call learner</a>` : ""}
              ${learnerWhatsappHref ? `<a class="mini blue" href="${learnerWhatsappHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
              ${emailHref ? `<a class="mini blue" href="${emailHref}">Email learner</a>` : ""}
            </div>
          </div>
          <div class="chips">
            <span class="chip c-blue">${esc(app.status || "Under Review")}</span>
            <span class="chip c-blue">${esc(app.paymentStatus || "Payment Pending")}</span>
            <span class="chip ${summary.missing.length ? "c-yellow" : "c-green"}">${esc(summary.missing.length ? `${summary.missing.length} follow-up` : "Ready to process")}</span>
          </div>
        </div>
      `;

      el.details.innerHTML = detailBoxes([
        ["Full names", firstFilled(learnerForm.fullNames, learnerForm.fullName, profile.fullName, user.fullName)],
        ["Surname", firstFilled(learnerForm.surname, profile.surname)],
        ["ID number", firstFilled(learnerForm.idNumber, profile.idNumber)],
        ["Date of birth", firstFilled(learnerForm.dob, profile.dob)],
        ["Gender", firstFilled(learnerForm.gender, profile.gender)],
        ["Home language", firstFilled(learnerForm.homeLanguage, profile.homeLanguage)],
        ["Phone", learnerPhone],
        ["Email", learnerEmail],
        ["Province", firstFilled(learnerForm.province, schoolForm.schoolProvince, profile.province)],
        ["Postal code", firstFilled(learnerForm.postalCode, profile.postalCode)],
        ["Home address", firstFilled(learnerForm.address, profile.address, profile.homeAddress)],
        ["Bursary required", yesNoLabel(learnerForm.needsBursary)],
        ["Residence application", yesNoLabel(learnerForm.needsResidence)],
        ["Disability", yesNoLabel(learnerForm.hasDisability)],
        ["Disability description", learnerForm.hasDisability === "yes" ? firstFilled(learnerForm.disabilityDescription, profile.disabilityDescription) : "-"],
        ["Guardian relation", firstFilled(parentForm.guardianRelation, profile.guardianRelation)],
        ["Guardian full names", firstFilled(parentForm.guardianFullNames, parentForm.guardianName, profile.guardianName, profile.guardianFullNames)],
        ["Guardian surname", firstFilled(parentForm.guardianSurname, profile.guardianSurname)],
        ["Guardian phone", firstFilled(parentForm.guardianCell1, parentForm.guardianPhone, profile.guardianPhone, profile.guardianCell1)],
        ["Alternative guardian phone", firstFilled(parentForm.guardianCell2, profile.guardianPhoneAlt, profile.guardianCell2)],
        ["Guardian email", firstFilled(parentForm.guardianEmail, profile.guardianEmail)],
        ["Guardian province", firstFilled(parentForm.guardianProvince, profile.guardianProvince)],
        ["Guardian address", firstFilled(parentForm.guardianAddress, profile.guardianAddress)],
        ["School name", firstFilled(schoolForm.schoolName, schoolForm.confirmName, profile.schoolName, profile.schoolAttended)],
        ["School province", firstFilled(schoolForm.schoolProvince, profile.schoolProvince)],
        ["School type", firstFilled(schoolForm.schoolType, profile.schoolType)],
        ["Completion year", firstFilled(schoolForm.completionYear, profile.completionYear)],
        ["Average percent", firstFilled(schoolForm.average, profile.average)]
      ]);
      el.progressDetails.innerHTML = detailBoxes([
        ["Readiness", `${summary.readiness}%`],
        ["Missing details", summary.missing.length ? summary.missing.join(", ") : "None"],
        ["Payment method", app.payment?.method || "-"],
        ["Payment reference", app.payment?.reference || "-"],
        ["Proof uploaded", app.payment?.proofUploadedAt ? dt(app.payment.proofUploadedAt) : "Not yet"],
        ["Documents saved", docs.length],
        ["Institutions saved", app.items.length],
        ["Portal logins saved", portalAccessEntries.length],
        ["Current status", `${app.status || "Under Review"} | ${app.paymentStatus || "Payment Pending"}`]
      ]);
      el.payment.innerHTML = detailBoxes([
        ["Payer name", app.payment?.payerName],
        ["Phone", app.payment?.phone],
        ["Reference", app.payment?.reference],
        ["Method", app.payment?.method],
        ["Amount", app.payment?.amount ? `R${Number(app.payment.amount || 0).toLocaleString("en-ZA")}` : "-"],
        ["Submitted", app.payment?.submittedAt ? dt(app.payment.submittedAt) : "-"],
        ["Proof file", app.payment?.proofFileName],
        ["Proof uploaded", app.payment?.proofUploadedAt ? dt(app.payment.proofUploadedAt) : "Not yet"],
        ["Verification note", app.payment?.verificationNote],
        ["Rejection reason", app.payment?.rejectionReason],
        ["General note", app.payment?.note]
      ]);

      el.statusSelect.value = app.status || "Under Review";

      el.institutions.innerHTML = app.items.length ? app.items.map((item, index) => `
        <div class="item">
          <div class="title">${esc(index + 1)}. ${esc(item.institution || item.institutionName || "Institution")}</div>
          <div class="meta">Province: ${esc(item.province || "-")}<br>Faculty: ${esc(item.faculty || "-")}<br>Choice 1: ${esc(item.choice1 || "-")}<br>Choice 2: ${esc(item.choice2 || "-")}<br>Choice 3: ${esc(item.choice3 || "-")}</div>
        </div>
      `).join("") : '<div class="empty">No institutions saved yet.</div>';
      el.marks.innerHTML = summary.marks.length ? summary.marks.map((subject, index) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(subject.subject || subject.name || `Subject ${index + 1}`)}</div>
              <div class="meta">Mark: ${esc(subject.mark || subject.percent || "-")} | Level: ${esc(subject.level || "-")}</div>
            </div>
            <span class="chip c-blue">${esc(subject.level || "Saved")}</span>
          </div>
        </div>
      `).join("") : '<div class="empty">No marks have been captured yet.</div>';

      const reviewMap = new Map(reviews.map((review) => [review.doc?.id || review.docId, review.review]));
      el.documents.innerHTML = docs.length ? docs.map((doc) => {
        const review = reviewMap.get(doc.id);
        return `
          <div class="item">
            <div class="row">
              <div>
                <div class="title">${esc(doc.name || "Document")}</div>
                <div class="meta">Category: ${esc(doc.category || "General")}<br>Uploaded: ${esc(dt(doc.createdAt))}</div>
              </div>
              <div class="chips">
                <span class="chip ${chip(doc.status)}">${esc(doc.status || "Pending Review")}</span>
                ${review?.status ? `<span class="chip ${chip(review.status)}">${esc(review.status)}</span>` : ""}
              </div>
            </div>
            <div class="meta">${esc(review?.comment || "No review comment yet.")}</div>
            <div class="action-row">
              ${doc.openUrl ? `<a class="mini blue" href="${esc(doc.openUrl)}" target="_blank" rel="noopener">View file</a>` : ""}
              ${doc.openUrl ? `<a class="mini green" href="${esc(doc.openUrl)}" target="_blank" rel="noopener" download>Download</a>` : ""}
              <button class="mini green" type="button" data-doc="${esc(doc.id)}|Approved">Approve</button>
              <button class="mini yellow" type="button" data-doc="${esc(doc.id)}|Pending Review">Pending</button>
              <button class="mini red" type="button" data-doc="${esc(doc.id)}|Rejected">Reject</button>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No documents uploaded yet.</div>';

      el.notes.innerHTML = notes.length ? notes.map((note) => `
        <div class="item">
          <div class="title">${esc(api.getUserById(note.authorId)?.fullName || note.authorName || "Kagie staff")}</div>
          <div class="meta">${esc(note.text || note.noteText || "-")}<br>${esc(dt(note.createdAt))}</div>
        </div>
      `).join("") : '<div class="empty">No notes recorded yet.</div>';
      renderPortalAccess();
      fillPortalForm();

      el.support.innerHTML = supportMessages.length ? supportMessages.map((message) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(message.senderName || "Support")}</div>
              <div class="meta">${esc(message.text || "")}<br>${esc(dt(message.createdAt))}</div>
            </div>
            <span class="chip ${message.senderRole === "user" ? "c-yellow" : "c-blue"}">${esc(message.senderRole || "message")}</span>
          </div>
        </div>
      `).join("") : '<div class="empty">No support messages yet.</div>';

      el.callbacks.innerHTML = callbackItems.length ? callbackItems.map((call) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(call.requesterName || "Learner")}</div>
              <div class="meta">${esc(call.phone || "-")}<br>Preferred time: ${esc(call.preferredTime || "-")}<br>${esc(dt(call.createdAt))}</div>
            </div>
            <span class="chip ${chip(call.status)}">${esc(call.status || "Pending")}</span>
          </div>
          <div class="meta">${esc(call.reason || "No reason supplied.")}</div>
          <div class="action-row">
            <button class="mini yellow" type="button" data-call="${esc(call.id)}|Contacted">Contacted</button>
            <button class="mini green" type="button" data-call="${esc(call.id)}|Resolved">Resolved</button>
          </div>
        </div>
      `).join("") : '<div class="empty">No callback requests for this learner.</div>';
    }

    el.documents.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-doc]");
      const raw = button?.getAttribute("data-doc");
      if (!raw) return;
      const [docId, status] = raw.split("|");
      await runButtonAction(button, `doc:${docId}:${status}`, "Updating...", async () => {
        try {
          await (api.setDocumentReviewAsync ? api.setDocumentReviewAsync(docId, { status, comment: `Updated by ${assistant.fullName}` }) : Promise.resolve(api.setDocumentReview(docId, { status, comment: `Updated by ${assistant.fullName}` })));
          await render();
        } catch (error) {
          alert(error.message || "Could not update document review.");
        }
      });
    });

    el.callbacks.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-call]");
      const raw = button?.getAttribute("data-call");
      if (!raw) return;
      const [callId, status] = raw.split("|");
      await runButtonAction(button, `call:${callId}:${status}`, "Updating...", async () => {
        try {
          await (api.updateCallRequestAsync ? api.updateCallRequestAsync(callId, { status }) : Promise.resolve(api.updateCallRequest(callId, { status })));
          await render();
        } catch (error) {
          alert(error.message || "Could not update callback request.");
        }
      });
    });

    el.controlForm.addEventListener("submit", (event) => runFormAction(event, el.controlMsg, "Saving...", async () => {
      setMessage(el.controlMsg, "");
      try {
        const app = appId ? normalizeApp(api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
        if (!app) throw new Error("Application could not be loaded.");
        await (api.updateApplicationAsync ? api.updateApplicationAsync(app.id, { status: el.statusSelect.value }) : Promise.resolve(api.updateApplication(app.id, { status: el.statusSelect.value })));
        const note = el.noteInput.value.trim();
        if (note) {
          await (api.addApplicationNoteAsync ? api.addApplicationNoteAsync(app.id, note) : Promise.resolve(api.addApplicationNote(app.id, note)));
          el.noteInput.value = "";
        }
        setMessage(el.controlMsg, "Assistant update saved.", "ok");
        await render();
      } catch (error) {
        setMessage(el.controlMsg, error.message || "Could not save update.", "err");
      }
    }));

    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        el.statusSelect.value = button.getAttribute("data-status");
      });
    });

    el.portalAccessList.addEventListener("click", async (event) => {
      const editId = event.target.getAttribute("data-portal-edit");
      const removeId = event.target.getAttribute("data-portal-remove");
      if (editId) {
        const current = portalAccessEntries.find((entry) => entry.id === editId);
        fillPortalForm(current || emptyPortalEntry());
        setMessage(el.portalAccessMsg, "Editing portal access entry.", "ok");
        return;
      }
      if (!removeId) return;
      const button = event.target.closest("[data-portal-remove]");
      await runButtonAction(button, `portal-remove:${removeId}`, "Removing...", async () => {
        try {
          const nextEntries = portalAccessEntries.filter((entry) => entry.id !== removeId);
          await (api.saveApplicationPortalAccessAsync
            ? api.saveApplicationPortalAccessAsync(appId, nextEntries)
            : Promise.resolve(api.saveApplicationPortalAccess(appId, nextEntries)));
          await render();
          setMessage(el.portalAccessMsg, "Portal access entry removed.", "ok");
        } catch (error) {
          setMessage(el.portalAccessMsg, error.message || "Could not remove portal access entry.", "err");
        }
      });
    });

    el.portalAccessForm.addEventListener("submit", (event) => runFormAction(event, el.portalAccessMsg, "Saving...", async () => {
      const draft = readPortalForm();
      if (!portalEntryHasValue(draft)) {
        setMessage(el.portalAccessMsg, "Add at least one login detail first.", "err");
        return;
      }
      try {
        const nextEntries = portalAccessEntries.slice();
        const nextId = draft.id || `portal_${Date.now()}`;
        const entry = { ...draft, id: nextId };
        const index = nextEntries.findIndex((item) => item.id === nextId);
        if (index >= 0) nextEntries[index] = entry;
        else nextEntries.unshift(entry);
        await (api.saveApplicationPortalAccessAsync
          ? api.saveApplicationPortalAccessAsync(appId, nextEntries)
          : Promise.resolve(api.saveApplicationPortalAccess(appId, nextEntries)));
        await render();
        setMessage(el.portalAccessMsg, "Institution login details saved.", "ok");
      } catch (error) {
        setMessage(el.portalAccessMsg, error.message || "Could not save institution login details.", "err");
      }
    }));

    el.portalAccessResetBtn.addEventListener("click", () => {
      fillPortalForm(emptyPortalEntry());
      setMessage(el.portalAccessMsg, "");
    });

    el.supportForm.addEventListener("submit", (event) => runFormAction(event, el.supportMsg, "Sending...", async () => {
      const text = el.supportMessage.value.trim();
      if (!text) {
        setMessage(el.supportMsg, "Write a reply first.", "err");
        return;
      }
      try {
        const app = appId ? normalizeApp(api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
        if (!app) throw new Error("Application could not be loaded.");
        await (api.sendSupportMessageAsync ? api.sendSupportMessageAsync(`support_${app.userId}`, text) : Promise.resolve(api.sendSupportMessage(`support_${app.userId}`, text)));
        el.supportMessage.value = "";
        setMessage(el.supportMsg, "Reply sent to learner.", "ok");
        await render();
      } catch (error) {
        setMessage(el.supportMsg, error.message || "Could not send reply.", "err");
      }
    }));

    const performLogout = async () => {
      if (el.logoutBtn) {
        el.logoutBtn.disabled = true;
        el.logoutBtn.style.opacity = "0.7";
      }
      try {
        if (api?.setLoginPersistence) api.setLoginPersistence(false);
        if (api?.logoutReal) await api.logoutReal();
        else if (api?.logout) await Promise.resolve(api.logout());
      } catch (error) {
        console.error("Assistant applicant view logout failed:", error);
      } finally {
        try {
          localStorage.removeItem("kagie_current_user");
          sessionStorage.removeItem("kagie_current_user");
        } catch (storageError) {
          console.warn("Assistant applicant logout cleanup failed:", storageError);
        }
        window.location.replace("../login.html?switch=1");
      }
    };

    el.logoutBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      await performLogout();
    });

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const api = window.KagieAPI;
      const active = api?.currentUser?.();
      if (!active || normalizeRole(active.role) !== "assistant_admin") {
        window.location.href = "../login.html";
        return;
      }
      const hero = $("hero");
      if (hero) {
        hero.innerHTML = `<div class="hero-row"><div><h2>Applicant workspace delayed</h2><p>${esc(error.message || "Kagie could not fully load this applicant right now, but your assistant session is still active.")}</p></div></div>`;
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
