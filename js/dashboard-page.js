(function () {
  window.KagieDashboardPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin"].includes(value)) return "master_admin";
    return value || "user";
  };
  const fmtDate = (value) => {
    if (!value) return "No recent date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No recent date" : date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
  };
  const DEFAULT_AVATAR = "";

  const normalizeApp = (app) => ({
    ...app,
    items: Array.isArray(app?.items) && app.items.length ? app.items : Array.isArray(app?.institutions) ? app.institutions : []
  });

  const getInstitution = (app) => {
    const item = app?.items?.[0] || {};
    return firstFilled(item.institutionName, item.institution, app?.institution, "Institution not selected");
  };

  const getCourse = (app) => {
    const item = app?.items?.[0] || {};
    return firstFilled(item.choice1, item.course, app?.course, "Course not added");
  };

  const friendlyStatus = (app) => {
    const raw = String(app?.status || "").toLowerCase();
    if (raw.includes("accept")) return "Offer Received";
    if (raw.includes("document") || raw.includes("missing") || raw.includes("reject")) return "Action Needed";
    if (raw.includes("draft")) return "Draft";
    if (raw.includes("pending") || raw.includes("review") || raw.includes("submit") || raw.includes("progress")) return "Under Review";
    return app?.status || "Under Review";
  };

  const toneForStatus = (status) => {
    const value = String(status || "").toLowerCase();
    if (value.includes("offer") || value.includes("accept") || value.includes("upload")) return "success";
    if (value.includes("missing") || value.includes("action") || value.includes("reject")) return "danger";
    if (value.includes("draft")) return "neutral";
    return "warning";
  };

  const getPhoto = (api, user) => (
    api?.getSharedProfilePhoto?.() ||
    user?.profileImage ||
    localStorage.getItem("kagie_profile_photo") ||
    localStorage.getItem("kagieProfileImage") ||
    localStorage.getItem("kagie_profile_avatar_v1") ||
    DEFAULT_AVATAR
  );

  function buildDocumentRows(documents) {
    const uploaded = Array.isArray(documents) ? documents : [];
    const indexed = uploaded.map((doc, index) => ({
      ...doc,
      index,
      haystack: `${doc.name || ""} ${doc.category || ""}`.toLowerCase()
    }));
    const used = new Set();

    const takeMatch = (patterns) => {
      const match = indexed.find((doc) => !used.has(doc.index) && patterns.some((pattern) => doc.haystack.includes(pattern)));
      if (!match) return null;
      used.add(match.index);
      return match;
    };

    const required = [
      { name: "ID Document", match: takeMatch(["identity", "id document", "passport", "national id"]) },
      { name: "Grade 12 Results", match: takeMatch(["result", "grade 12", "matric", "marks", "statement"]) }
    ].map((item) => item.match
      ? {
          name: item.name,
          status: "Uploaded",
          meta: `${item.match.name || item.match.category || "Saved in Kagie"} | ${fmtDate(item.match.createdAt)}`
        }
      : {
          name: item.name,
          status: "Missing",
          meta: "Still needed in your Kagie account"
        });

    const extras = indexed
      .filter((doc) => !used.has(doc.index))
      .slice(0, 2)
      .map((doc) => ({
        name: doc.name || "Document",
        status: "Uploaded",
        meta: `${doc.category || "General"} | ${fmtDate(doc.createdAt)}`
      }));

    return required.concat(extras);
  }

  function renderApplications(applications) {
    const node = $("appList");
    if (!node) return;

    if (!applications.length) {
      node.innerHTML = `<div class="empty-card">No applications yet. Start your first Kagie application here.</div>`;
      return;
    }

    node.innerHTML = applications.slice(0, 4).map((app) => {
      const status = friendlyStatus(app);
      return `
        <div class="list-row">
          <div class="row-copy">
            <div class="row-title">${safe(getInstitution(app))}</div>
            <div class="row-subtitle">${safe(getCourse(app))}<br>Updated ${safe(fmtDate(app.updatedAt || app.createdAt))}</div>
          </div>
          <span class="status-chip ${safe(toneForStatus(status))}">${safe(status)}</span>
        </div>
      `;
    }).join("");
  }

  function renderDocuments(documentRows) {
    const node = $("docList");
    if (!node) return;

    if (!documentRows.length) {
      node.innerHTML = `<div class="empty-card">No documents tracked yet. Upload your first file to get started.</div>`;
      return;
    }

    node.innerHTML = documentRows.slice(0, 4).map((doc) => `
      <div class="list-row">
        <div class="row-copy">
          <div class="row-title">${safe(doc.name)}</div>
          <div class="row-subtitle">${safe(doc.meta)}</div>
        </div>
        <span class="status-chip ${safe(toneForStatus(doc.status))}">${safe(doc.status)}</span>
      </div>
    `).join("");
  }

  function renderSupport(messagesArg) {
    const node = $("supportList");
    if (!node) return;

    const messages = Array.isArray(messagesArg) ? messagesArg.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) : [];
    if (!messages.length) {
      node.innerHTML = `<div class="empty-card">No support messages yet. Open Kagie Support whenever you want help or an update.</div>`;
      return;
    }

    node.innerHTML = messages.slice(0, 3).map((message) => {
      const fromKagie = String(message.senderRole || "").toLowerCase() !== "user";
      const status = fromKagie ? "New reply" : "Sent";
      return `
        <div class="list-row">
          <div class="row-copy">
            <div class="row-title">${safe(fromKagie ? "Kagie Support" : "Your message")}</div>
            <div class="row-subtitle">${safe(message.text || "No message text")}<br>${safe(fmtDate(message.createdAt))}</div>
            <div class="row-actions">
              <a class="mini-link" href="personal-assistance.html">Open chat</a>
            </div>
          </div>
          <div class="list-side">
            <span class="status-chip ${safe(fromKagie ? "success" : "neutral")}">${safe(status)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderTools(payloadArg) {
    const node = $("toolList");
    if (!node) return;

    const payload = payloadArg || {};
    const accommodationCount = Number(payload.accommodationCount || 0);
    const accommodationRequests = Array.isArray(payload.accommodationRequests) ? payload.accommodationRequests : [];
    const transportRequests = Array.isArray(payload.transportRequests) ? payload.transportRequests : [];
    const serviceRequests = Array.isArray(payload.serviceRequests) ? payload.serviceRequests : [];

    const tools = [
      {
        title: "Accommodation Marketplace",
        subtitle: accommodationRequests.length
          ? `${accommodationRequests.length} housing request${accommodationRequests.length === 1 ? "" : "s"} tracked. ${accommodationCount} listings are ready to browse.`
          : `${accommodationCount} housing listing${accommodationCount === 1 ? "" : "s"} ready for you to browse.`,
        href: "more-service/accommodation-assist.html",
        cta: "Open housing",
        tone: accommodationRequests.length ? "success" : "neutral",
        badge: accommodationRequests.length ? `${accommodationRequests.length} request${accommodationRequests.length === 1 ? "" : "s"}` : `${accommodationCount} listings`
      },
      {
        title: "My Tickets",
        subtitle: transportRequests.length
          ? `${transportRequests.length} ticket${transportRequests.length === 1 ? "" : "s"} already linked to your Kagie account.`
          : "Transport tickets sent by Kagie will appear here once travel is arranged for you.",
        href: "more-service/transport-assist.html",
        cta: "Open tickets",
        tone: transportRequests.length ? "success" : "warning",
        badge: transportRequests.length ? `${transportRequests.length} ticket${transportRequests.length === 1 ? "" : "s"}` : "No tickets yet"
      },
      {
        title: "Career Practice",
        subtitle: "Open question papers, memos, and learner guides in one study space.",
        href: "career-guidance.html",
        cta: "Open practice",
        tone: "neutral",
        badge: "Study tools"
      },
      {
        title: "More Service",
        subtitle: serviceRequests.length
          ? `${serviceRequests.length} extra service item${serviceRequests.length === 1 ? "" : "s"} already tracked in your Kagie journey.`
          : "Funding help, corrections, housing, and tickets all stay in one place.",
        href: "more-service/index.html",
        cta: "Open services",
        tone: serviceRequests.length ? "success" : "neutral",
        badge: serviceRequests.length ? `${serviceRequests.length} active` : "Extra help"
      }
    ];

    node.innerHTML = tools.map((tool) => `
      <div class="list-row">
        <div class="row-copy">
          <div class="row-title">${safe(tool.title)}</div>
          <div class="row-subtitle">${safe(tool.subtitle)}</div>
          <div class="row-actions">
            <a class="mini-link" href="${safe(tool.href)}">${safe(tool.cta)}</a>
          </div>
        </div>
        <div class="list-side">
          <span class="status-chip ${safe(tool.tone)}">${safe(tool.badge)}</span>
        </div>
      </div>
    `).join("");
  }

  function renderNotices(noticesArg) {
    const node = $("noticeList");
    if (!node) return;

    const notices = Array.isArray(noticesArg) ? noticesArg : [];
    if (!notices.length) {
      node.innerHTML = `<div class="empty-card">Your latest Kagie reminders and updates will show here.</div>`;
      return;
    }

    const toneForNotice = (notice) => {
      const text = String(notice?.type || notice?.tone || "").toLowerCase();
      if (text.includes("success")) return "success";
      if (text.includes("warning")) return "warning";
      if (text.includes("error") || text.includes("danger")) return "danger";
      return "neutral";
    };

    node.innerHTML = notices.slice(0, 4).map((notice) => `
      <div class="list-row">
        <div class="row-copy">
          <div class="row-title">${safe(notice.title || "Kagie update")}</div>
          <div class="row-subtitle">${safe(notice.message || notice.text || "No update message")}<br>${safe(fmtDate(notice.createdAt || notice.date || notice.updatedAt))}</div>
        </div>
        <div class="list-side">
          <span class="status-chip ${safe(toneForNotice(notice))}">${safe(notice.read ? "Saved" : "New")}</span>
        </div>
      </div>
    `).join("");
  }

  function renderPortalAccess(entriesArg) {
    const node = $("portalAccessList");
    if (!node) return;

    const entries = Array.isArray(entriesArg) ? entriesArg : [];
    if (!entries.length) {
      node.innerHTML = `<div class="empty-card">Institution login details will appear here once a portal account, student number, or temporary password is ready.</div>`;
      return;
    }

    const statusMeta = (entry) => {
      if (entry.password) return { label: "Ready", tone: "success" };
      if (entry.deliveryNote) return { label: "Check inbox", tone: "warning" };
      return { label: "Saved", tone: "neutral" };
    };

    node.innerHTML = entries.slice(0, 4).map((entry) => {
      const status = statusMeta(entry);
      const details = [
        entry.applicationNumber ? `Application no: ${entry.applicationNumber}` : "",
        entry.studentNumber ? `Student no: ${entry.studentNumber}` : "",
        entry.username ? `Username: ${entry.username}` : "",
        entry.password ? `Password / PIN: ${entry.password}` : "",
        entry.deliveryNote ? `How you get it: ${entry.deliveryNote}` : "",
        entry.note ? entry.note : ""
      ].filter(Boolean);

      return `
        <div class="list-row">
          <div class="row-copy">
            <div class="row-title">${safe(entry.institutionName || "Institution portal")}</div>
            <div class="row-subtitle">${details.map((line) => safe(line)).join("<br>") || "Portal details will show here once they are available."}</div>
            <div class="row-actions">
              ${entry.portalLink ? `<a class="mini-link" href="${safe(entry.portalLink)}" target="_blank" rel="noopener">Open portal</a>` : ""}
            </div>
          </div>
          <div class="portal-side">
            <span class="status-chip ${safe(status.tone)}">${safe(status.label)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function setQuickAction(id, label, href) {
    const node = $(id);
    if (!node) return;
    node.textContent = label;
    node.setAttribute("href", href);
  }

  async function main() {
    const api = window.KagieAPI;
    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : await api.restoreSession();

    if (!restored || normalizeRole(restored.role) !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const summaryRaw = api.getDashboardSummaryAsync ? await api.getDashboardSummaryAsync(user.id) : api.getDashboardSummary(user.id);
    const summary = {
      ...summaryRaw,
      applications: Array.isArray(summaryRaw?.applications) ? summaryRaw.applications.map(normalizeApp) : [],
      latestApplication: summaryRaw?.latestApplication ? normalizeApp(summaryRaw.latestApplication) : null,
      documents: Array.isArray(summaryRaw?.documents) ? summaryRaw.documents : [],
      deadlines: Array.isArray(summaryRaw?.deadlines) ? summaryRaw.deadlines : [],
      priorityActions: Array.isArray(summaryRaw?.priorityActions) ? summaryRaw.priorityActions : []
    };

    const photo = getPhoto(api, user);
    const latest = summary.latestApplication || summary.applications[0] || null;
    const documentRows = buildDocumentRows(summary.documents);
    const missingDocs = documentRows.filter((doc) => doc.status === "Missing").length;
    const offers = summary.applications.filter((app) => String(app.status || "").toLowerCase().includes("accept")).length;
    const nextPriority = summary.priorityActions[0] || null;
    const supportThreadId = `support_${user.id}`;
    const supportMessages = api.getSupportMessagesAsync
      ? await api.getSupportMessagesAsync(supportThreadId).catch(() => (api.getSupportMessages ? api.getSupportMessages(supportThreadId) : []))
      : (api.getSupportMessages ? api.getSupportMessages(supportThreadId) : []);
    const accommodationListings = api.getAccommodationListingsAsync
      ? await api.getAccommodationListingsAsync({}).catch(() => (api.getAccommodationListings ? api.getAccommodationListings({}) : []))
      : (api.getAccommodationListings ? api.getAccommodationListings({}) : []);
    const portalAccess = latest?.id
      ? (api.getApplicationPortalAccessAsync
          ? await api.getApplicationPortalAccessAsync(latest.id).catch(() => (api.getApplicationPortalAccess ? api.getApplicationPortalAccess(latest.id) : []))
          : (api.getApplicationPortalAccess ? api.getApplicationPortalAccess(latest.id) : []))
      : [];

    const profilePhoto = $("profilePhoto");
    const profileFallback = $("profileFallback");
    if (photo) {
      profilePhoto.src = photo;
      profilePhoto.style.display = "block";
      profileFallback.style.display = "none";
    } else {
      profilePhoto.style.display = "none";
      profileFallback.style.display = "grid";
      profileFallback.textContent = (user.fullName || "K").trim().charAt(0).toUpperCase() || "K";
    }

    $("welcomeName").textContent = `Welcome back, ${(user.fullName || "Student").split(/\s+/)[0]}`;
    $("welcomeText").textContent = summary.applications.length
      ? "You're one step closer to your dream campus."
      : "Start your first application and keep everything in one Kagie dashboard.";

    $("applicationsStat").textContent = String(summary.applications.length);
    $("missingDocsStat").textContent = String(missingDocs);
    $("deadlinesStat").textContent = String(summary.deadlines.length);
    $("offersStat").textContent = String(offers);

    if (!summary.applications.length) {
      setQuickAction("startApplicationBtn", "Start Application", "forms.html");
      setQuickAction("continueApplicationBtn", "Complete Profile", "profile.html");
      setQuickAction("uploadBtn", "Upload Documents", "upload.html");
      setQuickAction("trackStatusBtn", "See Updates", "notifications.html");
    } else {
      setQuickAction("startApplicationBtn", "Add Institutions", "forms.html");
      setQuickAction("continueApplicationBtn", "Continue Application", "forms.html");
      setQuickAction("uploadBtn", missingDocs > 0 ? "Upload Missing Docs" : "My Documents", "upload.html");
      setQuickAction("trackStatusBtn", "Track Status", "#applicationsSection");
    }

    renderApplications(summary.applications);
    renderSupport(supportMessages);
    renderTools({
      accommodationCount: Array.isArray(accommodationListings) ? accommodationListings.length : 0,
      accommodationRequests: summary.accommodationRequests || [],
      transportRequests: summary.transportRequests || [],
      serviceRequests: summary.serviceRequests || []
    });
    renderDocuments(documentRows);
    renderPortalAccess(portalAccess);
    renderNotices(summary.notifications || []);

    let nextStepCopy = "Open your application and keep your details moving forward.";
    let nextStepHref = "forms.html";
    const latestSupportReply = Array.isArray(supportMessages)
      ? supportMessages
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .find((message) => String(message.senderRole || "").toLowerCase() !== "user")
      : null;

    if (missingDocs > 0) {
      nextStepCopy = "Upload the missing documents first so your Kagie application can keep moving smoothly.";
      nextStepHref = "upload.html";
    } else if (latestSupportReply) {
      nextStepCopy = "Kagie sent you a support reply. Open your support chat to read the latest message.";
      nextStepHref = "personal-assistance.html";
    } else if (nextPriority?.message) {
      nextStepCopy = nextPriority.message;
      nextStepHref = nextPriority.route || "forms.html";
    } else if (latest) {
      nextStepCopy = `${friendlyStatus(latest)} at ${getInstitution(latest)}. Open your application to review the latest details.`;
      nextStepHref = "forms.html";
    }

    $("nextStepCopy").textContent = nextStepCopy;
    $("nextStepLink").setAttribute("href", nextStepHref);

    $("trackStatusBtn").addEventListener("click", (event) => {
      const target = $("trackStatusBtn")?.getAttribute("href");
      if (target !== "#applicationsSection") return;
      event.preventDefault();
      $("applicationsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("logoutBtn").addEventListener("click", async () => {
      try {
        await Promise.resolve(api.logout());
      } finally {
        window.location.href = "login.html";
      }
    });
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const active = window.KagieAPI?.currentUser?.();
      if (!active || normalizeRole(active.role) !== "user") {
        window.location.href = "login.html";
        return;
      }
      $("welcomeName").textContent = `Welcome back, ${(active.fullName || "Student").split(/\s+/)[0]}`;
      $("welcomeText").textContent = "Kagie could not load your dashboard fully right now. Refresh and continue.";
      setQuickAction("startApplicationBtn", "Start Application", "forms.html");
      setQuickAction("continueApplicationBtn", "Complete Profile", "profile.html");
      setQuickAction("uploadBtn", "Upload Documents", "upload.html");
      setQuickAction("trackStatusBtn", "See Updates", "notifications.html");
      renderApplications([]);
      renderSupport([]);
      renderTools({
        accommodationCount: 0,
        accommodationRequests: [],
        transportRequests: [],
        serviceRequests: []
      });
      renderDocuments([]);
      renderPortalAccess([]);
      renderNotices([]);
      $("nextStepCopy").textContent = "Refresh the page and Kagie will try again.";
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
