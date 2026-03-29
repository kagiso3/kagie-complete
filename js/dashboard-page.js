(function () {
  window.KagieDashboardPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const fmtDate = (value) => {
    if (!value) return "No date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const fmtMoney = (value) => `R${Number(value || 0).toLocaleString("en-ZA")}`;
  const chip = (status) => {
    const text = String(status || "").toLowerCase();
    if (text.includes("accept") || text.includes("approve") || text.includes("verify")) return "c-green";
    if (text.includes("reject")) return "c-red";
    if (text.includes("missing") || text.includes("pending")) return "c-yellow";
    if (text.includes("draft") || text.includes("review") || text.includes("processing")) return "c-orange";
    return "c-blue";
  };

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const summary = api.getDashboardSummaryAsync ? await api.getDashboardSummaryAsync(user.id) : api.getDashboardSummary(user.id);
    const updates = api.getUpdateFeed(user.id);
    const supportMessages = (api.getSupportMessagesAsync ? await api.getSupportMessagesAsync(`support_${user.id}`) : api.getSupportMessages(`support_${user.id}`)).filter((item) => item.senderRole !== "user").slice(-4).reverse();
    const latest = summary.latestApplication || {};
    const readiness = Number(summary.readiness || 0);

    $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
    $("heroText").textContent = latest.status ? `Your latest application is currently "${latest.status}".` : "Start filling out your Kagie application to unlock tracking.";
    $("heroPill").textContent = `${summary.unreadNotifications || 0} unread notifications`;
    $("progressLabel").textContent = `${readiness}%`;
    $("progressFill").style.width = `${readiness}%`;

    const stats = [["Applications", summary.applications.length, "Saved application records"], ["Documents", summary.documents.length, "Uploaded support files"], ["Deadlines", summary.deadlines.length, "Institution deadlines detected"], ["Cart total", fmtMoney(summary.cartTotal), "Current cart value"], ["Unread", summary.unreadNotifications, "Notifications needing attention"]];
    $("stats").innerHTML = stats.map(([label, value, note]) => `<div class="stat"><div class="label">${safe(label)}</div><div class="value">${safe(value)}</div><div class="sub">${safe(note)}</div></div>`).join("");

    $("latest").innerHTML = latest.id ? `<div class="item"><div class="row"><div><div class="title">${safe(latest.applicant || user.fullName || "Latest application")}</div><div class="meta">Application ID: ${safe(latest.id)}<br>Submitted: ${safe(fmtDate(latest.submittedAt || latest.createdAt))}<br>Updated: ${safe(fmtDate(latest.updatedAt || latest.createdAt))}</div></div><div class="chips"><span class="chip ${chip(latest.status)}">${safe(latest.status || "Draft")}</span><span class="chip ${chip(latest.paymentStatus)}">${safe(latest.paymentStatus || "Payment Pending")}</span></div></div><div class="meta">Institutions: ${safe((latest.institutions || []).length)} | Pack: ${safe(latest.package?.name || latest.package?.packName || "Not selected")} | Payment amount: ${safe(fmtMoney(latest.payment?.amount || 0))}</div><div class="action-row"><a class="mini blue" href="forms.html">Update application</a><a class="mini orange" href="upload.html">Manage documents</a><a class="mini green" href="notifications.html">Open notifications</a></div></div>` : '<div class="empty">No application snapshot is available yet.</div>';
    $("applications").innerHTML = summary.applications.length ? summary.applications.map((app) => `<div class="item"><div class="row"><div><div class="title">${safe(app.applicant || user.fullName || "Application")}</div><div class="meta">Application ID: ${safe(app.id)}<br>Updated: ${safe(fmtDate(app.updatedAt || app.createdAt))}<br>Institutions: ${safe((app.institutions || []).length)}</div></div><div class="chips"><span class="chip ${chip(app.status)}">${safe(app.status || "Draft")}</span><span class="chip ${chip(app.paymentStatus)}">${safe(app.paymentStatus || "Payment Pending")}</span></div></div></div>`).join("") : '<div class="empty">No applications found yet.</div>';
    $("timeline").innerHTML = (latest.timeline || []).length ? latest.timeline.map((entry) => `<div class="timeline-item"><div class="title">${safe(entry.title || "Timeline event")}</div><div class="meta">${safe(fmtDate(entry.createdAt))} | ${safe(entry.status || "Update")}</div></div>`).join("") : '<div class="empty">No timeline history yet.</div>';
    $("alerts").innerHTML = summary.smartAlerts.length ? summary.smartAlerts.map((alert) => `<div class="item"><div class="title">${safe(alert)}</div></div>`).join("") : '<div class="empty">No smart alerts right now.</div>';
    $("tasks").innerHTML = summary.pendingTasks.length ? summary.pendingTasks.map((task) => `<div class="item"><div class="title">${safe(task)}</div></div>`).join("") : '<div class="empty">You have no pending tasks at the moment.</div>';

    const reviewMap = new Map((summary.reviews || []).map((review) => [review.doc.id, review.review]));
    $("documents").innerHTML = summary.documents.length ? summary.documents.map((doc) => {
      const review = reviewMap.get(doc.id);
      return `<div class="item"><div class="row"><div><div class="title">${safe(doc.name || "Document")}</div><div class="meta">Category: ${safe(doc.category || "General")}<br>Uploaded: ${safe(fmtDate(doc.createdAt))}</div></div><div class="chips"><span class="chip ${chip(doc.status)}">${safe(doc.status || "Pending Review")}</span>${review?.status ? `<span class="chip ${chip(review.status)}">${safe(review.status)}</span>` : ""}</div></div><div class="meta">${safe(review?.comment || "No review comment yet.")}</div></div>`;
    }).join("") : '<div class="empty">No documents uploaded yet.</div>';

    const notificationCards = [...summary.notifications.map((notification) => ({ title: notification.title, meta: `${fmtDate(notification.createdAt)} | ${notification.read ? "Read" : "Unread"}` })), ...summary.deadlines.slice(0, 3).map((deadline) => ({ title: `Deadline: ${deadline.institutionName}`, meta: deadline.deadline })), ...updates.slice(0, 3).map((update) => ({ title: update.title, meta: update.ctaLabel || update.type || "Update" }))].slice(0, 8);
    $("notifications").innerHTML = notificationCards.length ? notificationCards.map((item) => `<div class="item"><div class="title">${safe(item.title || "Update")}</div><div class="meta">${safe(item.meta || "")}</div></div>`).join("") : '<div class="empty">No notifications or updates yet.</div>';

    const activityItems = [...supportMessages.map((message) => ({ title: `Support: ${message.senderName || "Assistant"}`, meta: `${fmtDate(message.createdAt)} | ${message.message}` })), ...summary.notes.slice(0, 4).map((note) => ({ title: "Application note", meta: `${fmtDate(note.createdAt)} | ${note.note || note.text || ""}` }))].slice(0, 8);
    $("activity").innerHTML = activityItems.length ? activityItems.map((item) => `<div class="item"><div class="title">${safe(item.title)}</div><div class="meta">${safe(item.meta)}</div></div>`).join("") : '<div class="empty">No assistant activity yet.</div>';
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load your dashboard.");
      window.location.href = "login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
