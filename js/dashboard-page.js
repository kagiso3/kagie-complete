(function () {
  window.KagieDashboardPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const asArray = (value) => Array.isArray(value) ? value : [];

  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff", "support-staff", "support staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(value)) return "master_admin";
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    return value || "user";
  };

  const setText = (id, value) => {
    const node = $(id);
    if (node) node.textContent = String(value ?? "");
  };

  const fmtDate = (value) => {
    if (!value) return "Not submitted yet";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Not submitted yet"
      : date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  };

  const normalizeApp = (app) => ({
    ...app,
    applicationTypeLabel: applicationTypeLabel(app),
    items: asArray(app?.items).length ? app.items : asArray(app?.institutions)
  });

  function applicationTypeLabel(app) {
    let type = String(firstFilled(app?.applicationType, app?.forms?.applicationType?.type, app?.applicationTypeLabel, app?.forms?.applicationType?.label, app?.applicationEngine?.type))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (["late", "late_application", "late_applications"].includes(type)) type = "late";
    else if (["bridging", "bridge", "bridging_programme", "bridging_programmes"].includes(type)) type = "bridging";
    else if (["postgraduate", "post_graduate", "post_graduate_application", "post_graduate_applications", "post_grad", "postgrad"].includes(type)) type = "postgraduate";
    else if (["undergraduate", "undergrad", "under_graduate", "undergraduate_application", "undergraduate_applications", "under_graduate_application", "under_graduate_applications"].includes(type)) type = "undergraduate";
    else if (type.includes("transfer")) type = "transfer";
    const labels = {
      undergraduate: "Undergraduate Applications",
      late: "Late Applications",
      postgraduate: "Postgraduate Applications",
      transfer: "Transfer Applications",
      bridging: "Bridging Programmes"
    };
    return labels[type] || firstFilled(app?.applicationTypeLabel, app?.forms?.applicationType?.label, "Undergraduate Applications");
  }
  function applicationTypeKey(app) {
    let type = String(firstFilled(app?.applicationType, app?.forms?.applicationType?.type, app?.applicationTypeLabel, app?.forms?.applicationType?.label, app?.applicationEngine?.type))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (["late", "late_application", "late_applications"].includes(type)) return "late";
    if (["bridging", "bridge", "bridging_programme", "bridging_programmes"].includes(type)) return "bridging";
    if (["postgraduate", "post_graduate", "post_graduate_application", "post_graduate_applications", "post_grad", "postgrad"].includes(type)) return "postgraduate";
    if (["undergraduate", "undergrad", "under_graduate", "undergraduate_application", "undergraduate_applications", "under_graduate_application", "under_graduate_applications"].includes(type)) return "undergraduate";
    if (type.includes("transfer")) return "transfer";
    return "undergraduate";
  }
  const hasTextValue = (value) => String(value ?? "").trim().length > 0;

  const hasObjectValue = (value) => {
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some((item) => Array.isArray(item) ? item.length > 0 : hasTextValue(item));
  };

  const hasApplicationProgress = (app) => {
    if (!app) return false;
    const status = String(app.status || "").trim().toLowerCase();
    const paymentStatus = String(app.paymentStatus || app.payment?.status || "").trim().toLowerCase();
    const hasPaymentProgress = Boolean(paymentStatus && !["pending", "payment pending"].includes(paymentStatus));
    const payment = app.payment || {};
    const packageData = app.package || app.packageId || app.selectedPackId;
    const hasPackage = typeof packageData === "object" ? hasObjectValue(packageData) : hasTextValue(packageData);
    const institutionCount = Number(app.institutionCount || 0);
    const marks = asArray(app.forms?.marks?.subjects).length || asArray(app.marks).length;

    return Boolean(
      (status && !status.includes("draft"))
      || hasTextValue(app.submittedAt)
      || hasTextValue(app.appliedAt)
      || asArray(app.items).length
      || asArray(app.institutions).length
      || institutionCount > 0
      || hasPackage
      || marks > 0
      || asArray(app.services).length
      || hasTextValue(app.assistantId)
      || hasTextValue(app.assignedAssistantId)
      || hasPaymentProgress
      || (app.payment && (
        hasPaymentProgress
        || hasTextValue(payment.reference)
        || hasTextValue(payment.proofUploadedAt)
        || hasTextValue(payment.proofDocumentId)
        || hasTextValue(payment.gatewayCheckoutId)
        || hasTextValue(payment.gatewayPaymentId)
      ))
    );
  };

  const getInstitution = (app) => {
    const item = app?.items?.[0] || {};
    return firstFilled(item.institutionName, item.institution, item.university, app?.institution, "Institution not selected");
  };

  const getCourse = (app) => {
    const item = app?.items?.[0] || {};
    return firstFilled(item.choice1, item.course, item.programme, app?.course, "Course not added");
  };

  const appInitials = (name) => {
    const words = String(name || "Kagie").replace(/of|the|and/gi, " ").split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("") || "KG";
  };

  const friendlyStatus = (app) => {
    const raw = String(app?.status || "").toLowerCase();
    const payment = String(app?.paymentStatus || app?.payment?.status || "").toLowerCase();
    if (raw.includes("accept")) return "Offer";
    if (raw.includes("reject")) return "Rejected";
    if (raw.includes("pending details") || raw.includes("incomplete")) return "Pending Details";
    if (raw.includes("missing") || raw.includes("document") || payment.includes("reject")) return "Action Needed";
    if (raw.includes("draft")) return "Not Started";
    if (raw.includes("process") || raw.includes("review") || raw.includes("submit") || payment.includes("verification")) return "In Progress";
    return app?.status || "In Progress";
  };

  const badgeClass = (status) => {
    const value = String(status || "").toLowerCase();
    if (value.includes("offer") || value.includes("accept")) return "badge-green";
    if (value.includes("action") || value.includes("reject") || value.includes("missing")) return "badge-red";
    if (value.includes("not started") || value.includes("draft")) return "badge-gray";
    if (value.includes("pending details") || value.includes("incomplete")) return "badge-orange";
    if (value.includes("progress") || value.includes("review") || value.includes("submit")) return "badge-orange";
    return "badge-blue";
  };

  const appNeedsDetails = (app) => {
    const status = String(app?.status || "").toLowerCase();
    return status.includes("pending details") || status.includes("incomplete");
  };
  const friendlyPaymentStatus = (app) => firstFilled(app?.paymentStatus, app?.payment?.status, "Payment Pending");
  const paymentHasBeenReceived = (app) => {
    const payment = String(friendlyPaymentStatus(app)).toLowerCase();
    return payment.includes("pending verification")
      || payment.includes("verified")
      || payment.includes("paid");
  };

  const formHrefForApp = (app, mode = "continue") => {
    const type = applicationTypeKey(app);
    const step = type === "late"
      ? "late"
      : (["postgraduate", "transfer", "bridging"].includes(type) ? "dynamic" : (mode === "checkout" ? "pack" : "learner"));
    const params = new URLSearchParams({ applicationType: type, step });
    if (app?.id) params.set("applicationId", app.id);
    return `forms.html?${params.toString()}`;
  };

  const appNeedsAction = (app) => {
    const status = String(app?.status || "").toLowerCase();
    const payment = String(app?.paymentStatus || app?.payment?.status || "").toLowerCase();
    return appNeedsDetails(app)
      || status.includes("missing")
      || status.includes("reject")
      || status.includes("document")
      || payment.includes("reject")
      || (payment.includes("pending") && !app?.payment?.proofUploadedAt);
  };

  function buildDocumentRows(documents) {
    const uploaded = asArray(documents);
    const indexed = uploaded.map((doc, index) => ({
      ...doc,
      index,
      haystack: `${doc.name || ""} ${doc.category || ""} ${doc.type || ""}`.toLowerCase()
    }));
    const used = new Set();

    const takeMatch = (patterns) => {
      const match = indexed.find((doc) => !used.has(doc.index) && patterns.some((pattern) => doc.haystack.includes(pattern)));
      if (!match) return null;
      used.add(match.index);
      return match;
    };

    const required = [
      { name: "ID Document", match: takeMatch(["identity", "id document", "passport", "national id", "id_document"]) },
      { name: "Grade 12 Results", match: takeMatch(["result", "grade 12", "matric", "marks", "statement"]) }
    ].map((item) => item.match
      ? {
          name: item.name,
          status: item.match.status || "Uploaded",
          meta: `${item.match.name || item.match.category || "Saved in Kagie"} | ${fmtDate(item.match.createdAt || item.match.updatedAt)}`
        }
      : {
          name: item.name,
          status: "Missing",
          meta: "Still needed in your Kagie account"
        });

    return required.concat(indexed
      .filter((doc) => !used.has(doc.index))
      .map((doc) => ({
        name: doc.name || "Document",
        status: doc.status || "Uploaded",
        meta: `${doc.category || "General"} | ${fmtDate(doc.createdAt || doc.updatedAt)}`
      })));
  }

  function isVerifiedDocument(doc, reviews) {
    const status = String(doc?.status || "").toLowerCase();
    if (status.includes("approv") || status.includes("verified")) return true;
    return asArray(reviews).some((review) => {
      const reviewStatus = String(review?.status || "").toLowerCase();
      return (review.documentId && review.documentId === doc.id) && (reviewStatus.includes("approv") || reviewStatus.includes("verified"));
    });
  }

  function renderOverview(summary, documentRows) {
    const applications = asArray(summary.applications);
    const offers = applications.filter((app) => /accept|offer/i.test(`${app.status || ""} ${app.paymentStatus || ""}`)).length;
    const inProgress = applications.filter((app) => {
      const status = friendlyStatus(app);
      return !/offer|rejected|not started/i.test(status);
    }).length;
    const missingDocs = documentRows.filter((doc) => doc.status === "Missing").length;
    const requiredActions = applications.length
      ? Math.max(missingDocs, asArray(summary.priorityActions).length, applications.filter(appNeedsAction).length, asArray(summary.pendingTasks).length)
      : 0;

    setText("applicationsStat", applications.length);
    setText("inProgressStat", inProgress);
    setText("offersStat", offers);
    setText("requiredActionStat", requiredActions);
  }

  function renderApplications(applicationsArg) {
    const node = $("appList");
    if (!node) return;

    const applications = asArray(applicationsArg);
    if (!applications.length) {
      node.innerHTML = `<div class="empty-card">No applications yet. Tap Apply on the home screen to start your first Kagie application.</div>`;
      return;
    }

    node.innerHTML = applications.slice(0, 4).map((app) => {
      const institution = getInstitution(app);
      const status = friendlyStatus(app);
      const needsDetails = appNeedsDetails(app);
      const paymentStatus = friendlyPaymentStatus(app);
      const showPaymentNotice = needsDetails && paymentHasBeenReceived(app);
      const editHref = formHrefForApp(app, "edit");
      const continueHref = formHrefForApp(app, "continue");
      const actions = [
        {
          href: continueHref,
          label: needsDetails ? "Complete Application" : "Continue Application",
          primary: true
        }
      ];
      if (editHref !== continueHref) {
        actions.push({ href: editHref, label: "Edit Details" });
      }
      return `
        <div class="app-row ${needsDetails ? "needs-details" : ""}">
          <div class="app-main">
            <div class="app-logo"><div class="logo-mark">${safe(appInitials(institution))}</div></div>
            <div class="app-info">
              <div class="app-name">${safe(institution)}</div>
              <div class="app-course">${safe(app.applicationTypeLabel)} | ${safe(getCourse(app))}</div>
              <div class="app-date">Applied: ${safe(fmtDate(app.submittedAt || app.appliedAt || app.createdAt))}</div>
            </div>
            <div class="app-status-stack">
              <span class="badge ${safe(badgeClass(status))}">${safe(status)}</span>
              <span class="payment-badge">${safe(paymentStatus)}</span>
            </div>
          </div>
          ${needsDetails ? `<div class="app-alert">This application still requires information before final submission.</div>` : ""}
          ${showPaymentNotice ? `<div class="app-payment-notice">Your payment has been received. Please complete the remaining application details before submitting your application for review.</div>` : ""}
          <div class="app-actions">
            ${actions.map((action) => `<a class="app-action ${action.primary ? "primary" : ""}" href="${safe(action.href)}">${safe(action.label)}</a>`).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  function statusStage(summary, documentRows) {
    const latest = summary.latestApplication || asArray(summary.applications)[0] || null;
    const docsUploaded = documentRows.some((doc) => doc.status !== "Missing");
    const docsDone = documentRows.length > 0 && documentRows.every((doc) => doc.status !== "Missing");
    const pendingDetails = latest && appNeedsDetails(latest);
    const submitted = latest && !pendingDetails && !/draft/i.test(String(latest.status || ""));
    const accepted = /accept|offer/i.test(String(latest?.status || ""));
    const forms = latest?.forms || {};
    const hasAcademic = asArray(forms?.marks?.subjects).length > 0 || Boolean(forms?.school || forms?.academic);

    if (accepted || submitted) return 4;
    if (docsDone) return 4;
    if (docsUploaded) return 3;
    if (hasAcademic || latest) return 2;
    return 1;
  }

  function renderStatusSteps(summary, documentRows) {
    const node = $("statusSteps");
    if (!node) return;

    const activeStage = statusStage(summary, documentRows);
    const steps = [
      ["Personal", "Information"],
      ["Academic", "Details"],
      ["Documents", ""],
      ["Review", "& Submit"]
    ];

    node.innerHTML = steps.map((step, index) => {
      const stage = index + 1;
      const state = stage < activeStage ? "done" : stage === activeStage ? "active" : "pending";
      const label = state === "done" ? "Completed" : state === "active" ? "In Progress" : "Pending";
      return `
        <div class="step-item ${state}">
          <div class="step-circle ${state}">${stage}</div>
          <div class="step-lbl">${safe(step[0])}${step[1] ? `<br>${safe(step[1])}` : ""}</div>
          <div class="step-status ${state}">${safe(label)}</div>
        </div>
      `;
    }).join("");
  }

  function renderDocuments(documentRows, reviews) {
    const requiredCount = 2;
    const uploadedRows = documentRows.filter((doc) => doc.status !== "Missing");
    const verified = uploadedRows.filter((doc) => isVerifiedDocument(doc, reviews)).length;
    const missing = documentRows
      .slice(0, requiredCount)
      .filter((doc) => doc.status === "Missing").length;

    setText("requiredDocsStat", requiredCount);
    setText("uploadedDocsStat", uploadedRows.length);
    setText("verifiedDocsStat", verified);
    setText("missingDocsStat", missing);
    return missing;
  }

  function renderPortalAccess(entriesArg) {
    const node = $("portalAccessList");
    if (!node) return;

    const entries = asArray(entriesArg);
    if (!entries.length) {
      node.innerHTML = `<div class="empty-card">Institution login details will appear here once Kagie has a student number, portal account, or temporary password ready.</div>`;
      return;
    }

    node.innerHTML = entries.slice(0, 3).map((entry) => {
      const details = [
        entry.applicationNumber ? `Application no: ${entry.applicationNumber}` : "",
        entry.studentNumber ? `Student no: ${entry.studentNumber}` : "",
        entry.username ? `Username: ${entry.username}` : "",
        entry.password ? `Password / PIN: ${entry.password}` : "",
        entry.deliveryNote ? entry.deliveryNote : ""
      ].filter(Boolean);

      return `
        <div class="compact-row">
          <div>
            <div class="compact-title">${safe(entry.institutionName || "Institution portal")}</div>
            <div class="compact-copy">${details.map((line) => safe(line)).join("<br>") || "Portal details will show here once they are available."}</div>
          </div>
          ${entry.portalLink ? `<a class="compact-link" href="${safe(entry.portalLink)}" target="_blank" rel="noopener">Open</a>` : ""}
        </div>
      `;
    }).join("");
  }

  function supportStatusLabel(statusArg) {
    const status = String(statusArg || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    const labels = {
      open: "Open",
      in_progress: "In progress",
      awaiting_user: "Awaiting your reply",
      resolved: "Resolved",
      closed: "Closed"
    };
    return labels[status] || "Open";
  }

  function renderSupport(ticketsArg, messagesArg) {
    const node = $("supportList");
    if (!node) return;

    const tickets = asArray(ticketsArg).slice().sort((a, b) => new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0));
    if (tickets.length) {
      node.innerHTML = tickets.slice(0, 3).map((ticket) => `
        <div class="compact-row">
          <div>
            <div class="compact-title">${safe(ticket.subject || "Support request")}</div>
            <div class="compact-copy">${safe(supportStatusLabel(ticket.status))}<br>${safe(fmtDate(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt))}</div>
          </div>
          <a class="compact-link" href="personal-assistance.html">Open</a>
        </div>
      `).join("");
      return;
    }

    const messages = asArray(messagesArg).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    if (!messages.length) {
      node.innerHTML = `<div class="empty-card">No support tickets yet. Open Kagie Support whenever you want help or an update.</div>`;
      return;
    }

    node.innerHTML = messages.slice(0, 3).map((message) => {
      const fromKagie = String(message.senderRole || "").toLowerCase() !== "user";
      return `
        <div class="compact-row">
          <div>
            <div class="compact-title">${safe(fromKagie ? "Kagie Support" : "Your message")}</div>
            <div class="compact-copy">${safe(message.text || "No message text")}<br>${safe(fmtDate(message.createdAt))}</div>
          </div>
          <a class="compact-link" href="personal-assistance.html">Chat</a>
        </div>
      `;
    }).join("");
  }

  function renderApplicationUpdates(updatesArg) {
    const node = $("applicationUpdatesList");
    if (!node) return;

    const updates = asArray(updatesArg).slice().sort((a, b) => new Date(b.updateAt || b.createdAt || 0) - new Date(a.updateAt || a.createdAt || 0));
    if (!updates.length) {
      node.innerHTML = `<div class="empty-card">No official Kagie updates yet. Status messages from admins will appear here.</div>`;
      return;
    }

    node.innerHTML = updates.slice(0, 4).map((update) => {
      const href = update.actionUrl || "updates.html";
      const label = update.actionLabel || "Open";
      return `
        <div class="compact-row">
          <div>
            <div class="compact-title">${safe(update.title || update.status || "Kagie update")}</div>
            <div class="compact-copy">${safe(update.message || "No message text")}<br>${safe(fmtDate(update.updateAt || update.createdAt))}</div>
          </div>
          <a class="compact-link" href="${safe(href)}">${safe(label)}</a>
        </div>
      `;
    }).join("");
  }

  function setNextStep(summary, missingDocs, supportTickets, supportMessages, applicationUpdates) {
    const latest = summary.latestApplication || asArray(summary.applications)[0] || null;
    const latestSupportTicket = asArray(supportTickets)
      .slice()
      .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0))
      .find((ticket) => ["awaiting_user", "in_progress"].includes(String(ticket.status || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")));
    const latestSupportReply = asArray(supportMessages)
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .find((message) => String(message.senderRole || "").toLowerCase() !== "user");
    const latestApplicationUpdate = asArray(applicationUpdates)
      .slice()
      .sort((a, b) => new Date(b.updateAt || b.createdAt || 0) - new Date(a.updateAt || a.createdAt || 0))[0] || null;
    const nextPriority = asArray(summary.priorityActions)[0] || null;

    let copy = "Open your application and keep your details moving forward.";
    let href = "forms.html";
    let label = "Open";
    let urgent = false;

    if (!asArray(summary.applications).length) {
      copy = "Start your first Kagie application so your progress, documents, and updates can appear here.";
      href = "forms.html";
      label = "Start";
    } else if (latestApplicationUpdate && !latestApplicationUpdate.read) {
      copy = latestApplicationUpdate.message || latestApplicationUpdate.title || "Kagie posted a new application update.";
      href = latestApplicationUpdate.actionUrl || "updates.html";
      label = latestApplicationUpdate.actionLabel || "Read update";
      urgent = true;
    } else if (latest && appNeedsDetails(latest)) {
      const typeLabel = latest.applicationTypeLabel || applicationTypeLabel(latest);
      copy = paymentHasBeenReceived(latest)
        ? `Your payment is saved. Complete the remaining ${typeLabel} details so Kagie can submit it for review.`
        : `Complete the remaining ${typeLabel} details so Kagie can keep this application moving.`;
      href = formHrefForApp(latest, "continue");
      label = "Complete";
      urgent = true;
    } else if (missingDocs > 0) {
      copy = "Upload your missing documents so Kagie can keep your application moving.";
      href = "upload.html";
      label = "Upload";
    } else if (latestSupportTicket) {
      copy = `Kagie updated your support ticket: ${latestSupportTicket.subject || "Support request"}.`;
      href = "personal-assistance.html";
      label = "Open";
    } else if (latestSupportReply) {
      copy = "Kagie sent you a support reply. Open chat to read the latest message.";
      href = "personal-assistance.html";
      label = "Chat";
    } else if (nextPriority?.message) {
      copy = nextPriority.message;
      href = nextPriority.route || "forms.html";
    } else if (latest) {
      copy = `${friendlyStatus(latest)} at ${getInstitution(latest)}. Open your application to review the latest details.`;
      href = "forms.html";
    }

    setText("nextStepCopy", copy);
    const link = $("nextStepLink");
    if (link) {
      link.setAttribute("href", href);
      link.textContent = label;
      link.closest(".next-card")?.classList.toggle("urgent", urgent);
    }
  }

  async function maybeCall(fn, fallback) {
    try {
      if (typeof fn !== "function") return fallback;
      return await fn();
    } catch (error) {
      console.warn(error);
      return fallback;
    }
  }

  async function main() {
    const api = window.KagieAPI;
    if (!api) throw new Error("Kagie dashboard services are still loading. Refresh and try again.");

    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : await api.restoreSession?.();

    if (!restored) {
      window.location.href = "login.html";
      return;
    }

    const role = normalizeRole(restored.role);
    if (role === "assistant_admin") {
      window.location.href = "assistant/dashboard.html";
      return;
    }
    if (role === "master_admin") {
      window.location.href = "master-admin/dashboard.html";
      return;
    }
    if (role !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole ? api.requireRole("user") : restored;
    const summaryRaw = await maybeCall(
      () => api.getDashboardSummaryAsync ? api.getDashboardSummaryAsync(user.id) : api.getDashboardSummary?.(user.id),
      {}
    );
    const applications = asArray(summaryRaw?.applications)
      .map(normalizeApp)
      .filter(hasApplicationProgress);
    const latestApplication = summaryRaw?.latestApplication ? normalizeApp(summaryRaw.latestApplication) : null;
    const meaningfulLatest = hasApplicationProgress(latestApplication)
      ? latestApplication
      : applications[0] || null;
    const summary = {
      ...summaryRaw,
      applications,
      latestApplication: meaningfulLatest,
      documents: asArray(summaryRaw?.documents),
      reviews: asArray(summaryRaw?.reviews),
      priorityActions: asArray(summaryRaw?.priorityActions),
      pendingTasks: asArray(summaryRaw?.pendingTasks)
    };

    const latest = summary.latestApplication || summary.applications[0] || null;
    const supportThreadId = `support_${user.id}`;
    const supportTickets = await maybeCall(
      () => api.getSupportTicketsAsync ? api.getSupportTicketsAsync({ userId: user.id }) : api.getSupportTickets?.({ userId: user.id }),
      []
    );
    const supportMessages = await maybeCall(
      () => api.getSupportMessagesAsync ? api.getSupportMessagesAsync(supportThreadId) : api.getSupportMessages?.(supportThreadId),
      []
    );
    const applicationUpdates = await maybeCall(
      () => api.getApplicationUpdatesAsync ? api.getApplicationUpdatesAsync(user.id) : api.getApplicationUpdates?.(user.id),
      []
    );
    const portalAccess = latest?.id
      ? await maybeCall(
          () => api.getApplicationPortalAccessAsync ? api.getApplicationPortalAccessAsync(latest.id) : api.getApplicationPortalAccess?.(latest.id),
          []
        )
      : [];

    const documentRows = buildDocumentRows(summary.documents);
    renderOverview(summary, documentRows);
    renderApplications(summary.applications);
    renderStatusSteps(summary, documentRows);
    const missingDocs = renderDocuments(documentRows, summary.reviews);
    renderApplicationUpdates(applicationUpdates);
    renderPortalAccess(portalAccess);
    renderSupport(supportTickets, supportMessages);
    setNextStep(summary, missingDocs, supportTickets, supportMessages, applicationUpdates);
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const active = window.KagieAPI?.currentUser?.();
      if (!active || normalizeRole(active.role) !== "user") {
        window.location.href = "login.html";
        return;
      }
      renderOverview({ applications: [], priorityActions: [], pendingTasks: [] }, buildDocumentRows([]));
      renderApplications([]);
      renderStatusSteps({}, buildDocumentRows([]));
      renderDocuments(buildDocumentRows([]), []);
      renderApplicationUpdates([]);
      renderPortalAccess([]);
      renderSupport([], []);
      setText("nextStepCopy", "Refresh the page and Kagie will try loading your dashboard again.");
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
