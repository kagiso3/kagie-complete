const { normalizeSupabaseUrl } = require("./_supabase-url");

function json(statusCode, payload, origin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getBearerToken(headers) {
  const value = headers.authorization || headers.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

async function supabaseFetch(supabaseUrl, path, options) {
  const response = await fetch(`${supabaseUrl}${path}`, options);
  const payload = await readResponse(response);
  if (!response.ok) {
    const error = new Error(payload.msg || payload.message || payload.error_description || payload.error || `Supabase request failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function supabaseFetchMaybe(supabaseUrl, path, options, fallback = []) {
  try {
    return await supabaseFetch(supabaseUrl, path, options);
  } catch (_error) {
    return fallback;
  }
}

async function supabaseFetchFirstAvailable(supabaseUrl, paths, options, fallback = []) {
  const candidates = Array.isArray(paths) ? paths : [paths];
  for (const path of candidates) {
    try {
      return await supabaseFetch(supabaseUrl, path, options);
    } catch (_error) {
      // Try the next compatible table or view name.
    }
  }
  return fallback;
}

const REST_PAGE_SIZE = 1000;
const REST_MAX_PAGES = 200;

function appendRestPageParams(path, limit, offset) {
  const separator = String(path || "").includes("?") ? "&" : "?";
  return `${path}${separator}limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
}

async function supabaseFetchAllRows(supabaseUrl, path, options, settings = {}) {
  const pageSize = Math.max(1, Number(settings.pageSize || REST_PAGE_SIZE));
  const maxPages = Math.max(1, Number(settings.maxPages || REST_MAX_PAGES));
  const rows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await supabaseFetch(supabaseUrl, appendRestPageParams(path, pageSize, page * pageSize), options);
    const items = Array.isArray(payload) ? payload : [];
    rows.push(...items);
    if (!Array.isArray(payload) || items.length < pageSize) break;
  }

  return rows;
}

async function supabaseFetchAllMaybe(supabaseUrl, path, options, fallback = []) {
  try {
    return await supabaseFetchAllRows(supabaseUrl, path, options);
  } catch (_error) {
    return fallback;
  }
}

async function supabaseFetchAllFirstAvailable(supabaseUrl, paths, options, fallback = []) {
  const candidates = Array.isArray(paths) ? paths : [paths];
  for (const path of candidates) {
    try {
      return await supabaseFetchAllRows(supabaseUrl, path, options);
    } catch (_error) {
      // Try the next compatible table or view name.
    }
  }
  return fallback;
}

function adminHeaders(serviceRoleKey, extras = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...extras
  };
}

function bearerHeaders(apiKey, token, extras = {}) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    ...extras
  };
}

function extendHeaders(baseHeaders, extras = {}) {
  return {
    ...(baseHeaders || {}),
    ...extras
  };
}

function encodeFilter(value) {
  return encodeURIComponent(String(value || ""));
}

function compactJoin(parts, separator = ", ") {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(separator);
}

function firstFilled(...values) {
  return values.find((value) => String(value ?? "").trim()) || "";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function latestDateValue(row) {
  return row?.updated_at || row?.submitted_at || row?.assigned_at || row?.created_at || "";
}

function byNewest(left, right) {
  return new Date(latestDateValue(right) || 0) - new Date(latestDateValue(left) || 0);
}

function groupBy(rows, key) {
  return safeArray(rows).reduce((map, row) => {
    const value = String(row?.[key] || "").trim();
    if (!value) return map;
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
    return map;
  }, new Map());
}

function firstByUser(rows) {
  const map = new Map();
  safeArray(rows).sort(byNewest).forEach((row) => {
    const userId = String(row?.user_id || row?.profile_user_id || row?.learner_user_id || "").trim();
    if (userId && !map.has(userId)) map.set(userId, row);
  });
  return map;
}

function profileUserId(row) {
  return String(row?.user_id || row?.id || "").trim();
}

function rowUserId(row) {
  return String(row?.user_id || row?.profile_user_id || row?.learner_user_id || "").trim();
}

function rowApplicationId(row) {
  return String(row?.application_id || row?.app_id || "").trim();
}

function mapByUser(rows) {
  return safeArray(rows).reduce((map, row) => {
    const userId = rowUserId(row);
    if (userId && !map.has(userId)) map.set(userId, row || {});
    return map;
  }, new Map());
}

async function getProfileSnapshotWithHeaders(supabaseUrl, headers, userId) {
  if (!userId) return null;
  const rows = await supabaseFetch(
    supabaseUrl,
    `/rest/v1/profiles?or=(id.eq.${encodeFilter(userId)},user_id.eq.${encodeFilter(userId)})&select=*&limit=1`,
    {
      method: "GET",
      headers
    }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getProfileSnapshot(supabaseUrl, serviceRoleKey, userId) {
  return getProfileSnapshotWithHeaders(supabaseUrl, adminHeaders(serviceRoleKey), userId);
}

async function listAllAuthUsers(supabaseUrl, serviceRoleKey) {
  const collected = [];
  for (let page = 1; page <= 50; page += 1) {
    const payload = await supabaseFetch(
      supabaseUrl,
      `/auth/v1/admin/users?page=${page}&per_page=200`,
      {
        method: "GET",
        headers: adminHeaders(serviceRoleKey)
      }
    );

    const users = Array.isArray(payload?.users)
      ? payload.users
      : Array.isArray(payload)
        ? payload
        : [];

    collected.push(...users);
    if (users.length < 200) break;
  }
  return collected;
}

function normalizeKagieRole(roleArg, fallbackRole = "user") {
  const role = String(roleArg || "").trim().toLowerCase();
  if (!role) return fallbackRole;
  if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(role)) return "master_admin";
  if (["assistant_admin", "assistant", "assistant admin", "assistant-admin", "assistantadmin", "admin", "administrator", "staff", "support", "support_staff", "support-staff", "support staff"].includes(role)) return "assistant_admin";
  if (["user", "learner", "student", "authenticated"].includes(role)) return "user";
  if (["parent", "guardian"].includes(role)) return "parent";
  if (["teacher", "educator", "school_admin", "school-admin", "school admin"].includes(role)) return "teacher";
  return fallbackRole;
}

function readableRoleLabel(roleArg) {
  const role = normalizeKagieRole(roleArg, String(roleArg || "user").trim().toLowerCase() || "user");
  if (role === "master_admin") return "Master Admin";
  if (role === "assistant_admin") return "Assistant Admin";
  if (role === "parent") return "Parent";
  if (role === "teacher") return "Teacher";
  if (role === "user") return "Learner";
  return String(role || "user")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLearnerDirectoryRole(roleArg) {
  return normalizeKagieRole(roleArg, "user") === "user";
}

function isMasterAdminActor(actor, profileRole = "") {
  const role = normalizeKagieRole(actor?.app_metadata?.role || actor?.user_metadata?.role || profileRole || "", "user");
  if (role === "master_admin") return true;
  const email = normalizeEmail(actor?.email || "");
  return ["kagisowitness79@gmail.com", "masteradmin@kagie.app"].includes(email);
}

function isStaffActor(actor, profileRole = "") {
  const role = normalizeKagieRole(actor?.app_metadata?.role || actor?.user_metadata?.role || profileRole || "", "user");
  return role === "master_admin" || role === "assistant_admin" || isMasterAdminActor(actor, profileRole);
}

function normalizeStatusText(value) {
  return String(value || "").trim().toLowerCase();
}

function hasProfileProgress(userProfile, guardianProfile, schoolProfile) {
  return [
    userProfile?.id_number,
    userProfile?.surname,
    userProfile?.full_name,
    userProfile?.date_of_birth,
    userProfile?.gender,
    userProfile?.province,
    userProfile?.postal_code,
    userProfile?.address,
    guardianProfile?.full_names,
    guardianProfile?.full_name,
    guardianProfile?.surname,
    guardianProfile?.phone_1,
    guardianProfile?.phone,
    guardianProfile?.email,
    guardianProfile?.address,
    schoolProfile?.school_name,
    schoolProfile?.name,
    schoolProfile?.school_province,
    schoolProfile?.school_type,
    schoolProfile?.completion_year,
    schoolProfile?.average
  ].some((value) => String(value || "").trim());
}

function buildProfileCompletion(profile, userProfile, guardianProfile, schoolProfile, latestApplication, institutionRows = [], markRows = [], documents = []) {
  const applicationStatus = normalizeStatusText(latestApplication?.status);
  const meaningfulApplicationProgress = firstFilled(
    latestApplication?.submitted_at,
    applicationStatus && applicationStatus !== "draft" ? latestApplication?.status : ""
  );
  const checks = [
    firstFilled(profile?.full_name),
    firstFilled(profile?.email),
    firstFilled(profile?.phone),
    firstFilled(userProfile?.id_number),
    firstFilled(userProfile?.surname),
    firstFilled(userProfile?.date_of_birth, userProfile?.dob),
    firstFilled(userProfile?.gender),
    firstFilled(userProfile?.province),
    firstFilled(userProfile?.postal_code),
    firstFilled(userProfile?.address),
    firstFilled(guardianProfile?.relation, guardianProfile?.guardian_relation),
    firstFilled(guardianProfile?.full_names, guardianProfile?.full_name),
    firstFilled(guardianProfile?.phone_1, guardianProfile?.phone),
    firstFilled(guardianProfile?.email),
    firstFilled(schoolProfile?.school_name, schoolProfile?.name),
    firstFilled(schoolProfile?.school_province, schoolProfile?.province),
    firstFilled(schoolProfile?.school_type, schoolProfile?.type),
    firstFilled(schoolProfile?.completion_year, schoolProfile?.year_completed),
    firstFilled(schoolProfile?.average),
    safeArray(markRows).length ? "marks" : "",
    safeArray(institutionRows).length ? "institutions" : "",
    safeArray(documents).length ? "documents" : "",
    meaningfulApplicationProgress
  ];

  const completed = checks.filter(Boolean).length;
  const total = checks.length || 1;
  const percent = Math.round((completed / total) * 100);

  return {
    completed,
    total,
    percent,
    hasFormDetails: Boolean(
      hasProfileProgress(userProfile, guardianProfile, schoolProfile)
      || firstFilled(profile?.full_name, profile?.email, profile?.phone)
      || safeArray(institutionRows).length
      || safeArray(markRows).length
      || safeArray(documents).length
      || meaningfulApplicationProgress
    )
  };
}

function accountStatusFor(userProfile, guardianProfile, schoolProfile, latestApplication, assignedAssistantId) {
  const status = normalizeStatusText(latestApplication?.status);
  if (status.includes("accept") || status.includes("reject") || status.includes("complete")) return "Completed";
  if (status.includes("review") || status.includes("process")) return "Under Review";
  if (latestApplication?.assistant_id || assignedAssistantId) return "Assigned";
  if (latestApplication?.submitted_at || status.includes("submit") || status.includes("ready") || status.includes("applied") || status.includes("pending feedback")) return "Submitted";
  if (latestApplication?.id) return "Application Started";
  if (hasProfileProgress(userProfile, guardianProfile, schoolProfile)) return "Profile In Progress";
  return "Account Created";
}

function applicationStatusFor(accountStatus, latestApplication) {
  const status = String(latestApplication?.status || "").trim();
  if (status) return status;
  return accountStatus || "Account Created";
}

function createCourseList(institutionRows) {
  const values = [];
  safeArray(institutionRows).forEach((row) => {
    [row?.choice_1, row?.choice_2, row?.choice_3].forEach((choice) => {
      const text = String(choice || "").trim();
      if (text && !values.includes(text)) values.push(text);
    });
  });
  return values;
}

function buildAdminContext(data, actor, actorProfile) {
  const authUsers = safeArray(data.authUsers);
  const authUserMap = new Map(authUsers.map((row) => [String(row?.id || "").trim(), row || {}]));
  const profiles = safeArray(data.profiles);
  const profileMap = new Map();
  profiles.forEach((row) => {
    const profile = row || {};
    const primaryId = profileUserId(profile);
    const legacyId = String(profile?.id || "").trim();
    if (primaryId) profileMap.set(primaryId, profile);
    if (legacyId && !profileMap.has(legacyId)) profileMap.set(legacyId, profile);
  });
  const userProfileMap = mapByUser(data.userProfiles);
  const guardianMap = mapByUser(data.guardians);
  const schoolMap = mapByUser(data.schools);
  const applications = safeArray(data.applications).sort(byNewest);
  const latestApplicationMap = firstByUser(applications);
  const assignments = safeArray(data.assignments).sort(byNewest);
  const assignmentMap = firstByUser(assignments);
  const institutionsByApplication = groupBy(data.applicationInstitutions, "application_id");
  const actorId = String(actorProfile?.user_id || actorProfile?.id || actor?.id || "").trim();
  const masterActor = isMasterAdminActor(actor, actorProfile?.role || "");

  const assistantLearnerIds = masterActor
    ? null
    : new Set(
        [
          ...applications
            .filter((row) => String(row?.assistant_id || "").trim() === actorId)
            .map((row) => rowUserId(row)),
          ...assignments
            .filter((row) => String(row?.assistant_admin_id || "").trim() === actorId)
            .map((row) => rowUserId(row)),
          ...safeArray(data.callbacks)
            .filter((row) => String(row?.assigned_assistant_id || "").trim() === actorId)
            .map((row) => rowUserId(row)),
          ...safeArray(data.supportThreads)
            .filter((row) => String(row?.assistant_id || "").trim() === actorId)
            .map((row) => rowUserId(row))
        ].filter(Boolean)
      );

  const rows = [];
  const seenUserIds = new Set();
  const addDirectoryRow = ({ userId: userIdArg, authUser: authUserArg, profile: profileArg }) => {
    const userId = String(userIdArg || profileUserId(profileArg) || authUserArg?.id || "").trim();
    if (!userId || seenUserIds.has(userId)) return;

    const authUser = authUserArg || authUserMap.get(userId) || {};
    const profile = profileArg || profileMap.get(userId) || {};
    const rawRole = authUser?.app_metadata?.role || authUser?.user_metadata?.role || profile?.role || "";
    const role = normalizeKagieRole(
      rawRole,
      "user"
    );
    const learnerRole = isLearnerDirectoryRole(role);
    if (!masterActor && (!learnerRole || !assistantLearnerIds?.has(userId))) return;

    const userProfile = userProfileMap.get(userId) || {};
    const guardianProfile = guardianMap.get(userId) || {};
    const schoolProfile = schoolMap.get(userId) || {};
    const latestApplication = latestApplicationMap.get(userId) || null;
    const assignment = assignmentMap.get(userId) || null;
    const assignedAssistantId = String(assignment?.assistant_admin_id || latestApplication?.assistant_id || "").trim();
    const assistantProfile = assignedAssistantId ? profileMap.get(assignedAssistantId) || {} : {};
    const institutionRows = latestApplication?.id ? institutionsByApplication.get(String(latestApplication.id)) || [] : [];
    const courses = createCourseList(institutionRows);
    const completion = buildProfileCompletion(profile, userProfile, guardianProfile, schoolProfile, latestApplication, institutionRows);
    const roleLabel = readableRoleLabel(rawRole || role);
    const accountStatus = learnerRole
      ? accountStatusFor(userProfile, guardianProfile, schoolProfile, latestApplication, assignedAssistantId)
      : (profile?.is_active === false || authUser?.banned_until ? "Inactive" : "Active");

    seenUserIds.add(userId);
    rows.push({
      id: userId,
      profileId: String(profile?.id || userId).trim(),
      role,
      roleLabel,
      fullName: String(firstFilled(profile?.full_name, userProfile?.full_names, userProfile?.full_name, authUser?.user_metadata?.full_name, authUser?.user_metadata?.name, profile?.email, userProfile?.email, authUser?.email, "Kagie user")).trim(),
      surname: String(firstFilled(userProfile?.surname, profile?.surname)).trim(),
      email: normalizeEmail(firstFilled(profile?.email, userProfile?.email, authUser?.email)),
      phone: String(firstFilled(profile?.phone, userProfile?.cellphone, userProfile?.phone, authUser?.user_metadata?.phone, guardianProfile?.phone_1, guardianProfile?.phone)).trim(),
      idNumber: String(userProfile?.id_number || profile?.id_number || "").trim(),
      gender: String(userProfile?.gender || "").trim(),
      dateOfBirth: userProfile?.date_of_birth || userProfile?.dob || "",
      province: String(firstFilled(userProfile?.province, profile?.province, guardianProfile?.province, schoolProfile?.school_province, schoolProfile?.province)).trim(),
      city: String(profile?.city || "").trim(),
      location: compactJoin([profile?.province || userProfile?.province || guardianProfile?.province || schoolProfile?.school_province, profile?.city, userProfile?.address]),
      address: String(userProfile?.address || "").trim(),
      schoolName: String(firstFilled(schoolProfile?.school_name, schoolProfile?.name, userProfile?.school_name)).trim(),
      grade: String(firstFilled(schoolProfile?.grade, schoolProfile?.current_grade, schoolProfile?.completion_year, schoolProfile?.year_completed)).trim(),
      applicationStatus: learnerRole ? applicationStatusFor(accountStatus, latestApplication) : roleLabel,
      accountStatus,
      assignedAssistantId,
      assignedAssistantName: String(assistantProfile?.full_name || "").trim(),
      assignedAssistantEmail: normalizeEmail(assistantProfile?.email || ""),
      latestApplicationId: latestApplication?.id || assignment?.application_id || "",
      latestApplicationStatus: latestApplication?.status || "",
      selectedInstitution: institutionRows[0]?.institution_name || "",
      selectedFaculty: institutionRows[0]?.faculty || "",
      selectedCourses: courses,
      createdAt: firstFilled(profile?.created_at, authUser?.created_at, latestApplication?.created_at, latestApplication?.submitted_at, latestApplication?.updated_at),
      updatedAt: firstFilled(profile?.updated_at, authUser?.updated_at, latestApplication?.updated_at, profile?.created_at),
      lastLogin: firstFilled(authUser?.last_sign_in_at),
      confirmationStatus: authUser?.email_confirmed_at || authUser?.confirmed_at ? "Confirmed" : (authUser?.id ? "Pending confirmation" : "Unknown"),
      hasProfile: learnerRole ? hasProfileProgress(userProfile, guardianProfile, schoolProfile) : Boolean(profile?.id),
      hasFormDetails: learnerRole ? completion.hasFormDetails : Boolean(profile?.id),
      profileCompletionPercent: learnerRole ? completion.percent : 100,
      profileCompletionLabel: learnerRole ? `${completion.percent}% complete` : "100% complete",
      isActive: profile?.is_active !== false && !authUser?.banned_until,
      source: authUser?.id ? "auth" : (profile?.id ? "profiles" : "applications")
    });
  };

  authUsers.forEach((authUser) => addDirectoryRow({ userId: authUser?.id, authUser }));
  profiles.forEach((profile) => addDirectoryRow({ userId: profileUserId(profile), profile }));
  applications.forEach((application) => {
    const userId = rowUserId(application);
    if (userId) addDirectoryRow({ userId, profile: profileMap.get(userId) || { user_id: userId } });
  });

  rows.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  return {
    masterActor,
    actorId,
    assistantLearnerIds,
    rows,
    maps: {
      profileMap,
      userProfileMap,
      guardianMap,
      schoolMap,
      latestApplicationMap,
      assignmentMap,
      institutionsByApplication
    },
    data
  };
}

function canViewUser(context, userId) {
  if (context.masterActor) return true;
  return context.assistantLearnerIds?.has(String(userId || "").trim());
}

function buildUserDetail(context, userId) {
  const row = context.rows.find((item) => String(item.id) === String(userId));
  if (!row) return null;

  const applications = safeArray(context.data.applications)
    .filter((app) => rowUserId(app) === String(userId))
    .sort(byNewest);
  const applicationIds = new Set(applications.map((app) => String(app?.id || "")).filter(Boolean));
  const matchesUser = (item) => rowUserId(item) === String(userId);
  const matchesApplication = (item) => applicationIds.has(rowApplicationId(item));
  const documents = safeArray(context.data.documents).filter((doc) => matchesUser(doc) || matchesApplication(doc));
  const payments = safeArray(context.data.payments).filter((payment) => matchesUser(payment) || matchesApplication(payment));
  const institutions = safeArray(context.data.applicationInstitutions).filter((item) => matchesApplication(item));
  const marks = safeArray(context.data.applicationMarks).filter((item) => matchesUser(item) || matchesApplication(item));
  const notes = safeArray(context.data.notes).filter((item) => matchesUser(item) || matchesApplication(item));
  const activity = safeArray(context.data.activity).filter((item) => matchesUser(item) || matchesApplication(item));
  const callbacks = safeArray(context.data.callbacks).filter((item) => matchesUser(item));
  const supportThreads = safeArray(context.data.supportThreads).filter((item) => matchesUser(item));
  const accommodationRequests = safeArray(context.data.accommodationRequests).filter((item) => matchesUser(item) || matchesApplication(item));
  const transportRequests = safeArray(context.data.transportRequests).filter((item) => matchesUser(item) || matchesApplication(item));
  const carts = safeArray(context.data.carts).filter((item) => rowUserId(item) === String(userId));
  const cartIds = new Set(carts.map((item) => String(item?.id || "")).filter(Boolean));
  const cartItems = safeArray(context.data.cartItems).filter((item) => cartIds.has(String(item?.cart_id || "")));
  const userProfile = context.maps.userProfileMap.get(String(userId)) || {};
  const guardian = context.maps.guardianMap.get(String(userId)) || {};
  const school = context.maps.schoolMap.get(String(userId)) || {};
  const profile = context.maps.profileMap.get(String(userId)) || {};
  const completion = buildProfileCompletion(profile, userProfile, guardian, school, applications[0] || null, institutions, marks, documents);

  const timeline = [
    ...applications.map((app) => ({
      type: "application",
      action: app?.submitted_at ? "Application submitted" : "Application created",
      status: app?.status || "",
      timestamp: app?.submitted_at || app?.created_at || app?.updated_at || "",
      applicationId: app?.id || ""
    })),
    ...documents.map((doc) => ({
      type: "document",
      action: `Document uploaded: ${doc?.file_name || doc?.document_type || "Document"}`,
      status: doc?.status || "",
      timestamp: doc?.created_at || "",
      documentId: doc?.id || ""
    })),
    ...payments.map((payment) => ({
      type: "payment",
      action: `Payment ${payment?.status || "recorded"}`,
      status: payment?.status || "",
      timestamp: payment?.created_at || "",
      paymentId: payment?.id || ""
    })),
    ...cartItems.map((item) => ({
      type: "cart",
      action: `Cart item added: ${item?.name || "Cart item"}`,
      status: item?.item_type || "",
      timestamp: item?.created_at || "",
      cartItemId: item?.id || ""
    })),
    ...notes.map((note) => ({
      type: "note",
      action: "Admin note added",
      status: note?.author_role || note?.note_type || "",
      timestamp: note?.created_at || "",
      noteId: note?.id || ""
    })),
    ...accommodationRequests.map((request) => ({
      type: "accommodation",
      action: `Accommodation request: ${request?.property_name || "Student housing"}`,
      status: request?.status || "",
      timestamp: request?.updated_at || request?.created_at || "",
      requestId: request?.id || ""
    })),
    ...transportRequests.map((request) => ({
      type: "transport",
      action: `Transport request: ${request?.departure_city || "Departure"} to ${request?.destination_city || "Destination"}`,
      status: request?.status || request?.ticket_status || "",
      timestamp: request?.updated_at || request?.created_at || request?.sent_at || "",
      requestId: request?.id || ""
    })),
    ...activity.map((item) => ({
      type: "activity",
      action: item?.action || "Admin activity",
      status: item?.status || item?.metadata?.status || "",
      timestamp: item?.timestamp || item?.created_at || "",
      activityId: item?.id || "",
      details: item?.details || item?.metadata || {}
    }))
  ].filter((item) => item.timestamp).sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));

  return {
    ...row,
    roleLabel: row.roleLabel || readableRoleLabel(row.role),
    hasFormDetails: completion.hasFormDetails,
    profileCompletionPercent: completion.percent,
    profileCompletionLabel: `${completion.percent}% complete`,
    personalInformation: {
      fullName: row.fullName,
      surname: row.surname,
      idNumber: row.idNumber,
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      homeLanguage: userProfile.home_language || "",
      province: row.province,
      postalCode: userProfile.postal_code || "",
      address: row.address
    },
    contactDetails: {
      email: row.email,
      phone: row.phone,
      province: row.province,
      city: row.city,
      address: row.address
    },
    guardianInfo: guardian,
    schoolInfo: school,
    subjectsResults: marks,
    selectedInstitutions: institutions,
    selectedCourses: createCourseList(institutions),
    applications,
    uploadedDocuments: documents,
    uploadedDocumentCount: documents.length,
    selectedInstitutionCount: institutions.length,
    accommodationRequests,
    transportRequests,
    paymentRecords: payments,
    cartItems,
    adminNotes: notes,
    supportThreads,
    callbackRequests: callbacks,
    activityTimeline: timeline
  };
}

async function loadAdminData(supabaseUrl, serviceRoleKey, accessToken, anonKey, options = {}) {
  const hasServiceRole = Boolean(serviceRoleKey);
  const readHeaders = hasServiceRole
    ? adminHeaders(serviceRoleKey)
    : bearerHeaders(anonKey, accessToken);
  const includeDetails = Boolean(options.includeDetails);
  const includeAssistantScopeTables = includeDetails || options.includeAssistantScope !== false;
  const [
    authUsers,
    profiles,
    userProfiles,
    guardians,
    schools,
    applications,
    assignments,
    callbacks,
    supportThreads,
    applicationInstitutions,
    applicationMarks,
    documents,
    payments,
    carts,
    cartItems,
    notes,
    activity,
    accommodationRequests,
    transportRequests
  ] = await Promise.all([
    hasServiceRole ? listAllAuthUsers(supabaseUrl, serviceRoleKey) : Promise.resolve([]),
    supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/profiles?select=*&order=created_at.desc", { method: "GET", headers: readHeaders }),
    supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/learner_details?select=*", "/rest/v1/user_profiles?select=*"], { method: "GET", headers: readHeaders }),
    supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/parent_details?select=*", "/rest/v1/guardian_profiles?select=*"], { method: "GET", headers: readHeaders }),
    supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/school_details?select=*", "/rest/v1/school_profiles?select=*"], { method: "GET", headers: readHeaders }),
    supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/applications?select=id,user_id,status,assistant_id,assigned_by,assigned_at,assignment_status,package_id,payment_status,payer_name,payer_phone,payment_reference,payment_method,payment_note,payment_amount,submitted_at,created_at,updated_at&order=updated_at.desc", { method: "GET", headers: readHeaders }),
    supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/assistant_assignments?select=*&order=assigned_at.desc", "/rest/v1/assignments?select=*&order=assigned_at.desc"], { method: "GET", headers: readHeaders }),
    includeAssistantScopeTables ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/callback_requests?select=id,user_id,assigned_assistant_id,phone,preferred_time,note,status,created_at,updated_at", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeAssistantScopeTables ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/support_threads?select=id,user_id,assistant_id,status,created_at,updated_at", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/application_institutions?select=id,application_id,province,institution_type,institution_name,application_fee,application_fee_label,application_fee_note,faculty,choice_1,choice_2,choice_3,created_at,updated_at", { method: "GET", headers: readHeaders }),
    includeDetails ? supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/marks?select=*", "/rest/v1/application_marks?select=*"], { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/documents?select=id,user_id,application_id,document_type,file_name,file_url,status,created_at,updated_at", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/payments?select=*&order=created_at.desc", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/carts?select=*", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/cart_items?select=*&order=created_at.desc", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/admin_notes?select=*&order=created_at.desc", "/rest/v1/application_notes?select=*&order=created_at.desc"], { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllFirstAvailable(supabaseUrl, ["/rest/v1/activity_logs?select=*&order=timestamp.desc", "/rest/v1/activity_logs?select=*&order=created_at.desc", "/rest/v1/assistant_activity?select=*&order=created_at.desc"], { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/accommodation_requests?select=*&order=updated_at.desc", { method: "GET", headers: readHeaders }) : Promise.resolve([]),
    includeDetails ? supabaseFetchAllMaybe(supabaseUrl, "/rest/v1/transport_requests?select=*&order=updated_at.desc", { method: "GET", headers: readHeaders }) : Promise.resolve([])
  ]);

  return {
    authUsers,
    profiles,
    userProfiles,
    guardians,
    schools,
    applications,
    assignments,
    callbacks,
    supportThreads,
    applicationInstitutions,
    applicationMarks,
    documents,
    payments,
    carts,
    cartItems,
    notes,
    activity,
    accommodationRequests,
    transportRequests
  };
}

async function handleGet(event, origin, supabaseUrl, access, actor, actorProfile) {
  const requestedUserId = String(event.queryStringParameters?.userId || event.queryStringParameters?.id || "").trim();
  const masterActor = isMasterAdminActor(actor, actorProfile?.role || "");
  const data = await loadAdminData(supabaseUrl, access.serviceRoleKey, access.token, access.anonKey, {
    includeDetails: Boolean(requestedUserId),
    includeAssistantScope: !masterActor
  });
  const context = buildAdminContext(data, actor, actorProfile);

  if (requestedUserId) {
    if (!canViewUser(context, requestedUserId)) {
      return json(403, { message: "You are not allowed to view this learner." }, origin);
    }
    const detail = buildUserDetail(context, requestedUserId);
    if (!detail) return json(404, { message: "User profile was not found." }, origin);
    await insertActivityLog(supabaseUrl, access.writeHeaders, {
      admin_id: actor?.id || null,
      user_id: requestedUserId,
      application_id: detail.latestApplicationId || null,
      action: "view_profile",
      metadata: { role: normalizeKagieRole(actorProfile?.role || actor?.app_metadata?.role || actor?.user_metadata?.role || "", "user") }
    }).catch(() => {});
    return json(200, { data: detail }, origin);
  }

  return json(200, { data: context.rows }, origin);
}

async function insertActivityLog(supabaseUrl, serviceRoleKey, payload) {
  const baseHeaders = typeof serviceRoleKey === "string" ? adminHeaders(serviceRoleKey) : serviceRoleKey;
  return supabaseFetchMaybe(
    supabaseUrl,
    "/rest/v1/activity_logs",
    {
      method: "POST",
      headers: extendHeaders(baseHeaders, {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      }),
      body: JSON.stringify([{ ...payload, timestamp: new Date().toISOString() }])
    },
    null
  );
}

async function handleAssign(event, origin, supabaseUrl, access, actor, actorProfile) {
  if (!isMasterAdminActor(actor, actorProfile?.role || "")) {
    return json(403, { message: "Only Master Admin can assign learners." }, origin);
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const userId = String(body.userId || body.user_id || "").trim();
  const assistantAdminId = String(body.assistantAdminId || body.assistant_admin_id || body.assistantId || "").trim();
  const requestedApplicationId = String(body.applicationId || body.application_id || "").trim();

  if (!userId || !assistantAdminId) {
    return json(400, { message: "Choose a learner and assistant admin first." }, origin);
  }

  const [learnerProfile, assistantProfile] = await Promise.all([
    getProfileSnapshotWithHeaders(supabaseUrl, access.readHeaders, userId).catch(() => null),
    getProfileSnapshotWithHeaders(supabaseUrl, access.readHeaders, assistantAdminId).catch(() => null)
  ]);
  if (!learnerProfile) return json(404, { message: "Learner account was not found." }, origin);
  if (normalizeKagieRole(assistantProfile?.role || "", "user") !== "assistant_admin") {
    return json(400, { message: "Selected account is not an Assistant Admin." }, origin);
  }

  const applications = await supabaseFetchAllMaybe(
    supabaseUrl,
    `/rest/v1/applications?user_id=eq.${encodeFilter(userId)}&select=id,user_id,assistant_id,status,updated_at,created_at&order=updated_at.desc`,
    { method: "GET", headers: access.readHeaders }
  );
  let latestApplication = requestedApplicationId
    ? safeArray(applications).find((app) => String(app?.id || "") === requestedApplicationId)
    : safeArray(applications)[0] || null;
  if (requestedApplicationId && !latestApplication) {
    return json(404, { message: "The selected application was not found for this learner." }, origin);
  }
  let applicationId = latestApplication?.id || null;
  const assignmentStatus = latestApplication?.assistant_id && String(latestApplication.assistant_id) !== assistantAdminId ? "Reassigned" : "Assigned";

  if (applicationId) {
    await supabaseFetch(
      supabaseUrl,
      `/rest/v1/applications?id=eq.${encodeFilter(applicationId)}`,
      {
        method: "PATCH",
        headers: extendHeaders(access.writeHeaders, {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify({
          assistant_id: assistantAdminId,
          assigned_by: actor?.id || null,
          assigned_at: new Date().toISOString(),
          assignment_status: assignmentStatus
        })
      }
    );
  } else {
    const created = await supabaseFetch(
      supabaseUrl,
      "/rest/v1/applications",
      {
        method: "POST",
        headers: extendHeaders(access.writeHeaders, {
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }),
        body: JSON.stringify([{
          user_id: userId,
          assistant_id: assistantAdminId,
          assigned_by: actor?.id || null,
          assigned_at: new Date().toISOString(),
          assignment_status: "Assigned",
          status: "Draft"
        }])
      }
    );
    latestApplication = safeArray(created)[0] || null;
    applicationId = latestApplication?.id || null;
  }

  const assignedAt = new Date().toISOString();
  let assignmentResult = null;
  try {
    assignmentResult = await supabaseFetch(
      supabaseUrl,
      "/rest/v1/assistant_assignments?on_conflict=user_id",
      {
        method: "POST",
        headers: extendHeaders(access.writeHeaders, {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify([{
          user_id: userId,
          assistant_admin_id: assistantAdminId,
          assigned_by: actor?.id || null,
          assigned_at: assignedAt,
          status: assignmentStatus
        }])
      }
    );
  } catch (_error) {
    assignmentResult = await supabaseFetchMaybe(
      supabaseUrl,
      "/rest/v1/assignments?on_conflict=user_id",
      {
        method: "POST",
        headers: extendHeaders(access.writeHeaders, {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify([{
          user_id: userId,
          assistant_admin_id: assistantAdminId,
          master_admin_id: actor?.id || null,
          application_id: applicationId,
          status: assignmentStatus,
          assigned_at: assignedAt
        }])
      },
      null
    );
  }

  if (!applicationId && !assignmentResult) {
    return json(500, {
      message: "The learner assignment could not be saved. Check the assistant assignments table in Supabase."
    }, origin);
  }

  await Promise.all([
    supabaseFetchMaybe(
      supabaseUrl,
      `/rest/v1/support_threads?user_id=eq.${encodeFilter(userId)}`,
      {
      method: "PATCH",
      headers: extendHeaders(access.writeHeaders, { "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ assistant_id: assistantAdminId })
      },
      null
    ),
    supabaseFetchMaybe(
      supabaseUrl,
      `/rest/v1/callback_requests?user_id=eq.${encodeFilter(userId)}&status=eq.Pending`,
      {
      method: "PATCH",
      headers: extendHeaders(access.writeHeaders, { "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ assigned_assistant_id: assistantAdminId })
      },
      null
    ),
    supabaseFetchMaybe(
      supabaseUrl,
      "/rest/v1/assistant_activity",
      {
      method: "POST",
      headers: extendHeaders(access.writeHeaders, { "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify([{
          assistant_id: assistantAdminId,
          application_id: applicationId,
          action: "assigned_by_master",
          details: {
            learnerId: userId,
            masterAdminId: actor?.id || null,
            learnerName: learnerProfile?.full_name || learnerProfile?.email || ""
          }
        }])
      },
      null
    ),
    insertActivityLog(supabaseUrl, access.writeHeaders, {
      admin_id: actor?.id || null,
      user_id: userId,
      application_id: applicationId,
      action: "assign_assistant",
      metadata: {
        assistantAdminId,
        status: assignmentStatus
      }
    }).catch(() => null)
  ]);

  return json(200, {
    data: {
      userId,
      assistantAdminId,
      assistantName: assistantProfile?.full_name || assistantProfile?.email || "Assistant Admin",
      applicationId,
      status: assignmentStatus,
      assignedAt
    }
  }, origin);
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || "*";
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true }, origin);
  if (!["GET", "POST"].includes(event.httpMethod)) return json(405, { message: "Method not allowed." }, origin);

  const token = getBearerToken(event.headers || {});
  if (!token) return json(401, { message: "Missing Supabase access token." }, origin);

  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_ANON_KEY);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    return json(500, { message: "Live admin setup is not complete on this site yet. Add SUPABASE_URL and either SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY to the server environment, then redeploy." }, origin);
  }

  try {
    const authApiKey = serviceRoleKey || anonKey;
    const actor = await supabaseFetch(supabaseUrl, "/auth/v1/user", {
      method: "GET",
      headers: bearerHeaders(authApiKey, token)
    });

    const requestHeaders = serviceRoleKey
      ? adminHeaders(serviceRoleKey)
      : bearerHeaders(anonKey, token);
    const actorProfile = await getProfileSnapshotWithHeaders(supabaseUrl, requestHeaders, actor?.id).catch(() => null);
    if (!isStaffActor(actor, actorProfile?.role || "")) {
      return json(403, { message: "Only Kagie staff can access the admin user directory." }, origin);
    }

    const access = {
      serviceRoleKey,
      anonKey,
      token,
      hasServiceRole: Boolean(serviceRoleKey),
      readHeaders: requestHeaders,
      writeHeaders: requestHeaders
    };

    if (event.httpMethod === "POST") {
      return await handleAssign(event, origin, supabaseUrl, access, actor, actorProfile);
    }
    return await handleGet(event, origin, supabaseUrl, access, actor, actorProfile);
  } catch (error) {
    return json(error.status || 500, { message: error.message || "Could not load the Kagie user directory." }, origin);
  }
};
