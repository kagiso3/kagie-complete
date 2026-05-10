(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];
  const TYPES = ["University", "TVET", "College", "Private Institution"];

  const state = {
    api: null,
    user: null,
    institutions: [],
    editingId: "",
    loading: false
  };
  const actionLocks = new Set();

  async function runButtonAction(button, key, busyText, task) {
    const lockKey = String(key || button?.dataset?.action || button?.id || "institution-action");
    if (actionLocks.has(lockKey)) return;
    actionLocks.add(lockKey);
    const originalText = button?.textContent || "";
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      if (busyText) button.textContent = busyText;
    }
    try {
      await task();
    } finally {
      actionLocks.delete(lockKey);
      if (button?.isConnected) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        if (busyText) button.textContent = originalText;
      }
    }
  }

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
    ["institutionsSidebarName", "institutionsTopName"].forEach((id) => {
      if ($(id)) $(id).textContent = name;
    });
    ["institutionsSidebarAvatar", "institutionsTopAvatar"].forEach((id) => {
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

  function populateSelect(node, options, includeLabel) {
    if (!node) return;
    const values = Array.isArray(options) ? options : [];
    node.innerHTML = [
      includeLabel ? `<option value="">${esc(includeLabel)}</option>` : "",
      ...values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`)
    ].join("");
  }

  function lifecycleStatus(institution) {
    if (institution?.isActive === false) return "disabled";
    return String(institution?.status || "open").trim().toLowerCase() || "open";
  }

  function lifecycleLabel(status) {
    if (status === "closing_soon") return "Closing Soon";
    if (status === "closed") return "Closed";
    if (status === "disabled") return "Disabled";
    return "Open";
  }

  function statusClass(status) {
    if (status === "open") return "completed";
    if (status === "closing_soon") return "pending";
    if (status === "closed") return "assigned";
    return "new";
  }

  function filteredInstitutions() {
    const query = String($("institutionsSearch")?.value || "").trim().toLowerCase();
    const type = String($("institutionsTypeFilter")?.value || "").trim();
    const province = String($("institutionsProvinceFilter")?.value || "").trim();
    const status = String($("institutionsStatusFilter")?.value || "").trim();
    return state.institutions.filter((institution) => {
      const displayStatus = lifecycleStatus(institution);
      if (type && institution.type !== type) return false;
      if (province && institution.province !== province) return false;
      if (status && displayStatus !== status) return false;
      if (query) {
        const haystack = [
          institution.name,
          institution.shortName,
          institution.type,
          institution.province,
          institution.website,
          institution.notes,
          lifecycleLabel(displayStatus)
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function renderStats() {
    const visible = state.institutions.filter((institution) => institution.isActive !== false);
    $("institutionsTotalStat").textContent = String(visible.length);
    $("institutionsOpenStat").textContent = String(visible.filter((institution) => lifecycleStatus(institution) === "open").length);
    $("institutionsClosingStat").textContent = String(visible.filter((institution) => lifecycleStatus(institution) === "closing_soon").length);
    $("institutionsDisabledStat").textContent = String(state.institutions.filter((institution) => institution.isActive === false).length);
  }

  function renderFilterOptions() {
    const types = [...new Set(state.institutions.map((institution) => String(institution.type || "").trim()).filter(Boolean))];
    const provinces = [...new Set(state.institutions.map((institution) => String(institution.province || "").trim()).filter(Boolean))];
    populateSelect($("institutionsTypeFilter"), types.length ? types : TYPES, "All types");
    populateSelect($("institutionsProvinceFilter"), provinces.length ? provinces : PROVINCES, "All provinces");
  }

  function renderRows() {
    const rows = filteredInstitutions();
    $("institutionsMeta").textContent = state.loading
      ? "Loading institutions..."
      : `Showing ${rows.length} of ${state.institutions.length} institution record${state.institutions.length === 1 ? "" : "s"}.`;

    if (state.loading) {
      $("institutionsRows").innerHTML = `<div class="empty-state">Loading institutions from the database...</div>`;
      return;
    }
    if (!rows.length) {
      $("institutionsRows").innerHTML = `<div class="empty-state">No institutions match those filters.</div>`;
      return;
    }

    $("institutionsRows").innerHTML = rows.map((institution) => {
      const status = lifecycleStatus(institution);
      return `
        <article class="queue-row" data-institution-id="${esc(institution.id)}">
          <div class="queue-cell">
            <div class="institution-meta">
              <strong>${esc(institution.name)}</strong>
              <span class="queue-muted">${esc(institution.shortName || institution.website || "No website yet")}</span>
            </div>
          </div>
          <div class="queue-cell"><div class="queue-user-name">${esc(institution.type || "Institution")}</div></div>
          <div class="queue-cell"><div class="queue-user-name">${esc(institution.province || "No province")}</div></div>
          <div class="queue-cell"><span class="status-pill ${statusClass(status)}">${esc(lifecycleLabel(status))}</span></div>
          <div class="queue-cell"><span class="switch-chip ${institution.isActive === false ? "off" : ""}">${institution.isActive === false ? "Hidden" : "Visible"}</span></div>
          <div class="queue-cell"><div class="queue-user-name">${esc(institution.closingDate || "Not set")}</div></div>
          <div class="queue-cell institution-actions">
            <button class="table-action" type="button" data-action="edit" data-institution-id="${esc(institution.id)}">Edit</button>
            <button class="table-action" type="button" data-action="toggle" data-institution-id="${esc(institution.id)}">${institution.isActive === false ? "Enable" : "Disable"}</button>
            <button class="table-action danger" type="button" data-action="delete" data-institution-id="${esc(institution.id)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openModal() {
    $("institutionModal")?.classList.add("open");
    $("institutionModal")?.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("institutionModal")?.classList.remove("open");
    $("institutionModal")?.setAttribute("aria-hidden", "true");
  }

  function setFormMessage(kind, message) {
    const node = $("institutionFormMessage");
    if (!node) return;
    node.className = `status-message ${kind}`;
    node.textContent = message;
  }

  function fillDefaults() {
    populateSelect($("institutionFormProvince"), PROVINCES);
    if ($("institutionFormProvince")) $("institutionFormProvince").value = "Gauteng";
    if ($("institutionFormType")) $("institutionFormType").value = "University";
    if ($("institutionFormStatus")) $("institutionFormStatus").value = "open";
    if ($("institutionFormVisible")) $("institutionFormVisible").checked = true;
  }

  function resetForm() {
    state.editingId = "";
    $("institutionModalTitle").textContent = "Add institution";
    $("institutionModalSub").textContent = "Control what learners can see during institution selection without changing the Kagie learner form layout.";
    $("institutionFormName").value = "";
    $("institutionFormShortName").value = "";
    $("institutionFormWebsite").value = "";
    $("institutionFormOpeningDate").value = "";
    $("institutionFormClosingDate").value = "";
    $("institutionFormNotes").value = "";
    fillDefaults();
    setFormMessage("info", "Changes here update the institution choices learners see when they select universities, TVET colleges, colleges, or private institutions.");
  }

  function openCreateModal() {
    resetForm();
    openModal();
  }

  function openEditModal(institutionId) {
    const institution = state.institutions.find((entry) => String(entry.id) === String(institutionId));
    if (!institution) return;
    state.editingId = institution.id;
    $("institutionModalTitle").textContent = "Edit institution";
    $("institutionModalSub").textContent = `Update ${institution.name} without redesigning the learner application flow.`;
    fillDefaults();
    $("institutionFormName").value = institution.name || "";
    $("institutionFormShortName").value = institution.shortName || "";
    $("institutionFormType").value = institution.type || "University";
    $("institutionFormProvince").value = institution.province || "Gauteng";
    $("institutionFormWebsite").value = institution.website || "";
    $("institutionFormStatus").value = institution.status || "open";
    $("institutionFormOpeningDate").value = institution.openingDate || "";
    $("institutionFormClosingDate").value = institution.closingDate || "";
    $("institutionFormNotes").value = institution.notes || "";
    $("institutionFormVisible").checked = institution.isActive !== false;
    setFormMessage("info", "Save changes to control visibility, lifecycle badges, and learner-facing institution options.");
    openModal();
  }

  async function saveInstitution() {
    const payload = {
      name: $("institutionFormName")?.value || "",
      shortName: $("institutionFormShortName")?.value || "",
      type: $("institutionFormType")?.value || "",
      province: $("institutionFormProvince")?.value || "",
      website: $("institutionFormWebsite")?.value || "",
      status: $("institutionFormStatus")?.value || "",
      openingDate: $("institutionFormOpeningDate")?.value || "",
      closingDate: $("institutionFormClosingDate")?.value || "",
      notes: $("institutionFormNotes")?.value || "",
      isActive: Boolean($("institutionFormVisible")?.checked)
    };

    let slowTimer = 0;
    setFormMessage("info", "Saving institution...");
    try {
      slowTimer = window.setTimeout(() => {
        setFormMessage("info", "Still processing, please wait...");
      }, 3200);
      if (state.editingId) {
        await state.api.updateInstitutionByAdminAsync(state.editingId, payload);
      } else {
        await state.api.addInstitutionByAdminAsync(payload);
      }
      setFormMessage("ok", "Institution saved.");
      await refresh();
      window.setTimeout(closeModal, 400);
    } catch (error) {
      setFormMessage("err", error?.message || "Could not save the institution.");
    } finally {
      if (slowTimer) window.clearTimeout(slowTimer);
    }
  }

  async function toggleVisibility(institutionId) {
    const institution = state.institutions.find((entry) => String(entry.id) === String(institutionId));
    if (!institution) return;
    try {
      await state.api.updateInstitutionByAdminAsync(institutionId, { isActive: institution.isActive === false });
      await refresh();
    } catch (error) {
      $("institutionsMeta").textContent = error?.message || "Could not update institution visibility.";
    }
  }

  async function deleteInstitution(institutionId) {
    const confirmed = window.confirm("Delete this institution from the Kagie catalog?");
    if (!confirmed) return;
    try {
      await state.api.deleteInstitutionByAdminAsync(institutionId);
      await refresh();
    } catch (error) {
      $("institutionsMeta").textContent = error?.message || "Could not delete the institution.";
    }
  }

  async function refresh() {
    state.loading = true;
    renderRows();
    try {
      const rows = state.api.getInstitutionsForAdminAsync
        ? await state.api.getInstitutionsForAdminAsync({ includeInactive: true })
        : state.api.getInstitutionsForAdmin({ includeInactive: true });
      state.institutions = Array.isArray(rows) ? rows : [];
      renderFilterOptions();
      renderStats();
    } catch (error) {
      $("institutionsRows").innerHTML = `<div class="status-message err">${esc(error?.message || "Could not load institutions from the database.")}</div>`;
      $("institutionsMeta").textContent = "Institution console failed to load.";
    } finally {
      state.loading = false;
      renderRows();
    }
  }

  function bindEvents() {
    let filterTimer = 0;
    ["institutionsSearch", "institutionsTypeFilter", "institutionsProvinceFilter", "institutionsStatusFilter"].forEach((id) => {
      $(id)?.addEventListener("input", () => {
        if (filterTimer) window.clearTimeout(filterTimer);
        filterTimer = window.setTimeout(() => {
          filterTimer = 0;
          renderRows();
        }, 120);
      });
      $(id)?.addEventListener("change", renderRows);
    });
    $("institutionsCreateBtn")?.addEventListener("click", openCreateModal);
    $("institutionsRefreshBtn")?.addEventListener("click", (event) => {
      runButtonAction(event.currentTarget, "institutions-refresh", "Refreshing...", refresh);
    });
    $("institutionsSignOut")?.addEventListener("click", () => state.api.logoutReal?.() || state.api.logout?.());
    $("institutionSaveBtn")?.addEventListener("click", (event) => {
      runButtonAction(event.currentTarget, "institution-save", "Saving...", saveInstitution);
    });
    $("institutionsRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const institutionId = button.dataset.institutionId;
      if (button.dataset.action === "edit") openEditModal(institutionId);
      if (button.dataset.action === "toggle") {
        runButtonAction(button, `institution-toggle:${institutionId}`, "Updating...", () => toggleVisibility(institutionId));
      }
      if (button.dataset.action === "delete") {
        runButtonAction(button, `institution-delete:${institutionId}`, "Deleting...", () => deleteInstitution(institutionId));
      }
    });
    document.querySelectorAll("[data-close-institution]").forEach((button) => button.addEventListener("click", closeModal));
    $("institutionsMenuToggle")?.addEventListener("click", () => {
      $("institutionsSidebar")?.classList.add("open");
      $("institutionsOverlay")?.classList.add("open");
    });
    $("institutionsOverlay")?.addEventListener("click", () => {
      $("institutionsSidebar")?.classList.remove("open");
      $("institutionsOverlay")?.classList.remove("open");
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
    fillDefaults();
    bindEvents();
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => {
      console.error("Institutions page failed:", error);
      $("institutionsRows").innerHTML = `<div class="status-message err">${esc(error?.message || "Could not load the institutions page.")}</div>`;
      $("institutionsMeta").textContent = "Institutions page failed to load.";
    });
  });
})();
