(function () {
  window.KagieUploadPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const dt = (v) => {
    if (!v) return "No date";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "No date" : d.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const cls = (s) => s === api.STATUS.doc.APPROVED ? "success" : s === api.STATUS.doc.REJECTED ? "review" : "pending";

    async function render() {
      const docs = api.getDocumentsByUserAsync ? await api.getDocumentsByUserAsync(user.id) : (api.getDocumentsByUser(user.id) || []);
      $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
      $("heroText").textContent = "Every file saved here is linked to your Kagie account and visible to support staff for review.";
      $("countMeta").textContent = `${docs.length} uploaded`;
      $("statusMeta").textContent = `${docs.filter((d) => d.status === api.STATUS.doc.PENDING).length} pending review`;
      $("docs").innerHTML = docs.length ? docs.map((d) => `<div class="item"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>${esc(d.name || "Document")}</strong></div><span class="status ${cls(d.status)}">${esc(d.status || api.STATUS.doc.PENDING)}</span></div><p>Category: ${esc(d.category || "-")}<br>Type: ${esc(d.type || "-")}<br>Size: ${esc(d.size ? `${Math.max(1, Math.round(d.size / 1024))} KB` : "-")}<br>Uploaded: ${esc(dt(d.createdAt))}</p></div>`).join("") : `<div class="empty">No documents uploaded yet.</div>`;
    }

    $("uploadBtn").addEventListener("click", async () => {
      const file = $("docFile").files[0];
      const category = $("docCategory").value;
      const name = $("docName").value.trim() || file?.name || "";
      if (!file) {
        alert("Choose a file to upload.");
        return;
      }

      try {
        if (api.saveDocumentsAsync) await api.saveDocumentsAsync({ file, name, type: file.type, size: file.size, category }, user.id);
        else api.saveDocuments({ name, type: file.type, size: file.size, category }, user.id);
        $("docName").value = "";
        $("docFile").value = "";
        await render();
      } catch (error) {
        alert(error.message || "Upload failed.");
      }
    });

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load your document center.");
      window.location.href = "login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
