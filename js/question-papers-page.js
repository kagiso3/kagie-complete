(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const YEARS = Array.from({ length: 17 }, (_, index) => String(2026 - index));
  const GRADES = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
  const PROVINCES = ["National", "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

  const state = {
    api: null,
    user: null,
    papers: [],
    editingId: "",
    loading: false
  };

  function normalizeRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (["master_admin", "master admin", "master-admin", "masteradmin", "owner"].includes(value)) return "master_admin";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "staff"].includes(value)) return "assistant_admin";
    return "user";
  }

  function initialsFor(value, fallback = "KG") {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return fallback;
    return words.slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join("");
  }

  function setIdentityUI(user) {
    const name = user?.fullName || user?.full_name || user?.email || "Master Admin";
    const initials = initialsFor(name, "MA");
    ["questionPapersSidebarName", "questionPapersTopName"].forEach((id) => {
      if ($(id)) $(id).textContent = name;
    });
    ["questionPapersSidebarAvatar", "questionPapersTopAvatar"].forEach((id) => {
      if ($(id)) $(id).textContent = initials;
    });
  }

  function roleRedirect(user) {
    const role = normalizeRole(user?.role);
    if (role === "master_admin") return false;
    if (role === "assistant_admin") {
      window.location.replace("./assistant/dashboard.html");
      return true;
    }
    window.location.replace("./login.html");
    return true;
  }

  function formatDate(value) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  }

  function statusClass(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value === "published") return "completed";
    if (value === "disabled") return "assigned";
    return "pending";
  }

  function firstSubjectList() {
    const subjects = state.api?.getSubjectCatalog ? state.api.getSubjectCatalog("dbe") : [];
    return Array.isArray(subjects) ? subjects.slice().sort((a, b) => String(a).localeCompare(String(b))) : [];
  }

  function populateSelect(node, options, includeAllLabel) {
    if (!node) return;
    const values = Array.isArray(options) ? options : [];
    node.innerHTML = [
      includeAllLabel ? `<option value="">${esc(includeAllLabel)}</option>` : "",
      ...values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`)
    ].join("");
  }

  function renderFilterOptions() {
    const subjects = [...new Set(state.papers.map((paper) => String(paper.subject || "").trim()).filter(Boolean))];
    const years = [...new Set(state.papers.map((paper) => String(paper.year || "").trim()).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    const terms = [...new Set(state.papers.map((paper) => String(paper.term || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    populateSelect($("questionPaperGradeFilter"), GRADES, "All grades");
    populateSelect($("questionPaperSubjectFilter"), subjects, "All subjects");
    populateSelect($("questionPaperYearFilter"), years, "All years");
    populateSelect($("questionPaperTermFilter"), terms, "All terms");
  }

  function filteredPapers() {
    const query = String($("questionPaperSearch")?.value || "").trim().toLowerCase();
    const grade = String($("questionPaperGradeFilter")?.value || "").trim();
    const subject = String($("questionPaperSubjectFilter")?.value || "").trim();
    const year = String($("questionPaperYearFilter")?.value || "").trim();
    const term = String($("questionPaperTermFilter")?.value || "").trim();
    const status = String($("questionPaperStatusFilter")?.value || "").trim();

    return state.papers.filter((paper) => {
      if (grade && paper.grade !== grade) return false;
      if (subject && paper.subject !== subject) return false;
      if (year && String(paper.year) !== year) return false;
      if (term && paper.term !== term) return false;
      if (status && paper.status !== status) return false;
      if (query) {
        const haystack = [
          paper.grade,
          paper.subject,
          paper.title,
          paper.year,
          paper.term,
          paper.province,
          paper.paperType,
          paper.status
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function renderStats() {
    $("questionPaperTotalStat").textContent = String(state.papers.length);
    $("questionPaperPublishedStat").textContent = String(state.papers.filter((paper) => paper.status === "Published").length);
    $("questionPaperDraftStat").textContent = String(state.papers.filter((paper) => paper.status === "Draft").length);
    $("questionPaperDisabledStat").textContent = String(state.papers.filter((paper) => paper.status === "Disabled").length);
  }

  function renderRows() {
    const rows = filteredPapers();
    $("questionPaperMeta").textContent = state.loading
      ? "Loading question papers..."
      : `Showing ${rows.length} of ${state.papers.length} question paper record${state.papers.length === 1 ? "" : "s"}.`;

    if (state.loading) {
      $("questionPaperRows").innerHTML = `<div class="empty-state">Loading question papers from the database...</div>`;
      return;
    }
    if (!rows.length) {
      $("questionPaperRows").innerHTML = `<div class="empty-state">No question papers match those filters.</div>`;
      return;
    }

    $("questionPaperRows").innerHTML = rows.map((paper) => `
      <article class="queue-row" data-paper-id="${esc(paper.id)}">
        <div class="queue-cell"><div class="queue-user-name">${esc(paper.grade)}</div></div>
        <div class="queue-cell"><div class="queue-user-name">${esc(paper.subject)}</div></div>
        <div class="queue-cell">
          <div class="paper-admin-meta">
            <strong>${esc(paper.title)}</strong>
            <span class="queue-muted">${esc(paper.fileName || "PDF file linked")}</span>
          </div>
        </div>
        <div class="queue-cell"><div class="queue-user-name">${esc(String(paper.year))}</div></div>
        <div class="queue-cell"><div class="queue-user-name">${esc(paper.term)}</div></div>
        <div class="queue-cell"><div class="queue-user-name">${esc(paper.province)}</div></div>
        <div class="queue-cell"><span class="status-pill new">${esc(paper.paperType)}</span></div>
        <div class="queue-cell"><span class="status-pill ${statusClass(paper.status)}">${esc(paper.status)}</span></div>
        <div class="queue-cell paper-admin-actions">
          ${paper.fileUrl ? `<a class="table-action" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener">Open</a>` : ""}
          <button class="table-action" type="button" data-action="edit" data-paper-id="${esc(paper.id)}">Edit</button>
          ${paper.status === "Disabled"
            ? `<button class="table-action" type="button" data-action="publish" data-paper-id="${esc(paper.id)}">Publish</button>`
            : `<button class="table-action" type="button" data-action="disable" data-paper-id="${esc(paper.id)}">Disable</button>`}
          <button class="table-action danger" type="button" data-action="delete" data-paper-id="${esc(paper.id)}">Delete</button>
        </div>
      </article>
    `).join("");
  }

  function openModal() {
    $("questionPaperModal")?.classList.add("open");
    $("questionPaperModal")?.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("questionPaperModal")?.classList.remove("open");
    $("questionPaperModal")?.setAttribute("aria-hidden", "true");
  }

  function clearFormMessage(kind, message) {
    const node = $("questionPaperFormMessage");
    if (!node) return;
    node.className = `status-message ${kind}`;
    node.textContent = message;
  }

  function fillFormDefaults() {
    populateSelect($("questionPaperFormGrade"), GRADES);
    populateSelect($("questionPaperFormSubject"), firstSubjectList());
    populateSelect($("questionPaperFormYear"), YEARS);
    populateSelect($("questionPaperFormProvince"), PROVINCES);
    if ($("questionPaperFormGrade")) $("questionPaperFormGrade").value = "Grade 12";
    if ($("questionPaperFormYear")) $("questionPaperFormYear").value = YEARS[0];
    if ($("questionPaperFormProvince")) $("questionPaperFormProvince").value = "National";
    if ($("questionPaperFormStatus")) $("questionPaperFormStatus").value = "Draft";
    if ($("questionPaperFormType")) $("questionPaperFormType").value = "Question Paper";
    if ($("questionPaperFormTerm")) $("questionPaperFormTerm").value = "November";
  }

  function resetForm() {
    state.editingId = "";
    $("questionPaperModalTitle").textContent = "Upload question paper";
    $("questionPaperModalSub").textContent = "Save a learner-facing paper, memo, or study guide without changing the Kagie dashboard layout.";
    $("questionPaperFormTitle").value = "";
    $("questionPaperFormFile").value = "";
    fillFormDefaults();
    $("questionPaperExistingFile").hidden = true;
    $("questionPaperExistingFile").textContent = "No PDF linked yet.";
    clearFormMessage("info", "Question papers marked Published will appear inside the learner Career Hub. Draft and Disabled records stay hidden.");
  }

  function openCreateModal() {
    resetForm();
    openModal();
  }

  function openEditModal(paperId) {
    const paper = state.papers.find((entry) => String(entry.id) === String(paperId));
    if (!paper) return;
    state.editingId = paper.id;
    $("questionPaperModalTitle").textContent = "Edit question paper";
    $("questionPaperModalSub").textContent = `Update ${paper.title} without changing the rest of the Kagie admin layout.`;
    fillFormDefaults();
    $("questionPaperFormGrade").value = paper.grade || "Grade 12";
    $("questionPaperFormSubject").value = paper.subject || "";
    $("questionPaperFormTitle").value = paper.title || "";
    $("questionPaperFormYear").value = String(paper.year || YEARS[0]);
    $("questionPaperFormTerm").value = paper.term || "November";
    $("questionPaperFormProvince").value = paper.province || "National";
    $("questionPaperFormType").value = paper.paperType || "Question Paper";
    $("questionPaperFormStatus").value = paper.status || "Draft";
    $("questionPaperFormFile").value = "";
    if (paper.fileName || paper.fileUrl) {
      $("questionPaperExistingFile").hidden = false;
      $("questionPaperExistingFile").textContent = paper.fileName || "Existing PDF linked";
    } else {
      $("questionPaperExistingFile").hidden = true;
    }
    clearFormMessage("info", "Update metadata only or choose a fresh PDF to replace the current file.");
    openModal();
  }

  async function savePaper() {
    const file = $("questionPaperFormFile")?.files?.[0] || null;
    const payload = {
      grade: $("questionPaperFormGrade")?.value || "",
      subject: $("questionPaperFormSubject")?.value || "",
      title: $("questionPaperFormTitle")?.value || "",
      year: $("questionPaperFormYear")?.value || "",
      term: $("questionPaperFormTerm")?.value || "",
      province: $("questionPaperFormProvince")?.value || "",
      paperType: $("questionPaperFormType")?.value || "",
      status: $("questionPaperFormStatus")?.value || "",
      file
    };

    $("questionPaperSaveBtn").disabled = true;
    clearFormMessage("info", "Saving question paper...");
    try {
      if (state.editingId) {
        await state.api.updateQuestionPaperByAdminAsync(state.editingId, payload);
      } else {
        await state.api.saveQuestionPaperByAdminAsync(payload);
      }
      clearFormMessage("ok", "Question paper saved.");
      await refresh();
      window.setTimeout(closeModal, 400);
    } catch (error) {
      clearFormMessage("err", error?.message || "Could not save the question paper.");
    } finally {
      $("questionPaperSaveBtn").disabled = false;
    }
  }

  async function updateStatus(paperId, status) {
    try {
      await state.api.updateQuestionPaperByAdminAsync(paperId, { status });
      await refresh();
    } catch (error) {
      $("questionPaperMeta").textContent = error?.message || "Could not update the paper status.";
    }
  }

  async function deletePaper(paperId) {
    const confirmed = window.confirm("Delete this question paper record and its linked PDF?");
    if (!confirmed) return;
    try {
      await state.api.deleteQuestionPaperByAdminAsync(paperId);
      await refresh();
    } catch (error) {
      $("questionPaperMeta").textContent = error?.message || "Could not delete the question paper.";
    }
  }

  async function refresh() {
    state.loading = true;
    renderRows();
    try {
      const rows = state.api.getQuestionPapersForAdminAsync
        ? await state.api.getQuestionPapersForAdminAsync({ includeAllStatuses: true })
        : state.api.getQuestionPapers({ includeAllStatuses: true });
      state.papers = Array.isArray(rows) ? rows : [];
      renderFilterOptions();
      renderStats();
    } catch (error) {
      $("questionPaperRows").innerHTML = `<div class="status-message err">${esc(error?.message || "Could not load question papers from the database.")}</div>`;
      $("questionPaperMeta").textContent = "Question paper library failed to load.";
    } finally {
      state.loading = false;
      renderRows();
    }
  }

  function bindEvents() {
    ["questionPaperSearch", "questionPaperGradeFilter", "questionPaperSubjectFilter", "questionPaperYearFilter", "questionPaperTermFilter", "questionPaperStatusFilter"].forEach((id) => {
      $(id)?.addEventListener("input", renderRows);
      $(id)?.addEventListener("change", renderRows);
    });
    $("questionPapersCreateBtn")?.addEventListener("click", openCreateModal);
    $("questionPapersRefreshBtn")?.addEventListener("click", refresh);
    $("questionPapersSignOut")?.addEventListener("click", () => state.api.logoutReal?.() || state.api.logout?.());
    $("questionPaperSaveBtn")?.addEventListener("click", savePaper);
    $("questionPaperRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const paperId = button.dataset.paperId;
      if (button.dataset.action === "edit") openEditModal(paperId);
      if (button.dataset.action === "publish") updateStatus(paperId, "Published");
      if (button.dataset.action === "disable") updateStatus(paperId, "Disabled");
      if (button.dataset.action === "delete") deletePaper(paperId);
    });
    document.querySelectorAll("[data-close-question-paper]").forEach((button) => button.addEventListener("click", closeModal));
    $("questionPapersMenuToggle")?.addEventListener("click", () => {
      $("questionPapersSidebar")?.classList.add("open");
      $("questionPapersOverlay")?.classList.add("open");
    });
    $("questionPapersOverlay")?.addEventListener("click", () => {
      $("questionPapersSidebar")?.classList.remove("open");
      $("questionPapersOverlay")?.classList.remove("open");
    });
  }

  async function main() {
    const api = window.KagieAPI;
    if (!api) return;
    state.api = api;

    let restored = null;
    try {
      restored = api.resolveSessionUser
        ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
        : await api.restoreSession();
    } catch (_error) {
      restored = api.currentUser?.() || api.getCurrentUser?.() || null;
    }

    const activeUser = restored || api.currentUser?.() || api.getCurrentUser?.() || null;
    if (!activeUser || roleRedirect(activeUser)) return;
    state.user = api.requireRole("master_admin");
    setIdentityUI(state.user);
    fillFormDefaults();
    bindEvents();
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => {
      console.error("Question papers page failed:", error);
      $("questionPaperRows").innerHTML = `<div class="status-message err">${esc(error?.message || "Could not load the question papers page.")}</div>`;
      $("questionPaperMeta").textContent = "Question papers page failed to load.";
    });
  });
})();
