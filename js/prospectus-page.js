(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const dt = (value) => {
    if (!value) return "No date";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "No date" : parsed.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
  };
  const money = (value) => `R${Number(value || 0).toLocaleString("en-ZA")}`;
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin"].includes(value)) return "master_admin";
    return value || "user";
  };
  const dashboardByRole = {
    user: { href: "home.html", label: "Home" },
    assistant_admin: { href: "assistant/dashboard.html", label: "Assistant" },
    master_admin: { href: "master-admin/dashboard.html", label: "Master Admin" }
  };

  async function main() {
    const api = window.KagieAPI;
    if (!api) return;

    let restored = null;
    try {
      restored = api.resolveSessionUser
        ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
        : await api.restoreSession();
    } catch (error) {
      console.warn("Prospectus session restore failed:", error);
    }

    const currentUser = restored || api.currentUser?.() || api.getCurrentUser?.() || null;
    const normalizedRole = normalizeRole(currentUser?.role);
    if (!currentUser || !["user", "assistant_admin", "master_admin"].includes(normalizedRole)) {
      window.location.href = "login.html";
      return;
    }

    const isStaff = normalizedRole === "assistant_admin" || normalizedRole === "master_admin";
    const params = new URLSearchParams(window.location.search);
    const highlightedInstitutionId = String(params.get("institution") || "").trim().toLowerCase();
    const dashboardMeta = dashboardByRole[normalizedRole] || dashboardByRole.user;

    $("dashboardBtn").href = dashboardMeta.href;
    $("dashboardBtn").textContent = dashboardMeta.label;
    $("homeBtn").href = normalizedRole === "user" ? "home.html" : dashboardMeta.href;
    $("homeBtn").textContent = normalizedRole === "user" ? "Home" : "Back";
    $("roleMeta").textContent = isStaff ? "Shared staff library" : "Student library";
    $("topText").textContent = isStaff
      ? "Browse the learner-facing library and upload new institution prospectus PDFs without leaving Kagie's design system."
      : "Browse institution guides, application fee notes, and Kagie-ready prospectus PDFs.";
    $("heroText").textContent = isStaff
      ? "Use the same library learners see, then upload fresh PDFs when institutions release new prospectus files or updates."
      : "Search institutions, compare deadlines, check each institution's own application fee, and open the latest prospectus PDFs shared inside Kagie.";

    const institutions = (api.getInstitutionCatalog ? api.getInstitutionCatalog({ includeInactive: false }) : (window.KagieData?.institutions || []))
      .map((item, index) => ({
        id: String(item?.id || `institution_${index + 1}`),
        name: String(item?.name || item?.institution || "").trim(),
        shortName: String(item?.shortName || "").trim(),
        province: String(item?.province || "").trim(),
        type: String(item?.type || "").trim(),
        year: String(item?.year || "").trim(),
        logo: String(item?.logo || "").trim(),
        status: String(item?.status || "").trim(),
        applicationDeadline: String(item?.closingDate || item?.applicationDeadline || "").trim(),
        applicationFee: Number(item?.applicationFee || 0),
        applicationFeeNote: String(item?.applicationFeeNote || item?.application_fee_note || "").trim(),
        faculties: Array.isArray(item?.faculties) ? item.faculties : []
      }))
      .filter((item) => item.name);

    let activeType = "all";
    let documents = [];

    function institutionFeeLabel(institution) {
      return Number(institution.applicationFee || 0) > 0 ? `Institution fee: ${money(institution.applicationFee)}` : "Institution fee: Free";
    }

    function buildGuide(institution) {
      return [
        "Kagie Prospectus Guide",
        "",
        `Institution: ${institution.name}`,
        `Type: ${institution.type}`,
        `Province: ${institution.province}`,
        `Application Deadline: ${institution.applicationDeadline || "Check institution website"}`,
        institutionFeeLabel(institution),
        institution.applicationFeeNote ? `Fee Note: ${institution.applicationFeeNote}` : "",
        "",
        "Faculties and Courses:",
        institution.faculties.length
          ? institution.faculties.map((faculty) => `- ${faculty.name}: ${faculty.courses.join(", ")}`).join("\n")
          : "- Kagie is still expanding this institution's full faculty guide.",
        "",
        "Prepared by Kagie to help you shortlist institutions and plan your next step."
      ].filter(Boolean).join("\n");
    }

    function downloadGuide(institutionId) {
      const institution = institutions.find((item) => item.id === institutionId);
      if (!institution) return;
      const blob = new Blob([buildGuide(institution)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${institution.shortName || institution.name}-kagie-guide.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }

    function setUploadMessage(text, tone) {
      const node = $("uploadMsg");
      if (!node) return;
      node.textContent = text || "";
      node.className = tone ? `msg ${tone}` : "msg";
    }

    function getVisibleInstitutions() {
      const query = $("search").value.trim().toLowerCase();
      return institutions.filter((institution) => {
        if (activeType !== "all" && institution.type !== activeType) return false;
        if (!query) return true;
        const haystack = [
          institution.name,
          institution.shortName,
          institution.province,
          institution.type
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });
    }

    function groupedDocuments() {
      return documents.reduce((acc, document) => {
        acc[document.institutionId] = acc[document.institutionId] || [];
        acc[document.institutionId].push(document);
        return acc;
      }, {});
    }

    function renderList() {
      const grouped = groupedDocuments();
      const visible = getVisibleInstitutions();
      $("countMeta").textContent = `${documents.length} prospectus file${documents.length === 1 ? "" : "s"}`;
      $("list").innerHTML = visible.length ? visible.map((institution) => {
        const docs = (grouped[institution.id] || []).slice().sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        const hasHighlight = highlightedInstitutionId && highlightedInstitutionId === institution.id.toLowerCase();
        const logo = institution.logo
          ? `<img src="${esc(institution.logo)}" alt="${esc(institution.shortName || institution.name)} logo" style="width:68px;height:68px;object-fit:contain;border-radius:18px;border:1px solid rgba(47,164,255,.12);padding:10px;background:linear-gradient(135deg,#fff,#eef6ff)" />`
          : `<span class="badge">${esc(institution.shortName || institution.name.split(" ").map((part) => part[0]).slice(0, 3).join(""))}</span>`;

        return `
          <div class="item ${hasHighlight ? "active" : ""}" data-institution-id="${esc(institution.id)}">
            <div class="item-head">
              <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
                <div>${logo}</div>
                <div>
                  <strong>${esc(institution.name)}</strong>
                  <p>
                    ${esc(institution.type)} · ${esc(institution.province)}<br>
                    Deadline: ${esc(institution.applicationDeadline || "Check institution directly")}<br>
                    ${esc(institutionFeeLabel(institution))}${institution.applicationFeeNote ? `<br>${esc(institution.applicationFeeNote)}` : ""}
                  </p>
                </div>
              </div>
              <div class="action-row">
                <button class="mini yellow" type="button" data-download-guide="${esc(institution.id)}">Download guide</button>
              </div>
            </div>
            <div class="doc-list">
              ${docs.length ? docs.map((document) => `
                <div class="doc-row">
                  <div>
                    <strong>${esc(document.title)}</strong>
                    <p>
                      ${esc(document.fileName)}<br>
                      ${document.uploadedByName ? `Uploaded by ${esc(document.uploadedByName)} · ` : ""}${esc(dt(document.updatedAt || document.createdAt))}<br>
                      ${document.description ? esc(document.description) : "Shared in the Kagie prospectus library for learner planning."}
                    </p>
                  </div>
                  <div class="doc-actions">
                    <a class="mini" href="${esc(document.fileUrl || "#")}" target="_blank" rel="noopener">Open PDF</a>
                    ${isStaff ? `<button class="mini red" type="button" data-delete-document="${esc(document.id)}">Remove</button>` : ""}
                  </div>
                </div>
              `).join("") : `<div class="empty">No PDF has been uploaded yet for this institution. Learners can still use the Kagie guide above.</div>`}
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No institutions match this filter right now.</div>';

      if (highlightedInstitutionId) {
        const node = document.querySelector(`[data-institution-id="${highlightedInstitutionId}"]`);
        if (node) {
          window.setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
        }
      }
    }

    async function refreshDocuments() {
      try {
        documents = api.getProspectusDocumentsAsync
          ? await api.getProspectusDocumentsAsync()
          : api.getProspectusDocuments();
      } catch (error) {
        console.warn("Could not refresh prospectus documents:", error);
        documents = api.getProspectusDocuments ? api.getProspectusDocuments() : [];
      }
      renderList();
    }

    if (isStaff) {
      $("uploadCard").hidden = false;
      $("uploadInstitution").innerHTML = institutions.map((institution) => `<option value="${esc(institution.id)}">${esc(institution.name)} (${esc(institution.province)})</option>`).join("");

      $("uploadForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = $("uploadFile").files?.[0] || null;
        setUploadMessage("");
        try {
          await api.saveProspectusDocumentByStaffAsync({
            institutionId: $("uploadInstitution").value,
            title: $("uploadTitle").value,
            description: $("uploadDescription").value,
            file
          });
          $("uploadForm").reset();
          setUploadMessage("Prospectus PDF uploaded to Kagie's shared library.", "success");
          await refreshDocuments();
        } catch (error) {
          setUploadMessage(error?.message || "Could not upload the prospectus PDF.", "error");
        }
      });

      $("uploadResetBtn").addEventListener("click", () => {
        $("uploadForm").reset();
        setUploadMessage("");
      });
    }

    document.addEventListener("click", async (event) => {
      const downloadId = event.target.closest("[data-download-guide]")?.dataset?.downloadGuide;
      if (downloadId) {
        downloadGuide(downloadId);
        return;
      }

      const deleteId = event.target.closest("[data-delete-document]")?.dataset?.deleteDocument;
      if (deleteId && isStaff) {
        try {
          await api.deleteProspectusDocumentByStaffAsync(deleteId);
          setUploadMessage("Prospectus PDF removed from the shared library.", "success");
          await refreshDocuments();
        } catch (error) {
          setUploadMessage(error?.message || "Could not remove that PDF.", "error");
        }
      }
    });

    document.querySelectorAll("[data-type]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-type]").forEach((node) => node.classList.remove("active"));
        button.classList.add("active");
        activeType = button.dataset.type || "all";
        renderList();
      });
    });

    $("search").addEventListener("input", renderList);

    if (highlightedInstitutionId) {
      const highlighted = institutions.find((item) => item.id.toLowerCase() === highlightedInstitutionId);
      if (highlighted) {
        $("search").value = highlighted.name;
      }
    }

    await refreshDocuments();
  }

  document.addEventListener("DOMContentLoaded", main);
})();
