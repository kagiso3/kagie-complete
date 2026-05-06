(function () {
  window.KagieAdminUsersPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const PAGE_SIZE = 25;

  const state = {
    api: null,
    user: null,
    users: [],
    assistants: [],
    summary: null,
    profileCache: new Map(),
    selectedForAssign: null,
    loading: false,
    page: 1,
    error: ""
  };

  function normalizeRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(value)) return "master_admin";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "administrator", "staff", "support", "support_staff", "support staff"].includes(value)) return "assistant_admin";
    if (["parent", "guardian"].includes(value)) return "parent";
    if (["teacher", "educator", "school_admin", "school admin"].includes(value)) return "teacher";
    return "user";
  }

  function initialsFor(value, fallback = "KG") {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return fallback;
    return words.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  }

  function formatDate(value) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  }

  function statusClass(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value.includes("complete") || value.includes("accept") || value.includes("reject")) return "completed";
    if (value.includes("assign")) return "assigned";
    if (value.includes("progress") || value.includes("review") || value.includes("process") || value.includes("submitted") || value.includes("started")) return "in-progress";
    if (value.includes("account")) return "new";
    return "pending";
  }

  function roleLabel(role) {
    const normalized = normalizeRole(role);
    if (normalized === "master_admin") return "Master Admin";
    if (normalized === "assistant_admin") return "Assistant Admin";
    if (normalized === "parent") return "Parent";
    if (normalized === "teacher") return "Teacher";
    return "Learner";
  }

  function roleLabelForUser(user) {
    return firstFilled(user?.roleLabel, roleLabel(user?.role));
  }

  function uniqueUsersByIdOrEmail(...groups) {
    const seen = new Set();
    const rows = [];
    groups.flatMap((group) => asArray(group)).forEach((item) => {
      const key = String(firstFilled(item?.supabaseUserId, item?.id, item?.email)).trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      rows.push(item);
    });
    return rows;
  }

  function rowSearchText(user) {
    return [
      user.fullName,
      user.surname,
      user.email,
      user.phone,
      user.idNumber,
      user.location,
      user.province,
      user.schoolName,
      user.school_name,
      user.grade,
      user.applicationStatus,
      user.latestApplicationStatus,
      user.accountStatus,
      user.role,
      user.roleLabel,
      roleLabelForUser(user),
      user.assignedAssistantName,
      user.selectedInstitution,
      user.selectedFaculty,
      user.createdAt,
      user.lastLogin,
      asArray(user.selectedCourses).join(" ")
    ].join(" ").toLowerCase();
  }

  function filteredUsers() {
    const query = String($("adminUsersSearch")?.value || "").trim().toLowerCase();
    const status = String($("adminUsersStatusFilter")?.value || "").trim();
    const role = String($("adminUsersRoleFilter")?.value || "").trim();
    const province = String($("adminUsersProvinceFilter")?.value || "").trim();
    const assistant = String($("adminUsersAssistantFilter")?.value || "").trim();

    return state.users.filter((user) => {
      if (query && !rowSearchText(user).includes(query)) return false;
      if (role && normalizeRole(user.role) !== role) return false;
      if (status && firstFilled(user.applicationStatus, user.accountStatus) !== status) return false;
      if (province && String(user.province || "") !== province) return false;
      if (assistant) {
        if (assistant === "__unassigned__" && user.assignedAssistantId) return false;
        if (assistant !== "__unassigned__" && String(user.assignedAssistantId || "") !== assistant) return false;
      }
      return true;
    });
  }

  function renderOptions() {
    const statuses = [...new Set(state.users.map((user) => firstFilled(user.applicationStatus, user.accountStatus)).filter(Boolean))].sort();
    const roles = [...new Set(state.users.map((user) => normalizeRole(user.role)).filter(Boolean))].sort((left, right) => roleLabel(left).localeCompare(roleLabel(right)));
    const provinces = [...new Set(state.users.map((user) => String(user.province || "").trim()).filter(Boolean))].sort();

    if ($("adminUsersStatusFilter")) $("adminUsersStatusFilter").innerHTML = `<option value="">All statuses</option>${statuses.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("")}`;
    if ($("adminUsersRoleFilter")) $("adminUsersRoleFilter").innerHTML = `<option value="">All roles</option>${roles.map((item) => `<option value="${esc(item)}">${esc(roleLabel(item))}</option>`).join("")}`;
    if ($("adminUsersProvinceFilter")) $("adminUsersProvinceFilter").innerHTML = `<option value="">All provinces</option>${provinces.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("")}`;
    if ($("adminUsersAssistantFilter")) $("adminUsersAssistantFilter").innerHTML = [
      `<option value="">All assistants</option>`,
      `<option value="__unassigned__">Unassigned</option>`,
      ...state.assistants.map((assistant) => `<option value="${esc(assistant.supabaseUserId || assistant.id || "")}">${esc(assistant.fullName || assistant.email || "Assistant Admin")}</option>`)
    ].join("");
  }

  function renderStats() {
    const learners = state.users.filter((user) => normalizeRole(user.role) === "user");
    const completedProfiles = learners.filter((user) => Number(user.profileCompletionPercent || 0) >= 80).length;
    const submittedForms = learners.filter((user) => Boolean(user.hasFormDetails) || Number(user.profileCompletionPercent || 0) > 0).length;
    $("usersTotalStat").textContent = String(state.users.length);
    $("usersAccountOnlyStat").textContent = String(completedProfiles);
    $("usersReviewStat").textContent = String(submittedForms);
    $("usersAssignedStat").textContent = String(learners.filter((user) => user.assignedAssistantId).length);
    if ($("usersApplicationsLoadedNote")) {
      $("usersApplicationsLoadedNote").textContent = String(state.summary?.totals?.applications || learners.filter((user) => user.latestApplicationId).length);
    }
    if ($("usersAssistantsLoadedNote")) {
      $("usersAssistantsLoadedNote").textContent = String(state.summary?.totals?.assistants || state.assistants.length);
    }
  }

  function renderPagination(totalPages) {
    const container = $("adminUsersPagination");
    if (!container) return;
    if (state.loading || totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    const windowStart = Math.max(1, state.page - 2);
    const windowEnd = Math.min(totalPages, state.page + 2);
    const buttons = [`<button type="button" data-page="${Math.max(1, state.page - 1)}">Prev</button>`];
    if (windowStart > 1) buttons.push(`<button type="button" data-page="1">1</button>`);
    if (windowStart > 2) buttons.push(`<button type="button" disabled>...</button>`);
    for (let page = windowStart; page <= windowEnd; page += 1) {
      buttons.push(`<button type="button" class="${page === state.page ? "active" : ""}" data-page="${page}">${page}</button>`);
    }
    if (windowEnd < totalPages - 1) buttons.push(`<button type="button" disabled>...</button>`);
    if (windowEnd < totalPages) buttons.push(`<button type="button" data-page="${totalPages}">${totalPages}</button>`);
    buttons.push(`<button type="button" data-page="${Math.min(totalPages, state.page + 1)}">Next</button>`);
    container.innerHTML = buttons.join("");
  }

  function renderRows() {
    const rows = filteredUsers();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    $("adminUsersMeta").textContent = state.loading
      ? "Loading users..."
      : rows.length
        ? `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length} matching account${rows.length === 1 ? "" : "s"} (${state.users.length} total account${state.users.length === 1 ? "" : "s"} loaded, ${state.summary?.totals?.applications || 0} applications, ${state.summary?.totals?.assistants || state.assistants.length} assistants).`
        : `Showing 0 of ${state.users.length} registered account${state.users.length === 1 ? "" : "s"} (${state.summary?.totals?.applications || 0} applications, ${state.summary?.totals?.assistants || state.assistants.length} assistants).`;

    if (state.loading) {
      $("adminUsersRows").innerHTML = `<div class="empty-state">Loading users from the database...</div>`;
      renderPagination(totalPages);
      return;
    }
    if (state.error) {
      $("adminUsersRows").innerHTML = `<div class="status-message err">${esc(state.error)}</div>`;
      $("adminUsersMeta").textContent = "User directory failed to load.";
      renderPagination(1);
      return;
    }
    if (!rows.length) {
      $("adminUsersRows").innerHTML = `<div class="empty-state">No users match those filters.</div>`;
      renderPagination(totalPages);
      return;
    }

    $("adminUsersRows").innerHTML = pageRows.map((user) => {
      const roleText = roleLabelForUser(user);
      const status = firstFilled(user.applicationStatus, user.accountStatus, roleText);
      const isLearner = normalizeRole(user.role) === "user";
      const assistantText = user.assignedAssistantName || (isLearner ? "Unassigned" : roleText);
      return `
        <article class="queue-row" data-user-id="${esc(user.id)}">
          <div class="queue-cell queue-user">
            <div class="queue-avatar master">${esc(initialsFor(user.fullName || user.email, "KG"))}</div>
            <div>
              <div class="queue-user-name">${esc(user.fullName || user.email || "Kagie user")}</div>
              <div class="queue-user-meta">${esc(roleText)}${user.latestApplicationId ? ` · ${esc(user.latestApplicationId.slice(0, 8))}` : ""}</div>
            </div>
          </div>
          <div class="queue-cell">
            <div class="queue-user-name">${esc(user.email || "No email")}</div>
            <div class="queue-muted">${esc(user.phone || "No phone")}</div>
          </div>
          <div class="queue-cell">
            <div class="queue-user-name">${esc(user.idNumber || "No ID yet")}</div>
            <div class="queue-muted">${esc(user.location || user.province || "No location yet")}</div>
          </div>
          <div class="queue-cell"><span class="status-pill ${statusClass(status)}">${esc(status)}</span></div>
          <div class="queue-cell">
            <div class="queue-user-name">${esc(assistantText)}</div>
            <div class="queue-muted">${esc(user.assignedAssistantEmail || "")}</div>
          </div>
          <div class="queue-cell"><span class="queue-muted">${esc(formatDate(user.createdAt))}</span></div>
          <div class="queue-cell admin-users-actions">
            <button class="table-action" type="button" data-action="view" data-user-id="${esc(user.id)}">View profile</button>
            ${isLearner ? `<button class="table-action" type="button" data-action="assign" data-user-id="${esc(user.id)}">Assign admin</button>` : ""}
          </div>
        </article>
      `;
    }).join("");
    renderPagination(totalPages);
  }

  function renderDetailList(items, fallbackText = "Not provided") {
    return `<div class="detail-list">${items.map(([label, value]) => `
      <div class="detail-line">
        <span class="detail-label">${esc(label)}</span>
        <span class="detail-value">${esc(firstFilled(value, fallbackText))}</span>
      </div>
    `).join("")}</div>`;
  }

  function renderSimpleList(items, renderer, emptyText) {
    if (!items.length) return `<div class="empty-state">${esc(emptyText)}</div>`;
    return `<div class="profile-list">${items.map(renderer).join("")}</div>`;
  }

  function documentLink(doc) {
    const url = firstFilled(doc.file_url, doc.fileUrl, doc.url);
    if (!url) return "";
    return `<a class="table-action" href="${esc(url)}" target="_blank" rel="noopener">Open / Download</a>`;
  }

  function renderAccommodationItem(item) {
    const title = firstFilled(item.propertyName, item.property_name, item.institutionName, item.institution_name, "Accommodation request");
    const moveIn = firstFilled(item.preferredMoveInDate, item.preferred_move_in_date, "Not set");
    const funding = firstFilled(item.fundingStatus, item.funding_status, "Not shared");
    const nsfasState = firstFilled(item.nsfasBeneficiary, item.nsfas_beneficiary, "Not shared");
    const nsfasSince = firstFilled(item.nsfasSinceYear, item.nsfas_since_year, "");
    const guardianPhone = firstFilled(item.guardianPhone, item.guardian_phone, "Not provided");
    const summary = firstFilled(item.supportSummary, item.support_summary, item.note, "No extra support summary saved.");
    const status = firstFilled(item.status, "Support review requested");
    return `
      <div class="profile-list-item">
        <strong>${esc(title)}</strong>
        <div class="queue-muted">${esc(status)} - ${esc(firstFilled(item.province, item.location, "Location not set"))}</div>
        <div>Move-in: ${esc(moveIn)} | Funding: ${esc(funding)}</div>
        <div>NSFAS: ${esc(nsfasState)}${nsfasSince ? ` since ${esc(nsfasSince)}` : ""}</div>
        <div>Guardian phone: ${esc(guardianPhone)}</div>
        <div class="queue-muted">${esc(summary)}</div>
      </div>
    `;
  }

  function renderTransportItem(item) {
    const title = `${firstFilled(item.departureCity, item.departure_city, "Departure")} to ${firstFilled(item.destinationCity, item.destination_city, "Destination")}`;
    const company = firstFilled(item.company, "Kagie transport");
    const travelDate = firstFilled(item.travelDate, item.travel_date, "Date pending");
    const returnDate = firstFilled(item.returnDate, item.return_date, "");
    const ticketCode = firstFilled(item.ticketCode, item.ticket_code, "Pending");
    const passengerCount = firstFilled(item.passengers, "1");
    const status = firstFilled(item.ticketStatus, item.ticket_status, item.status, "Ticket sent");
    const paymentRef = firstFilled(item.paymentReference, item.payment_reference, "");
    return `
      <div class="profile-list-item">
        <strong>${esc(title)}</strong>
        <div class="queue-muted">${esc(company)} - ${esc(status)}</div>
        <div>Travel: ${esc(travelDate)}${returnDate ? ` | Return: ${esc(returnDate)}` : ""}</div>
        <div>Passengers: ${esc(passengerCount)} | Ticket: ${esc(ticketCode)}</div>
        ${paymentRef ? `<div class="queue-muted">Payment reference: ${esc(paymentRef)}</div>` : ""}
      </div>
    `;
  }

  function renderProfile(detail) {
    const personal = detail.personalInformation || detail;
    const contact = detail.contactDetails || detail;
    const guardian = detail.guardianInfo || {};
    const school = detail.schoolInfo || {};
    const institutions = asArray(detail.selectedInstitutions);
    const courses = asArray(detail.selectedCourses);
    const docs = asArray(detail.uploadedDocuments);
    const payments = asArray(detail.paymentRecords);
    const applications = asArray(detail.applications);
    const cartItems = asArray(detail.cartItems);
    const notes = asArray(detail.adminNotes);
    const timeline = asArray(detail.activityTimeline);
    const accommodation = asArray(detail.accommodationRequests);
    const transport = asArray(detail.transportRequests);

    $("adminUserProfileTitle").textContent = detail.fullName || detail.email || "User profile";
    $("adminUserProfileSub").textContent = `${roleLabelForUser(detail)} · ${firstFilled(detail.applicationStatus, detail.accountStatus, "No status")}`;
    $("adminUserProfileBody").innerHTML = `
      <div class="profile-sections">
        <section class="profile-section">
          <h4>Personal Information</h4>
          ${renderDetailList([
            ["Full name", personal.fullName || detail.fullName],
            ["Surname", personal.surname || detail.surname],
            ["ID / Passport", personal.idNumber || detail.idNumber],
            ["Date of birth", personal.dateOfBirth || detail.dateOfBirth],
            ["Gender", personal.gender || detail.gender],
            ["Home language", personal.homeLanguage],
            ["Profile completion", detail.profileCompletionLabel || (detail.profileCompletionPercent ? `${detail.profileCompletionPercent}% complete` : "Not started")],
            ["Saved form details", detail.hasFormDetails ? "Yes" : "Not yet"],
            ["Account status", detail.accountStatus],
            ["Last login", detail.lastLogin ? formatDate(detail.lastLogin) : "Not available"]
          ])}
        </section>
        <section class="profile-section">
          <h4>Contact Details</h4>
          ${renderDetailList([
            ["Email", contact.email || detail.email],
            ["Phone", contact.phone || detail.phone],
            ["Province", contact.province || detail.province],
            ["Address", contact.address || detail.address],
            ["Assigned assistant", detail.assignedAssistantName || "Unassigned"]
          ])}
        </section>
        <section class="profile-section">
          <h4>Parent / Guardian Info</h4>
          ${renderDetailList([
            ["Relation", firstFilled(guardian.relation, guardian.guardian_relation)],
            ["Full names", firstFilled(guardian.full_names, guardian.full_name, guardian.fullName)],
            ["Surname", guardian.surname],
            ["Phone 1", firstFilled(guardian.phone_1, guardian.phone)],
            ["Phone 2", firstFilled(guardian.phone_2, guardian.alt_phone)],
            ["Email", guardian.email],
            ["Address", guardian.address]
          ])}
        </section>
        <section class="profile-section">
          <h4>School Info</h4>
          ${renderDetailList([
            ["School name", firstFilled(school.school_name, school.name)],
            ["Province", firstFilled(school.school_province, school.province)],
            ["Grade", firstFilled(school.grade, school.current_grade, detail.grade)],
            ["School type", firstFilled(school.school_type, school.type)],
            ["Completion year", firstFilled(school.completion_year, school.year_completed)],
            ["Average", school.average]
          ])}
        </section>
        <section class="profile-section full">
          <h4>Selected Institutions & Courses</h4>
          ${renderSimpleList(institutions, (item) => `
            <div class="profile-list-item">
              <strong>${esc(firstFilled(item.institution_name, item.institutionName, "Institution"))}</strong>
              <div class="queue-muted">${esc(firstFilled(item.faculty, "No faculty"))}</div>
              <div>${esc([item.choice_1, item.choice_2, item.choice_3].filter(Boolean).join(" · ") || "No courses selected")}</div>
            </div>
          `, "No institution selected")}
          ${courses.length ? `<div class="queue-muted" style="margin-top:10px">Courses: ${esc(courses.join(", "))}</div>` : ""}
        </section>
        <section class="profile-section full">
          <h4>Subjects & Results</h4>
          ${renderSimpleList(asArray(detail.subjectsResults), (item) => `
            <div class="profile-list-item"><strong>${esc(item.subject || "Subject")}</strong> · ${esc(item.percent ?? "No mark")}% · Level ${esc(item.level ?? "-")}</div>
          `, "Pending")}
        </section>
        <section class="profile-section full">
          <h4>Applications</h4>
          ${renderSimpleList(applications, (app) => `
            <div class="profile-list-item">
              <strong>${esc(firstFilled(app.id, "Application"))}</strong>
              <div class="queue-muted">${esc(firstFilled(app.status, "Not completed yet"))} · ${esc(formatDate(app.submitted_at || app.created_at || app.createdAt))}</div>
              <div>Package: ${esc(firstFilled(app.package_name, app.package_id, "Not completed yet"))}</div>
              <div>Payment status: ${esc(firstFilled(app.payment_status, "Not completed yet"))}</div>
            </div>
          `, "Not completed yet")}
        </section>
        <section class="profile-section full">
          <h4>Uploaded Documents</h4>
          ${renderSimpleList(docs, (doc) => `
            <div class="profile-list-item" style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">
              <div>
                <strong>${esc(firstFilled(doc.file_name, doc.fileName, doc.document_type, "Document"))}</strong>
                <div class="queue-muted">${esc(firstFilled(doc.document_type, doc.documentType, "Document"))} · ${esc(firstFilled(doc.status, "Pending Review"))} · ${esc(formatDate(doc.created_at || doc.createdAt))}</div>
              </div>
              ${documentLink(doc)}
            </div>
          `, "Not completed yet")}
        </section>
        <section class="profile-section">
          <h4>Accommodation Requests</h4>
          ${renderSimpleList(accommodation, renderAccommodationItem, "Not completed yet")}
        </section>
        <section class="profile-section">
          <h4>Transport Requests</h4>
          ${renderSimpleList(transport, renderTransportItem, "Not completed yet")}
        </section>
        <section class="profile-section full">
          <h4>Payment Records</h4>
          ${renderSimpleList(payments, (payment) => `
            <div class="profile-list-item"><strong>${esc(firstFilled(payment.reference, "Payment"))}</strong> · R${esc(payment.amount || 0)} · ${esc(firstFilled(payment.status, "Pending"))} · ${esc(formatDate(payment.created_at || payment.createdAt))}</div>
          `, "Not completed yet")}
        </section>
        <section class="profile-section full">
          <h4>Cart / Package Items</h4>
          ${renderSimpleList(cartItems, (item) => `
            <div class="profile-list-item">
              <strong>${esc(firstFilled(item.name, "Cart item"))}</strong>
              <div class="queue-muted">${esc(firstFilled(item.item_type, "custom"))} · Qty ${esc(item.quantity || 1)}</div>
              <div>R${esc(item.price || 0)}</div>
            </div>
          `, "Not completed yet")}
        </section>
        <section class="profile-section">
          <h4>Admin Notes</h4>
          ${renderSimpleList(notes, (note) => `<div class="profile-list-item">${esc(note.note || "")}<div class="queue-muted">${esc(note.author_role || "admin")} · ${esc(formatDate(note.created_at || note.createdAt))}</div></div>`, "Not completed yet")}
        </section>
        <section class="profile-section">
          <h4>Activity Timeline</h4>
          ${renderSimpleList(timeline, (item) => `<div class="profile-list-item"><strong>${esc(item.action || "Activity")}</strong><div class="queue-muted">${esc(firstFilled(item.status, item.type))} · ${esc(formatDate(item.timestamp || item.created_at || item.createdAt))}</div></div>`, "Not completed yet")}
        </section>
      </div>
    `;
  }

  function openModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function findUserByAnyRef(ref) {
    const value = String(ref || "").trim().toLowerCase();
    if (!value) return null;
    return state.users.find((user) => [
      user?.id,
      user?.supabaseUserId,
      user?.email
    ].some((item) => String(item || "").trim().toLowerCase() === value)) || null;
  }

  async function openProfile(userId) {
    const fallback = findUserByAnyRef(userId) || {};
    const lookupId = firstFilled(fallback?.supabaseUserId, fallback?.id, userId);
    $("adminUserProfileTitle").textContent = fallback.fullName || "User profile";
    $("adminUserProfileSub").textContent = "Loading full database profile...";
    $("adminUserProfileBody").innerHTML = `<div class="empty-state">Loading full user details...</div>`;
    openModal("adminUserProfileModal");

    try {
      const cached = state.profileCache.get(lookupId);
      const detail = cached || (state.api.getAdminUserDetailAsync
        ? await state.api.getAdminUserDetailAsync(lookupId)
        : fallback);
      if (detail && !cached) state.profileCache.set(lookupId, detail);
      renderProfile(detail || fallback);
    } catch (error) {
      if (fallback?.id || fallback?.email) {
        renderProfile(fallback);
        return;
      }
      $("adminUserProfileBody").innerHTML = `<div class="status-message err">${esc(error?.message || "Could not load this user profile.")}</div>`;
    }
  }

  function openAssign(userId) {
    const user = findUserByAnyRef(userId);
    if (!user) return;
    state.selectedForAssign = user;
    $("adminAssignSub").textContent = `Assign ${user.fullName || user.email || "this learner"} to an Assistant Admin.`;
    $("adminAssignSelect").innerHTML = state.assistants.length
      ? state.assistants.map((assistant) => `<option value="${esc(assistant.supabaseUserId || assistant.id || "")}">${esc(assistant.fullName || assistant.email || "Assistant Admin")}</option>`).join("")
      : `<option value="">No assistant admins found</option>`;
    $("adminAssignMessage").className = "status-message info";
    $("adminAssignMessage").textContent = "Assignment updates the database and the assistant dashboard.";
    openModal("adminAssignModal");
  }

  async function saveAssignment() {
    const user = state.selectedForAssign;
    const assistantId = $("adminAssignSelect").value;
    if (!user || !assistantId) {
      $("adminAssignMessage").className = "status-message err";
      $("adminAssignMessage").textContent = "Choose an Assistant Admin first.";
      return;
    }

    $("adminAssignSave").disabled = true;
    $("adminAssignMessage").className = "status-message info";
    $("adminAssignMessage").textContent = "Saving assignment...";
    try {
      if (state.api.assignUserToAssistantAsync) {
        try {
          await state.api.assignUserToAssistantAsync(user.supabaseUserId || user.id, assistantId, { applicationId: user.latestApplicationId });
        } catch (error) {
          if (!user.latestApplicationId || !state.api.assignAssistantAsync) throw error;
          await state.api.assignAssistantAsync(user.latestApplicationId, assistantId);
        }
      } else if (user.latestApplicationId && state.api.assignAssistantAsync) {
        await state.api.assignAssistantAsync(user.latestApplicationId, assistantId);
      } else {
        throw new Error("Assignment API is not available yet.");
      }
      $("adminAssignMessage").className = "status-message ok";
      $("adminAssignMessage").textContent = "Assignment saved.";
      await refresh();
      window.setTimeout(() => closeModal("adminAssignModal"), 450);
    } catch (error) {
      $("adminAssignMessage").className = "status-message err";
      $("adminAssignMessage").textContent = error?.message || "Could not save assignment.";
    } finally {
      $("adminAssignSave").disabled = false;
    }
  }

  function setIdentityUI(user) {
    const name = user?.fullName || user?.full_name || user?.email || "Master Admin";
    const initials = initialsFor(name, "MA");
    ["adminUsersSidebarName", "adminUsersTopName"].forEach((id) => {
      if ($(id)) $(id).textContent = name;
    });
    ["adminUsersSidebarAvatar", "adminUsersTopAvatar"].forEach((id) => {
      if ($(id)) $(id).textContent = initials;
    });
  }

  async function refresh() {
    state.loading = true;
    state.error = "";
    renderRows();
    try {
      const [users, summary] = await Promise.all([
        state.api.getAdminUserDirectoryAsync
          ? state.api.getAdminUserDirectoryAsync().catch(() => state.api.getAllUsersAsync())
          : state.api.getAllUsersAsync(),
        state.api.getAdminSummaryAsync ? state.api.getAdminSummaryAsync().catch(() => null) : Promise.resolve(null)
      ]);
      let assistants = asArray(users).filter((user) => normalizeRole(user.role) === "assistant_admin");
      if (!assistants.length && state.api.getUsersByRoleAsync) {
        assistants = await state.api.getUsersByRoleAsync("assistant_admin").catch(() => []);
      }
      state.users = asArray(users);
      state.summary = summary || null;
      state.profileCache.clear();
      state.assistants = uniqueUsersByIdOrEmail(
        assistants,
        state.users.filter((user) => normalizeRole(user.role) === "assistant_admin")
      );
      state.page = 1;
      renderOptions();
      renderStats();
    } catch (error) {
      state.error = error?.message || "Could not load users from the database.";
    } finally {
      state.loading = false;
      renderRows();
    }
  }

  async function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const userId = firstFilled(params.get("userId"), params.get("user"));
    const assignUserId = firstFilled(params.get("assignUserId"), params.get("assign"));
    if (userId) await openProfile(userId);
    if (assignUserId) openAssign(assignUserId);
  }

  function bindEvents() {
    let filterTimer = 0;
    ["adminUsersSearch", "adminUsersStatusFilter", "adminUsersRoleFilter", "adminUsersProvinceFilter", "adminUsersAssistantFilter"].forEach((id) => {
      const resetAndRender = () => {
        if (filterTimer) window.clearTimeout(filterTimer);
        filterTimer = window.setTimeout(() => {
          filterTimer = 0;
          state.page = 1;
          renderRows();
        }, 120);
      };
      const resetAndRenderImmediately = () => {
        state.page = 1;
        renderRows();
      };
      $(id)?.addEventListener("input", resetAndRender);
      $(id)?.addEventListener("change", resetAndRenderImmediately);
    });
    $("adminUsersRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const userId = button.dataset.userId;
      if (button.dataset.action === "view") openProfile(userId);
      if (button.dataset.action === "assign") openAssign(userId);
    });
    $("adminUsersPagination")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button) return;
      state.page = Number(button.dataset.page || 1);
      renderRows();
    });
    $("adminAssignSave")?.addEventListener("click", saveAssignment);
    $("adminUsersRefreshBtn")?.addEventListener("click", refresh);
    $("adminUsersReloadBtn")?.addEventListener("click", refresh);
    $("adminUsersSignOut")?.addEventListener("click", () => state.api.logoutReal?.() || state.api.logout?.());
    document.querySelectorAll("[data-close-profile]").forEach((button) => button.addEventListener("click", () => closeModal("adminUserProfileModal")));
    document.querySelectorAll("[data-close-assign]").forEach((button) => button.addEventListener("click", () => closeModal("adminAssignModal")));
    $("adminUsersMenuToggle")?.addEventListener("click", () => {
      $("adminUsersSidebar")?.classList.add("open");
      $("adminUsersOverlay")?.classList.add("open");
    });
    $("adminUsersOverlay")?.addEventListener("click", () => {
      $("adminUsersSidebar")?.classList.remove("open");
      $("adminUsersOverlay")?.classList.remove("open");
    });
  }

  function roleRedirect(user) {
    const role = normalizeRole(user?.role);
    if (role === "master_admin") return false;
    if (role === "assistant_admin") {
      window.location.replace("../../assistant/dashboard.html");
      return true;
    }
    window.location.replace("../../login.html");
    return true;
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
    bindEvents();
    await refresh();
    await handleDeepLink();
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => {
      console.error("Admin users page failed:", error);
      $("adminUsersRows").innerHTML = `<div class="status-message err">${esc(error?.message || "Could not load the admin users page.")}</div>`;
      $("adminUsersMeta").textContent = "Admin users page failed to load.";
    });
  });
})();
