(function () {
  window.KagieMasterApplicationViewPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
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
  const normalizeApp = (app) => ({
    ...app,
    assignedAssistantId: app?.assignedAssistantId || app?.assistantId || null,
    items: Array.isArray(app?.items) && app.items.length ? app.items : Array.isArray(app?.institutions) ? app.institutions : []
  });

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "master_admin") {
      window.location.href = "../login.html";
      return;
    }

    api.requireRole("master_admin");
    const appId = new URLSearchParams(window.location.search).get("id");
    const el = {
      hero: $("hero"),
      layout: $("layout"),
      details: $("details"),
      institutions: $("institutions"),
      documents: $("documents"),
      timeline: $("timeline"),
      assistantSelect: $("assistantSelect"),
      statusSelect: $("statusSelect"),
      paymentStatusSelect: $("paymentStatusSelect"),
      noteInput: $("noteInput"),
      adminForm: $("adminForm"),
      formMsg: $("formMsg"),
      payment: $("payment"),
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
    const detailBoxes = (pairs) => pairs.map(([label, value]) => `
      <div class="box">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(value || "-")}</div>
      </div>
    `).join("");

    async function loadData() {
      const rawApp = appId ? (api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
      const app = rawApp ? normalizeApp(rawApp) : null;
      if (!app) return { app: null };

      const [profile, assistants, docs, notes, reviews, supportMessages] = await Promise.all([
        api.getProfileAsync ? api.getProfileAsync(app.userId).catch(() => (api.getProfile(app.userId) || {})) : (api.getProfile(app.userId) || {}),
        api.getUsersByRoleAsync ? api.getUsersByRoleAsync("assistant_admin") : api.getUsersByRole("assistant_admin"),
        api.getDocumentsByUserAsync ? api.getDocumentsByUserAsync(app.userId) : api.getDocumentsByUser(app.userId),
        api.getApplicationNotesAsync ? api.getApplicationNotesAsync(app.id) : api.getApplicationNotes(app.id),
        api.getDocumentReviewsForUserAsync ? api.getDocumentReviewsForUserAsync(app.userId) : api.getDocumentReviewsForUser(app.userId),
        api.getSupportMessagesAsync ? api.getSupportMessagesAsync(`support_${app.userId}`) : api.getSupportMessages(`support_${app.userId}`)
      ]);

      return {
        app,
        profile,
        user: api.getUserById(app.userId) || {},
        assistants: assistants || [],
        docs: docs || [],
        notes: notes || [],
        reviews: reviews || [],
        supportMessages: supportMessages || []
      };
    }

    async function render() {
      const { app, profile, user, assistants, docs, notes, reviews, supportMessages } = await loadData();
      if (!app) {
        el.hero.innerHTML = '<div class="hero-row"><div><h2>Application not found</h2><p>This application could not be loaded.</p></div></div>';
        return;
      }

      const assigned = app.assignedAssistantId ? api.getUserById(app.assignedAssistantId) : null;
      const reviewMap = new Map(reviews.map((review) => [review.doc?.id || review.docId, review.review]));

      el.layout.hidden = false;
      el.hero.innerHTML = `
        <div class="hero-row">
          <div>
            <h2>${esc(user.fullName || app.applicant || "Applicant")}</h2>
            <p>Email: ${esc(user.email || "-")}<br>Application ID: ${esc(app.id)}<br>Assigned assistant: ${esc(assigned?.fullName || "Unassigned")}</p>
          </div>
          <div class="chips">
            <span class="chip c-blue">${esc(app.status || "Draft")}</span>
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
        ["Date of birth", profile.dob],
        ["School", profile.schoolName || profile.schoolAttended],
        ["Average", profile.average],
        ["Guardian", profile.guardianName || profile.guardianFullNames],
        ["Guardian phone", profile.guardianPhone || profile.guardianCell1]
      ]);

      el.payment.innerHTML = detailBoxes([
        ["Payer name", app.payment?.payerName],
        ["Phone", app.payment?.phone],
        ["Reference", app.payment?.reference],
        ["Method", app.payment?.method],
        ["Amount", money(app.payment?.amount || 0)],
        ["Submitted", dt(app.payment?.submittedAt)],
        ["Note", app.payment?.note]
      ]);

      el.assistantSelect.innerHTML = `<option value="">Unassigned</option>${assistants.map((assistant) => `<option value="${esc(assistant.id)}" ${assistant.id === app.assignedAssistantId ? "selected" : ""}>${esc(assistant.fullName)}${assistant.supabaseUserId ? "" : " (local)"}</option>`).join("")}`;
      el.statusSelect.value = app.status || "Draft";
      el.paymentStatusSelect.value = app.paymentStatus || "Payment Pending";

      el.institutions.innerHTML = app.items.length ? app.items.map((item, index) => `
        <div class="item">
          <div class="title">${esc(index + 1)}. ${esc(item.institution || item.institutionName || "Institution")}</div>
          <div class="meta">Province: ${esc(item.province || "-")}<br>Faculty: ${esc(item.faculty || "-")}<br>Choice 1: ${esc(item.choice1 || "-")}<br>Choice 2: ${esc(item.choice2 || "-")}<br>Choice 3: ${esc(item.choice3 || "-")}</div>
        </div>
      `).join("") : '<div class="empty">No institutions saved yet.</div>';

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
              <button class="mini red" type="button" data-doc="${esc(doc.id)}|Rejected">Reject</button>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No documents uploaded yet.</div>';

      el.timeline.innerHTML = (app.timeline || []).length ? app.timeline.map((entry) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(entry.title || "Timeline event")}</div>
              <div class="meta">${esc(dt(entry.createdAt))}</div>
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
    }

    el.documents.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-doc");
      if (!raw) return;
      const [docId, status] = raw.split("|");
      try {
        await (api.setDocumentReviewAsync ? api.setDocumentReviewAsync(docId, { status, comment: `Reviewed by ${api.currentUser()?.fullName || "Master Admin"}` }) : Promise.resolve(api.setDocumentReview(docId, { status, comment: `Reviewed by ${api.currentUser()?.fullName || "Master Admin"}` })));
        await render();
      } catch (error) {
        alert(error.message || "Could not update document review.");
      }
    });

    el.adminForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(el.formMsg, "");
      try {
        const app = appId ? normalizeApp(api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
        if (!app) throw new Error("Application could not be loaded.");

        if (el.assistantSelect.value) {
          if (el.assistantSelect.value !== (app.assignedAssistantId || "")) {
            await (api.assignAssistantAsync ? api.assignAssistantAsync(app.id, el.assistantSelect.value) : Promise.resolve(api.assignAssistant(app.id, el.assistantSelect.value)));
          }
        } else if (app.assignedAssistantId) {
          await (api.updateApplicationAsync ? api.updateApplicationAsync(app.id, { assistantId: null }) : Promise.resolve(api.updateApplication(app.id, { assistantId: null })));
        }

        await (api.updateApplicationAsync ? api.updateApplicationAsync(app.id, {
          status: el.statusSelect.value,
          paymentStatus: el.paymentStatusSelect.value
        }) : Promise.resolve(api.updateApplication(app.id, {
          status: el.statusSelect.value,
          paymentStatus: el.paymentStatusSelect.value
        })));

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
    });

    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", () => {
        el.statusSelect.value = button.getAttribute("data-status");
      });
    });

    el.supportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(el.supportMsg, "");
      const text = el.supportMessage.value.trim();
      if (!text) {
        setMessage(el.supportMsg, "Write a message first.", "err");
        return;
      }
      try {
        const app = appId ? normalizeApp(api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(appId) : api.getApplication(appId)) : null;
        if (!app) throw new Error("Application could not be loaded.");
        await (api.sendSupportMessageAsync ? api.sendSupportMessageAsync(`support_${app.userId}`, text) : Promise.resolve(api.sendSupportMessage(`support_${app.userId}`, text)));
        el.supportMessage.value = "";
        setMessage(el.supportMsg, "Support message sent.", "ok");
        await render();
      } catch (error) {
        setMessage(el.supportMsg, error.message || "Could not send support message.", "err");
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
      alert(error.message || "Kagie could not load the application review page.");
      window.location.href = "../login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
