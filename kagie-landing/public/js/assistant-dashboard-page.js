(function () {
  window.KagieAssistantDashboardPageLoaded = true;

  const PAGE_SIZE = 5;
  const FILTER_ORDER = ["all", "pending", "in_progress", "completed"];

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
    user: null,
    applications: [],
    users: [],
    notices: [],
    activity: [],
    selectedApplicationId: "",
    filter: "all",
    page: 1,
    docsCache: new Map(),
    profileCache: new Map()
  };
  const UX = () => window.KagieUX || null;
  let bootScreen = null;

  function normalizeRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "staff", "administrator", "support"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "owner", "super_admin"].includes(value)) return "master_admin";
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

  function formatDateTime(value) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";
    return date.toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
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

  function greetingForNow() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  function shortApplicationId(app) {
    const candidate = firstFilled(app?.applicationNumber, app?.applicationId, app?.referenceNumber, app?.reference, app?.applicationEngine?.reference, app?.lateApplication?.reference, app?.code, app?.id);
    if (!candidate) return "APP-UNSET";
    if (/^APP-/i.test(candidate)) return candidate;
    return `APP-${String(candidate).replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "UNSET"}`;
  }

  function normalizeApplicationTypeKey(value) {
    const type = String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    if (!type) return "";
    if (["late", "late_application", "late_applications"].includes(type)) return "late";
    if (["bridging", "bridge", "bridging_programme", "bridging_programmes"].includes(type)) return "bridging";
    if (["postgraduate", "post_graduate", "post_graduate_application", "post_graduate_applications", "post_grad", "postgrad"].includes(type)) return "postgraduate";
    if (["undergraduate", "undergrad", "under_graduate", "undergraduate_application", "undergraduate_applications", "under_graduate_application", "under_graduate_applications"].includes(type)) return "undergraduate";
    if (type.includes("transfer")) return "transfer";
    return type;
  }
  function applicationTypeLabel(app) {
    const type = normalizeApplicationTypeKey(app?.applicationType || app?.forms?.applicationType?.type || app?.applicationTypeLabel || app?.forms?.applicationType?.label || app?.applicationEngine?.type || app?.lateApplication?.type) || "undergraduate";
    const labels = {
      undergraduate: "Undergraduate Applications",
      late: "Late Applications",
      postgraduate: "Postgraduate Applications",
      transfer: "Transfer Applications",
      bridging: "Bridging Programmes"
    };
    return labels[type] || firstFilled(app?.applicationTypeLabel, app?.forms?.applicationType?.label, "Undergraduate Applications");
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function asRecord(value) {
    return isPlainObject(value) ? value : {};
  }

  function hasVisibleValue(value) {
    if (Array.isArray(value)) return value.some(hasVisibleValue);
    if (isPlainObject(value)) return Object.values(value).some(hasVisibleValue);
    return value === false || value === 0 || Boolean(String(value ?? "").trim());
  }

  function mergeFilledRecords(...sources) {
    const output = {};
    sources.forEach((sourceArg) => {
      Object.entries(asRecord(sourceArg)).forEach(([key, value]) => {
        if (hasVisibleValue(value) || !Object.prototype.hasOwnProperty.call(output, key)) {
          output[key] = value;
        }
      });
    });
    return output;
  }

  function firstNonEmptyArray(...values) {
    return values.find((value) => Array.isArray(value) && value.length) || [];
  }

  function mergedApplicationForms(appArg) {
    const app = appArg || {};
    const payloadForms = asRecord(app.applicationPayload?.forms);
    const forms = asRecord(app.forms);
    const engineData = asRecord(app.applicationEngine?.formData);
    const lateData = asRecord(app.lateApplication?.data || app.lateApplication);
    const latePersonal = asRecord(lateData.personal || engineData.personal);
    const lateDetails = asRecord(lateData.details || engineData.details);
    const institutions = firstNonEmptyArray(
      asArray(forms.institutions),
      asArray(payloadForms.institutions),
      asArray(app.applicationPayload?.institutions),
      asArray(engineData.institutions),
      asArray(lateData.institutions),
      asArray(app.institutions),
      asArray(app.items)
    );
    return {
      ...payloadForms,
      ...forms,
      applicationType: mergeFilledRecords(payloadForms.applicationType, forms.applicationType),
      packageSelection: mergeFilledRecords(payloadForms.packageSelection, forms.packageSelection),
      dynamicApplications: {
        ...asRecord(payloadForms.dynamicApplications),
        ...asRecord(forms.dynamicApplications)
      },
      learner: mergeFilledRecords(
        payloadForms.learner,
        forms.learner,
        engineData.learner,
        latePersonal,
        { cellphone: latePersonal.phone || lateDetails.phone, address: latePersonal.address || lateDetails.address }
      ),
      parent: mergeFilledRecords(payloadForms.parent, forms.parent, engineData.parent),
      school: mergeFilledRecords(
        payloadForms.school,
        forms.school,
        engineData.school,
        {
          schoolName: latePersonal.schoolName || lateDetails.schoolName,
          schoolProvince: latePersonal.province || lateDetails.province,
          completionYear: latePersonal.examYear || lateDetails.examYear,
          educationLevel: latePersonal.educationLevel || lateDetails.educationLevel
        }
      ),
      current: mergeFilledRecords(payloadForms.current, forms.current, engineData),
      specialisedApplication: mergeFilledRecords(payloadForms.specialisedApplication, forms.specialisedApplication),
      institutions
    };
  }

  function extractLateApplicationData(app) {
    const engineData = app?.applicationEngine?.type === "late" ? app.applicationEngine.formData : null;
    return engineData || app?.forms?.dynamicApplications?.late || app?.lateApplication?.data || null;
  }

  function normalizeCategory(status) {
    const value = String(status || "").trim().toLowerCase();
    if (!value) return "pending";
    if (value.includes("accept") || value.includes("reject")) return "completed";
    if (value.includes("applied") || value.includes("feedback") || value.includes("process") || value.includes("ready")) return "in_progress";
    if (value.includes("review") || value.includes("missing") || value.includes("submitted") || value.includes("draft") || value.includes("pending")) return "pending";
    return "in_progress";
  }

  function categoryLabel(category) {
    if (category === "in_progress") return "In Progress";
    if (category === "completed") return "Completed";
    return "Pending Review";
  }

  function progressForStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (!value) return 20;
    if (value.includes("submitted")) return 20;
    if (value.includes("missing")) return 30;
    if (value.includes("review")) return 45;
    if (value.includes("ready")) return 65;
    if (value.includes("process")) return 78;
    if (value.includes("applied")) return 88;
    if (value.includes("feedback")) return 92;
    if (value.includes("accept")) return 100;
    if (value.includes("reject")) return 100;
    return 52;
  }

  function userMatches(user, ref) {
    const value = String(ref || "").trim().toLowerCase();
    if (!value) return false;
    return [user?.id, user?.supabaseUserId, user?.email].some((item) => String(item || "").trim().toLowerCase() === value);
  }

  function findUserByRef(ref) {
    return state.users.find((user) => userMatches(user, ref)) || null;
  }

  function extractInstitutionNames(app) {
    const items = asArray(app?.items || app?.institutions);
    const names = [];
    items.forEach((item) => {
      const name = firstFilled(item?.institutionName, item?.name, item?.institution);
      if (name) names.push(name);
    });
    [
      app?.institutionChoice1,
      app?.institutionChoice2,
      app?.forms?.current?.institution,
      app?.forms?.current?.institutionName,
      app?.forms?.current?.targetInstitution,
      app?.forms?.specialisedApplication?.values?.institution,
      app?.forms?.specialisedApplication?.values?.institutionName,
      app?.forms?.specialisedApplication?.values?.targetInstitution,
      app?.applicationEngine?.formData?.institution,
      app?.applicationEngine?.formData?.institutionName,
      app?.applicationEngine?.formData?.targetInstitution
    ].forEach((entry) => {
      const value = String(entry || "").trim();
      if (value) names.push(value);
    });
    return [...new Set(names)];
  }

  function extractCourseNames(app) {
    const items = asArray(app?.items || app?.institutions);
    const names = [];
    items.forEach((item) => {
      [item?.choice1, item?.choice2, item?.choice3, item?.courseName, item?.course, item?.programme, item?.program, item?.name].forEach((entry) => {
        const value = String(entry || "").trim();
        if (value) names.push(value);
      });
    });
    [
      app?.programmeChoice,
      app?.programme,
      app?.forms?.current?.course,
      app?.forms?.current?.courseName,
      app?.forms?.current?.programme,
      app?.forms?.specialisedApplication?.values?.course,
      app?.forms?.specialisedApplication?.values?.courseName,
      app?.forms?.specialisedApplication?.values?.programme,
      app?.applicationEngine?.formData?.course,
      app?.applicationEngine?.formData?.courseName,
      app?.applicationEngine?.formData?.programme
    ].forEach((entry) => {
      const value = String(entry || "").trim();
      if (value) names.push(value);
    });
    return [...new Set(names)];
  }

  function buildApplicationView(app) {
    const forms = mergedApplicationForms(app);
    const viewApp = { ...app, forms, items: firstNonEmptyArray(asArray(app?.items), asArray(app?.institutions), asArray(forms.institutions)) };
    const learnerForm = forms.learner || {};
    const schoolForm = forms.school || {};
    const lateData = extractLateApplicationData(viewApp) || {};
    const latePersonal = lateData.personal || {};
    const lateDetails = lateData.details || {};
    const profile = findUserByRef(app?.userId) || {};
    const category = normalizeCategory(app?.status);
    const typeLabel = applicationTypeLabel(viewApp);
    const reference = firstFilled(app?.reference, app?.referenceNumber, app?.applicationEngine?.reference, app?.lateApplication?.reference, lateData.reference);
    const extractedInstitutions = extractInstitutionNames(viewApp);
    const extractedCourses = extractCourseNames(viewApp);
    const institutionNames = [...new Set(
      extractedInstitutions
        .concat(asTextList(lateDetails.institution))
        .concat(asTextList(firstFilled(profile?.selectedInstitution, profile?.selected_institution)))
        .filter(Boolean)
    )];
    const courseNames = [...new Set(
      extractedCourses
        .concat(extractedCourses.length ? [] : asTextList(lateDetails.course))
        .concat(asTextList(firstFilled(profile?.selectedCourses, profile?.selected_courses)))
        .filter(Boolean)
    )];
    const displayName = firstFilled(
      learnerForm?.fullNames,
      learnerForm?.fullName,
      latePersonal?.fullName,
      profile?.fullName,
      profile?.name,
      "Learner"
    );
    const email = firstFilled(learnerForm?.email, latePersonal?.email, lateDetails?.email, profile?.email);
    const phone = firstFilled(learnerForm?.cellphone, learnerForm?.phone, latePersonal?.phone, lateDetails?.phone, profile?.phone, profile?.cellphone);
    const idNumber = firstFilled(learnerForm?.idNumber, latePersonal?.idNumber, profile?.idNumber);
    const surname = firstFilled(learnerForm?.surname, latePersonal?.surname, profile?.surname);
    const province = firstFilled(learnerForm?.province, latePersonal?.province, lateDetails?.province, profile?.province, profile?.location, schoolForm?.schoolProvince);
    const schoolName = firstFilled(schoolForm?.schoolName, schoolForm?.confirmName, latePersonal?.schoolName, profile?.schoolName);
    const grade = firstFilled(schoolForm?.grade, schoolForm?.currentGrade, schoolForm?.completionYear, latePersonal?.examYear, profile?.grade, profile?.completionYear);
    const institution = institutionNames[0] || firstFilled(app?.institutionName, "No institution selected");
    const applicationId = shortApplicationId(app);
    const selectedPackage = app?.selectedPackage || app?.applicationPayload?.selectedPackage || app?.package || forms.packageSelection?.package || {};
    const selectedAddons = asArray(app?.selectedAddons || app?.applicationPayload?.selectedAddons || forms.packageSelection?.addons);
    const packageName = firstFilled(selectedPackage?.name, selectedPackage?.packName, "No package selected");
    const packagePrice = Number(app?.packagePrice ?? selectedPackage?.price ?? selectedPackage?.packPrice ?? 0);
    const addonsTotal = Number(app?.addonsTotal || 0);
    const finalTotal = Number(app?.finalTotal || packagePrice + addonsTotal);
    return {
      raw: app,
      id: app?.id,
      userId: firstFilled(app?.userId, profile?.id),
      name: displayName,
      surname,
      email,
      phone,
      idNumber,
      dob: firstFilled(learnerForm?.dateOfBirth, learnerForm?.dob, latePersonal?.dob, profile?.dateOfBirth),
      province,
      schoolName,
      grade,
      applicationId,
      reference,
      institution,
      institutionNames,
      courseNames,
      applicationTypeLabel: typeLabel,
      packageName,
      packagePrice,
      selectedAddons,
      addonsTotal,
      finalTotal,
      paymentStatus: firstFilled(app?.paymentStatus, "Unpaid"),
      applicationReference: firstFilled(app?.applicationReference, reference),
      status: firstFilled(app?.status, "Submitted"),
      category,
      categoryLabel: categoryLabel(category),
      assignedAt: firstFilled(app?.assignedAt, app?.updatedAt, app?.createdAt),
      createdAt: firstFilled(app?.createdAt, app?.updatedAt),
      updatedAt: firstFilled(app?.updatedAt, app?.createdAt),
      progress: progressForStatus(app?.status),
      searchBlob: [
        displayName,
        surname,
        email,
        phone,
        idNumber,
        province,
        schoolName,
        grade,
        institution,
        applicationId,
        reference,
        typeLabel,
        packageName,
        selectedAddons.map((addon) => firstFilled(addon?.name, addon?.code)).join(" "),
        firstFilled(app?.status, ""),
        courseNames.join(" ")
      ].join(" ").toLowerCase()
    };
  }

  function buildAssignedUsersFromApplications(applications) {
    const rows = [];
    const seen = new Set();

    asArray(applications).forEach((app) => {
      const forms = mergedApplicationForms(app);
      const learner = forms.learner || {};
      const local = window.KagieAPI?.getUserById?.(app?.userId) || window.KagieAPI?.getUserBySupabaseId?.(app?.userId) || {};
      const id = firstFilled(local?.id, app?.userId);
      if (!id || seen.has(id)) return;
      seen.add(id);

      rows.push({
        ...local,
        id,
        supabaseUserId: firstFilled(local?.supabaseUserId),
        fullName: firstFilled(local?.fullName, learner?.fullNames, learner?.fullName, app?.applicant, "Learner"),
        email: firstFilled(local?.email, learner?.email),
        phone: firstFilled(local?.phone, learner?.cellphone, learner?.phone),
        cellphone: firstFilled(local?.cellphone, learner?.cellphone, learner?.phone)
      });
    });

    return rows;
  }

  function getVisibleApplications() {
    const search = String($("assistantSearchInput")?.value || "").trim().toLowerCase();
    return state.applications
      .map(buildApplicationView)
      .filter((app) => (state.filter === "all" ? true : app.category === state.filter))
      .filter((app) => (search ? app.searchBlob.includes(search) : true));
  }

  function getSelectedApplicationView() {
    const selected = state.applications.find((app) => app.id === state.selectedApplicationId);
    return selected ? buildApplicationView(selected) : null;
  }

  function getNotificationTone(type) {
    const value = String(type || "").trim().toLowerCase();
    if (value.includes("success")) return "completed";
    if (value.includes("warning") || value.includes("error")) return "pending";
    return "in_progress";
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

  function buildInlineRetry(message, action) {
    const ux = UX();
    if (ux?.buildInlineError) return ux.buildInlineError(message, "Retry", action);
    return renderEmptyState(message);
  }

  function renderDashboardLoadingState() {
    const ux = UX();
    $("heroTitle").textContent = "Good day";
    $("heroText").textContent = "Loading your dashboard...";
    $("stats").innerHTML = ux?.skeletonStatCards?.(4) || "";
    $("applications").innerHTML = ux?.skeletonQueueRows?.({ rows: 4, columns: 7 }) || renderEmptyState("Loading assigned learners...");
    $("assistantQueueMeta").textContent = "Loading learner queue...";
    $("assistantPagination").innerHTML = "";
    $("learnerInspector").innerHTML = ux?.skeletonInspector?.() || '<div class="inspector-empty">Loading learner details...</div>';
    $("assistantStatusOverview").innerHTML = ux?.skeletonOverview?.() || renderEmptyState("Loading status overview...");
    $("activity").innerHTML = ux?.skeletonList?.({ rows: 4, lines: 2 }) || "";
    const noticeList = $("assistantNoticesList");
    if (noticeList) noticeList.innerHTML = ux?.skeletonList?.({ rows: 4, lines: 2 }) || "";
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
    const counts = {
      assigned: apps.length,
      inProgress: apps.filter((app) => app.category === "in_progress").length,
      pending: apps.filter((app) => app.category === "pending").length,
      completed: apps.filter((app) => app.category === "completed").length
    };

    $("assistantLearnersCount").textContent = String(apps.length);
    $("assistantAssignedCount").textContent = String(counts.assigned);
    $("assistantInProgressCount").textContent = String(counts.inProgress);
    $("assistantCompletedCount").textContent = String(counts.completed);

    $("stats").innerHTML = [
      buildStatCard({
        tone: "blue",
        label: "Assigned to Me",
        value: counts.assigned,
        note: `${counts.assigned} learner${counts.assigned === 1 ? "" : "s"} in your queue`,
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      }),
      buildStatCard({
        tone: "red",
        label: "In Progress",
        value: counts.inProgress,
        note: "Cases moving through live processing",
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      }),
      buildStatCard({
        tone: "amber",
        label: "Pending Review",
        value: counts.pending,
        note: "Learners still waiting on review steps",
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      }),
      buildStatCard({
        tone: "green",
        label: "Completed",
        value: counts.completed,
        note: "Applications with a final outcome",
        icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      })
    ].join("");
  }

  function renderQueue() {
    const allItems = getVisibleApplications();
    const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = allItems.slice(start, start + PAGE_SIZE);

    const container = $("applications");
    container.innerHTML = pageItems.length ? pageItems.map((app) => `
      <div class="queue-row ${app.id === state.selectedApplicationId ? "active" : ""}" data-app-id="${esc(app.id)}">
        <div class="queue-cell" data-label="Learner">
          <div class="queue-user">
            <div class="queue-avatar assistant">${esc(initialsFor(app.name, "KA"))}</div>
            <div>
              <div class="queue-user-name">${esc(app.name)}</div>
              <div class="queue-user-meta">${esc(app.applicationId)}</div>
              <div class="queue-user-meta">${esc(app.applicationTypeLabel)}</div>
              <div class="queue-user-meta">${esc(app.packageName)} | ${esc(`R${Number(app.finalTotal || 0).toLocaleString("en-ZA")}`)}</div>
              <div class="queue-user-meta">${esc(app.email || "Email pending")}</div>
            </div>
          </div>
        </div>
        <div class="queue-cell" data-label="Institution">
          <div class="queue-user-name">${esc(app.institution)}</div>
        </div>
        <div class="queue-cell" data-label="Courses">
          <div class="queue-user-name">${esc(`${app.courseNames.length || 0} course${app.courseNames.length === 1 ? "" : "s"}`)}</div>
        </div>
        <div class="queue-cell" data-label="Date Assigned">
          <div class="queue-user-name">${esc(formatDate(app.assignedAt))}</div>
        </div>
        <div class="queue-cell" data-label="Status">
          <span class="status-pill ${esc(app.category === "pending" ? "pending" : app.category === "completed" ? "completed" : "in-progress")}">${esc(app.categoryLabel)}</span>
          <div class="queue-user-meta">${esc(app.paymentStatus || "Unpaid")}</div>
        </div>
        <div class="queue-cell" data-label="Progress">
          <div class="progress-inline">
            <div class="progress-track">
              <div class="progress-fill ${app.category === "pending" ? "pending" : app.category === "completed" ? "completed" : ""}" style="width:${Math.max(6, Math.min(100, app.progress))}%"></div>
            </div>
            <span class="progress-value">${esc(`${app.progress}%`)}</span>
          </div>
        </div>
        <div class="queue-cell" data-label="Action">
          <button class="table-action" type="button" data-view-app="${esc(app.id)}">View</button>
        </div>
      </div>
    `).join("") : renderEmptyState("No learners match your current search or filter.");

    $("assistantQueueMeta").textContent = allItems.length
      ? `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, allItems.length)} of ${allItems.length} assigned learner${allItems.length === 1 ? "" : "s"}`
      : "No learner records found.";

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = $("assistantPagination");
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

  function renderInspector() {
    const app = getSelectedApplicationView();
    const container = $("learnerInspector");
    if (!app) {
      container.innerHTML = `<div class="inspector-empty">Select a learner from the queue to open their live Kagie profile.</div>`;
      return;
    }

    const coursesMarkup = app.courseNames.length
      ? `<ul class="detail-bullets">${app.courseNames.map((course) => `<li>${esc(course)}</li>`).join("")}</ul>`
      : `<div class="detail-value">No courses selected.</div>`;
    const institutionsMarkup = app.institutionNames.length
      ? `<ul class="detail-bullets">${app.institutionNames.map((institution) => `<li>${esc(institution)}</li>`).join("")}</ul>`
      : `<div class="detail-value">No institution selected.</div>`;

    const detailHref = `applicant-view.html?id=${encodeURIComponent(app.id)}${app.userId ? `&userId=${encodeURIComponent(app.userId)}` : ""}`;
    container.innerHTML = `
      <section class="inspector-profile">
        <div class="inspector-profile-head">
          <div class="queue-avatar assistant">${esc(initialsFor(app.name, "KA"))}</div>
          <div class="inspector-profile-copy">
            <div class="inspector-name">${esc(app.name)}</div>
            <div class="inspector-id">${esc(app.applicationId)}</div>
            <div class="inspector-contact">
              <span>${esc(app.email || "No email saved")}</span>
              <span>${esc(app.phone || "No phone saved")}</span>
            </div>
          </div>
          <span class="status-pill ${esc(app.category === "pending" ? "pending" : app.category === "completed" ? "completed" : "in-progress")}">${esc(app.categoryLabel)}</span>
        </div>
      </section>

      <div class="detail-list">
        <div class="detail-item"><span class="detail-label">Surname</span><span class="detail-value">${esc(app.surname || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">Date of birth</span><span class="detail-value">${esc(app.dob || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">ID Number</span><span class="detail-value">${esc(app.idNumber || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">School</span><span class="detail-value">${esc(app.schoolName || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">Grade / completion year</span><span class="detail-value">${esc(app.grade || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">Province</span><span class="detail-value">${esc(app.province || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">Application type</span><span class="detail-value">${esc(app.applicationTypeLabel || "Undergraduate Applications")}</span></div>
        <div class="detail-item"><span class="detail-label">Selected package</span><span class="detail-value">${esc(app.packageName)}</span></div>
        <div class="detail-item"><span class="detail-label">Package price</span><span class="detail-value">${esc(`R${Number(app.packagePrice || 0).toLocaleString("en-ZA")}`)}</span></div>
        <div class="detail-item"><span class="detail-label">Selected add-ons</span><span class="detail-value">${esc(app.selectedAddons.length ? app.selectedAddons.map((addon) => firstFilled(addon?.name, addon?.code)).join(", ") : "None")}</span></div>
        <div class="detail-item"><span class="detail-label">Final total</span><span class="detail-value">${esc(`R${Number(app.finalTotal || 0).toLocaleString("en-ZA")}`)}</span></div>
        <div class="detail-item"><span class="detail-label">Payment status</span><span class="detail-value">${esc(app.paymentStatus)}</span></div>
        <div class="detail-item"><span class="detail-label">Reference</span><span class="detail-value">${esc(app.reference || app.applicationId || "Not provided")}</span></div>
        <div class="detail-item"><span class="detail-label">Application status</span><span class="detail-value">${esc(app.status || "Pending")}</span></div>
        <div class="detail-item"><span class="detail-label">Submitted / created</span><span class="detail-value">${esc(formatDate(app.createdAt))}</span></div>
        <div class="detail-item"><span class="detail-label">Institution choices</span><div class="detail-value">${institutionsMarkup}</div></div>
        <div class="detail-item"><span class="detail-label">Courses</span><div class="detail-value">${coursesMarkup}</div></div>
        <div class="detail-item"><span class="detail-label">Application progress</span>
          <div class="detail-value" style="width:100%">
            <div class="progress-inline">
              <div class="progress-track">
                <div class="progress-fill ${app.category === "pending" ? "pending" : app.category === "completed" ? "completed" : ""}" style="width:${Math.max(6, Math.min(100, app.progress))}%"></div>
              </div>
              <span class="progress-value">${esc(`${app.progress}%`)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="action-stack">
        <button class="action-button primary" type="button" data-open-profile="${esc(detailHref)}">View full profile</button>
        <button class="action-button amber" type="button" data-open-status="${esc(app.id)}">Update status</button>
        <button class="action-button outline" type="button" data-open-docs="${esc(app.id)}">View documents</button>
      </div>
    `;
  }

  function renderStatusOverview() {
    const apps = state.applications.map(buildApplicationView);
    const pending = apps.filter((app) => app.category === "pending").length;
    const inProgress = apps.filter((app) => app.category === "in_progress").length;
    const completed = apps.filter((app) => app.category === "completed").length;
    const total = Math.max(1, apps.length);
    const pendingPct = Math.round((pending / total) * 100);
    const progressPct = Math.round((inProgress / total) * 100);
    const completedPct = Math.max(0, 100 - pendingPct - progressPct);

    $("assistantStatusOverview").innerHTML = `
      <div class="summary-layout">
        <div class="summary-donut" style="background: conic-gradient(var(--blue) 0 ${progressPct}%, var(--amber) ${progressPct}% ${progressPct + pendingPct}%, var(--green) ${progressPct + pendingPct}% 100%)">
          <div class="summary-donut-copy">
            <div class="summary-donut-value">${esc(String(apps.length))}</div>
            <div class="summary-donut-label">Applications</div>
          </div>
        </div>
        <div class="legend-list">
          <div class="legend-row">
            <div class="legend-key"><span class="legend-dot blue"></span><span>In Progress</span></div>
            <strong>${esc(`${inProgress} (${progressPct}%)`)}</strong>
          </div>
          <div class="legend-row">
            <div class="legend-key"><span class="legend-dot amber"></span><span>Pending Review</span></div>
            <strong>${esc(`${pending} (${pendingPct}%)`)}</strong>
          </div>
          <div class="legend-row">
            <div class="legend-key"><span class="legend-dot green"></span><span>Completed</span></div>
            <strong>${esc(`${completed} (${completedPct}%)`)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function activityMessage(entry) {
    const app = state.applications.find((item) => item.id === entry?.applicationId);
    const label = app ? buildApplicationView(app).name : "A learner";
    const action = String(entry?.action || "").trim().toLowerCase();
    if (action === "add_note") return `${label} received a new internal note`;
    if (action === "review_document") return `${label} had a document reviewed`;
    if (action === "send_support_message") return `${label} received learner support feedback`;
    if (action === "save_application_status" || action === "update_application") return `${label} had a status update saved`;
    if (action === "update_call_request") return `${label} callback progress was updated`;
    return `${label} activity was updated`;
  }

  function renderActivity() {
    const items = asArray(state.activity).slice(0, 4);
    $("activity").innerHTML = items.length ? items.map((entry) => `
      <article class="activity-item">
        <div class="activity-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="item-copy">
          <div class="item-title">${esc(activityMessage(entry))}</div>
          <div class="item-subtitle">${esc(String(entry?.action || "Activity").replace(/_/g, " "))}</div>
        </div>
        <div class="item-meta">${esc(formatRelativeTime(entry?.createdAt))}</div>
      </article>
    `).join("") : renderEmptyState("Assistant activity will appear here as you review applications and learner documents.");
  }

  function renderNotices() {
    const unread = state.notices.filter((item) => !item?.read).length;
    $("assistantNoticeCount").textContent = String(unread);
    $("assistantMessagesCount").textContent = String(unread);
    $("assistantNoticesList").innerHTML = state.notices.length ? state.notices.slice(0, 12).map((notice) => `
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
    `).join("") : renderEmptyState("No notices are waiting for this assistant account.");
  }

  function syncSelectedApplication() {
    const visible = state.applications;
    if (!visible.length) {
      state.selectedApplicationId = "";
      return;
    }
    const exists = visible.some((app) => app.id === state.selectedApplicationId);
    if (!exists) state.selectedApplicationId = visible[0].id;
  }

  function renderAll() {
    syncSelectedApplication();
    renderStats();
    renderQueue();
    renderInspector();
    renderStatusOverview();
    renderActivity();
    renderNotices();
    updateFilterButton();
    updateHero();
  }

  function updateHero() {
    const name = firstFilled(state.user?.fullName, state.user?.name, "Assistant");
    $("heroTitle").textContent = `${greetingForNow()}, ${name.split(/\s+/)[0]}!`;
    $("heroText").textContent = state.applications.length
      ? `Here is what is happening with your ${state.applications.length} assigned learner${state.applications.length === 1 ? "" : "s"} right now.`
      : "Your live assistant queue is empty right now, so new learner work will show here as soon as it is assigned.";
  }

  function updateFilterButton() {
    const button = $("assistantFilterButton");
    const label = state.filter === "all"
      ? "All"
      : state.filter === "pending"
        ? "Pending Review"
        : state.filter === "completed"
          ? "Completed"
          : "In Progress";
    button.querySelector("span").textContent = `Filter: ${label}`;
  }

  function openModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.add("open");
  }

  function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.remove("open");
  }

  function setStatusMessage(text, tone) {
    const node = $("assistantStatusMsg");
    node.textContent = text || "";
    node.className = tone ? `status-message ${tone}` : "status-message";
  }

  async function openDocumentsModal(api, appId) {
    const app = state.applications.find((item) => item.id === appId);
    if (!app) return;
    const userId = firstFilled(app?.userId);
    if (!userId) return;
    if (!state.docsCache.has(userId)) {
      const docs = await api.getDocumentsByUserAsync(userId).catch(() => []);
      state.docsCache.set(userId, await attachDocumentLinks(api, docs));
    }
    const docs = asArray(state.docsCache.get(userId));
    $("assistantDocsList").innerHTML = docs.length ? docs.map((doc) => `
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
    openModal("assistantDocsModal");
  }

  function openStatusModal(appId) {
    const app = state.applications.find((item) => item.id === appId);
    if (!app) return;
    $("assistantStatusSelect").value = firstFilled(app?.status, "Submitted");
    $("assistantStatusNote").value = "";
    setStatusMessage("", "");
    openModal("assistantStatusModal");
  }

  async function refreshDashboard(api) {
    renderDashboardLoadingState();
    bootScreen?.update?.("Kagie", "Loading your dashboard...");

    const coreTask = api.getApplicationsByAssistantAsync(state.user.id)
      .then((items) => asArray(items))
      .catch((error) => {
        throw new Error(error?.message || "Failed to load your assigned learners.");
      });
    const noticesTask = api.getNotificationsAsync(state.user.id)
      .then((items) => asArray(items))
      .catch((error) => {
        throw new Error(error?.message || "Failed to load notices.");
      });
    const activityTask = api.getAllAssistantActivityAsync()
      .then((items) => asArray(items))
      .catch((error) => {
        throw new Error(error?.message || "Failed to load assistant activity.");
      });

    try {
      const applications = await coreTask;
      state.applications = asArray(applications).sort((left, right) => new Date(right?.updatedAt || right?.createdAt || 0) - new Date(left?.updatedAt || left?.createdAt || 0));
      state.users = buildAssignedUsersFromApplications(state.applications);
      renderStats();
      renderQueue();
      renderInspector();
      renderStatusOverview();
      updateFilterButton();
      updateHero();
      bootScreen?.hide?.();
      bootScreen = null;
    } catch (error) {
      const message = error?.message || "We could not load the assistant queue right now.";
      $("applications").innerHTML = buildInlineRetry(message, "refresh-dashboard");
      $("assistantQueueMeta").textContent = "Learner queue unavailable.";
      $("learnerInspector").innerHTML = `<div class="inspector-empty">${esc(message)}</div>`;
      $("assistantStatusOverview").innerHTML = renderEmptyState("Status overview unavailable.");
      $("activity").innerHTML = renderEmptyState("Recent activity unavailable.");
      bootScreen?.hide?.();
      bootScreen = null;
      return;
    }

    noticesTask
      .then((notices) => {
        state.notices = asArray(notices).sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0));
        renderNotices();
      })
      .catch((error) => {
        $("assistantNoticeCount").textContent = "0";
        $("assistantMessagesCount").textContent = "0";
        const noticeList = $("assistantNoticesList");
        if (noticeList) noticeList.innerHTML = buildInlineRetry(error?.message || "Failed to load notices.", "refresh-notices");
      });

    activityTask
      .then((activity) => {
        state.activity = asArray(activity).sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0));
        renderActivity();
      })
      .catch((error) => {
        $("activity").innerHTML = buildInlineRetry(error?.message || "Failed to load recent activity.", "refresh-activity");
      });

    await Promise.allSettled([noticesTask, activityTask]);
  }

  function exportVisibleRows() {
    const rows = getVisibleApplications();
    if (!rows.length) return;
    const csv = [
      ["Learner", "Email", "Phone", "Application ID", "Application Type", "Institution", "Courses", "Status", "Progress"].join(","),
      ...rows.map((item) => [
        item.name,
        item.email,
        item.phone,
        item.applicationId,
        item.applicationTypeLabel,
        item.institution,
        item.courseNames.join(" | "),
        item.categoryLabel,
        `${item.progress}%`
      ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "assistant-learners.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setRoleSafeRedirect(user) {
    const role = normalizeRole(user?.role);
    if (role === "master_admin") {
      window.location.href = "../master-admin/dashboard.html";
      return true;
    }
    if (role !== "assistant_admin") {
      window.location.href = "../login.html";
      return true;
    }
    return false;
  }

  function bindStaticEvents(api) {
    document.querySelectorAll("[data-scroll-target]").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.preventDefault();
        const targetId = node.getAttribute("data-scroll-target");
        const target = targetId ? $(targetId) : null;
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        document.body.classList.remove("sidebar-open");
        $("assistantOverlay").classList.remove("open");
      });
    });

    document.querySelectorAll("[data-filter-target]").forEach((node) => {
      node.addEventListener("click", (event) => {
        event.preventDefault();
        state.filter = node.getAttribute("data-filter-target") || "all";
        state.page = 1;
        renderAll();
        $("assistantQueueCard").scrollIntoView({ behavior: "smooth", block: "start" });
        document.body.classList.remove("sidebar-open");
        $("assistantOverlay").classList.remove("open");
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach((node) => {
      node.addEventListener("click", () => closeModal(node.getAttribute("data-close-modal")));
    });

    ["assistantNoticesModal", "assistantStatusModal", "assistantDocsModal"].forEach((id) => {
      const modal = $(id);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(id);
      });
    });

    $("assistantMenuToggle").addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
      $("assistantOverlay").classList.toggle("open", document.body.classList.contains("sidebar-open"));
    });

    $("assistantBottomMore").addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
      $("assistantOverlay").classList.toggle("open", document.body.classList.contains("sidebar-open"));
    });

    $("assistantOverlay").addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      $("assistantOverlay").classList.remove("open");
    });

    const debouncedSearch = UX()?.debounce
      ? UX().debounce(() => {
        state.page = 1;
        renderQueue();
      }, 180)
      : () => {
        state.page = 1;
        renderQueue();
      };
    $("assistantSearchInput").addEventListener("input", debouncedSearch);

    $("assistantFilterButton").addEventListener("click", () => {
      const currentIndex = FILTER_ORDER.indexOf(state.filter);
      state.filter = FILTER_ORDER[(currentIndex + 1) % FILTER_ORDER.length];
      state.page = 1;
      renderAll();
    });

    $("assistantExportButton").addEventListener("click", exportVisibleRows);

    $("assistantNoticeBtn").addEventListener("click", async () => {
      openModal("assistantNoticesModal");
      if (state.notices.some((item) => !item?.read) && api.markAllNotificationsReadAsync) {
        await api.markAllNotificationsReadAsync(state.user.id).catch(() => {});
        state.notices = state.notices.map((item) => ({ ...item, read: true }));
        renderNotices();
      }
    });

    $("assistantMessagesLink").addEventListener("click", () => $("assistantNoticeBtn").click());
    $("assistantBottomNotice").addEventListener("click", () => $("assistantNoticeBtn").click());

    $("logoutLink").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (UX()?.withButtonLock) {
        await UX().withButtonLock(button, "assistant-logout", "Signing out...", async () => {
          await api.logout().catch(() => {});
          window.location.href = "../login.html";
        });
        return;
      }
      await api.logout().catch(() => {});
      window.location.href = "../login.html";
    });

    $("assistantStatusForm").addEventListener("submit", async (event) => {
      const selected = state.applications.find((app) => app.id === state.selectedApplicationId);
      if (!selected) return;
      try {
        if (UX()?.withFormLock) {
          await UX().withFormLock({
            event,
            form: event.currentTarget,
            busyText: "Saving...",
            statusNode: $("assistantStatusMsg"),
            task: async () => {
              const nextStatus = $("assistantStatusSelect").value;
              const noteText = $("assistantStatusNote").value.trim();
              const previousStatus = selected.status || "Pending";
              setStatusMessage("Saving update...", "info");
              await api.updateApplicationAsync(selected.id, { status: nextStatus });
              if (nextStatus !== previousStatus && (api.postApplicationUpdateAsync || api.postApplicationUpdate)) {
                await (api.postApplicationUpdateAsync
                  ? api.postApplicationUpdateAsync({
                    applicationId: selected.id,
                    title: "Application status updated",
                    message: `Your Kagie application status changed from ${previousStatus} to ${nextStatus}.`,
                    status: nextStatus,
                    actionLabel: "Open dashboard",
                    actionUrl: "dashboard.html"
                  })
                  : Promise.resolve(api.postApplicationUpdate({
                    applicationId: selected.id,
                    title: "Application status updated",
                    message: `Your Kagie application status changed from ${previousStatus} to ${nextStatus}.`,
                    status: nextStatus,
                    actionLabel: "Open dashboard",
                    actionUrl: "dashboard.html"
                  })));
              }
              if (noteText) await api.addApplicationNoteAsync(selected.id, noteText);
              setStatusMessage("Application status updated.", "ok");
              await refreshDashboard(api);
              closeModal("assistantStatusModal");
            }
          });
          return;
        }

        event.preventDefault();
        const nextStatus = $("assistantStatusSelect").value;
        const noteText = $("assistantStatusNote").value.trim();
        const previousStatus = selected.status || "Pending";
        setStatusMessage("Saving update...", "info");
        await api.updateApplicationAsync(selected.id, { status: nextStatus });
        if (nextStatus !== previousStatus && (api.postApplicationUpdateAsync || api.postApplicationUpdate)) {
          await (api.postApplicationUpdateAsync
            ? api.postApplicationUpdateAsync({
              applicationId: selected.id,
              title: "Application status updated",
              message: `Your Kagie application status changed from ${previousStatus} to ${nextStatus}.`,
              status: nextStatus,
              actionLabel: "Open dashboard",
              actionUrl: "dashboard.html"
            })
            : Promise.resolve(api.postApplicationUpdate({
              applicationId: selected.id,
              title: "Application status updated",
              message: `Your Kagie application status changed from ${previousStatus} to ${nextStatus}.`,
              status: nextStatus,
              actionLabel: "Open dashboard",
              actionUrl: "dashboard.html"
            })));
        }
        if (noteText) await api.addApplicationNoteAsync(selected.id, noteText);
        setStatusMessage("Application status updated.", "ok");
        await refreshDashboard(api);
        closeModal("assistantStatusModal");
      } catch (error) {
        setStatusMessage(error?.message || "Could not save the status update.", "err");
      }
    });

    document.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-kagie-retry]");
      if (!retryButton) return;
      const action = retryButton.getAttribute("data-kagie-retry");
      if (action === "refresh-dashboard") {
        void (UX()?.withButtonLock
          ? UX().withButtonLock(retryButton, "assistant-retry-dashboard", "Retrying...", async () => {
            await refreshDashboard(api);
          })
          : refreshDashboard(api));
        return;
      }
      if (action === "refresh-notices") {
        void (UX()?.withButtonLock
          ? UX().withButtonLock(retryButton, "assistant-retry-notices", "Retrying...", async () => {
            const notices = await api.getNotificationsAsync(state.user.id).catch((error) => {
              throw new Error(error?.message || "Failed to load notices.");
            });
            state.notices = asArray(notices).sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0));
            renderNotices();
          })
          : null);
        return;
      }
      if (action === "refresh-activity") {
        void (UX()?.withButtonLock
          ? UX().withButtonLock(retryButton, "assistant-retry-activity", "Retrying...", async () => {
            $("activity").innerHTML = UX()?.skeletonList?.({ rows: 4, lines: 2 }) || renderEmptyState("Loading recent activity...");
            const activity = await api.getAllAssistantActivityAsync().catch((error) => {
              throw new Error(error?.message || "Failed to load assistant activity.");
            });
            state.activity = asArray(activity).sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0));
            renderActivity();
          })
          : null);
      }
    });

    $("applications").addEventListener("click", (event) => {
      const row = event.target.closest(".queue-row");
      const viewButton = event.target.closest("[data-view-app]");
      if (viewButton) {
        event.stopPropagation();
        const app = state.applications.find((entry) => entry.id === viewButton.getAttribute("data-view-app"));
        if (!app) return;
        const href = `applicant-view.html?id=${encodeURIComponent(app.id)}${app.userId ? `&userId=${encodeURIComponent(app.userId)}` : ""}`;
        window.location.href = href;
        return;
      }
      if (!row) return;
      state.selectedApplicationId = row.getAttribute("data-app-id") || "";
      renderInspector();
      renderQueue();
    });

    $("assistantPagination").addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button) return;
      state.page = Number(button.getAttribute("data-page") || 1);
      renderQueue();
    });

    $("learnerInspector").addEventListener("click", async (event) => {
      const profileButton = event.target.closest("[data-open-profile]");
      if (profileButton) {
        window.location.href = profileButton.getAttribute("data-open-profile");
        return;
      }
      const statusButton = event.target.closest("[data-open-status]");
      if (statusButton) {
        openStatusModal(statusButton.getAttribute("data-open-status"));
        return;
      }
      const docsButton = event.target.closest("[data-open-docs]");
      if (docsButton) {
        await openDocumentsModal(api, docsButton.getAttribute("data-open-docs"));
      }
    });
  }

  function setIdentityUI(user) {
    const displayName = firstFilled(user?.fullName, user?.name, "Assistant Admin");
    const avatar = initialsFor(displayName, "AA");
    $("assistantSidebarAvatar").textContent = avatar;
    $("assistantTopAvatar").textContent = avatar;
    $("assistantSidebarName").textContent = displayName;
    $("assistantTopName").textContent = displayName;
    $("assistantSidebarRole").textContent = "Assistant Administrator";
    $("assistantTopRole").textContent = "Assistant Administrator";
  }

  async function main() {
    const api = window.KagieAPI;
    if (!api) return;

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

    state.user = api.requireRole("assistant_admin");
    setIdentityUI(state.user);
    bootScreen = UX()?.showBootScreen?.({
      title: "Kagie",
      message: "Loading your dashboard..."
    }) || null;
    bindStaticEvents(api);
    await refreshDashboard(api);
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => {
      console.error("Assistant dashboard failed to load:", error);
      bootScreen?.hide?.();
      bootScreen = null;
      $("applications").innerHTML = renderEmptyState("We could not load the assistant dashboard right now.");
      $("learnerInspector").innerHTML = `<div class="inspector-empty">Dashboard data is unavailable right now.</div>`;
      $("activity").innerHTML = renderEmptyState("No assistant activity could be loaded.");
      $("assistantStatusOverview").innerHTML = renderEmptyState("Status summary unavailable.");
    });
  });
})();
