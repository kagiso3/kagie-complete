(function () {
  'use strict';

  const KEYS = {
    users: 'kagie_users',
    current: 'kagie_current_user',
    loginPersistence: 'kagie_login_persistence',
    activeSession: 'kagie_active_session',
    applications: 'kagie_applications',
    applicationPacksCatalog: 'kagie_application_packs_catalog',
    promoCampaigns: 'kagie_promo_campaigns_catalog',
    marketingCampaigns: 'kagie_marketing_campaigns_catalog',
    adminContent: 'kagie_admin_content_catalog',
    announcements: 'kagie_announcements_catalog',
    institutions: 'kagie_institutions',
    accommodationListingsCatalog: 'kagie_accommodation_listings_catalog',
    favorites: 'kagie_favorites',
    accommodationRequests: 'kagie_accommodation_requests',
    transportOptionsCatalog: 'kagie_transport_options_catalog',
    transportRequests: 'kagie_transport_requests',
    userPrefsPrefix: 'kagie_user_prefs_',
    notifications: 'kagie_notifications',
    prospectusLibrary: 'kagie_prospectus_library_catalog',
    pastPaperLibrary: 'kagie_past_paper_library_catalog',
    questionPaperLibrary: 'kagie_question_paper_library_catalog',
    docs: 'kagie_docs',
    docReviews: 'kagie_doc_reviews',
    pastPaperProgress: 'kagie_past_paper_progress',
    supportChats: 'kagie_support_chats',
    callRequests: 'kagie_call_requests',
    assistantActivity: 'kagie_assistant_activity',
    notes: 'kagie_notes',
    settings: 'kagie_settings',
    cartPrefix: 'kagie_cart_',
    pendingPromoCode: 'kagie_pending_promo_code',
    supabaseSessionCache: 'kagie_supabase_session_cache',
    logoutIntent: 'kagie_logout_intent'
  };

  const STATUS = {
    application: {
      DRAFT: 'Draft',
      SUBMITTED: 'Submitted',
      UNDER_REVIEW: 'Under Review',
      MISSING_DOCUMENTS: 'Missing Documents',
      READY_TO_APPLY: 'Ready to Apply',
      APPLIED: 'Applied',
      PENDING_FEEDBACK: 'Pending Feedback',
      ACCEPTED: 'Accepted',
      REJECTED: 'Rejected',
      PROCESSING: 'Application being processed'
    },
    payment: {
      PENDING: 'Payment Pending',
      PENDING_VERIFICATION: 'Pending Verification',
      VERIFIED: 'Verified',
      REJECTED: 'Rejected',
      FAILED: 'Failed',
      CANCELLED: 'Cancelled',
      REFUNDED: 'Refunded'
    },
    doc: {
      PENDING: 'Pending Review',
      APPROVED: 'Approved',
      REJECTED: 'Rejected'
    },
    callback: {
      PENDING: 'Pending',
      CONTACTED: 'Contacted',
      RESOLVED: 'Resolved'
    }
  };

  const ROLES = {
    USER: 'user',
    ASSISTANT: 'assistant_admin',
    MASTER: 'master_admin'
  };

  function normalizeKagieRole(roleArg, fallbackRole = ROLES.USER) {
    const role = String(roleArg || '').trim().toLowerCase();
    if (!role) return fallbackRole;

    if (
      role === ROLES.MASTER ||
      role === 'master admin' ||
      role === 'master-admin' ||
      role === 'masteradmin' ||
      role === 'super_admin' ||
      role === 'super-admin' ||
      role === 'super admin' ||
      role === 'superadmin' ||
      role === 'owner'
    ) {
      return ROLES.MASTER;
    }

    if (
      role === ROLES.ASSISTANT ||
      role === 'assistant' ||
      role === 'assistant admin' ||
      role === 'assistant-admin' ||
      role === 'assistantadmin' ||
      role === 'admin' ||
      role === 'administrator' ||
      role === 'staff' ||
      role === 'support' ||
      role === 'support_staff' ||
      role === 'support-staff' ||
      role === 'support staff'
    ) {
      return ROLES.ASSISTANT;
    }

    if (role === ROLES.USER || role === 'learner' || role === 'student' || role === 'authenticated') {
      return ROLES.USER;
    }

    if (role === 'parent' || role === 'guardian') {
      return 'parent';
    }

    if (role === 'teacher' || role === 'educator' || role === 'school_admin' || role === 'school-admin' || role === 'school admin') {
      return 'teacher';
    }

    return fallbackRole;
  }

  function getKagieRoleVariants(roleArg) {
    const canonicalRole = normalizeKagieRole(roleArg, String(roleArg || '').trim().toLowerCase() || ROLES.USER);

    if (canonicalRole === ROLES.MASTER) {
      return [
        ROLES.MASTER,
        'master admin',
        'master-admin',
        'masteradmin',
        'super_admin',
        'super-admin',
        'super admin',
        'superadmin',
        'owner'
      ];
    }

    if (canonicalRole === ROLES.ASSISTANT) {
      return [
        ROLES.ASSISTANT,
        'assistant',
        'assistant admin',
        'assistant-admin',
        'assistantadmin',
        'admin',
        'administrator',
        'staff',
        'support',
        'support_staff',
        'support-staff',
        'support staff'
      ];
    }

    if (canonicalRole === 'parent') {
      return ['parent', 'guardian'];
    }

    if (canonicalRole === 'teacher') {
      return ['teacher', 'educator', 'school_admin', 'school-admin', 'school admin'];
    }

    return [ROLES.USER, 'learner', 'student', 'authenticated'];
  }

  function normalizeUserRecord(userArg) {
    if (!userArg || typeof userArg !== 'object') return userArg;
    const next = { ...userArg };
    next.role = normalizeKagieRole(next.role, String(next.role || '').trim() || ROLES.USER);
    return next;
  }

  const DEFAULT_SETTINGS = {
      appName: 'Kagie',
      currency: 'ZAR',
      supportPhone: '',
      supportEmail: '',
      payments: {
        merchantName: 'Kagie',
        bankName: '',
        accountNumber: '',
        accountType: 'Business Account',
        branchCode: '',
        referencePrefix: 'KAG',
        verificationMessage: 'Payments are confirmed automatically by Yoco after checkout.',
        yocoEnabled: true,
        yocoCheckoutEndpoint: '',
        yocoPaymentLink: '',
        yocoProviderLabel: 'Yoco secure checkout',
        payfastEnabled: false,
        payfastCheckoutEndpoint: '',
        payfastProviderLabel: 'PayFast secure checkout'
      },
      supabase: {
        enabled: false,
        url: '',
        anonKey: '',
        profileTable: 'profiles',
        syncProfiles: true,
        adminConfigStatusEndpoint: '',
        adminCreateAssistantEndpoint: '',
        adminBootstrapMasterEndpoint: '',
        authRoleEndpoint: '',
        adminMarketingBroadcastEndpoint: ''
      }
    };

  const DEFAULT_EXPERIENCE_PREFERENCES = {
    lowDataMode: false,
    reducedMotion: false,
    compactDashboard: false,
    connectionMode: 'standard'
  };

  let supabaseClient = null;
  let remotePackCache = null;
  let remotePromoCache = null;
  let packCatalogCache = null;
  let promoCatalogCache = null;
  let institutionCatalogCache = null;
  let remoteInstitutionCatalogCache = null;
  let accommodationListingCache = null;
  let transportOptionCache = null;
  const institutionQueryCache = new Map();
  const PAYMENT_NOTE_PREFIX = '__KAGIE_PAYMENT_META__';
  const PORTAL_ACCESS_NOTE_PREFIX = '__KAGIE_PORTAL_ACCESS__';
  const LEARNER_SUPPORT_NOTE_PREFIX = '__KAGIE_LEARNER_SUPPORT__';

  function getLocationSnapshot() {
    try {
      return window.location || null;
    } catch (error) {
      return null;
    }
  }

  function isLocalEnvironment() {
    const locationRef = getLocationSnapshot();
    if (!locationRef) return true;
    const host = String(locationRef.hostname || '').trim().toLowerCase();
    return locationRef.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function isLocalStaffSession(userArg) {
    const user = userArg || null;
    if (!isLocalEnvironment() || !user) return false;
    const role = normalizeKagieRole(user.role, String(user.role || '').trim());
    const source = String(user.source || '').trim().toLowerCase();
    const supabaseUserId = String(user.supabaseUserId || '').trim();
    return (role === ROLES.ASSISTANT || role === ROLES.MASTER) && source === 'local' && !supabaseUserId;
  }

  function clearCachedSupabaseSessionTokens() {
    write(KEYS.supabaseSessionCache, null);
    try {
      const settings = getSettings();
      const supabaseUrl = String(settings?.supabase?.url || '');
      const projectRef = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] : '';
      const clearKeys = (storage) => {
        if (!storage) return;
        Object.keys(storage).forEach((key) => {
          if (
            key.startsWith('sb-') &&
            (!projectRef || key.includes(`sb-${projectRef}-`))
          ) {
            storage.removeItem(key);
          }
        });
      };
      clearKeys(localStorage);
      clearKeys(window.sessionStorage);
    } catch (err) {
      console.warn('Supabase token cleanup failed:', err);
    }
  }

  function markLogoutIntent() {
    write(KEYS.logoutIntent, { at: Date.now() });
  }

  function clearLogoutIntent() {
    write(KEYS.logoutIntent, null);
  }

  function hasRecentLogoutIntent() {
    const raw = read(KEYS.logoutIntent, null);
    const at = Number(raw?.at || raw || 0);
    return Number.isFinite(at) && at > 0 && (Date.now() - at) < 15000;
  }

  function shouldSeedLocalStaffAccounts() {
    const settings = read(KEYS.settings, DEFAULT_SETTINGS);
    if (settings?.allowSeedStaffAccounts === true) return true;
    return isLocalEnvironment();
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function uid(prefix = 'kg') {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch (err) {
      console.error(`Failed to read ${key}`, err);
      return clone(fallback);
    }
  }

  function readSession(key, fallback) {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch (err) {
      console.error(`Failed to read session ${key}`, err);
      return clone(fallback);
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Failed to write ${key}`, err);
      return false;
    }
  }

  function writeSession(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Failed to write session ${key}`, err);
      return false;
    }
  }

  function mergeDeep(target, patch) {
    const out = Array.isArray(target) ? [...target] : { ...(target || {}) };
    Object.keys(patch || {}).forEach((key) => {
      const nextVal = patch[key];
      const prevVal = out[key];
      if (
        nextVal &&
        typeof nextVal === 'object' &&
        !Array.isArray(nextVal) &&
        prevVal &&
        typeof prevVal === 'object' &&
        !Array.isArray(prevVal)
      ) {
        out[key] = mergeDeep(prevVal, nextVal);
      } else {
        out[key] = nextVal;
      }
    });
    return out;
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function shouldRememberLogin() {
    return Boolean(read(KEYS.loginPersistence, { remember: false })?.remember);
  }

  function hasActiveSessionMarker() {
    return Boolean(readSession(KEYS.activeSession, { active: false })?.active);
  }

  function getActiveSessionState() {
    const state = readSession(KEYS.activeSession, { active: false, updatedAt: 0 }) || {};
    return {
      active: Boolean(state.active),
      updatedAt: Number(state.updatedAt || 0)
    };
  }

  function setLoginPersistence(remember) {
    const persist = Boolean(remember);
    write(KEYS.loginPersistence, {
      remember: persist,
      updatedAt: Date.now()
    });

    const current = currentUserRaw();
    if (current) setCurrentUser(current, { persist });
    return persist;
  }

  function normalizePhoneNumber(phone) {
    let value = String(phone || '').trim();
    if (!value) return '';
    value = value.replace(/[^\d+]/g, '');
    if (value.startsWith('00')) value = `+${value.slice(2)}`;
    if (value.startsWith('0')) value = `+27${value.slice(1)}`;
    if (!value.startsWith('+') && /^\d{9}$/.test(value)) value = `+27${value}`;
    return value;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseImageList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundMoney(value) {
    return Math.round(toNumber(value, 0) * 100) / 100;
  }

  function formatMoneyLabel(value) {
    return `R${roundMoney(value).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  function normalizePromoCodeValue(value) {
    return String(value || '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 9);
  }

  function generateRandomPromoCode(length = 9) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    while (code.length < length) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function parsePaymentNoteState(rawNote) {
    const fallback = {
      customerNote: String(rawNote || '').trim(),
      verificationNote: '',
      rejectionReason: '',
      proofDocumentId: '',
      proofFileName: '',
      proofUploadedAt: '',
      reviewedAt: '',
      verifiedAt: '',
      promoCode: '',
      promoTitle: '',
      offerNote: '',
      discountAmount: ''
    };

    const source = String(rawNote || '').trim();
    if (!source.startsWith(PAYMENT_NOTE_PREFIX)) return fallback;

    try {
      const payload = JSON.parse(source.slice(PAYMENT_NOTE_PREFIX.length));
      return {
        customerNote: String(payload?.customerNote || ''),
        verificationNote: String(payload?.verificationNote || ''),
        rejectionReason: String(payload?.rejectionReason || ''),
        proofDocumentId: String(payload?.proofDocumentId || ''),
        proofFileName: String(payload?.proofFileName || ''),
        proofUploadedAt: String(payload?.proofUploadedAt || ''),
        reviewedAt: String(payload?.reviewedAt || ''),
        verifiedAt: String(payload?.verifiedAt || ''),
        promoCode: normalizePromoCodeValue(payload?.promoCode || ''),
        promoTitle: String(payload?.promoTitle || ''),
        offerNote: String(payload?.offerNote || ''),
        discountAmount: String(payload?.discountAmount || ''),
        gatewayProvider: String(payload?.gatewayProvider || ''),
        gatewayCheckoutId: String(payload?.gatewayCheckoutId || ''),
        gatewayPaymentId: String(payload?.gatewayPaymentId || ''),
        gatewayStatus: String(payload?.gatewayStatus || '')
      };
    } catch (error) {
      console.warn('Could not parse payment note metadata.', error);
      return fallback;
    }
  }

  function serializePaymentNoteState(payment) {
    const note = String(payment?.note || '').trim();
      const meta = {
        customerNote: note,
        verificationNote: String(payment?.verificationNote || '').trim(),
        rejectionReason: String(payment?.rejectionReason || '').trim(),
        proofDocumentId: String(payment?.proofDocumentId || '').trim(),
        proofFileName: String(payment?.proofFileName || '').trim(),
        proofUploadedAt: String(payment?.proofUploadedAt || '').trim(),
        reviewedAt: String(payment?.reviewedAt || '').trim(),
        verifiedAt: String(payment?.verifiedAt || '').trim(),
        promoCode: normalizePromoCodeValue(payment?.promoCode || '').trim(),
        promoTitle: String(payment?.promoTitle || '').trim(),
        offerNote: String(payment?.offerNote || '').trim(),
        discountAmount: String(payment?.discountAmount || '').trim(),
        gatewayProvider: String(payment?.gatewayProvider || '').trim(),
        gatewayCheckoutId: String(payment?.gatewayCheckoutId || '').trim(),
        gatewayPaymentId: String(payment?.gatewayPaymentId || '').trim(),
        gatewayStatus: String(payment?.gatewayStatus || '').trim()
      };
    const hasMeta = Object.entries(meta).some(([key, value]) => key !== 'customerNote' && value);
    return hasMeta ? `${PAYMENT_NOTE_PREFIX}${JSON.stringify(meta)}` : note;
  }

  function portalAccessHasData(entry) {
    return Boolean(
      entry?.institutionName ||
      entry?.portalLink ||
      entry?.applicationNumber ||
      entry?.studentNumber ||
      entry?.username ||
      entry?.password ||
      entry?.deliveryNote ||
      entry?.note
    );
  }

  function normalizePortalAccessEntry(entryArg, fallbackIndex) {
    const source = entryArg && typeof entryArg === 'object' ? entryArg : {};
    return {
      id: String(source.id || uid(`portal_${fallbackIndex || 1}`)).trim(),
      institutionName: String(source.institutionName || source.institution || '').trim(),
      portalLink: String(source.portalLink || source.portalUrl || source.url || '').trim(),
      applicationNumber: String(source.applicationNumber || source.reference || '').trim(),
      studentNumber: String(source.studentNumber || '').trim(),
      username: String(source.username || source.portalUsername || source.email || '').trim(),
      password: String(source.password || source.pin || source.tempPassword || '').trim(),
      deliveryNote: String(source.deliveryNote || source.passwordSource || source.howReceived || '').trim(),
      note: String(source.note || '').trim(),
      updatedAt: String(source.updatedAt || nowISO()).trim(),
      updatedBy: String(source.updatedBy || '').trim()
    };
  }

  function isPortalAccessNoteText(noteText) {
    return String(noteText || '').trim().startsWith(PORTAL_ACCESS_NOTE_PREFIX);
  }

  function serializePortalAccessState(entriesArg) {
    const entries = safeArray(entriesArg)
      .map((entry, index) => normalizePortalAccessEntry(entry, index + 1))
      .filter(portalAccessHasData);
    return `${PORTAL_ACCESS_NOTE_PREFIX}${JSON.stringify({ entries })}`;
  }

  function parsePortalAccessState(rawNote) {
    const raw = String(rawNote || '').trim();
    if (!isPortalAccessNoteText(raw)) return [];
    try {
      const payload = JSON.parse(raw.slice(PORTAL_ACCESS_NOTE_PREFIX.length));
      const source = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.entries)
          ? payload.entries
          : payload && typeof payload === 'object'
            ? [payload]
            : [];
      return source
        .map((entry, index) => normalizePortalAccessEntry(entry, index + 1))
        .filter(portalAccessHasData);
    } catch (error) {
      console.warn('Could not parse portal access metadata.', error);
      return [];
    }
  }

  function extractPortalAccessFromNotes(notesArg) {
    const notes = safeArray(notesArg).slice().sort((a, b) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
      return bTime - aTime;
    });

    for (const note of notes) {
      const rawText = String(note?.text || note?.note || '').trim();
      if (!isPortalAccessNoteText(rawText)) continue;
      return parsePortalAccessState(rawText);
    }
    return [];
  }

  function normalizeYesNoValue(value, fallback = '') {
    const text = String(value || '').trim().toLowerCase();
    if (['yes', 'true', '1'].includes(text)) return 'yes';
    if (['no', 'false', '0'].includes(text)) return 'no';
    return fallback;
  }

  function normalizeLearnerSupportNeeds(dataArg) {
    const source = dataArg && typeof dataArg === 'object' ? dataArg : {};
    const hasDisability = normalizeYesNoValue(source.hasDisability, '');
    return {
      needsBursary: normalizeYesNoValue(source.needsBursary || source.bursaryRequired, ''),
      needsResidence: normalizeYesNoValue(source.needsResidence || source.residenceRequired, ''),
      hasDisability,
      disabilityDescription: hasDisability === 'yes' ? String(source.disabilityDescription || '').trim() : ''
    };
  }

  function learnerSupportHasData(dataArg) {
    const data = normalizeLearnerSupportNeeds(dataArg);
    return Boolean(data.needsBursary || data.needsResidence || data.hasDisability || data.disabilityDescription);
  }

  function isLearnerSupportNoteText(noteText) {
    return String(noteText || '').trim().startsWith(LEARNER_SUPPORT_NOTE_PREFIX);
  }

  function isSystemApplicationNoteText(noteText) {
    return isPortalAccessNoteText(noteText) || isLearnerSupportNoteText(noteText);
  }

  function serializeLearnerSupportState(dataArg) {
    return `${LEARNER_SUPPORT_NOTE_PREFIX}${JSON.stringify(normalizeLearnerSupportNeeds(dataArg))}`;
  }

  function parseLearnerSupportState(rawNote) {
    const raw = String(rawNote || '').trim();
    if (!isLearnerSupportNoteText(raw)) return normalizeLearnerSupportNeeds({});
    try {
      return normalizeLearnerSupportNeeds(JSON.parse(raw.slice(LEARNER_SUPPORT_NOTE_PREFIX.length)));
    } catch (error) {
      console.warn('Could not parse learner support metadata.', error);
      return normalizeLearnerSupportNeeds({});
    }
  }

  function extractLearnerSupportFromNotes(notesArg) {
    const notes = safeArray(notesArg).slice().sort((a, b) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
      return bTime - aTime;
    });

    for (const note of notes) {
      const rawText = String(note?.text || note?.note || '').trim();
      if (!isLearnerSupportNoteText(rawText)) continue;
      return parseLearnerSupportState(rawText);
    }
    return normalizeLearnerSupportNeeds({});
  }

  function normalizePaymentDetails(payment, paymentStatusArg) {
    if (!payment) return null;
    const source = payment && typeof payment === 'object' ? payment : {};
    const noteState = parsePaymentNoteState(source.note || '');
    const status = source.status || paymentStatusArg || STATUS.payment.PENDING;

    return {
      payerName: String(source.payerName || ''),
      phone: String(source.phone || ''),
      reference: String(source.reference || ''),
      note: noteState.customerNote,
      method: String(source.method || ''),
      amount: Number(source.amount || 0),
      status,
      verificationNote: String(source.verificationNote || noteState.verificationNote || ''),
      rejectionReason: String(source.rejectionReason || noteState.rejectionReason || ''),
      proofDocumentId: String(source.proofDocumentId || noteState.proofDocumentId || ''),
      proofFileName: String(source.proofFileName || noteState.proofFileName || ''),
      proofUploadedAt: String(source.proofUploadedAt || noteState.proofUploadedAt || ''),
      reviewedAt: String(source.reviewedAt || noteState.reviewedAt || ''),
      verifiedAt: String(source.verifiedAt || noteState.verifiedAt || ''),
      promoCode: normalizePromoCodeValue(source.promoCode || noteState.promoCode || ''),
      promoTitle: String(source.promoTitle || noteState.promoTitle || ''),
      offerNote: String(source.offerNote || noteState.offerNote || ''),
      discountAmount: roundMoney(source.discountAmount || noteState.discountAmount || 0),
      gatewayProvider: String(source.gatewayProvider || noteState.gatewayProvider || ''),
      gatewayCheckoutId: String(source.gatewayCheckoutId || noteState.gatewayCheckoutId || ''),
      gatewayPaymentId: String(source.gatewayPaymentId || noteState.gatewayPaymentId || ''),
      gatewayStatus: String(source.gatewayStatus || noteState.gatewayStatus || ''),
      currency: String(source.currency || 'ZAR'),
      paidAt: source.paidAt || '',
      failureReason: String(source.failureReason || ''),
      submittedAt: source.submittedAt || null
    };
  }

  function normalizeStoredApplication(app) {
    if (!app || typeof app !== 'object') return null;
    const safeApp = clone(app);
    safeApp.payment = normalizePaymentDetails(safeApp.payment, safeApp.paymentStatus);
    safeApp.timeline = safeArray(safeApp.timeline);
    safeApp.institutions = safeArray(safeApp.institutions);
    safeApp.services = safeArray(safeApp.services);
    safeApp.forms = safeApp.forms && typeof safeApp.forms === 'object' ? safeApp.forms : {};
    safeApp.forms.learner = {
      ...(safeApp.forms.learner || {}),
      ...normalizeLearnerSupportNeeds(safeApp.forms?.learner || {})
    };
    safeApp.forms = safeApp.forms && typeof safeApp.forms === 'object' ? safeApp.forms : {};
    safeApp.forms.portalAccess = safeArray(safeApp.forms.portalAccess)
      .map((entry, index) => normalizePortalAccessEntry(entry, index + 1))
      .filter(portalAccessHasData);
    return safeApp;
  }

  function sanitizeProfileObject(value) {
    const source = value && typeof value === 'object' ? value : {};
    const clean = {};
    Object.keys(source).forEach((key) => {
      if (key === 'profile' || key === 'password') return;
      clean[key] = source[key];
    });
    clean.marks = safeArray(clean.marks).map((mark) => ({
      subject: String(mark?.subject || ''),
      percent: Number(mark?.percent || 0),
      level: Number(mark?.level || 0)
    })).filter((mark) => mark.subject);
    return clean;
  }

  function getKagieData() {
    const data = window.KagieData || {};
    const nscSubjects = safeArray(data.nscSubjects && data.nscSubjects.length ? data.nscSubjects : data.dbeSubjects);
    const iebSubjects = safeArray(data.iebSubjects && data.iebSubjects.length ? data.iebSubjects : nscSubjects);
    const mergedHighSchools = [];
    const seenHighSchools = new Set();
    safeArray(data.highSchools)
      .concat(safeArray(window.KAGIE_HIGH_SCHOOLS))
      .forEach((school) => {
        const key = String(
          school?.id ||
          [school?.name, school?.province, school?.district, school?.town]
            .map((part) => String(part || '').trim().toLowerCase())
            .join('|')
        ).trim();
        if (!key || seenHighSchools.has(key)) return;
        seenHighSchools.add(key);
        mergedHighSchools.push(school);
      });
    const mergedInstitutions = [];
    const seenInstitutions = new Set();
    safeArray(data.institutions)
      .concat(safeArray(window.KAGIE_INSTITUTIONS))
      .forEach((institution) => {
        const key = String(
          institution?.name || institution?.institution || ''
        ).trim();
        const normalizedKey = normalizeInstitutionNameKey ? normalizeInstitutionNameKey(key) : key.toLowerCase();
        if (!normalizedKey || seenInstitutions.has(normalizedKey)) return;
        seenInstitutions.add(normalizedKey);
        mergedInstitutions.push(institution);
      });
    return {
      provinces: safeArray(data.provinces),
      homeLanguages: safeArray(data.homeLanguages),
      genders: safeArray(data.genders),
      schoolTypes: safeArray(data.schoolTypes),
      dbeSubjects: safeArray(data.dbeSubjects && data.dbeSubjects.length ? data.dbeSubjects : nscSubjects),
      nscSubjects,
      iebSubjects,
      highSchools: mergedHighSchools,
      applicationPacks: safeArray(data.applicationPacks),
      extraServices: safeArray(data.extraServices),
      accommodationListings: safeArray(data.accommodationListings),
      transportOptions: safeArray(data.transportOptions),
      institutions: mergedInstitutions,
      prospectus: safeArray(data.prospectus),
      updates: safeArray(data.updates),
      pastPapers: safeArray(data.pastPapers),
      pastPaperBlueprint: clone(data.pastPaperBlueprint || {})
    };
  }

  function sanitizeUser(user) {
    if (!user) return null;
    const safe = normalizeUserRecord(user);
    delete safe.password;
    return safe;
  }

  function normalizePackCatalogEntry(item, fallbackIndex) {
    const source = item && typeof item === 'object' ? item : {};
    const code = String(source.code || source.id || `pack_${fallbackIndex || 1}`).trim();
    const rawLimit = source.institutionLimit ?? source.institution_limit;
    const isUnlimited = rawLimit === 'unlimited' || rawLimit === null || rawLimit === undefined || source.isUnlimited || source.is_unlimited;
    return {
      id: code,
      code,
      remoteId: String(source.remoteId || (source.code ? source.id || '' : '')).trim(),
      name: String(source.name || '').trim(),
      price: Number(source.price || 0),
      institutionLimit: isUnlimited ? 'unlimited' : Math.max(0, Number(rawLimit || 0)),
      isUnlimited,
      highlight: String(source.highlight || '').trim(),
      description: String(source.description || '').trim(),
      isActive: source.isActive !== false && source.is_active !== false,
      sortOrder: Number(source.sortOrder || fallbackIndex || 0),
      createdAt: source.createdAt || source.created_at || nowISO(),
      updatedAt: source.updatedAt || source.updated_at || nowISO()
    };
  }

  function invalidatePackCatalogCache() {
    packCatalogCache = null;
    remotePackCache = null;
    return true;
  }

  function getPackOverrideStore() {
    return read(KEYS.applicationPacksCatalog, []);
  }

  function savePackOverrideStore(records) {
    write(KEYS.applicationPacksCatalog, records);
    invalidatePackCatalogCache();
    return records;
  }

  function getMergedPackCatalogRecords() {
    if (packCatalogCache) return packCatalogCache.map(clone);

    const base = safeArray(getKagieData().applicationPacks).map((item, index) => normalizePackCatalogEntry(item, index + 1));
    const merged = new Map(base.map((item) => [item.id, item]));

    safeArray(remotePackCache).forEach((entry, index) => {
      const normalized = normalizePackCatalogEntry({
        ...entry,
        id: entry?.code || entry?.id,
        code: entry?.code || entry?.id,
        remoteId: entry?.id || ''
      }, base.length + index + 1);
      if (!normalized.id) return;
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, normalizePackCatalogEntry(existing ? mergeDeep(existing, normalized) : normalized, existing?.sortOrder || index + 1));
    });

    safeArray(getPackOverrideStore()).forEach((entry, index) => {
      const normalized = normalizePackCatalogEntry(entry, base.length + index + 1);
      if (!normalized.id) return;
      if (entry?._deleted) {
        merged.delete(normalized.id);
        return;
      }
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, normalizePackCatalogEntry(existing ? mergeDeep(existing, normalized) : normalized, existing?.sortOrder || index + 1));
    });

    packCatalogCache = Array.from(merged.values())
      .filter((item) => item.name)
      .sort((a, b) => {
        const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
        if (orderDiff) return orderDiff;
        return a.name.localeCompare(b.name);
      });

    return packCatalogCache.map(clone);
  }

  function getPackById(packId) {
    return getMergedPackCatalogRecords().find((item) => item.id === packId || item.code === packId) || null;
  }

  function getPackCatalog() {
    return getMergedPackCatalogRecords()
      .filter((item) => item.isActive !== false)
      .map(clone);
  }

  function getPacksForAdmin() {
    requireRole([ROLES.MASTER]);
    return getMergedPackCatalogRecords().map(clone);
  }

  function updatePackByAdmin(packId, patch) {
    requireRole([ROLES.MASTER]);

    const current = getPackById(packId);
    if (!current) throw new Error('Package not found.');

    const nextPrice = Number(patch?.price ?? current.price);
    if (!Number.isFinite(nextPrice) || nextPrice < 250 || nextPrice > 1000) {
      throw new Error('Package price must stay between R250 and R1000.');
    }

    const store = getPackOverrideStore();
    const index = store.findIndex((item) => String(item?.id || item?.code || '') === current.id);
    const merged = normalizePackCatalogEntry({
      ...current,
      ...patch,
      id: current.id,
      code: current.code || current.id,
      remoteId: current.remoteId || '',
      price: nextPrice,
      institutionLimit: current.institutionLimit,
      isUnlimited: current.isUnlimited || current.institutionLimit === 'unlimited',
      updatedAt: nowISO()
    }, current.sortOrder || index + 1);

    if (index >= 0) store[index] = mergeDeep(store[index], merged);
    else store.push(merged);

    savePackOverrideStore(store);
    return getPackById(current.id) || merged;
  }

  function normalizePromoDiscountKind(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'amount' || text === 'flat') return 'amount';
    if (text === 'free_application_pack' || text === 'free_pack' || text === 'free') return 'free_application_pack';
    return 'percent';
  }

  function normalizePromoCampaignEntry(item, fallbackIndex) {
    const source = item && typeof item === 'object' ? item : {};
    const code = normalizePromoCodeValue(source.code || source.id || generateRandomPromoCode());
    const redeemedUserIds = safeArray(source.redeemedUserIds || source.redeemed_user_ids)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const usedCount = Math.max(redeemedUserIds.length, Math.max(0, Number(source.usedCount ?? source.used_count ?? 0) || 0));
    return {
      id: code,
      code,
      remoteId: String(source.remoteId || (source.code ? source.id || '' : '')).trim(),
      title: String(source.title || source.name || `Promo ${code}`).trim(),
      description: String(source.description || '').trim(),
      discountKind: normalizePromoDiscountKind(source.discountKind || source.discount_kind),
      discountValue: roundMoney(source.discountValue ?? source.discount_value ?? source.value ?? 0),
      offerNote: String(source.offerNote || source.offer_note || '').trim(),
      maxUses: Math.max(0, Number(source.maxUses ?? source.max_uses ?? 0) || 0),
      usedCount,
      redeemedUserIds,
      isActive: source.isActive !== false && source.is_active !== false,
      sharePath: String(source.sharePath || source.share_path || `signup.html?promo=${encodeURIComponent(code)}`).trim(),
      createdAt: source.createdAt || source.created_at || nowISO(),
      updatedAt: source.updatedAt || source.updated_at || nowISO(),
      _deleted: !!source._deleted
    };
  }

  function invalidatePromoCatalogCache() {
    promoCatalogCache = null;
    remotePromoCache = null;
    return true;
  }

  function getPromoOverrideStore() {
    return read(KEYS.promoCampaigns, []);
  }

  function savePromoOverrideStore(records) {
    write(KEYS.promoCampaigns, records);
    invalidatePromoCatalogCache();
    return records;
  }

  function getMergedPromoCampaignRecords() {
    if (promoCatalogCache) return promoCatalogCache.map(clone);

    const merged = new Map();
    safeArray(remotePromoCache).forEach((entry, index) => {
      const normalized = normalizePromoCampaignEntry(entry, index + 1);
      if (normalized.code) merged.set(normalized.code, normalized);
    });

    safeArray(getPromoOverrideStore()).forEach((entry, index) => {
      const normalized = normalizePromoCampaignEntry(entry, index + 1);
      if (!normalized.code) return;
      if (entry?._deleted) {
        merged.delete(normalized.code);
        return;
      }
      const current = merged.get(normalized.code);
      merged.set(normalized.code, normalizePromoCampaignEntry(current ? mergeDeep(current, normalized) : normalized, index + 1));
    });

    promoCatalogCache = Array.from(merged.values())
      .filter((entry) => entry.code)
      .sort((a, b) => String(a.title || a.code).localeCompare(String(b.title || b.code)));
    return promoCatalogCache.map(clone);
  }

  function getPromoCampaigns(optionsArg) {
    const options = optionsArg || {};
    let records = getMergedPromoCampaignRecords();
    if (options.includeInactive !== true) {
      records = records.filter((entry) => entry.isActive !== false);
    }
    return records.map(clone);
  }

  function getPromoCodesForAdmin() {
    requireRole([ROLES.MASTER]);
    return getMergedPromoCampaignRecords().map(clone);
  }

  function getPromoCampaignByCode(codeArg, optionsArg) {
    const code = normalizePromoCodeValue(codeArg);
    if (!code) return null;
    const options = optionsArg || {};
    return getMergedPromoCampaignRecords().find((entry) => entry.code === code && (options.includeInactive === true || entry.isActive !== false)) || null;
  }

  function savePendingPromoCode(codeArg) {
    const code = normalizePromoCodeValue(codeArg);
    if (code) write(KEYS.pendingPromoCode, code);
    else write(KEYS.pendingPromoCode, '');
    return code;
  }

  function getPendingPromoCode() {
    return normalizePromoCodeValue(read(KEYS.pendingPromoCode, ''));
  }

  function capturePendingPromoCodeFromLocation() {
    const locationRef = getLocationSnapshot();
    if (!locationRef?.search) return getPendingPromoCode();
    try {
      const params = new URLSearchParams(locationRef.search);
      const code = normalizePromoCodeValue(params.get('promo') || params.get('ref') || params.get('code'));
      if (!code) return getPendingPromoCode();
      savePendingPromoCode(code);
      return code;
    } catch (_error) {
      return getPendingPromoCode();
    }
  }

  function createPromoCampaignByAdmin(input) {
    requireRole([ROLES.MASTER]);

    const code = normalizePromoCodeValue(input?.code || generateRandomPromoCode());
    const title = String(input?.title || `Promo ${code}`).trim();
    if (!code || code.length !== 9) throw new Error('Promo code must be 9 letters or numbers.');
    if (!title) throw new Error('Promo title is required.');

    const current = getPromoCampaignByCode(code, { includeInactive: true });
    if (current) throw new Error('That promo code already exists.');

    const entry = normalizePromoCampaignEntry({
      code,
      title,
      description: input?.description || '',
      discountKind: input?.discountKind || input?.discount_kind || 'percent',
      discountValue: input?.discountValue ?? input?.discount_value ?? input?.value ?? 0,
      offerNote: input?.offerNote || input?.offer_note || '',
      maxUses: input?.maxUses ?? input?.max_uses ?? 0,
      isActive: input?.isActive !== false && input?.is_active !== false,
      sharePath: input?.sharePath || input?.share_path || `signup.html?promo=${encodeURIComponent(code)}`,
      redeemedUserIds: []
    }, getPromoOverrideStore().length + 1);

    const records = getPromoOverrideStore();
    records.push(entry);
    savePromoOverrideStore(records);
    return getPromoCampaignByCode(code, { includeInactive: true }) || entry;
  }

  function updatePromoCampaignByAdmin(codeArg, patch) {
    requireRole([ROLES.MASTER]);

    const code = normalizePromoCodeValue(codeArg);
    const current = getPromoCampaignByCode(code, { includeInactive: true });
    if (!current) throw new Error('Promo code not found.');

    const records = getPromoOverrideStore();
    const index = records.findIndex((entry) => normalizePromoCodeValue(entry?.code || entry?.id) === code);
    const next = normalizePromoCampaignEntry({
      ...current,
      ...patch,
      code,
      updatedAt: nowISO()
    }, index + 1);

    if (index >= 0) records[index] = mergeDeep(records[index], next);
    else records.push(next);
    savePromoOverrideStore(records);
    return getPromoCampaignByCode(code, { includeInactive: true }) || next;
  }

  function deletePromoCampaignByAdmin(codeArg) {
    requireRole([ROLES.MASTER]);

    const code = normalizePromoCodeValue(codeArg);
    const current = getPromoCampaignByCode(code, { includeInactive: true });
    if (!current) throw new Error('Promo code not found.');

    const records = getPromoOverrideStore();
    const index = records.findIndex((entry) => normalizePromoCodeValue(entry?.code || entry?.id) === code);
    const tombstone = {
      ...(index >= 0 ? records[index] : current),
      code,
      _deleted: true,
      updatedAt: nowISO()
    };

    if (index >= 0) records[index] = tombstone;
    else records.push(tombstone);
    savePromoOverrideStore(records);
    return true;
  }

  function getPromoBenefitLabel(promoArg) {
    const promo = normalizePromoCampaignEntry(promoArg || {});
    if (promo.discountKind === 'free_application_pack') return 'Free application pack';
    if (promo.discountKind === 'amount') return `${formatMoneyLabel(promo.discountValue)} off`;
    return `${Math.max(0, Number(promo.discountValue || 0))}% off`;
  }

  function normalizeMarketingCategory(valueArg) {
    const value = String(valueArg || '').trim().toLowerCase();
    if (value === 'bursary_updates' || value === 'bursaries') return 'bursary_updates';
    if (value === 'internships' || value === 'learnerships') return 'internships';
    if (value === 'closing_dates' || value === 'deadlines') return 'closing_dates';
    if (value === 'application_reopenings' || value === 'reopenings' || value === 'reopening') return 'application_reopenings';
    if (value === 'late_applications' || value === 'late_application') return 'late_applications';
    return 'general_updates';
  }

  function getMarketingCategoryLabel(categoryArg) {
    const category = normalizeMarketingCategory(categoryArg);
    if (category === 'bursary_updates') return 'Bursary updates';
    if (category === 'internships') return 'Internships and learnerships';
    if (category === 'closing_dates') return 'Closing dates';
    if (category === 'application_reopenings') return 'Application reopenings';
    if (category === 'late_applications') return 'Late applications';
    return 'General updates';
  }

  function normalizeMarketingAudience(valueArg) {
    const value = String(valueArg || '').trim().toLowerCase();
    if (value === 'all_accounts' || value === 'everyone' || value === 'all') return 'all_accounts';
    return 'learners';
  }

  function normalizeMarketingChannels(sourceArg) {
    const source = sourceArg && typeof sourceArg === 'object' ? sourceArg : {};
    const fallbackApp = source.inApp ?? source.app ?? source.push ?? source.notification;
    const fallbackEmail = source.email ?? source.mail;
    const fallbackSms = source.sms ?? source.text;
    return {
      inApp: fallbackApp !== false,
      email: Boolean(fallbackEmail),
      sms: Boolean(fallbackSms)
    };
  }

  function normalizeMarketingCampaignEntry(entryArg, fallbackIndex) {
    const entry = entryArg && typeof entryArg === 'object' ? entryArg : {};
    const delivery = entry.delivery && typeof entry.delivery === 'object' ? entry.delivery : {};
    const warnings = safeArray(entry.warnings).map((item) => String(item || '').trim()).filter(Boolean);
    return {
      id: String(entry.id || uid('campaign')).trim() || uid('campaign'),
      title: String(entry.title || 'Marketing update').trim() || 'Marketing update',
      message: String(entry.message || '').trim(),
      type: String(entry.type || 'info').trim().toLowerCase() || 'info',
      category: normalizeMarketingCategory(entry.category),
      categoryLabel: getMarketingCategoryLabel(entry.category),
      audience: normalizeMarketingAudience(entry.audience),
      channels: normalizeMarketingChannels(entry.channels || entry),
      ctaLabel: String(entry.ctaLabel || entry.cta_label || '').trim(),
      ctaHref: String(entry.ctaHref || entry.cta_href || '').trim(),
      createdById: String(entry.createdById || entry.created_by_id || '').trim(),
      createdByName: String(entry.createdByName || entry.created_by_name || '').trim(),
      totalRecipients: Math.max(0, Number(entry.totalRecipients ?? entry.total_recipients ?? delivery.totalRecipients ?? 0) || 0),
      delivery: {
        totalRecipients: Math.max(0, Number(delivery.totalRecipients ?? delivery.total_recipients ?? entry.totalRecipients ?? 0) || 0),
        inAppDelivered: Math.max(0, Number(delivery.inAppDelivered ?? delivery.in_app_delivered ?? 0) || 0),
        emailEligible: Math.max(0, Number(delivery.emailEligible ?? delivery.email_eligible ?? 0) || 0),
        emailSent: Math.max(0, Number(delivery.emailSent ?? delivery.email_sent ?? 0) || 0),
        smsEligible: Math.max(0, Number(delivery.smsEligible ?? delivery.sms_eligible ?? 0) || 0),
        smsSent: Math.max(0, Number(delivery.smsSent ?? delivery.sms_sent ?? 0) || 0)
      },
      warnings,
      mode: String(entry.mode || '').trim() || 'local',
      createdAt: String(entry.createdAt || entry.created_at || nowISO()).trim() || nowISO(),
      updatedAt: String(entry.updatedAt || entry.updated_at || entry.createdAt || entry.created_at || nowISO()).trim() || nowISO(),
      sortOrder: Number(entry.sortOrder || fallbackIndex || 0) || fallbackIndex || 0
    };
  }

  function getMarketingCampaignStore() {
    return read(KEYS.marketingCampaigns, []);
  }

  function saveMarketingCampaignStore(records) {
    write(KEYS.marketingCampaigns, safeArray(records));
    return getMarketingCampaigns();
  }

  function getMarketingCampaigns() {
    requireRole([ROLES.MASTER]);
    return safeArray(getMarketingCampaignStore())
      .map((entry, index) => normalizeMarketingCampaignEntry(entry, index + 1))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function storeMarketingCampaign(entryArg) {
    const current = safeArray(getMarketingCampaignStore());
    const entry = normalizeMarketingCampaignEntry(entryArg, current.length + 1);
    current.unshift(entry);
    write(KEYS.marketingCampaigns, current);
    return clone(entry);
  }

  const ADMIN_CONTENT_DEFAULTS = {
    career_hub: {
      contentKey: 'career_hub',
      title: 'Career Hub Admin',
      body: 'Published question papers, study guides, and career practice content are managed here.',
      status: 'active',
      settings: {
        featuredTopic: 'Career practice hub',
        ctaLabel: 'Open Career Hub',
        ctaHref: 'career-guidance.html'
      }
    },
    housing_hub: {
      contentKey: 'housing_hub',
      title: 'Housing Admin',
      body: 'Manage housing guidance and availability messaging for learners.',
      status: 'active',
      settings: {
        serviceStatus: 'open',
        supportPhone: '',
        ctaLabel: 'Open Housing',
        ctaHref: 'more-service/accommodation-assist.html'
      }
    }
  };

  function normalizeAdminContentKey(valueArg) {
    const value = String(valueArg || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (value === 'career' || value === 'careerhub') return 'career_hub';
    if (value === 'housing' || value === 'accommodation') return 'housing_hub';
    return value || 'general';
  }

  function normalizeAdminContentStatus(valueArg) {
    const value = String(valueArg || '').trim().toLowerCase();
    return value === 'inactive' || value === 'disabled' || value === 'draft' ? 'inactive' : 'active';
  }

  function normalizeAdminContentEntry(entryArg, fallbackKeyArg) {
    const fallbackKey = normalizeAdminContentKey(fallbackKeyArg);
    const fallback = ADMIN_CONTENT_DEFAULTS[fallbackKey] || {};
    const entry = entryArg && typeof entryArg === 'object' ? entryArg : {};
    let settings = entry.settings || entry.settings_json || fallback.settings || {};
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch (_error) {
        settings = {};
      }
    }
    const contentKey = normalizeAdminContentKey(entry.contentKey || entry.content_key || fallback.contentKey || fallbackKey);
    return {
      id: String(entry.id || fallback.id || contentKey).trim(),
      contentKey,
      title: String(entry.title || fallback.title || 'Admin content').trim(),
      body: String(entry.body || entry.message || fallback.body || '').trim(),
      status: normalizeAdminContentStatus(entry.status || fallback.status),
      settings: {
        ...(fallback.settings || {}),
        ...(settings && typeof settings === 'object' ? settings : {})
      },
      createdById: String(entry.createdById || entry.created_by || '').trim(),
      updatedById: String(entry.updatedById || entry.updated_by || '').trim(),
      createdAt: entry.createdAt || entry.created_at || nowISO(),
      updatedAt: entry.updatedAt || entry.updated_at || nowISO()
    };
  }

  function getAdminContentStore() {
    const byKey = new Map();
    Object.keys(ADMIN_CONTENT_DEFAULTS).forEach((key) => {
      byKey.set(key, normalizeAdminContentEntry(ADMIN_CONTENT_DEFAULTS[key], key));
    });
    safeArray(read(KEYS.adminContent, [])).forEach((entry) => {
      const normalized = normalizeAdminContentEntry(entry, entry?.contentKey || entry?.content_key);
      byKey.set(normalized.contentKey, normalized);
    });
    return Array.from(byKey.values());
  }

  function saveAdminContentStore(recordsArg) {
    const normalized = safeArray(recordsArg).map((entry) => normalizeAdminContentEntry(entry, entry?.contentKey || entry?.content_key));
    write(KEYS.adminContent, normalized);
    return getAdminContentStore();
  }

  function getAdminContent(contentKeyArg) {
    const contentKey = normalizeAdminContentKey(contentKeyArg);
    return clone(getAdminContentStore().find((entry) => entry.contentKey === contentKey) || normalizeAdminContentEntry(null, contentKey));
  }

  async function getAdminContentAsync(contentKeyArg) {
    const local = getAdminContent(contentKeyArg);
    if (!isSupabaseEnabled()) return local;
    try {
      const client = initSupabaseClient();
      if (!client) return local;
      const contentKey = normalizeAdminContentKey(contentKeyArg);
      const result = await client.from('admin_content').select('*').eq('content_key', contentKey).maybeSingle();
      if (result.error) {
        const message = String(result.error.message || result.error).toLowerCase();
        if (message.includes('admin_content') || message.includes('could not find') || message.includes('does not exist')) return local;
        throw new Error(result.error.message || 'Could not load admin content.');
      }
      if (!result.data) return local;
      const remote = normalizeAdminContentEntry(result.data, contentKey);
      saveAdminContentStore(getAdminContentStore().filter((entry) => entry.contentKey !== contentKey).concat(remote));
      return clone(remote);
    } catch (error) {
      console.warn('Admin content fell back to local storage.', error);
      return local;
    }
  }

  async function saveAdminContentByAdminAsync(contentKeyArg, payloadArg) {
    const actor = requireRole([ROLES.MASTER]);
    const contentKey = normalizeAdminContentKey(contentKeyArg);
    const current = getAdminContent(contentKey);
    const next = normalizeAdminContentEntry({
      ...current,
      ...(payloadArg || {}),
      contentKey,
      updatedById: actor.id,
      updatedAt: nowISO()
    }, contentKey);
    saveAdminContentStore(getAdminContentStore().filter((entry) => entry.contentKey !== contentKey).concat(next));

    if (!isSupabaseEnabled()) return clone(next);
    try {
      const client = initSupabaseClient();
      if (!client) return clone(next);
      const result = await client.from('admin_content').upsert({
        content_key: next.contentKey,
        title: next.title,
        body: next.body,
        status: next.status,
        settings: next.settings,
        updated_by: actor.supabaseUserId || actor.id || null
      }, { onConflict: 'content_key' }).select('*').single();
      if (result.error) {
        const message = String(result.error.message || result.error).toLowerCase();
        if (message.includes('admin_content') || message.includes('could not find') || message.includes('does not exist')) return clone(next);
        throw new Error(result.error.message || 'Could not save admin content.');
      }
      const remote = normalizeAdminContentEntry(result.data, contentKey);
      saveAdminContentStore(getAdminContentStore().filter((entry) => entry.contentKey !== contentKey).concat(remote));
      return clone(remote);
    } catch (error) {
      console.warn('Admin content remote save skipped.', error);
      return clone(next);
    }
  }

  function normalizeAnnouncementAudience(valueArg) {
    const value = String(valueArg || '').trim().toLowerCase();
    if (['all', 'all_users', 'all_accounts', 'everyone'].includes(value)) return 'all';
    if (['assistant', 'assistants', 'assistant_admin', 'assistant_admins', 'staff'].includes(value)) return 'assistants';
    if (['institution', 'institution_specific', 'institution_users'].includes(value)) return 'institution';
    return 'learners';
  }

  function normalizeAnnouncementStatus(valueArg, activeArg) {
    if (activeArg === false) return 'inactive';
    const value = String(valueArg || '').trim().toLowerCase();
    return value === 'inactive' || value === 'disabled' || value === 'draft' ? 'inactive' : 'active';
  }

  function normalizeAnnouncementEntry(entryArg) {
    const entry = entryArg && typeof entryArg === 'object' ? entryArg : {};
    const active = entry.active ?? entry.is_active;
    return {
      id: String(entry.id || uid('announcement')).trim(),
      title: String(entry.title || 'Kagie announcement').trim(),
      message: String(entry.message || entry.body || '').trim(),
      type: String(entry.type || 'info').trim().toLowerCase() || 'info',
      audience: normalizeAnnouncementAudience(entry.audience || entry.target_audience),
      institutionName: String(entry.institutionName || entry.institution_name || '').trim(),
      status: normalizeAnnouncementStatus(entry.status, active),
      active: normalizeAnnouncementStatus(entry.status, active) === 'active',
      createdById: String(entry.createdById || entry.created_by || '').trim(),
      updatedById: String(entry.updatedById || entry.updated_by || '').trim(),
      createdAt: entry.createdAt || entry.created_at || nowISO(),
      updatedAt: entry.updatedAt || entry.updated_at || nowISO()
    };
  }

  function getAnnouncementStore() {
    return safeArray(read(KEYS.announcements, []))
      .map(normalizeAnnouncementEntry)
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }

  function saveAnnouncementStore(recordsArg) {
    const byId = new Map();
    safeArray(recordsArg).forEach((entry) => {
      const normalized = normalizeAnnouncementEntry(entry);
      byId.set(normalized.id, normalized);
    });
    const normalized = Array.from(byId.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    write(KEYS.announcements, normalized);
    return normalized.map(clone);
  }

  function announcementMatchesUser(announcement, userArg) {
    if (!announcement?.active) return false;
    const user = userArg || currentUser() || {};
    const role = normalizeKagieRole(user?.role, ROLES.USER);
    if (announcement.audience === 'all') return true;
    if (announcement.audience === 'assistants') return role === ROLES.ASSISTANT || role === ROLES.MASTER;
    if (announcement.audience === 'institution') {
      const target = String(announcement.institutionName || '').trim().toLowerCase();
      if (!target) return role === ROLES.USER;
      const selected = [
        user?.selectedInstitution,
        user?.selected_institution,
        user?.latestInstitution
      ].concat(safeArray(user?.selectedInstitutions).map((item) => item?.institutionName || item?.name || item))
        .join(' ')
        .toLowerCase();
      return role === ROLES.USER && selected.includes(target);
    }
    return role === ROLES.USER;
  }

  function announcementToNotification(entryArg, userIdArg) {
    const entry = normalizeAnnouncementEntry(entryArg);
    return {
      id: `announcement_${entry.id}`,
      userId: userIdArg || 'all',
      title: entry.title,
      message: entry.message,
      type: entry.type || 'info',
      read: false,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      source: 'announcement',
      announcementId: entry.id
    };
  }

  function getAnnouncementsForAdmin() {
    requireRole([ROLES.MASTER]);
    return getAnnouncementStore();
  }

  function getAnnouncementsForUser(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = String(userIdArg || viewer.id || '').trim();
    const targetUser = getUsers().find((user) => [user.id, user.supabaseUserId, user.email].some((value) => String(value || '').trim() === userId)) || viewer;
    return getAnnouncementStore().filter((entry) => announcementMatchesUser(entry, targetUser)).map(clone);
  }

  async function fetchRemoteAnnouncementsForAdmin() {
    const client = initSupabaseClient();
    if (!client) return [];
    const result = await client.from('announcements').select('*').order('created_at', { ascending: false });
    if (result.error) {
      const message = String(result.error.message || result.error).toLowerCase();
      if (message.includes('announcements') || message.includes('could not find') || message.includes('does not exist')) return [];
      throw new Error(result.error.message || 'Could not load announcements.');
    }
    return safeArray(result.data).map(normalizeAnnouncementEntry);
  }

  async function fetchRemoteAnnouncementsForUser(userArg) {
    const client = initSupabaseClient();
    if (!client) return [];
    const result = await client.from('announcements').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (result.error) {
      const message = String(result.error.message || result.error).toLowerCase();
      if (message.includes('announcements') || message.includes('could not find') || message.includes('does not exist')) return [];
      throw new Error(result.error.message || 'Could not load announcements.');
    }
    return safeArray(result.data).map(normalizeAnnouncementEntry).filter((entry) => announcementMatchesUser(entry, userArg));
  }

  async function getAnnouncementsForAdminAsync() {
    requireRole([ROLES.MASTER]);
    const local = getAnnouncementsForAdmin();
    if (!isSupabaseEnabled()) return local;
    try {
      const remote = await fetchRemoteAnnouncementsForAdmin();
      if (remote.length) {
        saveAnnouncementStore(remote);
        return remote.map(clone);
      }
      return local;
    } catch (error) {
      console.warn('Announcement admin list fell back to local storage.', error);
      return local;
    }
  }

  async function getAnnouncementsForUserAsync(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const local = getAnnouncementsForUser(userIdArg);
    if (!isSupabaseEnabled()) return local;
    try {
      const userId = String(userIdArg || viewer.id || '').trim();
      const targetUser = getUsers().find((user) => [user.id, user.supabaseUserId, user.email].some((value) => String(value || '').trim() === userId)) || viewer;
      const remote = await fetchRemoteAnnouncementsForUser(targetUser);
      if (remote.length) {
        saveAnnouncementStore(remote.concat(getAnnouncementStore().filter((entry) => !remote.some((item) => item.id === entry.id))));
        return remote.map(clone);
      }
      return local;
    } catch (error) {
      console.warn('Announcement user list fell back to local storage.', error);
      return local;
    }
  }

  async function saveAnnouncementByAdminAsync(payloadArg) {
    const actor = requireRole([ROLES.MASTER]);
    const payload = payloadArg && typeof payloadArg === 'object' ? payloadArg : {};
    if (!String(payload.title || '').trim()) throw new Error('Announcement title is required.');
    if (!String(payload.message || payload.body || '').trim()) throw new Error('Announcement message is required.');
    const current = payload.id ? getAnnouncementStore().find((item) => item.id === payload.id) : null;
    const next = normalizeAnnouncementEntry({
      ...current,
      ...payload,
      createdById: current?.createdById || actor.id,
      updatedById: actor.id,
      createdAt: current?.createdAt || nowISO(),
      updatedAt: nowISO()
    });
    saveAnnouncementStore([next].concat(getAnnouncementStore().filter((item) => item.id !== next.id)));

    if (!isSupabaseEnabled()) return clone(next);
    try {
      const client = initSupabaseClient();
      if (!client) return clone(next);
      const row = {
        title: next.title,
        message: next.message,
        type: next.type,
        audience: next.audience,
        institution_name: next.institutionName || null,
        status: next.status,
        updated_by: actor.supabaseUserId || actor.id || null
      };
      const result = current && isUuid(next.id)
        ? await client.from('announcements').update(row).eq('id', next.id).select('*').single()
        : await client.from('announcements').insert({
            ...row,
            created_by: actor.supabaseUserId || actor.id || null
          }).select('*').single();
      if (result.error) {
        const message = String(result.error.message || result.error).toLowerCase();
        if (message.includes('announcements') || message.includes('could not find') || message.includes('does not exist')) return clone(next);
        throw new Error(result.error.message || 'Could not save announcement.');
      }
      const remote = normalizeAnnouncementEntry(result.data);
      saveAnnouncementStore([remote].concat(getAnnouncementStore().filter((item) => item.id !== next.id && item.id !== remote.id)));
      return clone(remote);
    } catch (error) {
      console.warn('Announcement remote save skipped.', error);
      return clone(next);
    }
  }

  async function deleteAnnouncementByAdminAsync(announcementIdArg) {
    requireRole([ROLES.MASTER]);
    const announcementId = String(announcementIdArg || '').trim();
    if (!announcementId) throw new Error('Announcement id is required.');
    const existing = getAnnouncementStore().find((item) => item.id === announcementId);
    saveAnnouncementStore(getAnnouncementStore().filter((item) => item.id !== announcementId));
    if (existing && isUuid(announcementId) && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const result = await client.from('announcements').delete().eq('id', announcementId);
          if (result.error) throw new Error(result.error.message || 'Could not delete announcement.');
        }
      } catch (error) {
        console.warn('Announcement remote delete skipped.', error);
      }
    }
    return true;
  }

  capturePendingPromoCodeFromLocation();

  function getServiceCatalog() {
    return clone(getKagieData().extraServices).map((item) => ({
      ...item,
      code: item?.code || item?.id || '',
      serviceCode: item?.serviceCode || item?.code || item?.id || '',
      slug: item?.slug || String(item?.id || '').replace(/_/g, '-')
    }));
  }

  function normalizeFavoriteEntry(entry, fallbackUserId) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const type = String(source.type || 'institution').trim().toLowerCase();
    const institutionName = String(source.institutionName || source.institution || '').trim();
    const course = String(source.course || source.choice1 || '').trim();
    const faculty = String(source.faculty || '').trim();
    const year = String(source.year || new Date().getFullYear()).trim();
    return {
      id: String(source.id || uid('fav')).trim(),
      userId: String(source.userId || fallbackUserId || '').trim(),
      type,
      institutionId: String(source.institutionId || '').trim(),
      institutionName,
      province: String(source.province || '').trim(),
      institutionType: String(source.institutionType || source.typeLabel || '').trim(),
      faculty,
      course,
      year,
      status: String(source.status || '').trim(),
      notes: String(source.notes || '').trim(),
      createdAt: source.createdAt || nowISO()
    };
  }

  function getFavoriteMatchKey(entry) {
    const favorite = normalizeFavoriteEntry(entry, entry?.userId || '');
    return [
      favorite.type,
      favorite.institutionId || favorite.institutionName.toLowerCase(),
      favorite.faculty.toLowerCase(),
      favorite.course.toLowerCase(),
      favorite.year
    ].join('::');
  }

  function getFavorites(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    return read(KEYS.favorites, [])
      .filter((item) => item.userId === userId)
      .map((item) => normalizeFavoriteEntry(item, userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function saveFavoritesList(items) {
    return write(KEYS.favorites, safeArray(items).map((item) => clone(item)));
  }

  function addFavorite(entry, userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const favorites = read(KEYS.favorites, []);
    const nextFavorite = normalizeFavoriteEntry(entry, userId);
    const nextKey = getFavoriteMatchKey(nextFavorite);
    const existing = favorites.find((item) => item.userId === userId && getFavoriteMatchKey(item) === nextKey);
    if (existing) return clone(normalizeFavoriteEntry(existing, userId));
    favorites.push(nextFavorite);
    saveFavoritesList(favorites);
    return clone(nextFavorite);
  }

  function removeFavorite(favoriteId, userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const favorites = read(KEYS.favorites, []);
    const filtered = favorites.filter((item) => !(item.userId === userId && item.id === favoriteId));
    saveFavoritesList(filtered);
    return getFavorites(userId);
  }

  async function getFavoritesAsync(userIdArg) {
    return getFavorites(userIdArg);
  }

  async function addFavoriteAsync(entry, userIdArg) {
    return addFavorite(entry, userIdArg);
  }

  async function removeFavoriteAsync(favoriteId, userIdArg) {
    return removeFavorite(favoriteId, userIdArg);
  }

  function getServiceRequestsFromApplications(applicationsArg, userIdArg) {
    const userId = String(userIdArg || '').trim();
    const catalogByCode = new Map(getServiceCatalog().map((item) => [String(item.code || item.id || '').trim(), item]));
    return safeArray(applicationsArg).flatMap((app) => {
      return safeArray(app?.services).map((service, index) => {
        const serviceCode = String(service?.serviceCode || service?.code || service?.id || '').trim();
        const serviceMeta = catalogByCode.get(serviceCode) || null;
        let status = String(service?.status || '').trim();
        if (!status) {
          if (app?.paymentStatus === STATUS.payment.REJECTED) status = 'Awaiting corrected payment proof';
          else if (app?.paymentStatus === STATUS.payment.PENDING_VERIFICATION) status = 'Pending payment verification';
          else if (app?.paymentStatus === STATUS.payment.VERIFIED) status = 'Queued for Kagie support';
          else status = 'Saved';
        }
        return {
          id: String(service?.id || `${app.id}_service_${index + 1}`).trim(),
          userId: userId || app?.userId || '',
          applicationId: app?.id || '',
          serviceCode,
          serviceName: String(service?.serviceName || service?.name || serviceMeta?.name || 'Support service').trim(),
          price: Number(service?.price ?? service?.servicePrice ?? serviceMeta?.price ?? 0),
          institution: String(service?.institution || service?.institutionName || '').trim(),
          note: String(service?.note || '').trim(),
          status,
          paymentStatus: app?.paymentStatus || STATUS.payment.PENDING,
          applicationStatus: app?.status || STATUS.application.DRAFT,
          requestedAt: service?.createdAt || app?.submittedAt || app?.updatedAt || app?.createdAt || nowISO()
        };
      });
    }).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  function normalizeAccommodationListingEntry(item, fallbackIndex) {
    const source = item && typeof item === 'object' ? item : {};
    const propertyName = String(source.propertyName || source.name || '').trim();
    const institutionName = String(source.institutionName || source.university || '').trim();
    const amenities = Array.isArray(source.amenities)
      ? source.amenities.map((itemValue) => String(itemValue || '').trim()).filter(Boolean)
      : String(source.amenities || source.amenitiesText || '')
        .split(/\r?\n|,/)
        .map((itemValue) => itemValue.trim())
        .filter(Boolean);
    return {
      id: String(source.id || uid(`acclisting_${fallbackIndex || 1}`)).trim(),
      propertyName,
      institutionName,
      university: institutionName,
      province: String(source.province || '').trim(),
      location: String(source.location || '').trim(),
      address: String(source.address || '').trim(),
      price: toNumber(source.price, 0),
      roomType: String(source.roomType || '').trim(),
      availabilityStatus: String(source.availabilityStatus || source.status || 'Available').trim() || 'Available',
      distanceFromCampus: String(source.distanceFromCampus || '').trim(),
      images: parseImageList(source.images),
      description: String(source.description || '').trim(),
      amenities,
      propertyDetails: String(source.propertyDetails || '').trim(),
      listingState: String(source.listingState || source.workflowState || 'draft').trim().toLowerCase() || 'draft',
      contactPhone: String(source.contactPhone || '').trim(),
      inspectionDocumentName: String(source.inspectionDocumentName || '').trim(),
      inspectionDocumentUrl: String(source.inspectionDocumentUrl || '').trim(),
      pricingDocumentName: String(source.pricingDocumentName || '').trim(),
      pricingDocumentUrl: String(source.pricingDocumentUrl || '').trim(),
      createdAt: String(source.createdAt || nowISO()).trim(),
      updatedAt: String(source.updatedAt || source.createdAt || nowISO()).trim()
    };
  }

  function normalizeTransportOptionEntry(item, fallbackIndex) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      id: String(source.id || uid(`transport_${fallbackIndex || 1}`)).trim(),
      company: String(source.company || '').trim(),
      departureCity: String(source.departureCity || '').trim(),
      destinationCity: String(source.destinationCity || '').trim(),
      departureTime: String(source.departureTime || '').trim(),
      arrivalTime: String(source.arrivalTime || '').trim(),
      travelDateLabel: String(source.travelDateLabel || '').trim(),
      routeType: String(source.routeType || 'Intercity coach').trim(),
      estimatedPrice: toNumber(source.estimatedPrice, 0),
      supportFee: toNumber(source.supportFee, 0),
      duration: String(source.duration || '').trim(),
      luggage: String(source.luggage || '').trim(),
      description: String(source.description || '').trim(),
      bookingStatus: String(source.bookingStatus || 'Available').trim(),
      createdAt: String(source.createdAt || nowISO()).trim(),
      updatedAt: String(source.updatedAt || source.createdAt || nowISO()).trim()
    };
  }

  function getAccommodationListingOverrideStore() {
    return read(KEYS.accommodationListingsCatalog, []);
  }

  function saveAccommodationListingOverrideStore(records) {
    write(KEYS.accommodationListingsCatalog, records);
    accommodationListingCache = null;
    return records;
  }

  function getTransportOptionOverrideStore() {
    return read(KEYS.transportOptionsCatalog, []);
  }

  function saveTransportOptionOverrideStore(records) {
    write(KEYS.transportOptionsCatalog, records);
    transportOptionCache = null;
    return records;
  }

  function getMergedAccommodationListingRecords() {
    if (accommodationListingCache) return accommodationListingCache.map(clone);

    const base = safeArray(getKagieData().accommodationListings).map((item, index) => normalizeAccommodationListingEntry(item, index + 1));
    const overrides = getAccommodationListingOverrideStore();
    const merged = new Map(base.map((item) => [item.id, item]));

    safeArray(overrides).forEach((entry, index) => {
      const normalized = normalizeAccommodationListingEntry(entry, base.length + index + 1);
      if (!normalized.id) return;
      if (entry?._deleted) {
        merged.delete(normalized.id);
        return;
      }
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, normalizeAccommodationListingEntry(existing ? mergeDeep(existing, normalized) : normalized, index + 1));
    });

    accommodationListingCache = Array.from(merged.values())
      .filter((item) => item.propertyName)
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    return accommodationListingCache.map(clone);
  }

  function getMergedTransportOptionRecords() {
    if (transportOptionCache) return transportOptionCache.map(clone);

    const base = safeArray(getKagieData().transportOptions).map((item, index) => normalizeTransportOptionEntry(item, index + 1));
    const overrides = getTransportOptionOverrideStore();
    const merged = new Map(base.map((item) => [item.id, item]));

    safeArray(overrides).forEach((entry, index) => {
      const normalized = normalizeTransportOptionEntry(entry, base.length + index + 1);
      if (!normalized.id) return;
      if (entry?._deleted) {
        merged.delete(normalized.id);
        return;
      }
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, normalizeTransportOptionEntry(existing ? mergeDeep(existing, normalized) : normalized, index + 1));
    });

    transportOptionCache = Array.from(merged.values())
      .filter((item) => item.company && item.departureCity && item.destinationCity)
      .sort((a, b) => {
        const departureCompare = String(a.departureTime || '').localeCompare(String(b.departureTime || ''));
        if (departureCompare) return departureCompare;
        return String(a.company || '').localeCompare(String(b.company || ''));
      });
    return transportOptionCache.map(clone);
  }

  function getAccommodationListings(filtersArg) {
    const filters = filtersArg || {};
    const query = String(filters.query || '').trim().toLowerCase();
    const institutionName = String(filters.institutionName || '').trim().toLowerCase();
    const province = String(filters.province || '').trim().toLowerCase();
    const roomType = String(filters.roomType || '').trim().toLowerCase();
    const availability = String(filters.availabilityStatus || '').trim().toLowerCase();
    const includeDrafts = Boolean(filters.includeDrafts);

    return getMergedAccommodationListingRecords()
      .filter((listing) => {
        const listingState = String(listing.listingState || 'draft').trim().toLowerCase();
        if (!includeDrafts && listingState !== 'published') return false;
        const haystack = [
          listing.propertyName,
          listing.location,
          listing.address,
          listing.province,
          listing.institutionName,
          listing.roomType,
          listing.description
        ].join(' ').toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (institutionName && String(listing.institutionName || '').trim().toLowerCase() !== institutionName) return false;
        if (province && String(listing.province || '').trim().toLowerCase() !== province) return false;
        if (roomType && String(listing.roomType || '').trim().toLowerCase() !== roomType) return false;
        if (availability && String(listing.availabilityStatus || '').trim().toLowerCase() !== availability) return false;
        return true;
      })
      .map(clone);
  }

  function getTransportOptions(filtersArg) {
    const filters = filtersArg || {};
    const query = String(filters.query || '').trim().toLowerCase();
    const departureCity = String(filters.departureCity || '').trim().toLowerCase();
    const destinationCity = String(filters.destinationCity || '').trim().toLowerCase();
    const company = String(filters.company || '').trim().toLowerCase();

    return getMergedTransportOptionRecords()
      .filter((option) => {
        const haystack = [
          option.company,
          option.departureCity,
          option.destinationCity,
          option.departureTime,
          option.arrivalTime,
          option.routeType,
          option.description
        ].join(' ').toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (departureCity && String(option.departureCity || '').trim().toLowerCase() !== departureCity) return false;
        if (destinationCity && String(option.destinationCity || '').trim().toLowerCase() !== destinationCity) return false;
        if (company && String(option.company || '').trim().toLowerCase() !== company) return false;
        return true;
      })
      .sort((a, b) => Number(a.estimatedPrice || 0) - Number(b.estimatedPrice || 0))
      .map(clone);
  }

  function normalizeAccommodationRequest(entry, fallbackUserId) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const supportChecklist = safeArray(source.supportChecklist)
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return {
      id: String(source.id || uid('accreq')).trim(),
      userId: String(source.userId || fallbackUserId || '').trim(),
      applicationId: String(source.applicationId || '').trim(),
      listingId: String(source.listingId || '').trim(),
      propertyName: String(source.propertyName || '').trim(),
      institutionName: String(source.institutionName || '').trim(),
      province: String(source.province || '').trim(),
      location: String(source.location || '').trim(),
      address: String(source.address || '').trim(),
      roomType: String(source.roomType || '').trim(),
      price: Number(source.price || 0),
      learnerName: String(source.learnerName || source.fullName || '').trim(),
      learnerEmail: String(source.learnerEmail || source.email || '').trim(),
      learnerPhone: String(source.learnerPhone || source.contactPhone || '').trim(),
      alternatePhone: String(source.alternatePhone || '').trim(),
      idNumber: String(source.idNumber || '').trim(),
      studentNumber: String(source.studentNumber || '').trim(),
      campusName: String(source.campusName || '').trim(),
      yearOfStudy: String(source.yearOfStudy || '').trim(),
      gender: String(source.gender || '').trim(),
      preferredMoveInDate: String(source.preferredMoveInDate || source.moveInDate || '').trim(),
      preferredLeaseMonths: String(source.preferredLeaseMonths || '').trim(),
      roomPreference: String(source.roomPreference || '').trim(),
      fundingStatus: String(source.fundingStatus || '').trim(),
      nsfasBeneficiary: String(source.nsfasBeneficiary || '').trim(),
      nsfasSinceYear: String(source.nsfasSinceYear || '').trim(),
      nsfasReferenceNumber: String(source.nsfasReferenceNumber || '').trim(),
      nsfasAllowanceStatus: String(source.nsfasAllowanceStatus || '').trim(),
      bursaryProvider: String(source.bursaryProvider || '').trim(),
      guardianName: String(source.guardianName || '').trim(),
      guardianPhone: String(source.guardianPhone || '').trim(),
      guardianEmail: String(source.guardianEmail || '').trim(),
      emergencyContactName: String(source.emergencyContactName || '').trim(),
      emergencyContactPhone: String(source.emergencyContactPhone || '').trim(),
      emergencyRelationship: String(source.emergencyRelationship || '').trim(),
      documentsReady: String(source.documentsReady || '').trim(),
      transportNeeded: String(source.transportNeeded || '').trim(),
      specialNeeds: String(source.specialNeeds || '').trim(),
      medicalNotes: String(source.medicalNotes || '').trim(),
      contactPhone: String(source.contactPhone || source.learnerPhone || '').trim(),
      note: String(source.note || source.supportNote || '').trim(),
      supportChecklist,
      supportSummary: String(source.supportSummary || '').trim(),
      status: String(source.status || 'Support review requested').trim(),
      providerPhone: String(source.providerPhone || '').trim(),
      images: parseImageList(source.images),
      createdAt: source.createdAt || nowISO(),
      updatedAt: source.updatedAt || source.createdAt || nowISO()
    };
  }

  function buildAccommodationSupportSummary(entryArg) {
    const entry = entryArg && typeof entryArg === 'object' ? entryArg : {};
    const parts = [];
    if (entry.preferredMoveInDate) parts.push(`Move-in ${entry.preferredMoveInDate}`);
    if (entry.fundingStatus) parts.push(`Funding ${entry.fundingStatus}`);
    if (entry.nsfasBeneficiary === 'yes') {
      parts.push(`NSFAS beneficiary${entry.nsfasSinceYear ? ` since ${entry.nsfasSinceYear}` : ''}`);
    } else if (entry.nsfasBeneficiary === 'pending') {
      parts.push('NSFAS outcome pending');
    }
    if (entry.documentsReady) parts.push(`Documents ${entry.documentsReady}`);
    if (entry.transportNeeded === 'yes') parts.push('Transport support also needed');
    if (entry.specialNeeds && entry.specialNeeds !== 'none') parts.push(`Support need: ${entry.specialNeeds}`);
    return parts.join(' | ');
  }

  function normalizeTransportPassengerDetails(entriesArg) {
    return safeArray(entriesArg).map((entry, index) => {
      const source = entry && typeof entry === 'object' ? entry : {};
      return {
        type: String(source.type || 'adult').trim() || 'adult',
        sequence: Number(source.sequence || index + 1),
        title: String(source.title || '').trim(),
        firstName: String(source.firstName || '').trim(),
        surname: String(source.surname || '').trim(),
        mobile: String(source.mobile || '').trim(),
        emergencyContact: String(source.emergencyContact || '').trim(),
        idType: String(source.idType || 'SA ID').trim(),
        idNumber: String(source.idNumber || '').trim(),
        dateOfBirth: String(source.dateOfBirth || '').trim(),
        gender: String(source.gender || '').trim(),
        withBaby: Boolean(source.withBaby),
        institutionName: String(source.institutionName || '').trim(),
        studentNumber: String(source.studentNumber || '').trim()
      };
    });
  }

  function isTransportServiceItem(itemArg) {
    const item = itemArg && typeof itemArg === 'object' ? itemArg : {};
    return String(item.serviceCode || '').trim().toLowerCase() === 'transport_assist' || Boolean(item.transportDetails);
  }

  function normalizeTransportRequest(entry, fallbackUserId) {
    const source = entry && typeof entry === 'object' ? entry : {};
    return {
      id: String(source.id || uid('transreq')).trim(),
      userId: String(source.userId || fallbackUserId || '').trim(),
      applicationId: String(source.applicationId || '').trim(),
      learnerName: String(source.learnerName || '').trim(),
      learnerEmail: String(source.learnerEmail || '').trim(),
      learnerPhone: String(source.learnerPhone || '').trim(),
      assignedAssistantId: String(source.assignedAssistantId || '').trim(),
      optionId: String(source.optionId || '').trim(),
      tripType: String(source.tripType || 'One Way').trim(),
      company: String(source.company || '').trim(),
      departureCity: String(source.departureCity || '').trim(),
      destinationCity: String(source.destinationCity || '').trim(),
      departureTime: String(source.departureTime || '').trim(),
      arrivalTime: String(source.arrivalTime || '').trim(),
      travelDate: String(source.travelDate || '').trim(),
      returnDate: String(source.returnDate || '').trim(),
      passengers: String(source.passengers || '1').trim(),
      passengerMix: String(source.passengerMix || '').trim(),
      passengerDetails: normalizeTransportPassengerDetails(source.passengerDetails),
      estimatedPrice: Number(source.estimatedPrice || 0),
      supportFee: Number(source.supportFee || 0),
      note: String(source.note || '').trim(),
      requestSourceKey: String(source.requestSourceKey || '').trim(),
      paymentReference: String(source.paymentReference || '').trim(),
      paymentMethod: String(source.paymentMethod || '').trim(),
      paymentAmount: Number(source.paymentAmount || 0),
      paidAt: String(source.paidAt || '').trim(),
      ticketCode: String(source.ticketCode || '').trim(),
      ticketStatus: String(source.ticketStatus || source.status || 'Ticket sent').trim(),
      sentAt: String(source.sentAt || source.createdAt || nowISO()).trim(),
      bookedByUserId: String(source.bookedByUserId || '').trim(),
      bookedByRole: String(source.bookedByRole || '').trim(),
      status: String(source.status || 'Ticket sent').trim(),
      createdAt: source.createdAt || nowISO(),
      updatedAt: source.updatedAt || source.createdAt || nowISO()
    };
  }

  function decorateTransportServiceForManualBooking(itemArg, paymentArg) {
    const item = itemArg && typeof itemArg === 'object' ? clone(itemArg) : {};
    if (!isTransportServiceItem(item)) return item;
    const transport = item.transportDetails && typeof item.transportDetails === 'object' ? clone(item.transportDetails) : {};
    const passengerDetails = normalizeTransportPassengerDetails(item.passengerDetails || transport.passengerDetails);
    const routeLabel = `${item.departureCity || transport.departureCity || 'Departure'} to ${item.destinationCity || transport.destinationCity || 'Destination'}`.trim();
    const supportNote = 'Transport payment received. Kagie staff will buy this ticket manually and send it to the learner after booking.';
    const existingNote = String(item.note || '').trim();
    return {
      ...item,
      type: item.type === 'service_request' ? 'service' : (item.type || 'service'),
      status: 'Paid - manual booking required',
      paymentStatus: 'Awaiting Kagie booking',
      passengerDetails,
      note: existingNote ? `${existingNote} ${supportNote}`.trim() : supportNote,
      requestSourceKey: String(item.requestSourceKey || item.clientKey || item.id || uid('transsvc')).trim(),
      institution: item.institution || routeLabel,
      transportDetails: {
        ...transport,
        company: transport.company || item.company || '',
        departureCity: transport.departureCity || item.departureCity || '',
        destinationCity: transport.destinationCity || item.destinationCity || '',
        departureTime: transport.departureTime || item.departureTime || '',
        arrivalTime: transport.arrivalTime || item.arrivalTime || '',
        duration: transport.duration || '',
        travelDate: transport.travelDate || item.travelDate || '',
        returnDate: transport.returnDate || item.returnDate || '',
        tripType: transport.tripType || item.tripType || 'One Way',
        totalFare: Number(transport.totalFare ?? item.price ?? 0),
        passengerCount: Number(transport.passengerCount || item.passengers || passengerDetails.length || 1),
        passengerMix: transport.passengerMix || item.passengerMix || '',
        passengerDetails,
        routeStatus: 'Paid - manual booking required',
        bookingFlow: 'manual_admin_booking',
        paymentReference: String(paymentArg?.reference || '').trim(),
        paymentMethod: String(paymentArg?.method || '').trim(),
        paidAt: String(paymentArg?.submittedAt || nowISO()).trim()
      }
    };
  }

  function getTransportStaffRecipients(applicationArg) {
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    const seen = new Set();
    const recipients = [];
    const addRecipient = (user) => {
      if (!user?.id) return;
      const key = String(user.id || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      recipients.push(sanitizeUser(user));
    };

    getUsers()
      .filter((user) => user?.role === ROLES.MASTER || user?.role === ROLES.ASSISTANT)
      .forEach(addRecipient);

    if (app) {
      const assignedAssistantId = String(app.assignedAssistantId || app.assistantId || '').trim();
      if (assignedAssistantId) {
        const assignedAssistant = getUserById(assignedAssistantId) || getUserBySupabaseId(assignedAssistantId);
        if (assignedAssistant?.role === ROLES.ASSISTANT) addRecipient(assignedAssistant);
      }
    }

    return recipients;
  }

  function syncTransportRequestsFromPaidServices(serviceItemsArg, userArg, applicationArg, paymentArg) {
    const user = userArg && typeof userArg === 'object' ? userArg : {};
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    const transportItems = safeArray(serviceItemsArg).filter(isTransportServiceItem);
    if (!transportItems.length) return [];

    const records = read(KEYS.transportRequests, []);
    const created = [];

    transportItems.forEach((item) => {
      const transport = item.transportDetails && typeof item.transportDetails === 'object' ? item.transportDetails : {};
      const sourceKey = String(item.requestSourceKey || item.clientKey || item.id || '').trim();
      const existingIndex = records.findIndex((entry) =>
        String(entry?.userId || '').trim() === String(user.id || app?.userId || '').trim()
        && sourceKey
        && String(entry?.requestSourceKey || '').trim() === sourceKey
      );
      const current = existingIndex >= 0
        ? normalizeTransportRequest(records[existingIndex], user.id || app?.userId || '')
        : normalizeTransportRequest({}, user.id || app?.userId || '');
      const passengerDetails = normalizeTransportPassengerDetails(item.passengerDetails || transport.passengerDetails);
      const next = normalizeTransportRequest({
        ...current,
        id: current.id || uid('transreq'),
        userId: user.id || app?.userId || current.userId,
        applicationId: app?.id || current.applicationId,
        learnerName: user.fullName || user.name || current.learnerName || buildLearnerAlertMessage(app, 'Learner'),
        learnerEmail: user.email || current.learnerEmail,
        learnerPhone: user.phone || user.cellphone || current.learnerPhone,
        assignedAssistantId: app?.assignedAssistantId || app?.assistantId || current.assignedAssistantId,
        optionId: transport.routeId || item.optionId || current.optionId,
        tripType: item.tripType || transport.tripType || current.tripType || 'One Way',
        company: item.company || transport.company || current.company,
        departureCity: item.departureCity || transport.departureCity || current.departureCity,
        destinationCity: item.destinationCity || transport.destinationCity || current.destinationCity,
        departureTime: item.departureTime || transport.departureTime || current.departureTime,
        arrivalTime: item.arrivalTime || transport.arrivalTime || current.arrivalTime,
        travelDate: item.travelDate || transport.travelDate || current.travelDate,
        returnDate: item.returnDate || transport.returnDate || current.returnDate,
        passengers: String(transport.passengerCount || item.passengers || current.passengers || passengerDetails.length || 1),
        passengerMix: item.passengerMix || transport.passengerMix || current.passengerMix,
        passengerDetails,
        estimatedPrice: Number(item.price ?? transport.totalFare ?? current.estimatedPrice ?? 0),
        supportFee: Number(item.supportFee ?? transport.supportFee ?? current.supportFee ?? 0),
        note: item.note || current.note || 'Learner paid for transport. Kagie staff must buy the ticket manually.',
        requestSourceKey: sourceKey || current.requestSourceKey || uid('transsvc'),
        paymentReference: paymentArg?.reference || current.paymentReference,
        paymentMethod: paymentArg?.method || current.paymentMethod,
        paymentAmount: Number(item.price ?? transport.totalFare ?? current.paymentAmount ?? paymentArg?.amount ?? 0),
        paidAt: paymentArg?.submittedAt || current.paidAt || nowISO(),
        ticketCode: current.ticketCode || '',
        ticketStatus: current.ticketCode ? (current.ticketStatus || 'Ticket sent') : 'Awaiting Kagie booking',
        sentAt: current.sentAt || '',
        bookedByUserId: current.bookedByUserId || '',
        bookedByRole: current.bookedByRole || '',
        status: current.ticketCode ? (current.status || 'Ticket sent') : 'Paid - manual booking required',
        createdAt: current.createdAt || nowISO()
      }, user.id || app?.userId || '');

      if (existingIndex >= 0) records[existingIndex] = next;
      else records.push(next);
      created.push(clone(next));
    });

    write(KEYS.transportRequests, records);
    return created;
  }

  function updateLatestApplicationTransportService(userIdArg, payloadArg) {
    const userId = String(userIdArg || '').trim();
    if (!userId) return null;
    const payload = payloadArg && typeof payloadArg === 'object' ? payloadArg : {};
    const apps = getApplicationsByUser(userId)
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const app = apps[0];
    if (!app) return null;

    const services = safeArray(app.services).map((item) => clone(item));
    let changed = false;
    services.forEach((service, index) => {
      if (!isTransportServiceItem(service)) return;
      const serviceTransport = service.transportDetails && typeof service.transportDetails === 'object' ? service.transportDetails : {};
      const sameSource = payload.requestSourceKey && String(service.requestSourceKey || service.clientKey || service.id || '').trim() === String(payload.requestSourceKey).trim();
      const sameRoute = !payload.requestSourceKey
        && String(service.departureCity || serviceTransport.departureCity || '').trim() === String(payload.departureCity || '').trim()
        && String(service.destinationCity || serviceTransport.destinationCity || '').trim() === String(payload.destinationCity || '').trim()
        && String(service.travelDate || serviceTransport.travelDate || '').trim() === String(payload.travelDate || '').trim();
      if (!sameSource && !sameRoute) return;

      services[index] = {
        ...service,
        status: payload.status || 'Ticket sent',
        paymentStatus: payload.ticketStatus || payload.status || 'Ticket sent',
        note: payload.note || service.note || '',
        transportDetails: {
          ...serviceTransport,
          routeStatus: payload.status || 'Ticket sent',
          ticketCode: payload.ticketCode || serviceTransport.ticketCode || ''
        }
      };
      changed = true;
    });

    if (!changed) return null;
    return updateApplication(app.id, { services });
  }

  function notifyStaffForTransportRequests(requestsArg, applicationArg) {
    const requests = safeArray(requestsArg);
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    if (!requests.length) return [];
    const recipients = getTransportStaffRecipients(app);
    if (!recipients.length) return [];

    return requests.flatMap((request) => {
      const title = 'Paid transport booking needs manual action';
      const message = `${request.learnerName || buildLearnerAlertMessage(app, 'A learner')} paid for transport from ${request.departureCity || 'Departure'} to ${request.destinationCity || 'Destination'}${request.travelDate ? ` on ${request.travelDate}` : ''}. ${request.passengerMix || `${request.passengers || '1'} passenger`} still needs manual ticket booking in Kagie.`;
      return recipients.map((recipient) => pushNotification(recipient.id, title, message, 'warning')).filter(Boolean);
    });
  }

  async function notifyStaffForTransportRequestsAsync(requestsArg, applicationArg) {
    const requests = safeArray(requestsArg);
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    if (!requests.length) return [];
    const recipients = getTransportStaffRecipients(app);
    if (!recipients.length) return [];

    const jobs = [];
    requests.forEach((request) => {
      const title = 'Paid transport booking needs manual action';
      const message = `${request.learnerName || buildLearnerAlertMessage(app, 'A learner')} paid for transport from ${request.departureCity || 'Departure'} to ${request.destinationCity || 'Destination'}${request.travelDate ? ` on ${request.travelDate}` : ''}. ${request.passengerMix || `${request.passengers || '1'} passenger`} still needs manual ticket booking in Kagie.`;
      recipients.forEach((recipient) => {
        jobs.push(pushNotificationAsync(recipient.id, title, message, 'warning'));
      });
    });

    const results = await Promise.allSettled(jobs);
    return results.filter((entry) => entry.status === 'fulfilled' && entry.value).map((entry) => entry.value);
  }

  function getAccommodationRequests(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = viewer.role === ROLES.USER ? viewer.id : (userIdArg || '');
    return read(KEYS.accommodationRequests, [])
      .map((item) => normalizeAccommodationRequest(item, item?.userId || ''))
      .filter((item) => !targetUserId || item.userId === targetUserId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .map(clone);
  }

  function getTransportRequests(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = viewer.role === ROLES.USER ? viewer.id : (userIdArg || '');
    return read(KEYS.transportRequests, [])
      .map((item) => normalizeTransportRequest(item, item?.userId || ''))
      .filter((item) => !targetUserId || item.userId === targetUserId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function submitAccommodationRequest(payload, userIdArg) {
    const actor = requireRole([ROLES.USER]);
    const userId = userIdArg || actor.id;
    const users = getUsers();
    const user = users.find((item) => item.id === userId) || null;
    const profile = user?.profile || {};
    const listing = getAccommodationListings().find((item) => item.id === payload?.listingId)
      || getAccommodationListings({ query: payload?.propertyName || '' }).find((item) => item.propertyName === payload?.propertyName)
      || null;
    const records = read(KEYS.accommodationRequests, []);
    const nextListingId = String(payload?.listingId || listing?.id || '').trim();
    const existingIndex = records.findIndex((item) => {
      const sameUser = String(item?.userId || '').trim() === String(userId).trim();
      if (!sameUser) return false;
      if (nextListingId) return String(item?.listingId || '').trim() === nextListingId;
      return String(item?.propertyName || '').trim().toLowerCase() === String(payload?.propertyName || listing?.propertyName || '').trim().toLowerCase();
    });
    const existing = existingIndex >= 0 ? normalizeAccommodationRequest(records[existingIndex], userId) : {};
    const baseDraft = {
      ...existing,
      ...payload,
      userId,
      listingId: nextListingId,
      propertyName: payload?.propertyName || listing?.propertyName || existing.propertyName || '',
      institutionName: payload?.institutionName || listing?.institutionName || existing.institutionName || '',
      province: payload?.province || listing?.province || existing.province || '',
      location: payload?.location || listing?.location || existing.location || '',
      address: payload?.address || listing?.address || existing.address || '',
      roomType: payload?.roomType || listing?.roomType || existing.roomType || '',
      price: payload?.price ?? listing?.price ?? existing.price ?? 0,
      learnerName: payload?.learnerName || payload?.fullName || user?.fullName || existing.learnerName || '',
      learnerEmail: payload?.learnerEmail || payload?.email || user?.email || existing.learnerEmail || '',
      learnerPhone: payload?.learnerPhone || payload?.contactPhone || user?.phone || user?.cellphone || existing.learnerPhone || '',
      alternatePhone: payload?.alternatePhone || existing.alternatePhone || '',
      idNumber: payload?.idNumber || profile?.idNumber || existing.idNumber || '',
      studentNumber: payload?.studentNumber || profile?.studentNumber || existing.studentNumber || '',
      campusName: payload?.campusName || profile?.campusName || existing.campusName || '',
      yearOfStudy: payload?.yearOfStudy || profile?.yearOfStudy || existing.yearOfStudy || '',
      gender: payload?.gender || profile?.gender || existing.gender || '',
      preferredMoveInDate: payload?.preferredMoveInDate || payload?.moveInDate || existing.preferredMoveInDate || '',
      preferredLeaseMonths: payload?.preferredLeaseMonths || existing.preferredLeaseMonths || '',
      roomPreference: payload?.roomPreference || existing.roomPreference || '',
      fundingStatus: payload?.fundingStatus || existing.fundingStatus || '',
      nsfasBeneficiary: payload?.nsfasBeneficiary || existing.nsfasBeneficiary || '',
      nsfasSinceYear: payload?.nsfasSinceYear || existing.nsfasSinceYear || '',
      nsfasReferenceNumber: payload?.nsfasReferenceNumber || existing.nsfasReferenceNumber || '',
      nsfasAllowanceStatus: payload?.nsfasAllowanceStatus || existing.nsfasAllowanceStatus || '',
      bursaryProvider: payload?.bursaryProvider || existing.bursaryProvider || '',
      guardianName: payload?.guardianName || profile?.guardianName || existing.guardianName || '',
      guardianPhone: payload?.guardianPhone || profile?.guardianPhone || profile?.guardianCell1 || existing.guardianPhone || '',
      guardianEmail: payload?.guardianEmail || profile?.guardianEmail || existing.guardianEmail || '',
      emergencyContactName: payload?.emergencyContactName || existing.emergencyContactName || '',
      emergencyContactPhone: payload?.emergencyContactPhone || existing.emergencyContactPhone || '',
      emergencyRelationship: payload?.emergencyRelationship || existing.emergencyRelationship || '',
      documentsReady: payload?.documentsReady || existing.documentsReady || '',
      transportNeeded: payload?.transportNeeded || existing.transportNeeded || '',
      specialNeeds: payload?.specialNeeds || existing.specialNeeds || '',
      medicalNotes: payload?.medicalNotes || existing.medicalNotes || '',
      contactPhone: payload?.contactPhone || payload?.learnerPhone || user?.phone || user?.cellphone || existing.contactPhone || '',
      note: payload?.note || payload?.supportNote || existing.note || '',
      supportChecklist: safeArray(payload?.supportChecklist).length ? payload.supportChecklist : existing.supportChecklist || [],
      providerPhone: payload?.providerPhone || listing?.contactPhone || existing.providerPhone || '',
      images: payload?.images || listing?.images || existing.images || [],
      status: payload?.status || existing.status || 'Support review requested',
      createdAt: existing.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    const entry = normalizeAccommodationRequest({
      ...baseDraft,
      supportSummary: payload?.supportSummary || buildAccommodationSupportSummary(baseDraft)
      }, userId);
    if (existingIndex >= 0) records[existingIndex] = entry;
    else records.push(entry);
    write(KEYS.accommodationRequests, records);
    pushNotification(
      userId,
      'Accommodation request received',
      `${entry.propertyName} has been added to your dashboard for tracking. Kagie support can now review your move-in and funding details.`,
      'success'
    );
    return clone(entry);
  }

  function submitTransportRequest(payload, userIdArg) {
    const actor = requireRole([ROLES.MASTER, ROLES.ASSISTANT]);
    const userId = String(userIdArg || payload?.userId || '').trim();
    if (!userId) throw new Error('Choose the learner first before sending the ticket.');
    const learner = getUserById(userId);
    if (!learner || learner.role !== ROLES.USER) throw new Error('Learner not found for this transport ticket.');
    const option = getTransportOptions().find((item) => item.id === payload?.optionId)
      || getTransportOptions({
        departureCity: payload?.departureCity || '',
        destinationCity: payload?.destinationCity || '',
        company: payload?.company || ''
      })[0]
      || null;
    const records = read(KEYS.transportRequests, []);
    const ticketCode = String(payload?.ticketCode || uid('ticket').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()).trim();
    const sourceKey = String(payload?.requestSourceKey || '').trim();
    const existingIndex = records.findIndex((entry) => {
      const sameUser = String(entry?.userId || '').trim() === userId;
      if (!sameUser) return false;
      if (sourceKey && String(entry?.requestSourceKey || '').trim() === sourceKey) return true;
      return !String(entry?.ticketCode || '').trim()
        && String(entry?.departureCity || '').trim() === String(payload?.departureCity || option?.departureCity || '').trim()
        && String(entry?.destinationCity || '').trim() === String(payload?.destinationCity || option?.destinationCity || '').trim()
        && String(entry?.travelDate || '').trim() === String(payload?.travelDate || '').trim();
    });
    const current = existingIndex >= 0 ? normalizeTransportRequest(records[existingIndex], userId) : normalizeTransportRequest({}, userId);
    const entry = normalizeTransportRequest({
      ...current,
      ...payload,
      userId,
      learnerName: payload?.learnerName || learner.fullName || current.learnerName || '',
      learnerEmail: payload?.learnerEmail || learner.email || current.learnerEmail || '',
      learnerPhone: payload?.learnerPhone || learner.phone || learner.cellphone || current.learnerPhone || '',
      optionId: payload?.optionId || option?.id || current.optionId || '',
      tripType: payload?.tripType || current.tripType || 'One Way',
      company: payload?.company || option?.company || current.company || '',
      departureCity: payload?.departureCity || option?.departureCity || current.departureCity || '',
      destinationCity: payload?.destinationCity || option?.destinationCity || current.destinationCity || '',
      departureTime: payload?.departureTime || option?.departureTime || current.departureTime || '',
      arrivalTime: payload?.arrivalTime || option?.arrivalTime || current.arrivalTime || '',
      travelDate: payload?.travelDate || current.travelDate || '',
      returnDate: payload?.returnDate || current.returnDate || '',
      passengers: payload?.passengers || current.passengers || '1',
      passengerMix: payload?.passengerMix || current.passengerMix || '',
      passengerDetails: normalizeTransportPassengerDetails(payload?.passengerDetails || current.passengerDetails),
      estimatedPrice: payload?.estimatedPrice ?? option?.estimatedPrice ?? current.estimatedPrice ?? 0,
      supportFee: payload?.supportFee ?? option?.supportFee ?? current.supportFee ?? 0,
      requestSourceKey: sourceKey || current.requestSourceKey || '',
      paymentReference: payload?.paymentReference || current.paymentReference || '',
      paymentMethod: payload?.paymentMethod || current.paymentMethod || '',
      paymentAmount: payload?.paymentAmount ?? current.paymentAmount ?? 0,
      paidAt: payload?.paidAt || current.paidAt || '',
      ticketCode,
      ticketStatus: payload?.ticketStatus || 'Ticket sent',
      sentAt: payload?.sentAt || nowISO(),
      bookedByUserId: actor.id,
      bookedByRole: actor.role,
      status: payload?.status || 'Ticket sent'
    }, userId);
    if (existingIndex >= 0) records[existingIndex] = entry;
    else records.push(entry);
    write(KEYS.transportRequests, records);
    updateLatestApplicationTransportService(userId, entry);
    pushNotification(
      userId,
      'Transport ticket ready',
      `${entry.company} ticket from ${entry.departureCity} to ${entry.destinationCity} is now available in your Kagie account.`,
      'success'
    );
    return clone(entry);
  }

  function accommodationRequestToServiceItem(request) {
    return {
      id: request.id,
      userId: request.userId,
      applicationId: '',
      serviceCode: 'accommodation_assist',
      serviceName: 'Accommodation reservation',
      institution: request.institutionName || request.location,
      note: request.supportSummary || request.note,
      status: request.status,
      paymentStatus: 'Reservation request received',
      applicationStatus: STATUS.application.DRAFT,
      requestedAt: request.updatedAt || request.createdAt
    };
  }

  function transportRequestToServiceItem(request) {
    return {
      id: request.id,
      userId: request.userId,
      applicationId: '',
      serviceCode: 'transport_assist',
      serviceName: 'Transport ticket',
      institution: `${request.departureCity} to ${request.destinationCity}`,
      note: request.note,
      status: request.status,
      paymentStatus: request.ticketStatus || request.status || 'Ticket sent',
      applicationStatus: STATUS.application.DRAFT,
      requestedAt: request.createdAt
    };
  }

  async function getAccommodationListingsAsync(filtersArg) {
    return getAccommodationListings(filtersArg);
  }

  async function getTransportOptionsAsync(filtersArg) {
    return getTransportOptions(filtersArg);
  }

  function isRecoverableServiceRequestSyncError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return isRecoverableRemoteSyncError(error)
      || message.includes('accommodation_requests')
      || message.includes('transport_requests')
      || (message.includes('relation') && message.includes('does not exist'))
      || message.includes('row-level security')
      || message.includes('schema cache');
  }

  function normalizeRemoteAccommodationRequestRow(row, requesterUserArg) {
    const requesterUser = requesterUserArg || getUserBySupabaseId(row?.user_id) || getUserById(row?.user_id) || null;
    return normalizeAccommodationRequest({
      id: row?.id || uid('accreq'),
      userId: requesterUser?.id || row?.user_id || '',
      applicationId: row?.application_id || '',
      listingId: row?.listing_id || '',
      propertyName: row?.property_name || '',
      institutionName: row?.institution_name || '',
      province: row?.province || '',
      location: row?.location || '',
      address: row?.address || '',
      roomType: row?.room_type || '',
      price: row?.price || 0,
      learnerName: row?.learner_name || requesterUser?.fullName || '',
      learnerEmail: row?.learner_email || requesterUser?.email || '',
      learnerPhone: row?.learner_phone || requesterUser?.phone || '',
      alternatePhone: row?.alternate_phone || '',
      idNumber: row?.id_number || '',
      studentNumber: row?.student_number || '',
      campusName: row?.campus_name || '',
      yearOfStudy: row?.year_of_study || '',
      gender: row?.gender || '',
      preferredMoveInDate: row?.preferred_move_in_date || '',
      preferredLeaseMonths: row?.preferred_lease_months || '',
      roomPreference: row?.room_preference || '',
      fundingStatus: row?.funding_status || '',
      nsfasBeneficiary: row?.nsfas_beneficiary || '',
      nsfasSinceYear: row?.nsfas_since_year || '',
      nsfasReferenceNumber: row?.nsfas_reference_number || '',
      nsfasAllowanceStatus: row?.nsfas_allowance_status || '',
      bursaryProvider: row?.bursary_provider || '',
      guardianName: row?.guardian_name || '',
      guardianPhone: row?.guardian_phone || '',
      guardianEmail: row?.guardian_email || '',
      emergencyContactName: row?.emergency_contact_name || '',
      emergencyContactPhone: row?.emergency_contact_phone || '',
      emergencyRelationship: row?.emergency_relationship || '',
      documentsReady: row?.documents_ready || '',
      transportNeeded: row?.transport_needed || '',
      specialNeeds: row?.special_needs || '',
      medicalNotes: row?.medical_notes || '',
      contactPhone: row?.contact_phone || row?.learner_phone || '',
      note: row?.note || '',
      supportChecklist: row?.support_checklist || [],
      supportSummary: row?.support_summary || '',
      status: row?.status || 'Support review requested',
      providerPhone: row?.provider_phone || '',
      images: row?.images || [],
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO()
    }, requesterUser?.id || row?.user_id || '');
  }

  function normalizeRemoteTransportRequestRow(row, requesterUserArg, assistantUserArg) {
    const requesterUser = requesterUserArg || getUserBySupabaseId(row?.user_id) || getUserById(row?.user_id) || null;
    const assistantUser = assistantUserArg || getUserBySupabaseId(row?.assigned_assistant_id) || getUserById(row?.assigned_assistant_id) || null;
    return normalizeTransportRequest({
      id: row?.id || uid('transreq'),
      userId: requesterUser?.id || row?.user_id || '',
      applicationId: row?.application_id || '',
      learnerName: row?.learner_name || requesterUser?.fullName || '',
      learnerEmail: row?.learner_email || requesterUser?.email || '',
      learnerPhone: row?.learner_phone || requesterUser?.phone || '',
      assignedAssistantId: assistantUser?.id || row?.assigned_assistant_id || '',
      optionId: row?.option_id || '',
      tripType: row?.trip_type || 'One Way',
      company: row?.company || '',
      departureCity: row?.departure_city || '',
      destinationCity: row?.destination_city || '',
      departureTime: row?.departure_time || '',
      arrivalTime: row?.arrival_time || '',
      travelDate: row?.travel_date || '',
      returnDate: row?.return_date || '',
      passengers: row?.passengers || '1',
      passengerMix: row?.passenger_mix || '',
      passengerDetails: row?.passenger_details || [],
      estimatedPrice: row?.estimated_price || 0,
      supportFee: row?.support_fee || 0,
      note: row?.note || '',
      requestSourceKey: row?.request_source_key || '',
      paymentReference: row?.payment_reference || '',
      paymentMethod: row?.payment_method || '',
      paymentAmount: row?.payment_amount || 0,
      paidAt: row?.paid_at || '',
      ticketCode: row?.ticket_code || '',
      ticketStatus: row?.ticket_status || row?.status || 'Ticket sent',
      sentAt: row?.sent_at || row?.created_at || nowISO(),
      bookedByUserId: row?.booked_by_user_id || '',
      bookedByRole: row?.booked_by_role || '',
      status: row?.status || 'Ticket sent',
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO()
    }, requesterUser?.id || row?.user_id || '');
  }

  function mirrorRemoteAccommodationRequests(itemsArg, fallbackUserId) {
    const normalized = safeArray(itemsArg).map((item) =>
      normalizeAccommodationRequest(item, item?.userId || fallbackUserId || '')
    );
    const targetUserIds = new Set(normalized.map((item) => String(item.userId || '').trim()).filter(Boolean));
    if (fallbackUserId) targetUserIds.add(String(fallbackUserId).trim());

    const retained = read(KEYS.accommodationRequests, [])
      .map((item) => normalizeAccommodationRequest(item, item?.userId || ''))
      .filter((item) => !targetUserIds.has(String(item.userId || '').trim()));
    write(KEYS.accommodationRequests, retained.concat(normalized));
    return normalized.map(clone);
  }

  function mirrorRemoteTransportRequests(itemsArg, fallbackUserId) {
    const normalized = safeArray(itemsArg).map((item) =>
      normalizeTransportRequest(item, item?.userId || fallbackUserId || '')
    );
    const targetUserIds = new Set(normalized.map((item) => String(item.userId || '').trim()).filter(Boolean));
    if (fallbackUserId) targetUserIds.add(String(fallbackUserId).trim());

    const retained = read(KEYS.transportRequests, [])
      .map((item) => normalizeTransportRequest(item, item?.userId || ''))
      .filter((item) => !targetUserIds.has(String(item.userId || '').trim()));
    write(KEYS.transportRequests, retained.concat(normalized));
    return normalized.map(clone);
  }

  async function getAccommodationRequestsAsync(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = viewer.role === ROLES.USER ? viewer.id : String(userIdArg || '').trim();
    if (!targetUserId && viewer.role !== ROLES.USER) return [];

    const local = getAccommodationRequests(targetUserId || viewer.id);
    const ctx = await resolveSupabaseContext(targetUserId || viewer.id);
    if (!ctx?.targetRemoteId) return local;

    const query = await ctx.client
      .from('accommodation_requests')
      .select('*')
      .eq('user_id', ctx.targetRemoteId)
      .order('updated_at', { ascending: false });
    if (query.error) {
      if (isRecoverableServiceRequestSyncError(query.error)) {
        console.warn('Falling back to local accommodation requests because the remote table is unavailable.', query.error);
        return local;
      }
      throw new Error(query.error.message || 'Could not load accommodation requests.');
    }

    const requesterUser = ctx.targetLocalUser || getUserByIdentity(targetUserId) || viewer;
    const items = safeArray(query.data).map((row) => normalizeRemoteAccommodationRequestRow(row, requesterUser));
    return mirrorRemoteAccommodationRequests(items, requesterUser?.id || targetUserId);
  }

  async function getTransportRequestsAsync(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = viewer.role === ROLES.USER ? viewer.id : String(userIdArg || '').trim();
    if (!targetUserId && viewer.role !== ROLES.USER) return [];

    const local = getTransportRequests(targetUserId || viewer.id);
    const ctx = await resolveSupabaseContext(targetUserId || viewer.id);
    if (!ctx?.targetRemoteId) return local;

    const query = await ctx.client
      .from('transport_requests')
      .select('*')
      .eq('user_id', ctx.targetRemoteId)
      .order('created_at', { ascending: false });
    if (query.error) {
      if (isRecoverableServiceRequestSyncError(query.error)) {
        console.warn('Falling back to local transport requests because the remote table is unavailable.', query.error);
        return local;
      }
      throw new Error(query.error.message || 'Could not load transport requests.');
    }

    const remoteIds = safeArray(query.data).flatMap((row) => [row.user_id, row.assigned_assistant_id]).filter(Boolean);
    const syncedUsers = await fetchRemoteUsersByIds(remoteIds, ctx.client).catch(() => []);
    const userMap = new Map(syncedUsers.map((user) => [user.supabaseUserId, user]));
    const requesterUser = ctx.targetLocalUser || getUserByIdentity(targetUserId) || viewer;
    const items = safeArray(query.data).map((row) =>
      normalizeRemoteTransportRequestRow(row, userMap.get(row.user_id) || requesterUser, userMap.get(row.assigned_assistant_id))
    );
    return mirrorRemoteTransportRequests(items, requesterUser?.id || targetUserId);
  }

  async function submitAccommodationRequestAsync(payload, userIdArg) {
    const actor = requireRole([ROLES.USER]);
    const targetUserId = userIdArg || actor.id;
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx?.targetRemoteId) return submitAccommodationRequest(payload, userIdArg);

    const user = ctx.targetLocalUser || actor;
    const profile = await getProfileAsync(targetUserId).catch(() => ({}));
    const latestApplication = await getLatestApplicationAsync(targetUserId).catch(() => null);
    const listing = getAccommodationListings().find((item) => item.id === payload?.listingId)
      || getAccommodationListings({ query: payload?.propertyName || '' }).find((item) => item.propertyName === payload?.propertyName)
      || null;

    const draft = normalizeAccommodationRequest({
      ...payload,
      userId: targetUserId,
      applicationId: payload?.applicationId || latestApplication?.id || '',
      listingId: payload?.listingId || listing?.id || '',
      propertyName: payload?.propertyName || listing?.propertyName || '',
      institutionName: payload?.institutionName || listing?.institutionName || '',
      province: payload?.province || listing?.province || '',
      location: payload?.location || listing?.location || '',
      address: payload?.address || listing?.address || '',
      roomType: payload?.roomType || listing?.roomType || '',
      price: payload?.price ?? listing?.price ?? 0,
      learnerName: payload?.learnerName || payload?.fullName || user?.fullName || profile?.fullName || '',
      learnerEmail: payload?.learnerEmail || payload?.email || user?.email || profile?.email || '',
      learnerPhone: payload?.learnerPhone || payload?.contactPhone || user?.phone || profile?.phone || '',
      idNumber: payload?.idNumber || profile?.idNumber || '',
      studentNumber: payload?.studentNumber || profile?.studentNumber || '',
      supportSummary: payload?.supportSummary || buildAccommodationSupportSummary(payload),
      supportChecklist: payload?.supportChecklist || [],
      status: payload?.status || 'Support review requested',
      images: payload?.images || listing?.images || []
    }, targetUserId);

    const savePayload = {
      user_id: ctx.targetRemoteId,
      application_id: draft.applicationId || null,
      listing_id: draft.listingId || '',
      property_name: draft.propertyName,
      institution_name: draft.institutionName,
      province: draft.province,
      location: draft.location,
      address: draft.address,
      room_type: draft.roomType,
      price: Number(draft.price || 0),
      learner_name: draft.learnerName,
      learner_email: draft.learnerEmail,
      learner_phone: draft.learnerPhone,
      alternate_phone: draft.alternatePhone,
      id_number: draft.idNumber,
      student_number: draft.studentNumber,
      campus_name: draft.campusName,
      year_of_study: draft.yearOfStudy,
      gender: draft.gender,
      preferred_move_in_date: toDateOrNull(draft.preferredMoveInDate),
      preferred_lease_months: draft.preferredLeaseMonths,
      room_preference: draft.roomPreference,
      funding_status: draft.fundingStatus,
      nsfas_beneficiary: draft.nsfasBeneficiary,
      nsfas_since_year: draft.nsfasSinceYear,
      nsfas_reference_number: draft.nsfasReferenceNumber,
      nsfas_allowance_status: draft.nsfasAllowanceStatus,
      bursary_provider: draft.bursaryProvider,
      guardian_name: draft.guardianName,
      guardian_phone: draft.guardianPhone,
      guardian_email: draft.guardianEmail,
      emergency_contact_name: draft.emergencyContactName,
      emergency_contact_phone: draft.emergencyContactPhone,
      emergency_relationship: draft.emergencyRelationship,
      documents_ready: draft.documentsReady,
      transport_needed: draft.transportNeeded,
      special_needs: draft.specialNeeds,
      medical_notes: draft.medicalNotes,
      contact_phone: draft.contactPhone,
      note: draft.note,
      support_checklist: draft.supportChecklist,
      support_summary: draft.supportSummary || buildAccommodationSupportSummary(draft),
      status: draft.status,
      provider_phone: draft.providerPhone,
      images: draft.images
    };

    const existingQuery = await ctx.client
      .from('accommodation_requests')
      .select('id')
      .eq('user_id', ctx.targetRemoteId)
      .eq('listing_id', draft.listingId || '')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingQuery.error && !isRecoverableServiceRequestSyncError(existingQuery.error)) {
      throw new Error(existingQuery.error.message || 'Could not load the existing accommodation request.');
    }

    let saved;
    if (existingQuery.data?.id) {
      saved = await ctx.client
        .from('accommodation_requests')
        .update(savePayload)
        .eq('id', existingQuery.data.id)
        .select('*')
        .single();
    } else {
      saved = await ctx.client
        .from('accommodation_requests')
        .insert(savePayload)
        .select('*')
        .single();
    }
    if (saved.error) {
      if (isRecoverableServiceRequestSyncError(saved.error)) {
        console.warn('Falling back to local accommodation request save because the remote table is unavailable.', saved.error);
        return submitAccommodationRequest(payload, userIdArg);
      }
      throw new Error(saved.error.message || 'Could not save the accommodation request.');
    }

    const entry = normalizeRemoteAccommodationRequestRow(saved.data, user);
    mirrorRemoteAccommodationRequests([entry], user.id || targetUserId);
    return entry;
  }

  async function submitTransportRequestAsync(payload, userIdArg) {
    const actor = requireRole([ROLES.MASTER, ROLES.ASSISTANT]);
    const targetUserId = String(userIdArg || payload?.userId || '').trim();
    if (!targetUserId) throw new Error('Choose the learner first before sending the ticket.');

    const actorCtx = await resolveSupabaseContext(actor.id);
    const learnerCtx = await resolveSupabaseContext(targetUserId);
    if (!actorCtx?.remoteSelfId || !learnerCtx?.targetRemoteId) return submitTransportRequest(payload, userIdArg);

    const learner = learnerCtx.targetLocalUser || getUserByIdentity(targetUserId) || null;
    if (!learner || normalizeKagieRole(learner.role, learner.role || ROLES.USER) !== ROLES.USER) {
      throw new Error('Learner not found for this transport ticket.');
    }

    const option = getTransportOptions().find((item) => item.id === payload?.optionId)
      || getTransportOptions({
        departureCity: payload?.departureCity || '',
        destinationCity: payload?.destinationCity || '',
        company: payload?.company || ''
      })[0]
      || null;
    const latestApplication = await getLatestApplicationAsync(targetUserId).catch(() => null);
    const draft = normalizeTransportRequest({
      ...payload,
      userId: targetUserId,
      applicationId: payload?.applicationId || latestApplication?.id || '',
      learnerName: payload?.learnerName || learner.fullName || '',
      learnerEmail: payload?.learnerEmail || learner.email || '',
      learnerPhone: payload?.learnerPhone || learner.phone || learner.cellphone || '',
      assignedAssistantId: payload?.assignedAssistantId || (actor.role === ROLES.ASSISTANT ? actor.id : ''),
      optionId: payload?.optionId || option?.id || '',
      tripType: payload?.tripType || 'One Way',
      company: payload?.company || option?.company || '',
      departureCity: payload?.departureCity || option?.departureCity || '',
      destinationCity: payload?.destinationCity || option?.destinationCity || '',
      departureTime: payload?.departureTime || option?.departureTime || '',
      arrivalTime: payload?.arrivalTime || option?.arrivalTime || '',
      supportFee: payload?.supportFee ?? option?.supportFee ?? 0,
      estimatedPrice: payload?.estimatedPrice ?? payload?.paymentAmount ?? 0,
      bookedByUserId: actor.id,
      bookedByRole: actor.role,
      ticketStatus: payload?.ticketStatus || payload?.status || 'Ticket sent',
      status: payload?.status || 'Ticket sent',
      sentAt: payload?.sentAt || nowISO()
    }, targetUserId);

    let assignedAssistantRemoteId = null;
    if (draft.assignedAssistantId) {
      const assistantCtx = await resolveSupabaseContext(draft.assignedAssistantId);
      assignedAssistantRemoteId = assistantCtx?.targetRemoteId || null;
    } else if (actor.role === ROLES.ASSISTANT) {
      assignedAssistantRemoteId = actorCtx.remoteSelfId;
    }

    const savePayload = {
      user_id: learnerCtx.targetRemoteId,
      application_id: draft.applicationId || null,
      assigned_assistant_id: assignedAssistantRemoteId,
      option_id: draft.optionId,
      trip_type: draft.tripType,
      company: draft.company,
      departure_city: draft.departureCity,
      destination_city: draft.destinationCity,
      departure_time: draft.departureTime,
      arrival_time: draft.arrivalTime,
      travel_date: toDateOrNull(draft.travelDate),
      return_date: toDateOrNull(draft.returnDate),
      passengers: draft.passengers,
      passenger_mix: draft.passengerMix,
      passenger_details: draft.passengerDetails,
      estimated_price: Number(draft.estimatedPrice || 0),
      support_fee: Number(draft.supportFee || 0),
      note: draft.note,
      request_source_key: draft.requestSourceKey,
      payment_reference: draft.paymentReference,
      payment_method: draft.paymentMethod,
      payment_amount: Number(draft.paymentAmount || 0),
      paid_at: draft.paidAt || null,
      ticket_code: draft.ticketCode,
      ticket_status: draft.ticketStatus,
      sent_at: draft.sentAt || nowISO(),
      booked_by_user_id: actorCtx.remoteSelfId,
      booked_by_role: draft.bookedByRole || actor.role,
      status: draft.status,
      learner_name: draft.learnerName,
      learner_email: draft.learnerEmail,
      learner_phone: draft.learnerPhone
    };

    let existingQuery;
    if (draft.requestSourceKey) {
      existingQuery = await actorCtx.client
        .from('transport_requests')
        .select('id')
        .eq('user_id', learnerCtx.targetRemoteId)
        .eq('request_source_key', draft.requestSourceKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    } else {
      existingQuery = await actorCtx.client
        .from('transport_requests')
        .select('id')
        .eq('user_id', learnerCtx.targetRemoteId)
        .eq('departure_city', draft.departureCity)
        .eq('destination_city', draft.destinationCity)
        .eq('travel_date', toDateOrNull(draft.travelDate))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }
    if (existingQuery.error && !isRecoverableServiceRequestSyncError(existingQuery.error)) {
      throw new Error(existingQuery.error.message || 'Could not load the existing transport request.');
    }

    let saved;
    if (existingQuery.data?.id) {
      saved = await actorCtx.client
        .from('transport_requests')
        .update(savePayload)
        .eq('id', existingQuery.data.id)
        .select('*')
        .single();
    } else {
      saved = await actorCtx.client
        .from('transport_requests')
        .insert(savePayload)
        .select('*')
        .single();
    }
    if (saved.error) {
      if (isRecoverableServiceRequestSyncError(saved.error)) {
        console.warn('Falling back to local transport request save because the remote table is unavailable.', saved.error);
        return submitTransportRequest(payload, userIdArg);
      }
      throw new Error(saved.error.message || 'Could not save the transport request.');
    }

    const entry = normalizeRemoteTransportRequestRow(saved.data, learner, actor.role === ROLES.ASSISTANT ? actor : null);
    mirrorRemoteTransportRequests([entry], learner.id || targetUserId);
    await logAssistantActivityAsync({
      assistantId: actor.id,
      applicationId: draft.applicationId || latestApplication?.id || null,
      action: 'transport_ticket_saved',
      details: {
        transportRequestId: entry.id,
        learnerId: learner.id || targetUserId,
        ticketStatus: entry.ticketStatus || entry.status
      }
    }).catch(() => {});
    return entry;
  }

  function getServiceRequestsForUser(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const apps = getAllApplications().filter((app) => app.userId === userId);
    return getServiceRequestsFromApplications(apps, userId)
      .concat(getAccommodationRequests(userId).map(accommodationRequestToServiceItem))
      .concat(getTransportRequests(userId).map(transportRequestToServiceItem))
      .map(clone);
  }

  function createReminderEntry(id, title, message, type, route, createdAt) {
    return {
      id,
      title,
      message,
      type: type || 'info',
      route: route || 'home.html',
      createdAt: createdAt || nowISO()
    };
  }

  function daysUntilDate(dateValue) {
    if (!dateValue) return null;
    const today = new Date(`${getTodayKey()}T00:00:00`);
    const target = new Date(`${String(dateValue).trim()}T23:59:59`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  }

  function buildReminderEntries(payload) {
    const latest = payload?.latest || null;
    const deadlines = safeArray(payload?.deadlines);
    const docs = safeArray(payload?.documents);
    const favorites = safeArray(payload?.favorites);
    const serviceRequests = safeArray(payload?.serviceRequests);
    const recommendations = payload?.recommendations || { safeAlternatives: [] };
    const reminders = [];
    const seen = new Set();
    const push = (entry) => {
      if (!entry?.title) return;
      const key = `${entry.title}::${entry.message || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      reminders.push(entry);
    };

    const nextDeadline = deadlines.find((item) => item.deadline && daysUntilDate(item.deadline) !== null);
    if (nextDeadline) {
      const daysLeft = daysUntilDate(nextDeadline.deadline);
      if (daysLeft !== null && daysLeft <= 14) {
        push(createReminderEntry(
          `reminder_deadline_${nextDeadline.institutionName}`,
          daysLeft <= 7 ? 'Institution deadline closing soon' : 'Institution deadline approaching',
          `${nextDeadline.institutionName} closes on ${nextDeadline.deadline}.`,
          daysLeft <= 7 ? 'warning' : 'info',
          'forms.html',
          nowISO()
        ));
      }
    }

    if (latest?.paymentStatus === STATUS.payment.PENDING && !latest?.payment?.proofUploadedAt) {
      push(createReminderEntry(
        'reminder_payment_proof',
        'Upload proof of payment',
        'Your application needs a payment proof before Kagie can verify your payment.',
        'warning',
        'upload.html',
        nowISO()
      ));
    }

    if (latest?.paymentStatus === STATUS.payment.REJECTED) {
      push(createReminderEntry(
        'reminder_payment_rejected',
        'Payment proof needs attention',
        latest?.payment?.rejectionReason
          ? `Re-upload a clearer proof of payment. Reason: ${latest.payment.rejectionReason}`
          : 'Re-upload a clearer proof of payment so Kagie can continue.',
        'error',
        'upload.html',
        nowISO()
      ));
    }

    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION) {
      push(createReminderEntry(
        'reminder_payment_verification',
        'Payment verification in progress',
        'Your payment proof has been received and is waiting for verification.',
        'info',
        'home.html',
        nowISO()
      ));
    }

    const hasIdentityDoc = docs.some((doc) => String(doc.category || '').toLowerCase() === 'id_document');
    if (!hasIdentityDoc) {
      push(createReminderEntry(
        'reminder_id_document',
        'Upload your ID document',
        'Adding your ID document helps Kagie move your application and verification faster.',
        'warning',
        'upload.html',
        nowISO()
      ));
    }

    if (serviceRequests.length) {
      const pendingService = serviceRequests.find((item) => String(item.status || '').toLowerCase().includes('pending') || String(item.status || '').toLowerCase().includes('queued'));
      if (pendingService) {
        push(createReminderEntry(
          `reminder_service_${pendingService.id}`,
          `${pendingService.serviceName} is in progress`,
          `${pendingService.serviceName} is linked to your dashboard and will update as Kagie moves it forward.`,
          'info',
          'home.html',
          pendingService.requestedAt || nowISO()
        ));
      }
    }

    if (favorites.length && !safeArray(latest?.institutions).length) {
      push(createReminderEntry(
        'reminder_favorites',
        'Use your saved favorites',
        'You already saved institutions or courses. Add them into your shortlist when you are ready.',
        'info',
        'forms.html',
        nowISO()
      ));
    }

    if (recommendations?.safeAlternatives?.[0]) {
      const option = recommendations.safeAlternatives[0];
      push(createReminderEntry(
        'reminder_recommendation',
        'Recommended safer option available',
        `${option.course} at ${option.institutionName} looks like a strong match for your current APS.`,
        'info',
        'forms.html',
        nowISO()
      ));
    }

    return reminders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function inferServiceBucket(service) {
    const raw = `${service?.serviceCode || ''} ${service?.serviceName || service?.name || ''}`.trim().toLowerCase();
    if (raw.includes('accommodation')) return 'accommodation';
    if (raw.includes('transport')) return 'transport';
    if (raw.includes('fund') || raw.includes('nsfas') || raw.includes('bursary')) return 'funding';
    if (raw.includes('re-apply') || raw.includes('reapply') || raw.includes('correction') || raw.includes('change email') || raw.includes('forgot')) return 'correction';
    return 'general';
  }

  function buildServiceOverview(serviceRequestsArg) {
    const counts = {
      total: 0,
      accommodation: 0,
      transport: 0,
      funding: 0,
      correction: 0,
      general: 0
    };

    safeArray(serviceRequestsArg).forEach((service) => {
      counts.total += 1;
      const bucket = inferServiceBucket(service);
      counts[bucket] = (counts[bucket] || 0) + 1;
    });

    return counts;
  }

  function buildAcceptanceChecklist(latest, docsArg, serviceOverviewArg) {
    const docs = safeArray(docsArg);
    const serviceOverview = serviceOverviewArg || buildServiceOverview([]);
    const hasCategory = (category) => docs.some((doc) => String(doc?.category || '').trim().toLowerCase() === category);
    const unlocked = latest?.status === STATUS.application.ACCEPTED;
    const items = [
      {
        id: 'acceptance_offer',
        title: 'Save your acceptance proof',
        done: hasCategory('acceptance_letter'),
        route: 'upload.html'
      },
      {
        id: 'acceptance_id',
        title: 'Keep your ID document ready',
        done: hasCategory('id_document'),
        route: 'upload.html'
      },
      {
        id: 'acceptance_payment',
        title: 'Keep payment proof available',
        done: hasCategory('proof_of_payment') || !!latest?.payment?.proofUploadedAt,
        route: 'upload.html'
      },
      {
        id: 'acceptance_funding',
        title: 'Set your funding support plan',
        done: serviceOverview.funding > 0 || hasCategory('nsfas_document') || hasCategory('bursary_document'),
        route: 'more-service/index.html'
      },
      {
        id: 'acceptance_accommodation',
        title: 'Plan accommodation',
        done: serviceOverview.accommodation > 0,
        route: 'more-service/accommodation-assist.html'
      },
      {
        id: 'acceptance_transport',
        title: 'Plan transport',
        done: serviceOverview.transport > 0,
        route: 'more-service/transport-assist.html'
      }
    ];

    return {
      unlocked,
      total: items.length,
      completed: items.filter((item) => item.done).length,
      items
    };
  }

  function buildJourneyBoard(payload) {
    const latest = payload?.latest || null;
    const docs = safeArray(payload?.documents);
    const packageUsage = payload?.packageUsage || { packageName: '', institutionLimit: 0, usedSlots: 0, remainingSlots: 0 };
    const serviceOverview = payload?.serviceOverview || buildServiceOverview([]);
    const acceptanceChecklist = payload?.acceptanceChecklist || buildAcceptanceChecklist(latest, docs, serviceOverview);
    const hasIdDocument = docs.some((doc) => String(doc?.category || '').trim().toLowerCase() === 'id_document');
    const hasCoreDocuments = docs.length >= 2;
    const remainingSlots = packageUsage.remainingSlots === undefined || packageUsage.remainingSlots === null ? 0 : packageUsage.remainingSlots;
    const packageLimitLabel = packageUsage.institutionLimit === 'unlimited' ? 'Unlimited' : Number(packageUsage.institutionLimit || 0);

    return [
      {
        id: 'journey_application',
        title: 'Application basket',
        value: packageUsage.packageName ? `${packageUsage.usedSlots || 0}/${packageLimitLabel}` : 'Choose pack',
        note: packageUsage.packageName
          ? `${packageUsage.packageName} active. Remaining slots: ${remainingSlots}.`
          : 'Select a Kagie pack and build your shortlist.',
        tone: packageUsage.packageName ? 'blue' : 'yellow',
        route: 'forms.html'
      },
      {
        id: 'journey_documents',
        title: 'Document vault',
        value: `${docs.length} file${docs.length === 1 ? '' : 's'}`,
        note: hasIdDocument ? 'ID document saved in your vault.' : 'Upload your ID document and latest results.',
        tone: hasCoreDocuments && hasIdDocument ? 'green' : 'orange',
        route: 'upload.html'
      },
      {
        id: 'journey_payment',
        title: 'Payment state',
        value: latest?.paymentStatus || STATUS.payment.PENDING,
        note: latest?.paymentStatus === STATUS.payment.REJECTED
          ? (latest?.payment?.rejectionReason || 'Re-upload a clearer proof of payment.')
          : latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION
            ? 'Your payment proof is waiting for verification.'
            : latest?.paymentStatus === STATUS.payment.VERIFIED
              ? 'Your payment is verified and ready for the next step.'
              : 'Complete checkout and upload your payment proof.',
        tone: latest?.paymentStatus === STATUS.payment.VERIFIED ? 'green' : latest?.paymentStatus === STATUS.payment.REJECTED ? 'red' : 'orange',
        route: 'checkout.html'
      },
      {
        id: 'journey_funding',
        title: 'Funding support',
        value: serviceOverview.funding ? `${serviceOverview.funding} request${serviceOverview.funding === 1 ? '' : 's'}` : 'Not started',
        note: serviceOverview.funding ? 'NSFAS or bursary support is linked to your dashboard.' : 'Add funding help when you need bursary or NSFAS guidance.',
        tone: serviceOverview.funding ? 'green' : 'blue',
        route: 'more-service/index.html'
      },
      {
        id: 'journey_acceptance',
        title: 'Acceptance readiness',
        value: acceptanceChecklist.unlocked ? `${acceptanceChecklist.completed}/${acceptanceChecklist.total}` : 'Locked',
        note: acceptanceChecklist.unlocked
          ? 'Track registration, funding, housing, and transport once you are accepted.'
          : 'This checklist unlocks when an application reaches Accepted.',
        tone: acceptanceChecklist.unlocked ? 'green' : 'blue',
        route: 'home.html'
      }
    ];
  }

  function buildPriorityActions(payload) {
    const latest = payload?.latest || null;
    const docs = safeArray(payload?.documents);
    const favorites = safeArray(payload?.favorites);
    const recommendations = payload?.recommendations || { safeAlternatives: [] };
    const acceptanceChecklist = payload?.acceptanceChecklist || { unlocked: false, completed: 0, total: 0 };
    const serviceOverview = payload?.serviceOverview || buildServiceOverview([]);
    const actions = [];

    const push = (id, title, message, route, tone) => {
      if (actions.some((item) => item.id === id)) return;
      actions.push({ id, title, message, route, tone: tone || 'blue' });
    };

    if (!latest?.package) push('priority_pack', 'Choose your Kagie pack', 'Pick the package that matches how many institutions you want to cover.', 'forms.html', 'yellow');
    if (!safeArray(latest?.institutions).length) push('priority_shortlist', 'Build your shortlist', 'Add at least one institution and three course choices to move forward.', 'forms.html', 'orange');
    if (latest?.paymentStatus === STATUS.payment.PENDING && !latest?.payment?.proofUploadedAt) push('priority_payment_proof', 'Upload proof of payment', 'Your payment proof is the fastest way to move checkout into verification.', 'upload.html', 'orange');
    if (latest?.paymentStatus === STATUS.payment.REJECTED) push('priority_payment_retry', 'Re-upload payment proof', latest?.payment?.rejectionReason || 'Your payment proof needs a clearer upload.', 'upload.html', 'red');
    if (docs.length < 2) push('priority_docs', 'Upload your core documents', 'Certified ID and recent academic results strengthen your application file.', 'upload.html', 'blue');
    if (favorites.length && !safeArray(latest?.institutions).length) push('priority_favorites', 'Reuse your saved favorites', 'You already saved institutions or courses that can speed up your shortlist.', 'forms.html', 'blue');
    if (!serviceOverview.funding) push('priority_funding', 'Add funding help if needed', 'You can link NSFAS or bursary support into your Kagie journey.', 'more-service/index.html', 'green');
    if (acceptanceChecklist.unlocked && acceptanceChecklist.completed < acceptanceChecklist.total) push('priority_acceptance', 'Finish your acceptance checklist', 'Keep your post-acceptance steps together in one place.', 'home.html', 'green');
    if (recommendations?.safeAlternatives?.[0]) {
      const option = recommendations.safeAlternatives[0];
      push('priority_recommendation', 'Review your best-fit recommendation', `${option.course} at ${option.institutionName} looks like a strong match right now.`, 'forms.html', 'blue');
    }

    return actions.slice(0, 5);
  }

  function normalizeInstitutionLifecycleStatus(status, allowAuto = false) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'open') return 'open';
    if (value === 'closing soon' || value === 'closing_soon') return 'closing_soon';
    if (value === 'closed') return 'closed';
    if (allowAuto && value === 'auto') return 'auto';
    return '';
  }

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function deriveInstitutionLifecycleStatus(record) {
    if (record.isActive === false) return 'closed';

    const manualStatus = normalizeInstitutionLifecycleStatus(record.manualStatus || record.manual_status);
    if (manualStatus) return manualStatus;

    const closingDate = String(record.closingDate || record.closing_date || record.applicationDeadline || '').trim();
    if (!closingDate) return 'open';

    const today = getTodayKey();
    if (today > closingDate) return 'closed';

    const diffMs = new Date(`${closingDate}T23:59:59`).getTime() - new Date(`${today}T00:00:00`).getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays <= 7 ? 'closing_soon' : 'open';
  }

  function institutionStatusPriority(status) {
    if (status === 'open') return 0;
    if (status === 'closing_soon') return 1;
    return 2;
  }

  function getInstitutionStatusLabel(status) {
    if (status === 'open') return 'Open';
    if (status === 'closing_soon') return 'Closing Soon';
    return 'Closed';
  }

  function normalizeInstitutionNameKey(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[.,'"]/g, '')
      .toLowerCase();
  }

  function normalizeInstitutionDedupeKey(record) {
    const nameKey = normalizeInstitutionNameKey(record?.name || record?.institution || record?.institutionName);
    return nameKey || '';
  }

  function mergeInstitutionFaculties(primary, duplicate) {
    const byName = new Map();
    safeArray(primary?.faculties).concat(safeArray(duplicate?.faculties)).forEach((faculty) => {
      const name = String(faculty?.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = byName.get(key) || { ...faculty, courses: [] };
      const courses = [...safeArray(existing.courses), ...safeArray(faculty?.courses)]
        .map((course) => String(course || '').trim())
        .filter(Boolean);
      byName.set(key, {
        ...existing,
        ...faculty,
        name,
        courses: [...new Set(courses)],
        courseCount: Math.max(Number(existing.courseCount || 0), Number(faculty?.courseCount || 0), courses.length)
      });
    });
    return Array.from(byName.values());
  }

  function preferInstitutionRecord(a, b) {
    if (!a) return b;
    if (!b) return a;

    const aStatus = institutionStatusPriority(a.status);
    const bStatus = institutionStatusPriority(b.status);
    if (bStatus < aStatus) return b;

    const aFacultyScore = safeArray(a.faculties).length + Number(a.courseCount || 0);
    const bFacultyScore = safeArray(b.faculties).length + Number(b.courseCount || 0);
    if (bFacultyScore > aFacultyScore) return b;

    if (String(b.year || '').localeCompare(String(a.year || '')) > 0) return b;
    return a;
  }

  function mergeInstitutionDuplicates(existing, incoming) {
    const preferred = preferInstitutionRecord(existing, incoming) || existing || incoming;
    const secondary = preferred === existing ? incoming : existing;
    const mergedFaculties = mergeInstitutionFaculties(preferred, secondary);
    const facultyCount = mergedFaculties.length;
    const courseCount = mergedFaculties.reduce((sum, faculty) => sum + Number(faculty.courseCount || safeArray(faculty.courses).length || 0), 0);
    return normalizeInstitutionCatalogEntry({
      ...(secondary || {}),
      ...(preferred || {}),
      id: preferred?.id || secondary?.id,
      faculties: mergedFaculties,
      facultyCount,
      courseCount,
      shortName: preferred?.shortName || secondary?.shortName || '',
      logo: preferred?.logo || secondary?.logo || '',
      studyOverview: preferred?.studyOverview || secondary?.studyOverview || ''
    }, 1);
  }

  function dedupeInstitutionCatalog(records) {
    const byKey = new Map();
    safeArray(records).forEach((record, index) => {
      const normalized = normalizeInstitutionCatalogEntry(record, index + 1);
      const key = normalizeInstitutionDedupeKey(normalized);
      if (!key || normalized._deleted) return;
      const current = byKey.get(key);
      byKey.set(key, current ? mergeInstitutionDuplicates(current, normalized) : normalized);
    });
    return Array.from(byKey.values());
  }

  function defaultInstitutionApplicationFee(source) {
    const type = String(source?.type || source?.institutionType || '').trim().toLowerCase();
    const name = String(source?.name || source?.institution || '').trim().toLowerCase();
    if (!type && !name) return 0;

    if (type === 'tvet' || /tvet/.test(name)) return 0;
    if (/cape town|stellenbosch|witwatersrand|wits|pretoria/.test(name)) return 100;
    if (/johannesburg|ukzn|kwazulu-natal|western cape|ufs|free state|nelson mandela|north-west|walter sisulu/.test(name)) return 200;
    if (/tshwane university of technology|durban university of technology|mangosuthu/.test(name)) return 240;
    if (/unisa|south africa/.test(name)) return 140;
    if (type === 'university of technology') return 240;
    if (type === 'university') return 200;
    return 0;
  }

  function resolveInstitutionApplicationFee(source) {
    const numericFee = Number(
      source?.applicationFee ??
      source?.application_fee ??
      source?.fee ??
      source?.feeAmount ??
      source?.fee_amount
    );
    const applicationFee = Number.isFinite(numericFee) ? Math.max(0, numericFee) : defaultInstitutionApplicationFee(source);
    const applicationFeeLabel = String(
      source?.applicationFeeLabel ||
      source?.application_fee_label ||
      (applicationFee > 0 ? `Institution fee: ${formatMoneyLabel(applicationFee)}` : 'Institution fee: Free')
    ).trim();
    const applicationFeeNote = String(
      source?.applicationFeeNote ||
      source?.application_fee_note ||
      (applicationFee > 0
        ? 'This fee is charged by the institution, not by Kagie. It may change by programme or intake.'
        : 'This institution may not charge an application fee. That is separate from Kagie pricing.')
    ).trim();
    return {
      applicationFee,
      applicationFeeLabel,
      applicationFeeNote
    };
  }

  function normalizeInstitutionCatalogEntry(item, fallbackIndex) {
    const source = item && typeof item === 'object' ? item : {};
    const closingDate = String(source.closingDate || source.closing_date || source.applicationDeadline || '').trim();
    const derivedYear = String(source.year || closingDate.slice(0, 4) || new Date().getFullYear());
    const openingDate = String(source.openingDate || source.opening_date || `${derivedYear}-01-15`).trim();
    const isActive = source.isActive !== false && source.is_active !== false;
    const feeState = resolveInstitutionApplicationFee(source);
    const faculties = safeArray(source.faculties).map((faculty, index) => {
      const courses = safeArray(faculty?.courses).map((course) => String(course || '').trim()).filter(Boolean);
      return {
        id: faculty?.id || `${source.id || source.name || 'faculty'}_${index + 1}`,
        name: String(faculty?.name || '').trim(),
        courses,
        courseCount: Math.max(0, Number(faculty?.courseCount || courses.length) || courses.length),
        featuredCourses: safeArray(faculty?.featuredCourses).length ? safeArray(faculty?.featuredCourses).map((course) => String(course || '').trim()).filter(Boolean) : courses.slice(0, 4),
        summary: String(faculty?.summary || '').trim(),
        focusTags: safeArray(faculty?.focusTags).map((tag) => String(tag || '').trim()).filter(Boolean)
      };
    }).filter((faculty) => faculty.name);
    const facultyCount = Math.max(0, Number(source.facultyCount || faculties.length) || faculties.length);
    const courseCount = Math.max(0, Number(source.courseCount || faculties.reduce((sum, faculty) => sum + Number(faculty.courseCount || safeArray(faculty.courses).length || 0), 0)) || 0);

    const normalized = {
      id: String(source.id || `institution_${fallbackIndex || 1}`).trim(),
      name: String(source.name || source.institution || '').trim(),
      shortName: String(source.shortName || source.short_name || '').trim(),
      province: String(source.province || '').trim(),
      type: String(source.type || source.institutionType || '').trim(),
      website: String(source.website || '').trim(),
      notes: String(source.notes || '').trim(),
      logo: String(source.logo || '').trim(),
      year: derivedYear,
      applicationFee: feeState.applicationFee,
      application_fee: feeState.applicationFee,
      applicationFeeLabel: feeState.applicationFeeLabel,
      application_fee_label: feeState.applicationFeeLabel,
      applicationFeeNote: feeState.applicationFeeNote,
      application_fee_note: feeState.applicationFeeNote,
      openingDate,
      opening_date: openingDate,
      closingDate,
      closing_date: closingDate,
      applicationDeadline: closingDate,
      isActive,
      is_active: isActive,
      manualStatus: normalizeInstitutionLifecycleStatus(source.manualStatus || source.manual_status),
      faculties,
      facultyCount,
      courseCount,
      studyOverview: String(source.studyOverview || '').trim() || (facultyCount ? `${facultyCount} guided faculties and ${courseCount} visible course options are ready in Kagie for comparison.` : ''),
      courseEntryMode: source.courseEntryMode || (faculties.length ? 'guided' : 'manual'),
      createdAt: source.createdAt || nowISO(),
      updatedAt: source.updatedAt || nowISO(),
      _deleted: !!source._deleted
    };

    return {
      ...normalized,
      status: normalizeInstitutionLifecycleStatus(source.status) || deriveInstitutionLifecycleStatus(normalized),
      statusLabel: getInstitutionStatusLabel(normalizeInstitutionLifecycleStatus(source.status) || deriveInstitutionLifecycleStatus(normalized)),
      canApply: isActive && deriveInstitutionLifecycleStatus(normalized) !== 'closed'
    };
  }

  function invalidateInstitutionCatalogCache() {
    institutionCatalogCache = null;
    institutionQueryCache.clear();
  }

  function refreshCatalogCaches() {
    invalidatePackCatalogCache();
    invalidateInstitutionCatalogCache();
    remoteInstitutionCatalogCache = null;
    accommodationListingCache = null;
    transportOptionCache = null;
    return true;
  }

  function getInstitutionOverrideStore() {
    return read(KEYS.institutions, []);
  }

  function saveInstitutionOverrideStore(records) {
    const deduped = dedupeInstitutionCatalog(records);
    write(KEYS.institutions, deduped);
    invalidateInstitutionCatalogCache();
    return deduped;
  }

  function getMergedInstitutionCatalogRecords() {
    if (institutionCatalogCache) return institutionCatalogCache.map(clone);

    const base = safeArray(getKagieData().institutions)
      .concat(safeArray(remoteInstitutionCatalogCache))
      .map((item, index) => normalizeInstitutionCatalogEntry(item, index + 1));
    const overrides = getInstitutionOverrideStore();
    const merged = new Map(base.map((item) => [item.id, item]));

    safeArray(overrides).forEach((entry, index) => {
      const normalized = normalizeInstitutionCatalogEntry(entry, base.length + index + 1);
      if (!normalized.id) return;
      if (entry?._deleted) {
        merged.delete(normalized.id);
        return;
      }
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, normalizeInstitutionCatalogEntry(existing ? mergeDeep(existing, normalized) : normalized, index + 1));
    });

    institutionCatalogCache = dedupeInstitutionCatalog(Array.from(merged.values()))
      .filter((item) => item.name)
      .sort((a, b) => {
        const statusDiff = institutionStatusPriority(a.status) - institutionStatusPriority(b.status);
        if (statusDiff) return statusDiff;
        const yearDiff = String(b.year).localeCompare(String(a.year));
        if (yearDiff) return yearDiff;
        const closeDiff = String(a.closingDate || '').localeCompare(String(b.closingDate || ''));
        if (closeDiff) return closeDiff;
        return a.name.localeCompare(b.name);
      });

    return institutionCatalogCache.map(clone);
  }

  function getInstitutionCatalog(filters) {
    const options = filters || {};
    const cacheKey = JSON.stringify({
      province: options.province || '',
      type: options.type || '',
      search: options.search || '',
      year: options.year || '',
      status: options.status || '',
      includeInactive: options.includeInactive !== false,
      canApplyOnly: !!options.canApplyOnly,
      limit: Number(options.limit || 0),
      offset: Number(options.offset || 0)
    });

    if (institutionQueryCache.has(cacheKey)) {
      return clone(institutionQueryCache.get(cacheKey));
    }

    const query = String(options.search || '').trim().toLowerCase();
    const year = String(options.year || '').trim();
    const desiredStatus = normalizeInstitutionLifecycleStatus(options.status);
    const includeInactive = options.includeInactive !== false;
    const canApplyOnly = !!options.canApplyOnly;
    const offset = Math.max(0, Number(options.offset || 0));
    const limit = Math.max(0, Number(options.limit || 0));

    let records = getMergedInstitutionCatalogRecords().filter((institution) => {
      if (options.province && institution.province !== options.province) return false;
      if (options.type && institution.type !== options.type) return false;
      if (year && String(institution.year) !== year) return false;
      if (desiredStatus && institution.status !== desiredStatus) return false;
      if (!includeInactive && institution.isActive === false) return false;
      if (canApplyOnly && !institution.canApply) return false;
      if (query) {
        const haystack = [
          institution.name,
          institution.shortName,
          institution.province,
          institution.type,
          institution.status,
          institution.year,
          ...safeArray(institution.faculties).map((faculty) => `${faculty.name} ${(faculty.courses || []).join(' ')}`)
        ].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    if (offset) records = records.slice(offset);
    if (limit) records = records.slice(0, limit);

    const result = records.map(clone);
    institutionQueryCache.set(cacheKey, result);
    return clone(result);
  }

  function normalizeRemoteInstitutionRow(row) {
    const source = row || {};
    return normalizeInstitutionCatalogEntry({
      id: source.id,
      name: source.name,
      shortName: source.short_name,
      province: source.province,
      type: source.type,
      website: source.website,
      notes: source.notes,
      logo: source.logo,
      year: source.year,
      applicationFee: source.application_fee,
      applicationFeeLabel: source.application_fee_label,
      applicationFeeNote: source.application_fee_note,
      openingDate: source.opening_date,
      closingDate: source.closing_date,
      manualStatus: source.manual_status,
      isActive: source.is_active,
      faculties: safeArray(source.faculties),
      courseEntryMode: source.course_entry_mode,
      createdAt: source.created_at,
      updatedAt: source.updated_at
    }, 1);
  }

  function isMissingInstitutionsTableError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('relation') && message.includes('institutions')
      || message.includes('could not find the table')
      || message.includes('does not exist');
  }

  async function loadRemoteInstitutionCatalog(force = false) {
    if (!isSupabaseEnabled()) return [];
    if (remoteInstitutionCatalogCache && !force) return remoteInstitutionCatalogCache.map(clone);

    try {
      const client = initSupabaseClient();
      if (!client) return [];
      const result = await client
        .from('institutions')
        .select('*')
        .order('name', { ascending: true });
      if (result.error) {
        if (!isMissingInstitutionsTableError(result.error)) {
          console.warn('Could not load remote institution catalog:', result.error.message || result.error);
        }
        return [];
      }
      remoteInstitutionCatalogCache = dedupeInstitutionCatalog(safeArray(result.data).map(normalizeRemoteInstitutionRow));
      invalidateInstitutionCatalogCache();
      return remoteInstitutionCatalogCache.map(clone);
    } catch (error) {
      console.warn('Remote institution catalog fallback:', error);
      return [];
    }
  }

  async function getInstitutionCatalogAsync(filters) {
    await loadRemoteInstitutionCatalog(false);
    return getInstitutionCatalog(filters);
  }

  function getInstitutionYears() {
    const years = [...new Set(getMergedInstitutionCatalogRecords().map((item) => String(item.year || '')).filter(Boolean))];
    const current = String(new Date().getFullYear());
    if (!years.includes(current)) years.push(current);
    return years.sort((a, b) => b.localeCompare(a));
  }

  function getInstitutionById(institutionId) {
    return getMergedInstitutionCatalogRecords().find((item) => item.id === institutionId) || null;
  }

  function getInstitutionByNameAndYear(name, year) {
    const normalizedName = normalizeInstitutionNameKey(name);
    if (!normalizedName) return null;
    return getMergedInstitutionCatalogRecords().find((item) => {
      if (normalizeInstitutionNameKey(item.name) !== normalizedName) return false;
      if (year && String(item.year) !== String(year)) return false;
      return true;
    }) || null;
  }

  function getInstitutionsForAdmin(filters) {
    requireRole([ROLES.MASTER]);
    return getInstitutionCatalog({
      ...(filters || {}),
      includeInactive: true
    });
  }

  async function getInstitutionsForAdminAsync(filters) {
    requireRole([ROLES.MASTER]);
    await loadRemoteInstitutionCatalog(false);
    return getInstitutionsForAdmin(filters);
  }

  function addInstitutionByAdmin(input) {
    requireRole([ROLES.MASTER]);

    const name = String(input?.name || '').trim();
    const province = String(input?.province || '').trim();
    const type = String(input?.type || input?.institutionType || '').trim();
    const year = String(input?.year || new Date().getFullYear()).trim();

    if (!name) throw new Error('Institution name is required.');
    if (!province) throw new Error('Institution province is required.');
    if (!type) throw new Error('Institution type is required.');
    if (!year) throw new Error('Institution year is required.');

    const records = getInstitutionOverrideStore();
    const entry = normalizeInstitutionCatalogEntry({
      id: input?.id || uid('institution'),
      name,
      shortName: input?.shortName || '',
      province,
      type,
      website: input?.website || '',
      notes: input?.notes || '',
      logo: input?.logo || '',
      year,
      applicationFee: roundMoney(input?.applicationFee ?? input?.application_fee ?? 0),
      applicationFeeLabel: input?.applicationFeeLabel || input?.application_fee_label || '',
      applicationFeeNote: input?.applicationFeeNote || input?.application_fee_note || '',
      openingDate: input?.openingDate || input?.opening_date || `${year}-01-15`,
      closingDate: input?.closingDate || input?.closing_date || '',
      manualStatus: normalizeInstitutionLifecycleStatus(input?.manualStatus || input?.status, true) === 'auto' ? '' : normalizeInstitutionLifecycleStatus(input?.manualStatus || input?.status),
      isActive: input?.isActive !== false && input?.is_active !== false,
      faculties: safeArray(input?.faculties),
      courseEntryMode: input?.courseEntryMode || (safeArray(input?.faculties).length ? 'guided' : 'manual'),
      createdAt: nowISO(),
      updatedAt: nowISO()
    }, records.length + 1);

    const duplicate = getMergedInstitutionCatalogRecords().find((item) => normalizeInstitutionDedupeKey(item) === normalizeInstitutionDedupeKey(entry));
    if (duplicate) throw new Error('An institution with that name already exists.');

    records.push(entry);
    saveInstitutionOverrideStore(records);
    return getInstitutionById(entry.id) || entry;
  }

  function updateInstitutionByAdmin(institutionId, patch) {
    requireRole([ROLES.MASTER]);

    const current = getInstitutionById(institutionId);
    if (!current) throw new Error('Institution not found.');

    const store = getInstitutionOverrideStore();
    const storeIndex = store.findIndex((item) => item.id === institutionId);
    const base = normalizeInstitutionCatalogEntry({
      ...current,
      ...patch,
      id: institutionId,
      updatedAt: nowISO(),
      applicationFee: roundMoney(patch?.applicationFee ?? patch?.application_fee ?? current.applicationFee ?? 0),
      applicationFeeLabel: patch?.applicationFeeLabel || patch?.application_fee_label || current.applicationFeeLabel || '',
      applicationFeeNote: patch?.applicationFeeNote || patch?.application_fee_note || current.applicationFeeNote || '',
      manualStatus: normalizeInstitutionLifecycleStatus(patch?.manualStatus || patch?.status, true) === 'auto'
        ? ''
        : normalizeInstitutionLifecycleStatus(patch?.manualStatus || patch?.status) || current.manualStatus || ''
    }, store.length + 1);

    if (storeIndex >= 0) store[storeIndex] = mergeDeep(store[storeIndex], base);
    else store.push(base);

    saveInstitutionOverrideStore(store);
    return getInstitutionById(institutionId) || base;
  }

  function deleteInstitutionByAdmin(institutionId) {
    requireRole([ROLES.MASTER]);

    const current = getInstitutionById(institutionId);
    if (!current) throw new Error('Institution not found.');

    const store = getInstitutionOverrideStore();
    const index = store.findIndex((item) => item.id === institutionId);
    const existsInBase = safeArray(getKagieData().institutions).some((item) => String(item?.id || '') === institutionId);

    if (!existsInBase) {
      const filtered = index >= 0 ? store.filter((item) => item.id !== institutionId) : store;
      saveInstitutionOverrideStore(filtered);
      return true;
    }

    const tombstone = {
      ...(index >= 0 ? store[index] : current),
      id: institutionId,
      _deleted: true,
      updatedAt: nowISO()
    };

    if (index >= 0) store[index] = tombstone;
    else store.push(tombstone);

    saveInstitutionOverrideStore(store);
    return true;
  }

  function normalizeInstitutionRemotePayload(inputArg, existingArg) {
    const input = inputArg && typeof inputArg === 'object' ? inputArg : {};
    const existing = existingArg && typeof existingArg === 'object' ? existingArg : {};
    const merged = normalizeInstitutionCatalogEntry({
      ...existing,
      ...input,
      id: existing.id || input.id
    }, 1);
    return {
      ...(existing.id ? { id: existing.id } : {}),
      name: merged.name,
      short_name: merged.shortName || '',
      province: merged.province || '',
      type: merged.type || '',
      website: merged.website || '',
      notes: merged.notes || '',
      logo: merged.logo || '',
      year: String(merged.year || new Date().getFullYear()),
      application_fee: Number(merged.applicationFee || 0),
      application_fee_label: merged.applicationFeeLabel || '',
      application_fee_note: merged.applicationFeeNote || '',
      opening_date: merged.openingDate || null,
      closing_date: merged.closingDate || null,
      manual_status: normalizeInstitutionLifecycleStatus(merged.manualStatus || merged.status, true) === 'auto'
        ? ''
        : normalizeInstitutionLifecycleStatus(merged.manualStatus || merged.status) || '',
      is_active: merged.isActive !== false,
      faculties: safeArray(merged.faculties),
      course_entry_mode: merged.courseEntryMode || 'manual'
    };
  }

  async function addInstitutionByAdminAsync(input) {
    requireRole([ROLES.MASTER]);
    if (!isSupabaseEnabled()) return addInstitutionByAdmin(input);
    try {
      const client = initSupabaseClient();
      if (!client) return addInstitutionByAdmin(input);
      const payload = normalizeInstitutionRemotePayload(input);
      const result = await client.from('institutions').insert(payload).select('*').single();
      if (result.error) {
        console.warn('Falling back to local institution save because remote insert failed.', result.error);
        return addInstitutionByAdmin(input);
      }
      remoteInstitutionCatalogCache = null;
      await loadRemoteInstitutionCatalog(true);
      return normalizeRemoteInstitutionRow(result.data);
    } catch (error) {
      console.warn('Institution insert fell back to local override storage.', error);
      return addInstitutionByAdmin(input);
    }
  }

  async function updateInstitutionByAdminAsync(institutionId, patch) {
    requireRole([ROLES.MASTER]);
    const current = getInstitutionById(institutionId);
    if (!current) throw new Error('Institution not found.');
    if (!isSupabaseEnabled()) return updateInstitutionByAdmin(institutionId, patch);
    try {
      const client = initSupabaseClient();
      if (!client) return updateInstitutionByAdmin(institutionId, patch);
      const payload = normalizeInstitutionRemotePayload({ ...current, ...patch }, current);
      const result = await client.from('institutions').update(payload).eq('id', current.id).select('*').single();
      if (result.error) {
        console.warn('Falling back to local institution update because remote update failed.', result.error);
        return updateInstitutionByAdmin(institutionId, patch);
      }
      remoteInstitutionCatalogCache = null;
      await loadRemoteInstitutionCatalog(true);
      return normalizeRemoteInstitutionRow(result.data);
    } catch (error) {
      console.warn('Institution update fell back to local override storage.', error);
      return updateInstitutionByAdmin(institutionId, patch);
    }
  }

  async function deleteInstitutionByAdminAsync(institutionId) {
    requireRole([ROLES.MASTER]);
    const current = getInstitutionById(institutionId);
    if (!current) throw new Error('Institution not found.');
    if (!isSupabaseEnabled()) return deleteInstitutionByAdmin(institutionId);
    try {
      const client = initSupabaseClient();
      if (!client) return deleteInstitutionByAdmin(institutionId);
      const result = await client.from('institutions').delete().eq('id', current.id);
      if (result.error) {
        console.warn('Falling back to local institution delete because remote delete failed.', result.error);
        return deleteInstitutionByAdmin(institutionId);
      }
      remoteInstitutionCatalogCache = null;
      await loadRemoteInstitutionCatalog(true);
      saveInstitutionOverrideStore(getInstitutionOverrideStore().filter((item) => item.id !== institutionId));
      return true;
    } catch (error) {
      console.warn('Institution delete fell back to local override storage.', error);
      return deleteInstitutionByAdmin(institutionId);
    }
  }

  function getAccommodationListingsForAdmin() {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    return getMergedAccommodationListingRecords();
  }

  function addAccommodationListingByAdmin(input) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);

    const propertyName = String(input?.propertyName || '').trim();
    const institutionName = String(input?.institutionName || input?.university || '').trim();
    const province = String(input?.province || '').trim();
    const location = String(input?.location || '').trim();

    if (!propertyName) throw new Error('Property name is required.');
    if (!institutionName) throw new Error('University is required.');
    if (!province) throw new Error('Province is required.');
    if (!location) throw new Error('Location is required.');

    const records = getAccommodationListingOverrideStore();
    const entry = normalizeAccommodationListingEntry({
      id: input?.id || uid('acclisting'),
      propertyName,
      institutionName,
      university: institutionName,
      province,
      location,
      address: input?.address || '',
      price: input?.price,
      roomType: input?.roomType || '',
      availabilityStatus: input?.availabilityStatus || 'Available',
      listingState: String(input?.listingState || 'draft').trim().toLowerCase() || 'draft',
      distanceFromCampus: input?.distanceFromCampus || '',
      images: input?.images || [],
      amenities: input?.amenities || [],
      propertyDetails: input?.propertyDetails || '',
      description: input?.description || '',
      contactPhone: input?.contactPhone || '',
      inspectionDocumentName: input?.inspectionDocumentName || '',
      inspectionDocumentUrl: input?.inspectionDocumentUrl || '',
      pricingDocumentName: input?.pricingDocumentName || '',
      pricingDocumentUrl: input?.pricingDocumentUrl || '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    }, records.length + 1);

    records.push(entry);
    saveAccommodationListingOverrideStore(records);
    return entry;
  }

  function updateAccommodationListingByAdmin(listingId, patch) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);

    const current = getMergedAccommodationListingRecords().find((item) => item.id === listingId);
    if (!current) throw new Error('Accommodation listing not found.');

    const store = getAccommodationListingOverrideStore();
    const index = store.findIndex((item) => item.id === listingId);
    const updated = normalizeAccommodationListingEntry({
      ...current,
      ...patch,
      id: listingId,
      institutionName: patch?.institutionName || patch?.university || current.institutionName,
      listingState: String(patch?.listingState || current.listingState || 'draft').trim().toLowerCase() || 'draft',
      updatedAt: nowISO()
    }, store.length + 1);

    if (index >= 0) store[index] = { ...store[index], ...updated };
    else store.push(updated);

    saveAccommodationListingOverrideStore(store);
    return getMergedAccommodationListingRecords().find((item) => item.id === listingId) || updated;
  }

  function deleteAccommodationListingByAdmin(listingId) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);

    const current = getMergedAccommodationListingRecords().find((item) => item.id === listingId);
    if (!current) throw new Error('Accommodation listing not found.');

    const store = getAccommodationListingOverrideStore();
    const index = store.findIndex((item) => item.id === listingId);
    const existsInBase = safeArray(getKagieData().accommodationListings).some((item) => String(item?.id || '') === listingId);

    if (!existsInBase) {
      const filtered = index >= 0 ? store.filter((item) => item.id !== listingId) : store;
      saveAccommodationListingOverrideStore(filtered);
      return true;
    }

    const tombstone = {
      ...(index >= 0 ? store[index] : current),
      id: listingId,
      _deleted: true,
      updatedAt: nowISO()
    };
    if (index >= 0) store[index] = tombstone;
    else store.push(tombstone);

    saveAccommodationListingOverrideStore(store);
    return true;
  }

  function ensureInstitutionAvailableForApplication(institution) {
    const match = getInstitutionByNameAndYear(institution?.institutionName || institution?.name, institution?.year);
    if (match && !match.canApply) {
      throw new Error('Applications for this institution are currently closed.');
    }
    return match;
  }

  function getHighSchoolCatalog(filters) {
    const options = filters || {};
    const baseSchools = safeArray(getKagieData().highSchools);
    const nationalSchools = safeArray(window.KAGIE_HIGH_SCHOOLS);
    const seen = new Set();
    const merged = baseSchools.concat(nationalSchools).filter((school) => {
      const id = String(school?.id || '').trim();
      const key = id || [school?.name, school?.province, school?.district, school?.town].map((part) => String(part || '').trim().toLowerCase()).join('|');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const phaseGroup = String(options.phaseGroup || '').trim().toLowerCase();
    const filtered = merged
      .filter((school) => {
        if (options.province && school.province !== options.province) return false;
        if (phaseGroup === 'senior') {
          const phase = String(school.phase || '').trim().toLowerCase();
          if (!(/secondary|senior|high|combined/.test(phase))) return false;
        }
        if (options.search) {
          const query = String(options.search).trim().toLowerCase();
          const haystack = [
            school.name,
            school.province,
            school.district,
            school.town,
            school.address,
            school.phase,
            school.schoolType
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return filtered.map(clone);
  }

  function getSubjectCatalog(board) {
    const data = getKagieData();
    if (board === 'dbe') return clone(data.dbeSubjects);
    if (board === 'ieb') return clone(data.iebSubjects);
    return clone(data.nscSubjects.length ? data.nscSubjects : data.dbeSubjects);
  }

  function getProspectusCatalog() {
    return getMergedInstitutionCatalogRecords().map((institution) => ({
      id: institution.id,
      institution: institution.name,
      shortName: institution.shortName,
      province: institution.province,
      type: institution.type,
      year: institution.year,
      logo: institution.logo || '',
      status: institution.status,
      summary: institution.faculties?.length
        ? `${institution.name} offers ${institution.faculties.length} major study areas through Kagie's curated prospectus guide.`
        : `${institution.name} is available in Kagie with manual faculty and course capture while the full prospectus catalogue is being expanded.`,
      applicationDeadline: institution.closingDate || institution.applicationDeadline || '',
      applicationFee: Number(institution.applicationFee || 0),
      applicationFeeLabel: Number(institution.applicationFee || 0) > 0
        ? `Institution fee: ${formatMoneyLabel(institution.applicationFee)}`
        : 'Institution fee: Free'
    }));
  }

  function deriveProspectusTitleFromName(name) {
    const raw = String(name || '')
      .replace(/\.[^.]+$/, '')
      .replace(/^\d+__/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
    return raw ? raw.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Prospectus PDF';
  }

  function normalizeProspectusDocumentRecord(record, fallbackInstitutionArg) {
    const fallbackInstitution = fallbackInstitutionArg || null;
    const institutionId = String(record?.institutionId || fallbackInstitution?.id || '').trim();
    const institution = fallbackInstitution || (institutionId ? getInstitutionById(institutionId) : null);
    const fileName = String(record?.fileName || record?.name || '').trim();
    const createdAt = String(record?.createdAt || nowISO());
    const updatedAt = String(record?.updatedAt || createdAt);
    const title = String(record?.title || deriveProspectusTitleFromName(fileName)).trim() || 'Prospectus PDF';
    return {
      id: String(record?.id || uid('pros')).trim(),
      institutionId,
      institutionName: String(record?.institutionName || institution?.name || '').trim(),
      institutionShortName: String(record?.institutionShortName || institution?.shortName || '').trim(),
      institutionProvince: String(record?.institutionProvince || institution?.province || '').trim(),
      institutionType: String(record?.institutionType || institution?.type || '').trim(),
      title,
      description: String(record?.description || '').trim(),
      fileName: fileName || `${title}.pdf`,
      mimeType: String(record?.mimeType || 'application/pdf').trim(),
      fileUrl: String(record?.fileUrl || record?.dataUrl || '').trim(),
      remotePath: String(record?.remotePath || '').trim(),
      uploadedById: String(record?.uploadedById || '').trim(),
      uploadedByName: String(record?.uploadedByName || '').trim(),
      uploadedByRole: String(record?.uploadedByRole || '').trim(),
      createdAt,
      updatedAt,
      fileSize: Number(record?.fileSize || 0),
      source: String(record?.source || 'local').trim() || 'local'
    };
  }

  function getProspectusDocumentStore() {
    return safeArray(read(KEYS.prospectusLibrary, []))
      .map((item) => normalizeProspectusDocumentRecord(item))
      .filter((item) => item.institutionId && item.fileName);
  }

  function saveProspectusDocumentStore(items) {
    const normalized = safeArray(items)
      .map((item) => normalizeProspectusDocumentRecord(item))
      .filter((item) => item.institutionId && item.fileName);
    write(KEYS.prospectusLibrary, normalized);
    return normalized;
  }

  function getProspectusDocuments(institutionIdArg) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const institutionId = String(institutionIdArg || '').trim();
    return getProspectusDocumentStore()
      .filter((item) => !institutionId || item.institutionId === institutionId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .map(clone);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file was selected.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  async function createSignedProspectusUrl(client, bucket, remotePath) {
    try {
      const signed = await client.storage.from(bucket).createSignedUrl(remotePath, 60 * 60 * 12);
      if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
    } catch (error) {
      console.warn('Could not create a signed prospectus URL.', error);
    }
    try {
      const publicUrl = client.storage.from(bucket).getPublicUrl(remotePath);
      return String(publicUrl?.data?.publicUrl || '').trim();
    } catch (error) {
      console.warn('Could not create a public prospectus URL.', error);
    }
    return '';
  }

  async function listRemoteProspectusDocuments() {
    if (!isSupabaseEnabled()) return [];
    const client = initSupabaseClient();
    if (!client) return [];

    const bucket = 'kagie-documents';
    const root = await client.storage.from(bucket).list('prospectus', { limit: 200 });
    if (root.error) throw new Error(root.error.message || 'Could not load prospectus folders.');

    const folders = safeArray(root.data)
      .map((entry) => String(entry?.name || '').trim())
      .filter(Boolean);

    if (!folders.length) return [];

    const fileRows = [];
    for (const folder of folders) {
      const folderInstitution = getInstitutionById(folder);
      const listed = await client.storage.from(bucket).list(`prospectus/${folder}`, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
      if (listed.error) {
        console.warn(`Could not load remote prospectus files for ${folder}.`, listed.error.message || listed.error);
        continue;
      }

      safeArray(listed.data).forEach((file) => {
        const fileName = String(file?.name || '').trim();
        if (!fileName || !/\.pdf$/i.test(fileName)) return;
        fileRows.push({
          id: `remote_${folder}_${fileName}`,
          institutionId: folder,
          institutionName: folderInstitution?.name || '',
          institutionShortName: folderInstitution?.shortName || '',
          institutionProvince: folderInstitution?.province || '',
          institutionType: folderInstitution?.type || '',
          title: deriveProspectusTitleFromName(fileName),
          description: '',
          fileName,
          mimeType: 'application/pdf',
          remotePath: `prospectus/${folder}/${fileName}`,
          uploadedById: '',
          uploadedByName: 'Kagie staff',
          uploadedByRole: '',
          createdAt: String(file?.created_at || nowISO()),
          updatedAt: String(file?.updated_at || file?.created_at || nowISO()),
          fileSize: Number(file?.metadata?.size || file?.metadata?.length || 0),
          source: 'remote'
        });
      });
    }

    const urls = await Promise.all(fileRows.map((row) => createSignedProspectusUrl(client, bucket, row.remotePath)));
    return fileRows.map((row, index) => normalizeProspectusDocumentRecord({ ...row, fileUrl: urls[index] }, getInstitutionById(row.institutionId)));
  }

  async function getProspectusDocumentsAsync(institutionIdArg) {
    const institutionId = String(institutionIdArg || '').trim();
    const local = getProspectusDocuments(institutionId);
    if (!isSupabaseEnabled()) return local;

    try {
      const remote = await listRemoteProspectusDocuments();
      const combined = [];
      const seen = new Set();
      [...remote, ...local].forEach((item) => {
        const normalized = normalizeProspectusDocumentRecord(item, item?.institutionId ? getInstitutionById(item.institutionId) : null);
        if (institutionId && normalized.institutionId !== institutionId) return;
        const key = normalized.remotePath || normalized.id;
        if (seen.has(key)) return;
        seen.add(key);
        combined.push(normalized);
      });

      const localOnly = getProspectusDocumentStore().filter((item) => !item.remotePath);
      const remoteNormalized = remote.map((item) => normalizeProspectusDocumentRecord(item));
      saveProspectusDocumentStore(
        localOnly.concat(
          remoteNormalized.map((item) => ({
            ...item,
            fileUrl: ''
          }))
        )
      );

      return combined.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    } catch (error) {
      console.warn('Falling back to local prospectus library because remote storage could not be listed.', error);
      return local;
    }
  }

  async function saveProspectusDocumentByStaffAsync(payload) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const institutionId = String(payload?.institutionId || '').trim();
    const institution = getInstitutionById(institutionId);
    if (!institution) throw new Error('Choose the institution that this prospectus belongs to.');

    const title = String(payload?.title || payload?.fileName || payload?.name || '').trim();
    const file = payload?.file || null;
    const mimeType = String(payload?.mimeType || payload?.type || file?.type || 'application/pdf').trim() || 'application/pdf';
    const fileName = String(payload?.fileName || payload?.name || file?.name || `${title || institution.shortName || institution.name} prospectus.pdf`).trim();
    if (!fileName) throw new Error('Select a PDF to upload.');
    if (!/pdf/i.test(mimeType) && !/\.pdf$/i.test(fileName)) throw new Error('Upload a PDF prospectus file.');

    const baseRecord = normalizeProspectusDocumentRecord({
      id: String(payload?.id || uid('pros')).trim(),
      institutionId: institution.id,
      institutionName: institution.name,
      institutionShortName: institution.shortName,
      institutionProvince: institution.province,
      institutionType: institution.type,
      title: title || deriveProspectusTitleFromName(fileName),
      description: String(payload?.description || '').trim(),
      fileName,
      mimeType,
      uploadedById: actor.id,
      uploadedByName: actor.fullName || actor.email || 'Kagie staff',
      uploadedByRole: actor.role,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      fileSize: Number(payload?.fileSize || file?.size || 0),
      source: 'local'
    }, institution);

    let nextRecord = { ...baseRecord };

    if (file && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const safeTitle = sanitizePathPart(baseRecord.title || fileName) || 'prospectus';
          const extension = extensionFromMime(mimeType) || 'pdf';
          const remotePath = `prospectus/${institution.id}/${Date.now()}__${safeTitle}.${sanitizePathPart(extension)}`;
          const upload = await client.storage.from('kagie-documents').upload(remotePath, file, {
            cacheControl: '3600',
            contentType: mimeType || 'application/pdf',
            upsert: false
          });
          if (upload.error) throw new Error(upload.error.message || 'Could not upload the prospectus PDF.');

          nextRecord = normalizeProspectusDocumentRecord({
            ...baseRecord,
            remotePath,
            fileUrl: await createSignedProspectusUrl(client, 'kagie-documents', remotePath),
            source: 'remote'
          }, institution);
        }
      } catch (error) {
        console.warn('Prospectus upload fell back to local storage.', error);
      }
    }

    if (!nextRecord.remotePath) {
      const dataUrl = String(payload?.dataUrl || '').trim() || await readFileAsDataUrl(file);
      nextRecord = normalizeProspectusDocumentRecord({
        ...baseRecord,
        fileUrl: dataUrl,
        source: 'local'
      }, institution);
    }

    const store = getProspectusDocumentStore().filter((item) => item.id !== nextRecord.id && item.remotePath !== nextRecord.remotePath);
    saveProspectusDocumentStore([nextRecord].concat(store));
    return clone(nextRecord);
  }

  async function deleteProspectusDocumentByStaffAsync(documentIdArg) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const documentId = String(documentIdArg || '').trim();
    const store = getProspectusDocumentStore();
    const current = store.find((item) => item.id === documentId || item.remotePath === documentId);
    if (!current) throw new Error('Prospectus PDF not found.');

    if (current.remotePath && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const removed = await client.storage.from('kagie-documents').remove([current.remotePath]);
          if (removed.error) throw new Error(removed.error.message || 'Could not remove the PDF from storage.');
        }
      } catch (error) {
        console.warn('Prospectus delete fell back to local cleanup only.', error);
      }
    }

    saveProspectusDocumentStore(store.filter((item) => item.id !== current.id && item.remotePath !== current.remotePath));
    return true;
  }

  const QUESTION_PAPER_GRADES = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
  const QUESTION_PAPER_PROVINCES = [
    "National",
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "North West",
    "Northern Cape",
    "Western Cape"
  ];
  const QUESTION_PAPER_TYPES = ["Question Paper", "Memo", "Study Guide"];
  const QUESTION_PAPER_STATUSES = ["Published", "Draft", "Disabled"];

  function normalizeQuestionPaperType(value) {
    const lowered = String(value || "").trim().toLowerCase();
    if (lowered === "memo") return "Memo";
    if (lowered === "study guide" || lowered === "study_guide" || lowered === "guide") return "Study Guide";
    return "Question Paper";
  }

  function normalizeQuestionPaperStatus(value) {
    const lowered = String(value || "").trim().toLowerCase();
    if (lowered === "published") return "Published";
    if (lowered === "disabled") return "Disabled";
    return "Draft";
  }

  function normalizeQuestionPaperRecord(recordArg) {
    const record = recordArg && typeof recordArg === "object" ? recordArg : {};
    const grade = String(record.grade || "").trim() || "Grade 12";
    const subject = String(record.subject || "").trim();
    const title = String(record.title || record.paperTitle || record.fileName || "Question paper").trim();
    const year = Math.max(2010, Math.min(2026, Number(record.year || new Date().getFullYear()) || new Date().getFullYear()));
    const term = String(record.term || "").trim() || "November";
    const province = String(record.province || "National").trim() || "National";
    const paperType = normalizeQuestionPaperType(record.paperType || record.paper_type);
    const status = normalizeQuestionPaperStatus(record.status);
    const fileName = String(record.fileName || record.file_name || record.name || "").trim();
    return {
      id: String(record.id || uid("qpaper")).trim(),
      grade,
      subject,
      title,
      year,
      term,
      province,
      paperType,
      paper_type: paperType,
      status,
      fileName,
      file_name: fileName,
      fileUrl: String(record.fileUrl || record.file_url || "").trim(),
      file_url: String(record.fileUrl || record.file_url || "").trim(),
      remotePath: String(record.remotePath || record.remote_path || "").trim(),
      remote_path: String(record.remotePath || record.remote_path || "").trim(),
      uploadedById: String(record.uploadedById || record.uploaded_by || "").trim(),
      uploadedByName: String(record.uploadedByName || "").trim(),
      uploadedByRole: String(record.uploadedByRole || "").trim(),
      createdAt: String(record.createdAt || record.created_at || nowISO()).trim(),
      updatedAt: String(record.updatedAt || record.updated_at || record.createdAt || record.created_at || nowISO()).trim()
    };
  }

  function getQuestionPaperStore() {
    return safeArray(read(KEYS.questionPaperLibrary, []))
      .map((entry) => normalizeQuestionPaperRecord(entry))
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
  }

  function saveQuestionPaperStore(recordsArg) {
    const byId = new Map();
    safeArray(recordsArg).forEach((entry) => {
      const normalized = normalizeQuestionPaperRecord(entry);
      byId.set(normalized.id, normalized);
    });
    const normalized = Array.from(byId.values())
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
    write(KEYS.questionPaperLibrary, normalized);
    return normalized.map(clone);
  }

  function isMissingQuestionPapersTableError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (message.includes("relation") && message.includes("question_papers"))
      || message.includes("could not find the table")
      || message.includes("does not exist");
  }

  function filterQuestionPaperRecords(recordsArg, filtersArg, includeAllStatusesArg) {
    const filters = filtersArg || {};
    const includeAllStatuses = !!includeAllStatusesArg;
    const query = String(filters.search || "").trim().toLowerCase();
    const grade = String(filters.grade || "").trim();
    const subject = String(filters.subject || "").trim();
    const year = String(filters.year || "").trim();
    const term = String(filters.term || "").trim();
    const province = String(filters.province || "").trim();
    const paperType = String(filters.paperType || filters.paper_type || "").trim();
    const status = String(filters.status || "").trim();
    return safeArray(recordsArg)
      .map((entry) => normalizeQuestionPaperRecord(entry))
      .filter((entry) => {
        if (!includeAllStatuses && entry.status !== "Published") return false;
        if (grade && entry.grade !== grade) return false;
        if (subject && entry.subject !== subject) return false;
        if (year && String(entry.year) !== year) return false;
        if (term && entry.term !== term) return false;
        if (province && entry.province !== province) return false;
        if (paperType && entry.paperType !== paperType) return false;
        if (status && entry.status !== status) return false;
        if (query) {
          const haystack = [
            entry.grade,
            entry.subject,
            entry.title,
            entry.term,
            entry.province,
            entry.paperType,
            entry.status,
            entry.fileName,
            entry.year
          ].join(" ").toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0))
      .map(clone);
  }

  async function fetchRemoteQuestionPaperCatalog() {
    if (!isSupabaseEnabled()) return [];
    const client = initSupabaseClient();
    if (!client) return [];
    const result = await client.from("question_papers").select("*").order("updated_at", { ascending: false });
    if (result.error) {
      if (isMissingQuestionPapersTableError(result.error)) return [];
      throw new Error(result.error.message || "Could not load question papers.");
    }
    const rows = safeArray(result.data);
    const urls = await Promise.all(rows.map((row) => (
      row?.remote_path
        ? createSignedProspectusUrl(client, "kagie-documents", row.remote_path)
        : Promise.resolve(String(row?.file_url || "").trim())
    )));
    return rows.map((row, index) => normalizeQuestionPaperRecord({
      ...row,
      fileUrl: urls[index]
    }));
  }

  function getQuestionPapers(filtersArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const includeAllStatuses = viewer.role === ROLES.MASTER && !!filtersArg?.includeAllStatuses;
    return filterQuestionPaperRecords(getQuestionPaperStore(), filtersArg, includeAllStatuses);
  }

  async function getQuestionPapersAsync(filtersArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const includeAllStatuses = viewer.role === ROLES.MASTER && !!filtersArg?.includeAllStatuses;
    const local = filterQuestionPaperRecords(getQuestionPaperStore(), filtersArg, includeAllStatuses);
    if (!isSupabaseEnabled()) return local;
    try {
      const remote = await fetchRemoteQuestionPaperCatalog();
      const localOnly = getQuestionPaperStore().filter((item) => !item.remotePath);
      saveQuestionPaperStore(localOnly.concat(remote.map((item) => ({ ...item, fileUrl: "" }))));
      return filterQuestionPaperRecords(remote.concat(localOnly), filtersArg, includeAllStatuses);
    } catch (error) {
      console.warn("Falling back to local question paper catalog because the remote records could not be listed.", error);
      return local;
    }
  }

  function getQuestionPapersForAdmin(filtersArg) {
    requireRole([ROLES.MASTER]);
    return filterQuestionPaperRecords(getQuestionPaperStore(), filtersArg, true);
  }

  async function getQuestionPapersForAdminAsync(filtersArg) {
    requireRole([ROLES.MASTER]);
    const local = getQuestionPapersForAdmin(filtersArg);
    if (!isSupabaseEnabled()) return local;
    try {
      const remote = await fetchRemoteQuestionPaperCatalog();
      const localOnly = getQuestionPaperStore().filter((item) => !item.remotePath);
      saveQuestionPaperStore(localOnly.concat(remote.map((item) => ({ ...item, fileUrl: "" }))));
      return filterQuestionPaperRecords(remote.concat(localOnly), filtersArg, true);
    } catch (error) {
      console.warn("Falling back to local admin question paper catalog because remote records are unavailable.", error);
      return local;
    }
  }

  async function saveQuestionPaperByAdminAsync(payloadArg) {
    const actor = requireRole([ROLES.MASTER]);
    const payload = payloadArg || {};
    const file = payload.file || null;
    const grade = String(payload.grade || "").trim();
    const subject = String(payload.subject || "").trim();
    const title = String(payload.title || payload.paperTitle || payload.fileName || "").trim();
    const year = Number(payload.year || 0);
    const term = String(payload.term || "").trim();
    const province = String(payload.province || "").trim();
    const paperType = normalizeQuestionPaperType(payload.paperType || payload.paper_type);
    const status = normalizeQuestionPaperStatus(payload.status);
    const mimeType = String(payload.mimeType || payload.type || file?.type || "application/pdf").trim() || "application/pdf";
    const fileName = String(payload.fileName || payload.name || file?.name || `${title || subject || "question-paper"}.pdf`).trim();

    if (!grade || !subject || !title || !year || !term || !province) throw new Error("Complete the grade, subject, title, year, term, and province first.");
    if (year < 2010 || year > 2026) throw new Error("Question papers must be between 2010 and 2026.");
    if (!fileName) throw new Error("Choose a PDF question paper first.");
    if (!/pdf/i.test(mimeType) && !/\.pdf$/i.test(fileName)) throw new Error("Upload a PDF file for the question paper.");

    const baseRecord = normalizeQuestionPaperRecord({
      id: String(payload.id || uid("qpaper")).trim(),
      grade,
      subject,
      title,
      year,
      term,
      province,
      paperType,
      status,
      fileName,
      uploadedById: actor.supabaseUserId || actor.id || "",
      uploadedByName: actor.fullName || actor.email || "Kagie master admin",
      uploadedByRole: actor.role,
      createdAt: nowISO(),
      updatedAt: nowISO()
    });

    let nextRecord = { ...baseRecord };
    let remoteRow = null;

    if (file && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const safeTitle = sanitizePathPart(`${grade}-${subject}-${title}-${paperType}-${year}`) || "question-paper";
          const extension = extensionFromMime(mimeType) || "pdf";
          const remotePath = `question-papers/${sanitizePathPart(grade)}/${year}/${Date.now()}__${safeTitle}.${sanitizePathPart(extension)}`;
          const upload = await client.storage.from("kagie-documents").upload(remotePath, file, {
            cacheControl: "3600",
            contentType: mimeType || "application/pdf",
            upsert: false
          });
          if (upload.error) throw new Error(upload.error.message || "Could not upload the question paper PDF.");

          const payloadRow = {
            grade,
            subject,
            title,
            year,
            term,
            province,
            paper_type: paperType,
            file_name: fileName,
            file_url: "",
            remote_path: remotePath,
            status,
            uploaded_by: actor.supabaseUserId || actor.id || null
          };
          const stored = await client.from("question_papers").insert(payloadRow).select("*").single();
          if (stored.error) throw new Error(stored.error.message || "Could not save the question paper record.");
          remoteRow = stored.data || null;
          nextRecord = normalizeQuestionPaperRecord({
            ...stored.data,
            fileUrl: await createSignedProspectusUrl(client, "kagie-documents", remotePath),
            uploadedByName: actor.fullName || actor.email || "Kagie master admin",
            uploadedByRole: actor.role
          });
        }
      } catch (error) {
        console.warn("Question paper upload fell back to local storage.", error);
      }
    }

    if (!remoteRow) {
      const dataUrl = String(payload.dataUrl || "").trim() || await readFileAsDataUrl(file);
      nextRecord = normalizeQuestionPaperRecord({
        ...baseRecord,
        fileUrl: dataUrl
      });
    }

    const store = getQuestionPaperStore().filter((item) => item.id !== nextRecord.id && item.remotePath !== nextRecord.remotePath);
    saveQuestionPaperStore([nextRecord].concat(store));
    return clone(nextRecord);
  }

  async function updateQuestionPaperByAdminAsync(questionPaperIdArg, patchArg) {
    requireRole([ROLES.MASTER]);
    const questionPaperId = String(questionPaperIdArg || "").trim();
    const current = getQuestionPaperStore().find((item) => item.id === questionPaperId || item.remotePath === questionPaperId);
    if (!current) throw new Error("Question paper not found.");
    const patch = patchArg || {};
    const file = patch.file || null;
    const merged = normalizeQuestionPaperRecord({
      ...current,
      ...patch,
      id: current.id,
      paperType: patch.paperType || patch.paper_type || current.paperType,
      status: patch.status || current.status,
      updatedAt: nowISO()
    });

    let nextRecord = { ...merged };
    if (current.remotePath && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          let remotePath = current.remotePath;
          let fileName = merged.fileName;
          if (file) {
            const mimeType = String(patch.mimeType || patch.type || file?.type || "application/pdf").trim() || "application/pdf";
            if (!/pdf/i.test(mimeType) && !/\.pdf$/i.test(String(file?.name || fileName || ""))) throw new Error("Upload a PDF file for the question paper.");
            const safeTitle = sanitizePathPart(`${merged.grade}-${merged.subject}-${merged.title}-${merged.paperType}-${merged.year}`) || "question-paper";
            const extension = extensionFromMime(mimeType) || "pdf";
            remotePath = `question-papers/${sanitizePathPart(merged.grade)}/${merged.year}/${Date.now()}__${safeTitle}.${sanitizePathPart(extension)}`;
            const upload = await client.storage.from("kagie-documents").upload(remotePath, file, {
              cacheControl: "3600",
              contentType: mimeType || "application/pdf",
              upsert: false
            });
            if (upload.error) throw new Error(upload.error.message || "Could not replace the question paper PDF.");
            fileName = String(patch.fileName || patch.name || file?.name || merged.fileName).trim();
          }
          const result = await client.from("question_papers").update({
            grade: merged.grade,
            subject: merged.subject,
            title: merged.title,
            year: merged.year,
            term: merged.term,
            province: merged.province,
            paper_type: merged.paperType,
            file_name: fileName,
            remote_path: remotePath,
            status: merged.status
          }).eq("id", current.id).select("*").single();
          if (result.error) throw new Error(result.error.message || "Could not update the question paper.");
          nextRecord = normalizeQuestionPaperRecord({
            ...result.data,
            fileUrl: remotePath ? await createSignedProspectusUrl(client, "kagie-documents", remotePath) : merged.fileUrl,
            uploadedByName: current.uploadedByName,
            uploadedByRole: current.uploadedByRole
          });
        }
      } catch (error) {
        console.warn("Question paper update fell back to local storage.", error);
      }
    } else if (file) {
      nextRecord = normalizeQuestionPaperRecord({
        ...merged,
        fileUrl: await readFileAsDataUrl(file),
        fileName: String(patch.fileName || patch.name || file?.name || merged.fileName).trim()
      });
    }

    const store = getQuestionPaperStore().filter((item) => item.id !== current.id && item.remotePath !== current.remotePath);
    saveQuestionPaperStore([nextRecord].concat(store));
    return clone(nextRecord);
  }

  async function deleteQuestionPaperByAdminAsync(questionPaperIdArg) {
    requireRole([ROLES.MASTER]);
    const questionPaperId = String(questionPaperIdArg || "").trim();
    const store = getQuestionPaperStore();
    const current = store.find((item) => item.id === questionPaperId || item.remotePath === questionPaperId);
    if (!current) throw new Error("Question paper not found.");
    if (current.remotePath && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const removed = await client.storage.from("kagie-documents").remove([current.remotePath]);
          if (removed.error) throw new Error(removed.error.message || "Could not remove the question paper PDF.");
          const deleted = await client.from("question_papers").delete().eq("id", current.id);
          if (deleted.error) throw new Error(deleted.error.message || "Could not remove the question paper record.");
        }
      } catch (error) {
        console.warn("Question paper delete fell back to local cleanup only.", error);
      }
    }
    saveQuestionPaperStore(store.filter((item) => item.id !== current.id && item.remotePath !== current.remotePath));
    return true;
  }

  function slugifyPastPaperKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getPastPaperBlueprint() {
    const data = getKagieData();
    const fallback = {
      grades: [],
      years: [],
      provinces: [],
      subjectsByGrade: {},
      sessions: [],
      paperNumbers: {}
    };
    return clone(data.pastPaperBlueprint || fallback);
  }

  function getPastPaperSessionConfig(sessionIdArg) {
    const sessionId = String(sessionIdArg || '').trim();
    return getPastPaperBlueprint().sessions.find((item) => item.id === sessionId) || null;
  }

  function getPastPaperNumberConfig(paperNumberIdArg) {
    const paperNumberId = String(paperNumberIdArg || '').trim();
    const paperNumbers = getPastPaperBlueprint().paperNumbers || {};
    return paperNumbers[paperNumberId] ? clone(paperNumbers[paperNumberId]) : null;
  }

  function matchPastPaperValueBySlug(itemsArg, slug) {
    const items = safeArray(itemsArg);
    const target = slugifyPastPaperKey(slug);
    return items.find((item) => slugifyPastPaperKey(item) === target) || '';
  }

  function flattenPastPaperSubjects(subjectsByGradeArg) {
    return [...new Set(Object.values(subjectsByGradeArg || {}).flatMap((items) => safeArray(items)))];
  }

  function buildPastPaperSignature(metaArg) {
    const meta = metaArg || {};
    return [
      slugifyPastPaperKey(meta.grade),
      String(meta.year || '').trim(),
      slugifyPastPaperKey(meta.province),
      slugifyPastPaperKey(meta.subject),
      slugifyPastPaperKey(meta.session),
      slugifyPastPaperKey(meta.paperNumber)
    ].filter(Boolean).join('__');
  }

  function parsePastPaperSignature(signatureArg) {
    const signature = String(signatureArg || '').trim();
    if (!signature) return null;

    const parts = signature.split('__');
    if (parts.length < 6) return null;

    const blueprint = getPastPaperBlueprint();
    const grade = matchPastPaperValueBySlug(blueprint.grades, parts[0]);
    const year = Number(parts[1] || 0);
    const province = matchPastPaperValueBySlug(blueprint.provinces, parts[2]);
    const subject = matchPastPaperValueBySlug(flattenPastPaperSubjects(blueprint.subjectsByGrade), parts[3]);
    const session = safeArray(blueprint.sessions).find((item) => slugifyPastPaperKey(item.id) === slugifyPastPaperKey(parts[4]))?.id || '';
    const paperNumber = Object.keys(blueprint.paperNumbers || {}).find((key) => slugifyPastPaperKey(key) === slugifyPastPaperKey(parts[5])) || '';
    if (!grade || !year || !province || !subject || !session || !paperNumber) return null;
    return { grade, year, province, subject, session, paperNumber };
  }

  function getPastPaperTopicTemplate(subjectArg, paperNumberIdArg) {
    const subject = String(subjectArg || '').toLowerCase();
    const paperNumberId = String(paperNumberIdArg || '').toLowerCase();

    if (subject.includes('mathematics') && !subject.includes('literacy')) {
      return paperNumberId === 'paper_2'
        ? ['Analytical geometry', 'Euclidean geometry', 'Probability', 'Data handling', 'Trigonometry', 'Problem solving']
        : ['Algebra and equations', 'Functions and graphs', 'Number patterns', 'Finance and growth', 'Trigonometry basics', 'Calculus or advanced reasoning'];
    }
    if (subject.includes('mathematical literacy')) return ['Finances and budgets', 'Data handling', 'Measurement', 'Maps and scale', 'Probability', 'Interpretation of real-life contexts'];
    if (subject.includes('physical sciences')) {
      return paperNumberId === 'paper_2'
        ? ['Organic chemistry', 'Rates and equilibrium', 'Acids and bases', 'Electrochemistry', 'Energy and heat', 'Scientific interpretation']
        : ['Mechanics', 'Waves and sound', 'Electricity and magnetism', 'Matter and materials', 'Practical investigation', 'Mixed concept revision'];
    }
    if (subject.includes('life sciences')) return ['Cells and tissues', 'Genetics', 'Evolution', 'Biodiversity', 'Ecology', 'Data interpretation'];
    if (subject.includes('accounting')) return ['Ledger concepts', 'Manufacturing', 'Cash flow', 'Budgeting', 'Interpretation of statements', 'Ethics and controls'];
    if (subject.includes('business studies') || subject.includes('economics')) return ['Theory and concepts', 'Case study analysis', 'Business environments', 'Strategy and planning', 'Essay structure', 'Data response'];
    if (subject.includes('geography')) return ['Mapwork', 'Climate and weather', 'Geomorphology', 'Rural and urban settlement', 'Economic geography', 'Interpretation of resources'];
    if (subject.includes('history')) return ['Source-based questions', 'Essay planning', 'South African history', 'Global history', 'Evidence analysis', 'Argument structure'];
    if (subject.includes('english') || subject.includes('afrikaans') || subject.includes('language')) {
      return paperNumberId === 'paper_2'
        ? ['Poetry analysis', 'Drama interpretation', 'Novel study', 'Language structures', 'Contextual response', 'Extended writing']
        : ['Comprehension', 'Summary writing', 'Language use', 'Visual literacy', 'Transaction writing', 'Editing and grammar'];
    }
    if (subject.includes('tourism')) return ['Tourism terms', 'Map and route planning', 'Foreign exchange', 'Customer care', 'Travel trends', 'Data response'];
    if (subject.includes('computer') || subject.includes('information technology')) return ['Theory concepts', 'Systems and hardware', 'Programming or applications', 'Networks', 'Data management', 'Problem solving'];
    return ['Question 1 topic', 'Question 2 topic', 'Question 3 topic', 'Question 4 topic', 'Question 5 topic', 'Question 6 topic'];
  }

  function estimatePastPaperMarks(subjectArg, paperNumberIdArg) {
    const subject = String(subjectArg || '').toLowerCase();
    const paperNumberId = String(paperNumberIdArg || '').toLowerCase();
    if (paperNumberId === 'guide') return 60;
    if (subject.includes('mathematics') && !subject.includes('literacy')) return 150;
    if (subject.includes('english') || subject.includes('afrikaans') || subject.includes('language')) return 80;
    if (subject.includes('physical sciences')) return 150;
    return 100;
  }

  function estimatePastPaperDuration(subjectArg, paperNumberIdArg) {
    const subject = String(subjectArg || '').toLowerCase();
    const paperNumberId = String(paperNumberIdArg || '').toLowerCase();
    if (paperNumberId === 'guide') return 90;
    if (subject.includes('mathematics') || subject.includes('physical sciences')) return 180;
    if (subject.includes('english') || subject.includes('afrikaans') || subject.includes('language')) return 180;
    return 150;
  }

  function buildPastPaperQuestionSet(subjectArg, paperNumberIdArg, sessionLabelArg) {
    const topics = getPastPaperTopicTemplate(subjectArg, paperNumberIdArg);
    const totalMarks = estimatePastPaperMarks(subjectArg, paperNumberIdArg);
    const baseMarks = Math.max(5, Math.round(totalMarks / Math.max(1, topics.length)));
    return topics.map((topic, index) => ({
      id: `q_${index + 1}`,
      label: `Question ${index + 1}`,
      topic: String(topic || '').trim(),
      sessionHint: String(sessionLabelArg || '').trim(),
      maxMarks: index === topics.length - 1 ? Math.max(5, totalMarks - (baseMarks * (topics.length - 1))) : baseMarks
    }));
  }

  function normalizePastPaperQuestionSet(questionsArg, subjectArg, paperNumberIdArg, sessionLabelArg) {
    const base = safeArray(questionsArg).length
      ? safeArray(questionsArg).map((item, index) => ({
          id: String(item?.id || `q_${index + 1}`),
          label: String(item?.label || `Question ${index + 1}`),
          topic: String(item?.topic || item?.label || '').trim(),
          maxMarks: Math.max(1, Number(item?.maxMarks || item?.marks || 10))
        }))
      : buildPastPaperQuestionSet(subjectArg, paperNumberIdArg, sessionLabelArg);
    return base.map((item, index) => ({
      id: String(item?.id || `q_${index + 1}`),
      label: String(item?.label || `Question ${index + 1}`),
      topic: String(item?.topic || item?.label || '').trim(),
      maxMarks: Math.max(1, Number(item?.maxMarks || 10))
    }));
  }

  function buildGeneratedPastPaperRecord(metaArg) {
    const meta = metaArg || {};
    const sessionConfig = getPastPaperSessionConfig(meta.session) || { label: meta.session, description: '' };
    const paperNumberConfig = getPastPaperNumberConfig(meta.paperNumber) || { label: meta.paperNumber };
    const paperSignature = buildPastPaperSignature(meta);
    return {
      id: paperSignature,
      paperSignature,
      grade: String(meta.grade || ''),
      year: Number(meta.year || 0),
      province: String(meta.province || ''),
      subject: String(meta.subject || ''),
      session: String(meta.session || ''),
      sessionLabel: String(sessionConfig.label || meta.session || ''),
      sessionDescription: String(sessionConfig.description || ''),
      paperNumber: String(meta.paperNumber || ''),
      paperNumberLabel: String(paperNumberConfig.label || meta.paperNumber || ''),
      title: `${meta.subject} ${paperNumberConfig.label || meta.paperNumber} ${sessionConfig.label || meta.session}`,
      summary: `${meta.subject} ${paperNumberConfig.label || meta.paperNumber} for ${meta.grade}, ${meta.province}, ${sessionConfig.label || meta.session} ${meta.year}.`,
      description: `Kagie study paper for ${meta.grade} learners using a South African revision flow.`,
      totalMarks: estimatePastPaperMarks(meta.subject, meta.paperNumber),
      durationMinutes: estimatePastPaperDuration(meta.subject, meta.paperNumber),
      sourceLabel: `${meta.province} learner practice set`,
      questions: normalizePastPaperQuestionSet([], meta.subject, meta.paperNumber, sessionConfig.label),
      fileName: '',
      fileUrl: '',
      remotePath: '',
      uploadedByName: '',
      uploadedByRole: '',
      uploadedById: '',
      createdAt: '',
      updatedAt: '',
      source: 'generated'
    };
  }

  function normalizePastPaperLibraryRecord(recordArg) {
    const record = recordArg || {};
    const parsed = parsePastPaperSignature(record.paperSignature || record.id || record.signature || '') || null;
    const grade = String(record.grade || parsed?.grade || '').trim();
    const year = Number(record.year || parsed?.year || 0);
    const province = String(record.province || parsed?.province || '').trim();
    const subject = String(record.subject || parsed?.subject || '').trim();
    const session = String(record.session || parsed?.session || '').trim();
    const paperNumber = String(record.paperNumber || parsed?.paperNumber || '').trim();
    const sessionConfig = getPastPaperSessionConfig(session) || { label: session, description: '' };
    const paperNumberConfig = getPastPaperNumberConfig(paperNumber) || { label: paperNumber };
    const paperSignature = buildPastPaperSignature({ grade, year, province, subject, session, paperNumber });

    return {
      id: paperSignature,
      paperSignature,
      grade,
      year,
      province,
      subject,
      session,
      sessionLabel: String(record.sessionLabel || sessionConfig.label || '').trim(),
      sessionDescription: String(record.sessionDescription || sessionConfig.description || '').trim(),
      paperNumber,
      paperNumberLabel: String(record.paperNumberLabel || paperNumberConfig.label || '').trim(),
      title: String(record.title || `${subject} ${paperNumberConfig.label || paperNumber}` || 'Past paper').trim(),
      summary: String(record.summary || `${subject} ${paperNumberConfig.label || paperNumber} for ${grade}, ${province}, ${sessionConfig.label || session} ${year}.`).trim(),
      description: String(record.description || '').trim(),
      totalMarks: Math.max(1, Number(record.totalMarks || estimatePastPaperMarks(subject, paperNumber))),
      durationMinutes: Math.max(30, Number(record.durationMinutes || estimatePastPaperDuration(subject, paperNumber))),
      sourceLabel: String(record.sourceLabel || `${province} uploaded paper`).trim(),
      questions: normalizePastPaperQuestionSet(record.questions, subject, paperNumber, sessionConfig.label),
      fileName: String(record.fileName || record.name || '').trim(),
      fileUrl: String(record.fileUrl || record.dataUrl || '').trim(),
      remotePath: String(record.remotePath || '').trim(),
      uploadedByName: String(record.uploadedByName || '').trim(),
      uploadedByRole: String(record.uploadedByRole || '').trim(),
      uploadedById: String(record.uploadedById || '').trim(),
      createdAt: String(record.createdAt || nowISO()).trim(),
      updatedAt: String(record.updatedAt || record.createdAt || nowISO()).trim(),
      source: String(record.source || 'local').trim() || 'local'
    };
  }

  function getPastPaperLibraryStore() {
    return safeArray(read(KEYS.pastPaperLibrary, []))
      .map((item) => normalizePastPaperLibraryRecord(item))
      .filter((item) => item.paperSignature && item.subject);
  }

  function savePastPaperLibraryStore(itemsArg) {
    const normalized = safeArray(itemsArg)
      .map((item) => normalizePastPaperLibraryRecord(item))
      .filter((item) => item.paperSignature && item.subject);
    write(KEYS.pastPaperLibrary, normalized);
    return normalized;
  }

  function matchesPastPaperFilters(paper, filtersArg) {
    const filters = filtersArg || {};
    if (filters.grade && paper.grade !== filters.grade) return false;
    if (filters.year && Number(paper.year) !== Number(filters.year)) return false;
    if (filters.province && paper.province !== filters.province) return false;
    if (filters.subject && paper.subject !== filters.subject) return false;
    if (filters.session && paper.session !== filters.session) return false;
    if (filters.paperNumber && paper.paperNumber !== filters.paperNumber) return false;
    if (filters.search) {
      const query = String(filters.search).trim().toLowerCase();
      const haystack = [paper.title, paper.subject, paper.province, paper.grade, paper.sessionLabel, paper.paperNumberLabel].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }

  function buildGeneratedPastPaperCatalog(filtersArg) {
    const filters = filtersArg || {};
    const hasFocusedSelection = Boolean(filters.grade && filters.year && filters.province && filters.subject && filters.session);
    if (!hasFocusedSelection) return [];
    const sessionConfig = getPastPaperSessionConfig(filters.session);
    if (!sessionConfig) return [];
    return safeArray(sessionConfig.paperNumbers).map((paperNumber) => buildGeneratedPastPaperRecord({
      grade: filters.grade,
      year: filters.year,
      province: filters.province,
      subject: filters.subject,
      session: filters.session,
      paperNumber
    }));
  }

  const PAST_PAPER_MANIFEST_REMOTE_PATH = 'past-papers/catalog.json';

  function serializePastPaperManifestRecords(recordsArg) {
    return safeArray(recordsArg)
      .map((item) => normalizePastPaperLibraryRecord(item))
      .filter((item) => item.paperSignature && item.remotePath)
      .map((item) => ({
        id: item.id,
        paperSignature: item.paperSignature,
        grade: item.grade,
        year: item.year,
        province: item.province,
        subject: item.subject,
        session: item.session,
        sessionLabel: item.sessionLabel,
        sessionDescription: item.sessionDescription,
        paperNumber: item.paperNumber,
        paperNumberLabel: item.paperNumberLabel,
        title: item.title,
        summary: item.summary,
        description: item.description,
        totalMarks: item.totalMarks,
        durationMinutes: item.durationMinutes,
        sourceLabel: item.sourceLabel,
        questions: item.questions,
        fileName: item.fileName,
        remotePath: item.remotePath,
        uploadedByName: item.uploadedByName,
        uploadedByRole: item.uploadedByRole,
        uploadedById: item.uploadedById,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        source: 'remote'
      }));
  }

  async function readPastPaperManifest(clientArg) {
    const client = clientArg || initSupabaseClient();
    if (!client) return [];
    const manifestUrl = await createSignedProspectusUrl(client, 'kagie-documents', PAST_PAPER_MANIFEST_REMOTE_PATH);
    if (!manifestUrl) return [];

    try {
      const response = await fetch(manifestUrl, { method: 'GET' });
      if (!response.ok) return [];
      const payload = await response.json().catch(() => null);
      const records = safeArray(payload?.records || payload);
      if (!records.length) return [];

      const urls = await Promise.all(records.map((record) => (
        record?.remotePath
          ? createSignedProspectusUrl(client, 'kagie-documents', record.remotePath)
          : Promise.resolve('')
      )));

      return records.map((record, index) => normalizePastPaperLibraryRecord({
        ...record,
        fileUrl: urls[index] || record?.fileUrl || '',
        source: 'remote'
      }));
    } catch (error) {
      console.warn('Could not read the remote past-paper manifest.', error);
      return [];
    }
  }

  async function writePastPaperManifest(clientArg, recordsArg) {
    const client = clientArg || initSupabaseClient();
    if (!client) return false;
    const payload = JSON.stringify({
      updatedAt: nowISO(),
      records: serializePastPaperManifestRecords(recordsArg)
    }, null, 2);
    const file = new Blob([payload], { type: 'application/json' });
    const upload = await client.storage.from('kagie-documents').upload(PAST_PAPER_MANIFEST_REMOTE_PATH, file, {
      cacheControl: '120',
      contentType: 'application/json',
      upsert: true
    });
    if (upload.error) throw new Error(upload.error.message || 'Could not update the shared past-paper manifest.');
    return true;
  }

  function parsePastPaperRemoteFileName(fileNameArg) {
    const fileName = String(fileNameArg || '').trim();
    if (!/\.pdf$/i.test(fileName)) return null;
    const stem = fileName.replace(/\.pdf$/i, '');
    const parts = stem.split('__');
    if (parts.length < 7) return null;
    const parsed = parsePastPaperSignature(parts.slice(0, 6).join('__'));
    if (!parsed) return null;
    return { ...parsed, title: deriveProspectusTitleFromName(parts.slice(6).join(' ')) };
  }

  function mergePastPaperCatalog(filtersArg, uploadedItemsArg) {
    const generated = buildGeneratedPastPaperCatalog(filtersArg);
    const uploadedItems = safeArray(uploadedItemsArg).filter((item) => matchesPastPaperFilters(item, filtersArg));
    const bySignature = new Map();
    generated.forEach((paper) => bySignature.set(paper.paperSignature, paper));
    uploadedItems.forEach((paper) => {
      const existing = bySignature.get(paper.paperSignature) || {};
      bySignature.set(paper.paperSignature, {
        ...existing,
        ...paper,
        questions: normalizePastPaperQuestionSet(paper.questions, paper.subject || existing.subject, paper.paperNumber || existing.paperNumber, paper.sessionLabel || existing.sessionLabel),
        source: paper.fileUrl || paper.remotePath ? 'uploaded' : (paper.source || existing.source || 'local')
      });
    });
    return [...bySignature.values()]
      .filter((paper) => matchesPastPaperFilters(paper, filtersArg))
      .sort((a, b) => String(a.paperNumberLabel || '').localeCompare(String(b.paperNumberLabel || '')));
  }

  function getPastPaperCatalog(filtersArg) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    return mergePastPaperCatalog(filtersArg, getPastPaperLibraryStore()).map(clone);
  }

  async function listRemotePastPaperDocuments() {
    if (!isSupabaseEnabled()) return [];
    const client = initSupabaseClient();
    if (!client) return [];

    const bucket = 'kagie-documents';
    const listed = await client.storage.from(bucket).list('past-papers', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (listed.error) throw new Error(listed.error.message || 'Could not load past paper files.');

    const files = safeArray(listed.data).filter((file) => /\.pdf$/i.test(String(file?.name || '')));
    if (!files.length) return [];

    const urls = await Promise.all(files.map((file) => createSignedProspectusUrl(client, bucket, `past-papers/${file.name}`)));
    return files
      .map((file, index) => {
        const parsed = parsePastPaperRemoteFileName(file.name);
        if (!parsed) return null;
        return normalizePastPaperLibraryRecord({
          ...parsed,
          title: parsed.title || `${parsed.subject} ${getPastPaperNumberConfig(parsed.paperNumber)?.label || parsed.paperNumber}`,
          remotePath: `past-papers/${file.name}`,
          fileUrl: urls[index],
          fileName: file.name,
          source: 'remote',
          createdAt: String(file?.created_at || nowISO()),
          updatedAt: String(file?.updated_at || file?.created_at || nowISO()),
          sourceLabel: `${parsed.province} uploaded paper`
        });
      })
      .filter(Boolean);
  }

  async function getPastPaperCatalogAsync(filtersArg) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const local = getPastPaperCatalog(filtersArg);
    if (!isSupabaseEnabled()) return local;
    try {
      const client = initSupabaseClient();
      const manifestRecords = await readPastPaperManifest(client);
      const existingStore = getPastPaperLibraryStore();
      const existingBySignature = new Map(existingStore.map((item) => [item.paperSignature, item]));
      const remoteSource = manifestRecords.length ? manifestRecords : await listRemotePastPaperDocuments();
      const remoteNormalized = remoteSource.map((item) => {
        const existing = existingBySignature.get(item.paperSignature) || {};
        return normalizePastPaperLibraryRecord({
          ...existing,
          ...item,
          title: item.title || existing.title,
          summary: item.summary || existing.summary,
          description: item.description || existing.description,
          questions: safeArray(item.questions).length ? item.questions : existing.questions,
          uploadedByName: item.uploadedByName || existing.uploadedByName,
          uploadedByRole: item.uploadedByRole || existing.uploadedByRole,
          uploadedById: item.uploadedById || existing.uploadedById,
          createdAt: item.createdAt || existing.createdAt,
          updatedAt: item.updatedAt || existing.updatedAt || nowISO(),
          source: item.source || existing.source || 'remote'
        });
      });
      const localOnly = existingStore.filter((item) => !item.remotePath);
      savePastPaperLibraryStore(localOnly.concat(remoteNormalized.map((item) => ({ ...item, fileUrl: '' }))));
      return mergePastPaperCatalog(filtersArg, remoteNormalized.concat(localOnly)).map(clone);
    } catch (error) {
      console.warn('Falling back to local past paper catalog because remote paper storage could not be listed.', error);
      return local;
    }
  }

  function findPastPaperById(paperIdArg) {
    const paperId = String(paperIdArg || '').trim();
    if (!paperId) return null;
    const parsed = parsePastPaperSignature(paperId);
    if (!parsed) return null;
    const uploaded = getPastPaperLibraryStore().find((item) => item.paperSignature === paperId);
    return uploaded ? normalizePastPaperLibraryRecord(uploaded) : buildGeneratedPastPaperRecord(parsed);
  }

  async function savePastPaperByStaffAsync(payloadArg) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const payload = payloadArg || {};
    const grade = String(payload.grade || '').trim();
    const year = Number(payload.year || 0);
    const province = String(payload.province || '').trim();
    const subject = String(payload.subject || '').trim();
    const session = String(payload.session || '').trim();
    const paperNumber = String(payload.paperNumber || '').trim();
    const title = String(payload.title || '').trim();
    const file = payload.file || null;
    const mimeType = String(payload.mimeType || payload.type || file?.type || 'application/pdf').trim() || 'application/pdf';
    const fileName = String(payload.fileName || payload.name || file?.name || `${title || subject || 'paper'}.pdf`).trim();

    if (!grade || !year || !province || !subject || !session || !paperNumber) throw new Error('Complete the grade, year, province, subject, session, and paper type first.');
    if (!fileName) throw new Error('Choose a PDF past paper first.');
    if (!/pdf/i.test(mimeType) && !/\.pdf$/i.test(fileName)) throw new Error('Upload a PDF file for the past paper.');

    const paperSignature = buildPastPaperSignature({ grade, year, province, subject, session, paperNumber });
    const baseRecord = normalizePastPaperLibraryRecord({
      id: paperSignature,
      paperSignature,
      grade,
      year,
      province,
      subject,
      session,
      paperNumber,
      title: title || `${subject} ${getPastPaperNumberConfig(paperNumber)?.label || paperNumber}`,
      description: String(payload.description || '').trim(),
      questions: safeArray(payload.questions),
      fileName,
      uploadedById: actor.id,
      uploadedByName: actor.fullName || actor.email || 'Kagie staff',
      uploadedByRole: actor.role,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      source: 'local'
    });

    let nextRecord = { ...baseRecord };
    if (file && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const safeTitle = sanitizePathPart(baseRecord.title || fileName) || 'paper';
          const remoteFileName = `${paperSignature}__${safeTitle}.pdf`;
          const remotePath = `past-papers/${remoteFileName}`;
          const upload = await client.storage.from('kagie-documents').upload(remotePath, file, {
            cacheControl: '3600',
            contentType: mimeType || 'application/pdf',
            upsert: true
          });
          if (upload.error) throw new Error(upload.error.message || 'Could not upload the past paper PDF.');
          nextRecord = normalizePastPaperLibraryRecord({
            ...baseRecord,
            remotePath,
            fileUrl: await createSignedProspectusUrl(client, 'kagie-documents', remotePath),
            source: 'remote'
          });
          const manifestSeed = await readPastPaperManifest(client);
          const manifestNext = manifestSeed
            .filter((item) => item.paperSignature !== nextRecord.paperSignature)
            .concat([nextRecord]);
          await writePastPaperManifest(client, manifestNext);
        }
      } catch (error) {
        console.warn('Past paper upload fell back to local storage.', error);
      }
    }

    if (!nextRecord.remotePath) {
      const dataUrl = String(payload.dataUrl || '').trim() || await readFileAsDataUrl(file);
      nextRecord = normalizePastPaperLibraryRecord({
        ...baseRecord,
        fileUrl: dataUrl,
        source: 'local'
      });
    }

    const store = getPastPaperLibraryStore().filter((item) => item.paperSignature !== nextRecord.paperSignature);
    savePastPaperLibraryStore([nextRecord].concat(store));
    return clone(nextRecord);
  }

  async function deletePastPaperByStaffAsync(paperIdArg) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const paperId = String(paperIdArg || '').trim();
    const store = getPastPaperLibraryStore();
    const current = store.find((item) => item.paperSignature === paperId || item.id === paperId || item.remotePath === paperId);
    if (!current) throw new Error('Past paper not found.');
    if (current.remotePath && isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        if (client) {
          const removed = await client.storage.from('kagie-documents').remove([current.remotePath]);
          if (removed.error) throw new Error(removed.error.message || 'Could not remove the past paper from storage.');
          const manifestSeed = await readPastPaperManifest(client);
          await writePastPaperManifest(client, manifestSeed.filter((item) => item.paperSignature !== current.paperSignature));
        }
      } catch (error) {
        console.warn('Past paper delete fell back to local cleanup only.', error);
      }
    }
    savePastPaperLibraryStore(store.filter((item) => {
      const sameSignature = item.paperSignature === current.paperSignature;
      const sameRemotePath = current.remotePath && item.remotePath === current.remotePath;
      const sameId = String(item.id || '').trim() === paperId;
      return !(sameSignature || sameRemotePath || sameId);
    }));
    return true;
  }

  function getPastPaperPracticeHistory(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = String(userIdArg || actor.id).trim();
    return safeArray(read(KEYS.pastPaperProgress, []))
      .filter((entry) => String(entry?.userId || '').trim() === userId)
      .map((entry) => normalizePastPaperPracticeEntry(entry, userId))
      .filter((entry) => entry.paperId)
      .sort((a, b) => new Date(b.lastPractisedAt || 0) - new Date(a.lastPractisedAt || 0));
  }

  function normalizePastPaperQuestionProgressList(progressArg, paperArg) {
    const paper = paperArg || null;
    const baseQuestions = normalizePastPaperQuestionSet(paper?.questions, paper?.subject, paper?.paperNumber, paper?.sessionLabel);
    const progressMap = new Map(safeArray(progressArg).map((item) => [String(item?.id || item?.questionId || '').trim(), item]));
    return baseQuestions.map((question) => {
      const progress = progressMap.get(question.id) || {};
      const score = progress.score === '' || progress.score === null || progress.score === undefined ? null : Number(progress.score);
      return {
        id: question.id,
        label: question.label,
        topic: question.topic,
        maxMarks: question.maxMarks,
        completed: Boolean(progress.completed),
        score: Number.isFinite(score) ? score : null,
        note: String(progress.note || '').trim(),
        updatedAt: String(progress.updatedAt || '').trim(),
        attempts: Math.max(0, Number(progress.attempts || 0)),
        failedAttempts: Math.max(0, Number(progress.failedAttempts || 0)),
        solvedOnAttempt: progress.solvedOnAttempt === '' || progress.solvedOnAttempt === null || progress.solvedOnAttempt === undefined ? null : Math.max(1, Number(progress.solvedOnAttempt || 0)),
        lastAttemptAt: String(progress.lastAttemptAt || '').trim()
      };
    });
  }

  function getPastPaperQuestionPassMark(questionArg) {
    return Math.max(1, Math.ceil(Number(questionArg?.maxMarks || 0) * 0.6));
  }

  function isPastPaperQuestionSolved(questionArg) {
    const question = questionArg || {};
    const score = question.score === '' || question.score === null || question.score === undefined ? null : Number(question.score);
    if (!question.completed || !Number.isFinite(score)) return false;
    return score >= getPastPaperQuestionPassMark(question);
  }

  function normalizePastPaperPracticeEntry(entryArg, userIdArg) {
    const entry = entryArg || {};
    const paperId = String(entry.paperId || entry.paperSignature || '').trim();
    const paper = paperId ? findPastPaperById(paperId) : null;
    const questionProgress = normalizePastPaperQuestionProgressList(entry.questionProgress, paper);
    const totalQuestions = questionProgress.length;
    const completedQuestions = questionProgress.filter((item) => item.completed).length;
    const solvedQuestions = questionProgress.filter((item) => isPastPaperQuestionSolved(item)).length;
    const totalMarks = questionProgress.reduce((sum, item) => sum + Number(item.maxMarks || 0), 0);
    const earnedMarks = questionProgress.reduce((sum, item) => sum + Math.max(0, Math.min(Number(item.score || 0), Number(item.maxMarks || 0))), 0);
    const calculatedPerformance = totalMarks ? Math.round((earnedMarks / totalMarks) * 100) : null;
    const score = entry.score === '' || entry.score === null || entry.score === undefined ? calculatedPerformance : Number(entry.score);
    const troubleQuestions = questionProgress
      .filter((item) => Number(item.failedAttempts || 0) > 0 || (item.completed && !isPastPaperQuestionSolved(item)))
      .sort((a, b) => {
        const failDiff = Number(b.failedAttempts || 0) - Number(a.failedAttempts || 0);
        if (failDiff) return failDiff;
        const scoreA = Number.isFinite(Number(a.score)) ? Number(a.score) : -1;
        const scoreB = Number.isFinite(Number(b.score)) ? Number(b.score) : -1;
        return scoreA - scoreB;
      })
      .map((item) => ({
        id: item.id,
        label: item.label,
        topic: item.topic,
        failedAttempts: Number(item.failedAttempts || 0),
        solvedOnAttempt: item.solvedOnAttempt,
        score: Number.isFinite(Number(item.score)) ? Number(item.score) : null,
        maxMarks: Number(item.maxMarks || 0)
      }));

    return {
      id: String(entry.id || uid('paper')).trim(),
      userId: String(userIdArg || entry.userId || '').trim(),
      paperId,
      paperSignature: paperId,
      paperMeta: paper ? {
        grade: paper.grade,
        year: paper.year,
        province: paper.province,
        subject: paper.subject,
        session: paper.session,
        sessionLabel: paper.sessionLabel,
        paperNumber: paper.paperNumber,
        paperNumberLabel: paper.paperNumberLabel,
        title: paper.title
      } : clone(entry.paperMeta || {}),
      startedAt: String(entry.startedAt || entry.createdAt || nowISO()).trim(),
      lastPractisedAt: String(entry.lastPractisedAt || entry.updatedAt || entry.startedAt || nowISO()).trim(),
      completedAt: String(entry.completedAt || '').trim(),
      attempts: Math.max(0, Number(entry.attempts || 0)),
      status: String(entry.status || (completedQuestions ? 'in_progress' : 'new')).trim(),
      score: Number.isFinite(score) ? score : null,
      note: String(entry.note || '').trim(),
      totalQuestions,
      completedQuestions,
      solvedQuestions,
      firstAttemptSolvedQuestions: questionProgress.filter((item) => Number(item.solvedOnAttempt || 0) === 1).length,
      troubleQuestionCount: troubleQuestions.length,
      troubleQuestions: troubleQuestions.slice(0, 5),
      performance: Number.isFinite(calculatedPerformance) ? calculatedPerformance : (Number.isFinite(score) ? score : null),
      questionProgress
    };
  }

  function upsertPastPaperProgressEntry(paperIdArg, mutateFn, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = String(userIdArg || actor.id).trim();
    const paperId = String(paperIdArg || '').trim();
    if (!paperId) throw new Error('Choose a paper first.');

    const store = safeArray(read(KEYS.pastPaperProgress, []));
    const index = store.findIndex((entry) => String(entry?.userId || '').trim() === userId && String(entry?.paperId || entry?.paperSignature || '').trim() === paperId);
    const existing = index >= 0 ? normalizePastPaperPracticeEntry(store[index], userId) : normalizePastPaperPracticeEntry({
      id: uid('paper'),
      userId,
      paperId,
      paperSignature: paperId,
      attempts: 0,
      startedAt: nowISO(),
      lastPractisedAt: nowISO(),
      questionProgress: []
    }, userId);

    const next = normalizePastPaperPracticeEntry(mutateFn(clone(existing)) || existing, userId);
    if (index >= 0) store[index] = next;
    else store.push(next);
    write(KEYS.pastPaperProgress, store);
    return clone(next);
  }

  function markPastPaperPractised(paperIdArg, detailsArg, userIdArg) {
    const details = detailsArg || {};
    return upsertPastPaperProgressEntry(paperIdArg, (entry) => {
      const shouldIncrementAttempt = details.incrementAttempt !== false;
      const nextAttempt = Math.max(0, Number(entry.attempts || 0) + (shouldIncrementAttempt ? 1 : 0));
      const questions = normalizePastPaperQuestionProgressList(entry.questionProgress, findPastPaperById(paperIdArg)).map((question) => {
        if (!shouldIncrementAttempt) return question;
        if (isPastPaperQuestionSolved(question)) {
          return {
            ...question,
            attempts: Math.max(Number(question.attempts || 0), Number(question.solvedOnAttempt || nextAttempt || 0))
          };
        }
        if (nextAttempt <= 1) {
          return {
            ...question,
            attempts: Math.max(Number(question.attempts || 0), 1)
          };
        }
        return {
          ...question,
          attempts: Math.max(Number(question.attempts || 0), nextAttempt),
          failedAttempts: Math.max(Number(question.failedAttempts || 0), nextAttempt - 1),
          lastAttemptAt: nowISO()
        };
      });
      entry.lastPractisedAt = nowISO();
      entry.attempts = nextAttempt;
      entry.status = String(details.status || (details.completed ? 'completed' : entry.status || 'started')).trim() || 'started';
      entry.note = String(details.note || entry.note || '').trim();
      if (details.score !== '' && details.score !== null && details.score !== undefined) entry.score = Number(details.score);
      if (details.completed) {
        entry.completedAt = nowISO();
        entry.status = 'completed';
      }
      entry.questionProgress = Array.isArray(details.questionProgress) ? details.questionProgress : questions;
      return entry;
    }, userIdArg);
  }

  function setPastPaperQuestionProgress(paperIdArg, questionIdArg, patchArg, userIdArg) {
    const patch = patchArg || {};
    return upsertPastPaperProgressEntry(paperIdArg, (entry) => {
      const questions = normalizePastPaperQuestionProgressList(entry.questionProgress, findPastPaperById(paperIdArg));
      const questionId = String(questionIdArg || '').trim();
      const index = questions.findIndex((item) => item.id === questionId);
      if (index === -1) throw new Error('Question not found for this paper.');
      const currentAttempt = Math.max(1, Number(entry.attempts || 1));
      const nextQuestion = {
        ...questions[index],
        completed: typeof patch.completed === 'boolean' ? patch.completed : questions[index].completed,
        score: patch.score === '' || patch.score === null || patch.score === undefined ? questions[index].score : Number(patch.score),
        note: patch.note === undefined ? questions[index].note : String(patch.note || '').trim(),
        updatedAt: nowISO(),
        lastAttemptAt: nowISO(),
        attempts: Math.max(Number(questions[index].attempts || 0), currentAttempt)
      };
      const meaningfulAttempt = Number.isFinite(Number(nextQuestion.score)) || Boolean(nextQuestion.completed);
      if (meaningfulAttempt) {
        if (isPastPaperQuestionSolved(nextQuestion)) {
          const solvedOnAttempt = Math.max(1, Number(nextQuestion.solvedOnAttempt || currentAttempt));
          nextQuestion.solvedOnAttempt = solvedOnAttempt;
          nextQuestion.failedAttempts = Math.max(Number(nextQuestion.failedAttempts || 0), Math.max(0, solvedOnAttempt - 1));
        } else {
          nextQuestion.failedAttempts = Math.max(Number(nextQuestion.failedAttempts || 0), currentAttempt);
        }
      }
      questions[index] = nextQuestion;
      entry.questionProgress = questions;
      entry.lastPractisedAt = nowISO();
      entry.attempts = Math.max(1, Number(entry.attempts || 0));
      entry.status = questions.every((item) => item.completed) ? 'completed' : 'in_progress';
      entry.completedAt = questions.every((item) => item.completed) ? nowISO() : String(entry.completedAt || '').trim();
      return entry;
    }, userIdArg);
  }

  function savePastPaperPerformance(paperIdArg, patchArg, userIdArg) {
    const patch = patchArg || {};
    return upsertPastPaperProgressEntry(paperIdArg, (entry) => {
      entry.lastPractisedAt = nowISO();
      entry.attempts = Math.max(1, Number(entry.attempts || 0));
      entry.note = patch.note === undefined ? entry.note : String(patch.note || '').trim();
      if (patch.score !== '' && patch.score !== null && patch.score !== undefined) entry.score = Number(patch.score);
      if (patch.completed) {
        entry.completedAt = nowISO();
        entry.status = 'completed';
      }
      return entry;
    }, userIdArg);
  }

  function getInstitutionForSelection(choice) {
    if (!choice) return null;
    if (choice.institutionId) {
      const byId = getInstitutionById(choice.institutionId);
      if (byId) return byId;
    }
    return getInstitutionByNameAndYear(
      choice.institutionName || choice.institution || choice.name,
      choice.year
    ) || null;
  }

  function calculateNscLevel(percent) {
    const value = Math.max(0, Math.min(100, Number(percent || 0)));
    if (value >= 80) return 7;
    if (value >= 70) return 6;
    if (value >= 60) return 5;
    if (value >= 50) return 4;
    if (value >= 40) return 3;
    if (value >= 30) return 2;
    return 1;
  }

  function isLifeOrientationSubject(subject) {
    return String(subject || '').trim().toLowerCase().includes('life orientation');
  }

  function normalizeMarksForAnalysis(subjectsArg) {
    return safeArray(subjectsArg)
      .map((mark) => {
        const subject = String(mark?.subject || '').trim();
        if (!subject) return null;
        const percent = Math.max(0, Math.min(100, Number(mark?.percent || 0)));
        const level = Math.max(1, Math.min(7, Number(mark?.level || calculateNscLevel(percent))));
        return {
          subject,
          percent,
          level
        };
      })
      .filter(Boolean);
  }

  function getAcademicProfile(subjectsArg) {
    const subjects = normalizeMarksForAnalysis(subjectsArg);
    const bySubject = new Map(subjects.map((item) => [item.subject.toLowerCase(), item]));
    const lifeOrientation = subjects.find((item) => isLifeOrientationSubject(item.subject)) || null;
    const apsSubjects = subjects.filter((item) => !isLifeOrientationSubject(item.subject))
      .sort((a, b) => (b.level - a.level) || (b.percent - a.percent))
      .slice(0, 6);
    const apsTotal = apsSubjects.reduce((sum, item) => sum + Number(item.level || 0), 0);
    const averagePercent = subjects.length ? Math.round(subjects.reduce((sum, item) => sum + item.percent, 0) / subjects.length) : 0;

    const read = (pattern) => subjects.find((item) => pattern.test(item.subject.toLowerCase())) || null;
    const maths = read(/\bmathematics\b/);
    const mathLit = read(/mathematical literacy/);
    const english = read(/english/);
    const physicalSciences = read(/physical sciences|physics/);
    const lifeSciences = read(/life sciences|biology/);
    const accounting = read(/accounting/);
    const businessStudies = read(/business studies/);
    const economics = read(/economics/);
    const geography = read(/geography/);
    const cat = read(/computer applications technology/);
    const it = read(/\binformation technology\b/);
    const tourism = read(/tourism/);

    const strengths = subjects
      .filter((item) => item.percent >= 60)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5)
      .map((item) => item.subject);

    return {
      subjects,
      bySubject,
      apsTotal,
      apsWithLifeOrientation: apsTotal + Number(lifeOrientation?.level || 0),
      countedSubjects: apsSubjects,
      averagePercent,
      subjectCount: subjects.length,
      strengths,
      mathLevel: maths?.level || 0,
      mathLitLevel: mathLit?.level || 0,
      englishLevel: english?.level || 0,
      scienceLevel: Math.max(physicalSciences?.level || 0, lifeSciences?.level || 0),
      businessLevel: Math.max(accounting?.level || 0, businessStudies?.level || 0, economics?.level || 0),
      techLevel: Math.max(cat?.level || 0, it?.level || 0),
      humanitiesLevel: Math.max(geography?.level || 0, tourism?.level || 0, english?.level || 0)
    };
  }

  function scoreProgrammeFit(programmeName, facultyName, institution, profile) {
    const text = `${facultyName || ''} ${programmeName || ''}`.toLowerCase();
    let minimumAps = institution?.type === 'TVET' ? 16 : institution?.type === 'University of Technology' ? 22 : 26;
    let score = 50;
    const reasons = [];
    const cautions = [];

    if (/engineering|mechanical|civil|electrical|chemical|quantity survey|architecture/.test(text)) {
      minimumAps += 4;
      score += profile.mathLevel >= 5 ? 14 : -12;
      score += profile.scienceLevel >= 5 ? 12 : -10;
      if (profile.mathLevel < 5) cautions.push('Engineering pathways usually need strong Mathematics results.');
      if (profile.scienceLevel < 5) cautions.push('Engineering-related courses often expect strong Physical Sciences or Life Sciences.');
      reasons.push('Matched against your maths and science results.');
    } else if (/nursing|medicine|pharmacy|physio|dentistry|health/.test(text)) {
      minimumAps += 5;
      score += profile.scienceLevel >= 5 ? 15 : -12;
      score += profile.englishLevel >= 4 ? 6 : -6;
      if (profile.scienceLevel < 5) cautions.push('Health programmes usually expect strong science results.');
      reasons.push('Matched against your science readiness for health programmes.');
    } else if (/accounting|economics|business|management|marketing|finance|commerce|hr|public administration/.test(text)) {
      minimumAps += 1;
      score += profile.businessLevel >= 5 ? 12 : -3;
      score += Math.max(profile.mathLevel, profile.mathLitLevel) >= 4 ? 8 : -5;
      reasons.push('Matched against your business and quantitative subjects.');
    } else if (/computer|informatics|software|systems|information technology|ict|data/.test(text)) {
      minimumAps += 2;
      score += Math.max(profile.mathLevel, profile.mathLitLevel) >= 4 ? 10 : -5;
      score += profile.techLevel >= 4 ? 12 : 0;
      reasons.push('Matched against your technology and problem-solving subjects.');
    } else if (/education|teaching|foundation phase|senior phase/.test(text)) {
      score += profile.englishLevel >= 4 ? 10 : 0;
      score += profile.humanitiesLevel >= 4 ? 8 : 0;
      reasons.push('Matched against language and humanities readiness.');
    } else if (/tourism|hospitality|travel|office administration|public relations|social work|psychology|humanities|arts/.test(text)) {
      score += profile.humanitiesLevel >= 4 ? 10 : 0;
      reasons.push('Matched against your communication and humanities subjects.');
    } else if (/agric|environment|biochem|science|physics|chemistry|biology/.test(text)) {
      minimumAps += 2;
      score += profile.scienceLevel >= 4 ? 10 : -5;
      reasons.push('Matched against your science profile.');
    }

    const apsGap = profile.apsTotal - minimumAps;
    score += apsGap * 2.5;
    if (apsGap >= 6) {
      reasons.push(`Your APS of ${profile.apsTotal} is comfortably above the usual baseline for this path.`);
    } else if (apsGap >= 0) {
      reasons.push(`Your APS of ${profile.apsTotal} is within range for this path.`);
    } else {
      cautions.push(`Your APS of ${profile.apsTotal} is below the usual range for this path.`);
    }

    const risk = apsGap >= 4 ? 'safe' : apsGap >= 0 ? 'balanced' : 'stretch';
    return {
      score,
      risk,
      minimumAps,
      reasons,
      cautions
    };
  }

  function getApplicationRecommendations(input) {
    const options = input || {};
    const profile = getAcademicProfile(options.marks || options.subjects || []);
    const targetYear = String(options.year || new Date().getFullYear());
    const province = String(options.province || '').trim();
    const institutionType = String(options.institutionType || '').trim();
    const chosenInstitutionName = String(options.institutionName || '').trim();
    const chosenCourse = String(options.choice1 || options.course || '').trim();
    const institutions = getInstitutionCatalog({
      year: targetYear,
      province,
      type: institutionType,
      canApplyOnly: options.includeClosed ? false : true,
      includeInactive: options.includeInactive === true
    });

    const matches = [];
    institutions.forEach((institution) => {
      safeArray(institution.faculties).forEach((faculty) => {
        safeArray(faculty.courses).forEach((course) => {
          const fit = scoreProgrammeFit(course, faculty.name, institution, profile);
          matches.push({
            institutionId: institution.id,
            institutionName: institution.name,
            institutionType: institution.type,
            province: institution.province,
            applicationFee: roundMoney(institution.applicationFee || 0),
            applicationFeeLabel: institution.applicationFeeLabel || '',
            applicationFeeNote: institution.applicationFeeNote || '',
            faculty: faculty.name,
            course,
            year: institution.year,
            closingDate: institution.closingDate || institution.applicationDeadline || '',
            status: institution.status,
            risk: fit.risk,
            score: Math.round(fit.score),
            minimumAps: fit.minimumAps,
            reasons: fit.reasons,
            cautions: fit.cautions
          });
        });
      });
    });

    const ranked = matches
      .sort((a, b) => (b.score - a.score) || a.institutionName.localeCompare(b.institutionName))
      .slice(0, Math.max(12, Number(options.limit || 6)));
    const safeMatches = ranked.filter((item) => item.risk === 'safe').slice(0, 4);
    const balancedMatches = ranked.filter((item) => item.risk === 'balanced').slice(0, 4);
    const stretchMatches = ranked.filter((item) => item.risk === 'stretch').slice(0, 4);

    const warnings = [];
    if (chosenInstitutionName && chosenCourse) {
      const chosen = matches.find((item) => item.institutionName === chosenInstitutionName && item.course === chosenCourse)
        || matches.find((item) => item.institutionName === chosenInstitutionName && item.course.toLowerCase() === chosenCourse.toLowerCase());
      if (chosen) {
        if (chosen.risk === 'stretch') warnings.push(`${chosen.course} at ${chosen.institutionName} looks high-risk with your current APS of ${profile.apsTotal}.`);
        else if (chosen.risk === 'balanced') warnings.push(`${chosen.course} at ${chosen.institutionName} is possible, but keep a few safer alternatives in your shortlist.`);
        else warnings.push(`${chosen.course} at ${chosen.institutionName} looks well matched to your current marks.`);
      }
    }

    return {
      aps: {
        total: profile.apsTotal,
        withLifeOrientation: profile.apsWithLifeOrientation,
        averagePercent: profile.averagePercent,
        countedSubjects: profile.countedSubjects,
        strengths: profile.strengths
      },
      topMatches: ranked.slice(0, 6),
      safeAlternatives: safeMatches,
      balancedOptions: balancedMatches,
      stretchOptions: stretchMatches,
      warnings
    };
  }

  function getPackageUsageSummary(appArg) {
    const app = appArg || null;
    const pack = app?.package || null;
    const usedSlots = safeArray(app?.institutions).length;
    const rawLimit = pack?.institutionLimit ?? null;
    const institutionLimit = rawLimit === 'unlimited' || pack?.isUnlimited ? 'unlimited' : Number(rawLimit || 0);
    const remainingSlots = institutionLimit === 'unlimited' ? 'Unlimited' : Math.max(0, institutionLimit - usedSlots);
    return {
      packageName: pack?.name || pack?.packName || '',
      institutionLimit,
      usedSlots,
      remainingSlots
    };
  }

  function calculateAps(subjectsArg) {
    const profile = getAcademicProfile(subjectsArg);
    return {
      total: profile.apsTotal,
      withLifeOrientation: profile.apsWithLifeOrientation,
      averagePercent: profile.averagePercent,
      countedSubjects: profile.countedSubjects,
      strengths: profile.strengths
    };
  }

  function calculateReadiness(application, documents) {
    const app = application || {};
    const learner = app.forms?.learner || {};
    const school = app.forms?.school || {};
    const marks = safeArray(app.forms?.marks?.subjects);
    const checks = [
      !!learner.fullNames || !!learner.fullName,
      !!learner.idNumber,
      !!learner.email,
      !!school.schoolName,
      marks.length >= 5,
      !!app.package,
      safeArray(app.institutions).length > 0,
      safeArray(documents).length >= 2
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }

  function getUpdateFeed(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const latest = getLatestApplication(userId);
    const docs = getDocumentsByUser(userId);
    const notifications = getNotifications(userId).slice(0, 5);
    const catalogUpdates = getKagieData().updates.map((item) => ({
      id: item.id || uid('upd'),
      source: 'catalog',
      title: item.title,
      message: item.body || '',
      category: item.category || 'announcement',
      ctaLabel: item.ctaLabel || 'Open',
      ctaHref: item.ctaHref || 'home.html',
      createdAt: item.createdAt || nowISO()
    }));

    const dynamic = [];

    if (latest && latest.status === STATUS.application.MISSING_DOCUMENTS) {
      dynamic.push({
        id: uid('upd'),
        source: 'dynamic',
        title: 'Missing documents need attention',
        message: 'Upload the requested documents so Kagie can move your application forward.',
        category: 'deadline',
        ctaLabel: 'Upload documents',
        ctaHref: 'upload.html',
        createdAt: nowISO()
      });
    }

    if (latest && !latest.package) {
      dynamic.push({
        id: uid('upd'),
        source: 'dynamic',
        title: 'Choose an application pack',
        message: 'Select the Kagie pack that matches how many institutions you want to target.',
        category: 'recommendation',
        ctaLabel: 'Open forms',
        ctaHref: 'forms.html',
        createdAt: nowISO()
      });
    }

    if (docs.length < 2) {
      dynamic.push({
        id: uid('upd'),
        source: 'dynamic',
        title: 'Upload your core documents',
        message: 'Certified ID copy and latest results help your application move faster.',
        category: 'recommendation',
        ctaLabel: 'Upload now',
        ctaHref: 'upload.html',
        createdAt: nowISO()
      });
    }

    const notificationUpdates = notifications.map((item) => ({
      id: item.id,
      source: 'notification',
      title: item.title,
      message: item.message,
      category: item.type || 'announcement',
      ctaLabel: 'Open Kagie home',
      ctaHref: 'home.html',
      createdAt: item.createdAt
    }));

    return [...dynamic, ...notificationUpdates, ...catalogUpdates]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function getSettings() {
    return mergeDeep(DEFAULT_SETTINGS, read(KEYS.settings, DEFAULT_SETTINGS));
  }

  function saveSettings(patch) {
    const updated = mergeDeep(getSettings(), patch || {});
    write(KEYS.settings, updated);
    return updated;
  }

  function userExperiencePrefsKey(userId) {
    return `${KEYS.userPrefsPrefix}${userId}`;
  }

  function getUserExperiencePreferences(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const saved = mergeDeep(DEFAULT_EXPERIENCE_PREFERENCES, read(userExperiencePrefsKey(userId), DEFAULT_EXPERIENCE_PREFERENCES));
    let autoPrefs = { lowDataMode: false, reducedMotion: false, connectionMode: 'standard' };
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
      const effectiveType = String(connection?.effectiveType || '').toLowerCase();
      const saveData = Boolean(connection?.saveData);
      const memory = Number(navigator.deviceMemory || 0);
      if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
        autoPrefs = { ...autoPrefs, lowDataMode: true, reducedMotion: true, connectionMode: 'slow' };
      } else if (effectiveType === '3g' || (memory > 0 && memory <= 2)) {
        autoPrefs = { ...autoPrefs, lowDataMode: true, reducedMotion: memory > 0 && memory <= 2, connectionMode: 'balanced' };
      }
    } catch (error) {
      autoPrefs = { lowDataMode: false, reducedMotion: false, connectionMode: 'standard' };
    }
    return {
      ...saved,
      lowDataMode: Boolean(saved.lowDataMode || autoPrefs.lowDataMode),
      reducedMotion: Boolean(saved.reducedMotion || autoPrefs.reducedMotion),
      connectionMode: autoPrefs.connectionMode || saved.connectionMode || 'standard'
    };
  }

  function saveUserExperiencePreferences(patch, userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const updated = mergeDeep(getUserExperiencePreferences(userId), patch || {});
    write(userExperiencePrefsKey(userId), updated);
    return clone(getUserExperiencePreferences(userId));
  }

  function isPlaceholderSupabaseConfig(config) {
    const url = String(config?.url || '').trim();
    const anonKey = String(config?.anonKey || '').trim();

    return (
      !url ||
      !anonKey ||
      /YOUR_PROJECT/i.test(url) ||
      /YOUR_ANON_KEY/i.test(anonKey) ||
      /example/i.test(url)
    );
  }

  function configureSupabase(config) {
    const settings = saveSettings({ supabase: mergeDeep(getSettings().supabase, config || {}) });
    supabaseClient = null;
    return initSupabaseClient(settings.supabase);
  }

  function initSupabaseClient(configArg) {
    const config = configArg || getSettings().supabase;
    const sdk = window.supabase;
    if (!config?.enabled) return null;
    if (isPlaceholderSupabaseConfig(config)) return null;
    if (!sdk || typeof sdk.createClient !== 'function') {
      console.warn('Supabase is enabled but the SDK script is not loaded.');
      return null;
    }
    if (!config.url || !config.anonKey) {
      console.warn('Supabase is enabled but URL or anon key is missing.');
      return null;
    }
    if (!supabaseClient) {
      supabaseClient = sdk.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      });
    }
    return supabaseClient;
  }

  function isSupabaseEnabled() {
    const cfg = getSettings().supabase;
    return !!(cfg?.enabled && !isPlaceholderSupabaseConfig(cfg) && initSupabaseClient(cfg));
  }

  function getAuthRedirectUrl(pathnameArg) {
    const fallback = String(window.location.href || '').split('#')[0].split('?')[0];
    const raw = String(pathnameArg || '').trim();
    if (!raw) return fallback;
    try {
      return new URL(raw, fallback).toString();
    } catch (error) {
      return fallback;
    }
  }

  function createEphemeralSupabaseClient(suffixArg) {
    const config = getSettings().supabase;
    const sdk = window.supabase;
    if (!config?.enabled || isPlaceholderSupabaseConfig(config)) return null;
    if (!sdk || typeof sdk.createClient !== 'function') return null;
    if (!config.url || !config.anonKey) return null;
    const suffix = String(suffixArg || 'temp').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'temp';
    return sdk.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `kagie-${suffix}-${Date.now()}`
      }
    });
  }

  async function awaitRuntimeSupabaseConfig() {
    const pendingConfig = typeof window !== 'undefined' ? window.__kagieRuntimeConfigPromise : null;
    if (!pendingConfig || typeof pendingConfig.then !== 'function') return null;
    try {
      return await pendingConfig;
    } catch (error) {
      console.warn('Kagie runtime config load fallback used:', error);
      return null;
    }
  }

  async function getLiveAdminSetupStatus() {
    const settings = getSettings();
    const endpoint = String(settings?.supabase?.adminConfigStatusEndpoint || '').trim();

    if (!endpoint) {
      return {
        hasSupabaseUrl: Boolean(settings?.supabase?.url),
        hasServiceRoleKey: false,
        secureAdminProvisioningReady: false,
        message: 'Live admin status endpoint is not configured on this site yet.'
      };
    }

    try {
      const response = await fetch(endpoint, { method: 'GET' });
      const payload = await response.json().catch(() => null);
      const data = payload?.data || payload || {};
      return {
        hasSupabaseUrl: Boolean(data?.hasSupabaseUrl),
        hasServiceRoleKey: Boolean(data?.hasServiceRoleKey),
        secureAdminProvisioningReady: Boolean(data?.secureAdminProvisioningReady),
        message: data?.secureAdminProvisioningReady
          ? 'Secure live admin creation is ready.'
          : 'Secure live admin creation is waiting for the server-side Supabase service role key.'
      };
    } catch (error) {
      return {
        hasSupabaseUrl: Boolean(settings?.supabase?.url),
        hasServiceRoleKey: false,
        secureAdminProvisioningReady: false,
        message: error?.message || 'Could not check live admin setup status.'
      };
    }
  }

  async function signUpPrivilegedUserViaSupabase(payload) {
    const email = normalizeEmail(payload?.email);
    const password = String(payload?.password || '');
    const fullName = String(payload?.fullName || '').trim();
    const phone = String(payload?.phone || '').trim();
    const role = payload?.role || ROLES.USER;
    const client = createEphemeralSupabaseClient(role);
    if (!client) throw new Error('Supabase authentication is not configured.');

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role
        }
      }
    });

    const message = String(error?.message || '').trim();
    const alreadyRegistered = /already registered|already been registered|user already exists|already exists/i.test(message);
    if (error && !alreadyRegistered) {
      throw new Error(message || 'Supabase signup failed.');
    }

    if (data?.session) {
      client.auth.signOut().catch(() => {});
    }

    return {
      user: data?.user || null,
      alreadyRegistered,
      pendingEmailConfirmation: Boolean(data?.user && !data?.session && !data?.user?.email_confirmed_at)
    };
  }

  const REMOTE_APPLICATION_SELECT = [
    'id',
    'user_id',
    'assistant_id',
    'status',
    'payment_status',
    'payer_name',
    'payer_phone',
    'payment_reference',
    'payment_method',
    'payment_note',
    'payment_amount',
    'submitted_at',
    'created_at',
    'updated_at',
    'package:application_packs(id,code,name,price,institution_limit,is_unlimited,description,highlight)'
  ].join(',');

  const REMOTE_PAGE_SIZE = 1000;
  const REMOTE_MAX_PAGES = 120;
  const REMOTE_IN_FILTER_CHUNK_SIZE = 150;

  function uniqueNonEmptyStrings(values) {
    return [...new Set(safeArray(values).map((value) => String(value || '').trim()).filter(Boolean))];
  }

  function chunkArray(values, chunkSizeArg) {
    const chunkSize = Math.max(1, Number(chunkSizeArg || REMOTE_IN_FILTER_CHUNK_SIZE));
    const items = safeArray(values);
    const chunks = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
  }

  async function fetchPagedSupabaseRows(buildQuery, options = {}) {
    const pageSize = Math.max(1, Number(options.pageSize || REMOTE_PAGE_SIZE));
    const maxPages = Math.max(1, Number(options.maxPages || REMOTE_MAX_PAGES));
    const rows = [];

    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const result = await buildQuery().range(from, to);
      if (result.error) return { data: rows, error: result.error };

      const pageRows = safeArray(result.data);
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
    }

    return { data: rows, error: null };
  }

  async function fetchPagedRowsByIn(client, tableName, selectColumns, columnName, idsArg, options = {}) {
    const ids = uniqueNonEmptyStrings(idsArg);
    if (!ids.length) return { data: [], error: null };

    const rows = [];
    for (const chunk of chunkArray(ids, options.chunkSize)) {
      const result = await fetchPagedSupabaseRows(() => {
        let query = client.from(tableName).select(selectColumns).in(columnName, chunk);
        if (options.order?.column) {
          query = query.order(options.order.column, { ascending: options.order.ascending === true });
        }
        return query;
      }, options);

      if (result.error) return { data: rows, error: result.error };
      rows.push(...safeArray(result.data));
    }

    return { data: rows, error: null };
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
  }

  function toIntegerOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toNumericOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeLooseDateToIso(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    let year = '';
    let month = '';
    let day = '';
    let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      year = match[1];
      month = match[2];
      day = match[3];
    } else {
      match = text.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{4})$/);
      if (!match) return text;
      day = match[1];
      month = match[2];
      year = match[3];
    }

    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return text;
    return iso;
  }

  function toDateOrNull(value) {
    const text = normalizeLooseDateToIso(value);
    return text || null;
  }

  function isRecoverableProfileSyncError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('stack depth limit exceeded')
      || message.includes('infinite recursion')
      || message.includes('policy')
      || message.includes('schema cache')
      || message.includes('could not find')
      || message.includes('live profile policy conflict blocked assistant creation')
      || message.includes('row-level security')
      || message.includes('profiles_id_fkey')
      || (message.includes('foreign key constraint') && message.includes('profiles'))
      || (message.includes('update or delete on table') && message.includes('users') && message.includes('profiles'));
  }

  function isProfileSchemaCacheColumnError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('profiles')
      && (message.includes('schema cache') || message.includes('could not find'))
      && (
        message.includes('email')
        || message.includes('phone')
        || message.includes('user_id')
        || message.includes('id_number')
        || message.includes('province')
        || message.includes('city')
      );
  }

  function isMissingAssignmentAuditColumnsError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('assigned_by')
      || message.includes('assigned_at')
      || message.includes('assignment_status');
  }

  function isRecoverableRemoteSyncError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return isRecoverableProfileSyncError(error)
      || message.includes('failed to fetch')
      || message.includes('networkerror')
      || message.includes('load failed')
      || message.includes('network request failed');
  }

  function isCartUserForeignKeyError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('carts_user_id_fkey')
      || (message.includes('foreign key constraint') && message.includes('cart') && message.includes('user'))
      || (message.includes('foreign key constraint') && message.includes('profiles'));
  }

  function toRemoteUserId(user) {
    if (!user) return '';
    if (user.supabaseUserId) return String(user.supabaseUserId);
    if (isUuid(user.id)) return String(user.id);
    return '';
  }

  function mapRemotePackage(remotePack) {
    if (!remotePack) return null;
    const code = String(remotePack.code || '').trim();
    const localPack = getPackCatalog().find((item) => String(item.id || '').trim().toLowerCase() === code.toLowerCase())
      || getPackCatalog().find((item) => String(item.name || '').trim().toLowerCase() === String(remotePack.name || '').trim().toLowerCase())
      || null;
    const institutionLimit = localPack
      ? localPack.institutionLimit
      : (remotePack.is_unlimited ? 'unlimited' : Number(remotePack.institution_limit || 0));
    const displayName = localPack?.name || remotePack.name || '';
    const displayPrice = Number(localPack?.price ?? remotePack.price ?? 0);
    return {
      id: code || remotePack.id,
      remoteId: remotePack.id,
      code,
      name: displayName,
      packName: displayName,
      price: displayPrice,
      packPrice: displayPrice,
      institutionLimit,
      description: localPack?.description || remotePack.description || '',
      highlight: localPack?.highlight || remotePack.highlight || ''
    };
  }

  function mapRemoteInstitutionRow(item) {
    return {
      id: item?.id || uid('inst'),
      institutionName: item?.institution_name || item?.institutionName || item?.institution || '',
      institution: item?.institution_name || item?.institutionName || item?.institution || '',
      province: item?.province || '',
      institutionType: item?.institution_type || item?.institutionType || item?.type || '',
      applicationFee: Number(item?.application_fee ?? item?.applicationFee ?? 0),
      applicationFeeLabel: item?.application_fee_label || item?.applicationFeeLabel || '',
      applicationFeeNote: item?.application_fee_note || item?.applicationFeeNote || '',
      faculty: item?.faculty || '',
      choice1: item?.choice_1 || item?.choice1 || '',
      choice2: item?.choice_2 || item?.choice2 || '',
      choice3: item?.choice_3 || item?.choice3 || '',
      createdAt: item?.created_at || item?.createdAt || nowISO()
    };
  }

  function profileToLearnerForm(profile) {
    return {
      idNumber: profile?.idNumber || '',
      fullNames: profile?.fullNames || profile?.fullName || '',
      surname: profile?.surname || '',
      maidenName: profile?.maidenName || '',
      cellphone: profile?.cellphone || profile?.phone || '',
      email: profile?.email || '',
      province: profile?.province || '',
      postalCode: profile?.postalCode || '',
      dob: profile?.dob || '',
      gender: profile?.gender || '',
      homeLanguage: profile?.homeLanguage || '',
      address: profile?.address || '',
      needsBursary: normalizeYesNoValue(profile?.needsBursary || profile?.bursaryRequired || '', ''),
      needsResidence: normalizeYesNoValue(profile?.needsResidence || profile?.residenceRequired || '', ''),
      hasDisability: normalizeYesNoValue(profile?.hasDisability || '', ''),
      disabilityDescription: profile?.disabilityDescription || ''
    };
  }

  function profileToParentForm(profile) {
    return {
      guardianRelation: profile?.guardianRelation || '',
      guardianId: profile?.guardianId || '',
      guardianFullNames: profile?.guardianFullNames || profile?.guardianName || '',
      guardianSurname: profile?.guardianSurname || '',
      guardianCell1: profile?.guardianCell1 || profile?.guardianPhone || '',
      guardianCell2: profile?.guardianCell2 || profile?.guardianPhoneAlt || '',
      guardianEmail: profile?.guardianEmail || '',
      guardianProvince: profile?.guardianProvince || '',
      guardianPostal: profile?.guardianPostal || '',
      guardianAddress: profile?.guardianAddress || ''
    };
  }

  function profileToSchoolForm(profile) {
    return {
      schoolName: profile?.schoolName || profile?.schoolAttended || '',
      confirmName: profile?.confirmName || profile?.schoolName || profile?.schoolAttended || '',
      schoolProvince: profile?.schoolProvince || '',
      schoolType: profile?.schoolType || '',
      completionYear: profile?.completionYear || '',
      average: profile?.average || ''
    };
  }

  function buildRemoteTimeline(app) {
    const items = [
      {
        id: `${app.id}_created`,
        title: 'Draft created',
        status: STATUS.application.DRAFT,
        createdAt: app.createdAt
      }
    ];

    if (app.submittedAt) {
      items.push({
        id: `${app.id}_submitted`,
        title: 'Application submitted',
        status: app.status || STATUS.application.SUBMITTED,
        createdAt: app.submittedAt
      });
    }

    if (app.payment?.submittedAt) {
      items.push({
        id: `${app.id}_payment`,
        title: 'Payment submitted for verification',
        status: app.paymentStatus || STATUS.payment.PENDING_VERIFICATION,
        createdAt: app.payment.submittedAt
      });
    }

    if (app.paymentStatus === STATUS.payment.VERIFIED && (app.payment?.verifiedAt || app.payment?.reviewedAt)) {
      items.push({
        id: `${app.id}_payment_verified`,
        title: 'Payment verified',
        status: STATUS.payment.VERIFIED,
        createdAt: app.payment?.verifiedAt || app.payment?.reviewedAt
      });
    }

    if (app.paymentStatus === STATUS.payment.REJECTED && app.payment?.reviewedAt) {
      items.push({
        id: `${app.id}_payment_rejected`,
        title: 'Payment proof rejected',
        status: STATUS.payment.REJECTED,
        createdAt: app.payment.reviewedAt
      });
    }

    if (app.updatedAt && app.updatedAt !== app.createdAt) {
      items.push({
        id: `${app.id}_updated`,
        title: `Status updated to ${app.status || STATUS.application.DRAFT}`,
        status: app.status || STATUS.application.DRAFT,
        createdAt: app.updatedAt
      });
    }

    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function mirrorRemoteApplication(app, localUserIdArg) {
    if (!app?.id) return null;
    const acting = currentUserRaw();
    const localUserId = localUserIdArg || app.userId || acting?.id || '';
    if (!localUserId) return clone(app);

    const apps = getAllApplications();
    const localCopy = clone({
      ...app,
      userId: localUserId
    });
    const index = apps.findIndex((item) => item.id === localCopy.id);
    if (index >= 0) apps[index] = localCopy;
    else apps.push(localCopy);
    saveAllApplications(apps);
    return localCopy;
  }

  function mirrorRemoteApplications(apps, localUserIdArg) {
    safeArray(apps).forEach((app) => {
      mirrorRemoteApplication(app, localUserIdArg);
    });
  }

  function mirrorRemoteCart(items, localUserIdArg) {
    const acting = currentUserRaw();
    const localUserId = localUserIdArg || acting?.id || '';
    if (!localUserId) return clone(items || []);
    saveCart(clone(items || []), localUserId);
    return clone(items || []);
  }

  function getCartMatchKey(item) {
    if (!item || typeof item !== 'object') return '';
    const clientKey = String(item.clientKey || '').trim();
    if (clientKey) return `client:${clientKey}`;
    const stableId = String(item.id || '').trim();
    if (stableId) return `id:${stableId}`;
    const refId = String(item.refId || '').trim();
    if (refId) return `ref:${item.type || 'custom'}:${refId}`;
    const name = String(item.packName || item.serviceName || item.name || '').trim().toLowerCase();
    return `${item.type || 'custom'}:${name}`;
  }

  function mergeRemoteCartWithLocalFallback(remoteItemsArg, localItemsArg) {
    const remoteItems = safeArray(remoteItemsArg).map(clone);
    const localItems = safeArray(localItemsArg).map(clone);
    if (!localItems.length) return remoteItems;

    const remoteKeys = new Set(remoteItems.map((item) => getCartMatchKey(item)).filter(Boolean));
    const combined = [...remoteItems];
    localItems.forEach((item) => {
      const key = getCartMatchKey(item);
      if (key && remoteKeys.has(key)) return;
      combined.push(item);
    });

    const seen = new Set();
    return combined.filter((item) => {
      const key = getCartMatchKey(item) || `idx:${seen.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function resolveSupabaseContext(userIdArg) {
    if (!isSupabaseEnabled()) return null;
    const client = initSupabaseClient();
    if (!client) return null;

    let viewer = currentUserRaw();
    if (!viewer) {
      await restoreSession();
      viewer = currentUserRaw();
    }
    if (!viewer) return null;
    if (isLocalStaffSession(viewer)) return null;

    let verified = null;
    try {
      verified = await getSupabaseVerifiedUser();
    } catch (err) {
      console.warn('Could not verify Supabase user:', err);
    }

    let remoteSelfId = toRemoteUserId(viewer) || verified?.id || '';
    if (verified?.id && viewer.supabaseUserId !== verified.id) {
      const patched = {
        ...viewer,
        supabaseUserId: verified.id,
        email: normalizeEmail(verified.email || viewer.email),
        fullName: viewer.fullName || verified.user_metadata?.full_name || viewer.fullName,
        source: 'supabase',
        updatedAt: nowISO()
      };
      upsertLocalUser(patched);
      setCurrentUser(patched);
      viewer = currentUserRaw();
      remoteSelfId = verified.id;
    }

    if (!remoteSelfId) return null;

    let targetLocalUser = null;
    let targetRemoteId = remoteSelfId;

    if (!userIdArg || userIdArg === viewer.id || userIdArg === viewer.supabaseUserId) {
      targetLocalUser = getUserById(viewer.id) || viewer;
    } else {
      targetLocalUser = getUserById(userIdArg) || getUsers().find((item) => item.supabaseUserId === userIdArg) || null;
      targetRemoteId = targetLocalUser?.supabaseUserId || (isUuid(userIdArg) ? String(userIdArg) : '');
      if (viewer.role === ROLES.USER && targetRemoteId !== remoteSelfId) {
        throw new Error('You can only access your own data.');
      }
      if (!targetRemoteId) return null;
    }

    return {
      client,
      viewer,
      targetLocalUser: targetLocalUser || ((!userIdArg || userIdArg === viewer.id || userIdArg === viewer.supabaseUserId) ? viewer : null),
      remoteSelfId,
      targetRemoteId
    };
  }

  async function getRemoteProfileSnapshot(remoteUserId, clientArg) {
    if (!isSupabaseEnabled() || !remoteUserId) return null;
    const client = clientArg || initSupabaseClient();
    if (!client) return null;
    const query = await client.from('profiles').select('*').eq('id', remoteUserId).maybeSingle();
    if (query.error) {
      console.warn('Could not load remote profile snapshot:', query.error.message || query.error);
      return null;
    }
    return query.data || null;
  }

  async function fetchRemoteUsersByIds(remoteIds, clientArg) {
    const ids = uniqueNonEmptyStrings(remoteIds);
    if (!ids.length) return [];
    const client = clientArg || initSupabaseClient();
    if (!client) return [];
    const query = await fetchPagedRowsByIn(client, 'profiles', '*', 'id', ids);
    if (query.error) {
      if (isRecoverableProfileSyncError(query.error)) {
        console.warn('Falling back to local profile cache because the remote profiles lookup is unavailable.', query.error);
        return [];
      }
      throw new Error(query.error.message || 'Could not load profile records.');
    }
    return syncRemoteUsersFromProfiles(query.data || []);
  }

  async function fetchRemotePacks(force = false) {
    if (!isSupabaseEnabled()) return [];
    if (remotePackCache && !force) return clone(remotePackCache);
    const client = initSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('application_packs')
      .select('id,code,name,price,institution_limit,is_unlimited,description,highlight,is_active,updated_at')
      .order('price', { ascending: true });
    if (error) throw new Error(error.message || 'Could not load application packs.');
    remotePackCache = data || [];
    packCatalogCache = null;
    return clone(remotePackCache);
  }

  async function getPackCatalogAsync(force = false) {
    await fetchRemotePacks(force).catch(() => []);
    return getPackCatalog();
  }

  async function getPacksForAdminAsync(force = false) {
    requireRole([ROLES.MASTER]);
    await fetchRemotePacks(force).catch(() => []);
    return getPacksForAdmin();
  }

  async function findRemotePackRecord(packArg) {
    if (!packArg) return null;
    const packs = await fetchRemotePacks();
    const remoteId = String(packArg.remoteId || '').trim();
    const code = String(packArg.code || packArg.id || '').trim().toLowerCase();
    const name = String(packArg.name || packArg.packName || '').trim().toLowerCase();
    return (
      packs.find((pack) => {
        if (remoteId && pack.id === remoteId) return true;
        if (code && String(pack.code || '').trim().toLowerCase() === code) return true;
        if (name && String(pack.name || '').trim().toLowerCase() === name) return true;
        return false;
      }) || null
    );
  }

  async function updatePackByAdminAsync(packId, patch) {
    requireRole([ROLES.MASTER]);

    const previousStore = getPackOverrideStore();
    const updatedLocal = updatePackByAdmin(packId, patch);
    const ctx = await resolveSupabaseContext().catch(() => null);
    if (!ctx) return updatedLocal;

    try {
      const current = getPackById(packId) || updatedLocal;
      const payload = {
        name: current.name,
        price: Number(current.price || 0),
        institution_limit: current.institutionLimit === 'unlimited' ? null : Number(current.institutionLimit || 0),
        is_unlimited: current.institutionLimit === 'unlimited' || current.isUnlimited === true,
        description: current.description || '',
        highlight: current.highlight || '',
        is_active: current.isActive !== false
      };

      const result = await ctx.client
        .from('application_packs')
        .update(payload)
        .eq('code', current.code || current.id)
        .select('id,code,name,price,institution_limit,is_unlimited,description,highlight,is_active,updated_at')
        .single();

      if (result.error) throw new Error(result.error.message || 'Could not update the package.');

      remotePackCache = safeArray(remotePackCache)
        .filter((item) => String(item?.code || item?.id || '') !== String(current.code || current.id))
        .concat(result.data || []);
      packCatalogCache = null;
      return getPackById(current.id) || updatedLocal;
    } catch (error) {
      savePackOverrideStore(previousStore);
      throw error;
    }
  }

  async function fetchRemotePromos(force = false) {
    if (!isSupabaseEnabled()) return [];
    if (remotePromoCache && !force) return clone(remotePromoCache);
    const client = initSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('promo_campaigns')
      .select('id,code,title,description,discount_kind,discount_value,offer_note,max_uses,used_count,redeemed_user_ids,is_active,share_path,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message || 'Could not load promo campaigns.');
    remotePromoCache = data || [];
    promoCatalogCache = null;
    return clone(remotePromoCache);
  }

  async function getPromoCampaignsAsync(force = false, optionsArg) {
    await fetchRemotePromos(force).catch(() => []);
    return getPromoCampaigns(optionsArg);
  }

  async function getPromoCodesForAdminAsync(force = false) {
    requireRole([ROLES.MASTER]);
    await fetchRemotePromos(force).catch(() => []);
    return getPromoCodesForAdmin();
  }

  async function getPromoCampaignByCodeAsync(codeArg, optionsArg) {
    await fetchRemotePromos().catch(() => []);
    return getPromoCampaignByCode(codeArg, optionsArg);
  }

  async function createPromoCampaignByAdminAsync(input) {
    requireRole([ROLES.MASTER]);

    const local = createPromoCampaignByAdmin(input);
    const ctx = await resolveSupabaseContext().catch(() => null);
    if (!ctx) return local;

    try {
      const current = getPromoCampaignByCode(local.code, { includeInactive: true }) || local;
      const payload = {
        code: current.code,
        title: current.title,
        description: current.description || '',
        discount_kind: current.discountKind,
        discount_value: Number(current.discountValue || 0),
        offer_note: current.offerNote || '',
        max_uses: Number(current.maxUses || 0),
        used_count: Number(current.usedCount || 0),
        redeemed_user_ids: current.redeemedUserIds || [],
        is_active: current.isActive !== false,
        share_path: current.sharePath || `signup.html?promo=${encodeURIComponent(current.code)}`
      };

      const result = await ctx.client
        .from('promo_campaigns')
        .upsert(payload, { onConflict: 'code' })
        .select('id,code,title,description,discount_kind,discount_value,offer_note,max_uses,used_count,redeemed_user_ids,is_active,share_path,created_at,updated_at')
        .single();

      if (result.error) throw new Error(result.error.message || 'Could not save the promo code.');

      remotePromoCache = safeArray(remotePromoCache)
        .filter((entry) => normalizePromoCodeValue(entry?.code) !== current.code)
        .concat(result.data || []);
      promoCatalogCache = null;
      return getPromoCampaignByCode(current.code, { includeInactive: true }) || local;
    } catch (error) {
      console.warn('Promo code saved locally because remote sync failed.', error);
      return local;
    }
  }

  async function updatePromoCampaignByAdminAsync(codeArg, patch) {
    requireRole([ROLES.MASTER]);

    const previousStore = getPromoOverrideStore();
    const local = updatePromoCampaignByAdmin(codeArg, patch);
    const ctx = await resolveSupabaseContext().catch(() => null);
    if (!ctx) return local;

    try {
      const current = getPromoCampaignByCode(local.code, { includeInactive: true }) || local;
      const result = await ctx.client
        .from('promo_campaigns')
        .upsert({
          code: current.code,
          title: current.title,
          description: current.description || '',
          discount_kind: current.discountKind,
          discount_value: Number(current.discountValue || 0),
          offer_note: current.offerNote || '',
          max_uses: Number(current.maxUses || 0),
          used_count: Number(current.usedCount || 0),
          redeemed_user_ids: current.redeemedUserIds || [],
          is_active: current.isActive !== false,
          share_path: current.sharePath || `signup.html?promo=${encodeURIComponent(current.code)}`
        }, { onConflict: 'code' })
        .select('id,code,title,description,discount_kind,discount_value,offer_note,max_uses,used_count,redeemed_user_ids,is_active,share_path,created_at,updated_at')
        .single();

      if (result.error) throw new Error(result.error.message || 'Could not update the promo code.');

      remotePromoCache = safeArray(remotePromoCache)
        .filter((entry) => normalizePromoCodeValue(entry?.code) !== current.code)
        .concat(result.data || []);
      promoCatalogCache = null;
      return getPromoCampaignByCode(current.code, { includeInactive: true }) || local;
    } catch (error) {
      console.warn('Promo code update stayed local because remote sync failed.', error);
      savePromoOverrideStore(getPromoOverrideStore());
      return local;
    }
  }

  async function deletePromoCampaignByAdminAsync(codeArg) {
    requireRole([ROLES.MASTER]);

    const code = normalizePromoCodeValue(codeArg);
    deletePromoCampaignByAdmin(code);
    const ctx = await resolveSupabaseContext().catch(() => null);
    if (!ctx) return true;

    try {
      const result = await ctx.client.from('promo_campaigns').delete().eq('code', code);
      if (result.error) throw new Error(result.error.message || 'Could not delete the promo code.');
      remotePromoCache = safeArray(remotePromoCache).filter((entry) => normalizePromoCodeValue(entry?.code) !== code);
      promoCatalogCache = null;
      return true;
    } catch (error) {
      console.warn('Promo code delete stayed local because remote sync failed.', error);
      return true;
    }
  }

  function markPromoCampaignRedeemed(codeArg, userIdArg) {
    const userId = String(userIdArg || requireRole([ROLES.USER]).id || '').trim();
    const code = normalizePromoCodeValue(codeArg);
    const current = getPromoCampaignByCode(code, { includeInactive: true });
    if (!current || !userId) return current;
    if (safeArray(current.redeemedUserIds).includes(userId)) return current;
    return updatePromoCampaignByAdmin(code, {
      redeemedUserIds: safeArray(current.redeemedUserIds).concat(userId),
      usedCount: Math.max(Number(current.usedCount || 0) + 1, safeArray(current.redeemedUserIds).length + 1)
    });
  }

  async function markPromoCampaignRedeemedAsync(codeArg, userIdArg) {
    const userId = String(userIdArg || requireRole([ROLES.USER]).id || '').trim();
    const local = markPromoCampaignRedeemed(codeArg, userId);
    const ctx = await resolveSupabaseContext().catch(() => null);
    if (!ctx || !local) return local;

    try {
      const result = await ctx.client
        .from('promo_campaigns')
        .update({
          redeemed_user_ids: safeArray(local.redeemedUserIds),
          used_count: Number(local.usedCount || safeArray(local.redeemedUserIds).length)
        })
        .eq('code', local.code);
      if (result.error) throw new Error(result.error.message || 'Could not update promo redemption.');
      await fetchRemotePromos(true).catch(() => []);
      return getPromoCampaignByCode(local.code, { includeInactive: true }) || local;
    } catch (error) {
      console.warn('Promo redemption stayed local because remote sync failed.', error);
      return local;
    }
  }

  async function getOrCreateRemoteCart(userIdArg) {
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return null;

    let query = await ctx.client.from('carts').select('*').eq('user_id', ctx.targetRemoteId).maybeSingle();
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local cart because the remote cart lookup is unavailable.', query.error);
        return null;
      }
      throw new Error(query.error.message || 'Could not load cart.');
    }

    let cart = query.data || null;
    if (!cart) {
      let created = await ctx.client.from('carts').insert({ user_id: ctx.targetRemoteId }).select('*').single();
      if (created.error && isCartUserForeignKeyError(created.error)) {
        const profileSnapshot = await getRemoteProfileSnapshot(ctx.targetRemoteId, ctx.client).catch(() => null);
        if (!profileSnapshot?.id && String(ctx.targetLocalUser?.supabaseUserId || '').trim() === String(ctx.targetRemoteId || '').trim()) {
          await syncSupabaseProfile({
            ...ctx.targetLocalUser,
            supabaseUserId: ctx.targetRemoteId,
            source: 'supabase'
          }).catch((error) => {
            console.warn('Could not repair the missing live profile before creating the cart.', error);
          });
          created = await ctx.client.from('carts').insert({ user_id: ctx.targetRemoteId }).select('*').single();
        }
      }
      if (created.error) {
        if (isRecoverableRemoteSyncError(created.error) || isCartUserForeignKeyError(created.error)) {
          console.warn('Falling back to local cart because the remote cart creation is unavailable.', created.error);
          return null;
        }
        throw new Error(created.error.message || 'Could not create cart.');
      }
      cart = created.data;
    }

    return {
      ...ctx,
      cart
    };
  }

  async function syncRemoteCartTotal(cartId, userIdArg, itemsArg) {
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return 0;

    let rows = safeArray(itemsArg);
    if (!rows.length) {
      const snapshot = await ctx.client.from('cart_items').select('price,quantity').eq('cart_id', cartId);
      if (snapshot.error) throw new Error(snapshot.error.message || 'Could not refresh cart total.');
      rows = snapshot.data || [];
    }

    const total = rows.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const updated = await ctx.client.from('carts').update({ total_amount: total }).eq('id', cartId);
    if (updated.error) throw new Error(updated.error.message || 'Could not update cart total.');
    return total;
  }

  function normalizeRemoteCartItem(row) {
    const meta = row?.metadata && typeof row.metadata === 'object' ? clone(row.metadata) : {};
    const itemType = row?.item_type || meta.type || 'custom';
    return {
      ...meta,
      id: row?.id || meta.id || uid('cart'),
      clientKey: meta.clientKey || meta.id || row?.id || '',
      refId: row?.ref_id || meta.refId || '',
      type: itemType,
      name: row?.name || meta.name || meta.packName || meta.serviceName || 'Cart item',
      price: Number(row?.price ?? meta.price ?? meta.packPrice ?? meta.servicePrice ?? 0),
      quantity: Number(row?.quantity || meta.quantity || 1),
      createdAt: row?.created_at || meta.createdAt || nowISO(),
      syncState: 'synced'
    };
  }

  function sanitizePathPart(value) {
    return String(value || '')
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  function extensionFromMime(type) {
    const map = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    return map[String(type || '').toLowerCase()] || '';
  }

  function dataUrlToBlob(dataUrl, typeHint) {
    if (!dataUrl) return null;
    const parts = String(dataUrl).split(',');
    if (parts.length < 2) return null;
    const meta = parts[0];
    const content = parts[1];
    const match = /data:(.*?);base64/i.exec(meta);
    const mime = (match && match[1]) || typeHint || 'application/octet-stream';
    const binary = atob(content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  function guessDocumentType(fileName) {
    const name = String(fileName || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.doc')) return 'application/msword';
    if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return '';
  }

  function normalizeRemoteNotificationRow(row, localUserId) {
    return normalizeStoredNotificationEntry({
      id: row?.id || uid('noti'),
      userId: row?.user_id ? (localUserId || row.user_id) : 'all',
      title: row?.title || '',
      message: row?.message || '',
      type: row?.notification_type || 'info',
      read: !!row?.is_read,
      createdAt: row?.created_at || nowISO(),
      source: 'supabase'
    }, localUserId);
  }

  function normalizeStoredNotificationEntry(entryArg, fallbackUserId) {
    const entry = entryArg || {};
    const userIdValue = entry.userId ?? entry.user_id;
    const normalizedUserId =
      userIdValue === null || userIdValue === undefined || String(userIdValue).trim() === ''
        ? (fallbackUserId ? String(fallbackUserId).trim() : 'all')
        : String(userIdValue).trim();
    const createdAt = String(entry.createdAt || entry.created_at || nowISO()).trim() || nowISO();
    const updatedAt = String(entry.updatedAt || entry.updated_at || createdAt).trim() || createdAt;
    const type = String(entry.type || entry.notification_type || 'info').trim().toLowerCase() || 'info';
    return {
      id: String(entry.id || '').trim() || uid('noti'),
      userId: normalizedUserId || 'all',
      title: String(entry.title || '').trim() || 'Notification',
      message: String(entry.message || '').trim(),
      type,
      read: Boolean(entry.read ?? entry.is_read),
      createdAt,
      updatedAt,
      source: String(entry.source || '').trim() || 'local'
    };
  }

  function notificationIdentityKey(entryArg) {
    const entry = normalizeStoredNotificationEntry(entryArg);
    return [
      entry.userId,
      entry.type,
      entry.title.toLowerCase(),
      entry.message.toLowerCase()
    ].join('|');
  }

  function isRecentNotificationDuplicate(existingArg, incomingArg) {
    const existing = normalizeStoredNotificationEntry(existingArg);
    const incoming = normalizeStoredNotificationEntry(incomingArg);
    if (notificationIdentityKey(existing) !== notificationIdentityKey(incoming)) return false;
    const existingAt = new Date(existing.createdAt).getTime();
    const incomingAt = new Date(incoming.createdAt).getTime();
    if (!Number.isFinite(existingAt) || !Number.isFinite(incomingAt)) return false;
    return Math.abs(incomingAt - existingAt) <= 3 * 60 * 1000;
  }

  function normalizeNotificationStore(itemsArg) {
    const byId = new Map();
    const recentEntries = [];
    safeArray(itemsArg).forEach((item) => {
      const normalized = normalizeStoredNotificationEntry(item);
      const existingById = byId.get(normalized.id);
      if (existingById) {
        byId.set(normalized.id, {
          ...existingById,
          ...normalized,
          read: Boolean(existingById.read || normalized.read)
        });
        return;
      }

      const duplicate = recentEntries.find((entry) => isRecentNotificationDuplicate(entry, normalized));
      if (duplicate) {
        duplicate.read = Boolean(duplicate.read || normalized.read);
        duplicate.updatedAt = normalized.updatedAt || duplicate.updatedAt;
        if (new Date(normalized.createdAt).getTime() > new Date(duplicate.createdAt).getTime()) {
          duplicate.createdAt = normalized.createdAt;
        }
        return;
      }

      recentEntries.push(normalized);
      byId.set(normalized.id, normalized);
    });

    return [...byId.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 400)
      .map(clone);
  }

  function normalizeRemoteDocumentRow(row, localUserId, extraMeta) {
    return {
      id: row?.id || uid('doc'),
      userId: localUserId || row?.user_id || '',
      applicationId: extraMeta?.applicationId || row?.application_id || null,
      name: row?.file_name || 'Document',
      fileName: row?.file_name || 'Document',
      type: extraMeta?.type || guessDocumentType(row?.file_name),
      size: Number(extraMeta?.size || 0),
      dataUrl: extraMeta?.dataUrl || '',
      category: row?.document_type || 'general',
      fileUrl: row?.file_url || '',
      status: row?.status || STATUS.doc.PENDING,
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function normalizeRemoteSupportMessageRow(row, localThreadId, senderUser) {
    const senderRole = row?.sender_role || ROLES.USER;
    const senderName = senderUser?.fullName || (senderRole === ROLES.USER ? 'Learner' : senderRole === ROLES.MASTER ? 'Master Admin' : 'Kagie Support');
    return {
      id: row?.id || uid('msg'),
      threadId: localThreadId,
      senderId: row?.sender_id || '',
      senderRole,
      senderName,
      text: row?.message || '',
      createdAt: row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function normalizeRemoteCallbackRow(row, requesterUser) {
    return {
      id: row?.id || uid('call'),
      requesterId: requesterUser?.id || row?.user_id || '',
      requesterRole: requesterUser?.role || ROLES.USER,
      requesterName: requesterUser?.fullName || '',
      phone: row?.phone || '',
      preferredTime: row?.preferred_time || '',
      reason: row?.note || '',
      status: row?.status || STATUS.callback.PENDING,
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function normalizeRemoteUserRow(row) {
    const existing = getUsers().find((user) => (row?.id && user.supabaseUserId === row.id) || normalizeEmail(user.email) === normalizeEmail(row?.email));
    const normalizedRole = normalizeKagieRole(row?.role, existing?.role || ROLES.USER);
    const prefix = normalizedRole === ROLES.ASSISTANT ? 'assistant' : normalizedRole === ROLES.MASTER ? 'master' : 'user';
    const stableLocalId = row?.id ? `${prefix}_${String(row.id).replace(/[^a-z0-9_-]/gi, '')}` : uid(prefix);
    const localUser = {
      ...(existing || {}),
      id: existing?.id || stableLocalId,
      supabaseUserId: row?.id || existing?.supabaseUserId || '',
      fullName: row?.full_name || existing?.fullName || '',
      email: normalizeEmail(row?.email || existing?.email || ''),
      password: existing?.password || '',
      phone: row?.phone || existing?.phone || '',
      role: normalizedRole,
      profileImage: row?.profile_image || existing?.profileImage || '',
      source: 'supabase',
      profile: existing?.profile || {},
      createdAt: row?.created_at || existing?.createdAt || nowISO(),
      updatedAt: row?.updated_at || existing?.updatedAt || nowISO()
    };
    upsertLocalUser(localUser);
    return sanitizeUser(getUserById(localUser.id) || localUser);
  }

  function syncRemoteUsersFromProfiles(rows) {
    return safeArray(rows).map((row) => normalizeRemoteUserRow(row));
  }

  function normalizeRemoteApplicationNoteRow(row, authorUser) {
    return {
      id: row?.id || uid('note'),
      applicationId: row?.application_id || '',
      authorId: authorUser?.id || row?.author_id || '',
      authorName: authorUser?.fullName || row?.author_name || '',
      text: row?.note || '',
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function normalizeRemoteDocumentReviewRow(row, doc, reviewerUser) {
    return {
      id: row?.id || uid('rev'),
      docId: row?.document_id || doc?.id || '',
      userId: doc?.userId || '',
      reviewerId: reviewerUser?.id || row?.assistant_id || '',
      status: row?.status || STATUS.doc.PENDING,
      comment: row?.note || '',
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function normalizeRemoteAssistantActivityRow(row, assistantUser) {
    return {
      id: row?.id || uid('act'),
      assistantId: assistantUser?.id || row?.assistant_id || '',
      applicationId: row?.application_id || null,
      action: row?.action || 'unknown',
      details: row?.details || {},
      createdAt: row?.created_at || nowISO(),
      updatedAt: row?.updated_at || row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function getSupportTargetUserId(threadIdArg, fallbackUserId) {
    if (typeof threadIdArg === 'string') {
      const match = threadIdArg.match(/^support_(.+)$/);
      if (match?.[1]) return match[1];
    }
    return fallbackUserId || '';
  }

  function mirrorRemoteNotifications(items) {
    const existing = normalizeNotificationStore(read(KEYS.notifications, []));
    const byId = new Map(existing.map((item) => [item.id, item]));
    safeArray(items).forEach((item) => {
      const normalized = normalizeStoredNotificationEntry(item);
      const current = byId.get(normalized.id);
      byId.set(normalized.id, {
        ...(current || {}),
        ...clone(normalized),
        read: Boolean(current?.read || normalized.read)
      });
    });
    const merged = normalizeNotificationStore(Array.from(byId.values()));
    write(KEYS.notifications, merged);
    return merged.map(clone);
  }

  function mirrorRemoteDocuments(items, localUserIdArg) {
    const localUserId = localUserIdArg || currentUserRaw()?.id || '';
    const existing = read(KEYS.docs, []);
    const preserved = existing.filter((item) => item.userId !== localUserId);
    const merged = preserved.concat(safeArray(items).map((item) => ({ ...clone(item), userId: localUserId })));
    write(KEYS.docs, merged);
    return merged;
  }

  function mirrorRemoteSupportMessages(items, localThreadId) {
    const existing = read(KEYS.supportChats, []);
    const preserved = existing.filter((item) => item.threadId !== localThreadId);
    const merged = preserved.concat(safeArray(items).map((item) => ({ ...clone(item), threadId: localThreadId })));
    write(KEYS.supportChats, merged);
    return merged;
  }

  function mirrorRemoteCallRequests(items, localUserId) {
    const existing = read(KEYS.callRequests, []);
    const preserved = existing.filter((item) => item.requesterId !== localUserId);
    const merged = preserved.concat(safeArray(items).map((item) => ({ ...clone(item), requesterId: localUserId })));
    write(KEYS.callRequests, merged);
    return merged;
  }

  function mirrorRemoteNotes(items, applicationId) {
    const existing = read(KEYS.notes, []);
    const preserved = existing.filter((item) => item.applicationId !== applicationId);
    const merged = preserved.concat(safeArray(items).map((item) => clone(item)));
    write(KEYS.notes, merged);
    return merged;
  }

  function mirrorRemoteDocumentReviews(items, localUserId) {
    const existing = read(KEYS.docReviews, []);
    const preserved = existing.filter((item) => item.userId !== localUserId);
    const merged = preserved.concat(safeArray(items).map((item) => clone(item)));
    write(KEYS.docReviews, merged);
    return merged;
  }

  function mirrorRemoteAssistantActivity(items) {
    const existing = read(KEYS.assistantActivity, []);
    const byId = new Map(existing.map((item) => [item.id, item]));
    safeArray(items).forEach((item) => {
      byId.set(item.id, clone(item));
    });
    const merged = Array.from(byId.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    write(KEYS.assistantActivity, merged);
    return merged;
  }

  async function getOrCreateRemoteSupportThread(userIdArg) {
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return null;

    const found = await ctx.client
      .from('support_threads')
      .select('*')
      .eq('user_id', ctx.targetRemoteId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (found.error) {
        if (isRecoverableRemoteSyncError(found.error)) {
          console.warn('Falling back to local support thread because the remote thread query is unavailable.', found.error);
          return null;
        }
        throw new Error(found.error.message || 'Could not load support thread.');
      }

    let thread = found.data || null;
    if (!thread) {
      const created = await ctx.client
        .from('support_threads')
        .insert({ user_id: ctx.targetRemoteId, status: 'open' })
        .select('*')
        .single();
      if (created.error) {
        if (isRecoverableRemoteSyncError(created.error)) {
          console.warn('Falling back to local support thread because the remote thread creation is unavailable.', created.error);
          return null;
        }
        throw new Error(created.error.message || 'Could not create support thread.');
      }
      thread = created.data;
    }

    return {
      ...ctx,
      thread,
      localThreadId: getThreadIdForUser(ctx.targetLocalUser?.id || userIdArg || ctx.targetRemoteId)
    };
  }

  async function hydrateRemoteApplications(rows, userIdArg, profileArg) {
    const list = safeArray(rows);
    if (!list.length) return [];
    const client = initSupabaseClient();
    if (!client) return [];

    const appIds = uniqueNonEmptyStrings(list.map((item) => item?.id));
    const [marksResult, institutionsResult, paymentsResult, assignmentResult] = await Promise.all([
      fetchPagedRowsByIn(client, 'application_marks', '*', 'application_id', appIds),
      fetchPagedRowsByIn(client, 'application_institutions', '*', 'application_id', appIds),
      fetchPagedRowsByIn(client, 'payments', '*', 'application_id', appIds, { order: { column: 'created_at', ascending: false } }),
      fetchPagedRowsByIn(client, 'applications', 'id,assistant_id,assigned_by,assigned_at,assignment_status', 'id', appIds)
    ]);

    if (marksResult.error) throw new Error(marksResult.error.message || 'Could not load marks.');
    if (institutionsResult.error) throw new Error(institutionsResult.error.message || 'Could not load institutions.');
    if (paymentsResult.error) throw new Error(paymentsResult.error.message || 'Could not load payments.');
    if (assignmentResult.error && !isMissingAssignmentAuditColumnsError(assignmentResult.error)) {
      throw new Error(assignmentResult.error.message || 'Could not load assignment details.');
    }

    const marksByApp = new Map();
    (marksResult.data || []).forEach((mark) => {
      const bucket = marksByApp.get(mark.application_id) || [];
      bucket.push({
        id: mark.id,
        subject: mark.subject,
        percent: Number(mark.percent || 0),
        level: Number(mark.level || 0),
        createdAt: mark.created_at || nowISO(),
        updatedAt: mark.updated_at || mark.created_at || nowISO()
      });
      marksByApp.set(mark.application_id, bucket);
    });

    const institutionsByApp = new Map();
    (institutionsResult.data || []).forEach((institution) => {
      const bucket = institutionsByApp.get(institution.application_id) || [];
      bucket.push(mapRemoteInstitutionRow(institution));
      institutionsByApp.set(institution.application_id, bucket);
    });

    const paymentsByApp = new Map();
    (paymentsResult.data || []).forEach((payment) => {
      const bucket = paymentsByApp.get(payment.application_id) || [];
      bucket.push(payment);
      paymentsByApp.set(payment.application_id, bucket);
    });

    const assignmentByApp = new Map();
    if (!assignmentResult.error) {
      safeArray(assignmentResult.data).forEach((assignment) => {
        assignmentByApp.set(assignment.id, assignment || {});
      });
    }
    const assignedByUsers = await fetchRemoteUsersByIds(
      safeArray(assignmentResult.error ? [] : assignmentResult.data)
        .map((assignment) => assignment?.assigned_by)
        .filter(Boolean),
      client
    ).catch(() => []);
    const assignedByMap = new Map();
    assignedByUsers.forEach((user) => {
      assignedByMap.set(user.supabaseUserId, user);
    });

    return list.map((row) => {
      const resolvedProfile = profileArg instanceof Map
        ? (profileArg.get(row.user_id) || getUsers().find((user) => user.supabaseUserId === row.user_id) || {})
        : (profileArg || {});
      const localUserId = resolvedProfile?.id || getUsers().find((user) => user.supabaseUserId === row.user_id)?.id || row.user_id || userIdArg;
      const assignmentRow = assignmentByApp.get(row.id) || row || {};
      const localAssistantId = getUsers().find((user) => user.supabaseUserId === assignmentRow.assistant_id)?.id || assignmentRow.assistant_id || null;
      const resolvedAssignedBy = assignedByMap.get(assignmentRow.assigned_by)
        || getUsers().find((user) => user.supabaseUserId === assignmentRow.assigned_by)
        || null;
      const localExistingApp = getApplicationById(row.id) || null;
      const marks = safeArray(marksByApp.get(row.id));
      const institutions = safeArray(institutionsByApp.get(row.id));
      const paymentRow = safeArray(paymentsByApp.get(row.id))[0] || null;
      const paymentNote = parsePaymentNoteState(paymentRow?.note || row.payment_note || '');

      const app = {
        id: row.id,
        userId: localUserId,
        assistantId: localAssistantId,
        assignedAssistantId: localAssistantId || localExistingApp?.assignedAssistantId || null,
        assignedById: resolvedAssignedBy?.id || localExistingApp?.assignedById || assignmentRow.assigned_by || '',
        assignedByName: resolvedAssignedBy?.fullName || resolvedAssignedBy?.fullNames || localExistingApp?.assignedByName || '',
        assignedAt: assignmentRow.assigned_at || localExistingApp?.assignedAt || '',
        reassignedAt: localExistingApp?.reassignedAt || '',
        assignmentStatus: assignmentRow.assignment_status || localExistingApp?.assignmentStatus || (localAssistantId ? 'Assigned' : 'Unassigned'),
        applicant: resolvedProfile?.fullName || resolvedProfile?.fullNames || '',
        status: row.status || STATUS.application.DRAFT,
        paymentStatus: row.payment_status || STATUS.payment.PENDING,
        forms: {
          learner: profileToLearnerForm(resolvedProfile),
          parent: profileToParentForm(resolvedProfile),
          school: profileToSchoolForm(resolvedProfile),
          marks: { subjects: marks },
          portalAccess: safeArray(localExistingApp?.forms?.portalAccess)
            .map((entry, index) => normalizePortalAccessEntry(entry, index + 1))
            .filter(portalAccessHasData)
        },
        institutions,
        package: mapRemotePackage(row.package || null),
        services: safeArray(localExistingApp?.services).map(clone),
        payment: (paymentRow || row.payer_name || row.payment_reference)
          ? {
              payerName: paymentRow?.payer_name || row.payer_name || '',
              phone: paymentRow?.phone || row.payer_phone || '',
              reference: paymentRow?.reference || row.payment_reference || '',
              note: paymentNote.customerNote || '',
              method: paymentRow?.method || row.payment_method || '',
              amount: Number(paymentRow?.amount ?? row.payment_amount ?? 0),
              status: paymentRow?.status || row.payment_status || STATUS.payment.PENDING,
              verificationNote: paymentNote.verificationNote || '',
              rejectionReason: paymentNote.rejectionReason || '',
              proofDocumentId: paymentNote.proofDocumentId || '',
              proofFileName: paymentNote.proofFileName || '',
              proofUploadedAt: paymentNote.proofUploadedAt || '',
              reviewedAt: paymentNote.reviewedAt || '',
              verifiedAt: paymentNote.verifiedAt || '',
              gatewayProvider: paymentRow?.provider || paymentNote.gatewayProvider || '',
              gatewayCheckoutId: paymentRow?.gateway_checkout_id || paymentNote.gatewayCheckoutId || '',
              gatewayPaymentId: paymentRow?.gateway_payment_id || paymentNote.gatewayPaymentId || '',
              gatewayStatus: paymentRow?.gateway_status || paymentNote.gatewayStatus || '',
              currency: paymentRow?.currency || 'ZAR',
              paidAt: paymentRow?.paid_at || '',
              failureReason: paymentRow?.failure_reason || '',
              submittedAt: paymentRow?.created_at || row.submitted_at || null
            }
          : null,
        notes: [],
        timeline: [],
        createdAt: row.created_at || nowISO(),
        updatedAt: row.updated_at || row.created_at || nowISO(),
        submittedAt: row.submitted_at || null
      };

      app.timeline = buildRemoteTimeline(app);
      return app;
    });
  }

  function currentUserRaw() {
    const sessionUser = readSession(KEYS.current, null);
    if (sessionUser) return sessionUser;
    return read(KEYS.current, null);
  }

  function currentUser() {
    return sanitizeUser(currentUserRaw());
  }

  function setCurrentUser(user, options) {
    if (user) clearLogoutIntent();
    const persist = typeof options?.persist === 'boolean' ? options.persist : shouldRememberLogin();
    if (!user) {
      write(KEYS.current, null);
      writeSession(KEYS.current, null);
      writeSession(KEYS.activeSession, { active: false, updatedAt: Date.now() });
      return sanitizeUser(user);
    }
    const normalizedUser = normalizeUserRecord(user);
    if (persist) {
      write(KEYS.current, normalizedUser);
      writeSession(KEYS.current, null);
    } else {
      write(KEYS.current, null);
      writeSession(KEYS.current, normalizedUser);
    }
    writeSession(KEYS.activeSession, { active: true, updatedAt: Date.now() });
    return sanitizeUser(normalizedUser);
  }

  function getUsers() {
    return read(KEYS.users, []).map(normalizeUserRecord);
  }

  function saveUsers(users) {
    return write(KEYS.users, safeArray(users).map(normalizeUserRecord));
  }

  function sanitizeStoredUsers() {
    const users = getUsers();
    const cleaned = users.map((user) => {
      const next = normalizeUserRecord(user || {});
      if (next.profile) next.profile = sanitizeProfileObject(next.profile);
      return next;
    });
    saveUsers(cleaned);

    const current = currentUserRaw();
    if (current && current.profile) {
      setCurrentUser({
        ...current,
        profile: sanitizeProfileObject(current.profile)
      });
    }
  }

  function getAllApplications() {
    return read(KEYS.applications, []);
  }

  function saveAllApplications(apps) {
    return write(KEYS.applications, apps);
  }

  function cartKey(userId) {
    return `${KEYS.cartPrefix}${userId}`;
  }

  const LEGACY_MASTER_SEED = {
    id: 'master_seed',
    email: 'admin@kagie.app',
    password: '123456'
  };

  const MASTER_SEED_MIGRATION_EMAILS = [
    'kagisowitness79@gmail.com'
  ];

  const CURRENT_MASTER_SEED = {
    id: 'master_seed',
    fullName: 'Kagie Master Admin',
    email: 'masteradmin@kagie.app',
    password: 'Kagiso@05',
    role: ROLES.MASTER,
    phone: '',
    profileImage: '',
    profile: {},
    source: 'local'
  };

  function getMasterSeedIdentity(emailArg) {
    const normalizedEmail = normalizeEmail(emailArg);
    if (isMasterSeedMigrationEmail(normalizedEmail)) {
      return {
        ...CURRENT_MASTER_SEED,
        email: normalizedEmail
      };
    }
    return {
      ...CURRENT_MASTER_SEED
    };
  }

  function getSeedAdminDefaults() {
    return [
      {
        ...CURRENT_MASTER_SEED,
        createdAt: nowISO(),
        updatedAt: nowISO()
      }
    ];
  }

  function isMasterSeedMigrationEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return MASTER_SEED_MIGRATION_EMAILS.some((item) => normalizeEmail(item) === normalizedEmail);
  }

  function isReservedAdminEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return (
      normalizedEmail === normalizeEmail(CURRENT_MASTER_SEED.email) ||
      normalizedEmail === normalizeEmail(LEGACY_MASTER_SEED.email)
    );
  }

  function isDefaultSeedAdmin(user) {
    if (!user) return false;
    const normalizedEmail = normalizeEmail(user.email);
    const normalizedPassword = String(user.password || '');
    return (
      (user.id === 'assistant_seed' || user.id === 'master_seed') ||
      (
        (
          normalizedEmail === 'assistant@kagie.app' ||
          normalizedEmail === normalizeEmail(LEGACY_MASTER_SEED.email) ||
          normalizedEmail === normalizeEmail(CURRENT_MASTER_SEED.email) ||
          (String(user.role || '') === ROLES.MASTER && isMasterSeedMigrationEmail(normalizedEmail))
        ) &&
        (
          normalizedPassword === '123456' ||
          normalizedPassword === LEGACY_MASTER_SEED.password ||
          normalizedPassword === CURRENT_MASTER_SEED.password
        ) &&
        String(user.source || 'local') === 'local'
      )
    );
  }

  function purgeSeedAdminsForPublicSite() {
    if (shouldSeedLocalStaffAccounts()) return;
    const users = getUsers();
    const filtered = users.filter((user) => !isDefaultSeedAdmin(user));
    if (filtered.length !== users.length) saveUsers(filtered);

    const current = currentUserRaw();
    if (isDefaultSeedAdmin(current)) setCurrentUser(null);
  }

  function purgeLocalAssistantDrafts() {
    const users = getUsers();
    const localAssistantIds = users
      .filter((user) => user?.role === ROLES.ASSISTANT && String(user?.source || '').toLowerCase() === 'local')
      .map((user) => String(user.id || '').trim())
      .filter(Boolean);

    if (!localAssistantIds.length) return;

    localAssistantIds.forEach((assistantId) => clearAssistantReferencesLocally(assistantId));
    const filtered = users.filter((user) => !localAssistantIds.includes(String(user?.id || '').trim()));
    saveUsers(filtered);

    const current = currentUserRaw();
    if (current && localAssistantIds.includes(String(current.id || '').trim())) {
      setCurrentUser(null);
    }
  }

  function ensureSeedAdmins() {
    if (!shouldSeedLocalStaffAccounts()) return;
    const users = getUsers();
    let changed = false;

    getSeedAdminDefaults().forEach((seed) => {
      const existingIndex = users.findIndex((u) => {
        const normalizedEmail = normalizeEmail(u?.email);
        return (
          String(u?.id || '').trim() === seed.id ||
          normalizedEmail === normalizeEmail(seed.email) ||
          normalizedEmail === normalizeEmail(LEGACY_MASTER_SEED.email) ||
          isMasterSeedMigrationEmail(normalizedEmail)
        );
      });

      if (existingIndex === -1) {
        users.push(seed);
        changed = true;
        return;
      }

      const existing = users[existingIndex] || {};
      const next = {
        ...existing,
        ...seed,
        id: seed.id,
        role: seed.role,
        source: 'local',
        createdAt: existing.createdAt || seed.createdAt,
        updatedAt: nowISO()
      };

      if (JSON.stringify(existing) !== JSON.stringify(next)) {
        users[existingIndex] = next;
        changed = true;
      }
    });

    if (changed) saveUsers(users);

    const current = currentUserRaw();
    if (current && isDefaultSeedAdmin(current)) {
      const freshSeed = users.find((user) => String(user?.id || '').trim() === CURRENT_MASTER_SEED.id) || null;
      if (freshSeed) setCurrentUser(freshSeed);
    }
  }

  function ensureCurrentMasterSeedAccount() {
    ensureSeedAdmins();
    const normalizedSeedEmail = normalizeEmail(CURRENT_MASTER_SEED.email);
    const existing = getUsers().find((user) => {
      const userEmail = normalizeEmail(user?.email);
      return (
        String(user?.id || '').trim() === CURRENT_MASTER_SEED.id ||
        userEmail === normalizedSeedEmail ||
        userEmail === normalizeEmail(LEGACY_MASTER_SEED.email) ||
        isMasterSeedMigrationEmail(userEmail)
      );
    }) || null;

    const next = {
      ...(existing || {}),
      ...CURRENT_MASTER_SEED,
      id: CURRENT_MASTER_SEED.id,
      role: ROLES.MASTER,
      source: 'local',
      createdAt: existing?.createdAt || nowISO(),
      updatedAt: nowISO()
    };

    upsertLocalUser(next);
    return getUserById(CURRENT_MASTER_SEED.id) || getUserByEmail(CURRENT_MASTER_SEED.email) || next;
  }

  async function tryBootstrapCurrentMasterOnLive(emailArg, passwordArg) {
    const normalizedEmail = normalizeEmail(emailArg);
    const password = String(passwordArg || '');
    if (isLocalEnvironment()) return { attempted: false };
    const isCurrentMasterEmail = normalizedEmail === normalizeEmail(CURRENT_MASTER_SEED.email);
    const isMigrationMasterEmail = isMasterSeedMigrationEmail(normalizedEmail);
    if (!isCurrentMasterEmail && !isMigrationMasterEmail) return { attempted: false };
    if (password !== String(CURRENT_MASTER_SEED.password)) return { attempted: false };
    const masterSeed = getMasterSeedIdentity(normalizedEmail);

    const tryClientFallback = async (reasonArg) => {
      try {
        const signup = await signUpPrivilegedUserViaSupabase({
          fullName: masterSeed.fullName,
          email: masterSeed.email,
          password: masterSeed.password,
          phone: masterSeed.phone || '',
          role: ROLES.MASTER
        });
        if (signup?.pendingEmailConfirmation) {
          return {
            attempted: true,
            clientFallback: true,
            message: `Master admin account created. Confirm the email sent to ${masterSeed.email} before first login.`
          };
        }
        return {
          attempted: true,
          clientFallback: true,
          message: String(reasonArg || '').trim()
        };
      } catch (fallbackError) {
        return {
          attempted: true,
          message: fallbackError?.message || reasonArg || 'Could not prepare the live master admin account.'
        };
      }
    };

    const settings = getSettings();
    const endpoint = String(settings?.supabase?.adminBootstrapMasterEndpoint || '').trim();
    if (!endpoint) {
      return await tryClientFallback('Live master admin bootstrap is not configured on this site yet.');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: masterSeed.fullName,
          email: masterSeed.email,
          password: masterSeed.password,
          phone: masterSeed.phone || ''
        })
      });
      const rawBody = await response.text().catch(() => '');
      let payload = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch (_error) {
          payload = { message: String(rawBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
        }
      }

      if (!response.ok && response.status !== 409) {
        const message = payload?.message || payload?.error || response.statusText || 'Could not prepare the live master admin account.';
        if (isMissingSupabaseAdminConfigMessage(message)) {
          return await tryClientFallback(message);
        }
        return {
          attempted: true,
          message
        };
      }

      return {
        attempted: true,
        exists: response.status === 409,
        data: payload?.data || payload || true,
        message: response.status === 409 ? String(payload?.message || '').trim() : ''
      };
    } catch (error) {
      const message = error?.message || 'Could not prepare the live master admin account.';
      console.warn('Live master-admin bootstrap during login skipped:', message);
      if (isMissingSupabaseAdminConfigMessage(String(message))) {
        return await tryClientFallback(message);
      }
      return {
        attempted: true,
        message
      };
    }
  }

  function requireRole(allowedRoles) {
    const user = currentUser();
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!user) throw new Error('Please login first.');
    if (roles.length && !roles.includes(user.role)) throw new Error('You do not have access to this page.');
    return user;
  }

  function getUserByEmail(email) {
    return getUsers().find((u) => normalizeEmail(u.email) === normalizeEmail(email)) || null;
  }

  function isValidEmailAddress(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
  }

  function isMissingSupabaseAdminConfigMessage(messageArg) {
    return /supabase admin configuration is missing|live admin setup is not complete/i.test(String(messageArg || ''));
  }

  function isInvalidSupabaseCredentialsMessage(messageArg) {
    return /invalid login credentials|invalid_credentials/i.test(String(messageArg || ''));
  }

  function isSupabaseAuthNetworkMessage(messageArg) {
    return /failed to fetch|networkerror|network request failed|load failed|timeout|dns|could not reach/i.test(String(messageArg || ''));
  }

  function isSupabaseAuthKeyMessage(messageArg) {
    return /invalid api key|jwt|anon key|api key/i.test(String(messageArg || ''));
  }

  function describeLiveLocalAccountBlock(localUserArg) {
    const role = normalizeKagieRole(localUserArg?.role, ROLES.USER);
    if (role === ROLES.MASTER) {
      return 'This master admin account exists only in this browser from the old Kagie MVP storage. Open master-admin/bootstrap.html to create or repair the live Supabase master admin, then sign in again.';
    }
    if (role === ROLES.ASSISTANT) {
      return 'This assistant account exists only in this browser from the old Kagie MVP storage. Ask the live master admin to create the assistant account in the dashboard, then sign in again.';
    }
    return 'This account exists only on this device from the old Kagie MVP storage. Create the live Supabase account on signup.html, then sign in again.';
  }

  function shouldLogAuthDebug() {
    try {
      return localStorage.getItem('kagie_auth_debug') === '1';
    } catch (_error) {
      return false;
    }
  }

  function logAuthDebug(label, details) {
    if (!shouldLogAuthDebug()) return;
    try {
      console.info(`Kagie auth debug: ${label}`, details || {});
    } catch (_error) {
      // Debug logging must never block auth.
    }
  }

  function getUserBySupabaseId(supabaseUserId) {
    return getUsers().find((u) => String(u.supabaseUserId || '') === String(supabaseUserId || '')) || null;
  }

  function getUserByIdentity(idArg) {
    const id = String(idArg || '').trim();
    if (!id) return null;
    return getUserById(id) || getUserBySupabaseId(id) || null;
  }

  function getUserIdentityKeys(userArg) {
    if (!userArg) return [];
    return [
      String(userArg.id || '').trim(),
      String(userArg.supabaseUserId || '').trim(),
      normalizeEmail(userArg.email)
    ].filter(Boolean);
  }

  function userMatchesIdentity(userArg, referenceArg) {
    const reference = String(referenceArg || '').trim().toLowerCase();
    if (!reference) return false;
    return getUserIdentityKeys(userArg).some((key) => String(key || '').trim().toLowerCase() === reference);
  }

  function getAssistantScopedLearnerIdentitySetLocal(actorArg) {
    const actor = actorArg || currentUser();
    const allowed = new Set();
    if (!actor || actor.role !== ROLES.ASSISTANT) return allowed;

    const includeLearner = (userRefArg) => {
      const userRef = String(userRefArg || '').trim();
      if (!userRef) return;
      allowed.add(userRef.toLowerCase());
      const learner = getUserByIdentity(userRef) || { id: userRef };
      getUserIdentityKeys(learner).forEach((key) => {
        allowed.add(String(key || '').trim().toLowerCase());
      });
    };

    getApplicationsByAssistant(actor.id).forEach((app) => includeLearner(app?.userId));
    read(KEYS.callRequests, []).forEach((request) => {
      if (userMatchesIdentity(actor, request?.assignedAssistantId)) includeLearner(request?.requesterId);
    });

    return allowed;
  }

  async function loadAssistantAssignmentRowsAsync(ctxArg, assistantRemoteIdArg) {
    const ctx = ctxArg || await resolveSupabaseContext();
    const assistantRemoteId = assistantRemoteIdArg || ctx?.remoteSelfId || ctx?.targetRemoteId || '';
    if (!ctx?.client || !assistantRemoteId) return [];

    const preferred = await ctx.client
      .from('assistant_assignments')
      .select('*')
      .eq('assistant_admin_id', assistantRemoteId);
    if (!preferred.error) return safeArray(preferred.data);

    const fallback = await ctx.client
      .from('assignments')
      .select('*')
      .eq('assistant_admin_id', assistantRemoteId);
    if (!fallback.error) return safeArray(fallback.data);

    if (isRecoverableRemoteSyncError(preferred.error) || isRecoverableRemoteSyncError(fallback.error)) {
      console.warn('Assistant assignment lookup is falling back because one live assignment table is unavailable.', preferred.error || fallback.error);
      return [];
    }
    throw new Error(
      preferred.error?.message
      || fallback.error?.message
      || 'Could not load assistant assignments.'
    );
  }

  async function loadAssignedUserIdsForAssistantAsync(ctxArg, assistantRemoteIdArg) {
    const rows = await loadAssistantAssignmentRowsAsync(ctxArg, assistantRemoteIdArg);
    return safeArray(rows).map((row) => String(row?.user_id || '').trim()).filter(Boolean);
  }

  async function getAssistantScopedRemoteUserIds(ctxArg) {
    const ctx = ctxArg || await resolveSupabaseContext();
    if (!ctx?.viewer || ctx.viewer.role !== ROLES.ASSISTANT || !ctx.remoteSelfId) return [];

    return loadAssignedUserIdsForAssistantAsync(ctx, ctx.remoteSelfId);
  }

  async function getAssistantScopedLearnerIdentitySetAsync(ctxArg) {
    const ctx = ctxArg || await resolveSupabaseContext();
    if (!ctx?.viewer || ctx.viewer.role !== ROLES.ASSISTANT) return null;

    const allowed = getAssistantScopedLearnerIdentitySetLocal(ctx.viewer);
    const remoteUserIds = await getAssistantScopedRemoteUserIds(ctx);
    remoteUserIds.forEach((userId) => {
      const value = String(userId || '').trim();
      if (!value) return;
      allowed.add(value.toLowerCase());
      const learner = getUserBySupabaseId(value) || getUserById(value) || { id: value };
      getUserIdentityKeys(learner).forEach((key) => {
        allowed.add(String(key || '').trim().toLowerCase());
      });
    });
    return allowed;
  }

  function filterUsersForAssistantScope(usersArg, allowedIdentitySetArg) {
    const allowed = allowedIdentitySetArg instanceof Set ? allowedIdentitySetArg : new Set();
    return safeArray(usersArg).filter((user) => {
      const role = normalizeKagieRole(user?.role, String(user?.role || '').trim() || ROLES.USER);
      if (role !== ROLES.USER) {
        const viewerKeys = getUserIdentityKeys(currentUser());
        return getUserIdentityKeys(user).some((key) => viewerKeys.includes(key));
      }
      if (!allowed.size) return false;
      return getUserIdentityKeys(user).some((key) => allowed.has(String(key || '').trim().toLowerCase()));
    });
  }

  function mergeUniqueUsers(...lists) {
    const merged = [];
    lists.flat().filter(Boolean).forEach((userArg) => {
      const user = sanitizeUser(userArg);
      if (!user) return;
      const keys = getUserIdentityKeys(user);
      const index = merged.findIndex((existing) => {
        const existingKeys = getUserIdentityKeys(existing);
        return keys.some((key) => existingKeys.includes(key));
      });

      if (index === -1) {
        merged.push(user);
        return;
      }

      const current = merged[index];
      merged[index] = sanitizeUser({
        ...current,
        ...user,
        id: current.id || user.id,
        supabaseUserId: user.supabaseUserId || current.supabaseUserId || '',
        fullName: user.fullName || current.fullName || '',
        email: normalizeEmail(user.email || current.email || ''),
        phone: user.phone || current.phone || '',
        role: normalizeKagieRole(user.role, current.role || ROLES.USER)
      });
    });

    return merged.sort((left, right) => {
      const leftLabel = String(left?.fullName || left?.email || left?.id || '').trim().toLowerCase();
      const rightLabel = String(right?.fullName || right?.email || right?.id || '').trim().toLowerCase();
      return leftLabel.localeCompare(rightLabel, 'en-ZA');
    });
  }

  function getUserById(id) {
    return getUsers().find((u) => u.id === id) || null;
  }

  function upsertLocalUser(user) {
    const users = getUsers();
    const normalizedEmail = normalizeEmail(user?.email);
    const normalizedPhone = normalizePhoneNumber(user?.phone);
    const incomingSupabaseId = String(user?.supabaseUserId || '');
    const index = users.findIndex((u) => {
      if (u.id === user.id) return true;
      if (incomingSupabaseId && String(u.supabaseUserId || '') === incomingSupabaseId) return true;
      if (normalizedEmail && normalizeEmail(u.email) === normalizedEmail) return true;
      if (normalizedPhone && !normalizedEmail && String(u.source || '') === 'supabase') {
        return normalizePhoneNumber(u.phone) === normalizedPhone;
      }
      return false;
    });
    if (index >= 0) {
      users[index] = mergeDeep(users[index], user);
    } else {
      users.push(user);
    }
    saveUsers(users);
    return sanitizeUser(user);
  }

  async function syncSupabaseProfile(localUser) {
    const settings = getSettings();
    if (!settings.supabase.syncProfiles || !isSupabaseEnabled()) return null;
    const client = initSupabaseClient(settings.supabase);
    if (!client) return null;

    try {
      const payload = {
        id: localUser.supabaseUserId || localUser.id,
        email: localUser.email,
        full_name: localUser.fullName,
        phone: localUser.phone || '',
        role: localUser.role,
        profile_image: localUser.profileImage || '',
        updated_at: nowISO()
      };
      let { data, error } = await client.from(settings.supabase.profileTable).upsert(payload).select().maybeSingle();
      if (error && isProfileSchemaCacheColumnError(error)) {
        ({ data, error } = await client
          .from(settings.supabase.profileTable)
          .upsert({
            id: localUser.supabaseUserId || localUser.id,
            full_name: localUser.fullName,
            role: localUser.role,
            profile_image: localUser.profileImage || '',
            updated_at: nowISO()
          })
          .select()
          .maybeSingle());
      }
      if (error) {
        console.warn('Supabase profile sync failed:', error.message || error);
        return null;
      }
      return data || null;
    } catch (err) {
      console.warn('Supabase profile sync error:', err);
      return null;
    }
  }

  function buildLocalUserFromSupabaseAuth(authUser, remoteProfile, fallbackUser) {
    const fallback = fallbackUser || {};
    const email = normalizeEmail(remoteProfile?.email || authUser?.email || fallback.email || '');
    const phone = normalizePhoneNumber(remoteProfile?.phone || authUser?.phone || fallback.phone || '');
    const authRole = normalizeKagieRole(
      remoteProfile?.role ||
      authUser?.app_metadata?.role ||
      authUser?.user_metadata?.role ||
      authUser?.role ||
      fallback.role ||
      ROLES.USER
    , ROLES.USER);
    const fullName = String(
      remoteProfile?.full_name ||
      authUser?.user_metadata?.full_name ||
      fallback.fullName ||
      email ||
      phone ||
      'Kagie user'
    ).trim();

    return {
      id: fallback.id || uid('user'),
      supabaseUserId: authUser.id,
      fullName,
      email,
      password: String(fallback.password || ''),
      phone,
      role: authRole,
      profileImage: remoteProfile?.profile_image || fallback.profileImage || '',
      source: 'supabase',
      profile: sanitizeProfileObject(fallback.profile || {}),
      createdAt: fallback.createdAt || nowISO(),
      updatedAt: nowISO()
    };
  }

  async function getLiveAuthRoleSnapshot(authUser, sessionArg) {
    const settings = getSettings();
    const endpoint = String(settings?.supabase?.authRoleEndpoint || '').trim();
    if (!endpoint || !authUser?.id) return null;
    const cachedSession = read(KEYS.supabaseSessionCache, null);
    const accessToken = String(sessionArg?.access_token || cachedSession?.access_token || '').trim();
    if (!accessToken) return null;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || payload?.error || 'Could not verify the Kagie account role.';
      if (response.status === 401 || response.status === 403) throw new Error(message);
      console.warn('Live auth role lookup skipped:', message);
      return null;
    }
    return payload?.data || payload || null;
  }

  async function materializeSupabaseUser(authUser, fallbackUserArg, sessionArg) {
    if (!authUser?.id) return null;

    const fallbackUser = fallbackUserArg || {};
    const liveRoleSnapshot = await getLiveAuthRoleSnapshot(authUser, sessionArg).catch((error) => {
      const message = String(error?.message || '');
      if (/inactive|disabled|permission|missing|token|session/i.test(message)) throw error;
      console.warn('Live auth role lookup skipped:', error);
      return null;
    });
    const remoteProfileSnapshot = liveRoleSnapshot?.profile || await getRemoteProfileSnapshot(authUser.id).catch(() => null);
    const remoteProfile = liveRoleSnapshot ? {
      ...(remoteProfileSnapshot || {}),
      id: liveRoleSnapshot.supabaseUserId || liveRoleSnapshot.id || authUser.id,
      email: liveRoleSnapshot.email || remoteProfileSnapshot?.email || authUser.email || '',
      full_name: liveRoleSnapshot.fullName || remoteProfileSnapshot?.full_name || authUser?.user_metadata?.full_name || '',
      phone: liveRoleSnapshot.phone || remoteProfileSnapshot?.phone || authUser?.user_metadata?.phone || '',
      role: normalizeKagieRole(liveRoleSnapshot.role, remoteProfileSnapshot?.role || ROLES.USER)
    } : remoteProfileSnapshot;
    const existing =
      getUserBySupabaseId(authUser.id) ||
      getUserByEmail(remoteProfile?.email || authUser?.email || fallbackUser.email || '') ||
      null;

    const merged = buildLocalUserFromSupabaseAuth(authUser, remoteProfile, existing ? {
      ...existing,
      ...fallbackUser
    } : fallbackUser);

    upsertLocalUser(merged);

    if (!existing && merged.role === ROLES.USER) {
      ensureDraft(merged.id);
      pushNotification(merged.id, 'Welcome to Kagie', 'Your account is ready. Start your application journey.', 'success');
    }

    return getUserBySupabaseId(authUser.id) || getUserByEmail(merged.email) || merged;
  }

  async function registerUser(payload) {
    await awaitRuntimeSupabaseConfig();
    ensureSeedAdmins();
    const users = getUsers();

    const fullName = String(payload?.fullName || payload?.name || '').trim();
    const email = normalizeEmail(payload?.email);
    const password = String(payload?.password || '');
    const phone = String(payload?.phone || '').trim();
    const role = payload?.role || ROLES.USER;

    if (!fullName) throw new Error('Full name is required.');
    if (!email) throw new Error('Email is required.');
    if (role === ROLES.USER && isReservedAdminEmail(email)) {
      throw new Error(`That email is reserved for Kagie admin access. Use a different learner email, or sign in as master admin with ${CURRENT_MASTER_SEED.email}.`);
    }
    if (!password || password.length < 4) throw new Error('Password must be at least 4 characters.');
    if (users.some((u) => normalizeEmail(u.email) === email)) throw new Error('An account with this email already exists.');

    let supabaseUserId = '';
    let source = 'local';

    if (role === ROLES.USER && isSupabaseEnabled()) {
      const client = initSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role
          }
        }
      });
      if (error) throw new Error(error.message || 'Supabase signup failed.');
      supabaseUserId = data?.user?.id || '';
      source = 'supabase';
      write(KEYS.supabaseSessionCache, data?.session || null);
    }

    const user = {
      id: uid('user'),
      supabaseUserId,
      fullName,
      email,
      password,
      phone,
      role,
      profileImage: '',
      source,
      profile: {
        firstName: payload?.firstName || '',
        lastName: payload?.lastName || '',
        idNumber: payload?.idNumber || '',
        gender: payload?.gender || '',
        dob: payload?.dob || '',
        homeAddress: payload?.homeAddress || '',
        postalCode: payload?.postalCode || '',
        schoolName: payload?.schoolName || '',
        grade: payload?.grade || ''
      },
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    users.push(user);
    saveUsers(users);
    setCurrentUser(user);
    ensureDraft(user.id);
    pushNotification(user.id, 'Welcome to Kagie', 'Your account was created successfully.', 'success');
    await syncSupabaseProfile(user);
    if (payload?.dob || payload?.schoolName) {
      await saveProfileAsync(user.id, {
        fullName,
        email,
        phone,
        dob: payload?.dob || '',
        schoolName: payload?.schoolName || ''
      }).catch((error) => {
        console.warn('Signup profile detail sync skipped:', error);
      });
    }
    return sanitizeUser(user);
  }

  async function login(email, password, options) {
    await awaitRuntimeSupabaseConfig();
    ensureSeedAdmins();
    const persist = typeof options?.persist === 'boolean' ? options.persist : shouldRememberLogin();
    setLoginPersistence(persist);
    const normalized = normalizeEmail(email);
    const liveMode = !isLocalEnvironment();
    const tryingLiveMasterSeed = liveMode
      && normalized === normalizeEmail(CURRENT_MASTER_SEED.email)
      && String(password) === String(CURRENT_MASTER_SEED.password);
    if (
      !liveMode &&
      normalized === normalizeEmail(CURRENT_MASTER_SEED.email) &&
      String(password) === String(CURRENT_MASTER_SEED.password)
    ) {
      const forcedMaster = ensureCurrentMasterSeedAccount();
      clearCachedSupabaseSessionTokens();
      setCurrentUser(forcedMaster, { persist });
      return sanitizeUser(forcedMaster);
    }

    const localMatch = getUsers().find(
      (u) => normalizeEmail(u.email) === normalized && String(u.password) === String(password)
    ) || null;

    if (
      !liveMode &&
      localMatch &&
      (localMatch.role === ROLES.ASSISTANT || localMatch.role === ROLES.MASTER)
    ) {
      clearCachedSupabaseSessionTokens();
      setCurrentUser(localMatch, { persist });
      return sanitizeUser(localMatch);
    }

    let found = null;
    let bootstrapAttempt = { attempted: false };
    let signInError = null;

    if (liveMode) {
      bootstrapAttempt = await tryBootstrapCurrentMasterOnLive(normalized, password);
    }

    if (isSupabaseEnabled()) {
      try {
        const client = initSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({ email: normalized, password: String(password) });
        signInError = error || null;
        logAuthDebug('password sign-in result', {
          userExists: Boolean(data?.user),
          sessionExists: Boolean(data?.session),
          errorMessage: error?.message || ''
        });
        if (!error && data?.user) {
        found = await materializeSupabaseUser(data.user, {
          password: String(password),
          email: normalized
        }, data?.session || null);
        write(KEYS.supabaseSessionCache, data?.session || null);
      }
      } catch (error) {
        signInError = error;
        logAuthDebug('password sign-in exception', {
          errorMessage: error?.message || String(error || '')
        });
      }
    } else {
      logAuthDebug('supabase not enabled for login', {
        liveMode,
        hasLocalMatch: Boolean(localMatch)
      });
    }

    if (!found && !liveMode) {
      found = localMatch;
    }

    if (!found) {
      const signInMessage = String(signInError?.message || '').trim();
      if (liveMode && localMatch) {
        throw new Error(describeLiveLocalAccountBlock(localMatch));
      }
      if (liveMode && !isSupabaseEnabled()) {
        throw new Error('Supabase authentication is not configured on this Vercel deployment. Check SUPABASE_URL and SUPABASE_ANON_KEY in Vercel, then redeploy.');
      }
      if (isMissingSupabaseAdminConfigMessage(signInMessage)) {
        throw new Error('This live site still needs final admin setup. Add SUPABASE_SERVICE_ROLE_KEY to the server environment, then try again.');
      }
      if (isSupabaseAuthNetworkMessage(signInMessage)) {
        throw new Error('Kagie could not reach Supabase Auth from this site. Use the Vercel app URL for testing and check the custom domain/DNS plus SUPABASE_URL.');
      }
      if (isSupabaseAuthKeyMessage(signInMessage)) {
        throw new Error('Supabase rejected this site configuration. Check that Vercel uses the anon key from the same Supabase project as SUPABASE_URL, then redeploy.');
      }
      if (/email.*confirm|email_not_confirmed/i.test(signInMessage)) {
        throw new Error('Check your email and confirm your Kagie account before logging in.');
      }
      if (tryingLiveMasterSeed) {
        if (signInMessage) {
          if (isMissingSupabaseAdminConfigMessage(bootstrapAttempt?.message)) {
            throw new Error('Live master admin setup is not complete on this site yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment or open master-admin/bootstrap.html once, then try again.');
          }
          throw new Error(signInMessage);
        }
        throw new Error(
          isMissingSupabaseAdminConfigMessage(bootstrapAttempt?.message)
            ? 'Live master admin setup is not complete on this site yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment or open master-admin/bootstrap.html once, then try again.'
            : bootstrapAttempt?.message ||
          'Live master admin could not sign in. Open master-admin/bootstrap.html once, or add the Supabase admin environment variables on the server first.'
        );
      }
      if (signInMessage && !isInvalidSupabaseCredentialsMessage(signInMessage)) {
        throw new Error(signInMessage);
      }
      throw new Error('Invalid email or password.');
    }
    setCurrentUser(found, { persist });
    return sanitizeUser(found);
  }

  async function signInWithOAuthProvider(provider, options) {
    if (!isSupabaseEnabled()) throw new Error('Supabase authentication is not configured.');
    if (typeof options?.persist === 'boolean') {
      setLoginPersistence(options.persist);
    }
    const client = initSupabaseClient();
    const settings = options || {};
    const redirectTo = getAuthRedirectUrl(settings.redirectTo || window.location.pathname.split('/').pop() || 'login.html');
    const authOptions = {
      redirectTo
    };
    if (settings.queryParams) authOptions.queryParams = settings.queryParams;
    if (settings.scopes) authOptions.scopes = settings.scopes;
    if (typeof settings.skipBrowserRedirect === 'boolean') authOptions.skipBrowserRedirect = settings.skipBrowserRedirect;

    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: authOptions
    });
    if (error) throw new Error(error.message || `Could not sign in with ${provider}.`);
    return data || null;
  }

  async function signInWithGoogle(options) {
    const nextOptions = {
      ...(options || {}),
      queryParams: {
        prompt: 'select_account',
        ...(options?.queryParams || {})
      }
    };
    return signInWithOAuthProvider('google', nextOptions);
  }

  async function signInWithApple(options) {
    return signInWithOAuthProvider('apple', {
      ...(options || {}),
      scopes: options?.scopes || 'name email'
    });
  }

  async function requestPasswordReset(email, options) {
    const normalized = normalizeEmail(email);
    if (!normalized) throw new Error('Enter a valid email address.');

    if (isSupabaseEnabled()) {
      const client = initSupabaseClient();
      const redirectTo = getAuthRedirectUrl(options?.redirectTo || 'changepassword.html');
      const { data, error } = await client.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) throw new Error(error.message || 'Could not send the password reset email.');
      return data || { email: normalized };
    }

    const localUser = getUserByEmail(normalized);
    if (!localUser) throw new Error('No account found with that email.');
    return { email: normalized, localOnly: true };
  }

  async function updateAuthenticatedPassword(newPassword) {
    const password = String(newPassword || '');
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    if (isSupabaseEnabled()) {
      const client = initSupabaseClient();
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message || 'Could not update your password.');
      const authUser = data?.user || (await getSupabaseVerifiedUser().catch(() => null));
      const localUser = authUser ? await materializeSupabaseUser(authUser) : currentUserRaw();
      if (localUser) {
        upsertLocalUser({
          ...localUser,
          password,
          updatedAt: nowISO()
        });
        setCurrentUser({
          ...localUser,
          password,
          updatedAt: nowISO()
        });
      }
      return sanitizeUser(localUser || currentUserRaw());
    }

    const active = currentUserRaw();
    if (!active) throw new Error('Please login first.');
    const updated = {
      ...active,
      password,
      updatedAt: nowISO()
    };
    upsertLocalUser(updated);
    setCurrentUser(updated);
    return sanitizeUser(updated);
  }

  async function sendPhoneOtp(phone, options) {
    if (!isSupabaseEnabled()) throw new Error('Supabase authentication is not configured.');
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) throw new Error('Enter a valid phone number.');
    const client = initSupabaseClient();
    const request = {
      phone: normalizedPhone,
      options: {
        shouldCreateUser: options?.shouldCreateUser !== false,
        data: {
          role: options?.role || ROLES.USER,
          full_name: String(options?.fullName || '').trim()
        }
      }
    };
    if (options?.captchaToken) request.options.captchaToken = options.captchaToken;
    if (options?.channel) request.options.channel = options.channel;
    const { data, error } = await client.auth.signInWithOtp(request);
    if (error) throw new Error(error.message || 'Could not send the verification code.');
    return {
      ...(data || {}),
      phone: normalizedPhone
    };
  }

  async function verifyPhoneOtp(phone, token, options) {
    if (!isSupabaseEnabled()) throw new Error('Supabase authentication is not configured.');
    const persist = typeof options?.persist === 'boolean' ? options.persist : shouldRememberLogin();
    setLoginPersistence(persist);
    const normalizedPhone = normalizePhoneNumber(phone);
    const code = String(token || '').trim();
    if (!normalizedPhone) throw new Error('Enter a valid phone number.');
    if (!code) throw new Error('Enter the verification code.');
    const client = initSupabaseClient();
    const { data, error } = await client.auth.verifyOtp({
      phone: normalizedPhone,
      token: code,
      type: 'sms'
    });
    if (error) throw new Error(error.message || 'Could not verify the code.');
    write(KEYS.supabaseSessionCache, data?.session || null);
    const localUser = await materializeSupabaseUser(data?.user || data?.session?.user, {
      phone: normalizedPhone
    }, data?.session || null);
    if (!localUser) throw new Error('Could not complete phone sign-in.');
    setCurrentUser(localUser, { persist });
    return sanitizeUser(localUser);
  }

  async function logout() {
    markLogoutIntent();
    setCurrentUser(null);
    try {
      setLoginPersistence(false);
    } catch (err) {
      console.warn('Could not reset login persistence during logout:', err);
    }
    clearCachedSupabaseSessionTokens();
    if (isSupabaseEnabled()) {
      try {
        await initSupabaseClient().auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut failed:', err);
      }
    }
    clearCachedSupabaseSessionTokens();
    try {
      localStorage.removeItem('kagie_current_user');
      sessionStorage.removeItem('kagie_current_user');
    } catch (err) {
      console.warn('Legacy logout storage cleanup failed:', err);
    }
    return true;
  }

  async function getSupabaseSession() {
    await awaitRuntimeSupabaseConfig();
    if (!isSupabaseEnabled()) return null;
    if (isLocalStaffSession(currentUserRaw())) return null;
    const client = initSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message || 'Could not get session.');
    write(KEYS.supabaseSessionCache, data?.session || null);
    return data?.session || null;
  }

  async function getSupabaseVerifiedUser() {
    await awaitRuntimeSupabaseConfig();
    if (!isSupabaseEnabled()) return null;
    if (isLocalStaffSession(currentUserRaw())) return null;
    const client = initSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(error.message || 'Could not get verified user.');
    return data?.user || null;
  }

  async function restoreSession() {
    await awaitRuntimeSupabaseConfig();
    const active = currentUserRaw();
    if (!isSupabaseEnabled()) return sanitizeUser(active);
    if (isLocalStaffSession(active)) return sanitizeUser(active);
    if (hasRecentLogoutIntent()) {
      setCurrentUser(null);
      return null;
    }

    let session = null;
    try {
      session = await getSupabaseSession();
    } catch (error) {
      if (active) {
        console.warn('Kagie session refresh fallback used:', error);
        return sanitizeUser(active);
      }
      throw error;
    }

    const supaUser = session?.user || null;
    if (!supaUser?.id) {
      const activeSession = getActiveSessionState();
      const sessionAgeMs = activeSession.updatedAt > 0 ? Date.now() - activeSession.updatedAt : Number.POSITIVE_INFINITY;
      const tabSessionStillActive =
        active &&
        activeSession.active &&
        sessionAgeMs >= 0 &&
        sessionAgeMs < 1000 * 60 * 60 * 12;
      const recentlySignedIn =
        tabSessionStillActive &&
        (active.supabaseUserId || String(active?.source || '').trim().toLowerCase() === 'supabase') &&
        sessionAgeMs < 20000;
      if (recentlySignedIn) {
        console.warn('Kagie session is still settling after login. Keeping the current signed-in account briefly.');
        return sanitizeUser(active);
      }
      if (tabSessionStillActive) {
        console.warn('Kagie kept the current tab session active while the remote auth session was temporarily unavailable.');
        return sanitizeUser(active);
      }
      if (active?.supabaseUserId || String(active?.source || '').trim().toLowerCase() === 'supabase') {
        setCurrentUser(null);
        return null;
      }
      return sanitizeUser(active);
    }

    if (!shouldRememberLogin() && !hasActiveSessionMarker()) {
      setCurrentUser(null);
      clearCachedSupabaseSessionTokens();
      return null;
    }

    const sameRemoteUser = active && String(active.supabaseUserId || '').trim() === String(supaUser.id).trim();
    const local = await materializeSupabaseUser(supaUser, sameRemoteUser ? active : null, session);
    setCurrentUser(local);
    return sanitizeUser(local);
  }

  async function resolveSessionUser(options) {
    const attempts = Math.max(0, Number(options?.attempts || 1));
    const delayMs = Math.max(80, Number(options?.delayMs || 220));
    let lastError = null;

    for (let attempt = 0; attempt <= attempts; attempt += 1) {
      const current = sanitizeUser(currentUserRaw());
      if (current) return current;

      try {
        const restored = await restoreSession();
        if (restored) return sanitizeUser(restored);
      } catch (error) {
        lastError = error;
        const fallbackCurrent = sanitizeUser(currentUserRaw());
        if (fallbackCurrent) return fallbackCurrent;
      }

      if (attempt < attempts) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, delayMs * (attempt + 1));
        });
      }
    }

    if (lastError) {
      console.warn('Kagie session resolution used its final local fallback:', lastError);
    }
    return sanitizeUser(currentUserRaw());
  }

  async function updateCurrentUserProfile(patch) {
    const active = currentUserRaw();
    if (!active) throw new Error('Please login first.');

    const users = getUsers();
    const index = users.findIndex((u) => u.id === active.id);
    if (index === -1) throw new Error('User account not found.');

    const updated = mergeDeep(users[index], { ...patch, updatedAt: nowISO() });

    if (patch?.email) {
      const newEmail = normalizeEmail(patch.email);
      const clash = users.some((u, i) => i !== index && normalizeEmail(u.email) === newEmail);
      if (clash) throw new Error('That email is already in use.');
      updated.email = newEmail;
    }

    users[index] = updated;
    saveUsers(users);
    setCurrentUser(updated);
    await syncSupabaseProfile(updated);
    return sanitizeUser(updated);
  }

  function buildDraft(userId) {
    return {
      id: uid('app'),
      userId,
      assistantId: null,
      status: STATUS.application.DRAFT,
      paymentStatus: STATUS.payment.PENDING,
      forms: {
        learner: {},
        parent: {},
        school: {},
        marks: { subjects: [] },
        portalAccess: []
      },
      institutions: [],
      package: null,
      services: [],
      payment: null,
      notes: [],
      timeline: [
        {
          id: uid('time'),
          title: 'Draft created',
          status: STATUS.application.DRAFT,
          createdAt: nowISO()
        }
      ],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      submittedAt: null
    };
  }

  function ensureDraft(userIdArg) {
    const user = userIdArg ? { id: userIdArg } : requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = user.id;
    const apps = getAllApplications();
    const existing = [...apps]
      .reverse()
      .find((app) => app.userId === userId && [STATUS.application.DRAFT, STATUS.application.MISSING_DOCUMENTS].includes(app.status));

    if (existing) return clone(existing);

    const draft = buildDraft(userId);
    apps.push(draft);
    saveAllApplications(apps);
    return clone(draft);
  }

  function getApplicationById(appId) {
    return normalizeStoredApplication(getAllApplications().find((a) => a.id === appId) || null);
  }

  function getLatestApplication(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const apps = getAllApplications()
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return normalizeStoredApplication(apps[0] || null);
  }

  function getApplicationsByUser(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    return getAllApplications()
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(normalizeStoredApplication);
  }

  function getApplicationsByAssistant(assistantIdArg) {
    const current = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const assistantId = String(assistantIdArg || current.id || '').trim();
    const assistant = getUserByIdentity(assistantId) || current;
    const assistantRefs = new Set([
      String(assistantId || '').trim(),
      String(assistant?.id || '').trim(),
      String(assistant?.supabaseUserId || '').trim()
    ].filter(Boolean));
    return getAllApplications()
      .filter((app) => assistantRefs.has(String(app.assistantId || app.assignedAssistantId || '').trim()))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(normalizeStoredApplication);
  }

  function getAllApplicationsForAdmin() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    if (actor.role === ROLES.ASSISTANT) return getApplicationsByAssistant(actor.id);
    return getAllApplications()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(normalizeStoredApplication);
  }

  function appendTimeline(app, title, status) {
    app.timeline = safeArray(app.timeline);
    app.timeline.unshift({
      id: uid('time'),
      title,
      status: status || app.status,
      createdAt: nowISO()
    });
  }

  function updateApplication(appId, patch) {
    const actingUser = currentUser();
    if (!actingUser) throw new Error('Please login first.');

    const apps = getAllApplications();
    const index = apps.findIndex((a) => a.id === appId);
    if (index === -1) throw new Error('Application not found.');

    const current = apps[index];
    if (actingUser.role === ROLES.USER && current.userId !== actingUser.id) {
      throw new Error('You can only edit your own application.');
    }

    if (Array.isArray(patch?.institutions)) {
      patch = {
        ...patch,
        institutions: safeArray(patch.institutions).map((institution) => {
          const matchedInstitution = ensureInstitutionAvailableForApplication(institution);
          return {
            ...institution,
            year: institution?.year || matchedInstitution?.year || String(new Date().getFullYear()),
            institutionStatus: matchedInstitution?.status || institution?.institutionStatus || '',
            canApply: matchedInstitution ? matchedInstitution.canApply : institution?.canApply
          };
        })
      };
    }

    let updated = mergeDeep(current, patch || {});
    if (actingUser.role === ROLES.ASSISTANT && !updated.assistantId) updated.assistantId = actingUser.id;
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'assistantId') || Object.prototype.hasOwnProperty.call(patch || {}, 'assignedAssistantId')) {
      const previousAssistantId = String(current?.assignedAssistantId || current?.assistantId || '').trim();
      const nextAssistantId = String(
        patch?.assignedAssistantId ?? patch?.assistantId ?? updated?.assignedAssistantId ?? updated?.assistantId ?? ''
      ).trim();
      const assignmentTimestamp = nowISO();
      if (nextAssistantId) {
        updated.assistantId = nextAssistantId;
        updated.assignedAssistantId = nextAssistantId;
        updated.assignedById = actingUser.id || updated.assignedById || '';
        updated.assignedByName = actingUser.fullName || actingUser.email || updated.assignedByName || '';
        updated.assignedAt = updated.assignedAt || assignmentTimestamp;
        if (previousAssistantId && previousAssistantId !== nextAssistantId) {
          updated.reassignedAt = assignmentTimestamp;
          updated.assignmentStatus = 'Reassigned';
        } else {
          updated.assignmentStatus = 'Assigned';
        }
      } else {
        updated.assistantId = null;
        updated.assignedAssistantId = null;
        updated.assignmentStatus = 'Unassigned';
      }
    }
    if (updated.payment || patch?.paymentStatus) {
      updated.payment = normalizePaymentDetails(updated.payment, patch?.paymentStatus || updated.paymentStatus || current.paymentStatus);
      if (updated.payment && patch?.paymentStatus) updated.payment.status = patch.paymentStatus;
    }

    if (patch?.status && patch.status !== current.status) appendTimeline(updated, `Status updated to ${patch.status}`, patch.status);
    if (patch?.paymentStatus && patch.paymentStatus !== current.paymentStatus) appendTimeline(updated, `Payment status updated to ${patch.paymentStatus}`, updated.status);

    updated.updatedAt = nowISO();
    apps[index] = updated;
    saveAllApplications(apps);

    if (patch?.status || patch?.paymentStatus) {
      let message = `Status: ${updated.status} | Payment: ${updated.paymentStatus}`;
      let type = 'info';
      if (patch?.paymentStatus && patch.paymentStatus !== current.paymentStatus) {
        if (updated.paymentStatus === STATUS.payment.REJECTED) {
          message = updated.payment?.rejectionReason
            ? `Your payment proof was rejected. Reason: ${updated.payment.rejectionReason}`
            : 'Your payment proof was rejected. Please upload a clearer proof of payment.';
          type = 'warning';
        } else if (updated.paymentStatus === STATUS.payment.VERIFIED) {
          message = 'Your payment has been verified successfully.';
          type = 'success';
        } else if (updated.paymentStatus === STATUS.payment.PENDING_VERIFICATION) {
          message = updated.payment?.proofUploadedAt
            ? 'Your proof of payment has been uploaded and is pending verification.'
            : 'Your payment is pending verification.';
        }
      }
      pushNotification(updated.userId, 'Application updated', message, type);
    }

    if (actingUser.role === ROLES.ASSISTANT || actingUser.role === ROLES.MASTER) {
      logAssistantActivity({
        assistantId: actingUser.id,
        applicationId: updated.id,
        action: 'update_application',
        details: { status: updated.status, paymentStatus: updated.paymentStatus }
      });
    }

    return normalizeStoredApplication(updated);
  }

  function saveFormSection(sectionName, data, appIdArg) {
    const user = requireRole([ROLES.USER]);
    const app = appIdArg ? getApplicationById(appIdArg) : ensureDraft(user.id);
    if (!app) throw new Error('Draft application not found.');

    const allowedSections = ['learner', 'parent', 'school', 'marks'];
    if (!allowedSections.includes(sectionName)) throw new Error(`Unknown form section: ${sectionName}`);

    const mergedForms = mergeDeep(app.forms || {}, { [sectionName]: data || {} });
    return updateApplication(app.id, { forms: mergedForms });
  }

  function addInstitutionToDraft(institution, appIdArg) {
    const user = requireRole([ROLES.USER]);
    const app = appIdArg ? getApplicationById(appIdArg) : ensureDraft(user.id);
    if (!app) throw new Error('Draft application not found.');
    const matchedInstitution = ensureInstitutionAvailableForApplication(institution);

    const entry = {
      id: institution?.id || uid('inst'),
      institutionName: institution?.institutionName || institution?.name || '',
      province: institution?.province || '',
      institutionType: institution?.institutionType || '',
      year: institution?.year || matchedInstitution?.year || String(new Date().getFullYear()),
      applicationFee: roundMoney(institution?.applicationFee ?? matchedInstitution?.applicationFee ?? 0),
      applicationFeeLabel: institution?.applicationFeeLabel || matchedInstitution?.applicationFeeLabel || '',
      applicationFeeNote: institution?.applicationFeeNote || matchedInstitution?.applicationFeeNote || '',
      institutionStatus: institution?.institutionStatus || matchedInstitution?.status || 'open',
      closingDate: institution?.closingDate || matchedInstitution?.closingDate || matchedInstitution?.applicationDeadline || '',
      faculty: institution?.faculty || '',
      choice1: institution?.choice1 || '',
      choice2: institution?.choice2 || '',
      choice3: institution?.choice3 || '',
      createdAt: nowISO()
    };

    const institutions = safeArray(app.institutions);
    institutions.push(entry);
    return updateApplication(app.id, { institutions });
  }

  function removeInstitutionFromDraft(institutionId, appIdArg) {
    const user = requireRole([ROLES.USER]);
    const app = appIdArg ? getApplicationById(appIdArg) : ensureDraft(user.id);
    if (!app) throw new Error('Draft application not found.');
    const institutions = safeArray(app.institutions).filter((item) => item.id !== institutionId);
    return updateApplication(app.id, { institutions });
  }

  function getCart(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    return read(cartKey(userId), []);
  }

  function saveCart(items, userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    return write(cartKey(userId), items || []);
  }

  function isPromoDiscountItem(item) {
    return !!(item && (item.isPromoDiscount || normalizePromoCodeValue(item.promoCode)));
  }

  function getCartItemsWithoutPromo(itemsArg) {
    return safeArray(itemsArg).filter((item) => !isPromoDiscountItem(item));
  }

  function getAppliedPromoFromCartItems(itemsArg) {
    const match = safeArray(itemsArg).find((item) => isPromoDiscountItem(item));
    if (!match) return null;
    const code = normalizePromoCodeValue(match.promoCode || match.code || match.id);
    return {
      code,
      title: String(match.promoTitle || match.title || match.name || `Promo ${code}`).trim(),
      offerNote: String(match.offerNote || '').trim(),
      discountAmount: roundMoney(Math.abs(Number(match.price || 0))),
      benefitLabel: String(match.benefitLabel || '').trim()
    };
  }

  function calculateCartSubtotal(itemsArg) {
    return roundMoney(getCartItemsWithoutPromo(itemsArg).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0));
  }

  function calculatePromoDiscountAmount(promoArg, itemsArg) {
    const promo = promoArg ? normalizePromoCampaignEntry(promoArg, 1) : null;
    const items = getCartItemsWithoutPromo(itemsArg);
    const subtotal = calculateCartSubtotal(items);
    if (!promo || subtotal <= 0) return 0;
    const leadPack = items.find((item) => item.type === 'application_pack') || null;

    let discount = 0;
    if (promo.discountKind === 'free_application_pack') {
      discount = Number(leadPack?.price || leadPack?.packPrice || 0);
    } else if (promo.discountKind === 'amount') {
      discount = Number(promo.discountValue || 0);
    } else {
      discount = subtotal * (Math.max(0, Number(promo.discountValue || 0)) / 100);
    }

    return roundMoney(Math.max(0, Math.min(subtotal, discount)));
  }

  function buildPromoDiscountCartItem(promoArg, discountAmount) {
    const promo = normalizePromoCampaignEntry(promoArg, 1);
    const discount = roundMoney(discountAmount);
    return {
      id: `promo_${promo.code.toLowerCase()}`,
      clientKey: `promo_${promo.code.toLowerCase()}`,
      type: 'custom',
      name: promo.title || `Promo ${promo.code}`,
      price: -discount,
      quantity: 1,
      isPromoDiscount: true,
      promoCode: promo.code,
      promoTitle: promo.title,
      offerNote: promo.offerNote,
      benefitLabel: getPromoBenefitLabel(promo),
      createdAt: nowISO()
    };
  }

  function getPromoValidationMessage(promoArg, userIdArg, itemsArg) {
    const promo = promoArg ? normalizePromoCampaignEntry(promoArg, 1) : null;
    const userId = String(userIdArg || '').trim();
    const items = getCartItemsWithoutPromo(itemsArg);
    if (!promo || promo.isActive === false) return 'That promo code is not active right now.';
    if (!items.length) return 'Add a package or service to cart before using a promo code.';
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses && !safeArray(promo.redeemedUserIds).includes(userId)) {
      return 'That promo code has already reached its usage limit.';
    }
    if (userId && safeArray(promo.redeemedUserIds).includes(userId)) {
      return 'That promo code has already been used on this account.';
    }
    if (promo.discountKind === 'free_application_pack' && !items.some((item) => item.type === 'application_pack')) {
      return 'That code only works when an application pack is already in your cart.';
    }
    if (calculatePromoDiscountAmount(promo, items) <= 0) {
      return 'That promo code does not match the items currently in your cart.';
    }
    return '';
  }

  function getCartPricingSummary(userIdArg, itemsArg) {
    const items = Array.isArray(itemsArg) ? clone(itemsArg) : getCart(userIdArg);
    const subtotal = calculateCartSubtotal(items);
    const appliedPromo = getAppliedPromoFromCartItems(items);
    const discount = roundMoney(appliedPromo?.discountAmount || 0);
    const total = roundMoney(Math.max(0, subtotal - discount));
    return {
      subtotal,
      discount,
      total,
      promo: appliedPromo
        ? {
            ...appliedPromo,
            code: normalizePromoCodeValue(appliedPromo.code),
            title: appliedPromo.title,
            offerNote: appliedPromo.offerNote,
            benefitLabel: appliedPromo.benefitLabel || getPromoBenefitLabel(getPromoCampaignByCode(appliedPromo.code, { includeInactive: true }) || appliedPromo)
          }
        : null
    };
  }

  function clearAppliedPromoCode(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const nextItems = getCartItemsWithoutPromo(getCart(userId));
    saveCart(nextItems, userId);
    return getCartPricingSummary(userId, nextItems);
  }

  function applyPromoCode(codeArg, userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const code = normalizePromoCodeValue(codeArg);
    const promo = getPromoCampaignByCode(code, { includeInactive: false });
    if (!promo) throw new Error('Promo code not found or inactive.');

    const baseItems = getCartItemsWithoutPromo(getCart(userId));
    const validationMessage = getPromoValidationMessage(promo, userId, baseItems);
    if (validationMessage) throw new Error(validationMessage);

    const discountAmount = calculatePromoDiscountAmount(promo, baseItems);
    const nextItems = baseItems.concat(buildPromoDiscountCartItem(promo, discountAmount));
    saveCart(nextItems, userId);
    savePendingPromoCode('');
    return getCartPricingSummary(userId, nextItems);
  }

  function syncAppliedPromoCode(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const currentItems = getCart(userId);
    const currentPromo = getAppliedPromoFromCartItems(currentItems);

    if (currentPromo?.code) {
      try {
        return applyPromoCode(currentPromo.code, userId);
      } catch (_error) {
        return clearAppliedPromoCode(userId);
      }
    }

    const pendingCode = getPendingPromoCode();
    if (pendingCode) {
      try {
        return applyPromoCode(pendingCode, userId);
      } catch (_error) {
        return getCartPricingSummary(userId, currentItems);
      }
    }

    return getCartPricingSummary(userId, currentItems);
  }

  function addCartItem(itemArg, userIdArg) {
    const item = typeof itemArg === 'string' ? userIdArg : itemArg;
    const userId = typeof itemArg === 'string' ? itemArg : userIdArg || requireRole([ROLES.USER]).id;
    const items = getCart(userId);
    const normalizedType = item?.type === 'service_request' ? 'service' : item?.type || 'custom';
    const itemId = String(item?.id || uid('cart')).trim();
    const clientKey = String(item?.clientKey || itemId).trim();
    const syncState = String(item?.syncState || (isSupabaseEnabled() ? 'local_only' : '')).trim();
    const finalItem = {
      ...(item || {}),
      id: itemId,
      clientKey,
      type: normalizedType,
      name: item?.name || item?.serviceName || item?.packName || item?.institutionName || 'Cart item',
      price: Number(item?.price ?? item?.packPrice ?? item?.servicePrice ?? 0),
      quantity: Number(item?.quantity || 1),
      createdAt: item?.createdAt || nowISO(),
      syncState
    };
    const matchKey = getCartMatchKey(finalItem);
    const nextItems = matchKey
      ? items.filter((entry) => getCartMatchKey(entry) !== matchKey)
      : items.slice();
    nextItems.push(finalItem);
    saveCart(nextItems, userId);
    return clone(finalItem);
  }

  function updateCartItem(itemId, patchArg, userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const patch = patchArg && typeof patchArg === 'object' ? clone(patchArg) : {};
    const items = getCart(userId);
    const index = items.findIndex((item) => String(item?.id || '') === String(itemId));
    if (index === -1) throw new Error('Cart item not found.');

    const current = clone(items[index]);
    const updated = {
      ...current,
      ...patch,
      id: current.id,
      clientKey: patch.clientKey || current.clientKey || current.id,
      type: patch.type || current.type || 'custom',
      name: patch.name || patch.serviceName || patch.packName || current.name || current.serviceName || current.packName || 'Cart item',
      price: Number(patch.price ?? current.price ?? current.packPrice ?? current.servicePrice ?? 0),
      quantity: Number(patch.quantity ?? current.quantity ?? 1),
      updatedAt: nowISO()
    };

    items[index] = updated;
    saveCart(items, userId);
    return clone(updated);
  }

  function removeCartItem(itemId, userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const items = getCart(userId).filter((item) => item.id !== itemId);
    saveCart(items, userId);
    return clone(items);
  }

  function clearCart(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    saveCart([], userId);
    return true;
  }

  function getCartTotal(userIdArg) {
    return getCartPricingSummary(userIdArg).total;
  }

  function buildPaymentProofState(app, proofDoc) {
    const currentPayment = normalizePaymentDetails(app?.payment, app?.paymentStatus) || {
      payerName: '',
      phone: '',
      reference: '',
      note: '',
      method: '',
      amount: 0,
      submittedAt: app?.submittedAt || nowISO()
    };
    const hasSubmittedPayment = Boolean(
      app?.submittedAt ||
      currentPayment.reference ||
      currentPayment.amount ||
      (app?.paymentStatus && app.paymentStatus !== STATUS.payment.PENDING)
    );
    const nextStatus = app?.paymentStatus === STATUS.payment.VERIFIED
      ? STATUS.payment.VERIFIED
      : hasSubmittedPayment
        ? STATUS.payment.PENDING_VERIFICATION
        : (app?.paymentStatus || STATUS.payment.PENDING);
    return {
      paymentStatus: nextStatus,
      payment: {
        ...currentPayment,
        status: nextStatus,
        proofDocumentId: proofDoc?.id || currentPayment.proofDocumentId || '',
        proofFileName: proofDoc?.name || proofDoc?.fileName || currentPayment.proofFileName || 'Proof of payment',
        proofUploadedAt: proofDoc?.updatedAt || proofDoc?.createdAt || nowISO(),
        rejectionReason: nextStatus === STATUS.payment.REJECTED ? currentPayment.rejectionReason || '' : '',
        reviewedAt: nextStatus === STATUS.payment.REJECTED ? currentPayment.reviewedAt || '' : '',
        verifiedAt: nextStatus === STATUS.payment.VERIFIED ? currentPayment.verifiedAt || nowISO() : ''
      }
    };
  }

  function linkPaymentProofToApplication(appIdArg, proofDoc, userIdArg) {
    const app = appIdArg ? getApplicationById(appIdArg) : getLatestApplication(userIdArg || proofDoc?.userId);
    if (!app || !proofDoc) return null;
    const next = buildPaymentProofState(app, proofDoc);
    const updated = updateApplication(app.id, next);
    pushNotification(updated.userId, 'Proof of payment uploaded', 'Your proof of payment was saved and sent for verification.', 'info');
    notifyStaffForApplicationEvent(updated, {
      title: 'Learner uploaded proof of payment',
      message: `${buildLearnerAlertMessage(updated, 'A learner')} uploaded proof of payment${updated.payment?.reference ? ` for reference ${updated.payment.reference}` : ''}. Open the payment review lane to verify it.`,
      type: 'warning'
    });
    return updated;
  }

  function submitApplicationFromCart(paymentData) {
    const user = requireRole([ROLES.USER]);
    const app = ensureDraft(user.id);
    const cart = getCart(user.id);
    const pricing = getCartPricingSummary(user.id, cart);
    const appliedPromo = pricing.promo || null;

    const packageItem = cart.find((item) => item.type === 'application_pack');
    const serviceItems = cart
      .filter((item) => item.type === 'service' || item.type === 'service_request')
      .map((item) => (isTransportServiceItem(item) ? decorateTransportServiceForManualBooking(item, paymentData) : clone(item)));
    const institutionItems = cart.filter((item) => item.type === 'institution');

    const institutions = [
      ...safeArray(app.institutions),
      ...institutionItems.map((item) => ({
        id: item.id || uid('inst'),
        institutionName: item.institutionName || item.name || '',
        province: item.province || '',
        institutionType: item.institutionType || '',
        faculty: item.faculty || '',
        choice1: item.choice1 || '',
        choice2: item.choice2 || '',
        choice3: item.choice3 || '',
        createdAt: item.createdAt || nowISO()
      }))
    ];

    const submittedPayment = normalizePaymentDetails({
      payerName: paymentData?.payerName || '',
      phone: paymentData?.phone || '',
      reference: paymentData?.reference || '',
      note: paymentData?.note || '',
      method: paymentData?.method || '',
      amount: pricing.total,
      promoCode: appliedPromo?.code || '',
      promoTitle: appliedPromo?.title || '',
      offerNote: appliedPromo?.offerNote || '',
      discountAmount: pricing.discount,
      submittedAt: nowISO(),
      status: STATUS.payment.PENDING_VERIFICATION
    }, STATUS.payment.PENDING_VERIFICATION);

    const updated = updateApplication(app.id, {
      institutions,
      package: packageItem || app.package || null,
      services: serviceItems,
      payment: submittedPayment,
      status: STATUS.application.PROCESSING,
      paymentStatus: STATUS.payment.PENDING_VERIFICATION,
      submittedAt: nowISO()
    });
    const transportRequests = syncTransportRequestsFromPaidServices(serviceItems, user, updated, submittedPayment);

    if (appliedPromo?.code) {
      markPromoCampaignRedeemed(appliedPromo.code, user.id);
      savePendingPromoCode('');
    }
    clearCart(user.id);
    pushNotification(user.id, 'Payment received', 'Your application is being processed and payment is pending verification.', 'success');
    if (transportRequests.length) {
      pushNotification(user.id, 'Transport request received', 'Kagie received your transport payment. The master admin and assistants will book the ticket manually and send it to your account.', 'info');
      notifyStaffForTransportRequests(transportRequests, updated);
    }
    notifyStaffForApplicationEvent(updated, {
      title: 'Learner submitted a payment',
      message: `${buildLearnerAlertMessage(updated, 'A learner')} submitted ${submittedPayment.method || 'a payment'}${submittedPayment.reference ? ` with reference ${submittedPayment.reference}` : ''} for ${formatMoneyLabel(submittedPayment.amount)}. Kagie is waiting for verification.`,
      type: 'warning'
    });
    return updated;
  }

  function getNotifications(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const notifications = normalizeNotificationStore(read(KEYS.notifications, []));
    write(KEYS.notifications, notifications);
    const announcementNotices = (() => {
      try {
        return getAnnouncementsForUser(userId).map((entry) => announcementToNotification(entry, userId));
      } catch (_error) {
        return [];
      }
    })();
    const byId = new Map();
    notifications.concat(announcementNotices).forEach((item) => {
      if (!item?.id || byId.has(item.id)) return;
      byId.set(item.id, item);
    });
    return Array.from(byId.values())
      .filter((n) => n.userId === userId || n.userId === 'all')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function pushNotification(userId, title, message, type = 'info') {
    const notifications = normalizeNotificationStore(read(KEYS.notifications, []));
    const entry = normalizeStoredNotificationEntry({
      id: uid('noti'),
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: nowISO(),
      source: 'local'
    });
    if (!String(entry.title || '').trim() && !String(entry.message || '').trim()) return null;
    const duplicate = notifications.find((item) => isRecentNotificationDuplicate(item, entry));
    if (duplicate) {
      return clone(duplicate);
    }
    const updated = normalizeNotificationStore(notifications.concat(entry));
    write(KEYS.notifications, updated);
    return clone(entry);
  }

  function pushGlobalNotification(title, message, type = 'info') {
    requireRole([ROLES.MASTER]);
    return pushNotification('all', title, message, type);
  }

  async function getNotificationsAsync(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const ctx = await resolveSupabaseContext(userId);
    const local = getNotifications(userId);
    if (!ctx) return local;

    const query = await ctx.client
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${ctx.targetRemoteId},user_id.is.null`)
      .order('created_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load notifications.');

    const localById = new Map(local.map((item) => [item.id, item]));
    const remote = safeArray(query.data).map((row) => {
      const normalized = normalizeRemoteNotificationRow(row, ctx.targetLocalUser?.id || userId);
      const localVersion = localById.get(normalized.id);
      if (localVersion?.read) normalized.read = true;
      return normalized;
    });
    mirrorRemoteNotifications(remote);

    const announcementNotices = await getAnnouncementsForUserAsync(userId)
      .then((items) => safeArray(items).map((entry) => announcementToNotification(entry, userId)))
      .catch(() => []);
    const combined = [...remote, ...announcementNotices];
    local.forEach((item) => {
      if (!combined.find((remoteItem) => remoteItem.id === item.id)) {
        combined.push(clone(item));
      }
    });

    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function pushNotificationAsync(userId, title, message, type = 'info') {
    const local = pushNotification(userId, title, message, type);
    const ctx = await resolveSupabaseContext(userId === 'all' ? undefined : userId);
    if (!ctx) return local;

    const remoteUserId = userId === 'all' ? null : ctx.targetRemoteId;
    try {
      const inserted = await ctx.client
        .from('notifications')
        .insert({
          user_id: remoteUserId,
          title,
          message,
          notification_type: type,
          is_read: false
        })
        .select('*')
        .maybeSingle();
      if (inserted.error) return local;
      const remote = normalizeRemoteNotificationRow(inserted.data, ctx.targetLocalUser?.id || userId);
      mirrorRemoteNotifications([remote]);
      return remote;
    } catch (err) {
      console.warn('Remote notification insert skipped:', err);
      return local;
    }
  }

  function prepareDirectLearnerNotification(payload) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const requestedUserId = String(payload?.userId || payload?.learnerId || '').trim();
    if (!requestedUserId) throw new Error('Choose a learner to notify.');

    const targetUser = getUserById(requestedUserId) || getUserBySupabaseId(requestedUserId);
    if (!targetUser || targetUser.role !== ROLES.USER) {
      throw new Error('Learner account not found.');
    }

    const title = String(payload?.title || '').trim();
    const message = String(payload?.message || '').trim();
    const type = String(payload?.type || 'info').trim().toLowerCase() || 'info';
    const applicationId = String(payload?.applicationId || '').trim() || null;

    if (!title) throw new Error('Notification title is required.');
    if (!message) throw new Error('Notification message is required.');

    return {
      actor,
      targetUser,
      userId: targetUser.id,
      title,
      message,
      type,
      applicationId
    };
  }

  function buildDirectLearnerNotificationResult(prepared, notification, activity) {
    return {
      ok: true,
      targetUser: sanitizeUser(prepared.targetUser),
      deliveredTo: prepared.userId,
      title: prepared.title,
      type: prepared.type,
      applicationId: prepared.applicationId,
      notification: notification ? clone(notification) : null,
      activity: activity ? clone(activity) : null
    };
  }

  function sendDirectLearnerNotification(payload) {
    const prepared = prepareDirectLearnerNotification(payload);
    const notification = pushNotification(prepared.userId, prepared.title, prepared.message, prepared.type);
    const activity = logAssistantActivity({
      assistantId: prepared.actor.id,
      applicationId: prepared.applicationId,
      action: 'send_direct_notification',
      details: {
        targetUserId: prepared.userId,
        targetUserName: prepared.targetUser.fullName || '',
        title: prepared.title,
        type: prepared.type,
        messagePreview: prepared.message.slice(0, 160)
      }
    });
    return buildDirectLearnerNotificationResult(prepared, notification, activity);
  }

  async function sendDirectLearnerNotificationAsync(payload) {
    const prepared = prepareDirectLearnerNotification(payload);
    const notification = await pushNotificationAsync(prepared.userId, prepared.title, prepared.message, prepared.type);
    let activity = null;
    try {
      activity = await logAssistantActivityAsync({
        assistantId: prepared.actor.id,
        applicationId: prepared.applicationId,
        action: 'send_direct_notification',
        details: {
          targetUserId: prepared.userId,
          targetUserName: prepared.targetUser.fullName || '',
          title: prepared.title,
          type: prepared.type,
          messagePreview: prepared.message.slice(0, 160)
        }
      });
    } catch (error) {
      console.warn('Direct learner notification activity log fallback:', error);
      activity = logAssistantActivity({
        assistantId: prepared.actor.id,
        applicationId: prepared.applicationId,
        action: 'send_direct_notification',
        details: {
          targetUserId: prepared.userId,
          targetUserName: prepared.targetUser.fullName || '',
          title: prepared.title,
          type: prepared.type,
          messagePreview: prepared.message.slice(0, 160)
        }
      });
    }
    return buildDirectLearnerNotificationResult(prepared, notification, activity);
  }

  function formatMoneyLabel(valueArg) {
    return `R${Number(valueArg || 0).toLocaleString('en-ZA')}`;
  }

  function getApplicationStaffRecipients(applicationArg) {
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    if (!app) return [];

    const seen = new Set();
    const recipients = [];
    const addRecipient = (user) => {
      if (!user?.id) return;
      const key = String(user.id || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      recipients.push(sanitizeUser(user));
    };

    getUsers()
      .filter((user) => user?.role === ROLES.MASTER)
      .forEach(addRecipient);

    const assignedAssistantId = String(app.assignedAssistantId || app.assistantId || '').trim();
    if (assignedAssistantId) {
      const assignedAssistant = getUserById(assignedAssistantId) || getUserBySupabaseId(assignedAssistantId);
      if (assignedAssistant?.role === ROLES.ASSISTANT) addRecipient(assignedAssistant);
    }

    return recipients;
  }

  function buildLearnerAlertMessage(applicationArg, fallbackLabel) {
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    const learner = app?.userId ? getUserById(app.userId) : null;
    return learner?.fullName || learner?.email || fallbackLabel || 'A learner';
  }

  function notifyStaffForApplicationEvent(applicationArg, eventArg) {
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    if (!app) return [];
    const event = eventArg && typeof eventArg === 'object' ? eventArg : {};
    const title = String(event.title || '').trim();
    const message = String(event.message || '').trim();
    if (!title || !message) return [];
    return getApplicationStaffRecipients(app).map((recipient) => pushNotification(recipient.id, title, message, event.type || 'info')).filter(Boolean);
  }

  async function notifyStaffForApplicationEventAsync(applicationArg, eventArg) {
    const app = applicationArg && typeof applicationArg === 'object' ? applicationArg : null;
    if (!app) return [];
    const event = eventArg && typeof eventArg === 'object' ? eventArg : {};
    const title = String(event.title || '').trim();
    const message = String(event.message || '').trim();
    if (!title || !message) return [];

    const recipients = getApplicationStaffRecipients(app);
    if (!recipients.length) return [];

    const results = await Promise.allSettled(
      recipients.map((recipient) => pushNotificationAsync(recipient.id, title, message, event.type || 'info'))
    );
    return results
      .filter((entry) => entry.status === 'fulfilled' && entry.value)
      .map((entry) => entry.value);
  }

  function buildMarketingBroadcastPayload(inputArg) {
    const input = inputArg && typeof inputArg === 'object' ? inputArg : {};
    const title = String(input.title || '').trim();
    const message = String(input.message || '').trim();
    const type = String(input.type || 'info').trim().toLowerCase() || 'info';
    const category = normalizeMarketingCategory(input.category);
    const audience = normalizeMarketingAudience(input.audience);
    const channels = normalizeMarketingChannels(input.channels || input);
    const ctaLabel = String(input.ctaLabel || '').trim();
    const ctaHref = String(input.ctaHref || '').trim();

    if (!title) throw new Error('Broadcast title is required.');
    if (!message) throw new Error('Broadcast message is required.');
    if (!channels.inApp && !channels.email && !channels.sms) {
      throw new Error('Choose at least one delivery channel.');
    }
    if (ctaHref && !/^https?:\/\//i.test(ctaHref) && !/^[./]/.test(ctaHref)) {
      throw new Error('Call-to-action link must be a web link or Kagie page path.');
    }

    return {
      title,
      message,
      type,
      category,
      categoryLabel: getMarketingCategoryLabel(category),
      audience,
      channels,
      ctaLabel,
      ctaHref
    };
  }

  async function sendMarketingBroadcast(inputArg) {
    const actor = requireRole([ROLES.MASTER]);
    const payload = buildMarketingBroadcastPayload(inputArg);
    const users = await (getAllUsersAsync ? getAllUsersAsync() : Promise.resolve(getAllUsers())).catch(() => getAllUsers());
    const recipientMap = new Map();
    safeArray(users).forEach((user) => {
      if (!user || !user.id) return;
      if (payload.audience !== 'all_accounts' && user.role !== ROLES.USER) return;
      const dedupeKey = String(user.supabaseUserId || user.id || normalizeEmail(user.email) || '').trim();
      if (!dedupeKey) return;
      if (!recipientMap.has(dedupeKey)) recipientMap.set(dedupeKey, user);
    });
    const recipients = Array.from(recipientMap.values());

    const emailEligible = new Set();
    const smsEligible = new Set();
    recipients.forEach((user) => {
      const email = normalizeEmail(user?.email);
      const phone = normalizePhoneNumber(user?.phone);
      if (email) emailEligible.add(email);
      if (phone) smsEligible.add(phone);
    });

    let inAppDelivered = 0;
    if (payload.channels.inApp) {
      const results = await Promise.allSettled(recipients.map((user) => {
        if (pushNotificationAsync) return pushNotificationAsync(user.id, payload.title, payload.message, payload.type);
        return Promise.resolve(pushNotification(user.id, payload.title, payload.message, payload.type));
      }));
      inAppDelivered = results.filter((result) => result.status === 'fulfilled' && result.value !== null).length;
    }

    const warnings = [];
    if (payload.channels.email) warnings.push('Email delivery is waiting for the live marketing server keys on this site.');
    if (payload.channels.sms) warnings.push('SMS delivery is waiting for the live marketing server keys on this site.');

    return storeMarketingCampaign({
      ...payload,
      createdById: actor.id,
      createdByName: actor.fullName || actor.email || 'Master Admin',
      totalRecipients: recipients.length,
      delivery: {
        totalRecipients: recipients.length,
        inAppDelivered,
        emailEligible: emailEligible.size,
        emailSent: 0,
        smsEligible: smsEligible.size,
        smsSent: 0
      },
      warnings,
      mode: 'browser-fallback',
      createdAt: nowISO(),
      updatedAt: nowISO()
    });
  }

  async function sendMarketingBroadcastAsync(inputArg) {
    const actor = requireRole([ROLES.MASTER]);
    const payload = buildMarketingBroadcastPayload(inputArg);
    const settings = getSettings();
    const endpoint = String(settings?.supabase?.adminMarketingBroadcastEndpoint || '').trim();

    if (endpoint) {
      try {
        const session = await getSupabaseSession().catch(() => read(KEYS.supabaseSessionCache, null));
        const accessToken = session?.access_token || read(KEYS.supabaseSessionCache, null)?.access_token || '';
        if (accessToken) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
          });
          const raw = await response.text().catch(() => '');
          let resultPayload = null;
          if (raw) {
            try {
              resultPayload = JSON.parse(raw);
            } catch (_error) {
              resultPayload = { message: String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
            }
          }

          if (response.ok) {
            const delivery = resultPayload?.data || resultPayload || {};
            return storeMarketingCampaign({
              ...payload,
              createdById: actor.id,
              createdByName: actor.fullName || actor.email || 'Master Admin',
              totalRecipients: Number(delivery.totalRecipients || 0) || 0,
              delivery: {
                totalRecipients: Number(delivery.totalRecipients || 0) || 0,
                inAppDelivered: Number(delivery.inAppDelivered || 0) || 0,
                emailEligible: Number(delivery.emailEligible || 0) || 0,
                emailSent: Number(delivery.emailSent || 0) || 0,
                smsEligible: Number(delivery.smsEligible || 0) || 0,
                smsSent: Number(delivery.smsSent || 0) || 0
              },
              warnings: safeArray(delivery.warnings),
              mode: 'serverless-function',
              createdAt: nowISO(),
              updatedAt: nowISO()
            });
          }

          if (!isMissingSupabaseAdminConfigMessage(resultPayload?.message || '')) {
            throw new Error(resultPayload?.message || resultPayload?.error || 'Could not send marketing broadcast.');
          }
        }
      } catch (error) {
        if (!isMissingSupabaseAdminConfigMessage(String(error?.message || ''))) {
          throw error;
        }
      }
    }

    return sendMarketingBroadcast(payload);
  }

  function markNotificationRead(notificationId) {
    const user = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const notifications = normalizeNotificationStore(read(KEYS.notifications, []));
    const index = notifications.findIndex((n) => n.id === notificationId && (n.userId === user.id || n.userId === 'all'));
    if (index === -1) return false;
    notifications[index].read = true;
    write(KEYS.notifications, notifications);
    return true;
  }

  function markAllNotificationsRead(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const notifications = normalizeNotificationStore(read(KEYS.notifications, []));
    let changed = false;

    notifications.forEach((item) => {
      if ((item.userId === userId || item.userId === 'all') && !item.read) {
        item.read = true;
        changed = true;
      }
    });

    if (changed) write(KEYS.notifications, notifications);
    return changed;
  }

  async function markNotificationReadAsync(notificationId) {
    const changed = markNotificationRead(notificationId);
    if (!isUuid(notificationId)) return changed;
    const ctx = await resolveSupabaseContext();
    if (!ctx) return changed;

    const updated = await ctx.client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (updated.error) {
      console.warn('Remote notification read update skipped:', updated.error.message || updated.error);
    }
    return true;
  }

  async function markAllNotificationsReadAsync(userIdArg) {
    const changed = markAllNotificationsRead(userIdArg);
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return changed;

    const updates = await Promise.allSettled([
      ctx.client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', ctx.targetRemoteId)
        .eq('is_read', false),
      ctx.client
        .from('notifications')
        .update({ is_read: true })
        .is('user_id', null)
        .eq('is_read', false)
    ]);
    const rejected = updates.find((result) => result.status === 'fulfilled' && result.value?.error);
    if (rejected?.value?.error) {
      console.warn('Remote mark-all notifications skipped:', rejected.value.error.message || rejected.value.error);
    }
    return true;
  }

  function saveDocuments(filesMeta, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const docs = read(KEYS.docs, []);
    const list = Array.isArray(filesMeta) ? filesMeta : [filesMeta];
    let fallbackApplication = null;
    try {
      fallbackApplication = getLatestApplication(userId) || (actor.role === ROLES.USER ? ensureDraft(userId) : null);
    } catch (_error) {
      fallbackApplication = getLatestApplication(userId) || null;
    }

    const saved = list.map((doc) => {
      const targetApp = doc?.applicationId ? getApplicationById(doc.applicationId) : fallbackApplication;
      return {
        id: doc?.id || uid('doc'),
        userId,
        applicationId: doc?.applicationId || targetApp?.id || null,
        name: doc?.name || doc?.fileName || 'Document',
        type: doc?.type || doc?.mimeType || '',
        size: Number(doc?.size || 0),
        dataUrl: doc?.dataUrl || '',
        category: doc?.category || 'general',
        status: STATUS.doc.PENDING,
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
    });

    docs.push(...saved);
    write(KEYS.docs, docs);
    saved
      .filter((doc) => doc.category === 'proof_of_payment')
      .forEach((doc) => {
        try {
          linkPaymentProofToApplication(doc.applicationId, doc, userId);
        } catch (error) {
          console.warn('Could not link proof of payment to application.', error);
        }
      });
    if (actor.role === ROLES.USER) {
      pushNotification(userId, 'Documents uploaded', 'Your documents were uploaded successfully.', 'success');
      const latestApplication = getLatestApplication(userId);
      notifyStaffForApplicationEvent(latestApplication, {
        title: 'Learner uploaded documents',
        message: `${buildLearnerAlertMessage(latestApplication, 'A learner')} uploaded ${saved.length} document${saved.length === 1 ? '' : 's'} to Kagie${saved.some((doc) => doc.category === 'proof_of_payment') ? ', including proof of payment' : ''}.`,
        type: saved.some((doc) => doc.category === 'proof_of_payment') ? 'warning' : 'info'
      });
    }
    return clone(saved);
  }

  async function saveDocumentsAsync(filesMeta, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const ctx = await resolveSupabaseContext(userId);
    if (!ctx) return saveDocuments(filesMeta, userId);
    try {
      let latestApp = await getLatestApplicationAsync(userId).catch(() => null);
      if (!latestApp && actor.role === ROLES.USER) {
        latestApp = await ensureDraftAsync(userId).catch(() => null);
      }
      const list = Array.isArray(filesMeta) ? filesMeta : [filesMeta];
      const bucket = 'kagie-documents';
      const saved = [];

      for (const doc of list) {
        const targetApplicationId = doc?.applicationId || latestApp?.id || null;
        const originalName = doc?.name || doc?.fileName || 'document';
        const rawFile = doc?.file || null;
        const mimeType = doc?.type || doc?.mimeType || rawFile?.type || '';
        const extension = extensionFromMime(mimeType) || String(originalName).split('.').pop();
        const safeName = sanitizePathPart(originalName.replace(/\.[^.]+$/, '')) || 'document';
        const objectPath = `${sanitizePathPart(ctx.targetRemoteId)}/${Date.now()}_${safeName}${extension ? `.${sanitizePathPart(extension)}` : ''}`;
        const fileBody = rawFile || dataUrlToBlob(doc?.dataUrl || '', mimeType);
        if (!fileBody) throw new Error('Could not prepare the selected file for upload.');

        const upload = await ctx.client.storage
          .from(bucket)
          .upload(objectPath, fileBody, {
            cacheControl: '3600',
            contentType: mimeType || undefined,
            upsert: false
          });
        if (upload.error) throw new Error(upload.error.message || 'Could not upload document.');

        const insert = await ctx.client
          .from('documents')
          .insert({
            user_id: ctx.targetRemoteId,
            application_id: targetApplicationId,
            document_type: doc?.category || 'general',
            file_name: originalName,
            file_url: objectPath,
            status: STATUS.doc.PENDING
          })
          .select('*')
          .single();
        if (insert.error) throw new Error(insert.error.message || 'Could not save document record.');

        saved.push(normalizeRemoteDocumentRow(insert.data, ctx.targetLocalUser?.id || userId, { ...doc, applicationId: targetApplicationId }));
      }

      mirrorRemoteDocuments(saved, ctx.targetLocalUser?.id || userId);
      for (const doc of saved.filter((item) => item.category === 'proof_of_payment')) {
        try {
          await linkPaymentProofToApplicationAsync(doc.applicationId, doc, userId);
        } catch (error) {
          console.warn('Could not sync proof of payment to application.', error);
        }
      }
      if (actor.role === ROLES.USER) {
        pushNotification(userId, 'Documents uploaded', 'Your documents were uploaded successfully.', 'success');
        const latestApplication = saved.find((doc) => doc.applicationId)?.applicationId
          ? await getApplicationByIdAsync(saved.find((doc) => doc.applicationId)?.applicationId, userId).catch(() => null)
          : await getLatestApplicationAsync(userId).catch(() => null);
        await notifyStaffForApplicationEventAsync(latestApplication, {
          title: 'Learner uploaded documents',
          message: `${buildLearnerAlertMessage(latestApplication, 'A learner')} uploaded ${saved.length} document${saved.length === 1 ? '' : 's'} to Kagie${saved.some((doc) => doc.category === 'proof_of_payment') ? ', including proof of payment' : ''}.`,
          type: saved.some((doc) => doc.category === 'proof_of_payment') ? 'warning' : 'info'
        }).catch(() => {});
      }
      return saved;
    } catch (error) {
      if (isRecoverableRemoteSyncError(error)) {
        console.warn('Falling back to local document save because remote document sync is unavailable.', error);
        return saveDocuments(filesMeta, userId);
      }
      throw error;
    }
  }

  function getDocumentsByUser(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    return read(KEYS.docs, [])
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  async function getDocumentsByUserAsync(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const ctx = await resolveSupabaseContext(userId);
    const local = getDocumentsByUser(userId);
    if (!ctx) return local;

    const query = await ctx.client
      .from('documents')
      .select('*')
      .eq('user_id', ctx.targetRemoteId)
      .order('created_at', { ascending: false });
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local documents because the remote documents query is unavailable.', query.error);
        return local;
      }
      throw new Error(query.error.message || 'Could not load documents.');
    }

    const localById = new Map(local.map((item) => [item.id, item]));
    const remote = safeArray(query.data).map((row) => normalizeRemoteDocumentRow(row, ctx.targetLocalUser?.id || userId, localById.get(row.id)));
    mirrorRemoteDocuments(remote, ctx.targetLocalUser?.id || userId);
    return remote;
  }

  function setDocumentReview(docId, review) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const docs = read(KEYS.docs, []);
    const reviews = read(KEYS.docReviews, []);
    const docIndex = docs.findIndex((d) => d.id === docId);
    if (docIndex === -1) throw new Error('Document not found.');

    docs[docIndex].status = review?.status || docs[docIndex].status;
    docs[docIndex].updatedAt = nowISO();
    write(KEYS.docs, docs);

    const record = {
      id: uid('rev'),
      docId,
      userId: docs[docIndex].userId,
      reviewerId: actor.id,
      status: review?.status || 'Reviewed',
      comment: review?.comment || '',
      createdAt: nowISO()
    };

    reviews.push(record);
    write(KEYS.docReviews, reviews);
    pushNotification(docs[docIndex].userId, 'Document reviewed', `Your document ${docs[docIndex].name} was reviewed.`, 'info');

    logAssistantActivity({
      assistantId: actor.id,
      applicationId: review?.applicationId || null,
      action: 'review_document',
      details: { docId, status: record.status }
    });

    return clone(record);
  }

  function getDocumentReviewsForUser(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const docsById = read(KEYS.docs, []).reduce((acc, doc) => {
      acc[doc.id] = doc;
      return acc;
    }, {});

    return read(KEYS.docReviews, [])
      .filter((review) => review.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((review) => {
        const safeReview = clone(review);
        const doc = docsById[safeReview.docId] ? clone(docsById[safeReview.docId]) : null;

        return {
          ...safeReview,
          doc: doc
            ? {
                ...doc,
                fileName: doc.name,
                title: doc.name
              }
            : null,
          review: {
            status: safeReview.status,
            comment: safeReview.comment,
            reviewedBy: safeReview.reviewerId,
            createdAt: safeReview.createdAt
          }
        };
      });
  }

  async function getDocumentReviewsForUserAsync(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const docs = await getDocumentsByUserAsync(userId);
    const ctx = await resolveSupabaseContext(userId);
    if (!ctx) {
      return docs
        .filter((doc) => !!doc)
        .map((doc) => ({
          doc: clone(doc),
          review: {
            status: doc.status || STATUS.doc.PENDING,
            comment: '',
            reviewedBy: '',
            createdAt: doc.updatedAt || doc.createdAt
          }
        }));
    }

    const docIds = docs.map((doc) => doc.id).filter(isUuid);
    if (!docIds.length) {
      return docs
        .filter((doc) => !!doc)
        .map((doc) => ({
          doc: clone(doc),
          review: {
            status: doc.status || STATUS.doc.PENDING,
            comment: '',
            reviewedBy: '',
            createdAt: doc.updatedAt || doc.createdAt
          }
        }));
    }

    const query = await ctx.client
      .from('document_reviews')
      .select('*')
      .in('document_id', docIds)
      .order('created_at', { ascending: false });
    if (query.error) {
      return docs
        .filter((doc) => !!doc)
        .map((doc) => ({
          doc: clone(doc),
          review: {
            status: doc.status || STATUS.doc.PENDING,
            comment: '',
            reviewedBy: '',
            createdAt: doc.updatedAt || doc.createdAt
          }
        }));
    }

    const reviewerUsers = await fetchRemoteUsersByIds(safeArray(query.data).map((row) => row.assistant_id), ctx.client).catch(() => []);
    const reviewerMap = new Map(reviewerUsers.map((user) => [user.supabaseUserId, user]));
    const docById = new Map(docs.map((doc) => [doc.id, doc]));
    const latestByDocId = new Map();

    safeArray(query.data).forEach((row) => {
      if (!latestByDocId.has(row.document_id)) latestByDocId.set(row.document_id, row);
    });

    const reviews = Array.from(latestByDocId.values()).map((row) => normalizeRemoteDocumentReviewRow(row, docById.get(row.document_id), reviewerMap.get(row.assistant_id)));
    mirrorRemoteDocumentReviews(reviews, userId);

    return docs
      .filter((doc) => !!doc)
      .map((doc) => {
        const review = reviews.find((entry) => entry.docId === doc.id);
        return {
          doc: clone(doc),
          review: {
            status: review?.status || doc.status || STATUS.doc.PENDING,
            comment: review?.comment || '',
            reviewedBy: review?.reviewerId || '',
            createdAt: review?.createdAt || doc.updatedAt || doc.createdAt
          }
        };
      });
  }

  function getThreadIdForUser(userId) {
    return `support_${userId}`;
  }

  function getSupportMessages(threadIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const threadId = threadIdArg || getThreadIdForUser(actor.id);
    return read(KEYS.supportChats, [])
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(clone);
  }

  async function getSupportMessagesAsync(threadIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = getSupportTargetUserId(threadIdArg, actor.id);
    const localThreadId = threadIdArg || getThreadIdForUser(targetUserId);
    const remote = await getOrCreateRemoteSupportThread(targetUserId);
    if (!remote) return getSupportMessages(localThreadId);

    const query = await remote.client
      .from('support_messages')
      .select('*')
      .eq('thread_id', remote.thread.id)
      .order('created_at', { ascending: true });
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local support messages because the remote messages query is unavailable.', query.error);
        return getSupportMessages(localThreadId);
      }
      throw new Error(query.error.message || 'Could not load support messages.');
    }

    const senderUsers = await fetchRemoteUsersByIds(safeArray(query.data).map((row) => row.sender_id), remote.client).catch(() => []);
    const senderMap = new Map(senderUsers.map((user) => [user.supabaseUserId, user]));
    const messages = safeArray(query.data).map((row) => normalizeRemoteSupportMessageRow(row, localThreadId, senderMap.get(row.sender_id)));
    mirrorRemoteSupportMessages(messages, localThreadId);
    return messages;
  }

  function sendSupportMessage(threadIdArg, message) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const chats = read(KEYS.supportChats, []);
    const threadId = threadIdArg || getThreadIdForUser(actor.id);

    const entry = {
      id: uid('msg'),
      threadId,
      senderId: actor.id,
      senderRole: actor.role,
      senderName: actor.fullName,
      text: String(message || '').trim(),
      createdAt: nowISO()
    };

    if (!entry.text) throw new Error('Message cannot be empty.');

    chats.push(entry);
    write(KEYS.supportChats, chats);

    const userId = threadId.replace('support_', '');
    if (actor.id !== userId) {
      pushNotification(userId, 'New support message', `${actor.fullName} sent you a message.`, 'info');
      logAssistantActivity({ assistantId: actor.id, applicationId: null, action: 'send_support_message', details: { threadId } });
    }

    return clone(entry);
  }

  async function sendSupportMessageAsync(threadIdArg, message) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const text = String(message || '').trim();
    if (!text) throw new Error('Message cannot be empty.');

    const targetUserId = getSupportTargetUserId(threadIdArg, actor.id);
    const localThreadId = threadIdArg || getThreadIdForUser(targetUserId);
    const remote = await getOrCreateRemoteSupportThread(targetUserId);
    if (!remote) return sendSupportMessage(localThreadId, text);

    const insert = await remote.client
      .from('support_messages')
      .insert({
        thread_id: remote.thread.id,
        sender_id: remote.remoteSelfId,
        sender_role: actor.role,
        message: text
      })
      .select('*')
      .single();
    if (insert.error) {
      if (isRecoverableRemoteSyncError(insert.error)) {
        console.warn('Falling back to local support message send because the remote insert is unavailable.', insert.error);
        return sendSupportMessage(localThreadId, text);
      }
      throw new Error(insert.error.message || 'Could not send support message.');
    }

    const entry = normalizeRemoteSupportMessageRow(insert.data, localThreadId, actor);
    const messages = await getSupportMessagesAsync(localThreadId);
    if (!messages.find((item) => item.id === entry.id)) {
      mirrorRemoteSupportMessages(messages.concat(entry), localThreadId);
    }
    if (actor.id !== targetUserId) {
      await pushNotificationAsync(targetUserId, 'New support message', `${actor.fullName} sent you a message.`, 'info').catch(() => {});
      await logAssistantActivityAsync({ assistantId: actor.id, applicationId: null, action: 'send_support_message', details: { threadId: localThreadId } }).catch(() => {});
    }
    return entry;
  }

  function requestCallback(payload) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const records = read(KEYS.callRequests, []);
    const entry = {
      id: uid('call'),
      requesterId: actor.id,
      requesterRole: actor.role,
      requesterName: actor.fullName,
      phone: payload?.phone || actor.phone || '',
      preferredTime: payload?.preferredTime || '',
      reason: payload?.reason || '',
      status: STATUS.callback.PENDING,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    records.push(entry);
    write(KEYS.callRequests, records);
    if (actor.role === ROLES.USER) pushNotification(actor.id, 'Callback requested', 'Your callback request was sent successfully.', 'success');
    return clone(entry);
  }

  async function requestCallbackAsync(payload) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return requestCallback(payload);

    const insert = await ctx.client
      .from('callback_requests')
      .insert({
        user_id: ctx.targetRemoteId,
        phone: payload?.phone || actor.phone || '',
        preferred_time: payload?.preferredTime || '',
        note: payload?.reason || payload?.note || '',
        status: STATUS.callback.PENDING
      })
      .select('*')
      .single();
    if (insert.error) {
      if (isRecoverableRemoteSyncError(insert.error)) {
        console.warn('Falling back to local callback request because the remote insert is unavailable.', insert.error);
        return requestCallback(payload);
      }
      throw new Error(insert.error.message || 'Could not request callback.');
    }

    const entry = normalizeRemoteCallbackRow(insert.data, actor);
    mirrorRemoteCallRequests([entry], actor.id);
    if (actor.role === ROLES.USER) pushNotification(actor.id, 'Callback requested', 'Your callback request was sent successfully.', 'success');
    return entry;
  }

  function getCallRequests() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const allowedLearners = actor.role === ROLES.ASSISTANT ? getAssistantScopedLearnerIdentitySetLocal(actor) : null;
    return read(KEYS.callRequests, [])
      .filter((item) => {
        if (actor.role !== ROLES.ASSISTANT) return true;
        return userMatchesIdentity(actor, item?.assignedAssistantId)
          || allowedLearners.has(String(item?.requesterId || '').trim().toLowerCase());
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function getMyCallRequests(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    if (actor.role === ROLES.USER && userId !== actor.id) {
      throw new Error('You can only view your own callback requests.');
    }
    return read(KEYS.callRequests, [])
      .filter((item) => item.requesterId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  async function getMyCallRequestsAsync(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const ctx = await resolveSupabaseContext(userId);
    const local = getMyCallRequests(userId);
    if (!ctx) return local;

    const query = await ctx.client
      .from('callback_requests')
      .select('*')
      .eq('user_id', ctx.targetRemoteId)
      .order('created_at', { ascending: false });
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local callback requests because the remote query is unavailable.', query.error);
        return local;
      }
      throw new Error(query.error.message || 'Could not load callback requests.');
    }

    const requesterUser = ctx.targetLocalUser || actor;
    const items = safeArray(query.data).map((row) => ({
      ...normalizeRemoteCallbackRow(row, requesterUser),
      assignedAssistantId: getUsers().find((user) => user.supabaseUserId === row.assigned_assistant_id)?.id || row.assigned_assistant_id || null
    }));
    mirrorRemoteCallRequests(items, requesterUser.id || userId);
    return items;
  }

  async function getCallRequestsAsync() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return getCallRequests();

    let rows = [];
    if (actor.role === ROLES.ASSISTANT) {
      const [assignedQuery, scopedUserIds] = await Promise.all([
        ctx.client
          .from('callback_requests')
          .select('*')
          .eq('assigned_assistant_id', ctx.remoteSelfId)
          .order('created_at', { ascending: false }),
        getAssistantScopedRemoteUserIds(ctx).catch(() => [])
      ]);
      if (assignedQuery.error) {
        if (isRecoverableRemoteSyncError(assignedQuery.error)) {
          console.warn('Falling back to local assistant callback requests because the remote query is unavailable.', assignedQuery.error);
          return getCallRequests();
        }
        throw new Error(assignedQuery.error.message || 'Could not load callback requests.');
      }

      const byId = new Map();
      safeArray(assignedQuery.data).forEach((row) => byId.set(row.id, row));
      if (scopedUserIds.length) {
        const learnerQuery = await ctx.client
          .from('callback_requests')
          .select('*')
          .in('user_id', scopedUserIds)
          .order('created_at', { ascending: false });
        if (learnerQuery.error) {
          if (isRecoverableRemoteSyncError(learnerQuery.error)) {
            console.warn('Skipping part of the assistant callback scope because one live query is unavailable.', learnerQuery.error);
          } else {
            throw new Error(learnerQuery.error.message || 'Could not load callback requests.');
          }
        } else {
          safeArray(learnerQuery.data).forEach((row) => byId.set(row.id, row));
        }
      }
      rows = Array.from(byId.values());
    } else {
      const query = await ctx.client
        .from('callback_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (query.error) {
        if (isRecoverableRemoteSyncError(query.error)) {
          console.warn('Falling back to local admin callback requests because the remote query is unavailable.', query.error);
          return getCallRequests();
        }
        throw new Error(query.error.message || 'Could not load callback requests.');
      }
      rows = safeArray(query.data);
    }

    const remoteIds = safeArray(rows).flatMap((row) => [row.user_id, row.assigned_assistant_id]).filter(Boolean);
    const syncedUsers = await fetchRemoteUsersByIds(remoteIds, ctx.client).catch(() => []);
    const userMap = new Map(syncedUsers.map((user) => [user.supabaseUserId, user]));
    const items = safeArray(rows).map((row) => ({
      ...normalizeRemoteCallbackRow(row, userMap.get(row.user_id)),
      assignedAssistantId: userMap.get(row.assigned_assistant_id)?.id || row.assigned_assistant_id || null
    }));

    const grouped = new Map();
    items.forEach((item) => {
      const bucket = grouped.get(item.requesterId) || [];
      bucket.push(item);
      grouped.set(item.requesterId, bucket);
    });
    grouped.forEach((bucket, requesterId) => {
      mirrorRemoteCallRequests(bucket, requesterId);
    });
    return items;
  }

  async function updateCallRequestAsync(id, patch) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(id)) return updateCallRequest(id, patch);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return updateCallRequest(id, patch);

    const current = await ctx.client.from('callback_requests').select('*').eq('id', id).maybeSingle();
    if (current.error) throw new Error(current.error.message || 'Could not load callback request.');
    if (!current.data) throw new Error('Call request not found.');

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'status')) updates.status = patch.status || current.data.status;
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'assignedAssistantId')) {
      if (patch.assignedAssistantId) {
        const assistantCtx = await resolveSupabaseContext(patch.assignedAssistantId);
        updates.assigned_assistant_id = assistantCtx?.targetRemoteId || patch.assignedAssistantId;
      } else {
        updates.assigned_assistant_id = null;
      }
    } else if (actor.role === ROLES.ASSISTANT && !current.data.assigned_assistant_id) {
      updates.assigned_assistant_id = ctx.remoteSelfId;
    }

    const saved = await ctx.client
      .from('callback_requests')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (saved.error) throw new Error(saved.error.message || 'Could not update callback request.');

    const requesterUser = getUsers().find((user) => user.supabaseUserId === saved.data.user_id)
      || normalizeRemoteUserRow(await getRemoteProfileSnapshot(saved.data.user_id, ctx.client) || {
        id: saved.data.user_id,
        full_name: current.data.user_id,
        email: '',
        role: ROLES.USER,
        phone: ''
      });

    const entry = {
      ...normalizeRemoteCallbackRow(saved.data, requesterUser),
      assignedAssistantId: getUsers().find((user) => user.supabaseUserId === saved.data.assigned_assistant_id)?.id || saved.data.assigned_assistant_id || null
    };
    await getMyCallRequestsAsync(requesterUser.id).catch(() => {});
    await pushNotificationAsync(requesterUser.id, 'Callback updated', `Your callback request status is now ${entry.status}.`, 'info').catch(() => {});
    await logAssistantActivityAsync({
      assistantId: actor.id,
      applicationId: null,
      action: 'update_call_request',
      details: { callRequestId: id, status: entry.status }
    }).catch(() => {});
    return entry;
  }

  async function logAssistantActivityAsync(payload) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return logAssistantActivity(payload);

    const insert = await ctx.client
      .from('assistant_activity')
      .insert({
        assistant_id: ctx.remoteSelfId,
        application_id: payload?.applicationId || null,
        action: payload?.action || 'unknown',
        details: payload?.details || {}
      })
      .select('*')
      .single();
    if (insert.error) throw new Error(insert.error.message || 'Could not log assistant activity.');

    const entry = normalizeRemoteAssistantActivityRow(insert.data, actor);
    mirrorRemoteAssistantActivity([entry]);
    return entry;
  }

  function persistPortalAccessOnApplicationLocal(applicationId, entriesArg) {
    const apps = getAllApplications();
    const index = apps.findIndex((app) => app.id === applicationId);
    if (index === -1) return [];

    const entries = safeArray(entriesArg)
      .map((entry, itemIndex) => normalizePortalAccessEntry(entry, itemIndex + 1))
      .filter(portalAccessHasData);

    const next = clone(apps[index]);
    next.forms = next.forms && typeof next.forms === 'object' ? next.forms : {};
    next.forms.portalAccess = entries.map(clone);
    next.updatedAt = nowISO();
    apps[index] = next;
    saveAllApplications(apps);
    return entries.map(clone);
  }

  function upsertPortalAccessNoteLocal(applicationId, actor, entriesArg) {
    const entries = safeArray(entriesArg)
      .map((entry, index) => normalizePortalAccessEntry({
        ...entry,
        updatedAt: entry?.updatedAt || nowISO(),
        updatedBy: entry?.updatedBy || actor?.fullName || actor?.role || 'Kagie'
      }, index + 1))
      .filter(portalAccessHasData);

    const notes = read(KEYS.notes, []);
    const text = serializePortalAccessState(entries);
    const existingIndex = notes.findIndex((item) => item.applicationId === applicationId && isPortalAccessNoteText(item.text));

    if (existingIndex >= 0) {
      notes[existingIndex] = {
        ...notes[existingIndex],
        authorId: actor?.id || notes[existingIndex].authorId,
        authorName: actor?.fullName || actor?.role || notes[existingIndex].authorName || 'Kagie',
        text,
        updatedAt: nowISO()
      };
    } else {
      notes.push({
        id: uid('note'),
        applicationId,
        authorId: actor?.id || '',
        authorName: actor?.fullName || actor?.role || 'Kagie',
        text,
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    }

    write(KEYS.notes, notes);
    persistPortalAccessOnApplicationLocal(applicationId, entries);
    return entries.map(clone);
  }

  function persistLearnerSupportOnApplicationLocal(applicationId, dataArg) {
    const apps = getAllApplications();
    const index = apps.findIndex((app) => app.id === applicationId);
    if (index === -1) return normalizeLearnerSupportNeeds({});

    const support = normalizeLearnerSupportNeeds(dataArg);
    const next = clone(apps[index]);
    next.forms = next.forms && typeof next.forms === 'object' ? next.forms : {};
    next.forms.learner = {
      ...(next.forms.learner || {}),
      ...support
    };
    next.updatedAt = nowISO();
    apps[index] = next;
    saveAllApplications(apps);
    return clone(support);
  }

  function upsertLearnerSupportNoteLocal(applicationId, actor, dataArg) {
    const support = normalizeLearnerSupportNeeds(dataArg);
    const notes = read(KEYS.notes, []);
    const text = serializeLearnerSupportState(support);
    const existingIndex = notes.findIndex((item) => item.applicationId === applicationId && isLearnerSupportNoteText(item.text));

    if (existingIndex >= 0) {
      notes[existingIndex] = {
        ...notes[existingIndex],
        authorId: actor?.id || notes[existingIndex].authorId,
        authorName: actor?.fullName || actor?.role || notes[existingIndex].authorName || 'Kagie',
        text,
        updatedAt: nowISO()
      };
    } else {
      notes.push({
        id: uid('note'),
        applicationId,
        authorId: actor?.id || '',
        authorName: actor?.fullName || actor?.role || 'Kagie',
        text,
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    }

    write(KEYS.notes, notes);
    persistLearnerSupportOnApplicationLocal(applicationId, support);
    return clone(support);
  }

  function getApplicationLearnerSupport(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const app = getApplicationById(applicationId);
    const direct = normalizeLearnerSupportNeeds(app?.forms?.learner || {});
    if (learnerSupportHasData(direct)) return direct;

    const notes = read(KEYS.notes, []).filter((note) => note.applicationId === applicationId);
    return extractLearnerSupportFromNotes(notes);
  }

  async function getApplicationLearnerSupportAsync(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return getApplicationLearnerSupport(applicationId);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getApplicationLearnerSupport(applicationId);

    const query = await ctx.client
      .from('application_notes')
      .select('*')
      .eq('application_id', applicationId)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local learner support because the remote notes query is unavailable.', query.error);
        return getApplicationLearnerSupport(applicationId);
      }
      throw new Error(query.error.message || 'Could not load learner support details.');
    }

    const authorUsers = await fetchRemoteUsersByIds(safeArray(query.data).map((row) => row.author_id), ctx.client).catch(() => []);
    const authorMap = new Map(authorUsers.map((user) => [user.supabaseUserId, user]));
    const allNotes = safeArray(query.data).map((row) => normalizeRemoteApplicationNoteRow(row, authorMap.get(row.author_id)));
    mirrorRemoteNotes(allNotes, applicationId);
    const support = extractLearnerSupportFromNotes(allNotes);
    if (learnerSupportHasData(support)) persistLearnerSupportOnApplicationLocal(applicationId, support);
    return support;
  }

  function saveApplicationLearnerSupport(applicationId, dataArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const app = getApplicationById(applicationId);
    if (!app) throw new Error('Application not found.');
    return upsertLearnerSupportNoteLocal(applicationId, actor, dataArg);
  }

  async function saveApplicationLearnerSupportAsync(applicationId, dataArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return saveApplicationLearnerSupport(applicationId, dataArg);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return saveApplicationLearnerSupport(applicationId, dataArg);

    const support = normalizeLearnerSupportNeeds(dataArg);

    try {
      const existingQuery = await ctx.client
        .from('application_notes')
        .select('*')
        .eq('application_id', applicationId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (existingQuery.error) throw existingQuery.error;

      const text = serializeLearnerSupportState(support);
      const existing = safeArray(existingQuery.data).find((row) => isLearnerSupportNoteText(row.note));
      let writeResult = null;

      if (existing) {
        writeResult = await ctx.client
          .from('application_notes')
          .update({
            note: text,
            author_id: ctx.remoteSelfId,
            author_role: actor.role
          })
          .eq('id', existing.id)
          .select('*')
          .single();
      } else {
        writeResult = await ctx.client
          .from('application_notes')
          .insert({
            application_id: applicationId,
            author_id: ctx.remoteSelfId,
            author_role: actor.role,
            note: text
          })
          .select('*')
          .single();
      }

      if (writeResult.error) throw writeResult.error;

      upsertLearnerSupportNoteLocal(applicationId, actor, support);
      return clone(support);
    } catch (error) {
      if (isRecoverableRemoteSyncError(error)) {
        console.warn('Falling back to local learner support save because remote note sync is unavailable.', error);
        return saveApplicationLearnerSupport(applicationId, support);
      }
      throw new Error(error.message || 'Could not save learner support details.');
    }
  }

  function getApplicationPortalAccess(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const app = getApplicationById(applicationId);
    const directEntries = safeArray(app?.forms?.portalAccess)
      .map((entry, index) => normalizePortalAccessEntry(entry, index + 1))
      .filter(portalAccessHasData);
    if (directEntries.length) return directEntries;

    const notes = read(KEYS.notes, []).filter((note) => note.applicationId === applicationId);
    return extractPortalAccessFromNotes(notes);
  }

  async function getApplicationPortalAccessAsync(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return getApplicationPortalAccess(applicationId);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getApplicationPortalAccess(applicationId);

    const query = await ctx.client
      .from('application_notes')
      .select('*')
      .eq('application_id', applicationId)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local portal access because the remote notes query is unavailable.', query.error);
        return getApplicationPortalAccess(applicationId);
      }
      throw new Error(query.error.message || 'Could not load institution portal access.');
    }

    const authorUsers = await fetchRemoteUsersByIds(safeArray(query.data).map((row) => row.author_id), ctx.client).catch(() => []);
    const authorMap = new Map(authorUsers.map((user) => [user.supabaseUserId, user]));
    const allNotes = safeArray(query.data).map((row) => normalizeRemoteApplicationNoteRow(row, authorMap.get(row.author_id)));
    mirrorRemoteNotes(allNotes, applicationId);
    const entries = extractPortalAccessFromNotes(allNotes);
    if (entries.length) persistPortalAccessOnApplicationLocal(applicationId, entries);
    return entries;
  }

  function saveApplicationPortalAccess(applicationId, entriesArg) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const app = getApplicationById(applicationId);
    if (!app) throw new Error('Application not found.');

    const entries = upsertPortalAccessNoteLocal(applicationId, actor, entriesArg);
    pushNotification(
      app.userId,
      'Institution login details ready',
      entries.length
        ? 'Your institution login details are now available in your Kagie dashboard.'
        : 'Your institution login details were updated in your Kagie dashboard.',
      'info'
    );
    logAssistantActivity({
      assistantId: actor.id,
      applicationId,
      action: 'save_portal_access',
      details: { entries: entries.length }
    });
    return entries.map(clone);
  }

  async function saveApplicationPortalAccessAsync(applicationId, entriesArg) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return saveApplicationPortalAccess(applicationId, entriesArg);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return saveApplicationPortalAccess(applicationId, entriesArg);

    const entries = safeArray(entriesArg)
      .map((entry, index) => normalizePortalAccessEntry({
        ...entry,
        updatedAt: entry?.updatedAt || nowISO(),
        updatedBy: entry?.updatedBy || actor.fullName || actor.role
      }, index + 1))
      .filter(portalAccessHasData);

    try {
      const existingQuery = await ctx.client
        .from('application_notes')
        .select('*')
        .eq('application_id', applicationId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (existingQuery.error) throw existingQuery.error;

      const text = serializePortalAccessState(entries);
      const existing = safeArray(existingQuery.data).find((row) => isPortalAccessNoteText(row.note));
      let writeResult = null;

      if (existing) {
        writeResult = await ctx.client
          .from('application_notes')
          .update({
            note: text,
            author_id: ctx.remoteSelfId,
            author_role: actor.role
          })
          .eq('id', existing.id)
          .select('*')
          .single();
      } else {
        writeResult = await ctx.client
          .from('application_notes')
          .insert({
            application_id: applicationId,
            author_id: ctx.remoteSelfId,
            author_role: actor.role,
            note: text
          })
          .select('*')
          .single();
      }

      if (writeResult.error) throw writeResult.error;

      upsertPortalAccessNoteLocal(applicationId, actor, entries);

      const app = await getApplicationByIdAsync(applicationId).catch(() => getApplicationById(applicationId));
      if (app?.userId) {
        await pushNotificationAsync(
          app.userId,
          'Institution login details ready',
          entries.length
            ? 'Your institution login details are now available in your Kagie dashboard.'
            : 'Your institution login details were updated in your Kagie dashboard.',
          'info'
        ).catch(() => {});
      }
      await logAssistantActivityAsync({
        assistantId: actor.id,
        applicationId,
        action: 'save_portal_access',
        details: { entries: entries.length }
      }).catch(() => {});
      return entries.map(clone);
    } catch (error) {
      if (isRecoverableRemoteSyncError(error)) {
        console.warn('Falling back to local portal access save because remote note sync is unavailable.', error);
        return saveApplicationPortalAccess(applicationId, entries);
      }
      throw new Error(error.message || 'Could not save institution portal access.');
    }
  }

  async function getApplicationNotesAsync(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return getApplicationNotes(applicationId);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getApplicationNotes(applicationId);

    let query = await ctx.client
      .from('admin_notes')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });
    if (query.error) {
      query = await ctx.client
        .from('application_notes')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });
    }
    if (query.error) throw new Error(query.error.message || 'Could not load application notes.');

    const authorUsers = await fetchRemoteUsersByIds(safeArray(query.data).map((row) => row.author_id), ctx.client).catch(() => []);
    const authorMap = new Map(authorUsers.map((user) => [user.supabaseUserId, user]));
    const notes = safeArray(query.data).map((row) => normalizeRemoteApplicationNoteRow(row, authorMap.get(row.author_id)));
    mirrorRemoteNotes(notes, applicationId);
    return notes.filter((note) => !isSystemApplicationNoteText(note.text));
  }

  async function addApplicationNoteAsync(applicationId, noteText) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return addApplicationNote(applicationId, noteText);
    const text = String(noteText || '').trim();
    if (!text) throw new Error('Note cannot be empty.');
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return addApplicationNote(applicationId, text);

    const appSnapshot = await ctx.client
      .from('applications')
      .select('id,user_id')
      .eq('id', applicationId)
      .maybeSingle();
    const noteUserId = appSnapshot?.data?.user_id || null;

    let insert = await ctx.client
      .from('admin_notes')
      .insert({
        application_id: applicationId,
        user_id: noteUserId,
        author_id: ctx.remoteSelfId,
        author_role: actor.role,
        note: text
      })
      .select('*')
      .single();
    if (insert.error) {
      insert = await ctx.client
        .from('application_notes')
        .insert({
          application_id: applicationId,
          author_id: ctx.remoteSelfId,
          author_role: actor.role,
          note: text
        })
        .select('*')
        .single();
    }
    if (insert.error) throw new Error(insert.error.message || 'Could not save application note.');

    const entry = normalizeRemoteApplicationNoteRow(insert.data, actor);
    await getApplicationNotesAsync(applicationId).catch(() => {});
    await logAssistantActivityAsync({ assistantId: actor.id, applicationId, action: 'add_note', details: { noteId: entry.id } }).catch(() => {});
    return entry;
  }

  async function setDocumentReviewAsync(docId, review) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(docId)) return setDocumentReview(docId, review);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return setDocumentReview(docId, review);

    const currentDoc = await ctx.client.from('documents').select('*').eq('id', docId).maybeSingle();
    if (currentDoc.error) throw new Error(currentDoc.error.message || 'Could not load document.');
    if (!currentDoc.data) throw new Error('Document not found.');

    const nextStatus = review?.status || currentDoc.data.status || STATUS.doc.PENDING;
    const nextComment = review?.comment || review?.note || '';

    const docUpdate = await ctx.client
      .from('documents')
      .update({ status: nextStatus })
      .eq('id', docId)
      .select('*')
      .single();
    if (docUpdate.error) throw new Error(docUpdate.error.message || 'Could not update document status.');

    const latestReview = await ctx.client
      .from('document_reviews')
      .select('*')
      .eq('document_id', docId)
      .eq('assistant_id', ctx.remoteSelfId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestReview.error) throw new Error(latestReview.error.message || 'Could not load document review.');

    let reviewResult = null;
    if (latestReview.data) {
      reviewResult = await ctx.client
        .from('document_reviews')
        .update({ status: nextStatus, note: nextComment })
        .eq('id', latestReview.data.id)
        .select('*')
        .single();
    } else {
      reviewResult = await ctx.client
        .from('document_reviews')
        .insert({
          document_id: docId,
          assistant_id: ctx.remoteSelfId,
          status: nextStatus,
          note: nextComment
        })
        .select('*')
        .single();
    }
    if (reviewResult.error) throw new Error(reviewResult.error.message || 'Could not save document review.');

    const learnerUser = getUsers().find((user) => user.supabaseUserId === docUpdate.data.user_id)
      || normalizeRemoteUserRow(await getRemoteProfileSnapshot(docUpdate.data.user_id, ctx.client) || {
        id: docUpdate.data.user_id,
        full_name: 'Learner',
        email: '',
        role: ROLES.USER,
        phone: ''
      });

    await getDocumentsByUserAsync(learnerUser.id).catch(() => {});
    await getDocumentReviewsForUserAsync(learnerUser.id).catch(() => {});
    await pushNotificationAsync(learnerUser.id, 'Document review updated', `Your document "${docUpdate.data.file_name || 'Document'}" is now ${nextStatus}.`, nextStatus === STATUS.doc.APPROVED ? 'success' : nextStatus === STATUS.doc.REJECTED ? 'warning' : 'info').catch(() => {});
    await logAssistantActivityAsync({
      assistantId: actor.id,
      applicationId: currentDoc.data.application_id || review?.applicationId || null,
      action: 'review_document',
      details: { docId, status: nextStatus }
    }).catch(() => {});

    return normalizeRemoteDocumentReviewRow(reviewResult.data, normalizeRemoteDocumentRow(docUpdate.data, learnerUser.id), actor);
  }

  async function getAllAssistantActivityAsync() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return getAllAssistantActivity();

    let result = await ctx.client.from('assistant_activity').select('*').order('created_at', { ascending: false });
    if (result.error) {
      let logQuery = ctx.client.from('activity_logs').select('*').order('timestamp', { ascending: false });
      if (actor.role !== ROLES.MASTER) logQuery = logQuery.eq('admin_id', ctx.remoteSelfId);
      result = await logQuery;
    } else if (actor.role !== ROLES.MASTER) {
      result = await ctx.client.from('assistant_activity').select('*').eq('assistant_id', ctx.remoteSelfId).order('created_at', { ascending: false });
    }
    if (result.error) {
      if (isRecoverableRemoteSyncError(result.error)) {
        console.warn('Falling back to local assistant activity because the remote activity query is unavailable.', result.error);
        return getAllAssistantActivity();
      }
      throw new Error(result.error.message || 'Could not load assistant activity.');
    }

    const assistantUsers = await fetchRemoteUsersByIds(
      safeArray(result.data).map((row) => row.assistant_id || row.admin_id).filter(Boolean),
      ctx.client
    ).catch(() => []);
    const assistantMap = new Map(assistantUsers.map((user) => [user.supabaseUserId, user]));
    const items = safeArray(result.data).map((row) => (
      row?.assistant_id
        ? normalizeRemoteAssistantActivityRow(row, assistantMap.get(row.assistant_id))
        : normalizeRemoteAssistantActivityRow({
            ...row,
            assistant_id: row?.admin_id || '',
            created_at: row?.timestamp || row?.created_at || nowISO(),
            details: row?.metadata || row?.details || {}
          }, assistantMap.get(row?.admin_id))
    ));
    mirrorRemoteAssistantActivity(items);
    return getAllAssistantActivity();
  }

  function updateCallRequest(id, patch) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const records = read(KEYS.callRequests, []);
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Call request not found.');

    records[index] = { ...records[index], ...patch, updatedAt: nowISO() };
    write(KEYS.callRequests, records);
    pushNotification(records[index].requesterId, 'Callback updated', `Your callback request status is now ${records[index].status}.`, 'info');

    logAssistantActivity({
      assistantId: actor.id,
      applicationId: null,
      action: 'update_call_request',
      details: { callRequestId: id, status: records[index].status }
    });

    return clone(records[index]);
  }

  function logAssistantActivity(payload) {
    const entries = read(KEYS.assistantActivity, []);
    const entry = {
      id: uid('act'),
      assistantId: payload?.assistantId || null,
      applicationId: payload?.applicationId || null,
      action: payload?.action || 'unknown',
      details: payload?.details || {},
      createdAt: nowISO()
    };
    entries.push(entry);
    write(KEYS.assistantActivity, entries);
    return clone(entry);
  }

  function getAssistantActivity(assistantIdArg) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const assistantId = assistantIdArg || actor.id;
    return read(KEYS.assistantActivity, [])
      .filter((item) => item.assistantId === assistantId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function addApplicationNote(applicationId, noteText) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const app = getApplicationById(applicationId);
    if (!app) throw new Error('Application not found.');

    const notes = read(KEYS.notes, []);
    const entry = {
      id: uid('note'),
      applicationId,
      authorId: actor.id,
      authorName: actor.fullName,
      text: String(noteText || '').trim(),
      createdAt: nowISO()
    };

    if (!entry.text) throw new Error('Note cannot be empty.');
    notes.push(entry);
    write(KEYS.notes, notes);

    logAssistantActivity({ assistantId: actor.id, applicationId, action: 'add_note', details: { noteId: entry.id } });
    return clone(entry);
  }

  function getApplicationNotes(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    return read(KEYS.notes, [])
      .filter((note) => note.applicationId === applicationId)
      .filter((note) => !isSystemApplicationNoteText(note.text))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function assignAssistant(applicationId, assistantId) {
    const actor = requireRole([ROLES.MASTER]);
    const assistant = getUserByIdentity(assistantId);
    if (!assistant) throw new Error('Assistant not found.');
    if (normalizeKagieRole(assistant.role, String(assistant.role || '').trim() || ROLES.ASSISTANT) !== ROLES.ASSISTANT) {
      throw new Error('Assistant not found.');
    }

    const resolvedAssistantId = String(assistant.id || assistantId || '').trim();
    const updated = updateApplication(applicationId, {
      assistantId: resolvedAssistantId,
      assignedAssistantId: resolvedAssistantId
    });
    pushNotification(updated.userId, 'Assistant assigned', `${assistant.fullName} was assigned to your application.`, 'info');

    logAssistantActivity({
      assistantId: actor.id,
      applicationId,
      action: 'assign_assistant',
      details: { assignedAssistantId: resolvedAssistantId }
    });

    return updated;
  }

  async function createAssistantAccount(data) {
    const actor = requireRole([ROLES.MASTER]);

    const fullName = String(data?.fullName || '').trim();
    const email = normalizeEmail(data?.email);
    const password = String(data?.password || '').trim();
    const phone = String(data?.phone || '').trim();
    const existingCachedAccount = getUserByEmail(email);

    if (!fullName) throw new Error('Assistant full name is required.');
    if (!email) throw new Error('Assistant email is required.');
    if (!isValidEmailAddress(email)) throw new Error('Use a real assistant email address, for example name@kagie.app.');
    if (password.length < 6) throw new Error('Assistant password must be at least 6 characters.');
    if (existingCachedAccount && existingCachedAccount.role !== ROLES.ASSISTANT) {
      throw new Error('This email is already used by a non-assistant Kagie account.');
    }

      const settings = getSettings();
      const endpoint = String(settings?.supabase?.adminCreateAssistantEndpoint || '').trim();
      const useLocalFallback = isLocalEnvironment();
      if (useLocalFallback && existingCachedAccount) throw new Error('An account with this email already exists.');
      const getLiveAssistantAccessToken = async () => {
        const cachedSession = read(KEYS.supabaseSessionCache, null);
        const activeSession = await getSupabaseSession().catch(() => cachedSession);
        let accessToken = activeSession?.access_token || cachedSession?.access_token || '';
        if (accessToken || useLocalFallback || !isSupabaseEnabled()) return accessToken;

        const recoveryEmail = normalizeEmail(actor?.email || '');
        const recoveryPassword = String(actor?.password || '').trim();
        if (!recoveryEmail || !recoveryPassword) return '';

        try {
          const client = initSupabaseClient();
          const { data: authData, error: authError } = await client.auth.signInWithPassword({
            email: recoveryEmail,
            password: recoveryPassword
          });
          if (authError || !authData?.session?.access_token) {
            return '';
          }
          write(KEYS.supabaseSessionCache, authData.session || null);
          if (authData.user) {
            const refreshedActor = await materializeSupabaseUser(authData.user, {
              email: recoveryEmail,
              password: recoveryPassword
            }).catch(() => null);
            if (refreshedActor) setCurrentUser(refreshedActor);
          }
          accessToken = authData.session.access_token;
        } catch (_error) {
          accessToken = '';
        }

        return accessToken;
      };
      const createLiveAssistantFallback = async () => {
        const signup = await signUpPrivilegedUserViaSupabase({
          fullName,
          email,
          password,
          phone,
          role: ROLES.ASSISTANT
        });

        const cachedAssistant =
          getUserByEmail(email) ||
          (existingCachedAccount && existingCachedAccount.role === ROLES.ASSISTANT ? existingCachedAccount : null);
        const remoteUser = signup?.user || null;
        const remoteAssistantId = String(remoteUser?.id || cachedAssistant?.supabaseUserId || '').trim();
        if (!remoteAssistantId && signup?.alreadyRegistered) {
          throw new Error('This assistant email is already registered. Use another email or ask the assistant to confirm the existing account first.');
        }
        const assistant = {
          id: cachedAssistant?.id || (remoteAssistantId ? `assistant_${remoteAssistantId.replace(/[^a-z0-9_-]/gi, '')}` : uid('assistant')),
          supabaseUserId: remoteAssistantId,
          fullName,
          email,
          password,
          phone,
          role: ROLES.ASSISTANT,
          profileImage: cachedAssistant?.profileImage || '',
          source: 'supabase',
          profile: sanitizeProfileObject(cachedAssistant?.profile || {}),
          pendingEmailConfirmation: Boolean(signup?.pendingEmailConfirmation),
          createdBy: actor?.id || cachedAssistant?.createdBy || '',
          createdAt: cachedAssistant?.createdAt || nowISO(),
          updatedAt: nowISO()
        };

        upsertLocalUser(assistant);
        pushNotification(
          assistant.id,
          'Assistant account ready',
          assistant.pendingEmailConfirmation
            ? 'Your Kagie assistant account was created. Confirm your email before first login.'
            : 'Your Kagie assistant account is ready for sign in.',
          'success'
        );
        logAssistantActivity({
          assistantId: actor.id,
          applicationId: null,
          action: 'create_assistant_account',
          details: {
            assistantAccountId: assistant.id,
            assistantEmail: assistant.email,
            mode: 'supabase-signup-fallback',
            pendingEmailConfirmation: Boolean(assistant.pendingEmailConfirmation)
          }
        });
        if (actor) setCurrentUser(actor);
        return sanitizeUser(getUserBySupabaseId(remoteAssistantId) || getUserByEmail(email) || assistant);
      };

      const resolveAssistantCreationFallback = async (reasonArg) => {
        if (useLocalFallback) {
          return createLocalAssistantFallback();
        }
        try {
          return await createLiveAssistantFallback();
        } catch (fallbackError) {
          throw new Error(
            String(fallbackError?.message || '').trim() ||
            String(reasonArg || '').trim() ||
            'Could not create the assistant account right now.'
          );
        }
      };

      // Keep the older helper name alive so stale admin copies do not crash
      // while the refreshed dashboard bundle is propagating.
      const requireSecureLiveAssistantCreation = (reasonArg) => resolveAssistantCreationFallback(reasonArg);

    const createLocalAssistantFallback = () => {
      const assistant = {
        id: uid('assistant'),
        supabaseUserId: '',
        fullName,
        email,
        password,
        phone,
        role: ROLES.ASSISTANT,
        profileImage: '',
        source: 'manual',
        createdBy: actor?.id || '',
        profile: {},
        createdAt: nowISO(),
        updatedAt: nowISO()
      };

      upsertLocalUser(assistant);
      pushNotification(
        assistant.id,
        'Assistant account ready',
        'Your Kagie assistant account is ready for sign in.',
        'success'
      );
      logAssistantActivity({
        assistantId: actor.id,
        applicationId: null,
        action: 'create_assistant_account',
        details: {
          assistantAccountId: assistant.id,
          assistantEmail: assistant.email,
          mode: 'local'
        }
      });
      if (actor) setCurrentUser(actor);
      return sanitizeUser(getUserById(assistant.id) || assistant);
    };

      if (!endpoint) {
        return resolveAssistantCreationFallback('Secure live assistant creation is not configured on this site yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment and redeploy.');
      }

      try {
        const accessToken = await getLiveAssistantAccessToken();
        if (!accessToken) {
          throw new Error('Your live master admin session expired. Log out, log back in as master admin, then create the assistant again.');
        }

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fullName, email, password, phone })
      });
      const rawBody = await response.text().catch(() => '');
      let payload = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch (_error) {
          payload = { message: String(rawBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
        }
      }

      if (!response.ok) {
          const message = payload?.message || payload?.error || response.statusText || 'Secure assistant creation endpoint failed.';
          if (useLocalFallback) {
            console.warn('Secure assistant creation failed locally, falling back to a local assistant account.', message);
            return createLocalAssistantFallback();
          }
          if (/live profile policy conflict blocked assistant creation/i.test(message)) {
            return resolveAssistantCreationFallback('Kagie hit a live profile policy conflict while creating this assistant, so it switched to the direct assistant signup path.');
          }
          if (/supabase admin configuration is missing/i.test(message)) {
            return resolveAssistantCreationFallback('Secure live assistant creation is waiting for SUPABASE_SERVICE_ROLE_KEY on the server.');
          }
          if (isRecoverableProfileSyncError(message)) {
            return resolveAssistantCreationFallback('Kagie hit a live profile sync loop while creating this assistant, so it switched to the direct assistant signup path.');
          }
          throw new Error(message);
        }

      const remote = payload?.data || payload || {};
      const remoteAssistantId = String(remote?.id || remote?.supabaseUserId || '').trim();
      const assistant = {
        id: remoteAssistantId ? `assistant_${remoteAssistantId.replace(/[^a-z0-9_-]/gi, '')}` : uid('assistant'),
        supabaseUserId: remoteAssistantId,
        fullName: remote?.fullName || fullName,
        email: normalizeEmail(remote?.email || email),
        password,
        phone: remote?.phone || phone,
        role: remote?.role || ROLES.ASSISTANT,
        profileImage: '',
        source: 'supabase',
        profile: {},
        alreadyExists: Boolean(remote?.alreadyExists),
        repaired: Boolean(remote?.repaired),
        createdAt: remote?.createdAt || nowISO(),
        updatedAt: remote?.updatedAt || nowISO()
      };
      upsertLocalUser(assistant);
      if (actor) setCurrentUser(actor);
      return sanitizeUser(getUserBySupabaseId(remoteAssistantId) || getUserByEmail(assistant.email) || assistant);
      } catch (err) {
        if (useLocalFallback) {
          console.warn('Assistant creation fell back to a local assistant account:', err?.message || err);
          return createLocalAssistantFallback();
        }
        if (/live profile policy conflict blocked assistant creation/i.test(String(err?.message || ''))) {
          return resolveAssistantCreationFallback('Kagie hit a live profile policy conflict while creating this assistant, so it switched to the direct assistant signup path.');
        }
        if (isRecoverableProfileSyncError(err)) {
          return resolveAssistantCreationFallback('Kagie hit a remote profile loop while creating this assistant, so it switched to the direct assistant signup path.');
        }
        if (/supabase admin configuration is missing/i.test(String(err?.message || ''))) {
          return resolveAssistantCreationFallback('Secure live assistant creation is waiting for SUPABASE_SERVICE_ROLE_KEY on the server.');
        }
        throw new Error(err?.message || 'Could not create assistant account through secure endpoint.');
      }
    }

  function clearAssistantReferencesLocally(assistantId) {
    const safeAssistantId = String(assistantId || '').trim();
    if (!safeAssistantId) return;

    const applications = getAllApplications();
    let applicationsChanged = false;
    const nextApplications = applications.map((app) => {
      const assignedAssistantId = String(app?.assignedAssistantId || app?.assistantId || '').trim();
      if (assignedAssistantId !== safeAssistantId) return app;
      applicationsChanged = true;
      return {
        ...app,
        assistantId: null,
        assignedAssistantId: null,
        updatedAt: nowISO()
      };
    });
    if (applicationsChanged) saveAllApplications(nextApplications);

    const activity = read(KEYS.assistantActivity, []);
    const filteredActivity = activity.filter((item) => String(item?.assistantId || '').trim() !== safeAssistantId);
    if (filteredActivity.length !== activity.length) write(KEYS.assistantActivity, filteredActivity);
  }

  async function bootstrapMasterAdminAccount(data) {
    const fullName = String(data?.fullName || '').trim();
    const email = normalizeEmail(data?.email);
    const password = String(data?.password || '');
    const phone = String(data?.phone || '').trim();

    if (fullName.length < 2) throw new Error('Master admin full name is required.');
    if (!isValidEmailAddress(email)) throw new Error(`Use a valid dedicated master admin email address, for example ${CURRENT_MASTER_SEED.email}.`);
    if (password.length < 6) throw new Error('Master admin password must be at least 6 characters.');

    const settings = getSettings();
    const endpoint = String(settings?.supabase?.adminBootstrapMasterEndpoint || '').trim();

    if (endpoint) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, email, password, phone })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload?.message || payload?.error || 'The live master admin setup could not be completed.';
            if (/supabase admin configuration is missing/i.test(String(message)) && isSupabaseEnabled()) {
              const signup = await signUpPrivilegedUserViaSupabase({
                fullName,
                email,
                password,
                phone,
                role: ROLES.MASTER
              });
              if (signup?.pendingEmailConfirmation) {
                throw new Error(`Master admin account created. Confirm the email sent to ${email} before first login.`);
              }
            } else {
              throw new Error(message);
            }
          }

        return await login(email, password);
      } catch (error) {
        throw new Error(error?.message || 'Could not create the live master admin account.');
      }
    }

    if (getUsers().some((user) => user.role === ROLES.MASTER)) {
      throw new Error('A Kagie master admin already exists. Please log in with that admin account.');
    }

    return registerUser({
      fullName,
      email,
      password,
      phone,
      role: ROLES.MASTER
    });
  }

  async function createMasterAdminAccount(data) {
    requireRole([ROLES.MASTER]);
    const before = currentUserRaw();
    const admin = await registerUser({ ...data, role: ROLES.MASTER });
    if (before) setCurrentUser(before);
    return admin;
  }

  function getUsersByRole(role) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const canonicalRole = normalizeKagieRole(role, String(role || '').trim() || ROLES.USER);
    const merged = mergeUniqueUsers(
      getUsers()
        .filter((u) => normalizeKagieRole(u.role, String(u.role || '').trim() || canonicalRole) === canonicalRole)
    );
    if (actor.role === ROLES.ASSISTANT && canonicalRole === ROLES.USER) {
      return filterUsersForAssistantScope(merged, getAssistantScopedLearnerIdentitySetLocal(actor));
    }
    return merged;
  }

  function getAllUsers() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const merged = mergeUniqueUsers(getUsers());
    if (actor.role === ROLES.ASSISTANT) {
      return filterUsersForAssistantScope(merged, getAssistantScopedLearnerIdentitySetLocal(actor));
    }
    return merged;
  }

  async function getStaffDirectoryAccessToken() {
    const cachedSession = read(KEYS.supabaseSessionCache, null);
    const activeSession = await getSupabaseSession().catch(() => cachedSession);
    return activeSession?.access_token || cachedSession?.access_token || '';
  }

  async function getActiveSupabaseAccessToken() {
    const cachedSession = read(KEYS.supabaseSessionCache, null);
    const activeSession = await getSupabaseSession().catch(() => cachedSession);
    return activeSession?.access_token || cachedSession?.access_token || '';
  }

  function resolveAdminFunctionEndpoint(preferred, defaultPath) {
    const direct = String(preferred || '').trim();
    if (direct) return direct;
    if (typeof window === 'undefined' || !window.location?.origin) return '';
    return `${window.location.origin}${String(defaultPath || '/v1/admin/users')}`;
  }

  function getAdminUsersEndpointCandidates(preferred) {
    const primary = resolveAdminFunctionEndpoint(preferred, '/v1/admin/users');
    const candidates = [];
    if (primary) candidates.push(primary);
    if (typeof window !== 'undefined' && window.location?.origin) {
      candidates.push(`${window.location.origin}/api/admin/users`);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function getAdminAssistantsEndpointCandidates(preferred) {
    const primary = resolveAdminFunctionEndpoint(preferred, '/v1/admin/assistants');
    const candidates = [];
    if (primary) candidates.push(primary);
    if (typeof window !== 'undefined' && window.location?.origin) {
      candidates.push(`${window.location.origin}/v1/admin/assistants`);
      candidates.push(`${window.location.origin}/api/admin/assistants`);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function getYocoCheckoutEndpointCandidates(preferred) {
    const primary = resolveAdminFunctionEndpoint(preferred, '/v1/payments/yoco/checkout');
    const candidates = [];
    if (primary) candidates.push(primary);
    if (typeof window !== 'undefined' && window.location?.origin) {
      candidates.push(`${window.location.origin}/api/payments/yoco/checkout`);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  async function startYocoCheckoutAsync(paymentData = {}) {
    requireRole([ROLES.USER]);
    const endpoints = getYocoCheckoutEndpointCandidates(String(getSettings()?.payments?.yocoCheckoutEndpoint || '').trim());
    if (!endpoints.length || typeof fetch !== 'function') {
      throw new Error('Yoco checkout is not configured on this Kagie site yet.');
    }

    const accessToken = await getActiveSupabaseAccessToken();
    if (!accessToken) {
      throw new Error('Please sign in again before starting payment.');
    }

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(paymentData || {})
        });
        const rawBody = await response.text().catch(() => '');
        let payload = null;
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody);
          } catch (_error) {
            payload = { message: String(rawBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
          }
        }
        if (!response.ok) {
          lastError = new Error(payload?.message || payload?.error || response.statusText || 'Yoco checkout could not be started.');
          continue;
        }
        const checkout = payload?.data || payload || {};
        if (!checkout.redirectUrl) {
          lastError = new Error('Yoco did not return a checkout redirect URL.');
          continue;
        }
        return checkout;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Could not reach the Kagie Yoco checkout endpoint.');
  }

  async function callAdminUsersEndpoint(options = {}) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const endpoints = getAdminUsersEndpointCandidates(String(getSettings()?.supabase?.adminUsersEndpoint || '').trim());
    if (!endpoints.length || typeof fetch !== 'function') throw new Error('Admin users endpoint is not available.');

    const accessToken = await getStaffDirectoryAccessToken();
    if (!accessToken) {
      if (!isLocalStaffSession(actor)) {
        console.warn('User directory fallback: no live staff access token available right now.');
      }
      throw new Error('Please sign in again so Kagie can verify your staff access.');
    }

    let lastError = null;
    for (const endpoint of endpoints) {
      const url = `${endpoint}${options.search || ''}`;
      try {
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        const rawBody = await response.text().catch(() => '');
        let payload = null;
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody);
          } catch (_error) {
            payload = { message: String(rawBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
          }
        }
        if (!response.ok) {
          lastError = new Error(payload?.message || payload?.error || response.statusText || 'Could not load admin users.');
          continue;
        }
        return payload || {};
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Could not reach the Kagie admin users endpoint.');
  }

  async function fetchAssistantAccountsFromAdminEndpoint() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const endpoints = getAdminAssistantsEndpointCandidates(
      String(getSettings()?.supabase?.adminAssistantsEndpoint || getSettings()?.supabase?.adminCreateAssistantEndpoint || '').trim()
    );
    if (!endpoints.length || typeof fetch !== 'function') return [];

    const accessToken = await getStaffDirectoryAccessToken();
    if (!accessToken) {
      if (!isLocalStaffSession(actor)) {
        console.warn('Assistant directory fallback: no live staff access token available right now.');
      }
      return [];
    }

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          }
        });
        const rawBody = await response.text().catch(() => '');
        let payload = null;
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody);
          } catch (_error) {
            payload = { message: String(rawBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
          }
        }

        if (!response.ok) {
          lastError = new Error(payload?.message || payload?.error || response.statusText || 'Unknown error');
          console.warn('Assistant directory endpoint fallback:', lastError.message);
          continue;
        }

        return mergeUniqueUsers(
          safeArray(payload?.data).map((row) => normalizeRemoteUserRow({
            id: row?.id,
            role: row?.role || ROLES.ASSISTANT,
            full_name: row?.fullName || row?.full_name || '',
            email: row?.email || '',
            phone: row?.phone || '',
            created_at: row?.createdAt || row?.created_at || '',
            updated_at: row?.updatedAt || row?.updated_at || ''
          }))
        );
      } catch (error) {
        lastError = error;
      }
    }
    console.warn('Could not load assistant directory from secure endpoint:', lastError);
    return [];
  }

  async function fetchAllAccountsFromAdminEndpoint() {
    try {
      const payload = await callAdminUsersEndpoint({ method: 'GET' });

      return mergeUniqueUsers(
        safeArray(payload?.data).map((row) => {
          const normalized = normalizeRemoteUserRow({
            id: row?.id,
            role: row?.role || ROLES.USER,
            full_name: row?.fullName || row?.full_name || '',
            email: row?.email || '',
            phone: row?.phone || '',
            created_at: row?.createdAt || row?.created_at || '',
            updated_at: row?.updatedAt || row?.updated_at || ''
          });
          return {
            ...normalized,
            surname: String(row?.surname || '').trim(),
            idNumber: String(row?.idNumber || row?.id_number || '').trim(),
            gender: String(row?.gender || '').trim(),
            dateOfBirth: String(row?.dateOfBirth || row?.date_of_birth || '').trim(),
            province: String(row?.province || '').trim(),
            city: String(row?.city || '').trim(),
            location: String(row?.location || '').trim(),
            address: String(row?.address || '').trim(),
            schoolName: String(row?.schoolName || row?.school_name || '').trim(),
            grade: String(row?.grade || row?.completionYear || row?.completion_year || '').trim(),
            applicationStatus: String(row?.applicationStatus || row?.application_status || '').trim(),
            accountStatus: String(row?.accountStatus || row?.account_status || '').trim(),
            roleLabel: String(row?.roleLabel || row?.role_label || '').trim(),
            confirmationStatus: String(row?.confirmationStatus || row?.confirmation_status || '').trim(),
            assignedAssistantId: String(row?.assignedAssistantId || row?.assigned_assistant_id || '').trim(),
            assignedAssistantName: String(row?.assignedAssistantName || row?.assigned_assistant_name || '').trim(),
            assignedAssistantEmail: String(row?.assignedAssistantEmail || row?.assigned_assistant_email || '').trim(),
            latestApplicationId: String(row?.latestApplicationId || row?.latest_application_id || '').trim(),
            latestApplicationStatus: String(row?.latestApplicationStatus || row?.latest_application_status || '').trim(),
            lastLogin: String(row?.lastLogin || row?.last_login || row?.last_sign_in_at || '').trim(),
            selectedInstitution: String(row?.selectedInstitution || row?.selected_institution || '').trim(),
            selectedFaculty: String(row?.selectedFaculty || row?.selected_faculty || '').trim(),
            selectedCourses: safeArray(row?.selectedCourses || row?.selected_courses).map((item) => String(item || '').trim()).filter(Boolean),
            hasProfile: Boolean(row?.hasProfile),
            hasFormDetails: Boolean(row?.hasFormDetails || row?.has_form_details),
            profileCompletionPercent: Number(row?.profileCompletionPercent ?? row?.profile_completion_percent ?? 0),
            profileCompletionLabel: String(row?.profileCompletionLabel || row?.profile_completion_label || '').trim(),
            source: 'supabase'
          };
        })
      );
    } catch (error) {
      console.warn('Could not load full user directory from secure endpoint:', error);
      return [];
    }
  }

  async function getAdminUserDirectoryAsync() {
    requireRole([ROLES.MASTER]);
    const payload = await callAdminUsersEndpoint({ method: 'GET' });
    return safeArray(payload?.data).map((row) => ({ ...row }));
  }

  async function getAdminUserDetailAsync(userId) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const id = String(userId || '').trim();
    if (!id) throw new Error('Choose a user first.');
    const payload = await callAdminUsersEndpoint({
      method: 'GET',
      search: `?userId=${encodeURIComponent(id)}`
    });
    return payload?.data || null;
  }

  async function assignUserToAssistantAsync(userId, assistantId, options = {}) {
    requireRole([ROLES.MASTER]);
    const learnerId = String(userId || '').trim();
    const adminId = String(assistantId || '').trim();
    if (!learnerId || !adminId) throw new Error('Choose a learner and assistant admin first.');
    const payload = await callAdminUsersEndpoint({
      method: 'POST',
      body: {
        userId: learnerId,
        assistantAdminId: adminId,
        applicationId: options.applicationId || options.application_id || ''
      }
    });
    return payload?.data || null;
  }

  async function fetchDirectoryUsersByRole(canonicalRole) {
    const directoryUsers = canonicalRole === ROLES.ASSISTANT
      ? await fetchAssistantAccountsFromAdminEndpoint().catch(() => [])
      : await fetchAllAccountsFromAdminEndpoint().catch(() => []);
    return safeArray(directoryUsers).filter((user) =>
      normalizeKagieRole(user?.role, String(user?.role || '').trim() || ROLES.USER) === canonicalRole
    );
  }

  async function getUsersByRoleAsync(role) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const canonicalRole = normalizeKagieRole(role, String(role || '').trim() || ROLES.USER);
    const ctx = await resolveSupabaseContext();
    if (!ctx) {
      const directoryUsers = await fetchDirectoryUsersByRole(canonicalRole).catch(() => []);
      const fallback = directoryUsers.length ? mergeUniqueUsers(directoryUsers, getUsersByRole(canonicalRole)) : getUsersByRole(role);
      if (actor.role === ROLES.ASSISTANT) {
        if (canonicalRole !== ROLES.USER) {
          const viewerKeys = getUserIdentityKeys(actor);
          return fallback.filter((user) => getUserIdentityKeys(user).some((key) => viewerKeys.includes(key)));
        }
        return filterUsersForAssistantScope(fallback, getAssistantScopedLearnerIdentitySetLocal(actor));
      }
      return fallback;
    }
    const roleVariants = getKagieRoleVariants(canonicalRole);

    const query = await fetchPagedSupabaseRows(() => ctx.client
      .from('profiles')
      .select('*')
      .in('role', roleVariants)
      .order('created_at', { ascending: false }));
    if (query.error) {
      if (isRecoverableProfileSyncError(query.error)) {
        console.warn('Falling back to secure staff directory for users-by-role because the remote profile policy is still recursive.', query.error);
        const fallbackUsers = await fetchDirectoryUsersByRole(canonicalRole);
        return fallbackUsers.length ? mergeUniqueUsers(fallbackUsers, getUsersByRole(canonicalRole)) : getUsersByRole(role);
      }
      throw new Error(query.error.message || 'Could not load users by role.');
    }

    const remote = syncRemoteUsersFromProfiles(query.data || []).filter((user) =>
      normalizeKagieRole(user.role, String(user.role || '').trim() || canonicalRole) === canonicalRole
    );
    const directoryUsers = await fetchDirectoryUsersByRole(canonicalRole);
    const allUsersByRole = (canonicalRole === ROLES.USER || canonicalRole === ROLES.ASSISTANT)
      ? await getAllUsersAsync()
        .then((users) => users.filter((user) => normalizeKagieRole(user.role, String(user.role || '').trim() || canonicalRole) === canonicalRole))
        .catch(() => [])
      : [];
    const merged = mergeUniqueUsers(remote, directoryUsers, allUsersByRole, getUsersByRole(canonicalRole));
    if (ctx.viewer.role === ROLES.ASSISTANT) {
      if (canonicalRole !== ROLES.USER) {
        const viewerKeys = getUserIdentityKeys(ctx.viewer);
        return merged.filter((user) => getUserIdentityKeys(user).some((key) => viewerKeys.includes(key)));
      }
      return filterUsersForAssistantScope(
        merged,
        await getAssistantScopedLearnerIdentitySetAsync(ctx).catch(() => getAssistantScopedLearnerIdentitySetLocal(ctx.viewer))
      );
    }
    return merged;
  }

  async function getAllUsersAsync() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext();
    if (!ctx) {
      const authDirectoryUsers = await fetchAllAccountsFromAdminEndpoint().catch(() => []);
      const fallback = authDirectoryUsers.length ? mergeUniqueUsers(authDirectoryUsers, getAllUsers()) : getAllUsers();
      if (actor.role === ROLES.ASSISTANT) {
        return filterUsersForAssistantScope(fallback, getAssistantScopedLearnerIdentitySetLocal(actor));
      }
      return fallback;
    }

    const query = await fetchPagedSupabaseRows(() => ctx.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }));
    if (query.error) {
      if (isRecoverableProfileSyncError(query.error)) {
        console.warn('Falling back to secure staff directory because the remote profile policy is still recursive.', query.error);
        const authDirectoryUsers = await fetchAllAccountsFromAdminEndpoint().catch(() => []);
        const mergedFallback = authDirectoryUsers.length ? mergeUniqueUsers(authDirectoryUsers, getAllUsers()) : getAllUsers();
        if (ctx.viewer.role === ROLES.ASSISTANT) {
          return filterUsersForAssistantScope(
            mergedFallback,
            await getAssistantScopedLearnerIdentitySetAsync(ctx).catch(() => getAssistantScopedLearnerIdentitySetLocal(ctx.viewer))
          );
        }
        return mergedFallback;
      }
      throw new Error(query.error.message || 'Could not load users.');
    }

    const remote = syncRemoteUsersFromProfiles(query.data || []);
    const authDirectoryUsers = await fetchAllAccountsFromAdminEndpoint().catch(() => []);
    const merged = mergeUniqueUsers(remote, authDirectoryUsers, getAllUsers());
    if (ctx.viewer.role === ROLES.ASSISTANT) {
      return filterUsersForAssistantScope(
        merged,
        await getAssistantScopedLearnerIdentitySetAsync(ctx).catch(() => getAssistantScopedLearnerIdentitySetLocal(ctx.viewer))
      );
    }
    return merged;
  }

  function updateUserByAdmin(userId, patch) {
    requireRole([ROLES.MASTER]);
    const users = getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found.');

    const updated = mergeDeep(users[index], { ...patch, updatedAt: nowISO() });
    if (patch?.email) {
      const normalized = normalizeEmail(patch.email);
      const clash = users.some((u, i) => i !== index && normalizeEmail(u.email) === normalized);
      if (clash) throw new Error('That email is already in use.');
      updated.email = normalized;
    }

    users[index] = updated;
    saveUsers(users);
    if (currentUserRaw()?.id === userId) setCurrentUser(updated);
    return sanitizeUser(updated);
  }

  function deleteUserByAdmin(userId) {
    requireRole([ROLES.MASTER]);
    const users = getUsers();
    const filtered = users.filter((u) => u.id !== userId);
    if (filtered.length === users.length) throw new Error('User not found.');
    saveUsers(filtered);
    return true;
  }

  async function getApplicationsByAssistantAsync(assistantIdArg) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const assistantId = assistantIdArg || actor.id;
    const ctx = await resolveSupabaseContext(assistantId);
    if (!ctx) return getApplicationsByAssistant(assistantId);

    const assignedUserIds = await loadAssignedUserIdsForAssistantAsync(ctx, ctx.targetRemoteId);
    if (!assignedUserIds.length) return [];

    const query = await fetchPagedRowsByIn(
      ctx.client,
      'applications',
      REMOTE_APPLICATION_SELECT,
      'user_id',
      assignedUserIds,
      { order: { column: 'updated_at', ascending: false } }
    );
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local assigned applications because the remote applications query is unavailable.', query.error);
        return getApplicationsByAssistant(assistantId);
      }
      throw new Error(query.error.message || 'Could not load assigned applications.');
    }

    const remoteIds = safeArray(query.data).flatMap((row) => [row.user_id, row.assistant_id]).filter(Boolean);
    const syncedUsers = await fetchRemoteUsersByIds(remoteIds, ctx.client).catch(() => []);
    const profileMap = new Map();
    syncedUsers.forEach((user) => {
      profileMap.set(user.supabaseUserId, {
        id: user.id,
        supabaseUserId: user.supabaseUserId,
        fullName: user.fullName,
        fullNames: user.fullName,
        email: user.email,
        phone: user.phone,
        cellphone: user.phone,
        role: user.role
      });
    });

    const apps = await hydrateRemoteApplications(query.data || [], assistantId, profileMap);
    mirrorRemoteApplications(apps);
    return apps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async function getAllApplicationsForAdminAsync() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return getAllApplicationsForAdmin();

    let query = null;
    if (actor.role === ROLES.ASSISTANT) {
      const assignedUserIds = await loadAssignedUserIdsForAssistantAsync(ctx, ctx.remoteSelfId);
      if (!assignedUserIds.length) return [];
      query = await fetchPagedRowsByIn(
        ctx.client,
        'applications',
        REMOTE_APPLICATION_SELECT,
        'user_id',
        assignedUserIds,
        { order: { column: 'updated_at', ascending: false } }
      );
    } else {
      query = await fetchPagedSupabaseRows(() => ctx.client
        .from('applications')
        .select(REMOTE_APPLICATION_SELECT)
        .order('updated_at', { ascending: false }));
    }
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local admin applications because the remote applications query is unavailable.', query.error);
        return getAllApplicationsForAdmin();
      }
      console.warn('Falling back to local admin applications because the live applications query failed.', query.error);
      return getAllApplicationsForAdmin();
    }

    const remoteIds = safeArray(query.data).flatMap((row) => [row.user_id, row.assistant_id]).filter(Boolean);
    const syncedUsers = await fetchRemoteUsersByIds(remoteIds, ctx.client).catch(() => []);
    const profileMap = new Map();
    syncedUsers.forEach((user) => {
      profileMap.set(user.supabaseUserId, {
        id: user.id,
        supabaseUserId: user.supabaseUserId,
        fullName: user.fullName,
        fullNames: user.fullName,
        email: user.email,
        phone: user.phone,
        cellphone: user.phone,
        role: user.role
      });
    });

    try {
      const apps = await hydrateRemoteApplications(query.data || [], actor.id, profileMap);
      mirrorRemoteApplications(apps);
      return apps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      if (isRecoverableRemoteSyncError(error)) {
        console.warn('Falling back to local admin applications because the remote hydration step is unavailable.', error);
        return getAllApplicationsForAdmin();
      }
      console.warn('Falling back to local admin applications because the live hydration step failed.', error);
      return getAllApplicationsForAdmin();
    }
  }

  async function assignAssistantAsync(applicationId, assistantId) {
    const actor = requireRole([ROLES.MASTER]);
    if (!isUuid(applicationId)) return assignAssistant(applicationId, assistantId);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return assignAssistant(applicationId, assistantId);

    const assistantCtx = await resolveSupabaseContext(assistantId);
    if (!assistantCtx?.targetRemoteId) throw new Error('Assistant not found.');

    const appSnapshot = await ctx.client.from('applications').select('id,user_id,assistant_id').eq('id', applicationId).maybeSingle();
    if (appSnapshot.error) throw new Error(appSnapshot.error.message || 'Could not load application.');
    if (!appSnapshot.data) throw new Error('Application not found.');

    const assignmentPayload = {
      assistant_id: assistantCtx.targetRemoteId,
      assigned_by: ctx.remoteSelfId,
      assigned_at: nowISO(),
      assignment_status: String(appSnapshot.data.assistant_id || '').trim() && appSnapshot.data.assistant_id !== assistantCtx.targetRemoteId
        ? 'Reassigned'
        : 'Assigned'
    };
    let update = await ctx.client
      .from('applications')
      .update(assignmentPayload)
      .eq('id', applicationId);
    if (update.error && /assigned_by|assigned_at|assignment_status/i.test(String(update.error.message || ''))) {
      update = await ctx.client
        .from('applications')
        .update({ assistant_id: assistantCtx.targetRemoteId })
        .eq('id', applicationId);
    }
    if (update.error) throw new Error(update.error.message || 'Could not assign assistant.');

    let assignmentMirror = await ctx.client
      .from('assistant_assignments')
      .upsert({
        user_id: appSnapshot.data.user_id,
        assistant_admin_id: assistantCtx.targetRemoteId,
        assigned_by: ctx.remoteSelfId,
        assigned_at: nowISO(),
        status: assignmentPayload.assignment_status
      }, {
        onConflict: 'user_id'
      });
    if (assignmentMirror.error) {
      assignmentMirror = await ctx.client
        .from('assignments')
        .upsert({
          user_id: appSnapshot.data.user_id,
          assistant_admin_id: assistantCtx.targetRemoteId,
          master_admin_id: ctx.remoteSelfId,
          application_id: applicationId,
          assigned_at: nowISO(),
          status: assignmentPayload.assignment_status
        }, {
          onConflict: 'user_id'
        });
      if (assignmentMirror.error) {
        throw new Error(assignmentMirror.error.message || 'Could not mirror assistant assignment.');
      }
    }

    await ctx.client.from('support_threads').update({ assistant_id: assistantCtx.targetRemoteId }).eq('user_id', appSnapshot.data.user_id);
    await ctx.client.from('callback_requests').update({ assigned_assistant_id: assistantCtx.targetRemoteId }).eq('user_id', appSnapshot.data.user_id).eq('status', STATUS.callback.PENDING);

    const learnerUser = getUsers().find((user) => user.supabaseUserId === appSnapshot.data.user_id)
      || normalizeRemoteUserRow(await getRemoteProfileSnapshot(appSnapshot.data.user_id, ctx.client) || {
        id: appSnapshot.data.user_id,
        full_name: 'Learner',
        email: '',
        role: ROLES.USER,
        phone: ''
      });
    const assignedAssistant = getUserById(assistantId)
      || assistantCtx.targetLocalUser
      || normalizeRemoteUserRow(await getRemoteProfileSnapshot(assistantCtx.targetRemoteId, ctx.client) || {
        id: assistantCtx.targetRemoteId,
        full_name: 'Kagie Assistant',
        email: '',
        role: ROLES.ASSISTANT,
        phone: ''
      });

    try {
      updateApplication(applicationId, {
        assistantId: assistantId,
        assignedAssistantId: assistantId
      });
    } catch (error) {
      console.warn('Could not mirror assistant assignment locally after live update.', error);
    }

    await pushNotificationAsync(learnerUser.id, 'Assistant assigned', `${assignedAssistant.fullName} was assigned to your application.`, 'info').catch(() => {});
    await logAssistantActivityAsync({
      assistantId: actor.id,
      applicationId,
      action: 'assign_assistant',
      details: { assignedAssistantId: assistantId }
    }).catch(() => {});

    return getApplicationByIdAsync(applicationId);
  }

  function getDashboardSummary(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const latest = getLatestApplication(userId) || (userId === viewer.id ? ensureDraft(userId) : null);
    const marks = safeArray(latest?.forms?.marks?.subjects);
    const packageUsage = getPackageUsageSummary(latest);
    const recommendations = getApplicationRecommendations({
      marks,
      year: safeArray(latest?.institutions)[0]?.year || String(new Date().getFullYear()),
      province: safeArray(latest?.institutions)[0]?.province || '',
      institutionType: safeArray(latest?.institutions)[0]?.institutionType || '',
      limit: 6
    });
    const applications = getAllApplications()
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(clone);
    const notifications = getNotifications(userId).slice(0, 5);
    const docs = getDocumentsByUser(userId);
    const reviews = getDocumentReviewsForUser(userId);
    const unreadNotifications = getNotifications(userId).filter((item) => !item.read).length;
    const notes = latest?.id ? getApplicationNotes(latest.id) : [];
    const favorites = getFavorites(userId);
    const accommodationRequests = getAccommodationRequests(userId);
    const transportRequests = getTransportRequests(userId);
    const serviceRequests = getServiceRequestsFromApplications(applications, userId)
      .concat(accommodationRequests.map(accommodationRequestToServiceItem))
      .concat(transportRequests.map(transportRequestToServiceItem));
    const preferences = getUserExperiencePreferences(userId);
    const serviceOverview = buildServiceOverview(serviceRequests);
    const deadlines = safeArray(latest?.institutions)
      .map((item) => getInstitutionForSelection(item))
      .filter(Boolean)
      .map((institution) => ({
        institutionName: institution.name,
        deadline: institution.closingDate || institution.applicationDeadline || ''
      }))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const pendingTasks = [];
    if (!latest?.package) pendingTasks.push('Choose an application pack');
    if (!safeArray(latest?.institutions).length) pendingTasks.push('Add at least one institution');
    if (docs.length < 2) pendingTasks.push('Upload supporting documents');
    if (latest?.paymentStatus === STATUS.payment.PENDING && !latest?.payment?.proofUploadedAt) pendingTasks.push('Upload proof of payment');
    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION) pendingTasks.push('Wait for payment verification');
    if (latest?.paymentStatus === STATUS.payment.REJECTED) pendingTasks.push('Re-upload proof of payment');
    if (latest?.status === STATUS.application.MISSING_DOCUMENTS) pendingTasks.push('Resolve missing documents');

    const smartAlerts = [];
    if (unreadNotifications) smartAlerts.push(`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`);
    if (latest?.status === STATUS.application.PROCESSING) smartAlerts.push('Your application is being processed');
    if (latest?.paymentStatus === STATUS.payment.REJECTED) smartAlerts.push(latest?.payment?.rejectionReason ? `Payment proof rejected: ${latest.payment.rejectionReason}` : 'Your payment proof was rejected and needs a re-upload');
    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION && latest?.payment?.proofUploadedAt) smartAlerts.push('Proof of payment uploaded and waiting for verification');
    if (deadlines[0]?.deadline) smartAlerts.push(`Nearest deadline: ${deadlines[0].institutionName}`);
      if (recommendations.aps.total) smartAlerts.push(`Current APS: ${recommendations.aps.total}`);
      if (recommendations.safeAlternatives[0]) smartAlerts.push(`Recommended: ${recommendations.safeAlternatives[0].course} at ${recommendations.safeAlternatives[0].institutionName}`);

      const reminders = buildReminderEntries({
        latest,
        deadlines,
        documents: docs,
        favorites,
        serviceRequests,
        recommendations
      });
      reminders.slice(0, 3).forEach((entry) => smartAlerts.push(entry.title));
      const acceptanceChecklist = buildAcceptanceChecklist(latest, docs, serviceOverview);
      const journeyBoard = buildJourneyBoard({
        latest,
        documents: docs,
        packageUsage,
        serviceOverview,
        acceptanceChecklist
      });
      const priorityActions = buildPriorityActions({
        latest,
        documents: docs,
        favorites,
        recommendations,
        acceptanceChecklist,
        serviceOverview
      });

      return {
        user: userId === viewer.id ? viewer : sanitizeUser(getUserById(userId)),
        latestApplication: latest,
        preferences,
        packageUsage,
        recommendations,
        applications,
        favorites,
        serviceRequests,
        accommodationRequests,
        transportRequests,
        serviceOverview,
        reminders,
        notifications,
        unreadNotifications,
        documents: docs,
        reviews,
        notes,
        journeyBoard,
        priorityActions,
        acceptanceChecklist,
      deadlines,
      pendingTasks,
      readiness: calculateReadiness(latest, docs),
      smartAlerts,
      cartTotal: userId === viewer.id ? getCartTotal(userId) : 0
    };
  }

  function getAdminSummary() {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const apps = getAllApplications();
    const users = getUsers();
    const callbackRequests = read(KEYS.callRequests, []);
    const docs = read(KEYS.docs, []);

    return {
      totals: {
        users: users.filter((u) => u.role === ROLES.USER).length,
        assistants: users.filter((u) => u.role === ROLES.ASSISTANT).length,
        applications: apps.length,
        pendingVerification: apps.filter((a) => a.paymentStatus === STATUS.payment.PENDING_VERIFICATION).length,
        processing: apps.filter((a) => a.status === STATUS.application.PROCESSING).length,
        pendingCallbacks: callbackRequests.filter((c) => c.status === STATUS.callback.PENDING).length,
        pendingDocs: docs.filter((d) => d.status === STATUS.doc.PENDING).length
      }
    };
  }

  async function getAdminSummaryAsync() {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getAdminSummary();

    const [profilesResult, applicationsResult, callbackResult, documentsResult] = await Promise.all([
      ctx.client.from('profiles').select('id,role'),
      ctx.client.from('applications').select('id,status,payment_status'),
      ctx.client.from('callback_requests').select('id,status'),
      ctx.client.from('documents').select('id,status')
    ]);

    if (profilesResult.error) {
      if (isRecoverableProfileSyncError(profilesResult.error)) {
        console.warn('Falling back to local admin summary because remote profile policy is still recursive.', profilesResult.error);
        return getAdminSummary();
      }
      throw new Error(profilesResult.error.message || 'Could not load profile totals.');
    }
    if (applicationsResult.error) throw new Error(applicationsResult.error.message || 'Could not load application totals.');
    if (callbackResult.error) throw new Error(callbackResult.error.message || 'Could not load callback totals.');
    if (documentsResult.error) throw new Error(documentsResult.error.message || 'Could not load document totals.');

    const profiles = safeArray(profilesResult.data);
    const apps = safeArray(applicationsResult.data);
    const callbacks = safeArray(callbackResult.data);
    const docs = safeArray(documentsResult.data);

    return {
      totals: {
        users: profiles.filter((user) => normalizeKagieRole(user.role, String(user.role || '').trim() || ROLES.USER) === ROLES.USER).length,
        assistants: profiles.filter((user) => normalizeKagieRole(user.role, String(user.role || '').trim() || ROLES.ASSISTANT) === ROLES.ASSISTANT).length,
        applications: apps.length,
        pendingVerification: apps.filter((app) => app.payment_status === STATUS.payment.PENDING_VERIFICATION).length,
        processing: apps.filter((app) => app.status === STATUS.application.PROCESSING).length,
        pendingCallbacks: callbacks.filter((item) => item.status === STATUS.callback.PENDING).length,
        pendingDocs: docs.filter((doc) => doc.status === STATUS.doc.PENDING).length
      }
    };
  }

  function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (!value) return 'draft';
    if (value.includes('reject')) return 'rejected';
    if (value.includes('accept') || value.includes('approve')) return 'approved';
    if (value.includes('verif') || value.includes('paid')) return 'paid';
    if (value.includes('review') || value.includes('process')) return 'review';
    if (value.includes('apply')) return 'applied';
    if (value.includes('pending') || value.includes('missing')) return 'pending';
    return 'draft';
  }

  function normalizeSchoolUsageKey(name, province) {
    return `${String(name || '').trim().toLowerCase()}|${String(province || '').trim().toLowerCase()}`;
  }

  function buildSchoolUsageSummary(recordsArg, applicationsArg, limitArg) {
    const records = safeArray(recordsArg);
    const applications = safeArray(applicationsArg);
    const limit = Math.max(0, Number(limitArg || 8));
    const applicationsByUser = new Map();

    applications.forEach((application) => {
      const userId = String(application?.userId || application?.user_id || '').trim();
      if (!userId) return;
      applicationsByUser.set(userId, (applicationsByUser.get(userId) || 0) + 1);
    });

    const schools = new Map();
    records.forEach((record) => {
      const role = String(record?.role || ROLES.USER).trim();
      if (role && role !== ROLES.USER) return;

      const userId = String(record?.id || record?.userId || record?.user_id || '').trim();
      const schoolName = String(record?.schoolName || record?.schoolAttended || record?.school_name || '').trim();
      if (!schoolName) return;

      const province = String(record?.schoolProvince || record?.school_province || record?.province || '').trim();
      const completionYear = String(record?.completionYear || record?.completion_year || '').trim();
      const key = normalizeSchoolUsageKey(schoolName, province);
      if (!key || key === '|') return;

      const existing = schools.get(key) || {
        schoolName,
        province,
        learnerCount: 0,
        applicationCount: 0,
        completionYears: new Set(),
        learnerIds: new Set()
      };

      const learnerKey = userId || `${schoolName}_${existing.learnerCount + 1}`;
      if (!existing.learnerIds.has(learnerKey)) {
        existing.learnerIds.add(learnerKey);
        existing.learnerCount += 1;
        existing.applicationCount += Number(applicationsByUser.get(userId) || 0);
      }
      if (completionYear) existing.completionYears.add(completionYear);
      schools.set(key, existing);
    });

    const ranked = Array.from(schools.values())
      .map((item) => ({
        schoolName: item.schoolName,
        province: item.province,
        learnerCount: item.learnerCount,
        applicationCount: item.applicationCount,
        completionYears: Array.from(item.completionYears).sort((a, b) => String(b).localeCompare(String(a))).slice(0, 3)
      }))
      .sort((a, b) => (b.learnerCount - a.learnerCount) || (b.applicationCount - a.applicationCount) || a.schoolName.localeCompare(b.schoolName));

    return {
      totalSchools: ranked.length,
      learnersWithSchools: ranked.reduce((sum, item) => sum + Number(item.learnerCount || 0), 0),
      schools: limit ? ranked.slice(0, limit) : ranked
    };
  }

  function getSchoolUsageSummary(limitArg) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const learnerRecords = getUsers()
      .filter((user) => user.role === ROLES.USER)
      .map((user) => {
        const profile = getProfile(user.id) || {};
        return {
          id: user.id,
          role: user.role,
          schoolName: profile.schoolName || profile.schoolAttended || user.profile?.schoolName || '',
          schoolAttended: profile.schoolAttended || profile.schoolName || '',
          schoolProvince: profile.schoolProvince || profile.province || '',
          completionYear: profile.completionYear || ''
        };
      });
    return buildSchoolUsageSummary(learnerRecords, getAllApplications(), limitArg);
  }

  async function getSchoolUsageSummaryAsync(limitArg) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getSchoolUsageSummary(limitArg);

    const [profilesResult, schoolProfilesResult, applicationsResult] = await Promise.all([
      ctx.client.from('profiles').select('id,role'),
      ctx.client.from('school_profiles').select('user_id,school_name,school_province,completion_year'),
      ctx.client.from('applications').select('id,user_id')
    ]);

    if (profilesResult.error) {
      if (isRecoverableProfileSyncError(profilesResult.error)) {
        console.warn('Falling back to local school usage summary because remote profile policy is still recursive.', profilesResult.error);
        return getSchoolUsageSummary(limitArg);
      }
      throw new Error(profilesResult.error.message || 'Could not load school usage summary.');
    }

    if (schoolProfilesResult.error || applicationsResult.error) {
      console.warn('Falling back to local school usage summary because remote school analytics are unavailable.', schoolProfilesResult.error || applicationsResult.error);
      return getSchoolUsageSummary(limitArg);
    }

    const schoolRowsByUser = new Map(
      safeArray(schoolProfilesResult.data).map((row) => [String(row?.user_id || '').trim(), row || {}])
    );
    const learnerRecords = safeArray(profilesResult.data)
      .filter((profile) => profile?.role === ROLES.USER)
      .map((profile) => {
        const schoolRow = schoolRowsByUser.get(String(profile?.id || '').trim()) || {};
        return {
          id: profile.id,
          role: profile.role,
          schoolName: schoolRow.school_name || '',
          schoolProvince: schoolRow.school_province || '',
          completionYear: schoolRow.completion_year || ''
        };
      });

    return buildSchoolUsageSummary(learnerRecords, safeArray(applicationsResult.data), limitArg);
  }

  function getUsersCompat() {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    return getUsers().map(sanitizeUser);
  }

  function getUserByIdCompat(userId) {
    const viewer = currentUser();
    if (!viewer) return null;
    return sanitizeUser(getUserById(userId));
  }

  function getProfile(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;

    if (viewer.role === ROLES.USER && userId !== viewer.id) {
      throw new Error('You can only view your own profile.');
    }

    const user = getUserById(userId);
    if (!user) return null;

    const safeUser = sanitizeUser(user);
    delete safeUser.profile;
    const profile = sanitizeProfileObject(user.profile || {});

    return {
      ...profile,
      ...safeUser,
      surname: profile.surname || profile.lastName || '',
      schoolName: profile.schoolName || profile.schoolAttended || '',
      schoolAttended: profile.schoolAttended || profile.schoolName || '',
      guardianName: profile.guardianName || '',
      grade: profile.grade || '',
      average: profile.average || '',
      province: safeUser?.province || profile.province || '',
      marks: safeArray(profile.marks)
    };
  }

  function saveProfile(userIdArg, patchArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = typeof userIdArg === 'string' ? userIdArg : actor.id;
    const patch = sanitizeProfileObject((typeof userIdArg === 'string' ? patchArg : userIdArg) || {});

    if (actor.role === ROLES.USER && targetUserId !== actor.id) {
      throw new Error('You can only update your own profile.');
    }

    const users = getUsers();
    const index = users.findIndex((user) => user.id === targetUserId);
    if (index === -1) throw new Error('User account not found.');

    const existing = users[index];
    const existingProfile = sanitizeProfileObject(existing.profile || {});
    const mergedProfile = mergeDeep(existingProfile, {
      ...patch,
      firstName: patch?.firstName || patch?.fullNames || patch?.fullName || existingProfile.firstName || '',
      lastName: patch?.lastName || patch?.surname || existingProfile.lastName || '',
      schoolName: patch?.schoolName || patch?.schoolAttended || existingProfile.schoolName || '',
      schoolAttended: patch?.schoolAttended || patch?.schoolName || existingProfile.schoolAttended || '',
      marks: Array.isArray(patch?.marks) ? patch.marks : safeArray(existingProfile.marks)
    });

    const nextEmail = patch?.email ? normalizeEmail(patch.email) : existing.email;
    const clash = users.some((user, userIndex) => userIndex !== index && normalizeEmail(user.email) === nextEmail);
    if (clash) throw new Error('That email is already in use.');

    const updated = {
      ...existing,
      fullName: patch?.fullName || patch?.fullNames || existing.fullName,
      email: nextEmail,
      phone: patch?.phone || patch?.cellphone || existing.phone,
      profileImage: patch?.profileImage || existing.profileImage || '',
      profile: mergedProfile,
      updatedAt: nowISO()
    };

    users[index] = updated;
    saveUsers(users);

    if (currentUserRaw()?.id === targetUserId) {
      setCurrentUser(updated);
    }

    syncSupabaseProfile(updated).catch((err) => {
      console.warn('Profile sync skipped:', err);
    });

    return getProfile(targetUserId);
  }

  async function getProfileAsync(userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = userIdArg || actor.id;
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx) return getProfile(targetUserId);

    const [profileResult, userResult, guardianResult, schoolResult] = await Promise.allSettled([
      ctx.client.from('profiles').select('*').eq('id', ctx.targetRemoteId).maybeSingle(),
      ctx.client.from('user_profiles').select('*').eq('user_id', ctx.targetRemoteId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ctx.client.from('guardian_profiles').select('*').eq('user_id', ctx.targetRemoteId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ctx.client.from('school_profiles').select('*').eq('user_id', ctx.targetRemoteId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    ]);

    const profileResponse = profileResult.status === 'fulfilled'
      ? profileResult.value
      : { data: null, error: profileResult.reason };
    const userResponse = userResult.status === 'fulfilled'
      ? userResult.value
      : { data: null, error: userResult.reason };
    const guardianResponse = guardianResult.status === 'fulfilled'
      ? guardianResult.value
      : { data: null, error: guardianResult.reason };
    const schoolResponse = schoolResult.status === 'fulfilled'
      ? schoolResult.value
      : { data: null, error: schoolResult.reason };

    if (profileResponse.error && !isRecoverableProfileSyncError(profileResponse.error)) {
      throw new Error(profileResponse.error.message || 'Could not load profile.');
    }
    if (profileResponse.error && isRecoverableProfileSyncError(profileResponse.error)) {
      console.warn('Falling back to local base profile because remote profile policy is still recursive.', profileResponse.error);
    }
    if (userResponse.error && isRecoverableProfileSyncError(userResponse.error)) {
      console.warn('Falling back to local learner profile details because remote profile policy is still recursive.', userResponse.error);
      userResponse.data = null;
      userResponse.error = null;
    }
    if (guardianResponse.error && isRecoverableProfileSyncError(guardianResponse.error)) {
      console.warn('Falling back to local guardian profile details because remote profile policy is still recursive.', guardianResponse.error);
      guardianResponse.data = null;
      guardianResponse.error = null;
    }
    if (schoolResponse.error && isRecoverableProfileSyncError(schoolResponse.error)) {
      console.warn('Falling back to local school profile details because remote profile policy is still recursive.', schoolResponse.error);
      schoolResponse.data = null;
      schoolResponse.error = null;
    }

    if (userResponse.error) throw new Error(userResponse.error.message || 'Could not load learner profile.');
    if (guardianResponse.error) throw new Error(guardianResponse.error.message || 'Could not load guardian profile.');
    if (schoolResponse.error) throw new Error(schoolResponse.error.message || 'Could not load school profile.');

    const localBase = ctx.targetLocalUser?.id ? getProfile(ctx.targetLocalUser.id) || {} : {};
    const profileRow = profileResponse.data || {};
    const userRow = userResponse.data || {};
    const guardianRow = guardianResponse.data || {};
    const schoolRow = schoolResponse.data || {};

    return {
      ...localBase,
      id: ctx.targetLocalUser?.id || localBase.id || ctx.targetRemoteId,
      supabaseUserId: ctx.targetRemoteId,
      role: profileRow.role || localBase.role || ctx.targetLocalUser?.role || ROLES.USER,
      fullName: profileRow.full_name || localBase.fullName || '',
      fullNames: profileRow.full_name || localBase.fullNames || localBase.fullName || '',
      email: profileRow.email || localBase.email || '',
      phone: profileRow.phone || localBase.phone || '',
      cellphone: profileRow.phone || localBase.cellphone || localBase.phone || '',
      profileImage: profileRow.profile_image || localBase.profileImage || '',
      idNumber: userRow.id_number || profileRow.id_number || localBase.idNumber || '',
      surname: userRow.surname || localBase.surname || '',
      maidenName: userRow.maiden_name || localBase.maidenName || '',
      dob: userRow.date_of_birth || localBase.dob || '',
      gender: userRow.gender || localBase.gender || '',
      homeLanguage: userRow.home_language || localBase.homeLanguage || '',
      province: userRow.province || profileRow.province || localBase.province || '',
      city: profileRow.city || localBase.city || localBase.town || '',
      postalCode: userRow.postal_code || localBase.postalCode || '',
      address: userRow.address || localBase.address || '',
      guardianRelation: guardianRow.relation || localBase.guardianRelation || '',
      guardianId: guardianRow.guardian_id || localBase.guardianId || '',
      guardianName: guardianRow.full_names || localBase.guardianName || localBase.guardianFullNames || '',
      guardianFullNames: guardianRow.full_names || localBase.guardianFullNames || localBase.guardianName || '',
      guardianSurname: guardianRow.surname || localBase.guardianSurname || '',
      guardianPhone: guardianRow.phone_1 || localBase.guardianPhone || localBase.guardianCell1 || '',
      guardianCell1: guardianRow.phone_1 || localBase.guardianCell1 || localBase.guardianPhone || '',
      guardianPhoneAlt: guardianRow.phone_2 || localBase.guardianPhoneAlt || localBase.guardianCell2 || '',
      guardianCell2: guardianRow.phone_2 || localBase.guardianCell2 || localBase.guardianPhoneAlt || '',
      guardianEmail: guardianRow.email || localBase.guardianEmail || '',
      guardianProvince: guardianRow.province || localBase.guardianProvince || '',
      guardianPostal: guardianRow.postal_code || localBase.guardianPostal || '',
      guardianAddress: guardianRow.address || localBase.guardianAddress || '',
      schoolName: schoolRow.school_name || localBase.schoolName || localBase.schoolAttended || '',
      schoolAttended: schoolRow.school_name || localBase.schoolAttended || localBase.schoolName || '',
      confirmName: schoolRow.confirm_name || localBase.confirmName || schoolRow.school_name || localBase.schoolName || '',
      schoolProvince: schoolRow.school_province || localBase.schoolProvince || '',
      schoolType: schoolRow.school_type || localBase.schoolType || '',
      completionYear: schoolRow.completion_year ?? localBase.completionYear ?? '',
      average: schoolRow.average ?? localBase.average ?? '',
      marks: safeArray(localBase.marks)
    };
  }

  async function saveProfileAsync(userIdArg, patchArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const targetUserId = typeof userIdArg === 'string' ? userIdArg : actor.id;
    const patch = (typeof userIdArg === 'string' ? patchArg : userIdArg) || {};
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx) return saveProfile(userIdArg, patchArg);

    const existing = ctx.targetLocalUser?.id
      ? (getProfile(ctx.targetLocalUser.id) || {})
      : (getProfile(targetUserId) || {});
    const merged = mergeDeep(existing || {}, patch || {});
    const fullName = merged.fullName || merged.fullNames || existing?.fullName || '';
    const email = normalizeEmail(merged.email || ctx.targetLocalUser?.email || existing?.email || (targetUserId === actor.id ? actor.email : '') || '');
    const phone = merged.phone || merged.cellphone || existing?.phone || '';
    const schoolName = merged.schoolName || merged.schoolAttended || '';
    const targetRole = ctx.targetLocalUser?.role || existing?.role || (targetUserId === actor.id ? actor.role : ROLES.USER);

    let profileWriteError = null;
    const profilePayload = {
      id: ctx.targetRemoteId,
      user_id: ctx.targetRemoteId,
      full_name: fullName,
      email,
      phone,
      id_number: merged.idNumber || '',
      province: merged.province || '',
      city: merged.city || merged.town || '',
      role: targetRole,
      profile_image: merged.profileImage || existing?.profileImage || ''
    };
    let profileWrite = await ctx.client.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileWrite.error && isProfileSchemaCacheColumnError(profileWrite.error)) {
      profileWriteError = profileWrite.error;
      console.warn('Profiles schema cache is missing compatibility columns. Retrying a minimal profile write; run the Kagie profile schema migration.', profileWrite.error);
      profileWrite = await ctx.client.from('profiles').upsert({
        id: ctx.targetRemoteId,
        full_name: fullName,
        role: targetRole,
        profile_image: merged.profileImage || existing?.profileImage || ''
      }, { onConflict: 'id' });
    }
    if (profileWrite.error) {
      if (isRecoverableProfileSyncError(profileWrite.error)) {
        profileWriteError = profileWriteError || profileWrite.error;
        console.warn('Skipping remote profiles upsert because the current profile policy/schema needs migration.', profileWrite.error);
      } else {
        throw new Error(profileWrite.error.message || 'Could not save profile.');
      }
    }

    const writes = await Promise.all([
      ctx.client.from('user_profiles').upsert({
        user_id: ctx.targetRemoteId,
        id_number: merged.idNumber || '',
        surname: merged.surname || '',
        maiden_name: merged.maidenName || '',
        date_of_birth: toDateOrNull(merged.dob),
        gender: merged.gender || '',
        home_language: merged.homeLanguage || '',
        province: merged.province || '',
        postal_code: merged.postalCode || '',
        address: merged.address || ''
      }, { onConflict: 'user_id' }),
      ctx.client.from('guardian_profiles').upsert({
        user_id: ctx.targetRemoteId,
        relation: merged.guardianRelation || '',
        guardian_id: merged.guardianId || '',
        full_names: merged.guardianFullNames || merged.guardianName || '',
        surname: merged.guardianSurname || '',
        phone_1: merged.guardianCell1 || merged.guardianPhone || '',
        phone_2: merged.guardianCell2 || merged.guardianPhoneAlt || '',
        email: merged.guardianEmail || '',
        province: merged.guardianProvince || '',
        postal_code: merged.guardianPostal || '',
        address: merged.guardianAddress || ''
      }, { onConflict: 'user_id' }),
      ctx.client.from('school_profiles').upsert({
        user_id: ctx.targetRemoteId,
        school_name: schoolName,
        confirm_name: merged.confirmName || schoolName || '',
        school_province: merged.schoolProvince || '',
        school_type: merged.schoolType || '',
        completion_year: toIntegerOrNull(merged.completionYear),
        average: toNumericOrNull(merged.average)
      }, { onConflict: 'user_id' })
    ]);

    writes.forEach((result) => {
      if (result.error) throw new Error(result.error.message || 'Could not save profile.');
    });

    if (ctx.targetLocalUser?.id) {
      saveProfile(ctx.targetLocalUser.id, merged);
    }

    if (profileWriteError && ctx.targetLocalUser?.id) {
      const users = getUsers();
      const userIndex = users.findIndex((item) => item.id === ctx.targetLocalUser.id);
      if (userIndex >= 0) {
        users[userIndex] = {
          ...users[userIndex],
          fullName: fullName || users[userIndex].fullName,
          email: email || users[userIndex].email,
          phone: phone || users[userIndex].phone,
          updatedAt: nowISO()
        };
        saveUsers(users);
        if (currentUserRaw()?.id === ctx.targetLocalUser.id) {
          setCurrentUser(users[userIndex]);
        }
      }
    }

    return getProfileAsync(ctx.targetLocalUser?.id || targetUserId);
  }

  async function ensureDraftAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx) return ensureDraft(targetUserId);

    const profile = await getProfileAsync(ctx.targetLocalUser?.id || targetUserId).catch(() => ({}));
    const existing = await ctx.client
      .from('applications')
      .select(REMOTE_APPLICATION_SELECT)
      .eq('user_id', ctx.targetRemoteId)
      .in('status', [STATUS.application.DRAFT, STATUS.application.MISSING_DOCUMENTS])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) {
      if (isRecoverableRemoteSyncError(existing.error)) {
        console.warn('Falling back to local draft because the remote draft query is unavailable.', existing.error);
        return ensureDraft(targetUserId);
      }
      throw new Error(existing.error.message || 'Could not load draft.');
    }

    let row = existing.data || null;
    if (!row) {
      const created = await ctx.client
        .from('applications')
        .insert({ user_id: ctx.targetRemoteId })
        .select(REMOTE_APPLICATION_SELECT)
        .single();
      if (created.error) {
        if (isRecoverableRemoteSyncError(created.error)) {
          console.warn('Falling back to local draft because the remote draft creation is unavailable.', created.error);
          return ensureDraft(targetUserId);
        }
        throw new Error(created.error.message || 'Could not create draft.');
      }
      row = created.data;
    }

    const [app] = await hydrateRemoteApplications([row], ctx.targetLocalUser?.id || targetUserId, profile);
    if (app) mirrorRemoteApplication(app, ctx.targetLocalUser?.id || targetUserId || app.userId);
    return app || ensureDraft(targetUserId);
  }

  async function getApplicationByIdAsync(appId, userIdArg) {
    if (!isUuid(appId)) return getApplicationById(appId);
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return getApplicationById(appId);

    const query = await ctx.client.from('applications').select(REMOTE_APPLICATION_SELECT).eq('id', appId).maybeSingle();
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local application because the remote application query is unavailable.', query.error);
        return getApplicationById(appId);
      }
      throw new Error(query.error.message || 'Could not load application.');
    }
    if (!query.data) return null;

    const localUser = getUsers().find((user) => user.supabaseUserId === query.data.user_id) || null;
    const targetUserId = localUser?.id || userIdArg || query.data.user_id;
    const profile = await getProfileAsync(targetUserId).catch(() => ({}));
    const [app] = await hydrateRemoteApplications([query.data], targetUserId, profile);
    if (app) mirrorRemoteApplication(app, app.userId || targetUserId);
    return app || null;
  }

  async function getLatestApplicationAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx) return getLatestApplication(targetUserId);

    const profile = await getProfileAsync(ctx.targetLocalUser?.id || targetUserId).catch(() => ({}));
    const query = await ctx.client
      .from('applications')
      .select(REMOTE_APPLICATION_SELECT)
      .eq('user_id', ctx.targetRemoteId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local latest application because the remote query is unavailable.', query.error);
        return getLatestApplication(targetUserId);
      }
      throw new Error(query.error.message || 'Could not load latest application.');
    }
    if (!query.data) return null;

    const [app] = await hydrateRemoteApplications([query.data], ctx.targetLocalUser?.id || targetUserId, profile);
    if (app) mirrorRemoteApplication(app, ctx.targetLocalUser?.id || targetUserId || app.userId);
    return app || null;
  }

  async function getApplicationsByUserAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx) return getApplicationsByUser(targetUserId);

    const profile = await getProfileAsync(ctx.targetLocalUser?.id || targetUserId).catch(() => ({}));
    const query = await fetchPagedSupabaseRows(() => ctx.client
      .from('applications')
      .select(REMOTE_APPLICATION_SELECT)
      .eq('user_id', ctx.targetRemoteId)
      .order('updated_at', { ascending: false }));
    if (query.error) {
      if (isRecoverableRemoteSyncError(query.error)) {
        console.warn('Falling back to local applications because the remote applications query is unavailable.', query.error);
        return getApplicationsByUser(targetUserId);
      }
      throw new Error(query.error.message || 'Could not load applications.');
    }

    const apps = await hydrateRemoteApplications(query.data || [], ctx.targetLocalUser?.id || targetUserId, profile);
    mirrorRemoteApplications(apps, ctx.targetLocalUser?.id || targetUserId);
    return apps;
  }

  async function syncRemotePaymentRecord(client, appId, payment, paymentStatus) {
    const normalizedPayment = normalizePaymentDetails(payment, paymentStatus);
    const status = paymentStatus || normalizedPayment?.status || STATUS.payment.PENDING;
    const storedNote = normalizedPayment ? serializePaymentNoteState(normalizedPayment) : '';

    const current = await client
      .from('payments')
      .select('*')
      .eq('application_id', appId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (current.error) {
      if (isRecoverableRemoteSyncError(current.error)) {
        console.warn('Skipping remote payment record sync because the payment query is unavailable.', current.error);
        return null;
      }
      throw new Error(current.error.message || 'Could not load payment record.');
    }

    const payload = {
      payer_name: normalizedPayment?.payerName || '',
      phone: normalizedPayment?.phone || '',
      reference: normalizedPayment?.reference || '',
      method: normalizedPayment?.method || '',
      note: storedNote,
      amount: Number(normalizedPayment?.amount || 0),
      status
    };

    if (current.data) {
      const updated = await client
        .from('payments')
        .update(payload)
        .eq('id', current.data.id);
      if (updated.error) {
        if (isRecoverableRemoteSyncError(updated.error)) {
          console.warn('Skipping remote payment record update because the payment table is unavailable.', updated.error);
          return current.data.id;
        }
        throw new Error(updated.error.message || 'Could not update payment record.');
      }
      return current.data.id;
    }

    const inserted = await client
      .from('payments')
      .insert({
        application_id: appId,
        ...payload
      })
      .select('id')
      .single();
    if (inserted.error) {
      if (isRecoverableRemoteSyncError(inserted.error)) {
        console.warn('Skipping remote payment record insert because the payment table is unavailable.', inserted.error);
        return null;
      }
      throw new Error(inserted.error.message || 'Could not create payment record.');
    }
    return inserted.data?.id || null;
  }

  async function updateApplicationAsync(appId, patch) {
    if (!isUuid(appId)) return updateApplication(appId, patch);
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return updateApplication(appId, patch);
    const currentApp = await getApplicationByIdAsync(appId).catch(() => null);

    try {
      const updates = {};
      const hasAssignmentPatch = Object.prototype.hasOwnProperty.call(patch || {}, 'assistantId')
        || Object.prototype.hasOwnProperty.call(patch || {}, 'assignedAssistantId');
      const requestedAssistantId = patch?.assignedAssistantId ?? patch?.assistantId ?? null;
      const currentAssignedAssistantId = currentApp?.assignedAssistantId || currentApp?.assistantId || null;

      if (Object.prototype.hasOwnProperty.call(patch || {}, 'assistantId')) {
        if (patch.assistantId) {
          const assistantCtx = await resolveSupabaseContext(patch.assistantId);
          updates.assistant_id = assistantCtx?.targetRemoteId || patch.assistantId || null;
        } else {
          updates.assistant_id = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'status')) updates.status = patch.status || STATUS.application.DRAFT;
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'paymentStatus')) updates.payment_status = patch.paymentStatus || STATUS.payment.PENDING;
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'submittedAt')) updates.submitted_at = patch.submittedAt || null;

      if (patch?.payment) {
        const nextPayment = normalizePaymentDetails(mergeDeep(currentApp?.payment || {}, patch.payment), patch.paymentStatus || currentApp?.paymentStatus);
        updates.payer_name = nextPayment?.payerName || '';
        updates.payer_phone = nextPayment?.phone || '';
        updates.payment_reference = nextPayment?.reference || '';
        updates.payment_method = nextPayment?.method || '';
        updates.payment_note = serializePaymentNoteState(nextPayment);
        updates.payment_amount = Number(nextPayment?.amount || 0);
      }

      if (Object.prototype.hasOwnProperty.call(patch || {}, 'package')) {
        const remotePack = await findRemotePackRecord(patch.package);
        updates.package_id = remotePack?.id || null;
      }

      if (hasAssignmentPatch) {
        updates.assigned_by = requestedAssistantId ? ctx.remoteSelfId : null;
        updates.assigned_at = requestedAssistantId ? nowISO() : null;
        updates.assignment_status = requestedAssistantId
          ? (currentAssignedAssistantId && String(currentAssignedAssistantId).trim() !== String(requestedAssistantId).trim() ? 'Reassigned' : 'Assigned')
          : 'Unassigned';
      }

      if (Object.keys(updates).length) {
        let baseUpdate = await ctx.client.from('applications').update(updates).eq('id', appId);
        if (baseUpdate.error && hasAssignmentPatch && isMissingAssignmentAuditColumnsError(baseUpdate.error)) {
          const fallbackUpdates = { ...updates };
          delete fallbackUpdates.assigned_by;
          delete fallbackUpdates.assigned_at;
          delete fallbackUpdates.assignment_status;
          baseUpdate = await ctx.client.from('applications').update(fallbackUpdates).eq('id', appId);
        }
        if (baseUpdate.error) throw new Error(baseUpdate.error.message || 'Could not update application.');
      }

      if (Object.prototype.hasOwnProperty.call(patch || {}, 'assistantId') || Object.prototype.hasOwnProperty.call(patch || {}, 'assignedAssistantId')) {
        try {
          updateApplication(appId, {
            assistantId: patch?.assistantId ?? null,
            assignedAssistantId: patch?.assignedAssistantId ?? patch?.assistantId ?? null
          });
        } catch (error) {
          console.warn('Could not mirror assignment metadata locally after remote application update.', error);
        }
      }

      if (Array.isArray(patch?.services)) {
        try {
          updateApplication(appId, { services: safeArray(patch.services).map(clone) });
        } catch (error) {
          console.warn('Could not mirror service items locally while syncing application.', error);
        }
      }

      if (Array.isArray(patch?.institutions)) {
        const safeInstitutions = safeArray(patch.institutions).map((institution) => {
          const matchedInstitution = ensureInstitutionAvailableForApplication(institution);
          return {
            ...institution,
            year: institution?.year || matchedInstitution?.year || String(new Date().getFullYear()),
            institutionStatus: matchedInstitution?.status || institution?.institutionStatus || '',
            canApply: matchedInstitution ? matchedInstitution.canApply : institution?.canApply
          };
        });
        const cleared = await ctx.client.from('application_institutions').delete().eq('application_id', appId);
        if (cleared.error) throw new Error(cleared.error.message || 'Could not refresh institutions.');

        if (safeInstitutions.length) {
          const rows = safeInstitutions.map((item) => ({
            application_id: appId,
            province: item?.province || '',
            institution_type: item?.institutionType || '',
            institution_name: item?.institutionName || item?.name || '',
            application_fee: Number(item?.applicationFee ?? 0),
            application_fee_label: item?.applicationFeeLabel || '',
            application_fee_note: item?.applicationFeeNote || '',
            faculty: item?.faculty || '',
            choice_1: item?.choice1 || '',
            choice_2: item?.choice2 || '',
            choice_3: item?.choice3 || ''
          }));
          const inserted = await ctx.client.from('application_institutions').insert(rows);
          if (inserted.error) throw new Error(inserted.error.message || 'Could not save institutions.');
        }
      }

      if (Array.isArray(patch?.forms?.marks?.subjects)) {
        const clearedMarks = await ctx.client.from('application_marks').delete().eq('application_id', appId);
        if (clearedMarks.error) throw new Error(clearedMarks.error.message || 'Could not refresh marks.');

        if (patch.forms.marks.subjects.length) {
          const rows = patch.forms.marks.subjects.map((mark) => ({
            application_id: appId,
            subject: mark?.subject || '',
            percent: Math.max(0, Math.min(100, Number(mark?.percent || 0))),
            level: Math.max(1, Math.min(7, Number(mark?.level || 1)))
          }));
          const insertedMarks = await ctx.client.from('application_marks').insert(rows);
          if (insertedMarks.error) throw new Error(insertedMarks.error.message || 'Could not save marks.');
        }
      }

      const nextPaymentStatus = patch?.paymentStatus || currentApp?.paymentStatus || STATUS.payment.PENDING;
      const nextPayment = patch?.payment || patch?.paymentStatus
        ? normalizePaymentDetails(mergeDeep(currentApp?.payment || {}, patch?.payment || {}), nextPaymentStatus)
        : null;

      if (patch?.payment || patch?.paymentStatus) {
        await syncRemotePaymentRecord(ctx.client, appId, nextPayment, nextPaymentStatus);
      }

      const refreshed = await getApplicationByIdAsync(appId);
      if (patch?.status || patch?.paymentStatus) {
        let message = `Status: ${refreshed.status} | Payment: ${refreshed.paymentStatus}`;
        let type = 'info';
        if (patch?.paymentStatus && patch.paymentStatus !== currentApp?.paymentStatus) {
          if (refreshed.paymentStatus === STATUS.payment.REJECTED) {
            message = refreshed.payment?.rejectionReason
              ? `Your payment proof was rejected. Reason: ${refreshed.payment.rejectionReason}`
              : 'Your payment proof was rejected. Please upload a clearer proof of payment.';
            type = 'warning';
          } else if (refreshed.paymentStatus === STATUS.payment.VERIFIED) {
            message = 'Your payment has been verified successfully.';
            type = 'success';
          } else if (refreshed.paymentStatus === STATUS.payment.PENDING_VERIFICATION) {
            message = refreshed.payment?.proofUploadedAt
              ? 'Your proof of payment has been uploaded and is pending verification.'
              : 'Your payment is pending verification.';
          }
        }
        await pushNotificationAsync(refreshed.userId, 'Application updated', message, type).catch(() => {});
      }
      if (actor.role === ROLES.ASSISTANT || actor.role === ROLES.MASTER) {
        await logAssistantActivityAsync({
          assistantId: actor.id,
          applicationId: refreshed.id,
          action: 'update_application',
          details: { status: refreshed.status, paymentStatus: refreshed.paymentStatus }
        }).catch(() => {});
      }
      return refreshed;
    } catch (error) {
      if (isRecoverableRemoteSyncError(error)) {
        console.warn('Falling back to local application update because remote application sync is unavailable.', error);
        return updateApplication(appId, patch);
      }
      throw error;
    }
  }

  function reviewPaymentByAdmin(applicationId, review) {
    const actor = requireRole([ROLES.MASTER]);
    const app = getApplicationById(applicationId);
    if (!app) throw new Error('Application not found.');

    const nextStatus = review?.status || app.paymentStatus || STATUS.payment.PENDING_VERIFICATION;
    const reason = String(review?.reason || '').trim();
    const currentPayment = normalizePaymentDetails(app.payment, app.paymentStatus) || {
      payerName: '',
      phone: '',
      reference: '',
      note: '',
      method: '',
      amount: 0,
      submittedAt: app.submittedAt || nowISO()
    };
    const nextPayment = {
      ...currentPayment,
      status: nextStatus,
      verificationNote: nextStatus === STATUS.payment.REJECTED ? '' : reason,
      rejectionReason: nextStatus === STATUS.payment.REJECTED ? reason : '',
      reviewedAt: nowISO(),
      verifiedAt: nextStatus === STATUS.payment.VERIFIED ? nowISO() : ''
    };

    const updated = updateApplication(applicationId, {
      paymentStatus: nextStatus,
      payment: nextPayment
    });
    logAssistantActivity({
      assistantId: actor.id,
      applicationId,
      action: 'review_payment',
      details: { paymentStatus: nextStatus, rejectionReason: nextPayment.rejectionReason || '' }
    });
    return updated;
  }

  async function reviewPaymentByAdminAsync(applicationId, review) {
    const actor = requireRole([ROLES.MASTER]);
    if (!isUuid(applicationId)) return reviewPaymentByAdmin(applicationId, review);
    const app = await getApplicationByIdAsync(applicationId);
    if (!app) throw new Error('Application not found.');

    const nextStatus = review?.status || app.paymentStatus || STATUS.payment.PENDING_VERIFICATION;
    const reason = String(review?.reason || '').trim();
    const currentPayment = normalizePaymentDetails(app.payment, app.paymentStatus) || {
      payerName: '',
      phone: '',
      reference: '',
      note: '',
      method: '',
      amount: 0,
      submittedAt: app.submittedAt || nowISO()
    };
    const nextPayment = {
      ...currentPayment,
      status: nextStatus,
      verificationNote: nextStatus === STATUS.payment.REJECTED ? '' : reason,
      rejectionReason: nextStatus === STATUS.payment.REJECTED ? reason : '',
      reviewedAt: nowISO(),
      verifiedAt: nextStatus === STATUS.payment.VERIFIED ? nowISO() : ''
    };

    const updated = await updateApplicationAsync(applicationId, {
      paymentStatus: nextStatus,
      payment: nextPayment
    });
    await logAssistantActivityAsync({
      assistantId: actor.id,
      applicationId,
      action: 'review_payment',
      details: { paymentStatus: nextStatus, rejectionReason: nextPayment.rejectionReason || '' }
    }).catch(() => {});
    return updated;
  }

  async function saveFormSectionAsync(sectionName, data, appIdArg) {
    const user = requireRole([ROLES.USER]);
    const app = appIdArg ? await getApplicationByIdAsync(appIdArg, user.id) : await ensureDraftAsync(user.id);
    if (!app) throw new Error('Draft application not found.');

    if (!isSupabaseEnabled()) return saveFormSection(sectionName, data, appIdArg);

    if (sectionName === 'learner') {
      await saveProfileAsync(user.id, {
        ...data,
        fullName: data?.fullNames || data?.fullName || '',
        fullNames: data?.fullNames || data?.fullName || '',
        phone: data?.cellphone || data?.phone || '',
        cellphone: data?.cellphone || data?.phone || ''
      });
      try {
        updateApplication(app.id, {
          forms: {
            learner: data || {}
          }
        });
      } catch (error) {
        console.warn('Could not mirror learner form data locally after live save.', error);
      }
      return getApplicationByIdAsync(app.id, user.id);
    }

    if (sectionName === 'parent') {
      await saveProfileAsync(user.id, {
        guardianRelation: data?.guardianRelation || '',
        guardianId: data?.guardianId || '',
        guardianName: data?.guardianFullNames || data?.guardianName || '',
        guardianFullNames: data?.guardianFullNames || data?.guardianName || '',
        guardianSurname: data?.guardianSurname || '',
        guardianPhone: data?.guardianCell1 || data?.guardianPhone || '',
        guardianCell1: data?.guardianCell1 || data?.guardianPhone || '',
        guardianPhoneAlt: data?.guardianCell2 || data?.guardianPhoneAlt || '',
        guardianCell2: data?.guardianCell2 || data?.guardianPhoneAlt || '',
        guardianEmail: data?.guardianEmail || '',
        guardianProvince: data?.guardianProvince || '',
        guardianPostal: data?.guardianPostal || '',
        guardianAddress: data?.guardianAddress || ''
      });
      try {
        updateApplication(app.id, {
          forms: {
            parent: data || {}
          }
        });
      } catch (error) {
        console.warn('Could not mirror guardian form data locally after live save.', error);
      }
      return getApplicationByIdAsync(app.id, user.id);
    }

    if (sectionName === 'school') {
      await saveProfileAsync(user.id, {
        schoolName: data?.schoolName || '',
        schoolAttended: data?.schoolName || '',
        confirmName: data?.confirmName || data?.schoolName || '',
        schoolProvince: data?.schoolProvince || '',
        schoolType: data?.schoolType || '',
        completionYear: data?.completionYear || '',
        average: data?.average || ''
      });
      try {
        updateApplication(app.id, {
          forms: {
            school: data || {}
          }
        });
      } catch (error) {
        console.warn('Could not mirror school form data locally after live save.', error);
      }
      return getApplicationByIdAsync(app.id, user.id);
    }

    if (sectionName === 'marks') {
      const subjects = safeArray(data?.subjects || data);
      return updateApplicationAsync(app.id, {
        forms: {
          marks: {
            subjects
          }
        }
      });
    }

    return saveFormSection(sectionName, data, appIdArg);
  }

  async function addInstitutionToDraftAsync(institution, appIdArg) {
    const user = requireRole([ROLES.USER]);
    const app = appIdArg ? await getApplicationByIdAsync(appIdArg, user.id) : await ensureDraftAsync(user.id);
    if (!app) throw new Error('Draft application not found.');
    const matchedInstitution = ensureInstitutionAvailableForApplication(institution);

    const entry = {
      id: institution?.id || uid('inst'),
      institutionName: institution?.institutionName || institution?.name || '',
      province: institution?.province || '',
      institutionType: institution?.institutionType || '',
      year: institution?.year || matchedInstitution?.year || String(new Date().getFullYear()),
      applicationFee: roundMoney(institution?.applicationFee ?? matchedInstitution?.applicationFee ?? 0),
      applicationFeeLabel: institution?.applicationFeeLabel || matchedInstitution?.applicationFeeLabel || '',
      applicationFeeNote: institution?.applicationFeeNote || matchedInstitution?.applicationFeeNote || '',
      institutionStatus: institution?.institutionStatus || matchedInstitution?.status || 'open',
      closingDate: institution?.closingDate || matchedInstitution?.closingDate || matchedInstitution?.applicationDeadline || '',
      faculty: institution?.faculty || '',
      choice1: institution?.choice1 || '',
      choice2: institution?.choice2 || '',
      choice3: institution?.choice3 || '',
      createdAt: nowISO()
    };

    return updateApplicationAsync(app.id, {
      institutions: safeArray(app.institutions).concat(entry)
    });
  }

  async function removeInstitutionFromDraftAsync(institutionId, appIdArg) {
    const user = requireRole([ROLES.USER]);
    const app = appIdArg ? await getApplicationByIdAsync(appIdArg, user.id) : await ensureDraftAsync(user.id);
    if (!app) throw new Error('Draft application not found.');

    return updateApplicationAsync(app.id, {
      institutions: safeArray(app.institutions).filter((item) => item.id !== institutionId)
    });
  }

  async function getCartAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return getCart(targetUserId);

    const query = await remote.client.from('cart_items').select('*').eq('cart_id', remote.cart.id).order('created_at', { ascending: true });
    if (query.error) {
      console.warn('Falling back to local cart because remote cart items could not load.', query.error);
      return getCart(targetUserId);
    }

    const localFallback = getCart(targetUserId);
    const items = mergeRemoteCartWithLocalFallback(
      safeArray(query.data).map(normalizeRemoteCartItem),
      localFallback
    );
    mirrorRemoteCart(items, remote.targetLocalUser?.id || remote.viewer.id);
    return items;
  }

  async function addCartItemAsync(itemArg, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const item = typeof itemArg === 'string' ? userIdArg : itemArg;
    const targetUserId = typeof itemArg === 'string' ? itemArg : userIdArg || actor.id;
    const clientKey = String(item?.clientKey || item?.id || uid('cartsync')).trim();
    const localCopy = addCartItem({
      ...(item || {}),
      clientKey,
      syncState: 'syncing'
    }, targetUserId);
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return localCopy;

    const normalizedType = item?.type === 'service_request' ? 'service' : item?.type || 'custom';
    const remotePack = normalizedType === 'application_pack' ? await findRemotePackRecord(item) : null;
    const itemId = String(item?.id || uid('cart')).trim();
    const finalItem = {
      ...(item || {}),
      id: itemId,
      clientKey,
      type: normalizedType,
      name: item?.name || item?.serviceName || item?.packName || item?.institutionName || 'Cart item',
      price: Number(item?.price ?? item?.packPrice ?? item?.servicePrice ?? 0),
      quantity: Number(item?.quantity || 1),
      createdAt: item?.createdAt || nowISO(),
      syncState: 'synced'
    };

    const insert = await remote.client.from('cart_items').insert({
      cart_id: remote.cart.id,
      item_type: normalizedType,
      ref_id: remotePack?.id || (isUuid(item?.refId) ? item.refId : null),
      name: finalItem.name,
      price: Number(finalItem.price || 0),
      quantity: Number(finalItem.quantity || 1),
      metadata: finalItem
    }).select('*').single();

    if (insert.error) {
      console.warn('Keeping local cart item because remote cart insert failed.', insert.error);
      addCartItem({
        ...localCopy,
        clientKey,
        syncState: 'local_only'
      }, targetUserId);
      return localCopy;
    }

    const rows = await getCartAsync(targetUserId);
    await syncRemoteCartTotal(remote.cart.id, targetUserId);
    return normalizeRemoteCartItem(insert.data) || rows[rows.length - 1];
  }

  async function replaceApplicationPackCartItemAsync(itemArg, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const item = itemArg && typeof itemArg === 'object' ? clone(itemArg) : {};
    const targetUserId = userIdArg || actor.id;
    const clientKey = String(item?.clientKey || item?.id || uid('cartsync')).trim();
    const itemId = String(item?.id || uid('cart')).trim();
    const finalItem = {
      ...item,
      id: itemId,
      clientKey,
      type: 'application_pack',
      name: item?.name || item?.packName || 'Application pack',
      price: Number(item?.price ?? item?.packPrice ?? 0),
      quantity: Number(item?.quantity || 1),
      createdAt: item?.createdAt || nowISO(),
      syncState: 'syncing'
    };

    const localItems = getCart(targetUserId).filter((entry) => entry.type !== 'application_pack');
    localItems.push({
      ...finalItem,
      syncState: isSupabaseEnabled() ? 'syncing' : 'local'
    });
    saveCart(localItems, targetUserId);

    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) {
      const localOnlyItem = {
        ...finalItem,
        syncState: 'local'
      };
      saveCart(
        getCart(targetUserId)
          .filter((entry) => entry.type !== 'application_pack')
          .concat(localOnlyItem),
        targetUserId
      );
      return localOnlyItem;
    }

    const remotePack = await findRemotePackRecord(item).catch(() => null);
    const deleted = await remote.client
      .from('cart_items')
      .delete()
      .eq('cart_id', remote.cart.id)
      .eq('item_type', 'application_pack');
    if (deleted.error) {
      console.warn('Keeping local package cart item because remote package cleanup failed.', deleted.error);
      const localOnlyItem = { ...finalItem, syncState: 'local_only' };
      saveCart(
        getCart(targetUserId)
          .filter((entry) => entry.type !== 'application_pack')
          .concat(localOnlyItem),
        targetUserId
      );
      return localOnlyItem;
    }

    const inserted = await remote.client.from('cart_items').insert({
      cart_id: remote.cart.id,
      item_type: 'application_pack',
      ref_id: remotePack?.id || (isUuid(item?.refId) ? item.refId : null),
      name: finalItem.name,
      price: Number(finalItem.price || 0),
      quantity: Number(finalItem.quantity || 1),
      metadata: {
        ...finalItem,
        syncState: 'synced'
      }
    }).select('*').single();

    if (inserted.error) {
      console.warn('Keeping local package cart item because remote package insert failed.', inserted.error);
      const localOnlyItem = { ...finalItem, syncState: 'local_only' };
      saveCart(
        getCart(targetUserId)
          .filter((entry) => entry.type !== 'application_pack')
          .concat(localOnlyItem),
        targetUserId
      );
      return localOnlyItem;
    }

    await syncRemoteCartTotal(remote.cart.id, targetUserId).catch((error) => {
      console.warn('Could not refresh the live cart total after replacing the application pack.', error);
    });

    const syncedItem = normalizeRemoteCartItem(inserted.data) || { ...finalItem, syncState: 'synced' };
    saveCart(
      getCart(targetUserId)
        .filter((entry) => entry.type !== 'application_pack')
        .concat(syncedItem),
      targetUserId
    );
    return syncedItem;
  }

  async function updateCartItemAsync(itemId, patchArg, userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const localCopy = updateCartItem(itemId, patchArg, targetUserId);
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return localCopy;

    const update = await remote.client
      .from('cart_items')
      .update({
        item_type: localCopy.type || 'custom',
        ref_id: isUuid(localCopy?.refId) ? localCopy.refId : null,
        name: localCopy.name || 'Cart item',
        price: Number(localCopy.price || 0),
        quantity: Number(localCopy.quantity || 1),
        metadata: localCopy
      })
      .eq('id', itemId)
      .select('*')
      .single();

    if (update.error) {
      console.warn('Keeping local cart item update because remote cart update failed.', update.error);
      return {
        ...localCopy,
        syncState: 'local_only'
      };
    }

    await syncRemoteCartTotal(remote.cart.id, targetUserId);
    return normalizeRemoteCartItem(update.data) || localCopy;
  }

  async function removeCartItemAsync(itemId, userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const localRows = removeCartItem(itemId, targetUserId);
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return localRows;

    const deleted = await remote.client.from('cart_items').delete().eq('id', itemId);
    if (deleted.error) {
      console.warn('Keeping local cart removal because remote cart delete failed.', deleted.error);
      return localRows;
    }

    await syncRemoteCartTotal(remote.cart.id, targetUserId);
    return getCartAsync(targetUserId);
  }

  async function clearCartAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    clearCart(targetUserId);
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return true;

    const cleared = await remote.client.from('cart_items').delete().eq('cart_id', remote.cart.id);
    if (cleared.error) {
      console.warn('Keeping local cart clear because remote cart clear failed.', cleared.error);
      return true;
    }

    await syncRemoteCartTotal(remote.cart.id, targetUserId, []);
    mirrorRemoteCart([], remote.targetLocalUser?.id || remote.viewer.id);
    return true;
  }

  async function clearAppliedPromoCodeAsync(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const items = await getCartAsync(userId);
    const promoItems = safeArray(items).filter((item) => isPromoDiscountItem(item));
    for (const item of promoItems) {
      if (removeCartItemAsync) await removeCartItemAsync(item.id, userId);
      else removeCartItem(item.id, userId);
    }
    return getCartPricingSummaryAsync(userId);
  }

  async function applyPromoCodeAsync(codeArg, userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const code = normalizePromoCodeValue(codeArg);
    const promo = await getPromoCampaignByCodeAsync(code, { includeInactive: false });
    if (!promo) throw new Error('Promo code not found or inactive.');

    const currentItems = await getCartAsync(userId);
    const promoItems = safeArray(currentItems).filter((item) => isPromoDiscountItem(item));
    for (const item of promoItems) {
      if (removeCartItemAsync) await removeCartItemAsync(item.id, userId);
      else removeCartItem(item.id, userId);
    }

    const baseItems = getCartItemsWithoutPromo(await getCartAsync(userId));
    const validationMessage = getPromoValidationMessage(promo, userId, baseItems);
    if (validationMessage) throw new Error(validationMessage);

    const discountAmount = calculatePromoDiscountAmount(promo, baseItems);
    if (addCartItemAsync) await addCartItemAsync(buildPromoDiscountCartItem(promo, discountAmount), userId);
    else addCartItem(buildPromoDiscountCartItem(promo, discountAmount), userId);
    savePendingPromoCode('');
    return getCartPricingSummaryAsync(userId);
  }

  async function syncAppliedPromoCodeAsync(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER]).id;
    const currentItems = await getCartAsync(userId);
    const currentPromo = getAppliedPromoFromCartItems(currentItems);

    if (currentPromo?.code) {
      try {
        return await applyPromoCodeAsync(currentPromo.code, userId);
      } catch (_error) {
        return clearAppliedPromoCodeAsync(userId);
      }
    }

    const pendingCode = getPendingPromoCode();
    if (pendingCode) {
      try {
        return await applyPromoCodeAsync(pendingCode, userId);
      } catch (_error) {
        return getCartPricingSummary(userId, currentItems);
      }
    }

    return getCartPricingSummary(userId, currentItems);
  }

  async function getCartPricingSummaryAsync(userIdArg) {
    const items = await getCartAsync(userIdArg);
    return getCartPricingSummary(userIdArg, items);
  }

  async function getCartTotalAsync(userIdArg) {
    const summary = await getCartPricingSummaryAsync(userIdArg);
    return summary.total;
  }

  async function linkPaymentProofToApplicationAsync(appIdArg, proofDoc, userIdArg) {
    const targetUserId = userIdArg || proofDoc?.userId || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const app = appIdArg ? await getApplicationByIdAsync(appIdArg, targetUserId) : await getLatestApplicationAsync(targetUserId);
    if (!app || !proofDoc) return null;

    const next = buildPaymentProofState(app, proofDoc);
    const updated = await updateApplicationAsync(app.id, next);
    await pushNotificationAsync(updated.userId, 'Proof of payment uploaded', 'Your proof of payment was saved and sent for verification.', 'info').catch(() => {});
    await notifyStaffForApplicationEventAsync(updated, {
      title: 'Learner uploaded proof of payment',
      message: `${buildLearnerAlertMessage(updated, 'A learner')} uploaded proof of payment${updated.payment?.reference ? ` for reference ${updated.payment.reference}` : ''}. Open the payment review lane to verify it.`,
      type: 'warning'
    }).catch(() => {});
    return updated;
  }

  async function submitApplicationFromCartAsync(paymentData) {
    const user = requireRole([ROLES.USER]);
    const ctx = await resolveSupabaseContext(user.id);
    if (!ctx) return submitApplicationFromCart(paymentData);
    try {
      const cart = await getCartAsync(user.id);
      if (!cart.length) throw new Error('Your cart is empty.');

      const app = await ensureDraftAsync(user.id);
      const pricing = getCartPricingSummary(user.id, cart);
      const appliedPromo = pricing.promo || null;
      const packageItem = cart.find((item) => item.type === 'application_pack') || null;
      const serviceItems = cart
        .filter((item) => item.type === 'service' || item.type === 'service_request')
        .map((item) => (isTransportServiceItem(item) ? decorateTransportServiceForManualBooking(item, paymentData) : clone(item)));
      const institutions = safeArray(packageItem?.institutions).length ? clone(packageItem.institutions) : safeArray(app.institutions);
      const amount = pricing.total;
      const submittedPayment = normalizePaymentDetails({
        payerName: paymentData?.payerName || '',
        phone: paymentData?.phone || '',
        reference: paymentData?.reference || '',
        note: paymentData?.note || '',
        method: paymentData?.method || '',
        amount,
        promoCode: appliedPromo?.code || '',
        promoTitle: appliedPromo?.title || '',
        offerNote: appliedPromo?.offerNote || '',
        discountAmount: pricing.discount,
        submittedAt: nowISO(),
        status: STATUS.payment.PENDING_VERIFICATION
      }, STATUS.payment.PENDING_VERIFICATION);

      const updated = await updateApplicationAsync(app.id, {
        package: packageItem || app.package || null,
        institutions,
        services: serviceItems,
        payment: submittedPayment,
        status: STATUS.application.PROCESSING,
        paymentStatus: STATUS.payment.PENDING_VERIFICATION,
        submittedAt: nowISO()
      });
      const transportRequests = syncTransportRequestsFromPaidServices(serviceItems, user, updated, submittedPayment);

      await clearCartAsync(user.id);
      if (appliedPromo?.code) {
        await markPromoCampaignRedeemedAsync(appliedPromo.code, user.id).catch(() => {
          markPromoCampaignRedeemed(appliedPromo.code, user.id);
        });
        savePendingPromoCode('');
      }
      await pushNotificationAsync(
        user.id,
        'Payment received',
        'Your application is being processed and payment is pending verification.',
        'success'
      ).catch(() => {
        pushNotification(user.id, 'Payment received', 'Your application is being processed and payment is pending verification.', 'success');
      });
      if (transportRequests.length) {
        await pushNotificationAsync(
          user.id,
          'Transport request received',
          'Kagie received your transport payment. The master admin and assistants will book the ticket manually and send it to your account.',
          'info'
        ).catch(() => {
          pushNotification(user.id, 'Transport request received', 'Kagie received your transport payment. The master admin and assistants will book the ticket manually and send it to your account.', 'info');
        });
        await notifyStaffForTransportRequestsAsync(transportRequests, updated).catch(() => {});
      }
      await notifyStaffForApplicationEventAsync(updated, {
        title: 'Learner submitted a payment',
        message: `${buildLearnerAlertMessage(updated, 'A learner')} submitted ${submittedPayment.method || 'a payment'}${submittedPayment.reference ? ` with reference ${submittedPayment.reference}` : ''} for ${formatMoneyLabel(submittedPayment.amount)}. Kagie is waiting for verification.`,
        type: 'warning'
      }).catch(() => {});
      return getApplicationByIdAsync(updated.id, user.id);
    } catch (error) {
      console.warn('Falling back to local payment submission because remote checkout failed.', error);
      return submitApplicationFromCart(paymentData);
    }
  }

  async function getDashboardSummaryAsync(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const ctx = await resolveSupabaseContext(userId);
    if (!ctx) return getDashboardSummary(userId);

    const [profile, applications, notifications, docs, reviews] = await Promise.all([
      getProfileAsync(userId).catch(() => ({})),
      getApplicationsByUserAsync(userId).catch(() => []),
      getNotificationsAsync(userId).catch(() => getNotifications(userId)),
      getDocumentsByUserAsync(userId).catch(() => getDocumentsByUser(userId)),
      getDocumentReviewsForUserAsync(userId).catch(() => getDocumentReviewsForUser(userId))
    ]);
    const latest = applications[0] || (userId === viewer.id ? await ensureDraftAsync(userId) : null);
    const marks = safeArray(latest?.forms?.marks?.subjects);
    const packageUsage = getPackageUsageSummary(latest);
    const recommendations = getApplicationRecommendations({
      marks,
      year: safeArray(latest?.institutions)[0]?.year || String(new Date().getFullYear()),
      province: safeArray(latest?.institutions)[0]?.province || '',
      institutionType: safeArray(latest?.institutions)[0]?.institutionType || '',
      limit: 6
    });
    const recentNotifications = notifications.slice(0, 5);
    const unreadNotifications = notifications.filter((item) => !item.read).length;
    const notes = latest?.id ? getApplicationNotes(latest.id) : [];
    const favorites = getFavorites(userId);
    const accommodationRequests = getAccommodationRequests(userId);
    const transportRequests = getTransportRequests(userId);
    const serviceRequests = getServiceRequestsFromApplications(applications, userId)
      .concat(accommodationRequests.map(accommodationRequestToServiceItem))
      .concat(transportRequests.map(transportRequestToServiceItem));
    const preferences = getUserExperiencePreferences(userId);
    const serviceOverview = buildServiceOverview(serviceRequests);
    const deadlines = safeArray(latest?.institutions)
      .map((item) => getInstitutionForSelection(item))
      .filter(Boolean)
      .map((institution) => ({
        institutionName: institution.name,
        deadline: institution.closingDate || institution.applicationDeadline || ''
      }))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const pendingTasks = [];
    if (!latest?.package) pendingTasks.push('Choose an application pack');
    if (!safeArray(latest?.institutions).length) pendingTasks.push('Add at least one institution');
    if (docs.length < 2) pendingTasks.push('Upload supporting documents');
    if (latest?.paymentStatus === STATUS.payment.PENDING && !latest?.payment?.proofUploadedAt) pendingTasks.push('Upload proof of payment');
    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION) pendingTasks.push('Wait for payment verification');
    if (latest?.paymentStatus === STATUS.payment.REJECTED) pendingTasks.push('Re-upload proof of payment');
    if (latest?.status === STATUS.application.MISSING_DOCUMENTS) pendingTasks.push('Resolve missing documents');

    const smartAlerts = [];
    if (unreadNotifications) smartAlerts.push(`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`);
    if (latest?.status === STATUS.application.PROCESSING) smartAlerts.push('Your application is being processed');
    if (latest?.paymentStatus === STATUS.payment.REJECTED) smartAlerts.push(latest?.payment?.rejectionReason ? `Payment proof rejected: ${latest.payment.rejectionReason}` : 'Your payment proof was rejected and needs a re-upload');
    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION && latest?.payment?.proofUploadedAt) smartAlerts.push('Proof of payment uploaded and waiting for verification');
    if (deadlines[0]?.deadline) smartAlerts.push(`Nearest deadline: ${deadlines[0].institutionName}`);
      if (recommendations.aps.total) smartAlerts.push(`Current APS: ${recommendations.aps.total}`);
      if (recommendations.safeAlternatives[0]) smartAlerts.push(`Recommended: ${recommendations.safeAlternatives[0].course} at ${recommendations.safeAlternatives[0].institutionName}`);

      const reminders = buildReminderEntries({
        latest,
        deadlines,
        documents: docs,
        favorites,
        serviceRequests,
        recommendations
      });
      reminders.slice(0, 3).forEach((entry) => smartAlerts.push(entry.title));
      const acceptanceChecklist = buildAcceptanceChecklist(latest, docs, serviceOverview);

      const latestForReadiness = latest
        ? {
            ...latest,
          forms: {
            learner: profileToLearnerForm(profile),
            parent: profileToParentForm(profile),
            school: profileToSchoolForm(profile),
            marks: { subjects: safeArray(latest.forms?.marks?.subjects) }
          }
        }
      : null;
      const journeyBoard = buildJourneyBoard({
        latest,
        documents: docs,
        packageUsage,
        serviceOverview,
        acceptanceChecklist
      });
      const priorityActions = buildPriorityActions({
        latest,
        documents: docs,
        favorites,
        recommendations,
        acceptanceChecklist,
        serviceOverview
      });

    return {
      user: userId === viewer.id ? viewer : sanitizeUser(getUserById(userId)),
        latestApplication: latestForReadiness,
        preferences,
        packageUsage,
        recommendations,
        applications,
        favorites,
        serviceRequests,
        accommodationRequests,
        transportRequests,
        serviceOverview,
        reminders,
        notifications: recentNotifications,
        unreadNotifications,
        documents: docs,
        reviews,
        notes,
        journeyBoard,
        priorityActions,
        acceptanceChecklist,
      deadlines,
      pendingTasks,
      readiness: calculateReadiness(latestForReadiness, docs),
      smartAlerts,
      cartTotal: userId === viewer.id ? await getCartTotalAsync(userId) : 0
    };
  }

  function normalizeInstitutionRecord(item) {
    const choices = Array.isArray(item?.choices) ? item.choices : [];
    const institutionName = item?.institutionName || item?.institution || item?.university || item?.name || '';
    const matchedInstitution = getInstitutionByNameAndYear(institutionName, item?.year);

    return {
      id: item?.id || uid('inst'),
      institutionName,
      institution: institutionName,
      university: institutionName,
      province: item?.province || '',
      institutionType: item?.institutionType || item?.type || '',
      year: item?.year || matchedInstitution?.year || String(new Date().getFullYear()),
      applicationFee: roundMoney(item?.applicationFee ?? matchedInstitution?.applicationFee ?? 0),
      applicationFeeLabel: item?.applicationFeeLabel || matchedInstitution?.applicationFeeLabel || '',
      applicationFeeNote: item?.applicationFeeNote || matchedInstitution?.applicationFeeNote || '',
      institutionStatus: item?.institutionStatus || item?.status || matchedInstitution?.status || 'open',
      closingDate: item?.closingDate || matchedInstitution?.closingDate || matchedInstitution?.applicationDeadline || '',
      faculty: item?.faculty || '',
      choice1: item?.choice1 || item?.course || item?.programme || choices[0] || '',
      choice2: item?.choice2 || choices[1] || '',
      choice3: item?.choice3 || choices[2] || '',
      choice: item?.choice || 1,
      createdAt: item?.createdAt || nowISO()
    };
  }

  function toLegacyApplicationItems(app) {
    const source = safeArray(app?.items).length ? safeArray(app.items) : safeArray(app?.institutions);
    return source.map((item, index) => {
      const normalized = normalizeInstitutionRecord(item);
      return {
        ...normalized,
        institution: normalized.institutionName,
        university: normalized.institutionName,
        course: normalized.choice1 || '',
        programme: normalized.choice1 || '',
        choice: normalized.choice || index + 1
      };
    });
  }

  function legacyApplicationView(app) {
    if (!app) return null;

    const safeApp = clone(app);
    const user = getUserById(safeApp.userId);

    return {
      ...safeApp,
      applicant: safeApp.applicant || user?.fullName || '',
      assignedAssistantId: safeApp.assignedAssistantId || safeApp.assistantId || null,
      institutions: safeArray(safeApp.institutions).map(normalizeInstitutionRecord),
      items: toLegacyApplicationItems(safeApp)
    };
  }

  function getApplication(applicationId) {
    return legacyApplicationView(getApplicationById(applicationId));
  }

  function getApplications() {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const apps = viewer.role === ROLES.USER ? getApplicationsByUser(viewer.id) : getAllApplicationsForAdmin();
    return apps.map(legacyApplicationView);
  }

  function saveApplication(appArg) {
    if (!appArg?.id) throw new Error('Application id is required.');

    const current = getApplicationById(appArg.id);
    const institutionsSource = safeArray(appArg.institutions).length ? appArg.institutions : safeArray(appArg.items);
    const institutions = institutionsSource.map(normalizeInstitutionRecord);
    const patch = {
      ...appArg,
      assistantId: appArg?.assistantId ?? appArg?.assignedAssistantId ?? current?.assistantId ?? null,
      applicant: appArg?.applicant || getUserById(appArg?.userId || current?.userId)?.fullName || current?.applicant || '',
      institutions: institutions.length ? institutions : current?.institutions || []
    };

    if (current) {
      return legacyApplicationView(updateApplication(appArg.id, patch));
    }

    const base = buildDraft(appArg.userId || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id);
    const created = mergeDeep(base, patch);
    const apps = getAllApplications();
    apps.push(created);
    saveAllApplications(apps);
    return legacyApplicationView(created);
  }

  function getNotes(applicationId) {
    return getApplicationNotes(applicationId).map((note) => ({
      ...note,
      assistantId: note.authorId,
      noteText: note.text
    }));
  }

  function addNote(applicationId, assistantId, noteText) {
    const entry = addApplicationNote(applicationId, noteText);
    return {
      ...entry,
      assistantId: entry.authorId,
      noteText: entry.text
    };
  }

  function getDocuments(userIdArg) {
    return getDocumentsByUser(userIdArg).map((doc) => ({
      ...doc,
      title: doc.name,
      fileName: doc.name,
      mimeType: doc.type
    }));
  }

  function submitPayment(userIdOrPayment, paymentArg) {
    const payment = typeof userIdOrPayment === 'string' ? paymentArg : userIdOrPayment;
    return submitApplicationFromCart(payment || {});
  }

  function getSharedProfilePhoto() {
    const photo = (
      currentUser()?.profileImage ||
      localStorage.getItem('kagie_profile_photo') ||
      localStorage.getItem('kagieProfileImage') ||
      localStorage.getItem('kagie_profile_avatar_v1') ||
      ''
    );
    const text = String(photo || '');
    if (
      text.startsWith('data:image/svg+xml')
      && (
        text.includes('d50000')
        || text.includes('2f7cff')
        || text.includes('linearGradient')
        || text.includes('url(%23bg)')
        || text.includes('url(#bg)')
      )
    ) {
      try {
        localStorage.removeItem('kagie_profile_avatar_v1');
      } catch (_error) {
        // Ignore storage cleanup failures and continue with an empty fallback.
      }
      return '';
    }
    return photo;
  }

  function getCatalog() {
    const data = getKagieData();
    return {
      ...clone(data),
      applicationPacks: getPackCatalog(),
      accommodationListings: getMergedAccommodationListingRecords(),
      transportOptions: getMergedTransportOptionRecords(),
      institutions: getInstitutionCatalog({ includeInactive: true }),
      prospectus: getProspectusCatalog(),
      institutionYears: getInstitutionYears()
    };
  }

  function createAssistant(data) {
    requireRole([ROLES.MASTER]);
    return createAssistantAccount(data);
  }

  async function removeAssistant(userId) {
    requireRole([ROLES.MASTER]);
    const assistant = getUserByIdentity(userId);
    if (!assistant || assistant.role !== ROLES.ASSISTANT) throw new Error('Assistant not found.');

    const removeLocalAssistant = () => {
      clearAssistantReferencesLocally(assistant.id);
      deleteUserByAdmin(assistant.id);
      return true;
    };

    const settings = getSettings();
    const endpoint = String(settings?.supabase?.adminCreateAssistantEndpoint || '').trim();
    const remoteAssistantId = String(assistant.supabaseUserId || '').trim();

    if (!endpoint || !remoteAssistantId) {
      return removeLocalAssistant();
    }

    try {
      const session = await getSupabaseSession().catch(() => read(KEYS.supabaseSessionCache, null));
      const accessToken = session?.access_token || read(KEYS.supabaseSessionCache, null)?.access_token || '';
      if (!accessToken && isLocalEnvironment()) {
        return removeLocalAssistant();
      }

      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          assistantId: remoteAssistantId,
          email: assistant.email
        })
      });
      const rawBody = await response.text().catch(() => '');
      let payload = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch (_error) {
          payload = { message: String(rawBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
        }
      }

      if (!response.ok) {
        if (isLocalEnvironment()) {
          console.warn('Secure assistant removal failed locally, removing local assistant only.', payload?.message || rawBody || response.statusText);
          return removeLocalAssistant();
        }
        throw new Error(payload?.message || payload?.error || response.statusText || 'Assistant removal failed.');
      }

      return removeLocalAssistant();
    } catch (err) {
      if (isLocalEnvironment()) {
        console.warn('Assistant removal fell back to local cleanup:', err?.message || err);
        return removeLocalAssistant();
      }
      throw new Error(err?.message || 'Could not remove assistant account.');
    }
  }

  function stats() {
    const totals = getAdminSummary().totals;
    const apps = getAllApplications();
    return {
      users: totals.users,
      assistants: totals.assistants,
      applications: totals.applications,
      pendingPayments: totals.pendingVerification,
      accepted: apps.filter((app) => app.status === STATUS.application.ACCEPTED).length
    };
  }

  function getAllCallRequests() {
    return getCallRequests().map((call) => ({
      ...call,
      studentName: call.requesterName
    }));
  }

  function getAllAssistantActivity() {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const items = read(KEYS.assistantActivity, [])
      .filter((item) => actor.role === ROLES.MASTER || item.assistantId === actor.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return items.map((item) => {
      const safeItem = clone(item);
      const assistant = getUserById(safeItem.assistantId);
      const detailsText = Object.entries(safeItem.details || {})
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' | ');

      return {
        ...safeItem,
        assistantName: assistant?.fullName || 'Unknown',
        details: detailsText
      };
    });
  }

  function resetAllData() {
    Object.values(KEYS).forEach((value) => {
      if (value !== KEYS.cartPrefix && value !== KEYS.userPrefsPrefix) localStorage.removeItem(value);
    });
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(KEYS.cartPrefix) || key.startsWith(KEYS.userPrefsPrefix)) localStorage.removeItem(key);
    });
    write(KEYS.settings, DEFAULT_SETTINGS);
    ensureSeedAdmins();
    return true;
  }

  purgeSeedAdminsForPublicSite();
  ensureSeedAdmins();
  write(KEYS.settings, mergeDeep(DEFAULT_SETTINGS, read(KEYS.settings, DEFAULT_SETTINGS)));
  sanitizeStoredUsers();
  purgeLocalAssistantDrafts();

  window.KagieAPI = {
    KEYS,
    STATUS,
    ROLES,

    getSettings,
    saveSettings,
    getCatalog,
    getPackCatalog,
    getPackCatalogAsync,
    getPacksForAdmin,
    getPacksForAdminAsync,
    updatePackByAdmin,
    updatePackByAdminAsync,
    getPromoCampaigns,
    getPromoCampaignsAsync,
    getPromoCampaignByCode,
    getPromoCampaignByCodeAsync,
    getPromoCodesForAdmin,
    getPromoCodesForAdminAsync,
    createPromoCampaignByAdmin,
    createPromoCampaignByAdminAsync,
    updatePromoCampaignByAdmin,
    updatePromoCampaignByAdminAsync,
    deletePromoCampaignByAdmin,
    deletePromoCampaignByAdminAsync,
    applyPromoCode,
    applyPromoCodeAsync,
    clearAppliedPromoCode,
    clearAppliedPromoCodeAsync,
    syncAppliedPromoCode,
    syncAppliedPromoCodeAsync,
    getCartPricingSummary,
    getCartPricingSummaryAsync,
    getPromoBenefitLabel,
    getServiceCatalog,
    getAccommodationListings,
    getAccommodationListingsAsync,
    getAccommodationListingsForAdmin,
    addAccommodationListingByAdmin,
    updateAccommodationListingByAdmin,
    deleteAccommodationListingByAdmin,
    getTransportOptions,
    getTransportOptionsAsync,
    getInstitutionCatalog,
    getInstitutionCatalogAsync,
    getInstitutionYears,
    getInstitutionById,
    getInstitutionsForAdmin,
    getInstitutionsForAdminAsync,
    refreshCatalogCaches,
    addInstitutionByAdmin,
    addInstitutionByAdminAsync,
    updateInstitutionByAdmin,
    updateInstitutionByAdminAsync,
    deleteInstitutionByAdmin,
    deleteInstitutionByAdminAsync,
    getQuestionPapers,
    getQuestionPapersAsync,
    getQuestionPapersForAdmin,
    getQuestionPapersForAdminAsync,
    saveQuestionPaperByAdminAsync,
    updateQuestionPaperByAdminAsync,
    deleteQuestionPaperByAdminAsync,
    getHighSchoolCatalog,
    getSubjectCatalog,
    calculateNscLevel,
    calculateAps,
    getApplicationRecommendations,
    getPackageUsageSummary,
    getProspectusCatalog,
    getProspectusDocuments,
    getProspectusDocumentsAsync,
    saveProspectusDocumentByStaffAsync,
    deleteProspectusDocumentByStaffAsync,
    getPastPaperBlueprint,
    getPastPaperCatalog,
    getPastPaperCatalogAsync,
    savePastPaperByStaffAsync,
    deletePastPaperByStaffAsync,
    getPastPaperPracticeHistory,
    markPastPaperPractised,
    setPastPaperQuestionProgress,
    savePastPaperPerformance,
    getUpdateFeed,
    configureSupabase,
    getLiveAdminSetupStatus,
    isSupabaseEnabled,
    initSupabaseClient,
    getSupabaseSession,
    getSupabaseVerifiedUser,
    restoreSession,
    resolveSessionUser,
    setLoginPersistence,
    shouldRememberLogin,

    registerUser,
    login,
    signInWithGoogle,
    signInWithApple,
    sendPhoneOtp,
    verifyPhoneOtp,
    requestPasswordReset,
    updateAuthenticatedPassword,
    logout,
    logoutReal: logout,
    currentUser,
    getCurrentUser: currentUser,
    requireRole,
    updateCurrentUserProfile,
    getUsers: getUsersCompat,
    getUserById: getUserByIdCompat,
    getProfile,
    getProfileAsync,
    saveProfile,
    saveProfileAsync,
    getUsersByRole,
    getUsersByRoleAsync,
    getAllUsers,
    getAllUsersAsync,
    getAdminUserDirectoryAsync,
    getAdminUserDetailAsync,
    updateUserByAdmin,
    deleteUserByAdmin,
    createAssistantAccount,
    bootstrapMasterAdminAccount,
    createMasterAdminAccount,
    createAssistant,
    removeAssistant,

    ensureDraft,
    ensureDraftAsync,
    getApplicationById,
    getApplicationByIdAsync,
    getApplication,
    getApplications,
    getLatestApplication,
    getLatestApplicationAsync,
    getApplicationsByUser,
    getApplicationsByUserAsync,
    getApplicationsByAssistant,
    getApplicationsByAssistantAsync,
    getAllApplicationsForAdmin,
    getAllApplicationsForAdminAsync,
    updateApplication,
    updateApplicationAsync,
    saveApplication,
    saveFormSection,
    saveFormSectionAsync,
    addInstitutionToDraft,
    addInstitutionToDraftAsync,
    removeInstitutionFromDraft,
    removeInstitutionFromDraftAsync,
    submitApplicationFromCart,
    submitApplicationFromCartAsync,
    submitPayment,
    startYocoCheckoutAsync,
    assignAssistant,
    assignAssistantAsync,
    assignUserToAssistantAsync,
    reviewPaymentByAdmin,
    reviewPaymentByAdminAsync,
    addApplicationNote,
    addApplicationNoteAsync,
    getApplicationNotes,
    getApplicationNotesAsync,
    getApplicationLearnerSupport,
    getApplicationLearnerSupportAsync,
    saveApplicationLearnerSupport,
    saveApplicationLearnerSupportAsync,
    getApplicationPortalAccess,
    getApplicationPortalAccessAsync,
    saveApplicationPortalAccess,
    saveApplicationPortalAccessAsync,
    getNotes,
    addNote,
    getDashboardSummary,
    getDashboardSummaryAsync,
    getUserExperiencePreferences,
    saveUserExperiencePreferences,
    getAdminSummary,
    getAdminSummaryAsync,
    stats,
    statusClass,

    getCart,
    getCartAsync,
    addCartItem,
    addCartItemAsync,
    replaceApplicationPackCartItemAsync,
    updateCartItem,
    updateCartItemAsync,
    removeCartItem,
    removeCartItemAsync,
    clearCart,
    clearCartAsync,
    getCartTotal,
    getCartTotalAsync,

    getFavorites,
    getFavoritesAsync,
    addFavorite,
    addFavoriteAsync,
    removeFavorite,
    removeFavoriteAsync,
    getAccommodationRequests,
    getAccommodationRequestsAsync,
    submitAccommodationRequest,
    submitAccommodationRequestAsync,
    getTransportRequests,
    getTransportRequestsAsync,
    submitTransportRequest,
    submitTransportRequestAsync,
    getServiceRequestsForUser,

    getNotifications,
    getNotificationsAsync,
    pushNotification,
    pushNotificationAsync,
    sendDirectLearnerNotification,
    sendDirectLearnerNotificationAsync,
    pushGlobalNotification,
    getMarketingCampaigns,
    sendMarketingBroadcast,
    sendMarketingBroadcastAsync,
    getAdminContent,
    getAdminContentAsync,
    saveAdminContentByAdminAsync,
    getAnnouncementsForAdmin,
    getAnnouncementsForAdminAsync,
    getAnnouncementsForUser,
    getAnnouncementsForUserAsync,
    saveAnnouncementByAdminAsync,
    deleteAnnouncementByAdminAsync,
    markNotificationRead,
    markNotificationReadAsync,
    markAllNotificationsRead,
    markAllNotificationsReadAsync,

    saveDocuments,
    saveDocumentsAsync,
    getDocuments,
    getDocumentsByUser,
    getDocumentsByUserAsync,
    setDocumentReview,
    setDocumentReviewAsync,
    getDocumentReviewsForUser,
    getDocumentReviewsForUserAsync,

    getSupportMessages,
    getSupportMessagesAsync,
    sendSupportMessage,
    sendSupportMessageAsync,
    requestCallback,
    requestCallbackAsync,
    getCallRequests,
    getCallRequestsAsync,
    getMyCallRequests,
    getMyCallRequestsAsync,
    getAllCallRequests,
    updateCallRequest,
    updateCallRequestAsync,

    logAssistantActivity,
    logAssistantActivityAsync,
    getAssistantActivity,
    getAllAssistantActivity,
    getAllAssistantActivityAsync,
    getSharedProfilePhoto,

    resetAllData
  };

  [
    'saveProfileAsync',
    'saveFormSectionAsync',
    'updateApplicationAsync',
    'submitApplicationFromCartAsync',
    'saveDocumentsAsync',
    'saveQuestionPaperByAdminAsync',
    'updateQuestionPaperByAdminAsync',
    'addInstitutionByAdminAsync',
    'updateInstitutionByAdminAsync',
    'saveAdminContentByAdminAsync',
    'saveAnnouncementByAdminAsync',
    'submitAccommodationRequestAsync',
    'submitTransportRequestAsync',
    'saveProspectusDocumentByStaffAsync',
    'savePastPaperByStaffAsync',
    'startYocoCheckoutAsync',
    'applyPromoCodeAsync',
    'updateCartItemAsync',
    'addCartItemAsync',
    'removeCartItemAsync',
    'clearCartAsync',
    'sendSupportMessageAsync',
    'requestCallbackAsync',
    'setDocumentReviewAsync',
    'updateCallRequestAsync'
  ].forEach((methodName) => {
    const original = window.KagieAPI?.[methodName];
    if (typeof original !== 'function' || original.__kagieTimed) return;
    const timed = async function timedKagieApiMethod(...args) {
      const shouldLog = (() => {
        try {
          return localStorage.getItem('kagie_perf_debug') === '1';
        } catch (_error) {
          return false;
        }
      })();
      const startedAt = shouldLog && typeof performance !== 'undefined' ? performance.now() : 0;
      try {
        return await original.apply(this, args);
      } finally {
        if (shouldLog && typeof performance !== 'undefined') {
          console.info(`Kagie API timing: ${methodName}`, `${Math.round(performance.now() - startedAt)}ms`);
        }
      }
    };
    timed.__kagieTimed = true;
    window.KagieAPI[methodName] = timed;
  });
})();
