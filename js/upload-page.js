(function () {
  window.KagieUploadPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin"].includes(value)) return "master_admin";
    return value || "user";
  };
  const dt = (v) => {
    if (!v) return "No date";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "No date" : d.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
  const ACCEPTED_FILE_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png"
  ]);
  const ACCEPTED_FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

  function bytesLabel(value) {
    const size = Number(value || 0);
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${Math.max(0, size)} B`;
  }

  function ensureStatusNode(id, className, text) {
    let node = $(id);
    if (node) return node;
    const anchor = $("uploadBtn");
    if (!anchor?.parentElement) return null;
    node = document.createElement("div");
    node.id = id;
    node.className = className;
    node.style.padding = "0";
    node.style.textAlign = "left";
    node.textContent = text || "";
    anchor.insertAdjacentElement("afterend", node);
    return node;
  }

  async function main() {
    const api = window.KagieAPI;
    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : (api.currentUser() || await api.restoreSession());
    if (!restored || normalizeRole(restored.role) !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const cls = (s) => s === api.STATUS.doc.APPROVED ? "success" : s === api.STATUS.doc.REJECTED ? "review" : "pending";
    const uploadBtn = $("uploadBtn");
    const docFile = $("docFile");
    const docName = $("docName");
    const docCategory = $("docCategory");
    const uploadStatus = ensureStatusNode("uploadStatus", "empty", "");
    const fileMeta = ensureStatusNode("uploadFileMeta", "empty", "Accepted: PDF, DOC, DOCX, JPG, JPEG, PNG. Max 8 MB.");
    let docsCache = [];
    let isUploading = false;
    let uploadSlowTimer = 0;

    const setUploadState = (message, tone, busy = false, busyLabel = "Uploading document...") => {
      const ux = window.KagieUX;
      if (uploadBtn) {
        if (ux?.setButtonLoading) ux.setButtonLoading(uploadBtn, busy, { busyText: busyLabel });
        else {
          uploadBtn.disabled = busy;
          uploadBtn.textContent = busy ? busyLabel : "Save document";
        }
      }
      if (!uploadStatus) return;
      uploadStatus.textContent = message || "";
      uploadStatus.style.color = tone === "error" ? "#c24848" : tone === "success" ? "#1a6b4a" : "#64748b";
      uploadStatus.style.fontWeight = message ? "700" : "600";
    };

    const validateFile = (file) => {
      if (!file) return "Choose a file to upload.";
      const lowerName = String(file.name || "").toLowerCase();
      const hasAcceptedExtension = ACCEPTED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      if (!ACCEPTED_FILE_TYPES.has(file.type) && !hasAcceptedExtension) {
        return "Use PDF, DOC, DOCX, JPG, JPEG, or PNG files only.";
      }
      if (Number(file.size || 0) > MAX_UPLOAD_BYTES) {
        return "Keep the file size under 8 MB so Kagie can upload it smoothly.";
      }
      return "";
    };

    async function render() {
      const [docs, latest] = await Promise.all([
        api.getDocumentsByUserAsync ? api.getDocumentsByUserAsync(user.id) : Promise.resolve(api.getDocumentsByUser(user.id) || []),
        api.getLatestApplicationAsync ? api.getLatestApplicationAsync(user.id).catch(() => null) : Promise.resolve(api.getLatestApplication(user.id))
      ]);
      docsCache = Array.isArray(docs) ? docs : [];
      const payment = latest?.payment || null;
      const paymentStatusClass = latest?.paymentStatus === "Rejected"
        ? cls(api.STATUS.doc.REJECTED)
        : latest?.paymentStatus === "Verified"
          ? cls(api.STATUS.doc.APPROVED)
          : cls(api.STATUS.doc.PENDING);
      const paymentCard = latest?.paymentStatus ? `
        <div class="item">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div><strong>Payment verification</strong></div>
            <span class="status ${paymentStatusClass}">${esc(latest.paymentStatus)}</span>
          </div>
          <p>Reference: ${esc(payment?.reference || "Not captured yet")}<br>Proof uploaded: ${esc(payment?.proofUploadedAt ? dt(payment.proofUploadedAt) : "Not uploaded yet")}<br>${esc(payment?.rejectionReason ? `Rejection reason: ${payment.rejectionReason}` : payment?.verificationNote ? `Verification note: ${payment.verificationNote}` : "Upload a clear proof of payment so Kagie can verify your checkout faster.")}</p>
        </div>
      ` : "";
      $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
      $("heroText").textContent = latest?.paymentStatus === "Rejected"
        ? "Your previous proof of payment was rejected. Upload a clearer file here and Kagie will send it back for verification."
        : "Every file saved here is linked to your Kagie account and visible to support staff for review.";
      $("countMeta").textContent = `${docs.length} uploaded`;
      $("statusMeta").textContent = `${docs.filter((d) => d.status === api.STATUS.doc.PENDING).length} pending review | Payment: ${latest?.paymentStatus || "Payment Pending"}`;
      const docCards = docs.length ? docs.map((d) => `<div class="item"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>${esc(d.name || "Document")}</strong></div><span class="status ${cls(d.status)}">${esc(d.status || api.STATUS.doc.PENDING)}</span></div><p>Category: ${esc(d.category || "-")}${d.category === "proof_of_payment" ? " | Linked to payment verification" : ""}<br>Type: ${esc(d.type || "-")}<br>Size: ${esc(d.size ? `${Math.max(1, Math.round(d.size / 1024))} KB` : "-")}<br>Uploaded: ${esc(dt(d.createdAt))}</p></div>`).join("") : `<div class="empty">No documents uploaded yet.</div>`;
      $("docs").innerHTML = paymentCard + docCards;
    }

    docFile?.addEventListener("change", () => {
      const file = docFile.files?.[0] || null;
      const error = validateFile(file);
      if (error) {
        if (fileMeta) fileMeta.textContent = "Accepted: PDF, DOC, DOCX, JPG, JPEG, PNG. Max 8 MB.";
        setUploadState(error, "error");
        return;
      }
      if (fileMeta) fileMeta.textContent = `${file.name} | ${bytesLabel(file.size)} | ${file.type || "File ready"}`;
      setUploadState("File ready. Kagie will save it when you tap Save document.", "info");
    });

    uploadBtn?.addEventListener("click", async () => {
      if (isUploading) return;
      const file = docFile?.files?.[0] || null;
      const category = docCategory?.value || "";
      const name = String(docName?.value || "").trim() || file?.name || "";
      const validationError = validateFile(file);
      if (validationError) {
        setUploadState(validationError, "error");
        return;
      }
      const duplicate = docsCache.find((doc) =>
        String(doc.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
        && Number(doc.size || 0) === Number(file.size || 0)
        && String(doc.category || "") === String(category || "")
      );
      if (duplicate) {
        setUploadState("That document is already saved in Kagie. Rename it or choose a different file if this is a new version.", "error");
        return;
      }

      try {
        isUploading = true;
        setUploadState("Uploading document...", "info", true);
        uploadSlowTimer = window.setTimeout(() => {
          setUploadState("Still uploading, please wait...", "info", true);
        }, 3200);
        if (api.saveDocumentsAsync) await api.saveDocumentsAsync({ file, name, type: file.type, size: file.size, category }, user.id);
        else api.saveDocuments({ name, type: file.type, size: file.size, category }, user.id);
        if (docName) docName.value = "";
        if (docFile) docFile.value = "";
        if (fileMeta) fileMeta.textContent = "Accepted: PDF, DOC, DOCX, JPG, JPEG, PNG. Max 8 MB.";
        await render();
        setUploadState("Saved successfully. Your document is now linked to your Kagie account.", "success");
      } catch (error) {
        setUploadState(error.message || "Upload failed.", "error");
      } finally {
        if (uploadSlowTimer) {
          window.clearTimeout(uploadSlowTimer);
          uploadSlowTimer = 0;
        }
        isUploading = false;
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.textContent = "Save document";
        }
      }
    });

    $("docs").innerHTML = window.KagieUX?.skeletonList?.({ rows: 3, lines: 2 }) || '<div class="empty">Loading your details...</div>';
    setUploadState("Loading your details...", "info", true, "Loading...");
    await render();
    setUploadState("Choose a file, then save it to Kagie.", "info");
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const active = window.KagieAPI?.currentUser?.();
      if (!active || normalizeRole(active.role) !== "user") {
        window.location.href = "login.html";
        return;
      }
      alert(error.message || "Kagie could not load your document center.");
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
