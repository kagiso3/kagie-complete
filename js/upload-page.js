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

  function validateFile(file) {
    if (!file) return "Choose a file to upload.";
    const lowerName = String(file.name || "").toLowerCase();
    const hasAcceptedExtension = ACCEPTED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!ACCEPTED_FILE_TYPES.has(file.type) && !hasAcceptedExtension) {
      return "Use PDF, DOC, DOCX, JPG, JPEG, or PNG files only.";
    }
    if (Number(file.size || 0) > MAX_UPLOAD_BYTES) {
      return "Keep the file size at 8 MB or less.";
    }
    return "";
  }

  const emptyDocuments = () => `<div class="upload-empty">
    <svg class="upload-empty-art" viewBox="0 0 188 188" fill="none" aria-hidden="true">
      <circle cx="94" cy="94" r="94" fill="currentColor" opacity=".055"/>
      <path d="M96 46H65a13 13 0 0 0-13 13v70a13 13 0 0 0 13 13h26M96 46l30 30m-30-30v24a6 6 0 0 0 6 6h24v28M73 98h30" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="126" cy="134" r="26" fill="currentColor" stroke="white" stroke-width="4"/>
      <path d="M126 123v22m-11-11h22" stroke="white" stroke-width="5" stroke-linecap="round"/>
    </svg>
    <h3>No documents uploaded yet.</h3>
    <p>Start by uploading your documents so our assistants can review and track them.</p>
  </div>`;

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
    const uploadForm = $("uploadForm");
    const docFile = $("docFile");
    const docName = $("docName");
    const docCategory = $("docCategory");
    const dropZone = $("uploadDropZone");
    const chooseFileBtn = $("chooseFileBtn");
    const removeFileBtn = $("removeFileBtn");
    const selectedFileName = $("selectedFileName");
    const uploadStatus = $("uploadStatus");
    const docsNode = $("docs");
    const params = new URLSearchParams(window.location.search);
    const requestedApplicationId = String(params.get("applicationId") || "").trim();
    const requestedCategory = String(params.get("category") || "").trim();
    if (docCategory && Array.from(docCategory.options).some((option) => option.value === requestedCategory)) {
      docCategory.value = requestedCategory;
    }
    let docsCache = [];
    let selectedFile = docFile?.files?.[0] || null;
    let isUploading = false;
    let isLoadingDocuments = true;
    let uploadSlowTimer = 0;
    let dragDepth = 0;

    const setUploadState = (message, tone, busy = false, busyLabel = "Saving Document...") => {
      const activeBusy = busy || isUploading;
      if (uploadBtn) {
        uploadBtn.disabled = activeBusy || isLoadingDocuments;
        uploadBtn.classList.toggle("is-loading", activeBusy);
        uploadBtn.setAttribute("aria-busy", String(activeBusy));
        const label = uploadBtn.querySelector(".upload-button-label");
        if (label) label.textContent = activeBusy ? busyLabel : "Save Document";
        else uploadBtn.textContent = activeBusy ? busyLabel : "Save Document";
      }
      if (!uploadStatus) return;
      uploadStatus.textContent = message || "";
      uploadStatus.dataset.tone = tone || "info";
      uploadStatus.style.color = tone === "error" ? "#fd0505" : tone === "success" ? "#1a6b4a" : "#64748b";
    };

    const fieldError = (field, message) => {
      const error = $(field + "Error");
      if (error) {
        error.textContent = message || "";
        error.hidden = !message;
      }
      const input = $(field);
      if (input) {
        input.setAttribute("aria-invalid", String(Boolean(message)));
      }
      if (field === "docFile" && dropZone) dropZone.classList.toggle("has-error", Boolean(message));
    };

    const updateFileSelection = (file) => {
      selectedFile = file;
      if (selectedFileName) selectedFileName.textContent = file ? `${file.name} · ${bytesLabel(file.size)}` : "No file chosen";
      if (removeFileBtn) removeFileBtn.hidden = !file;
      dropZone?.classList.toggle("has-file", Boolean(file));
      const error = file ? validateFile(file) : "";
      fieldError("docFile", error);
      setUploadState(error || (file ? "File ready. Select Save Document to upload it." : ""), error ? "error" : "info");
    };

    const lockUploadInputs = (busy) => {
      for (const input of [docCategory, docName, docFile, chooseFileBtn, removeFileBtn]) {
        if (input) input.disabled = busy;
      }
      dropZone?.setAttribute("aria-disabled", String(busy));
    };

    const categoryLabel = (category) => {
      if (category === "cv_revised") return "Revised CV from Kagie";
      const option = Array.from(docCategory?.options || []).find((item) => item.value === category);
      if (option) return option.textContent;
      return category ? String(category).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Supporting Document";
    };

    const reviewNote = (doc) => String(doc.rejectionReason || doc.reviewReason || doc.reviewNote || doc.reason || "").trim();

    async function render() {
      docsNode?.setAttribute("aria-busy", "true");
      const [documents, latest] = await Promise.all([
        api.getDocumentsByUserAsync ? api.getDocumentsByUserAsync(user.id) : Promise.resolve(api.getDocumentsByUser(user.id) || []),
        requestedApplicationId
          ? (api.getApplicationByIdAsync ? api.getApplicationByIdAsync(requestedApplicationId, user.id) : Promise.resolve(api.getApplicationById(requestedApplicationId)))
          : (api.getLatestApplicationAsync ? api.getLatestApplicationAsync(user.id).catch(() => null) : Promise.resolve(api.getLatestApplication(user.id)))
      ]);
      if (requestedApplicationId && (!latest || String(latest.userId) !== String(user.id))) {
        throw new Error("This application is unavailable. Open your application from the dashboard and try again.");
      }
      docsCache = Array.isArray(documents) ? documents : [];
      const payment = latest?.payment || null;
      const paymentStatusClass = latest?.paymentStatus === "Rejected"
        ? cls(api.STATUS.doc.REJECTED)
        : latest?.paymentStatus === "Verified"
          ? cls(api.STATUS.doc.APPROVED)
          : cls(api.STATUS.doc.PENDING);
      const paymentCard = latest?.paymentStatus ? `
        <article class="item upload-document-card upload-payment-card">
          <div class="upload-document-heading"><strong>Payment verification</strong><span class="status ${paymentStatusClass}">${esc(latest.paymentStatus)}</span></div>
          <p>Reference: ${esc(payment?.reference || "Not captured yet")}<br>Proof uploaded: ${esc(payment?.proofUploadedAt ? dt(payment.proofUploadedAt) : "Not uploaded yet")}<br>${esc(payment?.rejectionReason ? `Rejection reason: ${payment.rejectionReason}` : payment?.verificationNote ? `Verification note: ${payment.verificationNote}` : "Upload a clear proof of payment so Kagie can verify your checkout faster.")}</p>
        </article>
      ` : "";
      if ($("heroTitle")) $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
      if ($("heroText")) $("heroText").textContent = latest?.paymentStatus === "Rejected"
        ? "Your previous proof of payment was rejected. Upload a clearer file here and Kagie will send it back for verification."
        : "Every file saved here is linked to your Kagie account and visible to support staff for review.";
      if ($("countMeta")) $("countMeta").textContent = `${docsCache.length} uploaded`;
      if ($("statusMeta")) $("statusMeta").textContent = `${docsCache.filter((d) => d.status === api.STATUS.doc.PENDING).length} pending review | Payment: ${latest?.paymentStatus || "Payment Pending"}`;
      const docCards = docsCache.length ? docsCache.map((d) => `<article class="item upload-document-card">
        <div class="upload-document-heading"><strong>${esc(d.name || "Document")}</strong><span class="status ${cls(d.status)}">${esc(d.status || api.STATUS.doc.PENDING)}</span></div>
        <p class="upload-document-category">${esc(categoryLabel(d.category))}${d.category === "proof_of_payment" ? " · Linked to payment verification" : ""}</p>
        <p class="upload-document-details">${esc(d.type || "Document")} · ${esc(d.size ? bytesLabel(d.size) : "Size unavailable")}<br>Uploaded: ${esc(dt(d.createdAt))}</p>
        ${reviewNote(d) ? `<p class="upload-document-review">Review note: ${esc(reviewNote(d))}</p>` : ""}
        ${d.fileUrl || d.dataUrl ? `<button class="mini" type="button" data-document-open="${esc(d.id)}">${d.category === "cv_revised" ? "Open / download revised CV" : "Open / download file"}</button>` : ""}
      </article>`).join("") : emptyDocuments();
      if (docsNode) docsNode.innerHTML = paymentCard + docCards;
      docsNode?.setAttribute("aria-busy", "false");
    }

    const showListRetry = () => {
      if (docsNode) docsNode.innerHTML = `<div class="upload-list-error"><p>We could not refresh your documents.</p><button class="mini" type="button" data-document-retry>Try again</button></div>`;
      docsNode?.setAttribute("aria-busy", "false");
    };

    docsNode?.addEventListener("click", async (event) => {
      const retry = event.target.closest("[data-document-retry]");
      if (retry && !retry.disabled) {
        retry.disabled = true;
        try {
          await render();
          isLoadingDocuments = false;
          setUploadState("", "info");
        } catch (error) {
          docsNode?.setAttribute("aria-busy", "false");
          setUploadState(error.message || "Could not load your documents. Try again.", "error");
          retry.disabled = false;
        }
        return;
      }
      const button = event.target.closest("[data-document-open]");
      if (!button || button.disabled) return;
      const doc = docsCache.find(item => String(item.id) === button.dataset.documentOpen);
      if (!doc) return;
      button.disabled = true;
      const tab = window.open("about:blank", "_blank");
      if (tab) tab.opener = null;
      try {
        let url = String(doc.fileUrl || doc.dataUrl || "");
        if (!/^(https?:\/\/|data:)/i.test(url)) {
          const client = api.initSupabaseClient();
          if (!client) throw new Error("Your document connection is unavailable. Sign in again.");
          const result = await client.storage.from("kagie-documents").createSignedUrl(url, 600);
          if (result.error || !result.data?.signedUrl) throw new Error(result.error?.message || "Could not open this private document.");
          url = result.data.signedUrl;
        }
        if (!/^(https?:\/\/|data:(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|image\/(jpeg|png));)/i.test(url)) throw new Error("This document URL is invalid.");
        if (tab) tab.location.replace(url);
        else {
          const link = document.createElement("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; link.click();
        }
      } catch (error) {
        tab?.close();
        setUploadState(error.message || "Could not open your document.", "error");
      } finally { button.disabled = false; }
    });

    const browse = () => { if (!isUploading) docFile?.click(); };
    chooseFileBtn?.addEventListener("click", browse);
    dropZone?.addEventListener("click", (event) => {
      if (!event.target.closest("button, input, label")) browse();
    });
    dropZone?.addEventListener("keydown", (event) => {
      if (event.target !== dropZone || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      browse();
    });
    docFile?.addEventListener("change", () => updateFileSelection(docFile.files?.[0] || null));
    removeFileBtn?.addEventListener("click", () => {
      if (isUploading) return;
      if (docFile) docFile.value = "";
      updateFileSelection(null);
      chooseFileBtn?.focus();
    });
    dropZone?.addEventListener("dragenter", (event) => {
      event.preventDefault();
      if (isUploading) return;
      dragDepth += 1;
      dropZone.classList.add("is-dragover");
    });
    dropZone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = isUploading ? "none" : "copy";
    });
    dropZone?.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropZone.classList.remove("is-dragover");
    });
    dropZone?.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      dropZone.classList.remove("is-dragover");
      if (isUploading) return;
      const files = event.dataTransfer?.files;
      if (!files?.length) return;
      if (files.length !== 1) {
        const message = "Choose one document at a time.";
        fieldError("docFile", message);
        setUploadState(message, "error");
        return;
      }
      // Retain the File even where assigning a dropped FileList is unsupported.
      try { if (docFile) docFile.files = files; } catch (_) { /* The selected File below remains uploadable. */ }
      updateFileSelection(files[0]);
    });
    docCategory?.addEventListener("change", () => fieldError("docCategory", docCategory.value ? "" : "Choose a document category."));
    docName?.addEventListener("input", () => fieldError("docName", ""));

    const saveDocument = async (event) => {
      event?.preventDefault();
      if (isUploading || isLoadingDocuments) return;
      const file = selectedFile;
      const category = docCategory?.value || "";
      const name = String(docName?.value || "").trim();
      const categoryError = category ? "" : "Choose a document category.";
      const nameError = name ? "" : "Enter a document label.";
      const fileError = validateFile(file);
      fieldError("docCategory", categoryError);
      fieldError("docName", nameError);
      fieldError("docFile", fileError);
      if (categoryError || nameError || fileError) {
        setUploadState("Complete the required fields before saving your document.", "error");
        (categoryError ? docCategory : nameError ? docName : dropZone || docFile)?.focus();
        return;
      }
      const duplicate = docsCache.find((doc) =>
        String(doc.name || "").trim().toLowerCase() === name.toLowerCase()
        && Number(doc.size || 0) === Number(file.size || 0)
        && String(doc.category || "") === category
        && (!requestedApplicationId || String(doc.applicationId || "") === requestedApplicationId)
      );
      if (duplicate) {
        setUploadState("That document is already saved in Kagie. Rename it or choose a different file if this is a new version.", "error");
        return;
      }

      try {
        isUploading = true;
        lockUploadInputs(true);
        setUploadState("Uploading document...", "info", true);
        uploadSlowTimer = window.setTimeout(() => {
          setUploadState("Still uploading, please wait...", "info", true);
        }, 3200);
        const document = { file, name, type: file.type, size: file.size, category, applicationId: requestedApplicationId || undefined };
        const saved = api.saveDocumentsAsync ? await api.saveDocumentsAsync(document, user.id) : api.saveDocuments(document, user.id);
        if (Array.isArray(saved)) docsCache = [...docsCache, ...saved];
        if (docName) docName.value = "";
        if (docFile) docFile.value = "";
        updateFileSelection(null);
        try {
          await render();
          setUploadState("Saved successfully. Your document is now linked to your Kagie account.", "success");
        } catch (_) {
          showListRetry();
          setUploadState("Your document was saved. Try again to refresh your uploaded documents.", "success");
        }
      } catch (error) {
        setUploadState(error.message || "Upload failed. Your selected file is still ready to try again.", "error");
      } finally {
        if (uploadSlowTimer) {
          window.clearTimeout(uploadSlowTimer);
          uploadSlowTimer = 0;
        }
        isUploading = false;
        lockUploadInputs(false);
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.classList.remove("is-loading");
          uploadBtn.setAttribute("aria-busy", "false");
          const label = uploadBtn.querySelector(".upload-button-label");
          if (label) label.textContent = "Save Document";
          else uploadBtn.textContent = "Save Document";
        }
      }
    };

    if (uploadForm) uploadForm.addEventListener("submit", saveDocument);
    else uploadBtn?.addEventListener("click", saveDocument);
    if (docsNode) docsNode.innerHTML = window.KagieUX?.skeletonList?.({ rows: 3, lines: 2 }) || '<div class="upload-list-loading" role="status">Loading your documents...</div>';
    setUploadState("Loading your documents...", "info", true, "Loading...");
    try {
      await render();
      isLoadingDocuments = false;
      setUploadState("", "info");
    } catch (error) {
      showListRetry();
      setUploadState(error.message || "Could not load your documents. Try again.", "error");
    }
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const active = window.KagieAPI?.currentUser?.();
      if (!active || normalizeRole(active.role) !== "user") {
        window.location.href = "login.html";
        return;
      }
      const status = $("uploadStatus");
      if (status) {
        status.textContent = error.message || "Kagie could not load your document center. Refresh to try again.";
        status.dataset.tone = "error";
      }
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
