(function () {
  window.KagieMasterDashboardPageLoaded = true;

  const PAGE_SIZE = 5;
  const FILTER_ORDER = ["all", "pending", "assigned", "in_progress", "completed"];

  const $ = (id) => document.getElementById(id);
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function asTextList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    return String(value || "")
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const state = {
    api: null,
    user: null,
    applications: [],
    users: [],
    assistants: [],
    notices: [],
    summary: null,
    selectedApplicationId: "",
    filter: "all",
    page: 1,
    docsCache: new Map(),
    detailCache: new Map(),
    pendingDetailKey: ""
  };

  function normalizeRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (["master_admin", "master admin", "master-admin", "masteradmin", "owner", "super_admin"].includes(value)) return "master_admin";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "staff", "administrator", "support"].includes(value)) return "assistant_admin";
    return value || "user";
  }

  function initialsFor(value, fallback) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return fallback;
    return words.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  }

  function formatDate(value, options) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";
    return date.toLocaleDateString("en-ZA", options || { day: "numeric", month: "short", year: "numeric" });
  }

  function formatRelativeTime(value) {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    const diffMs = Date.now() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))} min ago`;
    if (diffMs < day) return `${Math.max(1, Math.round(diffMs / hour))} hour${Math.round(diffMs / hour) === 1 ? "" : "s"} ago`;
    return `${Math.max(1, Math.round(diffMs / day))} day${Math.round(diffMs / day) === 1 ? "" : "s"} ago`;
  }

  function shortApplicationId(app) {
    const candidate = firstFilled(app?.applicationNumber, app?.applicationId, app?.referenceNumber, app?.code, app?.id);
    if (!candidate) return "APP-UNSET";
    if (/^APP-/i.test(candidate)) return candidate;
    return `APP-${String(candidate).replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "UNSET"}`;
  }

  function normalizeCategory(status) {
    const value = String(status || "").trim().toLowerCase();
    if (!value) return "pending";
    if (value.includes("accept") || value.includes("reject")) return "completed";
    if (value.includes("applied") || value.includes("feedback") || value.includes("process") || value.includes("ready")) return "in_progress";
    if (value.includes("review") || value.includes("missing") || value.includes("submitted") || value.includes("draft") || value.includes("pending")) return "pending";
    return "in_progress";
  }

  function progressForStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (!value) return 18;
    if (value.includes("submitted")) return 20;
    if (value.includes("missing")) return 30;
    if (value.includes("review")) return 45;
    if (value.includes("ready")) return 65;
    if (value.includes("process")) return 78;
    if (value.includes("applied")) return 88;
    if (value.includes("feedback")) return 92;
    if (value.includes("accept") || value.includes("reject")) return 100;
    return 54;
  }

  function assignmentLabel(app, category) {
    if (category === "completed") return { key: "completed", text: "Completed" };
    if (category === "in_progress") return { key: "in-progress", text: "In Progress" };
    if (app?.assignedAssistantId) return { key: "assigned", text: "Assigned" };
    return { key: "pending", text: "Pending" };
  }

  function userMatches(user, ref) {
    const value = String(ref || "").trim().toLowerCase();
    if (!value) return false;
    return [user?.id, user?.supabaseUserId, user?.email].some((item) => String(item || "").trim().toLowerCase() === value);
  }

  function userIdentityKeys(user) {
    return [user?.id, user?.supabaseUserId, user?.email]
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  function mergeUniqueUsers(...lists) {
    const merged = [];
    lists.flat().filter(Boolean).forEach((user) => {
      const candidate = { ...user };
      const keys = userIdentityKeys(candidate);
      const index = merged.findIndex((entry) => userIdentityKeys(entry).some((key) => keys.includes(key)));
      if (index === -1) {
        merged.push(candidate);
        return;
      }
      const current = merged[index];
      merged[index] = {
        ...current,
        ...candidate,
        id: firstFilled(current?.id, candidate?.id, current?.supabaseUserId, candidate?.supabaseUserId),
        supabaseUserId: firstFilled(candidate?.supabaseUserId, current?.supabaseUserId),
        fullName: firstFilled(candidate?.fullName, candidate?.name, current?.fullName, current?.name, candidate?.email, current?.email),
        email: firstFilled(candidate?.email, current?.email),
        phone: firstFilled(candidate?.phone, candidate?.cellphone, current?.phone, current?.cellphone),
        surname: firstFilled(candidate?.surname, current?.surname),
        idNumber: firstFilled(candidate?.idNumber, candidate?.identityNumber, current?.idNumber, current?.identityNumber),
        dateOfBirth: firstFilled(candidate?.dateOfBirth, candidate?.dob, current?.dateOfBirth, current?.dob),
        province: firstFilled(candidate?.province, current?.province),
        location: firstFilled(candidate?.location, current?.location),
        schoolName: firstFilled(candidate?.schoolName, candidate?.school_name, current?.schoolName, current?.school_name),
        grade: firstFilled(candidate?.grade, candidate?.completionYear, current?.grade, current?.completionYear),
        applicationStatus: firstFilled(candidate?.applicationStatus, current?.applicationStatus),
        accountStatus: firstFilled(candidate?.accountStatus, current?.accountStatus),
        selectedInstitution: firstFilled(candidate?.selectedInstitution, candidate?.selected_institution, current?.selectedInstitution, current?.selected_institution),
        selectedCourses: asArray(candidate?.selectedCourses).length ? candidate.selectedCourses : asArray(current?.selectedCourses),
        role: firstFilled(candidate?.role, current?.role)
      };
    });
    return merged;
  }

  function findUserByRef(ref) {
    return state.users.find((user) => userMatches(user, ref)) || null;
  }

  function findAssistantByRef(ref) {
    return state.assistants.find((assistant) => userMatches(assistant, ref)) || null;
  }

  function extractInstitutionNames(app) {
    const items = asArray(app?.items || app?.institutions);
    const names = [];
    items.forEach((item) => {
      const name = firstFilled(item?.institutionName, item?.name, item?.institution);
      if (name) names.push(name);
    });
    return [...new Set(names)];
  }

  function extractCourseNames(app) {
    const items = asArray(app?.items || app?.institutions);
    const names = [];
    items.forEach((item) => {
      [item?.choice1, item?.choice2, item?.choice3, item?.courseName, item?.name].forEach((entry) => {
        const value = String(entry || "").trim();
        if (value) names.push(value);
      });
    });
    return [...new Set(names)];
  }

  function buildLearnerUserFromApplication(app) {
    const learnerForm = app?.forms?.learner || {};
    const schoolForm = app?.forms?.school || {};
    const institutionNames = extractInstitutionNames(app);
    const courseNames = extractCourseNames(app);
    const rawUserId = String(app?.userId || "").trim();
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawUserId);

    return {
      id: rawUserId || firstFilled(learnerForm?.email),
      supabaseUserId: looksLikeUuid ? rawUserId : "",
      role: "user",
      fullName: firstFilled(learnerForm?.fullNames, learnerForm?.fullName, app?.applicant, "Learner"),
      surname: firstFilled(learnerForm?.surname),
      email: firstFilled(learnerForm?.email),
      phone: firstFilled(learnerForm?.cellphone, learnerForm?.phone),
      cellphone: firstFilled(learnerForm?.cellphone, learnerForm?.phone),
      idNumber: firstFilled(learnerForm?.idNumber),
      dateOfBirth: firstFilled(learnerForm?.dateOfBirth, learnerForm?.dob),
      province: firstFilled(learnerForm?.province, schoolForm?.schoolProvince),
      schoolName: firstFilled(schoolForm?.schoolName, schoolForm?.confirmName),
      grade: firstFilled(schoolForm?.grade, schoolForm?.currentGrade, schoolForm?.completionYear),
      latestApplicationId: firstFilled(app?.id),
      latestApplicationStatus: firstFilled(app?.status, "Draft"),
      selectedInstitution: institutionNames[0] || "",
      selectedCourses: courseNames,
      source: "application"
    };
  }

  function buildApplicationView(app) {
    const learnerForm = app?.forms?.learner || {};
    const schoolForm = app?.forms?.school || {};
    const profile = findUserByRef(app?.userId) || {};
    const category = normalizeCategory(app?.status);
    const institutionNames = [...new Set(
      extractInstitutionNames(app)
        .concat(asTextList(firstFilled(profile?.selectedInstitution, profile?.selected_institution)))
        .filter(Boolean)
    )];
    const courseNames = [...new Set(
      extractCourseNames(app)
        .concat(asTextList(firstFilled(profile?.selectedCourses, profile?.selected_courses)))
        .filter(Boolean)
    )];
    const assignedAssistant = findAssistantByRef(app?.assignedAssistantId || app?.assistantId);
    const statusInfo = assignmentLabel(app, category);
    const displayName = firstFilled(
      learnerForm?.fullNames,
      learnerForm?.fullName,
      profile?.fullName,
      profile?.name,
      "Learner"
    );
    const email = firstFilled(learnerForm?.email, profile?.email);
    const phone = firstFilled(learnerForm?.cellphone, learnerForm?.phone, profile?.phone, profile?.cellphone);
    const idNumber = firstFilled(learnerForm?.idNumber, profile?.idNumber);
    const surname = firstFilled(learnerForm?.surname, profile?.surname);
    const province = firstFilled(learnerForm?.province, profile?.province, profile?.location, schoolForm?.schoolProvince);
    const schoolName = firstFilled(schoolForm?.schoolName, schoolForm?.confirmName, profile?.schoolName);
    const grade = firstFilled(schoolForm?.grade, schoolForm?.currentGrade, schoolForm?.completionYear, profile?.grade, profile?.completionYear);
    return {
      raw: app,
      id: app?.id,
      userId: firstFilled(app?.userId, profile?.id),
      name: displayName,
      surname,
      email,
      phone,
      idNumber,
      dob: firstFilled(learnerForm?.dateOfBirth, learnerForm?.dob, profile?.dateOfBirth),
      province,
      schoolName,
      grade,
      applicationId: shortApplicationId(app),
      institution: institutionNames[0] || firstFilled(app?.institutionName, "No institution selected"),
      institutionNames,
      courseNames,
      status: firstFilled(app?.status, "Pending"),
      category,
      progress: progressForStatus(app?.status),
      statusKey: statusInfo.key,
      statusLabel: statusInfo.text,
      assignedAssistantId: firstFilled(app?.assignedAssistantId, app?.assistantId),
      assignedAssistantName: firstFilled(assignedAssistant?.fullName, assignedAssistant?.name),
      profileCompletionPercent: Number(profile?.profileCompletionPercent || 0),
      hasFormDetails: Boolean(profile?.hasFormDetails),
      createdAt: firstFilled(app?.submittedAt, app?.createdAt, app?.updatedAt),
      updatedAt: firstFilled(app?.updatedAt, app?.createdAt),
      searchBlob: [
        displayName,
        surname,
        email,
        phone,
        idNumber,
        province,
        schoolName,
        grade,
        institutionNames.join(" "),
        courseNames.join(" "),
        firstFilled(app?.status, ""),
        statusInfo.text,
        firstFilled(assignedAssistant?.fullName, ""),
        shortApplicationId(app)
      ].join(" ").toLowerCase(),
      source: "application"
    };
  }

  function userHasApplication(user) {
    const userKeys = new Set(userIdentityKeys(user));
    const userEmail = String(user?.email || "").trim().toLowerCase();
    const latestApplicationId = String(firstFilled(user?.latestApplicationId, user?.applicationId, user?.latest_application_id) || "").trim().toLowerCase();
    return state.applications.some((app) => {
      if (latestApplicationId && String(app?.id || "").trim().toLowerCase() === latestApplicationId) return true;
      const learnerForm = app?.forms?.learner || {};
      const appProfile = findUserByRef(app?.userId) || {};
      const appKeys = [
        app?.userId,
        appProfile?.id,
        appProfile?.supabaseUserId,
        appProfile?.email,
        learnerForm?.email
      ].map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
      return appKeys.some((key) => userKeys.has(key) || (userEmail && key === userEmail));
    });
  }

  function buildAccountOnlyLearnerView(user) {
    const profileUserId = firstFilled(user?.supabaseUserId, user?.id, user?.email);
    const displayName = firstFilled(
      user?.fullName,
      user?.name,
      [user?.fullNames, user?.surname].filter(Boolean).join(" "),
      user?.email,
      "Learner"
    );
    const email = firstFilled(user?.email);
    const phone = firstFilled(user?.phone, user?.cellphone);
    const createdAt = firstFilled(user?.createdAt, user?.created_at, user?.registeredAt, user?.updatedAt, user?.updated_at, user?.lastSignInAt);
    const statusLabel = firstFilled(user?.applicationStatus, user?.accountStatus, "Account Only");
    const institutionNames = asTextList(firstFilled(user?.selectedInstitution, user?.selected_institution));
    const courseNames = asTextList(firstFilled(user?.selectedCourses, user?.selected_courses));
    const safeId = String(profileUserId || displayName || "learner").replace(/[^a-z0-9_-]/gi, "_");
    return {
      raw: user,
      id: `account_${safeId}`,
      userId: profileUserId,
      profileUserId,
      name: displayName,
      surname: firstFilled(user?.surname),
      email,
      phone,
      idNumber: firstFilled(user?.idNumber, user?.identityNumber),
      dob: firstFilled(user?.dateOfBirth, user?.dob),
      province: firstFilled(user?.province, user?.location),
      schoolName: firstFilled(user?.schoolName, user?.school_name),
      grade: firstFilled(user?.grade, user?.completionYear),
      applicationId: "No application yet",
      institution: institutionNames[0] || "No institution selected",
      institutionNames,
      courseNames,
      status: statusLabel,
      category: "pending",
      progress: 8,
      statusKey: "pending",
      statusLabel: /^account/i.test(statusLabel) ? statusLabel : "Account Only",
      assignedAssistantId: firstFilled(user?.assignedAssistantId),
      assignedAssistantName: firstFilled(user?.assignedAssistantName),
      profileCompletionPercent: Number(user?.profileCompletionPercent || 0),
      hasFormDetails: Boolean(user?.hasFormDetails),
      createdAt,
      updatedAt: firstFilled(user?.updatedAt, user?.updated_at, createdAt),
      source: "account",
      searchBlob: [
        displayName,
        email,
        phone,
        firstFilled(user?.idNumber, user?.identityNumber),
        firstFilled(user?.surname),
        firstFilled(user?.schoolName, user?.school_name),
        firstFilled(user?.grade, user?.completionYear),
        user?.province,
        user?.location,
        institutionNames.join(" "),
        courseNames.join(" "),
        statusLabel,
        "account only no application"
      ].join(" ").toLowerCase()
    };
  }

  function getAccountOnlyLearnerViews() {
    return state.users
      .filter((user) => normalizeRole(user?.role) === "user")
      .filter((user) => !userHasApplication(user))
      .map(buildAccountOnlyLearnerView);
  }

  function getQueueItems() {
    return state.applications
      .map(buildApplicationView)
      .concat(getAccountOnlyLearnerViews())
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
  }

  function getQueueItemById(itemId) {
    return getQueueItems().find((item) => String(item.id) === String(itemId)) || null;
  }

  function getVisibleApplications() {
    const search = String($("masterSearchInput")?.value || "").trim().toLowerCase();
    return getQueueItems()
      .filter((app) => {
        if (state.filter === "all") return true;
        if (state.filter === "assigned") return Boolean(app.assignedAssistantId);
        return app.category === state.filter;
      })
      .filter((app) => (search ? app.searchBlob.includes(search) : true));
  }

  function getSelectedApplicationView() {
    return getQueueItemById(state.selectedApplicationId);
  }

  function getNotificationTone(type) {
    const value = String(type || "").trim().toLowerCase();
    if (value.includes("success")) return "completed";
    if (value.includes("warning") || value.includes("error")) return "pending";
    return "in-progress";
  }

  async function attachDocumentLinks(api, docs) {
    const client = api?.initSupabaseClient ? api.initSupabaseClient() : null;
    return Promise.all(asArray(docs).map(async (doc) => {
      const direct = String(doc?.fileUrl || doc?.dataUrl || "").trim();
      if (!direct || /^(https?:|data:|blob:)/i.test(direct) || !client) return { ...doc, openUrl: direct };
      try {
        const signed = await client.storage.from("kagie-documents").createSignedUrl(direct, 60 * 60 * 6);
        return { ...doc, openUrl: signed?.data?.signedUrl || "" };
      } catch (_error) {
        return { ...doc, openUrl: "" };
      }
    }));
  }

  function renderEmptyState(message) {
    return `<div class="empty-state">${esc(message)}</div>`;
  }

  function buildStatCard(config) {
    return `
      <article class="stat-card">
        <div class="stat-icon ${esc(config.tone)}">
          ${config.icon}
        </div>
        <div>
          <div class="stat-label">${esc(config.label)}</div>
          <div class="stat-value">${esc(config.value)}</div>
          <div class="stat-note">${esc(config.note)}</div>
        </div>
      </article>
    `;
  }

  function renderStats() {
    const apps = state.applications.map(buildApplicationView);
    const pending = apps.filter((app) => app.category === "pending").length;
    const assigned = apps.filter((app) => Boolean(app.assignedAssistantId)).length;
    const completed = apps.filter((app) => app.category === "completed").length;
    const total = apps.length;

    $("masterStats").innerHTML = [
      buildStatCard({
        tone: "blue",
        label: "Total Applications",
        value: total,
        note: `${state.summary?.totals?.users || state.users.filter((user) => normalizeRole(user?.role) === "user").length} learners on the platform`,
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      }),
      buildStatCard({
        tone: "amber",
        label: "Pending Review",
        value: pending,
        note: "Applications still waiting on review actions",
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      }),
      buildStatCard({
        tone: "red",
        label: "Assigned",
        value: assigned,
        note: `${state.assistants.length} assistant admin${state.assistants.length === 1 ? "" : "s"} available`,
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      }),
      buildStatCard({
        tone: "green",
        label: "Completed",
        value: completed,
        note: "Applications with a final outcome",
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      })
    ].join("");
  }

  function renderDataCounts() {
    const container = $("masterDataCounts");
    if (!container) return;
    const learnerRows = state.users.filter((user) => normalizeRole(user?.role) === "user");
    const completedProfiles = learnerRows.filter((user) => Number(user?.profileCompletionPercent || 0) >= 80).length;
    const submittedForms = learnerRows.filter((user) => Boolean(user?.hasFormDetails) || Number(user?.profileCompletionPercent || 0) > 0).length;
    const items = [
      ["Total users loaded", state.summary?.totals?.users || learnerRows.length],
      ["Users with completed profiles", completedProfiles],
      ["Users with submitted forms", submittedForms],
      ["Applications loaded", state.summary?.totals?.applications || state.applications.length],
      ["Assistant admins loaded", state.summary?.totals?.assistants || state.assistants.length]
    ];

    container.innerHTML = items.map(([label, value]) => `
      <article class="assistant-item">
        <div class="queue-avatar master">${esc(String(label).split(" ").map((word) => word.charAt(0)).slice(0, 2).join(""))}</div>
        <div class="item-copy">
          <div class="item-title">${esc(label)}</div>
          <div class="item-subtitle">Real Kagie dashboard count</div>
        </div>
        <span class="assistant-load">${esc(String(value || 0))}</span>
      </article>
    `).join("");
  }

  function renderQueue() {
    const allItems = getVisibleApplications();
    const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = allItems.slice(start, start + PAGE_SIZE);

    $("masterApplications").innerHTML = pageItems.length ? pageItems.map((app) => `
      <div class="queue-row ${app.id === state.selectedApplicationId ? "active" : ""}" data-app-id="${esc(app.id)}">
        <div class="queue-cell" data-label="Learner">
          <div class="queue-user">
            <div class="queue-avatar master">${esc(initialsFor(app.name, "KA"))}</div>
            <div>
              <div class="queue-user-name">${esc(app.name)}</div>
              <div class="queue-user-meta">${esc(app.applicationId)}</div>
            </div>
          </div>
        </div>
        <div class="queue-cell" data-label="Email">
          <div class="queue-user-name">${esc(app.email || "Email pending")}</div>
          <div class="queue-user-meta">${esc(app.phone || "Phone pending")}</div>
        </div>
        <div class="queue-cell" data-label="Institution">
          <div class="queue-user-name">${esc(app.institution)}</div>
        </div>
        <div class="queue-cell" data-label="Courses">
          <div class="queue-user-name">${esc(`${app.courseNames.length || 0} course${app.courseNames.length === 1 ? "" : "s"}`)}</div>
        </div>
        <div class="queue-cell" data-label="Date Submitted">
          <div class="queue-user-name">${esc(formatDate(app.createdAt))}</div>
        </div>
        <div class="queue-cell" data-label="Status">
          <span class="status-pill ${esc(app.statusKey)}">${esc(app.statusLabel)}</span>
        </div>
        <div class="queue-cell" data-label="Action">
          ${app.source === "account"
            ? `<button class="table-action" type="button" data-view-user="${esc(app.profileUserId || app.userId)}">Open user</button>`
            : `<button class="table-action" type="button" data-view-app="${esc(app.id)}">View</button>`}
        </div>
      </div>
    `).join("") : renderEmptyState("No learner records match your current search or filter.");

    $("masterQueueMeta").textContent = allItems.length
      ? `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, allItems.length)} of ${allItems.length} learner record${allItems.length === 1 ? "" : "s"}`
      : "No learner records found.";

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = $("masterPagination");
    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }
    const buttons = [];
    const windowStart = Math.max(1, state.page - 2);
    const windowEnd = Math.min(totalPages, state.page + 2);
    buttons.push(`<button type="button" data-page="${Math.max(1, state.page - 1)}">Prev</button>`);
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

  function selectedDetailKeyFromView(app) {
    return firstFilled(app?.profileUserId, app?.userId, app?.raw?.userId);
  }

  function getCachedDetailForView(app) {
    const key = selectedDetailKeyFromView(app);
    if (!key) return null;
    return state.detailCache.get(key) || null;
  }

  async function ensureInspectorDetail(api, app) {
    const key = selectedDetailKeyFromView(app);
    if (!api?.getAdminUserDetailAsync || !key || state.detailCache.has(key) || state.pendingDetailKey === key) return;

    state.pendingDetailKey = key;
    try {
      const detail = await api.getAdminUserDetailAsync(key);
      if (detail) state.detailCache.set(key, detail);
    } catch (error) {
      state.detailCache.set(key, { __error: error?.message || "Could not load the live learner detail." });
    } finally {
      if (state.pendingDetailKey === key) state.pendingDetailKey = "";
      const selected = getSelectedApplicationView();
      if (selected && selectedDetailKeyFromView(selected) === key) renderInspector();
    }
  }

  function renderInspector() {
    const app = getSelectedApplicationView();
    const container = $("masterLearnerInspector");
    if (!app) {
      container.innerHTML = `<div class="inspector-empty">Select a learner from the queue to open their live Kagie profile.</div>`;
      return;
    }

    const detail = getCachedDetailForView(app);
    const detailError = detail?.__error || "";
    if (!detail && !detailError) {
      void ensureInspectorDetail(state.api, app);
    }

    const personal = detail?.personalInformation || {};
    const guardian = detail?.guardianInfo || {};
    const school = detail?.schoolInfo || {};
    const liveInstitutions = asArray(detail?.selectedInstitutions);
    const liveCourses = asArray(detail?.selectedCourses);
    const liveDocs = asArray(detail?.uploadedDocuments);
    const livePayments = asArray(detail?.paymentRecords);
    const institutionsMarkup = liveInstitutions.length
      ? `<ul class="detail-bullets">${liveInstitutions.map((institution) => `<li>${esc(firstFilled(institution?.institution_name, institution?.institutionName, "Institution"))}${firstFilled(institution?.faculty) ? ` - ${esc(institution.faculty)}` : ""}</li>`).join("")}</ul>`
      : (app.institutionNames.length
        ? `<ul class="detail-bullets">${app.institutionNames.map((institution) => `<li>${esc(institution)}</li>`).join("")}</ul>`
        : `<div class="detail-value">No institution selected.</div>`);
    const coursesMarkup = liveCourses.length
      ? `<ul class="detail-bullets">${liveCourses.map((course) => `<li>${esc(course)}</li>`).join("")}</ul>`
      : (app.courseNames.length
        ? `<ul class="detail-bullets">${app.courseNames.map((course) => `<li>${esc(course)}</li>`).join("")}</ul>`
        : `<div class="detail-value">No courses selected.</div>`);
    const completionLabel = firstFilled(
      detail?.profileCompletionLabel,
      app.profileCompletionPercent ? `${app.profileCompletionPercent}% complete` : ""
    ) || "Not started";
    const formsState = detail ? (detail.hasFormDetails ? "Saved" : "Pending") : (app.hasFormDetails ? "Saved" : "Pending");
    const documentsLabel = liveDocs.length ? `${liveDocs.length} uploaded` : "No documents uploaded";
    const paymentLabel = livePayments.length
      ? `${firstFilled(livePayments[0]?.status, "Pending")} ${firstFilled(livePayments[0]?.reference) ? `- ${livePayments[0].reference}` : ""}`.trim()
      : "Payment pending";
    const guardianLabel = firstFilled(guardian?.full_names, guardian?.full_name, guardian?.surname) || "Not provided";
    const guardianPhone = firstFilled(guardian?.phone_1, guardian?.phone, guardian?.phone_2) || "Not provided";
    const schoolType = firstFilled(school?.school_type, school?.type) || "Not provided";
    const detailStatusMarkup = detailError
      ? `<div class="status-message err" style="margin-bottom:12px">${esc(detailError)}</div>`
      : (!detail ? `<div class="queue-user-meta" style="margin-bottom:12px">Loading live learner form details...</div>` : "");

    container.innerHTML = `
      <section class="inspector-profile">
        <div class="inspector-profile-head">
          <div class="queue-avatar master">${esc(initialsFor(app.name, "KA"))}</div>
          <div class="inspector-profile-copy">
            <div class="inspector-name">${esc(app.name)}</div>
            <div class="inspector-id">${esc(app.applicationId)}</div>
            <div class="inspector-contact">
              <span>${esc(app.email || "No email saved")}</span>
              <span>${esc(app.phone || "No phone saved")}</span>
            </div>
          </div>
          <span class="status-pill ${esc(app.statusKey)}">${esc(app.statusLabel)}</span>
        </div>
      </section>

      ${detailStatusMarkup}

      <div class="detail-list">
        <div class="detail-item"><span class="detail-label">Surname</span><span class="detail-value">${esc(app.surname || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">Date of birth</span><span class="detail-value">${esc(firstFilled(personal?.dateOfBirth, app.dob, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">ID Number</span><span class="detail-value">${esc(firstFilled(personal?.idNumber, app.idNumber, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">School</span><span class="detail-value">${esc(firstFilled(school?.school_name, school?.name, app.schoolName, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Grade / completion year</span><span class="detail-value">${esc(firstFilled(school?.completion_year, app.grade, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Province</span><span class="detail-value">${esc(firstFilled(personal?.province, app.province, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Application status</span><span class="detail-value">${esc(app.status || "Pending")}</span></div>
        <div class="detail-item"><span class="detail-label">Submitted / created</span><span class="detail-value">${esc(formatDate(app.createdAt))}</span></div>
        <div class="detail-item"><span class="detail-label">Profile completion</span><span class="detail-value">${esc(completionLabel)}</span></div>
        <div class="detail-item"><span class="detail-label">Saved form details</span><span class="detail-value">${esc(formsState)}</span></div>
        <div class="detail-item"><span class="detail-label">Guardian</span><span class="detail-value">${esc(guardianLabel)}</span></div>
        <div class="detail-item"><span class="detail-label">Guardian phone</span><span class="detail-value">${esc(guardianPhone)}</span></div>
        <div class="detail-item"><span class="detail-label">School type</span><span class="detail-value">${esc(schoolType)}</span></div>
        <div class="detail-item"><span class="detail-label">Documents</span><span class="detail-value">${esc(documentsLabel)}</span></div>
        <div class="detail-item"><span class="detail-label">Payment</span><span class="detail-value">${esc(paymentLabel)}</span></div>
        <div class="detail-item"><span class="detail-label">Institution choices</span><div class="detail-value">${institutionsMarkup}</div></div>
        <div class="detail-item"><span class="detail-label">Assigned to</span><span class="detail-value">${esc(app.assignedAssistantName || "Not assigned")}</span></div>
        <div class="detail-item"><span class="detail-label">Courses</span><div class="detail-value">${coursesMarkup}</div></div>
        <div class="detail-item"><span class="detail-label">Application progress</span>
          <div class="detail-value" style="width:100%">
            <div class="progress-inline">
              <div class="progress-track">
                <div class="progress-fill ${app.statusKey === "completed" ? "completed" : app.statusKey === "pending" ? "pending" : ""}" style="width:${Math.max(6, Math.min(100, app.progress))}%"></div>
              </div>
              <span class="progress-value">${esc(`${app.progress}%`)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="action-stack">
        ${app.source === "account"
          ? `
            <button class="action-button primary" type="button" data-open-user-profile="${esc(app.profileUserId || app.userId)}">Manual apply details</button>
            <button class="action-button outline" type="button" disabled>Application not started</button>
            <button class="action-button danger" type="button" data-open-docs="${esc(app.id)}">View documents</button>
          `
          : `
            <button class="action-button primary" type="button" data-open-profile="${esc(app.id)}">View full profile</button>
            <button class="action-button outline" type="button" data-open-user-profile="${esc(app.userId)}">Manual apply details</button>
            <button class="action-button outline" type="button" data-open-assign="${esc(app.id)}">Assign to assistant</button>
            <button class="action-button danger" type="button" data-open-docs="${esc(app.id)}">View documents</button>
          `}
      </div>
    `;
  }

  function renderRecentLearners() {
    const items = getQueueItems()
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 4);

    $("masterRecentLearners").innerHTML = items.length ? items.map((app) => `
      <article class="recent-item">
        <div class="queue-avatar master">${esc(initialsFor(app.name, "KA"))}</div>
        <div class="item-copy">
          <div class="item-title">${esc(app.name)}</div>
          <div class="item-subtitle">${esc(app.email || app.institution)}</div>
        </div>
        <span class="status-pill ${esc(app.statusKey)}">${esc(app.statusLabel)}</span>
        <div class="item-meta">${esc(formatDate(app.createdAt))}</div>
      </article>
    `).join("") : renderEmptyState("Recent learner records will appear here once applications start coming in.");
  }

  function renderAssistantRoster() {
    const appViews = state.applications.map(buildApplicationView);
    const items = state.assistants.slice().sort((left, right) =>
      firstFilled(left?.fullName, left?.name, left?.email).localeCompare(firstFilled(right?.fullName, right?.name, right?.email), "en-ZA")
    );

    $("masterAssistantRoster").innerHTML = items.length ? items.map((assistant) => {
      const assignmentCount = appViews.filter((app) => userMatches(assistant, app.assignedAssistantId)).length;
      return `
        <article class="assistant-item">
          <div class="queue-avatar assistant">${esc(initialsFor(firstFilled(assistant?.fullName, assistant?.name, "Assistant"), "AA"))}</div>
          <div class="item-copy">
            <div class="item-title">${esc(firstFilled(assistant?.fullName, assistant?.name, "Assistant Admin"))}</div>
            <div class="item-subtitle">${esc(firstFilled(assistant?.email, "No email saved"))}</div>
          </div>
          <span class="assistant-load">${esc(String(assignmentCount))}</span>
          <span class="status-pill assigned">${esc(assignmentCount ? "Assigned" : "Available")}</span>
        </article>
      `;
    }).join("") : renderEmptyState("No assistant admins have been created yet.");

    $("masterAssignSelect").innerHTML = items.length
      ? items.map((assistant) => `<option value="${esc(assistant.id)}">${esc(firstFilled(assistant.fullName, assistant.name, assistant.email))}</option>`).join("")
      : '<option value="">No assistants available</option>';
  }

  function renderNotices() {
    const unread = state.notices.filter((item) => !item?.read).length;
    $("masterNoticeCount").textContent = String(unread);
    $("masterMessagesCount").textContent = String(unread);
    $("masterNoticesList").innerHTML = state.notices.length ? state.notices.slice(0, 12).map((notice) => `
      <article class="notice-item ${notice?.read ? "" : "unread"}">
        <div class="activity-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="item-copy">
          <div class="item-title">${esc(notice?.title || "Kagie update")}</div>
          <div class="item-subtitle">${esc(notice?.message || "No message available.")}</div>
        </div>
        <div class="item-meta">${esc(formatRelativeTime(notice?.createdAt))}</div>
      </article>
    `).join("") : renderEmptyState("No notices are waiting for this master admin account.");
  }

  function syncSelectedApplication() {
    const items = getQueueItems();
    if (!items.length) {
      state.selectedApplicationId = "";
      return;
    }
    if (!items.some((app) => app.id === state.selectedApplicationId)) {
      state.selectedApplicationId = items[0].id;
    }
  }

  function updateHero() {
    const totals = state.summary?.totals || {};
    const accountOnlyCount = getAccountOnlyLearnerViews().length;
    $("masterHeroTitle").textContent = "Dashboard Overview";
    $("masterHeroText").textContent = `${totals.users || state.users.filter((user) => normalizeRole(user?.role) === "user").length} learners, ${totals.assistants || state.assistants.length} assistants, ${state.applications.length} live applications, and ${accountOnlyCount} account-only learner${accountOnlyCount === 1 ? "" : "s"} on Kagie right now.`;
  }

  function updateFilterButton() {
    const button = $("masterFilterButton");
    const labelMap = {
      all: "All",
      pending: "Pending Review",
      assigned: "Assigned",
      in_progress: "In Progress",
      completed: "Completed"
    };
    button.querySelector("span").textContent = `Filter: ${labelMap[state.filter] || "All"}`;
  }

  function renderAll() {
    syncSelectedApplication();
    renderStats();
    renderDataCounts();
    renderQueue();
    renderInspector();
    renderRecentLearners();
    renderAssistantRoster();
    renderNotices();
    updateHero();
    updateFilterButton();
  }

  function openModal(id) {
    const modal = $(id);
    if (modal) modal.classList.add("open");
  }

  function closeModal(id) {
    const modal = $(id);
    if (modal) modal.classList.remove("open");
  }

  function setAssignMessage(text, tone) {
    const node = $("masterAssignMsg");
    node.textContent = text || "";
    node.className = tone ? `status-message ${tone}` : "status-message";
  }

  function setCreateAssistantMessage(text, tone) {
    const node = $("masterCreateAssistantMsg");
    node.textContent = text || "";
    node.className = tone ? `status-message ${tone}` : "status-message";
  }

  async function openDocumentsModal(api, appId) {
    const app = state.applications.find((item) => item.id === appId);
    const view = app ? buildApplicationView(app) : getQueueItemById(appId);
    if (!view) return;
    const userId = firstFilled(app?.userId, view.userId, view.profileUserId);
    if (!userId) return;
    if (!state.docsCache.has(userId)) {
      const docs = await api.getDocumentsByUserAsync(userId).catch(() => []);
      state.docsCache.set(userId, await attachDocumentLinks(api, docs));
    }
    const docs = asArray(state.docsCache.get(userId));
    $("masterDocsList").innerHTML = docs.length ? docs.map((doc) => `
      <article class="notice-item">
        <div class="activity-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="item-copy">
          <div class="item-title">${esc(doc?.fileName || doc?.name || "Document")}</div>
          <div class="item-subtitle">${esc(firstFilled(doc?.status, "Pending Review"))}</div>
        </div>
        ${doc?.openUrl ? `<a class="table-action" href="${esc(doc.openUrl)}" target="_blank" rel="noopener">Open</a>` : ""}
      </article>
    `).join("") : renderEmptyState("No uploaded documents were found for this learner yet.");
    openModal("masterDocsModal");
  }

  function openAssignModal(appId) {
    const app = state.applications.find((item) => item.id === appId);
    if (!app) return;
    const current = buildApplicationView(app);
    $("masterAssignSelect").value = firstFilled(current.assignedAssistantId, $("masterAssignSelect").value);
    setAssignMessage("", "");
    openModal("masterAssignModal");
  }

  async function refreshDashboard(api) {
    const [applications, adminDirectoryUsers, notices, summary] = await Promise.all([
      api.getAllApplicationsForAdminAsync().catch(() => []),
      api.getAdminUserDirectoryAsync ? api.getAdminUserDirectoryAsync().catch(() => []) : api.getAllUsersAsync().catch(() => []),
      api.getNotificationsAsync(state.user.id).catch(() => []),
      api.getAdminSummaryAsync ? api.getAdminSummaryAsync().catch(() => null) : Promise.resolve(null)
    ]);

    const sortedApplications = asArray(applications).sort((left, right) => new Date(right?.updatedAt || right?.createdAt || 0) - new Date(left?.updatedAt || left?.createdAt || 0));
    const derivedLearners = sortedApplications.map(buildLearnerUserFromApplication);
    const fallbackUsers = asArray(adminDirectoryUsers).length ? [] : await api.getAllUsersAsync().catch(() => []);
    const mergedUsers = mergeUniqueUsers(asArray(adminDirectoryUsers), asArray(fallbackUsers), derivedLearners);
    let assistants = mergedUsers.filter((user) => normalizeRole(user?.role) === "assistant_admin");
    if (!assistants.length && api.getUsersByRoleAsync) {
      assistants = await api.getUsersByRoleAsync("assistant_admin").catch(() => []);
    }

    state.applications = sortedApplications;
    state.users = mergedUsers;
    state.assistants = mergeUniqueUsers(
      asArray(assistants),
      mergedUsers.filter((user) => normalizeRole(user?.role) === "assistant_admin")
    );
    state.notices = asArray(notices).sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0));
    state.summary = summary || null;
    state.detailCache.clear();
    state.pendingDetailKey = "";
    renderAll();
  }

  function setRoleSafeRedirect(user) {
    const role = normalizeRole(user?.role);
    if (role === "assistant_admin") {
      window.location.href = "../assistant/dashboard.html";
      return true;
    }
    if (role !== "master_admin") {
      window.location.href = "../login.html";
      return true;
    }
    return false;
  }

  function setIdentityUI(user) {
    const displayName = firstFilled(user?.fullName, user?.name, "Master Admin");
    const avatar = initialsFor(displayName, "MA");
    $("masterSidebarAvatar").textContent = avatar;
    $("masterTopAvatar").textContent = avatar;
    $("masterSidebarName").textContent = displayName;
    $("masterTopName").textContent = displayName;
    $("masterSidebarRole").textContent = "Platform Owner";
    $("masterTopRole").textContent = "Platform Owner";
  }

  function bindStaticEvents(api) {
    document.querySelectorAll("[data-scroll-target]").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.preventDefault();
        const target = $(node.getAttribute("data-scroll-target"));
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        document.body.classList.remove("sidebar-open");
        $("masterOverlay").classList.remove("open");
      });
    });

    document.querySelectorAll("[data-filter-target]").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.preventDefault();
        state.filter = node.getAttribute("data-filter-target") || "all";
        state.page = 1;
        renderAll();
        $("masterQueueCard").scrollIntoView({ behavior: "smooth", block: "start" });
        document.body.classList.remove("sidebar-open");
        $("masterOverlay").classList.remove("open");
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach((node) => {
      node.addEventListener("click", () => closeModal(node.getAttribute("data-close-modal")));
    });

    ["masterNoticesModal", "masterAssignModal", "masterDocsModal", "masterCreateAssistantModal"].forEach((id) => {
      const modal = $(id);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(id);
      });
    });

    $("masterMenuToggle").addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
      $("masterOverlay").classList.toggle("open", document.body.classList.contains("sidebar-open"));
    });

    $("masterBottomMore").addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
      $("masterOverlay").classList.toggle("open", document.body.classList.contains("sidebar-open"));
    });

    $("masterOverlay").addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      $("masterOverlay").classList.remove("open");
    });

    let searchTimer = 0;
    $("masterSearchInput").addEventListener("input", () => {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        searchTimer = 0;
        state.page = 1;
        syncSelectedApplication();
        renderAll();
      }, 140);
    });

    $("masterFilterButton").addEventListener("click", () => {
      const currentIndex = FILTER_ORDER.indexOf(state.filter);
      state.filter = FILTER_ORDER[(currentIndex + 1) % FILTER_ORDER.length];
      state.page = 1;
      renderAll();
    });

    $("masterNoticeBtn").addEventListener("click", async () => {
      openModal("masterNoticesModal");
      if (state.notices.some((item) => !item?.read) && api.markAllNotificationsReadAsync) {
        await api.markAllNotificationsReadAsync(state.user.id).catch(() => {});
        state.notices = state.notices.map((item) => ({ ...item, read: true }));
        renderNotices();
      }
    });

    $("masterMessagesLink").addEventListener("click", () => $("masterNoticeBtn").click());
    $("masterBottomNotice").addEventListener("click", () => $("masterNoticeBtn").click());

    $("masterLogoutLink").addEventListener("click", async () => {
      await api.logout().catch(() => {});
      window.location.href = "../login.html";
    });

    $("masterApplications").addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view-app]");
      if (viewButton) {
        window.location.href = `application-view.html?id=${encodeURIComponent(viewButton.getAttribute("data-view-app"))}`;
        return;
      }
      const userButton = event.target.closest("[data-view-user]");
      if (userButton) {
        window.location.href = `../admin/users/index.html?userId=${encodeURIComponent(userButton.getAttribute("data-view-user"))}`;
        return;
      }
      const row = event.target.closest(".queue-row");
      if (!row) return;
      state.selectedApplicationId = row.getAttribute("data-app-id") || "";
      renderInspector();
      renderQueue();
    });

    $("masterPagination").addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button) return;
      state.page = Number(button.getAttribute("data-page") || 1);
      renderQueue();
    });

    $("masterLearnerInspector").addEventListener("click", async (event) => {
      const profileButton = event.target.closest("[data-open-profile]");
      if (profileButton) {
        window.location.href = `application-view.html?id=${encodeURIComponent(profileButton.getAttribute("data-open-profile"))}`;
        return;
      }
      const userProfileButton = event.target.closest("[data-open-user-profile]");
      if (userProfileButton) {
        window.location.href = `../admin/users/index.html?userId=${encodeURIComponent(userProfileButton.getAttribute("data-open-user-profile"))}`;
        return;
      }
      const assignButton = event.target.closest("[data-open-assign]");
      if (assignButton) {
        openAssignModal(assignButton.getAttribute("data-open-assign"));
        return;
      }
      const docsButton = event.target.closest("[data-open-docs]");
      if (docsButton) {
        await openDocumentsModal(api, docsButton.getAttribute("data-open-docs"));
      }
    });

    $("masterAssignForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const selected = state.applications.find((app) => app.id === state.selectedApplicationId);
      if (!selected) return;
      const assistantId = $("masterAssignSelect").value;
      if (!assistantId) {
        setAssignMessage("Create an assistant account first.", "err");
        return;
      }
      setAssignMessage("Saving assignment...", "info");
      try {
        await api.assignAssistantAsync(selected.id, assistantId);
        setAssignMessage("Assistant assignment saved.", "ok");
        await refreshDashboard(api);
        closeModal("masterAssignModal");
      } catch (error) {
        setAssignMessage(error?.message || "Could not save the assignment.", "err");
      }
    });

    $("masterCreateAssistantOpen").addEventListener("click", () => {
      $("masterAssistantName").value = "";
      $("masterAssistantEmail").value = "";
      $("masterAssistantPhone").value = "";
      $("masterAssistantPassword").value = "";
      setCreateAssistantMessage("", "");
      openModal("masterCreateAssistantModal");
    });

    $("masterCreateAssistantForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      setCreateAssistantMessage("Creating assistant account...", "info");
      try {
        await api.createAssistantAccount({
          fullName: $("masterAssistantName").value.trim(),
          email: $("masterAssistantEmail").value.trim(),
          phone: $("masterAssistantPhone").value.trim(),
          password: $("masterAssistantPassword").value
        });
        setCreateAssistantMessage("Assistant account created.", "ok");
        await refreshDashboard(api);
        closeModal("masterCreateAssistantModal");
      } catch (error) {
        setCreateAssistantMessage(error?.message || "Could not create the assistant account.", "err");
      }
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
    if (!activeUser || setRoleSafeRedirect(activeUser)) return;

    state.user = api.requireRole("master_admin");
    setIdentityUI(state.user);
    bindStaticEvents(api);
    await refreshDashboard(api);
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => {
      console.error("Master dashboard failed to load:", error);
      $("masterApplications").innerHTML = renderEmptyState("We could not load the master dashboard right now.");
      $("masterLearnerInspector").innerHTML = `<div class="inspector-empty">Dashboard data is unavailable right now.</div>`;
      $("masterRecentLearners").innerHTML = renderEmptyState("Recent learner data is unavailable.");
      $("masterAssistantRoster").innerHTML = renderEmptyState("Assistant roster data is unavailable.");
    });
  });
})();
