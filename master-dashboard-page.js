(function () {
  window.KagieMasterDashboardPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const dt = (value) => {
    if (!value) return "No date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const money = (value) => `R${Number(value || 0).toLocaleString("en-ZA")}`;
  const statusChip = (status) => {
    const text = String(status || "").toLowerCase();
    if (text.includes("accept") || text.includes("verify") || text.includes("resolve")) return "c-green";
    if (text.includes("reject")) return "c-red";
    if (text.includes("missing") || text.includes("pending")) return "c-yellow";
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

    const admin = api.requireRole("master_admin");
    const el = {
      heroSummary: $("heroSummary"),
      stats: $("stats"),
      assistantForm: $("assistantForm"),
      assistantName: $("assistantName"),
      assistantEmail: $("assistantEmail"),
      assistantPhone: $("assistantPhone"),
      assistantPassword: $("assistantPassword"),
      assistantMsg: $("assistantMsg"),
      notifyForm: $("notifyForm"),
      notifyTitle: $("notifyTitle"),
      notifyType: $("notifyType"),
      notifyMessage: $("notifyMessage"),
      notifyMsg: $("notifyMsg"),
      searchInput: $("searchInput"),
      applications: $("applications"),
      assistants: $("assistants"),
      users: $("users"),
      payments: $("payments"),
      callbacks: $("callbacks"),
      activity: $("activity"),
      refreshBtn: $("refreshBtn"),
      logoutBtn: $("logoutBtn")
    };

    const setMessage = (node, text, type) => {
      node.textContent = text || "";
      node.className = type ? `msg ${type}` : "msg";
    };

    async function loadData() {
      const [summary, applicationsRaw, assistants, usersRaw, callbacks, activity] = await Promise.all([
        api.getAdminSummaryAsync ? api.getAdminSummaryAsync() : api.getAdminSummary(),
        api.getAllApplicationsForAdminAsync ? api.getAllApplicationsForAdminAsync() : api.getAllApplicationsForAdmin(),
        api.getUsersByRoleAsync ? api.getUsersByRoleAsync("assistant_admin") : api.getUsersByRole("assistant_admin"),
        api.getAllUsersAsync ? api.getAllUsersAsync() : api.getAllUsers(),
        api.getCallRequestsAsync ? api.getCallRequestsAsync() : api.getCallRequests(),
        api.getAllAssistantActivityAsync ? api.getAllAssistantActivityAsync() : api.getAllAssistantActivity()
      ]);

      const applications = (applicationsRaw || []).map(normalizeApp);
      const users = (usersRaw || []).filter((user) => user.role === "user");
      return { summary, applications, assistants: assistants || [], users, callbacks: callbacks || [], activity: activity || [] };
    }

    async function renderAll() {
      const { summary, applications, assistants, users, callbacks, activity } = await loadData();
      const totals = summary.totals || {};
      const query = (el.searchInput.value || "").trim().toLowerCase();
      const filteredApps = applications.filter((app) => {
        const user = api.getUserById(app.userId) || {};
        const institutions = app.items.map((item) => item.institutionName || item.institution || "").join(" ");
        const haystack = [app.id, app.applicant, user.fullName, user.email, institutions].join(" ").toLowerCase();
        return !query || haystack.includes(query);
      });

      const cards = [
        ["Learners", totals.users || 0, "Registered student accounts"],
        ["Assistants", totals.assistants || 0, "Support staff accounts"],
        ["Applications", totals.applications || 0, "Tracked learner applications"],
        ["Pending verification", totals.pendingVerification || 0, "Payments awaiting review"],
        ["Callbacks", totals.pendingCallbacks || 0, "Open callback requests"]
      ];

      el.heroSummary.textContent = `${admin.fullName || "Master Admin"} | ${totals.applications || 0} live applications`;
      el.stats.innerHTML = cards.map(([label, value, note]) => `
        <div class="stat">
          <div class="label">${esc(label)}</div>
          <div class="value">${esc(value)}</div>
          <div class="sub">${esc(note)}</div>
        </div>
      `).join("");

      el.applications.innerHTML = filteredApps.length ? filteredApps.map((app) => {
        const user = api.getUserById(app.userId) || {};
        const assigned = app.assignedAssistantId ? api.getUserById(app.assignedAssistantId) : null;
        return `
          <div class="item">
            <div class="row">
              <div>
                <div class="title">${esc(user.fullName || app.applicant || "Applicant")}</div>
                <div class="meta">${esc(user.email || "No email")}<br>Application ID: ${esc(app.id)}<br>Updated: ${esc(dt(app.updatedAt || app.createdAt))}</div>
              </div>
              <div class="chips">
                <span class="chip ${statusChip(app.status)}">${esc(app.status || "Draft")}</span>
                <span class="chip ${statusChip(app.paymentStatus)}">${esc(app.paymentStatus || "Payment Pending")}</span>
              </div>
            </div>
            <div class="meta">Institutions: ${esc(app.items.length)} | Assigned assistant: ${esc(assigned?.fullName || "Unassigned")} | Payment amount: ${esc(money(app.payment?.amount || 0))}</div>
            <div class="action-row">
              <select id="assign_${esc(app.id)}">
                <option value="">Unassigned</option>
                ${assistants.map((assistant) => `<option value="${esc(assistant.id)}" ${assistant.id === app.assignedAssistantId ? "selected" : ""}>${esc(assistant.fullName)}${assistant.supabaseUserId ? "" : " (local)"}</option>`).join("")}
              </select>
              <button class="mini blue" type="button" data-assign="${esc(app.id)}">Save assignment</button>
              <button class="mini orange" type="button" data-status="${esc(app.id)}|Under Review">Review</button>
              <button class="mini yellow" type="button" data-status="${esc(app.id)}|Ready to Apply">Ready</button>
              <button class="mini green" type="button" data-status="${esc(app.id)}|Accepted">Accept</button>
              <button class="mini red" type="button" data-status="${esc(app.id)}|Rejected">Reject</button>
              <a class="mini blue" href="application-view.html?id=${encodeURIComponent(app.id)}">Open</a>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No applications match the current search.</div>';

      el.assistants.innerHTML = assistants.length ? assistants.map((assistant) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(assistant.fullName)}</div>
              <div class="meta">${esc(assistant.email || "-")}<br>Phone: ${esc(assistant.phone || "Not set")}<br>${assistant.supabaseUserId ? "Supabase-linked account" : "Local-only assistant draft"}</div>
            </div>
            <span class="chip c-blue">${applications.filter((app) => app.assignedAssistantId === assistant.id).length} assigned</span>
          </div>
        </div>
      `).join("") : '<div class="empty">No assistant accounts yet.</div>';

      el.users.innerHTML = users.length ? users.slice(0, 12).map((user) => {
        const latest = applications.find((app) => app.userId === user.id) || null;
        return `
          <div class="item">
            <div class="row">
              <div>
                <div class="title">${esc(user.fullName)}</div>
                <div class="meta">${esc(user.email || "-")}<br>Phone: ${esc(user.phone || "Not set")}</div>
              </div>
              <span class="chip ${statusChip(latest?.status || "Draft")}">${esc(latest?.status || "Draft only")}</span>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No learner accounts found.</div>';

      const paymentApps = applications.filter((app) => app.paymentStatus !== "Verified").slice(0, 10);
      el.payments.innerHTML = paymentApps.length ? paymentApps.map((app) => {
        const user = api.getUserById(app.userId) || {};
        return `
          <div class="item">
            <div class="row">
              <div>
                <div class="title">${esc(user.fullName || app.applicant || "Applicant")}</div>
                <div class="meta">${esc(app.payment?.method || "No method")}<br>${esc(app.payment?.reference || "No reference")}<br>${esc(money(app.payment?.amount || 0))}</div>
              </div>
              <span class="chip ${statusChip(app.paymentStatus)}">${esc(app.paymentStatus || "Payment Pending")}</span>
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No payments need attention right now.</div>';

      el.callbacks.innerHTML = callbacks.length ? callbacks.map((call) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(call.studentName || call.requesterName || "Learner")}</div>
              <div class="meta">${esc(call.phone || "-")}<br>Preferred time: ${esc(call.preferredTime || "-")}<br>${esc(dt(call.createdAt))}</div>
            </div>
            <span class="chip ${statusChip(call.status)}">${esc(call.status || "Pending")}</span>
          </div>
          <div class="meta">${esc(call.reason || "No reason supplied.")}</div>
          <div class="action-row">
            <button class="mini yellow" type="button" data-call="${esc(call.id)}|Contacted">Contacted</button>
            <button class="mini green" type="button" data-call="${esc(call.id)}|Resolved">Resolved</button>
          </div>
        </div>
      `).join("") : '<div class="empty">No callback requests yet.</div>';

      el.activity.innerHTML = activity.length ? activity.slice(0, 10).map((item) => `
        <div class="item">
          <div class="title">${esc(item.action || "Activity")}</div>
          <div class="meta">Actor: ${esc(item.assistantName || "Unknown")}<br>${esc(item.details || "No details")}<br>${esc(dt(item.createdAt))}</div>
        </div>
      `).join("") : '<div class="empty">No assistant or admin activity yet.</div>';
    }

    el.applications.addEventListener("click", async (event) => {
      const assignId = event.target.getAttribute("data-assign");
      const rawStatus = event.target.getAttribute("data-status");
      try {
        if (assignId) {
          const select = document.getElementById(`assign_${assignId}`);
          if (select?.value) {
            await (api.assignAssistantAsync ? api.assignAssistantAsync(assignId, select.value) : Promise.resolve(api.assignAssistant(assignId, select.value)));
          } else {
            await (api.updateApplicationAsync ? api.updateApplicationAsync(assignId, { assistantId: null }) : Promise.resolve(api.updateApplication(assignId, { assistantId: null })));
          }
          await renderAll();
          return;
        }
        if (rawStatus) {
          const [appId, status] = rawStatus.split("|");
          await (api.updateApplicationAsync ? api.updateApplicationAsync(appId, { status }) : Promise.resolve(api.updateApplication(appId, { status })));
          await renderAll();
        }
      } catch (error) {
        alert(error.message || "Could not update the application.");
      }
    });

    el.callbacks.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-call");
      if (!raw) return;
      const [callId, status] = raw.split("|");
      try {
        await (api.updateCallRequestAsync ? api.updateCallRequestAsync(callId, { status }) : Promise.resolve(api.updateCallRequest(callId, { status })));
        await renderAll();
      } catch (error) {
        alert(error.message || "Could not update callback.");
      }
    });

    el.assistantForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(el.assistantMsg, "");
      try {
        await Promise.resolve(api.createAssistantAccount({
          fullName: el.assistantName.value.trim(),
          email: el.assistantEmail.value.trim(),
          phone: el.assistantPhone.value.trim(),
          password: el.assistantPassword.value.trim() || "123456"
        }));
        el.assistantForm.reset();
        setMessage(el.assistantMsg, "Assistant account created successfully.", "ok");
        await renderAll();
      } catch (error) {
        setMessage(el.assistantMsg, error.message || "Could not create assistant account.", "err");
      }
    });

    el.notifyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(el.notifyMsg, "");
      try {
        if (api.pushNotificationAsync) {
          await api.pushNotificationAsync("all", el.notifyTitle.value.trim(), el.notifyMessage.value.trim(), el.notifyType.value);
        } else {
          api.pushGlobalNotification(el.notifyTitle.value.trim(), el.notifyMessage.value.trim(), el.notifyType.value);
        }
        el.notifyForm.reset();
        setMessage(el.notifyMsg, "Global notification sent.", "ok");
      } catch (error) {
        setMessage(el.notifyMsg, error.message || "Could not send notification.", "err");
      }
    });

    el.searchInput.addEventListener("input", renderAll);
    el.refreshBtn.addEventListener("click", renderAll);
    el.logoutBtn.addEventListener("click", async () => {
      try {
        await Promise.resolve(api.logout());
      } finally {
        window.location.href = "../login.html";
      }
    });

    await renderAll();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load the master admin dashboard.");
      window.location.href = "../login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
