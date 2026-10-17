(function () {
  window.KagieMasterDashboardPageLoaded = true;

  const PAGE_SIZE = 5;
  const FILTER_ORDER = ["all", "pending", "assigned", "in_progress", "completed"];

  const $ = (id) => document.getElementById(id);
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function asTextList(value) {
    if (Array.isArray(value)) return value.flatMap((item) => asTextList(item)).filter(Boolean);
    if (value && typeof value === "object") {
      return asTextList(firstFilled(
        value.institutionName,
        value.institution_name,
        value.courseName,
        value.course_name,
        value.programme,
        value.program,
        value.title,
        value.name,
        value.label,
        value.value
      ));
    }
    return String(value || "")
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function uniqueTextList(values) {
    return [...new Set(asArray(values).flatMap((value) => asTextList(value)).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function collectNamedValues(source, keys) {
    if (!source) return [];
    if (Array.isArray(source)) return source.flatMap((item) => collectNamedValues(item, keys));
    if (typeof source !== "object") return asTextList(source);
    return uniqueTextList(keys.map((key) => source?.[key]));
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
    const type = normalizeApplicationTypeKey(firstFilled(
      app?.applicationType,
      app?.forms?.applicationType?.type,
      app?.applicationEngine?.type
    )) || "undergraduate";
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

  const state = {
    api: null,
    user: null,
    applications: [],
    users: [],
    assistants: [],
    notices: [],
    summary: null,
    adminContent: {
      career: null,
      housing: null
    },
    controlErrors: {},
    announcements: [],
    careerArticles: [],
    institutions: [],
    questionPapers: [],
    housingListings: [],
    selectedApplicationId: "",
    selectedAssistantId: "",
    formTypes: [],
    assistantPermissions: new Map(),
    filter: "all",
    page: 1,
    docsCache: new Map(),
    detailCache: new Map(),
    pendingDetailKey: ""
  };
  const UX = () => window.KagieUX || null;
  let bootScreen = null;

  async function runFormAction(event, busyText, task) {
    const form = event.currentTarget;
    const statusNode = form?.querySelector(".status-message");
    const ux = UX();
    if (ux?.withFormLock) {
      return ux.withFormLock({
        event,
        form,
        busyText,
        task,
        statusNode
      });
    }
    event.preventDefault();
    if (!form || form.dataset.busy === "1") return null;
    form.dataset.busy = "1";
    const button = event.submitter || form.querySelector('button[type="submit"], .panel-link, .action-button');
    const originalText = button?.textContent || "";
    try {
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (busyText) button.textContent = busyText;
      }
      return await task();
    } finally {
      form.dataset.busy = "0";
      if (button?.isConnected) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        if (busyText) button.textContent = originalText;
      }
    }
  }

  async function runButtonAction(button, key, busyText, task) {
    const ux = UX();
    if (ux?.withButtonLock) {
      return ux.withButtonLock(button, key, busyText, task);
    }
    if (button?.dataset?.kagieBusy === "1") return null;
    const originalText = button?.textContent || "";
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      if (busyText) button.textContent = busyText;
    }
    try {
      return await task();
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        if (busyText) button.textContent = originalText;
      }
    }
  }

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
        selectedInstitutions: asArray(candidate?.selectedInstitutions).length ? candidate.selectedInstitutions : asArray(current?.selectedInstitutions),
        selected_institutions: asArray(candidate?.selected_institutions).length ? candidate.selected_institutions : asArray(current?.selected_institutions),
        selectedCourses: asArray(candidate?.selectedCourses).length ? candidate.selectedCourses : asArray(current?.selectedCourses),
        selected_courses: asArray(candidate?.selected_courses).length ? candidate.selected_courses : asArray(current?.selected_courses),
        role: firstFilled(candidate?.role, current?.role)
      };
    });
    return merged;
  }

  function findUserByRef(ref) {
    return state.users.find((user) => userMatches(user, ref)) || null;
  }

  function findUserForApplicationView(app) {
    if (!app) return null;
    const direct = findUserByRef(app?.userId || app?.profileUserId || app?.raw?.userId);
    if (direct) return direct;
    const appId = String(app?.id || app?.raw?.id || "").trim().toLowerCase();
    const email = String(app?.email || app?.raw?.forms?.learner?.email || "").trim().toLowerCase();
    return state.users.find((user) => {
      if (appId && String(firstFilled(user?.latestApplicationId, user?.applicationId, user?.latest_application_id)).trim().toLowerCase() === appId) return true;
      if (email && String(user?.email || "").trim().toLowerCase() === email) return true;
      return false;
    }) || null;
  }

  function findAssistantByRef(ref) {
    return state.assistants.find((assistant) => userMatches(assistant, ref)) || null;
  }

  function extractInstitutionNames(app) {
    const rootSources = [
      app,
      app?.raw,
      app?.applicationPayload,
      app?.applicationPayload?.forms,
      app?.forms?.learner,
      app?.forms?.institution,
      app?.forms?.institutions,
      app?.forms?.application,
      app?.forms?.current,
      app?.forms?.specialisedApplication?.values,
      app?.application,
      app?.applicationEngine,
      app?.applicationEngine?.formData,
      app?.profile,
      app?.formDetails,
      app?.form_details
    ];
    const itemSources = [
      app?.items,
      app?.institutions,
      app?.selectedInstitutions,
      app?.selected_institutions,
      app?.applicationInstitutions,
      app?.application_institutions
    ];
    return uniqueTextList([
      ...rootSources.flatMap((source) => collectNamedValues(source, [
        "institutionName",
        "institution_name",
        "selectedInstitution",
        "selected_institution",
        "institutionChoice1",
        "institutionChoice2",
        "institution",
        "university",
        "college"
      ])),
      ...itemSources.flatMap((source) => collectNamedValues(source, [
        "institutionName",
        "institution_name",
        "selectedInstitution",
        "selected_institution",
        "institution",
        "university",
        "college",
        "name",
        "title"
      ]))
    ]);
  }

  function extractCourseNames(app) {
    const rootSources = [
      app,
      app?.raw,
      app?.applicationPayload,
      app?.applicationPayload?.forms,
      app?.forms?.institution,
      app?.forms?.institutions,
      app?.forms?.application,
      app?.forms?.current,
      app?.forms?.specialisedApplication?.values,
      app?.application,
      app?.applicationEngine,
      app?.applicationEngine?.formData,
      app?.formDetails,
      app?.form_details
    ];
    const itemSources = [
      app?.items,
      app?.institutions,
      app?.selectedCourses,
      app?.selected_courses,
      app?.courses,
      app?.applicationInstitutions,
      app?.application_institutions
    ];
    return uniqueTextList([
      ...rootSources.flatMap((source) => collectNamedValues(source, [
        "choice1",
        "choice2",
        "choice3",
        "choice_1",
        "choice_2",
        "choice_3",
        "courseName",
        "course_name",
        "course",
        "programme",
        "program",
        "programmeChoice",
        "selectedCourse",
        "selected_course"
      ])),
      ...itemSources.flatMap((source) => collectNamedValues(source, [
        "choice1",
        "choice2",
        "choice3",
        "choice_1",
        "choice_2",
        "choice_3",
        "courseName",
        "course_name",
        "course",
        "programme",
        "program",
        "selectedCourse",
        "selected_course",
        "name",
        "title"
      ]))
    ]);
  }

  function buildLearnerUserFromApplication(app) {
    const forms = mergedApplicationForms(app);
    const viewApp = { ...app, forms, items: firstNonEmptyArray(asArray(app?.items), asArray(app?.institutions), asArray(forms.institutions)) };
    const learnerForm = forms.learner || {};
    const schoolForm = forms.school || {};
    const institutionNames = extractInstitutionNames(viewApp);
    const courseNames = extractCourseNames(viewApp);
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
    const forms = mergedApplicationForms(app);
    const viewApp = { ...app, forms, items: firstNonEmptyArray(asArray(app?.items), asArray(app?.institutions), asArray(forms.institutions)) };
    const learnerForm = forms.learner || {};
    const schoolForm = forms.school || {};
    const profile = findUserByRef(app?.userId) || state.users.find((user) => String(user?.latestApplicationId || "").trim() === String(app?.id || "").trim()) || {};
    const category = normalizeCategory(app?.status);
    const institutionNames = [...new Set(
      extractInstitutionNames(viewApp)
        .concat(asTextList(firstFilled(profile?.selectedInstitution, profile?.selected_institution)))
        .concat(asTextList(profile?.selectedInstitutions))
        .concat(asTextList(profile?.selected_institutions))
        .filter(Boolean)
    )];
    const courseNames = [...new Set(
      extractCourseNames(viewApp)
        .concat(asTextList(profile?.selectedCourses))
        .concat(asTextList(profile?.selected_courses))
        .concat(asTextList(profile?.courses))
        .filter(Boolean)
    )];
    const assignedAssistant = findAssistantByRef(app?.assignedAssistantId || app?.assistantId);
    const statusInfo = assignmentLabel(app, category);
    const typeLabel = applicationTypeLabel(viewApp);
    const typeKey = normalizeApplicationTypeKey(app?.applicationType || forms.applicationType?.type || app?.applicationTypeLabel || forms.applicationType?.label || app?.applicationEngine?.type) || "undergraduate";
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
    const selectedPackage = app?.selectedPackage || app?.applicationPayload?.selectedPackage || app?.package || forms.packageSelection?.package || {};
    const selectedAddons = asArray(app?.selectedAddons || app?.applicationPayload?.selectedAddons || forms.packageSelection?.addons);
    const packageName = firstFilled(selectedPackage?.name, selectedPackage?.packName, "No package selected");
    const packagePrice = Number(app?.packagePrice ?? selectedPackage?.price ?? selectedPackage?.packPrice ?? 0);
    const addonsTotal = Number(app?.addonsTotal || 0);
    const finalTotal = Number(app?.finalTotal || packagePrice + addonsTotal);
    return {
      raw: app,
      id: app?.id,
      userId: firstFilled(profile?.supabaseUserId, profile?.id, app?.userId),
      profileUserId: firstFilled(profile?.supabaseUserId, profile?.id, app?.userId),
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
      applicationType: typeKey,
      applicationTypeLabel: typeLabel,
      programme: courseNames[0] || firstFilled(app?.programme, app?.program, "No programme selected"),
      packageName,
      packagePrice,
      selectedAddons,
      addonsTotal,
      finalTotal,
      paymentStatus: firstFilled(app?.paymentStatus, "Unpaid"),
      applicationReference: firstFilled(app?.applicationReference, app?.reference),
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
        typeLabel,
        typeKey,
        packageName,
        selectedAddons.map((addon) => firstFilled(addon?.name, addon?.code)).join(" "),
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
    const institutionNames = uniqueTextList([
      firstFilled(user?.selectedInstitution, user?.selected_institution),
      user?.selectedInstitutions,
      user?.selected_institutions
    ]);
    const courseNames = uniqueTextList([
      user?.selectedCourses,
      user?.selected_courses,
      user?.courses
    ]);
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

  function buildInlineRetry(message, action) {
    const ux = UX();
    if (ux?.buildInlineError) return ux.buildInlineError(message, "Retry", action);
    return `<div class="empty-state">${esc(message)}</div>`;
  }

  function renderDashboardLoadingState() {
    const ux = UX();
    $("masterHeroTitle").textContent = "Dashboard Overview";
    $("masterHeroText").textContent = "Loading your dashboard...";
    $("masterStats").innerHTML = ux?.skeletonStatCards?.(4) || "";
    $("masterDataCounts").innerHTML = ux?.skeletonList?.({ rows: 5 }) || "";
    $("masterAdminPanelGrid").innerHTML = ux?.skeletonList?.({ rows: 5, avatar: false, lines: 3, pill: false }) || "";
    if ($("masterQuickCounts")) $("masterQuickCounts").innerHTML = ux?.skeletonList?.({ rows: 5, lines: 2 }) || "";
    if ($("masterQuickActivity")) $("masterQuickActivity").innerHTML = ux?.skeletonList?.({ rows: 4, lines: 2 }) || "";
    if ($("masterQuickAlerts")) $("masterQuickAlerts").innerHTML = ux?.skeletonList?.({ rows: 4, lines: 2 }) || "";
    $("masterApplications").innerHTML = ux?.skeletonQueueRows?.({ rows: 4, columns: 7 }) || renderEmptyState("Loading applications...");
    $("masterQueueMeta").textContent = "Loading applications queue...";
    $("masterPagination").innerHTML = "";
    $("masterLearnerInspector").innerHTML = ux?.skeletonInspector?.() || '<div class="inspector-empty">Loading learner details...</div>';
    $("masterRecentLearners").innerHTML = ux?.skeletonList?.({ rows: 4 }) || "";
    $("masterAssistantRoster").innerHTML = ux?.skeletonList?.({ rows: 4 }) || "";
    const noticeList = $("masterNoticesList");
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

  function renderAdminPanels() {
    const container = $("masterAdminPanelGrid");
    if (!container) return;

    const career = state.adminContent.career || {};
    const housing = state.adminContent.housing || {};
    const careerRows = asArray(state.careerArticles);
    const institutionRows = asArray(state.institutions);
    const openInstitutions = institutionRows.filter((item) => item?.isActive !== false && item?.canApply !== false && String(item?.status || "").toLowerCase() !== "closed").length;
    const closedInstitutions = institutionRows.filter((item) => String(item?.status || "").toLowerCase() === "closed").length;
    const inactiveInstitutions = institutionRows.filter((item) => item?.isActive === false).length;
    const paperRows = asArray(state.questionPapers);
    const publishedPapers = paperRows.filter((item) => String(item?.status || "").toLowerCase() === "published").length;
    const draftPapers = paperRows.filter((item) => String(item?.status || "").toLowerCase() !== "published").length;
    const activeAnnouncements = asArray(state.announcements).filter((item) => item?.active || item?.status === "active").length;
    const scheduledAnnouncements = asArray(state.announcements).filter((item) => item?.scheduledFor && new Date(item.scheduledFor).getTime() > Date.now()).length;
    const housingRows = asArray(state.housingListings);
    const activeHousing = housingRows.filter((item) => item?.isActive !== false && String(item?.listingState || "").toLowerCase() === "published").length;
    const inactiveHousing = housingRows.filter((item) => item?.isActive === false || String(item?.listingState || "").toLowerCase() !== "published").length;
    const publishedCareer = careerRows.filter((item) => item?.status === "published").length;
    const draftCareer = careerRows.filter((item) => item?.status === "draft").length;
    const archivedCareer = careerRows.filter((item) => item?.status === "archived").length;
    const opportunityCareer = careerRows.filter((item) => ["job", "internship"].includes(String(item?.contentType || "").toLowerCase())).length;
    const housingStatus = String(housing?.settings?.serviceStatus || "open").replace(/_/g, " ");

    const controlError = (...keys) => keys.map((key) => state.controlErrors?.[key]).find(Boolean) || "";
    const panels = [
      {
        key: "career",
        icon: "CH",
        title: "Career Hub Admin",
        status: career?.status === "inactive" ? "Inactive" : "Active",
        statusTone: career?.status === "inactive" ? "draft" : "active",
        copy: career?.body || "Publish career guidance learners can trust from the Career Hub.",
        metric: `${careerRows.length} uploads`,
        stats: [`${publishedCareer} published`, `${opportunityCareer} opportunities`, `${draftCareer + archivedCareer} hidden`],
        button: "Manage Career Hub",
        secondary: "Add Career Upload",
        error: controlError("career", "careerArticles")
      },
      {
        key: "housing",
        icon: "HS",
        title: "Housing Admin",
        status: housing?.status === "inactive" ? "Inactive" : housingStatus,
        statusTone: housing?.status === "inactive" ? "draft" : "active",
        copy: housing?.body || "Control student accommodation pictures, copy, contacts, and visibility.",
        metric: `${housingRows.length} listings`,
        stats: [`${activeHousing} active`, `${inactiveHousing} inactive`],
        button: "Manage Housing",
        secondary: "Add Housing",
        error: controlError("housing", "housingListings")
      },
      {
        key: "institutions",
        icon: "IN",
        title: "Institutions Control",
        status: "Active",
        statusTone: "active",
        copy: "Enable, disable, open, or close institutions before learners submit applications.",
        metric: `${institutionRows.length} institutions`,
        stats: [`${openInstitutions} open`, `${closedInstitutions} closed`, `${inactiveInstitutions} inactive`],
        href: "../institutions.html",
        secondaryHref: "../institutions.html?create=1",
        button: "Manage Institutions",
        secondary: "Add Institution",
        error: controlError("institutions")
      },
      {
        key: "question-papers",
        icon: "QP",
        title: "Question Papers Admin",
        status: "Active",
        statusTone: "active",
        copy: "Upload, edit, publish, disable, and delete question papers and memos.",
        metric: `${paperRows.length} files`,
        stats: [`${publishedPapers} published`, `${draftPapers} draft or hidden`],
        href: "../question-papers.html",
        secondaryHref: "../question-papers.html?create=1",
        button: "Manage Papers",
        secondary: "Upload Paper",
        error: controlError("questionPapers")
      },
      {
        key: "announcements",
        icon: "AN",
        title: "Announcements Admin",
        status: "Active",
        statusTone: "active",
        copy: "Create dashboard notices for learners, assistants, everyone, or an institution group.",
        metric: `${asArray(state.announcements).length} total`,
        stats: [`${activeAnnouncements} active`, `${scheduledAnnouncements} scheduled`],
        button: "Manage Notices",
        secondary: "Create Notice",
        error: controlError("announcements")
      }
    ];

    container.innerHTML = panels.map((panel) => `
      <article class="admin-panel-tile">
        <div class="admin-panel-head">
          <div class="admin-panel-title">
            <span class="admin-panel-icon ${esc(panel.key)}">${esc(panel.icon)}</span>
            <div>
              <h3>${esc(panel.title)}</h3>
              <p>${esc(panel.metric)}</p>
            </div>
          </div>
          <span class="admin-panel-metric">${esc(panel.stats[0] || panel.metric)}</span>
        </div>
        <div class="admin-panel-status-row">
          <span class="admin-panel-status ${esc(panel.error ? "draft" : panel.statusTone)}">${esc(panel.error ? "Needs attention" : panel.status)}</span>
        </div>
        <p class="admin-panel-copy">${esc(panel.error || panel.copy)}</p>
        <div class="admin-panel-stats">${panel.stats.map((stat) => `<span class="admin-panel-stat">${esc(stat)}</span>`).join("")}</div>
        <div class="admin-panel-actions">
          ${panel.href
            ? `<a class="panel-link" href="${esc(panel.href)}">${esc(panel.button)}</a>`
            : `<button class="panel-link" type="button" data-panel-open="${esc(panel.key)}">${esc(panel.button)}</button>`}
          ${panel.secondaryHref
            ? `<a class="panel-link secondary" href="${esc(panel.secondaryHref)}">${esc(panel.secondary)}</a>`
            : `<button class="panel-link secondary" type="button" data-panel-create="${esc(panel.key)}">${esc(panel.secondary)}</button>`}
        </div>
      </article>
    `).join("");
  }

  function renderQuickOverview() {
    const counts = $("masterQuickCounts");
    const activity = $("masterQuickActivity");
    const alerts = $("masterQuickAlerts");
    if (!counts || !activity || !alerts) return;
    const learners = state.users.filter((user) => normalizeRole(user?.role) === "user").length;
    const platform = state.summary?.platform || {};
    const applications = platform.applications || {};
    const institutions = platform.institutions || {};
    const housing = platform.housing || {};
    const papers = platform.questionPapers || {};
    const announcements = platform.announcements || {};
    const quickCounts = [
      ["Total learners", state.summary?.totals?.users || learners, "Learner profiles"],
      ["Total applications", state.summary?.totals?.applications || state.applications.length, "Applications queue"],
      ["Pending applications", applications.pending ?? state.applications.map(buildApplicationView).filter((item) => item.category === "pending").length, "Needs review"],
      ["Reviewed applications", applications.reviewed ?? state.applications.map(buildApplicationView).filter((item) => item.category === "in_progress").length, "In review"],
      ["Approved applications", applications.approved ?? state.applications.filter((item) => /accept|approv/i.test(item?.status || "")).length, "Positive outcomes"],
      ["Rejected applications", applications.rejected ?? state.applications.filter((item) => /reject/i.test(item?.status || "")).length, "Final outcomes"],
      ["Open institutions", institutions.open ?? state.institutions.filter((item) => item?.canApply !== false && item?.isActive !== false).length, "Visible for new applications"],
      ["Closed institutions", institutions.closed ?? state.institutions.filter((item) => String(item?.status || "").toLowerCase() === "closed").length, "Not open for new applications"],
      ["Inactive institutions", institutions.inactive ?? state.institutions.filter((item) => item?.isActive === false).length, "Hidden from new applications"],
      ["Housing listings", housing.total ?? state.housingListings.length, `${housing.active ?? state.housingListings.filter((item) => item?.isActive !== false && item?.listingState === "published").length} active`],
      ["Published papers", papers.published ?? state.questionPapers.filter((item) => String(item?.status || "").toLowerCase() === "published").length, `${papers.total ?? state.questionPapers.length} total files`],
      ["Announcements", announcements.total ?? state.announcements.length, `${announcements.active ?? state.announcements.filter((item) => item?.active || item?.status === "active").length} active`],
      ["Assistant admins", state.summary?.totals?.assistants || state.assistants.length, "Support team"]
    ];
    counts.innerHTML = quickCounts.map(([label, value, note]) => `
      <article class="quick-count-item">
        <div><strong>${esc(label)}</strong><span>${esc(note)}</span></div>
        <div class="quick-count-value">${esc(String(value || 0))}</div>
      </article>
    `).join("");

    const activityRows = [
      ...asArray(state.applications).slice(0, 3).map((app) => ({
        title: firstFilled(app?.submittedAt) ? "Learner application submitted" : "Learner application updated",
        note: firstFilled(app?.applicant, app?.forms?.learner?.fullNames, shortApplicationId(app)),
        time: app?.updatedAt || app?.submittedAt || app?.createdAt
      })),
      ...asArray(state.housingListings).slice(0, 2).map((item) => ({
        title: "Housing listing updated",
        note: item.propertyName || "Accommodation listing",
        time: item.updatedAt
      })),
      ...asArray(state.announcements).slice(0, 2).map((item) => ({
        title: "Announcement created",
        note: item.title || "Notice",
        time: item.updatedAt || item.createdAt
      }))
    ].filter((item) => item.title).sort((left, right) => new Date(right.time || 0) - new Date(left.time || 0)).slice(0, 5);
    activity.innerHTML = activityRows.length ? activityRows.map((item) => `
      <article class="assistant-item">
        <div class="queue-avatar master">${esc(initialsFor(item.title, "KG"))}</div>
        <div class="item-copy"><div class="item-title">${esc(item.title)}</div><div class="item-subtitle">${esc(item.note || "Kagie activity")}</div></div>
        <span class="assistant-load">${esc(formatRelativeTime(item.time))}</span>
      </article>
    `).join("") : renderEmptyState("Recent admin and learner activity will appear here.");

    const closingSoon = state.institutions.filter((item) => item?.status === "closing_soon").length;
    const housingPending = state.housingListings.filter((item) => item?.listingState !== "published" || item?.isActive === false).length;
    const applicationPending = state.applications.map(buildApplicationView).filter((item) => item.category === "pending").length;
    const summaryErrors = asArray(state.summary?.sourceErrors);
    const controlErrors = Object.entries(state.controlErrors || {}).map(([source, message]) => ({ source, message }));
    const alertRows = [
      summaryErrors.length || controlErrors.length
        ? { title: "Admin data needs attention", note: `${summaryErrors.length + controlErrors.length} live source${summaryErrors.length + controlErrors.length === 1 ? "" : "s"} reported a loading issue. Retry after checking Supabase migration and RLS status.`, tone: "Data" }
        : { title: "All systems operational", note: "Admin content and queue data loaded.", tone: "OK" },
      ...summaryErrors.slice(0, 2).map((item) => ({ title: `${item.source || "Summary"} unavailable`, note: item.message || "The live data source could not be loaded.", tone: "Data" })),
      ...controlErrors.slice(0, 2).map((item) => ({ title: `${item.source} panel unavailable`, note: item.message || "The admin panel data could not be loaded.", tone: "Data" })),
      closingSoon ? { title: "Institutions closing soon", note: `${closingSoon} catalog record${closingSoon === 1 ? "" : "s"} need deadline attention.`, tone: "Soon" } : null,
      housingPending ? { title: "Housing pending activation", note: `${housingPending} listing${housingPending === 1 ? "" : "s"} are draft, archived, or inactive.`, tone: "Review" } : null,
      applicationPending ? { title: "Applications pending review", note: `${applicationPending} learner record${applicationPending === 1 ? "" : "s"} are waiting in the queue.`, tone: "Queue" } : null
    ].filter(Boolean);
    alerts.innerHTML = alertRows.map((item) => `
      <article class="assistant-item">
        <div class="queue-avatar master">${esc(item.tone)}</div>
        <div class="item-copy"><div class="item-title">${esc(item.title)}</div><div class="item-subtitle">${esc(item.note)}</div></div>
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
        <div class="queue-cell" data-label="Application Type">
          <div class="queue-user-name">${esc(app.applicationTypeLabel || "Undergraduate Applications")}</div>
          <div class="queue-user-meta">${esc(app.packageName)} | ${esc(`R${Number(app.finalTotal || 0).toLocaleString("en-ZA")}`)}</div>
          <div class="queue-user-meta">${esc(app.email || "Email pending")}</div>
        </div>
        <div class="queue-cell" data-label="Institution">
          <div class="queue-user-name">${esc(app.institution)}</div>
        </div>
        <div class="queue-cell" data-label="Programme">
          <div class="queue-user-name">${esc(app.programme || app.courseNames[0] || "No programme selected")}</div>
          <div class="queue-user-meta">${esc(app.courseNames.length > 1 ? `${app.courseNames.length} choices` : "")}</div>
        </div>
        <div class="queue-cell" data-label="Date Submitted">
          <div class="queue-user-name">${esc(formatDate(app.createdAt))}</div>
        </div>
        <div class="queue-cell" data-label="Status">
          <span class="status-pill ${esc(app.statusKey)}">${esc(app.statusLabel)}</span>
          <div class="queue-user-meta">${esc(app.paymentStatus || "Unpaid")}</div>
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
    const user = findUserForApplicationView(app);
    return firstFilled(user?.supabaseUserId, user?.id, app?.profileUserId, app?.userId, app?.raw?.userId, app?.raw?.id, app?.email);
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
    const contact = detail?.contactDetails || {};
    const guardian = detail?.guardianInfo || {};
    const school = detail?.schoolInfo || {};
    const liveInstitutions = asArray(detail?.selectedInstitutions);
    const liveCourses = asArray(detail?.selectedCourses);
    const liveDocs = asArray(detail?.uploadedDocuments);
    const livePayments = asArray(detail?.paymentRecords);
    const institutionsMarkup = liveInstitutions.length
      ? `<ul class="detail-bullets">${liveInstitutions.map((institution) => `<li>${esc(firstFilled(institution?.institution_name, institution?.institutionName, institution?.name, "Institution"))}${firstFilled(institution?.faculty) ? ` - ${esc(institution.faculty)}` : ""}${uniqueTextList([institution?.choice_1, institution?.choice_2, institution?.choice_3]).length ? ` - ${esc(uniqueTextList([institution?.choice_1, institution?.choice_2, institution?.choice_3]).join(", "))}` : ""}</li>`).join("")}</ul>`
      : (app.institutionNames.length
        ? `<ul class="detail-bullets">${app.institutionNames.map((institution) => `<li>${esc(institution)}</li>`).join("")}</ul>`
        : `<div class="detail-value">No institution selected.</div>`);
    const coursesMarkup = liveCourses.length
      ? `<ul class="detail-bullets">${liveCourses.map((course) => `<li>${esc(firstFilled(course?.course_name, course?.courseName, course?.choice_1, course?.choice1, course?.name, course))}</li>`).join("")}</ul>`
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
        <div class="detail-item"><span class="detail-label">Surname</span><span class="detail-value">${esc(firstFilled(personal?.surname, detail?.surname, app.surname, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Date of birth</span><span class="detail-value">${esc(firstFilled(personal?.dateOfBirth, app.dob, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">ID Number</span><span class="detail-value">${esc(firstFilled(personal?.idNumber, app.idNumber, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">School</span><span class="detail-value">${esc(firstFilled(school?.school_name, school?.name, app.schoolName, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Grade / completion year</span><span class="detail-value">${esc(firstFilled(school?.completion_year, app.grade, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Province</span><span class="detail-value">${esc(firstFilled(personal?.province, contact?.province, app.province, "Not provided"))}</span></div>
        <div class="detail-item"><span class="detail-label">Application type</span><span class="detail-value">${esc(app.applicationTypeLabel || "Undergraduate Applications")}</span></div>
        <div class="detail-item"><span class="detail-label">Application reference</span><span class="detail-value">${esc(app.applicationReference || app.applicationId)}</span></div>
        <div class="detail-item"><span class="detail-label">Selected package</span><span class="detail-value">${esc(app.packageName)}</span></div>
        <div class="detail-item"><span class="detail-label">Package price</span><span class="detail-value">${esc(`R${Number(app.packagePrice || 0).toLocaleString("en-ZA")}`)}</span></div>
        <div class="detail-item"><span class="detail-label">Selected add-ons</span><span class="detail-value">${esc(app.selectedAddons.length ? app.selectedAddons.map((addon) => firstFilled(addon?.name, addon?.code)).join(", ") : "None")}</span></div>
        <div class="detail-item"><span class="detail-label">Final total</span><span class="detail-value">${esc(`R${Number(app.finalTotal || 0).toLocaleString("en-ZA")}`)}</span></div>
        <div class="detail-item"><span class="detail-label">Payment status</span><span class="detail-value">${esc(app.paymentStatus)}</span></div>
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

  function getAssistantById(assistantId) {
    return state.assistants.find((assistant) => userMatches(assistant, assistantId)) || null;
  }

  function getAssistantPermissionRows(assistantId) {
    const assistant = getAssistantById(assistantId) || { id: assistantId };
    const keys = userIdentityKeys(assistant).concat(String(assistantId || "").trim().toLowerCase()).filter(Boolean);
    for (const key of keys) {
      const rows = state.assistantPermissions.get(key);
      if (rows?.length) return rows;
    }
    return asArray(state.formTypes).map((type) => ({
      assistantAdminId: assistant?.id || assistantId,
      formType: type.formType || type.key || "",
      label: type.label || type.name || type.formType || "Application form",
      enabled: true
    })).filter((item) => item.formType);
  }

  function cacheAssistantPermissionRows(assistantId, rows) {
    const assistant = getAssistantById(assistantId) || { id: assistantId };
    const normalized = asArray(rows);
    userIdentityKeys(assistant)
      .concat(String(assistantId || "").trim().toLowerCase())
      .filter(Boolean)
      .forEach((key) => state.assistantPermissions.set(key, normalized));
  }

  async function loadAssistantPermissions(api) {
    const fallbackTypes = [
      { formType: "undergraduate", label: "Undergraduate Applications" },
      { formType: "bridging", label: "Bridging Programmes" },
      { formType: "transfer", label: "Transfer Applications" },
      { formType: "postgraduate", label: "Postgraduate Applications" },
      { formType: "late", label: "Late Applications" }
    ];
    state.formTypes = api?.getApplicationFormTypesAsync
      ? await api.getApplicationFormTypesAsync().catch(() => fallbackTypes)
      : (api?.getApplicationFormTypes?.() || fallbackTypes);
    state.assistantPermissions = new Map();
    await Promise.all(asArray(state.assistants).map(async (assistant) => {
      const assistantId = assistant?.id || assistant?.supabaseUserId || assistant?.email;
      if (!assistantId) return;
      const rows = api?.getAssistantFormPermissionsAsync
        ? await api.getAssistantFormPermissionsAsync(assistantId).catch(() => [])
        : (api?.getAssistantFormPermissions?.(assistantId) || []);
      cacheAssistantPermissionRows(assistantId, rows.length ? rows : state.formTypes.map((type) => ({
        assistantAdminId: assistantId,
        formType: type.formType,
        label: type.label,
        enabled: true
      })));
    }));
  }

  function renderAssistantPermissionList() {
    const assistant = getAssistantById(state.selectedAssistantId);
    const rows = getAssistantPermissionRows(state.selectedAssistantId);
    const byType = new Map(rows.map((row) => [String(row.formType || "").trim(), row]));
    const list = $("masterPermissionList");
    if (!list) return;
    $("masterPermissionAssistantName").textContent = assistant
      ? `Choose which application forms ${firstFilled(assistant.fullName, assistant.name, assistant.email, "this assistant")} may view and process.`
      : "Choose which application forms this assistant admin may view and process.";
    list.innerHTML = state.formTypes.length ? state.formTypes.map((type) => {
      const current = byType.get(type.formType) || {};
      return `
        <label class="assistant-item" style="align-items:center;cursor:pointer">
          <input type="checkbox" data-permission-form="${esc(type.formType)}" ${current.enabled !== false ? "checked" : ""} style="width:18px;height:18px;flex:0 0 auto" />
          <div class="item-copy">
            <div class="item-title">${esc(type.label || type.formType)}</div>
            <div class="item-subtitle">Assistant can view, update, and support this application form type.</div>
          </div>
          <span class="status-pill ${current.enabled !== false ? "assigned" : "pending"}">${esc(current.enabled !== false ? "Allowed" : "Blocked")}</span>
        </label>
      `;
    }).join("") : renderEmptyState("Application form types are unavailable right now.");
  }

  async function openAssistantPermissionsModal(api, assistantId) {
    const assistant = getAssistantById(assistantId);
    if (!assistant) return;
    state.selectedAssistantId = assistant.id || assistant.supabaseUserId || assistant.email || assistantId;
    setPanelMessage("masterPermissionMsg", "", "");
    renderAssistantPermissionList();
    openModal("masterAssistantPermissionsModal");
    if (!getAssistantPermissionRows(state.selectedAssistantId).length && api?.getAssistantFormPermissionsAsync) {
      setPanelMessage("masterPermissionMsg", "Loading form access...", "info");
      const rows = await api.getAssistantFormPermissionsAsync(state.selectedAssistantId).catch(() => []);
      cacheAssistantPermissionRows(state.selectedAssistantId, rows);
      setPanelMessage("masterPermissionMsg", "", "");
      renderAssistantPermissionList();
    }
  }

  function renderAssistantRoster() {
    const appViews = state.applications.map(buildApplicationView);
    const items = state.assistants.slice().sort((left, right) =>
      firstFilled(left?.fullName, left?.name, left?.email).localeCompare(firstFilled(right?.fullName, right?.name, right?.email), "en-ZA")
    );

    $("masterAssistantRoster").innerHTML = items.length ? items.map((assistant) => {
      const assignmentCount = appViews.filter((app) => userMatches(assistant, app.assignedAssistantId)).length;
      const permissions = getAssistantPermissionRows(assistant.id || assistant.supabaseUserId || assistant.email);
      const enabledCount = permissions.filter((item) => item.enabled !== false).length;
      const totalCount = state.formTypes.length || permissions.length || 0;
      return `
        <article class="assistant-item">
          <div class="queue-avatar assistant">${esc(initialsFor(firstFilled(assistant?.fullName, assistant?.name, "Assistant"), "AA"))}</div>
          <div class="item-copy">
            <div class="item-title">${esc(firstFilled(assistant?.fullName, assistant?.name, "Assistant Admin"))}</div>
            <div class="item-subtitle">${esc(firstFilled(assistant?.email, "No email saved"))}</div>
            <div class="item-subtitle">${esc(totalCount ? `${enabledCount}/${totalCount} form types enabled` : "Form access not loaded yet")}</div>
          </div>
          <span class="assistant-load">${esc(String(assignmentCount))}</span>
          <span class="status-pill assigned">${esc(assignmentCount ? "Assigned" : "Available")}</span>
          <button class="panel-link" type="button" data-assistant-permissions="${esc(assistant.id || assistant.supabaseUserId || assistant.email)}">Form access</button>
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
    renderAdminPanels();
    renderQuickOverview();
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

  async function loadAdminControlData(api) {
    state.controlErrors = {};
    const loadControlValue = async (key, task, fallback) => {
      try {
        return await task();
      } catch (error) {
        state.controlErrors[key] = error?.message || `Failed to load ${key}.`;
        return fallback;
      }
    };
    const [
      career,
      housing,
      careerArticles,
      institutions,
      questionPapers,
      announcements,
      housingListings
    ] = await Promise.all([
      loadControlValue("career", () => {
        if (!api.getAdminContentAsync) throw new Error("Career Hub settings API is unavailable.");
        return api.getAdminContentAsync("career_hub");
      }, null),
      loadControlValue("housing", () => {
        if (!api.getAdminContentAsync) throw new Error("Housing settings API is unavailable.");
        return api.getAdminContentAsync("housing_hub");
      }, null),
      loadControlValue("careerArticles", () => {
        if (!api.getCareerArticlesForAdminAsync) throw new Error("Career article API is unavailable.");
        return api.getCareerArticlesForAdminAsync();
      }, []),
      loadControlValue("institutions", () => {
        if (!api.getInstitutionsForAdminAsync) throw new Error("Institution control API is unavailable.");
        return api.getInstitutionsForAdminAsync({ includeInactive: true });
      }, []),
      loadControlValue("questionPapers", () => {
        if (!api.getQuestionPapersForAdminAsync) throw new Error("Question paper API is unavailable.");
        return api.getQuestionPapersForAdminAsync({ includeAllStatuses: true });
      }, []),
      loadControlValue("announcements", () => {
        if (!api.getAnnouncementsForAdminAsync) throw new Error("Announcement API is unavailable.");
        return api.getAnnouncementsForAdminAsync();
      }, []),
      loadControlValue("housingListings", () => {
        if (api.getAccommodationListingsForAdminAsync) return api.getAccommodationListingsForAdminAsync({ includeDrafts: true });
        if (api.getAccommodationListingsForAdmin) return Promise.resolve(api.getAccommodationListingsForAdmin());
        throw new Error("Housing listing API is unavailable.");
      }, [])
    ]);

    state.adminContent.career = career;
    state.adminContent.housing = housing;
    state.careerArticles = asArray(careerArticles);
    state.institutions = asArray(institutions);
    state.questionPapers = asArray(questionPapers);
    state.announcements = asArray(announcements);
    state.housingListings = asArray(housingListings);
  }

  function setPanelMessage(id, text, tone) {
    const node = $(id);
    if (!node) return;
    node.textContent = text || "";
    node.className = tone ? `status-message ${tone}` : "status-message";
  }

  function populateCareerForm() {
    const career = state.adminContent.career || {};
    $("masterCareerTitle").value = career.title || "Career Hub Admin";
    $("masterCareerFeaturedTopic").value = career.settings?.featuredTopic || "";
    $("masterCareerBody").value = career.body || "";
    $("masterCareerStatus").value = career.status || "active";
    if ($("masterCareerCvFree")) $("masterCareerCvFree").checked = career.settings?.cvRevampFree !== false;
    setPanelMessage("masterCareerAdminMsg", "", "");
  }

  function populateHousingForm() {
    const housing = state.adminContent.housing || {};
    $("masterHousingTitle").value = housing.title || "Housing Admin";
    $("masterHousingServiceStatus").value = housing.settings?.serviceStatus || "open";
    $("masterHousingSupportPhone").value = housing.settings?.supportPhone || "";
    $("masterHousingBody").value = housing.body || "";
    $("masterHousingStatus").value = housing.status || "active";
    setPanelMessage("masterHousingAdminMsg", "", "");
  }

  function setFieldValue(id, value) {
    const field = $(id);
    if (field) field.value = value || "";
  }

  function listToFieldValue(value) {
    return asArray(value).filter(Boolean).join("\n");
  }

  function fieldValueToList(value) {
    return String(value || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function careerUploadTypeLabel(type) {
    const normalized = String(type || "").toLowerCase();
    if (normalized === "job") return "Job";
    if (normalized === "internship") return "Internship";
    if (normalized === "resource") return "Resource";
    return "Article";
  }

  function resetCareerArticleForm() {
    [
      "masterCareerArticleId",
      "masterCareerArticleTitle",
      "masterCareerArticleCompany",
      "masterCareerArticleLocation",
      "masterCareerArticleEmploymentType",
      "masterCareerArticleCategory",
      "masterCareerArticleLevel",
      "masterCareerArticleClosingDate",
      "masterCareerArticleStartDate",
      "masterCareerArticleDuration",
      "masterCareerArticleSummary",
      "masterCareerArticleBody",
      "masterCareerArticleTags",
      "masterCareerArticleApplicationUrl",
      "masterCareerArticleRequirements",
      "masterCareerArticleImage",
      "masterCareerArticleFile"
    ].forEach((id) => setFieldValue(id, ""));
    setFieldValue("masterCareerArticleType", "article");
    setFieldValue("masterCareerArticleWorkMode", "");
    if ($("masterCareerArticleImageUpload")) $("masterCareerArticleImageUpload").value = "";
    if ($("masterCareerArticleFileUpload")) $("masterCareerArticleFileUpload").value = "";
    $("masterCareerArticleStatus").value = "draft";
    setPanelMessage("masterCareerArticleMsg", "Publish articles, resources, jobs, and internships to the learner Career Hub.", "info");
  }

  function populateCareerArticleForm(article) {
    setFieldValue("masterCareerArticleId", article?.id || "");
    setFieldValue("masterCareerArticleType", article?.contentType || "article");
    setFieldValue("masterCareerArticleTitle", article?.title || "");
    setFieldValue("masterCareerArticleCompany", article?.company || "");
    setFieldValue("masterCareerArticleLocation", article?.location || "");
    setFieldValue("masterCareerArticleWorkMode", article?.workMode || "");
    setFieldValue("masterCareerArticleEmploymentType", article?.employmentType || "");
    setFieldValue("masterCareerArticleCategory", article?.category || "");
    setFieldValue("masterCareerArticleLevel", article?.level || "");
    setFieldValue("masterCareerArticleClosingDate", article?.closingDate || "");
    setFieldValue("masterCareerArticleStartDate", article?.startDate || "");
    setFieldValue("masterCareerArticleDuration", article?.duration || "");
    setFieldValue("masterCareerArticleSummary", article?.summary || "");
    setFieldValue("masterCareerArticleBody", article?.body || "");
    setFieldValue("masterCareerArticleTags", listToFieldValue(article?.tags));
    setFieldValue("masterCareerArticleApplicationUrl", article?.applicationUrl || "");
    setFieldValue("masterCareerArticleRequirements", listToFieldValue(article?.requirements));
    setFieldValue("masterCareerArticleImage", article?.imageUrl || "");
    setFieldValue("masterCareerArticleFile", article?.fileUrl || "");
    if ($("masterCareerArticleImageUpload")) $("masterCareerArticleImageUpload").value = "";
    if ($("masterCareerArticleFileUpload")) $("masterCareerArticleFileUpload").value = "";
    $("masterCareerArticleStatus").value = article?.status || "draft";
    setPanelMessage("masterCareerArticleMsg", "Edit, publish, archive, or keep this upload as a draft.", "info");
  }

  function renderCareerArticleList() {
    const container = $("masterCareerArticleList");
    if (!container) return;
    const rows = asArray(state.careerArticles);
    container.innerHTML = rows.length ? rows.map((article) => `
      <article class="notice-item">
        <div class="activity-icon">${esc(initialsFor(article.title, "CH"))}</div>
        <div class="item-copy">
          <div class="item-title">${esc(article.title || "Career upload")}</div>
          <div class="item-subtitle">${esc(`${careerUploadTypeLabel(article.contentType)} - ${article.status || "draft"} - ${article.company || article.summary || "No summary provided"}`)}</div>
        </div>
        <div class="admin-list-actions">
          <button class="table-action" type="button" data-edit-career-article="${esc(article.id)}">Edit</button>
          <button class="table-action" type="button" data-toggle-career-article="${esc(article.id)}">${article.status === "published" ? "Unpublish" : "Publish"}</button>
          <button class="table-action danger" type="button" data-delete-career-article="${esc(article.id)}">Delete</button>
        </div>
      </article>
    `).join("") : renderEmptyState("No Career Hub articles yet. Create a draft or publish the first learner guide.");
  }

  function resetHousingListingForm() {
    [
      "masterHousingListingId",
      "masterHousingListingTitle",
      "masterHousingListingInstitution",
      "masterHousingListingProvince",
      "masterHousingListingCity",
      "masterHousingListingPrice",
      "masterHousingListingPriceRange",
      "masterHousingListingAvailability",
      "masterHousingListingLocation",
      "masterHousingListingShort",
      "masterHousingListingDescription",
      "masterHousingListingPhone",
      "masterHousingListingEmail"
    ].forEach((id) => { if ($(id)) $(id).value = ""; });
    $("masterHousingListingRoom").value = "Single room";
    $("masterHousingListingState").value = "draft";
    $("masterHousingListingImages").value = "";
    setPanelMessage("masterHousingListingMsg", "Active published listings appear to learners. Drafts and archived listings stay hidden.", "info");
  }

  function populateHousingListingForm(listing) {
    $("masterHousingListingId").value = listing?.id || "";
    $("masterHousingListingTitle").value = listing?.propertyName || "";
    $("masterHousingListingInstitution").value = listing?.institutionName || "";
    $("masterHousingListingProvince").value = listing?.province || "";
    $("masterHousingListingCity").value = listing?.city || "";
    $("masterHousingListingRoom").value = listing?.roomType || "Single room";
    $("masterHousingListingPrice").value = Number(listing?.price || 0) || "";
    $("masterHousingListingPriceRange").value = listing?.priceRange || "";
    $("masterHousingListingAvailability").value = listing?.availabilityStatus || "Available";
    $("masterHousingListingLocation").value = firstFilled(listing?.address, listing?.location);
    $("masterHousingListingShort").value = listing?.shortDescription || "";
    $("masterHousingListingDescription").value = listing?.description || listing?.propertyDetails || "";
    $("masterHousingListingPhone").value = listing?.contactPhone || "";
    $("masterHousingListingEmail").value = listing?.contactEmail || "";
    $("masterHousingListingState").value = listing?.listingState || (listing?.isActive === false ? "draft" : "published");
    $("masterHousingListingImages").value = "";
    setPanelMessage("masterHousingListingMsg", `${asArray(listing?.images).length} current picture${asArray(listing?.images).length === 1 ? "" : "s"} linked. Add files to append fresh pictures.`, "info");
  }

  function renderHousingListingList() {
    const container = $("masterHousingListingList");
    if (!container) return;
    const rows = asArray(state.housingListings);
    container.innerHTML = rows.length ? rows.map((listing) => `
      <article class="notice-item">
        ${asArray(listing.images)[0]
          ? `<img class="admin-list-preview" src="${esc(listing.images[0])}" alt="" />`
          : `<div class="activity-icon">${esc(initialsFor(listing.propertyName, "HS"))}</div>`}
        <div class="item-copy">
          <div class="item-title">${esc(listing.propertyName || "Housing listing")}</div>
          <div class="item-subtitle">${esc(`${listing.listingState || "draft"} - ${listing.city || listing.location || "Location pending"} - ${listing.priceRange || (listing.price ? `R${listing.price}` : "Price pending")}`)}</div>
        </div>
        <div class="admin-list-actions">
          <button class="table-action" type="button" data-edit-housing="${esc(listing.id)}">Edit</button>
          <button class="table-action" type="button" data-toggle-housing="${esc(listing.id)}">${listing.listingState === "published" && listing.isActive !== false ? "Deactivate" : "Activate"}</button>
          <button class="table-action danger" type="button" data-delete-housing="${esc(listing.id)}">Delete</button>
        </div>
      </article>
    `).join("") : renderEmptyState("No housing listings yet. Add a listing with pictures, location, and availability.");
  }

  function resetAnnouncementForm() {
    $("masterAnnouncementId").value = "";
    $("masterAnnouncementTitle").value = "";
    $("masterAnnouncementAudience").value = "learners";
    $("masterAnnouncementInstitution").value = "";
    $("masterAnnouncementStatus").value = "active";
    $("masterAnnouncementPriority").value = "normal";
    $("masterAnnouncementSchedule").value = "";
    $("masterAnnouncementMessage").value = "";
    setPanelMessage("masterAnnouncementAdminMsg", "", "");
  }

  function populateAnnouncementForm(announcement) {
    $("masterAnnouncementId").value = announcement?.id || "";
    $("masterAnnouncementTitle").value = announcement?.title || "";
    $("masterAnnouncementAudience").value = announcement?.audience || "learners";
    $("masterAnnouncementInstitution").value = announcement?.institutionName || "";
    $("masterAnnouncementStatus").value = announcement?.status || (announcement?.active === false ? "inactive" : "active");
    $("masterAnnouncementPriority").value = announcement?.priority || "normal";
    $("masterAnnouncementSchedule").value = announcement?.scheduledFor ? String(announcement.scheduledFor).slice(0, 16) : "";
    $("masterAnnouncementMessage").value = announcement?.message || "";
    setPanelMessage("masterAnnouncementAdminMsg", "", "");
  }

  function renderAnnouncementList() {
    const container = $("masterAnnouncementList");
    if (!container) return;
    const items = asArray(state.announcements);
    container.innerHTML = items.length ? items.map((item) => `
      <article class="notice-item">
        <div class="activity-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="item-copy">
          <div class="item-title">${esc(item.title || "Announcement")}</div>
          <div class="item-subtitle">${esc(`${item.audience || "learners"} - ${item.status || "active"} - ${item.message || ""}`)}</div>
        </div>
        <div class="admin-list-actions">
          <button class="table-action" type="button" data-edit-announcement="${esc(item.id)}">Edit</button>
          <button class="table-action" type="button" data-toggle-announcement="${esc(item.id)}">${item.active || item.status === "active" ? "Pause" : "Activate"}</button>
          <button class="table-action danger" type="button" data-delete-announcement="${esc(item.id)}">Delete</button>
        </div>
      </article>
    `).join("") : renderEmptyState("No announcements have been created yet.");
  }

  function openAdminPanel(panel) {
    if (panel === "career") {
      populateCareerForm();
      resetCareerArticleForm();
      renderCareerArticleList();
      openModal("masterCareerAdminModal");
      return;
    }
    if (panel === "housing") {
      populateHousingForm();
      resetHousingListingForm();
      renderHousingListingList();
      openModal("masterHousingAdminModal");
      return;
    }
    if (panel === "announcements") {
      resetAnnouncementForm();
      renderAnnouncementList();
      openModal("masterAnnouncementAdminModal");
      return;
    }
    if (panel === "question-papers") {
      window.location.href = "../question-papers.html";
      return;
    }
    if (panel === "institutions") {
      window.location.href = "../institutions.html";
    }
  }

  async function refreshDashboard(api) {
    renderDashboardLoadingState();
    bootScreen?.update?.("Kagie", "Loading your dashboard...");

    const summaryTask = (api.getAdminSummaryAsync ? api.getAdminSummaryAsync() : Promise.resolve(null))
      .catch((error) => ({
        totals: null,
        platform: null,
        sourceErrors: [{
          source: "platform summary",
          message: error?.message || "Failed to load platform overview counts."
        }]
      }));
    const coreTask = Promise.all([
      api.getAllApplicationsForAdminAsync()
        .then((items) => asArray(items))
        .catch((error) => {
          throw new Error(error?.message || "Failed to load applications.");
        }),
      (api.getAdminUserDirectoryAsync ? api.getAdminUserDirectoryAsync() : api.getAllUsersAsync())
        .then((items) => asArray(items))
        .catch(() => [])
    ]);
    const noticesTask = api.getNotificationsAsync(state.user.id)
      .then((items) => asArray(items))
      .catch((error) => {
        throw new Error(error?.message || "Failed to load notices.");
      });
    const adminPanelsTask = loadAdminControlData(api);

    const summary = await summaryTask;
    state.summary = summary || null;
    updateHero();
    renderStats();
    renderDataCounts();

    try {
      const [applications, adminDirectoryUsers] = await coreTask;
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
      await loadAssistantPermissions(api).catch((error) => {
        console.warn("Assistant form permissions are unavailable:", error);
      });
      state.detailCache.clear();
      state.pendingDetailKey = "";
      renderStats();
      renderDataCounts();
      renderQueue();
      renderInspector();
      renderRecentLearners();
      renderAssistantRoster();
      renderQuickOverview();
      updateHero();
      updateFilterButton();
      bootScreen?.hide?.();
      bootScreen = null;
    } catch (error) {
      const message = error?.message || "We could not load the learner queue right now.";
      $("masterApplications").innerHTML = buildInlineRetry(message, "refresh-dashboard");
      $("masterQueueMeta").textContent = "Applications queue unavailable.";
      $("masterLearnerInspector").innerHTML = `<div class="inspector-empty">${esc(message)}</div>`;
      $("masterRecentLearners").innerHTML = renderEmptyState("Learner snapshot unavailable.");
      $("masterAssistantRoster").innerHTML = renderEmptyState("Assistant roster unavailable.");
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
        const noticeList = $("masterNoticesList");
        $("masterNoticeCount").textContent = "0";
        $("masterMessagesCount").textContent = "0";
        if (noticeList) noticeList.innerHTML = buildInlineRetry(error?.message || "Failed to load notices.", "refresh-notices");
      });

    adminPanelsTask
      .then(() => {
        renderAdminPanels();
        renderAnnouncementList();
        renderCareerArticleList();
        renderHousingListingList();
        renderQuickOverview();
      })
      .catch((error) => {
        console.warn("Master admin control panels loaded in fallback mode:", error);
        $("masterAdminPanelGrid").innerHTML = buildInlineRetry(error?.message || "Failed to load admin panels.", "refresh-admin-panels");
      });

    await Promise.allSettled([noticesTask, adminPanelsTask]);
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

    document.addEventListener("click", (event) => {
      const opener = event.target.closest("[data-panel-open]");
      const creator = event.target.closest("[data-panel-create]");
      if (!opener && !creator) return;
      event.preventDefault();
      const panel = opener?.getAttribute("data-panel-open") || creator?.getAttribute("data-panel-create");
      openAdminPanel(panel);
      if (creator && panel === "career") resetCareerArticleForm();
      if (creator && panel === "housing") resetHousingListingForm();
      if (creator && panel === "announcements") resetAnnouncementForm();
      document.body.classList.remove("sidebar-open");
      $("masterOverlay").classList.remove("open");
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

    ["masterNoticesModal", "masterAssignModal", "masterDocsModal", "masterCareerAdminModal", "masterHousingAdminModal", "masterAnnouncementAdminModal", "masterCreateAssistantModal", "masterAssistantPermissionsModal"].forEach((id) => {
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
    const debouncedSearch = UX()?.debounce
      ? UX().debounce(() => {
        state.page = 1;
        syncSelectedApplication();
        renderAll();
      }, 180)
      : () => {
        if (searchTimer) window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          searchTimer = 0;
          state.page = 1;
          syncSelectedApplication();
          renderAll();
        }, 140);
      };
    $("masterSearchInput").addEventListener("input", debouncedSearch);

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

    $("masterLogoutLink").addEventListener("click", async (event) => {
      await runButtonAction(event.currentTarget, "master-logout", "Signing out...", async () => {
        await api.logout().catch(() => {});
        window.location.href = "../login.html";
      });
    });

    document.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-kagie-retry]");
      if (!retryButton) return;
      const action = retryButton.getAttribute("data-kagie-retry");
      if (action === "refresh-dashboard") {
        void runButtonAction(retryButton, "master-retry-dashboard", "Retrying...", async () => {
          await refreshDashboard(api);
        });
        return;
      }
      if (action === "refresh-notices") {
        void runButtonAction(retryButton, "master-retry-notices", "Retrying...", async () => {
          state.notices = [];
          renderNotices();
          const notices = await api.getNotificationsAsync(state.user.id).catch((error) => {
            throw new Error(error?.message || "Failed to load notices.");
          });
          state.notices = asArray(notices).sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0));
          renderNotices();
        });
        return;
      }
      if (action === "refresh-admin-panels") {
        void runButtonAction(retryButton, "master-retry-panels", "Retrying...", async () => {
          $("masterAdminPanelGrid").innerHTML = UX()?.skeletonList?.({ rows: 4, avatar: false, lines: 3, pill: false }) || renderEmptyState("Loading admin panels...");
          await loadAdminControlData(api);
          renderAdminPanels();
          renderAnnouncementList();
        });
      }
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

    $("masterAssignForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
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
    }));

    $("masterAssistantRoster").addEventListener("click", async (event) => {
      const permissionButton = event.target.closest("[data-assistant-permissions]");
      if (!permissionButton) return;
      await runButtonAction(permissionButton, `assistant-permissions:${permissionButton.getAttribute("data-assistant-permissions")}`, "Opening...", async () => {
        await openAssistantPermissionsModal(api, permissionButton.getAttribute("data-assistant-permissions"));
      });
    });

    $("masterAssistantPermissionsForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
      const assistant = getAssistantById(state.selectedAssistantId);
      const assistantId = assistant?.id || assistant?.supabaseUserId || assistant?.email || state.selectedAssistantId;
      if (!assistantId) {
        setPanelMessage("masterPermissionMsg", "Choose an assistant admin first.", "err");
        return;
      }
      const permissions = state.formTypes.map((type) => {
        const safeFormType = window.CSS?.escape ? CSS.escape(type.formType) : String(type.formType || "").replace(/"/g, '\\"');
        const box = document.querySelector(`[data-permission-form="${safeFormType}"]`);
        return {
          assistantAdminId: assistantId,
          formType: type.formType,
          label: type.label,
          enabled: Boolean(box?.checked)
        };
      });
      if (!permissions.some((item) => item.enabled)) {
        setPanelMessage("masterPermissionMsg", "Allow at least one form type for this assistant.", "err");
        return;
      }
      setPanelMessage("masterPermissionMsg", "Saving form access...", "info");
      try {
        const saved = api.saveAssistantFormPermissionsAsync
          ? await api.saveAssistantFormPermissionsAsync(assistantId, permissions)
          : api.saveAssistantFormPermissions(assistantId, permissions);
        cacheAssistantPermissionRows(assistantId, saved);
        renderAssistantRoster();
        setPanelMessage("masterPermissionMsg", "Assistant form access saved.", "ok");
        closeModal("masterAssistantPermissionsModal");
      } catch (error) {
        setPanelMessage("masterPermissionMsg", error?.message || "Could not save assistant form access.", "err");
      }
    }));

    $("masterCreateAssistantOpen").addEventListener("click", () => {
      $("masterAssistantName").value = "";
      $("masterAssistantEmail").value = "";
      $("masterAssistantPhone").value = "";
      $("masterAssistantPassword").value = "";
      setCreateAssistantMessage("", "");
      openModal("masterCreateAssistantModal");
    });

    $("masterCreateAssistantForm").addEventListener("submit", (event) => runFormAction(event, "Creating...", async () => {
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
    }));

    $("masterCareerAdminForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
      setPanelMessage("masterCareerAdminMsg", "Saving Career Hub settings...", "info");
      try {
        const saved = await api.saveAdminContentByAdminAsync("career_hub", {
          title: $("masterCareerTitle").value.trim(),
          body: $("masterCareerBody").value.trim(),
          status: $("masterCareerStatus").value,
          settings: {
            ...(state.adminContent.career?.settings || {}),
            featuredTopic: $("masterCareerFeaturedTopic").value.trim(),
            cvRevampFree: $("masterCareerCvFree") ? $("masterCareerCvFree").checked : true,
            ctaLabel: "Open Career Hub",
            ctaHref: "career-guidance.html"
          }
        });
        state.adminContent.career = saved;
        setPanelMessage("masterCareerAdminMsg", "Career Hub settings saved.", "ok");
        renderAdminPanels();
      } catch (error) {
        setPanelMessage("masterCareerAdminMsg", error?.message || "Could not save Career Hub settings.", "err");
      }
    }));

    $("masterCareerArticleReset").addEventListener("click", resetCareerArticleForm);

    $("masterCareerArticleForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
      setPanelMessage("masterCareerArticleMsg", "Saving Career Hub article...", "info");
      try {
        let imageUrl = $("masterCareerArticleImage").value.trim();
        let fileUrl = $("masterCareerArticleFile").value.trim();
        const imageFile = $("masterCareerArticleImageUpload")?.files?.[0] || null;
        const resourceFile = $("masterCareerArticleFileUpload")?.files?.[0] || null;
        if (imageFile) {
          if (!api.uploadCareerAssetByAdminAsync) throw new Error("Career Hub image upload is unavailable. Add an image URL instead.");
          setPanelMessage("masterCareerArticleMsg", "Uploading Career Hub image...", "info");
          const uploadedImage = await api.uploadCareerAssetByAdminAsync(imageFile, "image");
          imageUrl = uploadedImage?.url || "";
        }
        if (resourceFile) {
          if (!api.uploadCareerAssetByAdminAsync) throw new Error("Career Hub resource upload is unavailable. Add a resource URL instead.");
          setPanelMessage("masterCareerArticleMsg", "Uploading Career Hub resource...", "info");
          const uploadedResource = await api.uploadCareerAssetByAdminAsync(resourceFile, "resource");
          fileUrl = uploadedResource?.url || "";
        }
        const saved = await api.saveCareerArticleByAdminAsync({
          id: $("masterCareerArticleId").value.trim(),
          contentType: $("masterCareerArticleType").value,
          title: $("masterCareerArticleTitle").value.trim(),
          company: $("masterCareerArticleCompany").value.trim(),
          location: $("masterCareerArticleLocation").value.trim(),
          workMode: $("masterCareerArticleWorkMode").value,
          employmentType: $("masterCareerArticleEmploymentType").value.trim(),
          category: $("masterCareerArticleCategory").value.trim(),
          level: $("masterCareerArticleLevel").value.trim(),
          closingDate: $("masterCareerArticleClosingDate").value.trim(),
          startDate: $("masterCareerArticleStartDate").value.trim(),
          duration: $("masterCareerArticleDuration").value.trim(),
          summary: $("masterCareerArticleSummary").value.trim(),
          body: $("masterCareerArticleBody").value.trim(),
          tags: fieldValueToList($("masterCareerArticleTags").value),
          applicationUrl: $("masterCareerArticleApplicationUrl").value.trim(),
          requirements: fieldValueToList($("masterCareerArticleRequirements").value),
          imageUrl,
          fileUrl,
          status: $("masterCareerArticleStatus").value
        });
        state.careerArticles = [saved].concat(state.careerArticles.filter((item) => item.id !== saved.id));
        resetCareerArticleForm();
        renderCareerArticleList();
        renderAdminPanels();
        renderQuickOverview();
        setPanelMessage("masterCareerArticleMsg", "Career Hub upload saved.", "ok");
      } catch (error) {
        setPanelMessage("masterCareerArticleMsg", error?.message || "Could not save the Career Hub upload.", "err");
      }
    }));

    $("masterCareerArticleList").addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit-career-article]");
      if (editButton) {
        const article = state.careerArticles.find((item) => item.id === editButton.getAttribute("data-edit-career-article"));
        if (article) populateCareerArticleForm(article);
        return;
      }
      const toggleButton = event.target.closest("[data-toggle-career-article]");
      if (toggleButton) {
        const id = toggleButton.getAttribute("data-toggle-career-article");
        const article = state.careerArticles.find((item) => item.id === id);
        if (!article) return;
        await runButtonAction(toggleButton, `career-toggle:${id}`, "Updating...", async () => {
          const saved = await api.saveCareerArticleByAdminAsync({
            ...article,
            status: article.status === "published" ? "draft" : "published"
          });
          state.careerArticles = [saved].concat(state.careerArticles.filter((item) => item.id !== id && item.id !== saved.id));
          renderCareerArticleList();
          renderAdminPanels();
        });
        return;
      }
      const deleteButton = event.target.closest("[data-delete-career-article]");
      if (deleteButton) {
        const id = deleteButton.getAttribute("data-delete-career-article");
        if (!window.confirm("Delete this Career Hub article?")) return;
        await runButtonAction(deleteButton, `career-delete:${id}`, "Deleting...", async () => {
          await api.deleteCareerArticleByAdminAsync(id);
          state.careerArticles = state.careerArticles.filter((item) => item.id !== id);
          renderCareerArticleList();
          renderAdminPanels();
        });
      }
    });

    $("masterHousingAdminForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
      setPanelMessage("masterHousingAdminMsg", "Saving Housing settings...", "info");
      try {
        const saved = await api.saveAdminContentByAdminAsync("housing_hub", {
          title: $("masterHousingTitle").value.trim(),
          body: $("masterHousingBody").value.trim(),
          status: $("masterHousingStatus").value,
          settings: {
            serviceStatus: $("masterHousingServiceStatus").value,
            supportPhone: $("masterHousingSupportPhone").value.trim(),
            ctaLabel: "Open Housing",
            ctaHref: "more-service/accommodation-assist.html"
          }
        });
        state.adminContent.housing = saved;
        setPanelMessage("masterHousingAdminMsg", "Housing settings saved.", "ok");
        renderAdminPanels();
      } catch (error) {
        setPanelMessage("masterHousingAdminMsg", error?.message || "Could not save Housing settings.", "err");
      }
    }));

    $("masterHousingListingReset").addEventListener("click", resetHousingListingForm);

    $("masterHousingListingForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
      setPanelMessage("masterHousingListingMsg", "Saving housing listing and pictures...", "info");
      try {
        const files = Array.from($("masterHousingListingImages").files || []);
        const saved = await api.saveAccommodationListingByAdminAsync({
          id: $("masterHousingListingId").value.trim(),
          propertyName: $("masterHousingListingTitle").value.trim(),
          institutionName: $("masterHousingListingInstitution").value.trim(),
          province: $("masterHousingListingProvince").value.trim(),
          city: $("masterHousingListingCity").value.trim(),
          location: $("masterHousingListingLocation").value.trim(),
          address: $("masterHousingListingLocation").value.trim(),
          roomType: $("masterHousingListingRoom").value,
          price: Number($("masterHousingListingPrice").value || 0),
          priceRange: $("masterHousingListingPriceRange").value.trim(),
          availabilityStatus: $("masterHousingListingAvailability").value.trim() || "Available",
          shortDescription: $("masterHousingListingShort").value.trim(),
          description: $("masterHousingListingDescription").value.trim(),
          contactPhone: $("masterHousingListingPhone").value.trim(),
          contactEmail: $("masterHousingListingEmail").value.trim(),
          listingState: $("masterHousingListingState").value,
          isActive: $("masterHousingListingState").value === "published",
          imageFiles: files
        });
        state.housingListings = [saved].concat(state.housingListings.filter((item) => item.id !== saved.id));
        resetHousingListingForm();
        renderHousingListingList();
        renderAdminPanels();
        renderQuickOverview();
        setPanelMessage("masterHousingListingMsg", "Housing listing saved.", "ok");
      } catch (error) {
        setPanelMessage("masterHousingListingMsg", error?.message || "Could not save the housing listing.", "err");
      }
    }));

    $("masterHousingListingList").addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit-housing]");
      if (editButton) {
        const listing = state.housingListings.find((item) => item.id === editButton.getAttribute("data-edit-housing"));
        if (listing) populateHousingListingForm(listing);
        return;
      }
      const toggleButton = event.target.closest("[data-toggle-housing]");
      if (toggleButton) {
        const id = toggleButton.getAttribute("data-toggle-housing");
        const listing = state.housingListings.find((item) => item.id === id);
        if (!listing) return;
        await runButtonAction(toggleButton, `housing-toggle:${id}`, "Updating...", async () => {
          const active = listing.listingState === "published" && listing.isActive !== false;
          const saved = await api.saveAccommodationListingByAdminAsync({
            ...listing,
            listingState: active ? "draft" : "published",
            isActive: !active
          });
          state.housingListings = [saved].concat(state.housingListings.filter((item) => item.id !== id && item.id !== saved.id));
          renderHousingListingList();
          renderAdminPanels();
          renderQuickOverview();
        });
        return;
      }
      const deleteButton = event.target.closest("[data-delete-housing]");
      if (deleteButton) {
        const id = deleteButton.getAttribute("data-delete-housing");
        if (!window.confirm("Delete this housing listing?")) return;
        await runButtonAction(deleteButton, `housing-delete:${id}`, "Deleting...", async () => {
          await api.deleteAccommodationListingByAdminAsync(id);
          state.housingListings = state.housingListings.filter((item) => item.id !== id);
          renderHousingListingList();
          renderAdminPanels();
          renderQuickOverview();
        });
      }
    });

    $("masterAnnouncementReset").addEventListener("click", resetAnnouncementForm);

    $("masterAnnouncementAdminForm").addEventListener("submit", (event) => runFormAction(event, "Saving...", async () => {
      setPanelMessage("masterAnnouncementAdminMsg", "Saving announcement...", "info");
      try {
        const saved = await api.saveAnnouncementByAdminAsync({
          id: $("masterAnnouncementId").value.trim(),
          title: $("masterAnnouncementTitle").value.trim(),
          message: $("masterAnnouncementMessage").value.trim(),
          audience: $("masterAnnouncementAudience").value,
          institutionName: $("masterAnnouncementInstitution").value.trim(),
          status: $("masterAnnouncementStatus").value,
          priority: $("masterAnnouncementPriority").value,
          scheduledFor: $("masterAnnouncementSchedule").value ? new Date($("masterAnnouncementSchedule").value).toISOString() : "",
          type: "info"
        });
        state.announcements = [saved].concat(state.announcements.filter((item) => item.id !== saved.id));
        resetAnnouncementForm();
        renderAnnouncementList();
        renderAdminPanels();
        setPanelMessage("masterAnnouncementAdminMsg", "Announcement saved. Active notices will appear on user dashboards.", "ok");
      } catch (error) {
        setPanelMessage("masterAnnouncementAdminMsg", error?.message || "Could not save announcement.", "err");
      }
    }));

    $("masterAnnouncementList").addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit-announcement]");
      if (editButton) {
        const item = state.announcements.find((entry) => entry.id === editButton.getAttribute("data-edit-announcement"));
        if (item) populateAnnouncementForm(item);
        return;
      }
      const toggleButton = event.target.closest("[data-toggle-announcement]");
      if (toggleButton) {
        const id = toggleButton.getAttribute("data-toggle-announcement");
        const item = state.announcements.find((entry) => entry.id === id);
        if (!item) return;
        await runButtonAction(toggleButton, `announcement-toggle:${id}`, "Updating...", async () => {
          setPanelMessage("masterAnnouncementAdminMsg", "Updating announcement...", "info");
          try {
            const saved = await api.saveAnnouncementByAdminAsync({
              ...item,
              status: item.active || item.status === "active" ? "inactive" : "active"
            });
            state.announcements = [saved].concat(state.announcements.filter((entry) => entry.id !== id && entry.id !== saved.id));
            renderAnnouncementList();
            renderAdminPanels();
            setPanelMessage("masterAnnouncementAdminMsg", "Announcement updated.", "ok");
          } catch (error) {
            setPanelMessage("masterAnnouncementAdminMsg", error?.message || "Could not update announcement.", "err");
          }
        });
        return;
      }
      const deleteButton = event.target.closest("[data-delete-announcement]");
      if (deleteButton) {
        const id = deleteButton.getAttribute("data-delete-announcement");
        await runButtonAction(deleteButton, `announcement-delete:${id}`, "Deleting...", async () => {
          setPanelMessage("masterAnnouncementAdminMsg", "Deleting announcement...", "info");
          try {
            await api.deleteAnnouncementByAdminAsync(id);
            state.announcements = state.announcements.filter((entry) => entry.id !== id);
            renderAnnouncementList();
            renderAdminPanels();
            setPanelMessage("masterAnnouncementAdminMsg", "Announcement deleted.", "ok");
          } catch (error) {
            setPanelMessage("masterAnnouncementAdminMsg", error?.message || "Could not delete announcement.", "err");
          }
        });
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
    bootScreen = UX()?.showBootScreen?.({
      title: "Kagie",
      message: "Loading your dashboard..."
    }) || null;
    bindStaticEvents(api);
    await refreshDashboard(api);
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => {
      console.error("Master dashboard failed to load:", error);
      bootScreen?.hide?.();
      bootScreen = null;
      $("masterApplications").innerHTML = renderEmptyState("We could not load the master dashboard right now.");
      $("masterLearnerInspector").innerHTML = `<div class="inspector-empty">Dashboard data is unavailable right now.</div>`;
      $("masterRecentLearners").innerHTML = renderEmptyState("Recent learner data is unavailable.");
      $("masterAssistantRoster").innerHTML = renderEmptyState("Assistant roster data is unavailable.");
    });
  });
})();
