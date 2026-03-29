(function () {
  window.KagieAssistantDocumentsReviewPageLoaded = true;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const dt = (value) => {
    if (!value) return "No date";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const chip = (status) => {
    const text = String(status || "").toLowerCase();
    if (text.includes("approve")) return "c-green";
    if (text.includes("reject")) return "c-red";
    if (text.includes("pending")) return "c-yellow";
    return "c-blue";
  };

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "assistant_admin") {
      window.location.href = "../login.html";
      return;
    }

    const assistant = api.requireRole("assistant_admin");
    const list = document.getElementById("documents");
    let activeFilter = "all";

    async function getQueue() {
      const apps = (api.getApplicationsByAssistantAsync ? await api.getApplicationsByAssistantAsync(assistant.id) : api.getApplicationsByAssistant(assistant.id))
        .map((app) => ({
          ...app,
          assignedAssistantId: app?.assignedAssistantId || app?.assistantId || null,
          items: Array.isArray(app?.items) && app.items.length ? app.items : Array.isArray(app?.institutions) ? app.institutions : []
        }));

      const rows = await Promise.all(apps.map(async (app) => {
        const user = api.getUserById(app.userId) || {};
        const docs = api.getDocumentsByUserAsync ? await api.getDocumentsByUserAsync(app.userId) : api.getDocumentsByUser(app.userId);
        const reviews = api.getDocumentReviewsForUserAsync ? await api.getDocumentReviewsForUserAsync(app.userId) : api.getDocumentReviewsForUser(app.userId);
        const reviewMap = new Map((reviews || []).map((review) => [review.doc?.id || review.docId, review.review]));
        return (docs || []).map((doc) => ({
          appId: app.id,
          user,
          doc,
          review: reviewMap.get(doc.id) || null
        }));
      }));

      return rows.flat().sort((a, b) => new Date(b.doc.createdAt) - new Date(a.doc.createdAt));
    }

    async function render() {
      const queue = (await getQueue()).filter((item) => activeFilter === "all" || String(item.doc.status || "Pending Review") === activeFilter);
      if (!queue.length) {
        list.innerHTML = '<div class="empty">No documents match the current filter.</div>';
        return;
      }

      list.innerHTML = queue.map((item) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${esc(item.doc.name || "Document")}</div>
              <div class="meta">${esc(item.user.fullName || "Learner")}<br>${esc(item.user.email || "-")}<br>Uploaded: ${esc(dt(item.doc.createdAt))}</div>
            </div>
            <span class="chip ${chip(item.doc.status)}">${esc(item.doc.status || "Pending Review")}</span>
          </div>
          <div class="meta">Category: ${esc(item.doc.category || "General")}<br>Last review: ${esc(item.review?.status || "Not reviewed yet")} ${item.review?.createdAt ? `| ${esc(dt(item.review.createdAt))}` : ""}<br>${esc(item.review?.comment || "No review comment yet.")}</div>
          <div class="action-row">
            <button class="mini green" type="button" data-doc="${esc(item.doc.id)}|Approved">Approve</button>
            <button class="mini yellow" type="button" data-doc="${esc(item.doc.id)}|Pending Review">Pending</button>
            <button class="mini red" type="button" data-doc="${esc(item.doc.id)}|Rejected">Reject</button>
            <a class="mini blue" href="applicant-view.html?id=${encodeURIComponent(item.appId)}">Open applicant</a>
          </div>
        </div>
      `).join("");
    }

    list.addEventListener("click", async (event) => {
      const raw = event.target.getAttribute("data-doc");
      if (!raw) return;
      const [id, status] = raw.split("|");
      try {
        await (api.setDocumentReviewAsync ? api.setDocumentReviewAsync(id, { status, comment: `Updated by ${assistant.fullName}` }) : Promise.resolve(api.setDocumentReview(id, { status, comment: `Updated by ${assistant.fullName}` })));
        await render();
      } catch (error) {
        alert(error.message || "Could not update document review.");
      }
    });

    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", async () => {
        activeFilter = button.getAttribute("data-filter");
        document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        await render();
      });
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
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
      alert(error.message || "Kagie could not load the document review queue.");
      window.location.href = "../login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
