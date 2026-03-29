(function () {
  window.KagieAssistantApplicantViewPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
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

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "assistant_admin") {
      window.location.href = "../login.html";
      return;
    }

    const assistant = api.requireRole("assistant_admin");
    const appId = new URLSearchParams(window.location.search).get("id");
    const el = {
      hero: $("hero"),
      layout: $("layout"),
      details: $("details"),
      institutions: $("institutions"),
      documents: $("documents"),
      statusSelect: $("statusSelect"),
      noteInput: $("noteInput"),
      controlForm: $("controlForm"),
      controlMsg: $("controlMsg"),
      notes: $("notes"),
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
    const detailBoxes = (pairs) => pairs.map(([label, value]) => `
      <div class="box">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(value || "-")}</div>
      </div>
    `).join("");

    async function loadViewData() {
      const rawApp = appId ? (api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
      const app = rawApp ? normalizeApp(rawApp) : null;
      if (!app) return { app: null };

      const profile = api.getProfileAsync ? await api.getProfileAsync(app.userId).catch(() => (api.getProfile(app.userId) || {})) : (api.getProfile(app.userId) || {});
      const user = api.getUserById(app.userId) || {};
      const [docs, notes, reviews, supportMessages, callbackItems] = await Promise.all([
        api.getDocumentsByUserAsync ? api.getDocumentsByUserAsync(app.userId) : api.getDocumentsByUser(app.userId),
        api.getApplicationNotesAsync ? api.getApplicationNotesAsync(app.id) : api.getApplicationNotes(app.id),
        api.getDocumentReviewsForUserAsync ? api.getDocumentReviewsForUserAsync(app.userId) : api.getDocumentReviewsForUser(app.userId),
        api.getSupportMessagesAsync ? api.getSupportMessagesAsync(`support_${app.userId}`) : api.getSupportMessages(`support_${app.userId}`),
        (api.getCallRequestsAsync ? api.getCallRequestsAsync() : api.getCallRequests()).then((items) => (items || []).filter((item) => item.requesterId === app.userId))
      ]);

      return { app, profile, user, docs: docs || [], notes: notes || [], reviews: reviews || [], supportMessages: supportMessages || [], callbackItems: callbackItems || [] };
    }

    async function render() {
      const { app, profile, user, docs, notes, reviews, supportMessages, callbackItems } = await loadViewData();
      if (!app) {
        el.hero.innerHTML = '<div class="hero-row"><div><h2>Application not found</h2><p>This applicant record could not be loaded.</p></div></div>';
        return;
      }
      if (app.assignedAssistantId !== assistant.id) {
        el.hero.innerHTML = '<div class="hero-row"><div><h2>Access blocked</h2><p>This application is not assigned to your assistant account.</p></div></div>';
        return;
      }

      el.layout.hidden = false;
      el.hero.innerHTML = `
        <div class="hero-row">
          <div>
            <h2>${esc(user.fullName || app.applicant || "Applicant")}</h2>
            <p>Email: ${esc(user.email || "-")}<br>Application ID: ${esc(app.id)}<br>Assigned assistant: ${esc(assistant.fullName || "Assistant")}</p>
          </div>
          <div class="chips">
            <span class="chip c-blue">${esc(app.status || "Under Review")}</span>
            <span class="chip c-blue">${esc(app.paymentStatus || "Payment Pending")}</span>
          </div>
        </div>
      `;

      el.details.innerHTML = detailBoxes([
        ["Full name", profile.fullName || user.fullName],
        ["Email", profile.email || user.email],
        ["Phone", profile.phone || user.phone],
        ["ID number", profile.idNumber],
        ["Province", profile.province],
        ["School", profile.schoolName || profile.schoolAttended],
        ["Average", profile.average],
        ["Guardian", profile.guardianName || profile.guardianFullNames],
        ["Guardian phone", profile.guardianPhone || profile.guardianCell1],
        ["Home language", profile.homeLanguage]
      ]);

      el.statusSelect.value = app.status || "Under Review";

      el.institutions.innerHTML = app.items.length ? app.items.map((item, index) => `
        <div class="item">
          <div class="title">${esc(index + 1)}. ${esc(item.institution || item.institutionName || "Institution")}</div>
          <div class="meta">Province: ${esc(item.province || "-")}<br>Faculty: ${esc(item.faculty || "-")}<br>Choice 1: ${esc(item.choice1 || "-")}<br>Choice 2: ${esc(item.choice2 || "-")}<br>Choice 3: ${esc(item.choice3 || "-")}</div>
        </div>
      `).join("") : '<div class="empty">No institutions saved yet.</div>';

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
      const raw = event.target.getAttribute("data-doc");
      if (!raw) return;
      const [docId, status] = raw.split("|");
      try {
        await (api.setDocumentReviewAsync ? api.setDocumentReviewAsync(docId, { status, comment: `Updated by ${assistant.fullName}` }) : Promise.resolve(api.setDocumentReview(docId, { status, comment: `Updated by ${assistant.fullName}` })));
        await render();
      } catch (error) {
        alert(error.message || "Could not update document review.");
      }
    });

    el.callbacks.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-call");
      if (!raw) return;
      const [callId, status] = raw.split("|");
      try {
        await (api.updateCallRequestAsync ? api.updateCallRequestAsync(callId, { status }) : Promise.resolve(api.updateCallRequest(callId, { status })));
        await render();
      } catch (error) {
        alert(error.message || "Could not update callback request.");
      }
    });

    el.controlForm.addEventListener("submit", async (event) => {
      event.preventDefault();
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
    });

    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        el.statusSelect.value = button.getAttribute("data-status");
      });
    });

    el.supportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
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
    });

    el.logoutBtn.addEventListener("click", async () => {
      try {
        await Promise.resolve(api.logout());
      } finally {
        window.location.href = "../login.html";
      }
    });

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load the applicant workspace.");
      window.location.href = "../login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
