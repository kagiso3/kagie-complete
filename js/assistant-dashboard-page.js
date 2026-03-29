(function () {
  window.KagieAssistantDashboardPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const dt = (value) => {
    if (!value) return "No date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const cls = (status) => {
    const value = String(status || "").toLowerCase();
    if (value.includes("accept") || value.includes("verify") || value.includes("resolve")) return "success";
    if (value.includes("reject")) return "danger";
    if (value.includes("pending") || value.includes("missing")) return "pending";
    return "review";
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
    const applicationsNode = $("applications");
    const threadsNode = $("threads");
    const documentsNode = $("documents");
    const callbacksNode = $("callbacks");

    async function loadData() {
      const appsRaw = api.getApplicationsByAssistantAsync ? await api.getApplicationsByAssistantAsync(assistant.id) : api.getApplicationsByAssistant(assistant.id);
      const apps = appsRaw.map(normalizeApp);
      const userIds = [...new Set(apps.map((app) => app.userId).filter(Boolean))];

      const [threadRows, docRows, reviewRows, callRows] = await Promise.all([
        Promise.all(userIds.map(async (userId) => ({
          userId,
          messages: api.getSupportMessagesAsync ? await api.getSupportMessagesAsync(`support_${userId}`) : (api.getSupportMessages(`support_${userId}`) || [])
        }))),
        Promise.all(userIds.map(async (userId) => ({
          userId,
          docs: api.getDocumentsByUserAsync ? await api.getDocumentsByUserAsync(userId) : (api.getDocumentsByUser(userId) || [])
        }))),
        Promise.all(userIds.map(async (userId) => ({
          userId,
          reviews: api.getDocumentReviewsForUserAsync ? await api.getDocumentReviewsForUserAsync(userId) : (api.getDocumentReviewsForUser(userId) || [])
        }))),
        api.getCallRequestsAsync ? await api.getCallRequestsAsync() : api.getCallRequests()
      ]);

      const threadMap = new Map(threadRows.map((row) => [row.userId, row.messages]));
      const docMap = new Map(docRows.map((row) => [row.userId, row.docs]));
      const reviewMap = new Map(reviewRows.map((row) => [row.userId, row.reviews]));

      const threads = userIds
        .map((userId) => {
          const user = api.getUserById(userId) || {};
          const messages = threadMap.get(userId) || [];
          return { userId, user, latest: messages[messages.length - 1] || null, count: messages.length };
        })
        .filter((thread) => thread.latest);

      const docs = userIds
        .flatMap((userId) => {
          const user = api.getUserById(userId) || {};
          const latestReviews = new Map((reviewMap.get(userId) || []).map((entry) => [entry.doc?.id || entry.docId, entry.review]));
          return (docMap.get(userId) || []).map((doc) => ({
            ...doc,
            user,
            review: latestReviews.get(doc.id) || null
          }));
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const calls = (callRows || [])
        .filter((call) => userIds.includes(call.requesterId) || call.assignedAssistantId === assistant.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return { apps, threads, docs, calls };
    }

    async function render() {
      const { apps, threads, docs, calls } = await loadData();
      $("heroTitle").textContent = `Hello, ${assistant.fullName || "Assistant"}`;
      $("heroText").textContent = "This dashboard focuses on work that is directly assigned to you inside Kagie.";
      $("appMeta").textContent = `${apps.length} assigned application${apps.length === 1 ? "" : "s"}`;
      $("chatMeta").textContent = `${threads.length} support thread${threads.length === 1 ? "" : "s"}`;
      const pendingCalls = calls.filter((call) => call.status === "Pending").length;
      $("callMeta").textContent = `${pendingCalls} pending callback${pendingCalls === 1 ? "" : "s"}`;

      const stats = [
        ["Applications", apps.length, "Assigned to you"],
        ["Pending Docs", docs.filter((doc) => doc.status === api.STATUS.doc.PENDING).length, "Awaiting review"],
        ["Support Threads", threads.length, "Learners with messages"],
        ["Callbacks", pendingCalls, "Pending contact"]
      ];
      $("stats").innerHTML = stats.map(([label, value, note]) => `
        <div class="stat">
          <small>${esc(label)}</small>
          <strong>${esc(value)}</strong>
          <p>${esc(note)}</p>
        </div>
      `).join("");

      applicationsNode.innerHTML = apps.length ? apps.map((app) => {
        const user = api.getUserById(app.userId) || {};
        return `
          <div class="item">
            <div class="row">
              <div>
                <strong>${esc(user.fullName || app.applicant || "Applicant")}</strong>
                <p>${esc(user.email || "-")}<br>Application ID: ${esc(app.id)}<br>Updated: ${esc(dt(app.updatedAt))}</p>
              </div>
              <span class="status ${cls(app.status)}">${esc(app.status || "Draft")}</span>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
              <a class="mini" href="applicant-view.html?id=${encodeURIComponent(app.id)}">Open</a>
              <button class="mini gold" data-status="${esc(app.id)}|Under Review" type="button">Review</button>
              <button class="mini green" data-status="${esc(app.id)}|Ready to Apply" type="button">Ready</button>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No applications assigned yet.</div>';

      threadsNode.innerHTML = threads.length ? threads.map((thread) => `
        <div class="item">
          <div class="row">
            <div>
              <strong>${esc(thread.user.fullName || "Learner")}</strong>
              <p>${esc(thread.latest.text || "")}</p>
              <p>${esc(dt(thread.latest.createdAt))}</p>
            </div>
            <span class="status ${thread.latest.senderRole === "user" ? "pending" : "review"}">${esc(thread.count)} msg</span>
          </div>
          <div class="reply">
            <textarea class="field" id="reply_${esc(thread.userId)}" placeholder="Reply to this learner..."></textarea>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="mini" data-reply="${esc(thread.userId)}" type="button">Send reply</button>
              <a class="mini green" href="applicant-view.html?id=${encodeURIComponent((apps.find((app) => app.userId === thread.userId) || {}).id || "")}">Open applicant</a>
            </div>
          </div>
        </div>
      `).join("") : '<div class="empty">No support messages from your assigned learners yet.</div>';

      documentsNode.innerHTML = docs.length ? docs.map((doc) => `
        <div class="item">
          <div class="row">
            <div>
              <strong>${esc(doc.name || "Document")}</strong>
              <p>${esc(doc.user.fullName || "Learner")}<br>${esc(dt(doc.createdAt))}<br>${esc(doc.review?.comment || "No review comment yet.")}</p>
            </div>
            <span class="status ${cls(doc.status)}">${esc(doc.status || api.STATUS.doc.PENDING)}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button class="mini green" data-doc="${esc(doc.id)}|Approved" type="button">Approve</button>
            <button class="mini red" data-doc="${esc(doc.id)}|Rejected" type="button">Reject</button>
          </div>
        </div>
      `).join("") : '<div class="empty">No documents linked to your assigned learners.</div>';

      callbacksNode.innerHTML = calls.length ? calls.map((call) => `
        <div class="item">
          <div class="row">
            <div>
              <strong>${esc(call.requesterName || "Learner")}</strong>
              <p>${esc(call.phone || "-")}<br>Preferred time: ${esc(call.preferredTime || "-")}<br>${esc(call.reason || "-")}</p>
            </div>
            <span class="status ${cls(call.status)}">${esc(call.status || "Pending")}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            <button class="mini gold" data-call="${esc(call.id)}|Contacted" type="button">Contacted</button>
            <button class="mini green" data-call="${esc(call.id)}|Resolved" type="button">Resolved</button>
          </div>
        </div>
      `).join("") : '<div class="empty">No callback requests waiting right now.</div>';
    }

    applicationsNode.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-status");
      if (!raw) return;
      const [id, status] = raw.split("|");
      await (api.updateApplicationAsync ? api.updateApplicationAsync(id, { status }) : Promise.resolve(api.updateApplication(id, { status })));
      await render();
    });

    threadsNode.addEventListener("click", async (event) => {
      const userId = event.target.getAttribute("data-reply");
      if (!userId) return;
      const box = $(`reply_${userId}`);
      const text = box?.value.trim();
      if (!text) return;
      await (api.sendSupportMessageAsync ? api.sendSupportMessageAsync(`support_${userId}`, text) : Promise.resolve(api.sendSupportMessage(`support_${userId}`, text)));
      box.value = "";
      await render();
    });

    documentsNode.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-doc");
      if (!raw) return;
      const [id, status] = raw.split("|");
      await (api.setDocumentReviewAsync ? api.setDocumentReviewAsync(id, { status, comment: `Updated by ${assistant.fullName}` }) : Promise.resolve(api.setDocumentReview(id, { status, comment: `Updated by ${assistant.fullName}` })));
      await render();
    });

    callbacksNode.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-call");
      if (!raw) return;
      const [id, status] = raw.split("|");
      await (api.updateCallRequestAsync ? api.updateCallRequestAsync(id, { status }) : Promise.resolve(api.updateCallRequest(id, { status })));
      await render();
    });

    $("logoutLink").addEventListener("click", async (event) => {
      event.preventDefault();
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
      alert(error.message || "Kagie could not load the assistant dashboard.");
      window.location.href = "../login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
