
(function () {
  window.KagieMasterApplicationViewPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(value)) return "master_admin";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff", "support-staff", "support staff"].includes(value)) return "assistant_admin";
    return value || "user";
  };
  const dt = (value) => {
    if (!value) return "No date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const money = (value) => `R${Number(value || 0).toLocaleString("en-ZA")}`;
  const chip = (status) => {
    const text = String(status || "").toLowerCase();
    if (text.includes("accept") || text.includes("verify")) return "c-green";
    if (text.includes("reject")) return "c-red";
    if (text.includes("pending") || text.includes("missing")) return "c-yellow";
    if (text.includes("draft") || text.includes("submit")) return "c-orange";
    return "c-blue";
  };
  const normalizeApplicationTypeKey = (value) => {
    const type = String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    if (!type) return "";
    if (["late", "late_application", "late_applications"].includes(type)) return "late";
    if (["bridging", "bridge", "bridging_programme", "bridging_programmes"].includes(type)) return "bridging";
    if (["postgraduate", "post_graduate", "post_graduate_application", "post_graduate_applications", "post_grad", "postgrad"].includes(type)) return "postgraduate";
    if (["undergraduate", "undergrad", "under_graduate", "undergraduate_application", "undergraduate_applications", "under_graduate_application", "under_graduate_applications"].includes(type)) return "undergraduate";
    if (type.includes("transfer")) return "transfer";
    return type;
  };
  const applicationTypeLabel = (app) => {
    const type = normalizeApplicationTypeKey(app?.applicationType || app?.forms?.applicationType?.type || app?.applicationTypeLabel || app?.forms?.applicationType?.label || app?.applicationEngine?.type) || "undergraduate";
    const labels = {
      undergraduate: "Undergraduate Applications",
      late: "Late Applications",
      postgraduate: "Postgraduate Applications",
      transfer: "Transfer Applications",
      bridging: "Bridging Programmes"
    };
    return labels[type] || firstFilled(app?.applicationTypeLabel, app?.forms?.applicationType?.label, "Undergraduate Applications");
  };
  const normalizeApp = (app) => {
    const forms = mergedApplicationForms(app);
    return {
      ...app,
      forms,
      assignedAssistantId: app?.assignedAssistantId || app?.assistantId || null,
      applicationTypeLabel: applicationTypeLabel({ ...app, forms }),
      selectedPackage: app?.selectedPackage || app?.applicationPayload?.selectedPackage || app?.package || forms.packageSelection?.package || null,
      items: applicationInstitutions(app)
    };
  };
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const readableKey = (value) => String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const asRecord = (value) => isPlainObject(value) ? value : {};
  const hasVisibleValue = (value) => {
    if (Array.isArray(value)) return value.some(hasVisibleValue);
    if (isPlainObject(value)) return Object.values(value).some(hasVisibleValue);
    return value === false || value === 0 || Boolean(String(value ?? "").trim());
  };
  const mergeFilledRecords = (...sources) => {
    const output = {};
    sources.forEach((sourceArg) => {
      Object.entries(asRecord(sourceArg)).forEach(([key, value]) => {
        if (hasVisibleValue(value) || !Object.prototype.hasOwnProperty.call(output, key)) {
          output[key] = value;
        }
      });
    });
    return output;
  };
  const firstNonEmptyArray = (...values) => values.find((value) => Array.isArray(value) && value.length) || [];
  const marksFrom = (value) => Array.isArray(value?.subjects) ? value.subjects : (Array.isArray(value) ? value : []);
  const applicationMarks = (app) => firstNonEmptyArray(
    marksFrom(app?.forms?.marks),
    marksFrom(app?.applicationPayload?.forms?.marks),
    marksFrom(app?.applicationEngine?.formData?.marks),
    marksFrom(app?.applicationEngine?.formData),
    marksFrom(app?.marks)
  );
  const applicationInstitutions = (app) => firstNonEmptyArray(
    app?.items,
    app?.institutions,
    app?.applicationPayload?.institutions,
    app?.applicationPayload?.forms?.institutions,
    app?.forms?.institutions,
    app?.applicationEngine?.formData?.institutions
  );
  const SPECIALISED_META_KEYS = new Set(["applicationType", "package", "learner", "parent", "school", "marks", "apply", "institutions", "current", "type", "label", "currentStep", "submitted", "reference", "selectedPackage", "selectedInstitutions", "selectedCourses", "reviewConfirmed"]);
  const unwrapApplicationValues = (sourceArg) => {
    const source = asRecord(sourceArg);
    if (hasVisibleValue(source.values)) return asRecord(source.values);
    if (hasVisibleValue(source.current?.values)) return asRecord(source.current.values);
    if (hasVisibleValue(source.current) && !source.current?.currentStep) return asRecord(source.current);
    return Object.fromEntries(Object.entries(source).filter(([key]) => !SPECIALISED_META_KEYS.has(key)));
  };
  const firstFilledRecord = (...sources) => sources.map(unwrapApplicationValues).find(hasVisibleValue) || {};
  const dynamicValuesFor = (app, formsArg) => {
    const forms = asRecord(formsArg);
    const type = normalizeApplicationTypeKey(
      app?.applicationType ||
      forms.applicationType?.type ||
      app?.applicationTypeLabel ||
      forms.applicationType?.label ||
      app?.applicationEngine?.type ||
      app?.lateApplication?.type
    );
    return asRecord(asRecord(forms.dynamicApplications)[type]);
  };
  const mergedApplicationForms = (appArg) => {
    const app = appArg || {};
    const payloadForms = asRecord(app.applicationPayload?.forms);
    const forms = asRecord(app.forms);
    const engineData = asRecord(app.applicationEngine?.formData);
    const lateData = asRecord(app.lateApplication?.data || app.lateApplication);
    const baseForms = { ...payloadForms, ...forms };
    const dynamicData = dynamicValuesFor(app, baseForms);
    const latePersonal = asRecord(lateData.personal || engineData.personal);
    const lateDetails = asRecord(lateData.details || engineData.details);
    const merged = {
      ...payloadForms,
      ...forms,
      applicationType: mergeFilledRecords(payloadForms.applicationType, forms.applicationType),
      packageSelection: mergeFilledRecords(payloadForms.packageSelection, forms.packageSelection),
      dynamicApplications: {
        ...asRecord(payloadForms.dynamicApplications),
        ...asRecord(forms.dynamicApplications)
      },
      learner: mergeFilledRecords(
        payloadForms.learner,
        forms.learner,
        engineData.learner,
        latePersonal,
        { cellphone: latePersonal.phone || lateDetails.phone, address: latePersonal.address || lateDetails.address }
      ),
      parent: mergeFilledRecords(payloadForms.parent, forms.parent, engineData.parent),
      school: mergeFilledRecords(
        payloadForms.school,
        forms.school,
        engineData.school,
        {
          schoolName: latePersonal.schoolName || lateDetails.schoolName,
          schoolProvince: latePersonal.province || lateDetails.province,
          completionYear: latePersonal.examYear || lateDetails.examYear,
          educationLevel: latePersonal.educationLevel || lateDetails.educationLevel
        }
      ),
      specialisedApplication: mergeFilledRecords(payloadForms.specialisedApplication, forms.specialisedApplication)
    };
    const marks = firstNonEmptyArray(
      marksFrom(forms.marks),
      marksFrom(payloadForms.marks),
      marksFrom(engineData.marks),
      marksFrom(app.marks)
    );
    merged.marks = { ...asRecord(payloadForms.marks), ...asRecord(forms.marks), subjects: marks };
    if (!hasVisibleValue(merged.specialisedApplication?.values)) {
      const fallbackValues = firstFilledRecord(
        dynamicData,
        forms.current,
        payloadForms.current,
        engineData,
        lateData
      );
      if (hasVisibleValue(fallbackValues)) {
        merged.specialisedApplication = {
          ...(merged.specialisedApplication || {}),
          values: fallbackValues
        };
      }
    }
    return merged;
  };
  const specialisedValues = (app) => {
    const forms = mergedApplicationForms(app);
    return firstFilledRecord(
      forms.specialisedApplication?.values,
      dynamicValuesFor(app, forms),
      forms.current,
      app?.applicationPayload?.forms?.specialisedApplication?.values,
      app?.applicationEngine?.formData,
      app?.lateApplication?.data
    );
  };
  const formatDetailValue = (value) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (Array.isArray(value)) {
      return value.map((item) => isPlainObject(item)
        ? firstFilled(item.name, item.institutionName, item.programme, item.choice1, item.subject, formatDetailValue(item))
        : formatDetailValue(item)
      ).filter(Boolean).join(", ");
    }
    if (isPlainObject(value)) {
      return Object.entries(value)
        .filter(([, child]) => hasVisibleValue(child))
        .map(([key, child]) => `${readableKey(key)}: ${formatDetailValue(child)}`)
        .join("; ");
    }
    return String(value ?? "").trim();
  };
  const pushDetailPairs = (pairs, sourceArg, prefix = "", depth = 0) => {
    Object.entries(asRecord(sourceArg)).forEach(([key, value]) => {
      if (SPECIALISED_META_KEYS.has(key) || !hasVisibleValue(value)) return;
      const label = prefix ? `${prefix} ${readableKey(key)}` : readableKey(key);
      if (isPlainObject(value) && depth < 2) {
        pushDetailPairs(pairs, value, label, depth + 1);
        return;
      }
      pairs.push([label, formatDetailValue(value)]);
    });
  };
  const specialisedDetailPairs = (app) => {
    const pairs = [];
    pushDetailPairs(pairs, specialisedValues(app));
    return pairs;
  };
  const identityTokens = (user) => [
    String(user?.id || "").trim().toLowerCase(),
    String(user?.supabaseUserId || "").trim().toLowerCase(),
    String(user?.email || "").trim().toLowerCase()
  ].filter(Boolean);
  const mergeDistinctUsers = (...lists) => {
    const merged = [];
    lists.flat().filter(Boolean).forEach((user) => {
      const tokens = identityTokens(user);
      const index = merged.findIndex((existing) => {
        const existingTokens = identityTokens(existing);
        return tokens.some((token) => existingTokens.includes(token));
      });
      if (index === -1) {
        merged.push(user);
        return;
      }
      const current = merged[index];
      merged[index] = {
        ...current,
        ...user,
        id: firstFilled(current?.id, user?.id, current?.supabaseUserId, user?.supabaseUserId),
        supabaseUserId: firstFilled(user?.supabaseUserId, current?.supabaseUserId),
        fullName: firstFilled(user?.fullName, current?.fullName, user?.name, current?.name, user?.email, current?.email, "Assistant"),
        email: firstFilled(user?.email, current?.email),
        phone: firstFilled(user?.phone, current?.phone, user?.cellphone, current?.cellphone),
        role: firstFilled(user?.role, current?.role)
      };
    });
    return merged.sort((left, right) =>
      firstFilled(left?.fullName, left?.email, left?.id).localeCompare(firstFilled(right?.fullName, right?.email, right?.id))
    );
  };
  const yesNoLabel = (value) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
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
  const documentHref = (doc) => String(doc?.openUrl || doc?.fileUrl || doc?.dataUrl || "").trim();
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
        console.warn("Master application document link fallback:", error);
        return { ...doc, openUrl: "" };
      }
    }));
  }
  function summarizeApplication(appArg, docsArg) {
    const app = appArg || {};
    const docs = Array.isArray(docsArg) ? docsArg : [];
    const forms = mergedApplicationForms(app);
    const learner = forms.learner || {};
    const parent = forms.parent || {};
    const school = forms.school || {};
    const marks = applicationMarks({ ...app, forms });
    const institutions = applicationInstitutions({ ...app, forms });
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
      : (api.currentUser() || await api.restoreSession());
    if (!restored || normalizeRole(restored.role) !== "master_admin") {
      window.location.href = "../login.html";
      return;
    }

    api.requireRole("master_admin");
    const appId = new URLSearchParams(window.location.search).get("id");
    const el = {
      hero: $("hero"),
      layout: $("layout"),
      details: $("details"),
      progressDetails: $("progressDetails"),
      institutions: $("institutions"),
      marks: $("marks"),
      documents: $("documents"),
      timeline: $("timeline"),
      assistantSelect: $("assistantSelect"),
      statusSelect: $("statusSelect"),
      paymentStatusSelect: $("paymentStatusSelect"),
      paymentReviewReason: $("paymentReviewReason"),
      noteInput: $("noteInput"),
      adminForm: $("adminForm"),
      formMsg: $("formMsg"),
      payment: $("payment"),
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
      notes: $("notes"),
      support: $("support"),
      supportForm: $("supportForm"),
      supportMessage: $("supportMessage"),
      supportMsg: $("supportMsg"),
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
      const lockKey = String(key || button?.dataset?.doc || button?.dataset?.portalRemove || "button-action");
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
        <div class="value">${esc(formatDetailValue(value) || "-")}</div>
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

    const supportStatusLabel = (status) => {
      const value = String(status || "open").trim().toLowerCase().replace(/[_-]+/g, " ");
      return value ? value.replace(/\b\w/g, (char) => char.toUpperCase()) : "Open";
    };

    const loadSupportTicketsForUser = async (userId) => {
      try {
        const tickets = api.getSupportTicketsAsync
          ? await api.getSupportTicketsAsync({ userId })
          : (api.getSupportTickets?.({ userId }) || []);
        const rows = Array.isArray(tickets) ? tickets : [];
        return Promise.all(rows.map(async (ticket) => {
          const messages = api.getSupportTicketMessagesAsync
            ? await api.getSupportTicketMessagesAsync(ticket.id).catch(() => [])
            : (api.getSupportTicketMessages?.(ticket.id) || []);
          return { ...ticket, messages: Array.isArray(messages) ? messages : [] };
        }));
      } catch (error) {
        console.warn("Could not load support tickets for learner:", error);
        return [];
      }
    };

    const renderSupportThreads = (tickets, legacyMessages) => {
      const rows = Array.isArray(tickets) ? tickets : [];
      if (rows.length) {
        return rows.map((ticket) => `
          <div class="item">
            <div class="row">
              <div>
                <div class="title">${esc(ticket.subject || "Support request")}</div>
                <div class="meta">Category: ${esc(ticket.category || "General")}<br>Updated: ${esc(dt(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt))}</div>
              </div>
              <span class="chip ${chip(ticket.status)}">${esc(supportStatusLabel(ticket.status))}</span>
            </div>
            ${(ticket.messages || []).length ? `<div class="list" style="margin-top:10px">${ticket.messages.map((message) => `
              <div class="item" style="box-shadow:none">
                <div class="row">
                  <div>
                    <div class="title">${esc(message.senderName || "Support")}</div>
                    <div class="meta">${esc(message.text || message.message || "")}<br>${esc(dt(message.createdAt))}</div>
                  </div>
                  <span class="chip ${message.senderRole === "user" ? "c-yellow" : "c-blue"}">${esc(message.senderRole || "message")}</span>
                </div>
              </div>
            `).join("")}</div>` : '<div class="meta" style="margin-top:10px">No messages in this ticket yet.</div>'}
            <div class="action-row" style="margin-top:10px">
              <button class="mini yellow" type="button" data-support-ticket-status="${esc(ticket.id)}|in_progress">In progress</button>
              <button class="mini green" type="button" data-support-ticket-status="${esc(ticket.id)}|resolved">Resolved</button>
              <button class="mini red" type="button" data-support-ticket-status="${esc(ticket.id)}|closed">Closed</button>
            </div>
          </div>
        `).join("");
      }
      return legacyMessages.length ? legacyMessages.map((message) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(message.senderName || "Support")}</div>
              <div class="meta">${esc(message.text || "")}<br>${esc(dt(message.createdAt))}</div>
            </div>
            <span class="chip ${message.senderRole === "user" ? "c-yellow" : "c-blue"}">${esc(message.senderRole || "message")}</span>
          </div>
        </div>
      `).join("") : '<div class="empty">No support tickets or messages yet.</div>';
    };

    const sendSupportReplyForApp = async (app, text) => {
      const tickets = await loadSupportTicketsForUser(app.userId);
      const activeTicket = tickets.find((ticket) => !["resolved", "closed"].includes(String(ticket.status || "").toLowerCase())) || tickets[0];
      if (activeTicket?.id && (api.replySupportTicketAsync || api.replySupportTicket)) {
        await (api.replySupportTicketAsync
          ? api.replySupportTicketAsync(activeTicket.id, text)
          : Promise.resolve(api.replySupportTicket(activeTicket.id, text)));
        return;
      }
      if (api.createSupportTicketAsync || api.createSupportTicket) {
        await (api.createSupportTicketAsync
          ? api.createSupportTicketAsync({ userId: app.userId, subject: `Application ${app.id} support`, category: "Applications", message: text })
          : Promise.resolve(api.createSupportTicket({ userId: app.userId, subject: `Application ${app.id} support`, category: "Applications", message: text })));
        return;
      }
      await (api.sendSupportMessageAsync ? api.sendSupportMessageAsync(`support_${app.userId}`, text) : Promise.resolve(api.sendSupportMessage(`support_${app.userId}`, text)));
    };

    const updateSupportTicketStatus = async (ticketId, status) => {
      await (api.updateSupportTicketStatusAsync
        ? api.updateSupportTicketStatusAsync(ticketId, status)
        : Promise.resolve(api.updateSupportTicketStatus(ticketId, status)));
    };

    async function loadData() {
      const rawApp = appId ? (api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
      const app = rawApp ? normalizeApp(rawApp) : null;
      if (!app) return { app: null };

      const [profile, assistantsByRole, docs, notes, portalAccess, learnerSupport, reviews, supportMessages, supportTickets, applicationUpdates] = await Promise.all([
        api.getProfileAsync ? api.getProfileAsync(app.userId).catch(() => (api.getProfile(app.userId) || {})) : (api.getProfile(app.userId) || {}),
        api.getUsersByRoleAsync ? api.getUsersByRoleAsync("assistant_admin") : api.getUsersByRole("assistant_admin"),
        api.getDocumentsByUserAsync ? api.getDocumentsByUserAsync(app.userId) : api.getDocumentsByUser(app.userId),
        api.getApplicationNotesAsync ? api.getApplicationNotesAsync(app.id) : api.getApplicationNotes(app.id),
        api.getApplicationPortalAccessAsync ? api.getApplicationPortalAccessAsync(app.id) : api.getApplicationPortalAccess(app.id),
        api.getApplicationLearnerSupportAsync ? api.getApplicationLearnerSupportAsync(app.id) : api.getApplicationLearnerSupport(app.id),
        api.getDocumentReviewsForUserAsync ? api.getDocumentReviewsForUserAsync(app.userId) : api.getDocumentReviewsForUser(app.userId),
        api.getSupportMessagesAsync ? api.getSupportMessagesAsync(`support_${app.userId}`) : api.getSupportMessages(`support_${app.userId}`),
        loadSupportTicketsForUser(app.userId),
        api.getApplicationUpdatesAsync ? api.getApplicationUpdatesAsync(app.userId).catch(() => []) : (api.getApplicationUpdates?.(app.userId) || [])
      ]);

      const assistantCandidates = (api.getUsers ? api.getUsers() : []).filter((user) => normalizeRole(user?.role) === "assistant_admin");
      const assistants = mergeDistinctUsers(assistantsByRole || [], assistantCandidates);
      const docsWithLinks = await attachDocumentLinks(api, docs || []);

      return {
        app,
        profile,
        user: api.getUserById(app.userId) || api.getUserBySupabaseId?.(app.userId) || {},
        assistants: assistants || [],
        docs: docsWithLinks,
        notes: notes || [],
        portalAccess: portalAccess || [],
        learnerSupport: learnerSupport || {},
        reviews: reviews || [],
        supportMessages: supportMessages || [],
        supportTickets: supportTickets || [],
        applicationUpdates: applicationUpdates || []
      };
    }

    async function render() {
      const { app, profile, user, assistants, docs, notes, portalAccess, learnerSupport, reviews, supportMessages, supportTickets, applicationUpdates } = await loadData();
      if (!app) {
        el.hero.innerHTML = '<div class="hero-row"><div><h2>Application not found</h2><p>This application could not be loaded.</p></div></div>';
        return;
      }

      const assigned = app.assignedAssistantId
        ? assistants.find((assistant) => assistant.id === app.assignedAssistantId || assistant.supabaseUserId === app.assignedAssistantId)
          || api.getUserById(app.assignedAssistantId)
        : null;
      const learnerForm = { ...(app.forms?.learner || {}), ...(learnerSupport || {}) };
      const parentForm = app.forms?.parent || {};
      const schoolForm = app.forms?.school || {};
      const selectedPackage = app.selectedPackage || app.package || app.forms?.packageSelection?.package || {};
      const selectedAddons = Array.isArray(app.selectedAddons)
        ? app.selectedAddons
        : Array.isArray(app.applicationPayload?.selectedAddons)
          ? app.applicationPayload.selectedAddons
        : Array.isArray(app.forms?.packageSelection?.addons)
          ? app.forms.packageSelection.addons
          : [];
      const summary = summarizeApplication(app, docs);
      portalAccessEntries = Array.isArray(portalAccess) ? portalAccess.map(normalizePortalEntry) : [];
      const learnerPhone = firstFilled(learnerForm.cellphone, learnerForm.phone, profile.phone, user.phone, user.cellphone);
      const learnerEmail = firstFilled(learnerForm.email, profile.email, user.email);
      const callHref = telHref(learnerPhone);
      const emailHref = mailtoHref(learnerEmail);
      const learnerWhatsappHref = whatsappHref(learnerPhone, `Hello ${firstFilled(learnerForm.fullNames, user.fullName, "learner")}, this is Kagie support.`);
      const reviewMap = new Map(reviews.map((review) => [review.doc?.id || review.docId, review.review]));

      el.layout.hidden = false;
      el.hero.innerHTML = `
        <div class="hero-row">
          <div>
            <h2>${esc(firstFilled(learnerForm.fullNames, learnerForm.fullName, profile.fullName, user.fullName, app.applicant, "Applicant"))}</h2>
            <p>Email: ${esc(learnerEmail || "-")}<br>Phone: ${esc(learnerPhone || "-")}<br>Application ID: ${esc(app.id)}<br>Assigned assistant: ${esc(assigned?.fullName || "Unassigned")}</p>
            <div class="action-row" style="margin-top:14px">
              ${callHref ? `<a class="mini green" href="${callHref}">Call learner</a>` : ""}
              ${learnerWhatsappHref ? `<a class="mini blue" href="${learnerWhatsappHref}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
              ${emailHref ? `<a class="mini blue" href="${emailHref}">Email learner</a>` : ""}
            </div>
          </div>
          <div class="chips">
            <span class="chip c-blue">${esc(app.status || "Draft")}</span>
            <span class="chip c-blue">${esc(app.paymentStatus || "Payment Pending")}</span>
            <span class="chip ${summary.missing.length ? "c-yellow" : "c-green"}">${esc(summary.missing.length ? `${summary.missing.length} follow-up` : "Ready to process")}</span>
          </div>
        </div>
      `;

      el.details.innerHTML = detailBoxes([
        ["Application type", app.applicationTypeLabel],
        ["Application reference", firstFilled(app.applicationReference, app.reference)],
        ["Selected package", firstFilled(selectedPackage.name, selectedPackage.packName)],
        ["Package price", money(app.packagePrice ?? selectedPackage.price ?? selectedPackage.packPrice ?? 0)],
        ["Selected add-ons", selectedAddons.length ? selectedAddons.map((addon) => firstFilled(addon.name, addon.code)).join(", ") : "None"],
        ["Add-ons total", money(app.addonsTotal || 0)],
        ["Final total", money(app.finalTotal || app.payment?.amount || 0)],
        ["First institution choice", firstFilled(app.institutionChoice1, app.institutionName)],
        ["Second institution choice", app.institutionChoice2],
        ["Programme choice", firstFilled(app.programmeChoice, app.programme)],
        ["Submission date", app.submittedAt ? dt(app.submittedAt) : "Not submitted"],
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
        ["Guardian full names", firstFilled(parentForm.guardianFullNames, profile.guardianName, profile.guardianFullNames)],
        ["Guardian surname", firstFilled(parentForm.guardianSurname, profile.guardianSurname)],
        ["Guardian phone", firstFilled(parentForm.guardianCell1, parentForm.guardianPhone, profile.guardianPhone, profile.guardianCell1)],
        ["Alternative guardian phone", firstFilled(parentForm.guardianCell2, profile.guardianPhoneAlt, profile.guardianCell2)],
        ["Guardian email", firstFilled(parentForm.guardianEmail, profile.guardianEmail)],
        ["Guardian province", firstFilled(parentForm.guardianProvince, profile.guardianProvince)],
        ["Guardian address", firstFilled(parentForm.guardianAddress, profile.guardianAddress)],
        ["School", firstFilled(schoolForm.schoolName, schoolForm.confirmName, profile.schoolName, profile.schoolAttended)],
        ["School province", firstFilled(schoolForm.schoolProvince, profile.schoolProvince)],
        ["School type", firstFilled(schoolForm.schoolType, profile.schoolType)],
        ["Completion year", firstFilled(schoolForm.completionYear, profile.completionYear)],
        ["Average", firstFilled(schoolForm.average, profile.average)],
        ...specialisedDetailPairs(app)
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
        ["Current status", `${app.status || "Draft"} | ${app.paymentStatus || "Payment Pending"}`]
      ]);

      el.payment.innerHTML = detailBoxes([
        ["Kagie package", firstFilled(selectedPackage.name, selectedPackage.packName)],
        ["Package price", money(app.packagePrice ?? selectedPackage.price ?? selectedPackage.packPrice ?? 0)],
        ["Add-ons total", money(app.addonsTotal || 0)],
        ["Final total", money(app.finalTotal || app.payment?.amount || 0)],
        ["Payment status", app.paymentStatus],
        ["Payer name", app.payment?.payerName],
        ["Phone", app.payment?.phone],
        ["Reference", app.payment?.reference],
        ["Method", app.payment?.method],
        ["Amount", money(app.payment?.amount || 0)],
        ["Submitted", dt(app.payment?.submittedAt)],
        ["Proof file", app.payment?.proofFileName],
        ["Proof uploaded", dt(app.payment?.proofUploadedAt)],
        ["Verification note", app.payment?.verificationNote],
        ["Rejection reason", app.payment?.rejectionReason],
        ["Note", app.payment?.note]
      ]);

      el.assistantSelect.innerHTML = `<option value="">Unassigned</option>${assistants.map((assistant) => `<option value="${esc(assistant.id)}" ${(assistant.id === app.assignedAssistantId || assistant.supabaseUserId === app.assignedAssistantId) ? "selected" : ""}>${esc(assistant.fullName)}${assistant.supabaseUserId ? "" : " (local)"}</option>`).join("")}`;
      el.statusSelect.value = app.status || "Draft";
      el.paymentStatusSelect.value = app.paymentStatus || "Payment Pending";
      el.paymentReviewReason.value = app.payment?.rejectionReason || app.payment?.verificationNote || "";

      el.institutions.innerHTML = app.items.length ? app.items.map((item, index) => `
        <div class="item">
          <div class="title">${esc(index + 1)}. ${esc(item.institution || item.institutionName || "Institution")}</div>
          <div class="meta">Province: ${esc(item.province || "-")}<br>Faculty: ${esc(item.faculty || "-")}<br>Choice 1: ${esc(item.choice1 || "-")}<br>Choice 2: ${esc(item.choice2 || "-")}<br>Choice 3: ${esc(item.choice3 || "-")}</div>
        </div>
      `).join("") : '<div class="empty">No institutions saved yet.</div>';

      el.marks.innerHTML = summary.marks.length ? summary.marks.map((item, index) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(item.subject || item.name || `Subject ${index + 1}`)}</div>
              <div class="meta">Mark: ${esc(item.mark || item.percent || "-")} | Level: ${esc(item.level || "-")}</div>
            </div>
            <span class="chip c-blue">${esc(item.level || "Saved")}</span>
          </div>
        </div>
      `).join("") : '<div class="empty">No marks have been captured yet.</div>';

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
              ${documentHref(doc) ? `<a class="mini blue" href="${esc(documentHref(doc))}" target="_blank" rel="noopener">View file</a>` : ""}
              ${documentHref(doc) ? `<a class="mini green" href="${esc(documentHref(doc))}" target="_blank" rel="noopener" download>Download</a>` : ""}
              <button class="mini green" type="button" data-doc="${esc(doc.id)}|Approved">Approve</button>
              <button class="mini red" type="button" data-doc="${esc(doc.id)}|Rejected">Reject</button>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No documents uploaded yet.</div>';

      const timelineRows = [
        ...((app.timeline || []).map((entry) => ({
          title: entry.title || "Timeline event",
          message: "",
          status: entry.status || "Update",
          createdAt: entry.createdAt
        }))),
        ...(applicationUpdates || []).map((entry) => ({
          title: entry.title || "Application update",
          message: entry.message || "",
          status: entry.status || "Application Updated",
          createdAt: entry.updateAt || entry.createdAt
        }))
      ].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

      el.timeline.innerHTML = timelineRows.length ? timelineRows.map((entry) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(entry.title || "Timeline event")}</div>
              <div class="meta">${entry.message ? `${esc(entry.message)}<br>` : ""}${esc(dt(entry.createdAt))}</div>
            </div>
            <span class="chip ${chip(entry.status)}">${esc(entry.status || "Update")}</span>
          </div>
        </div>
      `).join("") : '<div class="empty">No timeline events available.</div>';

      el.notes.innerHTML = notes.length ? notes.map((note) => `
        <div class="item">
          <div class="title">${esc(api.getUserById(note.authorId)?.fullName || note.authorName || "Admin")}</div>
          <div class="meta">${esc(note.text || note.noteText || "-")}<br>${esc(dt(note.createdAt))}</div>
        </div>
      `).join("") : '<div class="empty">No notes recorded yet.</div>';
      renderPortalAccess();
      fillPortalForm();

      el.support.innerHTML = renderSupportThreads(supportTickets, supportMessages || []);
    }

    el.documents.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-doc]");
      const raw = button?.getAttribute("data-doc");
      if (!raw) return;
      const [docId, status] = raw.split("|");
      await runButtonAction(button, `doc:${docId}:${status}`, "Updating...", async () => {
        try {
          await (api.setDocumentReviewAsync ? api.setDocumentReviewAsync(docId, { status, comment: `Reviewed by ${api.currentUser()?.fullName || "Master Admin"}` }) : Promise.resolve(api.setDocumentReview(docId, { status, comment: `Reviewed by ${api.currentUser()?.fullName || "Master Admin"}` })));
          await render();
        } catch (error) {
          alert(error.message || "Could not update document review.");
        }
      });
    });

    el.support.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-support-ticket-status]");
      const raw = button?.getAttribute("data-support-ticket-status");
      if (!raw) return;
      const [ticketId, status] = raw.split("|");
      await runButtonAction(button, `support-ticket:${ticketId}:${status}`, "Updating...", async () => {
        try {
          await updateSupportTicketStatus(ticketId, status);
          await render();
          setMessage(el.supportMsg, `Support ticket marked ${supportStatusLabel(status)}.`, "ok");
        } catch (error) {
          setMessage(el.supportMsg, error.message || "Could not update support ticket.", "err");
        }
      });
    });

    el.adminForm.addEventListener("submit", (event) => runFormAction(event, el.formMsg, "Saving...", async () => {
      setMessage(el.formMsg, "");
      try {
        const app = appId ? normalizeApp(api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
        if (!app) throw new Error("Application could not be loaded.");
        const paymentReason = el.paymentReviewReason.value.trim();
        const currentPaymentReason = app.payment?.rejectionReason || app.payment?.verificationNote || "";

        if (el.assistantSelect.value) {
          if (el.assistantSelect.value !== (app.assignedAssistantId || "")) {
            await (api.assignAssistantAsync ? api.assignAssistantAsync(app.id, el.assistantSelect.value) : Promise.resolve(api.assignAssistant(app.id, el.assistantSelect.value)));
          }
        } else if (app.assignedAssistantId) {
          await (api.updateApplicationAsync ? api.updateApplicationAsync(app.id, { assistantId: null }) : Promise.resolve(api.updateApplication(app.id, { assistantId: null })));
        }

        const previousStatus = app.status || "Draft";
        await (api.updateApplicationAsync ? api.updateApplicationAsync(app.id, {
          status: el.statusSelect.value
        }) : Promise.resolve(api.updateApplication(app.id, {
          status: el.statusSelect.value
        })));
        if (el.statusSelect.value !== previousStatus && (api.postApplicationUpdateAsync || api.postApplicationUpdate)) {
          await (api.postApplicationUpdateAsync
            ? api.postApplicationUpdateAsync({
              applicationId: app.id,
              title: "Application status updated",
              message: `Your Kagie application status changed from ${previousStatus} to ${el.statusSelect.value}.`,
              status: el.statusSelect.value,
              actionLabel: "Open dashboard",
              actionUrl: "dashboard.html"
            })
            : Promise.resolve(api.postApplicationUpdate({
              applicationId: app.id,
              title: "Application status updated",
              message: `Your Kagie application status changed from ${previousStatus} to ${el.statusSelect.value}.`,
              status: el.statusSelect.value,
              actionLabel: "Open dashboard",
              actionUrl: "dashboard.html"
            })));
        }

        if ((el.paymentStatusSelect.value || "") !== (app.paymentStatus || "") || paymentReason !== currentPaymentReason) {
          if (api.reviewPaymentByAdminAsync) {
            await api.reviewPaymentByAdminAsync(app.id, {
              status: el.paymentStatusSelect.value,
              reason: paymentReason
            });
          } else if (api.reviewPaymentByAdmin) {
            api.reviewPaymentByAdmin(app.id, {
              status: el.paymentStatusSelect.value,
              reason: paymentReason
            });
          } else {
            await (api.updateApplicationAsync ? api.updateApplicationAsync(app.id, {
              paymentStatus: el.paymentStatusSelect.value
            }) : Promise.resolve(api.updateApplication(app.id, {
              paymentStatus: el.paymentStatusSelect.value
            })));
          }
        }

        const noteText = el.noteInput.value.trim();
        if (noteText) {
          await (api.addApplicationNoteAsync ? api.addApplicationNoteAsync(app.id, noteText) : Promise.resolve(api.addApplicationNote(app.id, noteText)));
          el.noteInput.value = "";
        }

        setMessage(el.formMsg, "Application updated successfully.", "ok");
        await render();
      } catch (error) {
        setMessage(el.formMsg, error.message || "Could not save changes.", "err");
      }
    }));

    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        el.statusSelect.value = button.getAttribute("data-status");
      });
    });

    document.querySelectorAll("[data-payment-status]").forEach((button) => {
      button.addEventListener("click", () => {
        el.paymentStatusSelect.value = button.getAttribute("data-payment-status");
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
      setMessage(el.supportMsg, "");
      const text = el.supportMessage.value.trim();
      if (!text) {
        setMessage(el.supportMsg, "Write a message first.", "err");
        return;
      }
      try {
        const app = appId ? normalizeApp(api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
        if (!app) throw new Error("Application could not be loaded.");
        await sendSupportReplyForApp(app, text);
        el.supportMessage.value = "";
        setMessage(el.supportMsg, "Support message sent.", "ok");
        await render();
      } catch (error) {
        setMessage(el.supportMsg, error.message || "Could not send support message.", "err");
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
        console.error("Master application view logout failed:", error);
      } finally {
        try {
          localStorage.removeItem("kagie_current_user");
          sessionStorage.removeItem("kagie_current_user");
        } catch (storageError) {
          console.warn("Master application logout cleanup failed:", storageError);
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
      if (!active || normalizeRole(active.role) !== "master_admin") {
        window.location.href = "../login.html";
        return;
      }
      alert(error.message || "Kagie could not load the application review page.");
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
