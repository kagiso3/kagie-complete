(function () {
  'use strict';

  const KEYS = {
    users: 'kagie_users',
    current: 'kagie_current_user',
    applications: 'kagie_applications',
    notifications: 'kagie_notifications',
    docs: 'kagie_docs',
    docReviews: 'kagie_doc_reviews',
    supportChats: 'kagie_support_chats',
    callRequests: 'kagie_call_requests',
    assistantActivity: 'kagie_assistant_activity',
    notes: 'kagie_notes',
    settings: 'kagie_settings',
    cartPrefix: 'kagie_cart_',
    supabaseSessionCache: 'kagie_supabase_session_cache'
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
      VERIFIED: 'Verified'
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
        verificationMessage: 'Payments are verified manually after checkout.'
      },
      supabase: {
        enabled: false,
        url: '',
        anonKey: '',
        profileTable: 'profiles',
      syncProfiles: true,
      adminCreateAssistantEndpoint: ''
    }
  };

  let supabaseClient = null;
  let remotePackCache = null;

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

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Failed to write ${key}`, err);
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

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
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
    return {
      provinces: safeArray(data.provinces),
      homeLanguages: safeArray(data.homeLanguages),
      genders: safeArray(data.genders),
      schoolTypes: safeArray(data.schoolTypes),
      dbeSubjects: safeArray(data.dbeSubjects && data.dbeSubjects.length ? data.dbeSubjects : nscSubjects),
      nscSubjects,
      iebSubjects,
      highSchools: safeArray(data.highSchools),
      applicationPacks: safeArray(data.applicationPacks),
      extraServices: safeArray(data.extraServices),
      institutions: safeArray(data.institutions),
      prospectus: safeArray(data.prospectus),
      updates: safeArray(data.updates)
    };
  }

  function sanitizeUser(user) {
    if (!user) return null;
    const safe = { ...user };
    delete safe.password;
    return safe;
  }

  function getPackCatalog() {
    return clone(getKagieData().applicationPacks);
  }

  function getServiceCatalog() {
    return clone(getKagieData().extraServices);
  }

  function getInstitutionCatalog(filters) {
    const options = filters || {};
    return getKagieData()
      .institutions
      .filter((institution) => {
        if (options.province && institution.province !== options.province) return false;
        if (options.type && institution.type !== options.type) return false;
        if (options.search) {
          const query = String(options.search).trim().toLowerCase();
          const haystack = [
            institution.name,
            institution.shortName,
            institution.province,
            institution.type
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .map(clone);
  }

  function getHighSchoolCatalog(filters) {
    const options = filters || {};
    return getKagieData()
      .highSchools
      .filter((school) => {
        if (options.province && school.province !== options.province) return false;
        if (options.search) {
          const query = String(options.search).trim().toLowerCase();
          const haystack = [
            school.name,
            school.province,
            school.district,
            school.town
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .map(clone);
  }

  function getSubjectCatalog(board) {
    const data = getKagieData();
    if (board === 'dbe') return clone(data.dbeSubjects);
    if (board === 'ieb') return clone(data.iebSubjects);
    return clone(data.nscSubjects.length ? data.nscSubjects : data.dbeSubjects);
  }

  function getProspectusCatalog() {
    return clone(getKagieData().prospectus);
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
      ctaHref: item.ctaHref || 'Dashboard.html',
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
      ctaLabel: 'View dashboard',
      ctaHref: 'Dashboard.html',
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
      supabaseClient = sdk.createClient(config.url, config.anonKey);
    }
    return supabaseClient;
  }

  function isSupabaseEnabled() {
    const cfg = getSettings().supabase;
    return !!(cfg?.enabled && !isPlaceholderSupabaseConfig(cfg) && initSupabaseClient(cfg));
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

  function toDateOrNull(value) {
    const text = String(value || '').trim();
    return text || null;
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
      address: profile?.address || ''
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
    const localUserId = localUserIdArg || acting?.id || app.userId;
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
      targetLocalUser: targetLocalUser || viewer,
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
    const ids = [...new Set(safeArray(remoteIds).filter(Boolean))];
    if (!ids.length) return [];
    const client = clientArg || initSupabaseClient();
    if (!client) return [];
    const query = await client.from('profiles').select('*').in('id', ids);
    if (query.error) throw new Error(query.error.message || 'Could not load profile records.');
    return syncRemoteUsersFromProfiles(query.data || []);
  }

  async function fetchRemotePacks(force = false) {
    if (!isSupabaseEnabled()) return [];
    if (remotePackCache && !force) return clone(remotePackCache);
    const client = initSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('application_packs')
      .select('id,code,name,price,institution_limit,is_unlimited,description,highlight')
      .eq('is_active', true)
      .order('price', { ascending: true });
    if (error) throw new Error(error.message || 'Could not load application packs.');
    remotePackCache = data || [];
    return clone(remotePackCache);
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

  async function getOrCreateRemoteCart(userIdArg) {
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return null;

    let query = await ctx.client.from('carts').select('*').eq('user_id', ctx.targetRemoteId).maybeSingle();
    if (query.error) throw new Error(query.error.message || 'Could not load cart.');

    let cart = query.data || null;
    if (!cart) {
      const created = await ctx.client.from('carts').insert({ user_id: ctx.targetRemoteId }).select('*').single();
      if (created.error) throw new Error(created.error.message || 'Could not create cart.');
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
      refId: row?.ref_id || meta.refId || '',
      type: itemType,
      name: row?.name || meta.name || meta.packName || meta.serviceName || 'Cart item',
      price: Number(row?.price ?? meta.price ?? meta.packPrice ?? meta.servicePrice ?? 0),
      quantity: Number(row?.quantity || meta.quantity || 1),
      createdAt: row?.created_at || meta.createdAt || nowISO()
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
    return {
      id: row?.id || uid('noti'),
      userId: row?.user_id ? (localUserId || row.user_id) : 'all',
      title: row?.title || '',
      message: row?.message || '',
      type: row?.notification_type || 'info',
      read: !!row?.is_read,
      createdAt: row?.created_at || nowISO(),
      source: 'supabase'
    };
  }

  function normalizeRemoteDocumentRow(row, localUserId, extraMeta) {
    return {
      id: row?.id || uid('doc'),
      userId: localUserId || row?.user_id || '',
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
    const prefix = row?.role === ROLES.ASSISTANT ? 'assistant' : row?.role === ROLES.MASTER ? 'master' : 'user';
    const stableLocalId = row?.id ? `${prefix}_${String(row.id).replace(/[^a-z0-9_-]/gi, '')}` : uid(prefix);
    const localUser = {
      ...(existing || {}),
      id: existing?.id || stableLocalId,
      supabaseUserId: row?.id || existing?.supabaseUserId || '',
      fullName: row?.full_name || existing?.fullName || '',
      email: normalizeEmail(row?.email || existing?.email || ''),
      password: existing?.password || '',
      phone: row?.phone || existing?.phone || '',
      role: row?.role || existing?.role || ROLES.USER,
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
    const existing = read(KEYS.notifications, []);
    const byId = new Map(existing.map((item) => [item.id, item]));
    safeArray(items).forEach((item) => {
      byId.set(item.id, clone(item));
    });
    write(KEYS.notifications, Array.from(byId.values()));
    return safeArray(items).map(clone);
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
    if (found.error) throw new Error(found.error.message || 'Could not load support thread.');

    let thread = found.data || null;
    if (!thread) {
      const created = await ctx.client
        .from('support_threads')
        .insert({ user_id: ctx.targetRemoteId, status: 'open' })
        .select('*')
        .single();
      if (created.error) throw new Error(created.error.message || 'Could not create support thread.');
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

    const appIds = list.map((item) => item.id);
    const [marksResult, institutionsResult, paymentsResult] = await Promise.all([
      client.from('application_marks').select('*').in('application_id', appIds),
      client.from('application_institutions').select('*').in('application_id', appIds),
      client.from('payments').select('*').in('application_id', appIds).order('created_at', { ascending: false })
    ]);

    if (marksResult.error) throw new Error(marksResult.error.message || 'Could not load marks.');
    if (institutionsResult.error) throw new Error(institutionsResult.error.message || 'Could not load institutions.');
    if (paymentsResult.error) throw new Error(paymentsResult.error.message || 'Could not load payments.');

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

    return list.map((row) => {
      const resolvedProfile = profileArg instanceof Map
        ? (profileArg.get(row.user_id) || getUsers().find((user) => user.supabaseUserId === row.user_id) || {})
        : (profileArg || {});
      const localUserId = resolvedProfile?.id || getUsers().find((user) => user.supabaseUserId === row.user_id)?.id || userIdArg || row.user_id;
      const localAssistantId = getUsers().find((user) => user.supabaseUserId === row.assistant_id)?.id || row.assistant_id || null;
      const marks = safeArray(marksByApp.get(row.id));
      const institutions = safeArray(institutionsByApp.get(row.id));
      const paymentRow = safeArray(paymentsByApp.get(row.id))[0] || null;

      const app = {
        id: row.id,
        userId: localUserId,
        assistantId: localAssistantId,
        applicant: resolvedProfile?.fullName || resolvedProfile?.fullNames || '',
        status: row.status || STATUS.application.DRAFT,
        paymentStatus: row.payment_status || STATUS.payment.PENDING,
        forms: {
          learner: profileToLearnerForm(resolvedProfile),
          parent: profileToParentForm(resolvedProfile),
          school: profileToSchoolForm(resolvedProfile),
          marks: { subjects: marks }
        },
        institutions,
        package: mapRemotePackage(row.package || null),
        services: [],
        payment: (paymentRow || row.payer_name || row.payment_reference)
          ? {
              payerName: paymentRow?.payer_name || row.payer_name || '',
              phone: paymentRow?.phone || row.payer_phone || '',
              reference: paymentRow?.reference || row.payment_reference || '',
              note: paymentRow?.note || row.payment_note || '',
              method: paymentRow?.method || row.payment_method || '',
              amount: Number(paymentRow?.amount ?? row.payment_amount ?? 0),
              status: paymentRow?.status || row.payment_status || STATUS.payment.PENDING,
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
    return read(KEYS.current, null);
  }

  function currentUser() {
    return sanitizeUser(currentUserRaw());
  }

  function setCurrentUser(user) {
    write(KEYS.current, user || null);
    return sanitizeUser(user);
  }

  function getUsers() {
    return read(KEYS.users, []);
  }

  function saveUsers(users) {
    return write(KEYS.users, users);
  }

  function sanitizeStoredUsers() {
    const users = getUsers();
    const cleaned = users.map((user) => {
      const next = { ...(user || {}) };
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

  function ensureSeedAdmins() {
    const users = getUsers();
    let changed = false;

    const defaults = [
      {
        id: 'assistant_demo',
        fullName: 'Kagie Assistant',
        email: 'assistant@kagie.app',
        password: '123456',
        role: ROLES.ASSISTANT,
        phone: '',
        profileImage: '',
        profile: {},
        source: 'local',
        createdAt: nowISO(),
        updatedAt: nowISO()
      },
      {
        id: 'master_demo',
        fullName: 'Kagie Master Admin',
        email: 'admin@kagie.app',
        password: '123456',
        role: ROLES.MASTER,
        phone: '',
        profileImage: '',
        profile: {},
        source: 'local',
        createdAt: nowISO(),
        updatedAt: nowISO()
      }
    ];

    defaults.forEach((seed) => {
      if (!users.find((u) => normalizeEmail(u.email) === normalizeEmail(seed.email))) {
        users.push(seed);
        changed = true;
      }
    });

    if (changed) saveUsers(users);
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

  function getUserById(id) {
    return getUsers().find((u) => u.id === id) || null;
  }

  function upsertLocalUser(user) {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === user.id || normalizeEmail(u.email) === normalizeEmail(user.email));
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
      const { data, error } = await client.from(settings.supabase.profileTable).upsert(payload).select().maybeSingle();
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

  async function registerUser(payload) {
    ensureSeedAdmins();
    const users = getUsers();

    const fullName = String(payload?.fullName || payload?.name || '').trim();
    const email = normalizeEmail(payload?.email);
    const password = String(payload?.password || '');
    const phone = String(payload?.phone || '').trim();
    const role = payload?.role || ROLES.USER;

    if (!fullName) throw new Error('Full name is required.');
    if (!email) throw new Error('Email is required.');
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
    return sanitizeUser(user);
  }

  async function login(email, password) {
    ensureSeedAdmins();
    const normalized = normalizeEmail(email);
    let found = null;

    if (isSupabaseEnabled()) {
      const client = initSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({ email: normalized, password: String(password) });
      if (!error && data?.user) {
        const remoteProfile = await getRemoteProfileSnapshot(data.user.id, client);
        const local = getUserByEmail(normalized);
        found = local || {
          id: uid('user'),
          supabaseUserId: data.user.id,
          fullName: remoteProfile?.full_name || data.user.user_metadata?.full_name || normalized.split('@')[0],
          email: normalized,
          password: String(password),
          phone: remoteProfile?.phone || '',
          role: remoteProfile?.role || data.user.user_metadata?.role || ROLES.USER,
          profileImage: remoteProfile?.profile_image || '',
          source: 'supabase',
          profile: {},
          createdAt: nowISO(),
          updatedAt: nowISO()
        };
        if (local && remoteProfile) {
          found = {
            ...local,
            supabaseUserId: data.user.id,
            fullName: remoteProfile.full_name || local.fullName,
            email: normalizeEmail(remoteProfile.email || normalized || local.email),
            phone: remoteProfile.phone || local.phone || '',
            role: remoteProfile.role || local.role || ROLES.USER,
            profileImage: remoteProfile.profile_image || local.profileImage || '',
            source: 'supabase',
            updatedAt: nowISO()
          };
        }
        upsertLocalUser(found);
        write(KEYS.supabaseSessionCache, data?.session || null);
      }
    }

    if (!found) {
      found = getUsers().find(
        (u) => normalizeEmail(u.email) === normalized && String(u.password) === String(password)
      );
    }

    if (!found) throw new Error('Invalid email or password.');
    setCurrentUser(found);
    return sanitizeUser(found);
  }

  async function logout() {
    const settings = getSettings();
    const supabaseUrl = String(settings?.supabase?.url || '');
    const projectRef = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] : '';
    if (isSupabaseEnabled()) {
      try {
        await initSupabaseClient().auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut failed:', err);
      }
    }
    write(KEYS.current, null);
    write(KEYS.supabaseSessionCache, null);
    try {
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith('sb-') &&
          (!projectRef || key.includes(`sb-${projectRef}-`))
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.warn('Supabase token cleanup failed:', err);
    }
    return true;
  }

  async function getSupabaseSession() {
    if (!isSupabaseEnabled()) return null;
    const client = initSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message || 'Could not get session.');
    write(KEYS.supabaseSessionCache, data?.session || null);
    return data?.session || null;
  }

  async function getSupabaseVerifiedUser() {
    if (!isSupabaseEnabled()) return null;
    const client = initSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(error.message || 'Could not get verified user.');
    return data?.user || null;
  }

  async function restoreSession() {
    const active = currentUser();
    if (active) return active;
    if (!isSupabaseEnabled()) return null;

    const session = await getSupabaseSession();
    const supaUser = session?.user;
    if (!supaUser?.email) return null;
    const remoteProfile = await getRemoteProfileSnapshot(supaUser.id);

    let local = getUserByEmail(supaUser.email);
    if (!local) {
      local = {
        id: uid('user'),
        supabaseUserId: supaUser.id,
        fullName: remoteProfile?.full_name || supaUser.user_metadata?.full_name || supaUser.email.split('@')[0],
        email: normalizeEmail(supaUser.email),
        password: '',
        phone: remoteProfile?.phone || '',
        role: remoteProfile?.role || supaUser.user_metadata?.role || ROLES.USER,
        profileImage: remoteProfile?.profile_image || '',
        source: 'supabase',
        profile: {},
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      upsertLocalUser(local);
    } else if (remoteProfile) {
      local = {
        ...local,
        supabaseUserId: supaUser.id,
        fullName: remoteProfile.full_name || local.fullName,
        email: normalizeEmail(remoteProfile.email || supaUser.email || local.email),
        phone: remoteProfile.phone || local.phone || '',
        role: remoteProfile.role || local.role || ROLES.USER,
        profileImage: remoteProfile.profile_image || local.profileImage || '',
        source: 'supabase',
        updatedAt: nowISO()
      };
      upsertLocalUser(local);
    }
    setCurrentUser(local);
    return sanitizeUser(local);
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
        marks: { subjects: [] }
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
    return clone(getAllApplications().find((a) => a.id === appId) || null);
  }

  function getLatestApplication(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const apps = getAllApplications()
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return clone(apps[0] || null);
  }

  function getApplicationsByUser(userIdArg) {
    const userId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    return getAllApplications()
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(clone);
  }

  function getApplicationsByAssistant(assistantIdArg) {
    const current = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const assistantId = assistantIdArg || current.id;
    return getAllApplications()
      .filter((app) => app.assistantId === assistantId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(clone);
  }

  function getAllApplicationsForAdmin() {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    return getAllApplications()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(clone);
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

    let updated = mergeDeep(current, patch || {});
    if (actingUser.role === ROLES.ASSISTANT && !updated.assistantId) updated.assistantId = actingUser.id;

    if (patch?.status && patch.status !== current.status) appendTimeline(updated, `Status updated to ${patch.status}`, patch.status);
    if (patch?.paymentStatus && patch.paymentStatus !== current.paymentStatus) appendTimeline(updated, `Payment status updated to ${patch.paymentStatus}`, updated.status);

    updated.updatedAt = nowISO();
    apps[index] = updated;
    saveAllApplications(apps);

    if (patch?.status || patch?.paymentStatus) {
      pushNotification(updated.userId, 'Application updated', `Status: ${updated.status} | Payment: ${updated.paymentStatus}`, 'info');
    }

    if (actingUser.role === ROLES.ASSISTANT || actingUser.role === ROLES.MASTER) {
      logAssistantActivity({
        assistantId: actingUser.id,
        applicationId: updated.id,
        action: 'update_application',
        details: { status: updated.status, paymentStatus: updated.paymentStatus }
      });
    }

    return clone(updated);
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

    const entry = {
      id: institution?.id || uid('inst'),
      institutionName: institution?.institutionName || institution?.name || '',
      province: institution?.province || '',
      institutionType: institution?.institutionType || '',
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

  function addCartItem(itemArg, userIdArg) {
    const item = typeof itemArg === 'string' ? userIdArg : itemArg;
    const userId = typeof itemArg === 'string' ? itemArg : userIdArg || requireRole([ROLES.USER]).id;
    const items = getCart(userId);
    const normalizedType = item?.type === 'service_request' ? 'service' : item?.type || 'custom';
    const finalItem = {
      id: item?.id || uid('cart'),
      type: normalizedType,
      name: item?.name || item?.serviceName || item?.packName || item?.institutionName || 'Cart item',
      price: Number(item?.price ?? item?.packPrice ?? item?.servicePrice ?? 0),
      quantity: Number(item?.quantity || 1),
      createdAt: nowISO(),
      ...item
    };
    items.push(finalItem);
    saveCart(items, userId);
    return clone(finalItem);
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
    return getCart(userIdArg).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  }

  function submitApplicationFromCart(paymentData) {
    const user = requireRole([ROLES.USER]);
    const app = ensureDraft(user.id);
    const cart = getCart(user.id);

    const packageItem = cart.find((item) => item.type === 'application_pack');
    const serviceItems = cart.filter((item) => item.type === 'service' || item.type === 'service_request');
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

    const updated = updateApplication(app.id, {
      institutions,
      package: packageItem || app.package || null,
      services: serviceItems,
      payment: {
        payerName: paymentData?.payerName || '',
        phone: paymentData?.phone || '',
        reference: paymentData?.reference || '',
        note: paymentData?.note || '',
        method: paymentData?.method || '',
        amount: getCartTotal(user.id),
        submittedAt: nowISO()
      },
      status: STATUS.application.PROCESSING,
      paymentStatus: STATUS.payment.PENDING_VERIFICATION,
      submittedAt: nowISO()
    });

    clearCart(user.id);
    pushNotification(user.id, 'Payment received', 'Your application is being processed and payment is pending verification.', 'success');
    return updated;
  }

  function getNotifications(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    return read(KEYS.notifications, [])
      .filter((n) => n.userId === userId || n.userId === 'all')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function pushNotification(userId, title, message, type = 'info') {
    const notifications = read(KEYS.notifications, []);
    const entry = {
      id: uid('noti'),
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: nowISO()
    };
    notifications.push(entry);
    write(KEYS.notifications, notifications);
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

    const combined = [...remote];
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

  function markNotificationRead(notificationId) {
    const user = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const notifications = read(KEYS.notifications, []);
    const index = notifications.findIndex((n) => n.id === notificationId && (n.userId === user.id || n.userId === 'all'));
    if (index === -1) return false;
    notifications[index].read = true;
    write(KEYS.notifications, notifications);
    return true;
  }

  function markAllNotificationsRead(userIdArg) {
    const viewer = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || viewer.id;
    const notifications = read(KEYS.notifications, []);
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

    const updated = await ctx.client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', ctx.targetRemoteId)
      .eq('is_read', false);
    if (updated.error) {
      console.warn('Remote mark-all notifications skipped:', updated.error.message || updated.error);
    }
    return true;
  }

  function saveDocuments(filesMeta, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const docs = read(KEYS.docs, []);
    const list = Array.isArray(filesMeta) ? filesMeta : [filesMeta];

    const saved = list.map((doc) => ({
      id: doc?.id || uid('doc'),
      userId,
      name: doc?.name || doc?.fileName || 'Document',
      type: doc?.type || doc?.mimeType || '',
      size: Number(doc?.size || 0),
      dataUrl: doc?.dataUrl || '',
      category: doc?.category || 'general',
      status: STATUS.doc.PENDING,
      createdAt: nowISO(),
      updatedAt: nowISO()
    }));

    docs.push(...saved);
    write(KEYS.docs, docs);
    if (actor.role === ROLES.USER) pushNotification(userId, 'Documents uploaded', 'Your documents were uploaded successfully.', 'success');
    return clone(saved);
  }

  async function saveDocumentsAsync(filesMeta, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const userId = userIdArg || actor.id;
    const ctx = await resolveSupabaseContext(userId);
    if (!ctx) return saveDocuments(filesMeta, userId);

    const app = await getLatestApplicationAsync(userId).catch(() => null);
    const list = Array.isArray(filesMeta) ? filesMeta : [filesMeta];
    const bucket = 'kagie-documents';
    const saved = [];

    for (const doc of list) {
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
          application_id: app?.id || null,
          document_type: doc?.category || 'general',
          file_name: originalName,
          file_url: objectPath,
          status: STATUS.doc.PENDING
        })
        .select('*')
        .single();
      if (insert.error) throw new Error(insert.error.message || 'Could not save document record.');

      saved.push(normalizeRemoteDocumentRow(insert.data, ctx.targetLocalUser?.id || userId, doc));
    }

    mirrorRemoteDocuments(saved, ctx.targetLocalUser?.id || userId);
    if (actor.role === ROLES.USER) pushNotification(userId, 'Documents uploaded', 'Your documents were uploaded successfully.', 'success');
    return saved;
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
    if (query.error) throw new Error(query.error.message || 'Could not load documents.');

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
    if (query.error) throw new Error(query.error.message || 'Could not load support messages.');

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
    if (insert.error) throw new Error(insert.error.message || 'Could not send support message.');

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
    if (insert.error) throw new Error(insert.error.message || 'Could not request callback.');

    const entry = normalizeRemoteCallbackRow(insert.data, actor);
    mirrorRemoteCallRequests([entry], actor.id);
    if (actor.role === ROLES.USER) pushNotification(actor.id, 'Callback requested', 'Your callback request was sent successfully.', 'success');
    return entry;
  }

  function getCallRequests() {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    return read(KEYS.callRequests, [])
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
    if (query.error) throw new Error(query.error.message || 'Could not load callback requests.');

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

    const query = await ctx.client
      .from('callback_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load callback requests.');

    const remoteIds = safeArray(query.data).flatMap((row) => [row.user_id, row.assigned_assistant_id]).filter(Boolean);
    const syncedUsers = await fetchRemoteUsersByIds(remoteIds, ctx.client).catch(() => []);
    const userMap = new Map(syncedUsers.map((user) => [user.supabaseUserId, user]));
    const items = safeArray(query.data).map((row) => ({
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

  async function getApplicationNotesAsync(applicationId) {
    requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return getApplicationNotes(applicationId);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getApplicationNotes(applicationId);

    const query = await ctx.client
      .from('application_notes')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load application notes.');

    const authorUsers = await fetchRemoteUsersByIds(safeArray(query.data).map((row) => row.author_id), ctx.client).catch(() => []);
    const authorMap = new Map(authorUsers.map((user) => [user.supabaseUserId, user]));
    const notes = safeArray(query.data).map((row) => normalizeRemoteApplicationNoteRow(row, authorMap.get(row.author_id)));
    mirrorRemoteNotes(notes, applicationId);
    return notes;
  }

  async function addApplicationNoteAsync(applicationId, noteText) {
    const actor = requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    if (!isUuid(applicationId)) return addApplicationNote(applicationId, noteText);
    const text = String(noteText || '').trim();
    if (!text) throw new Error('Note cannot be empty.');
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return addApplicationNote(applicationId, text);

    const insert = await ctx.client
      .from('application_notes')
      .insert({
        application_id: applicationId,
        author_id: ctx.remoteSelfId,
        author_role: actor.role,
        note: text
      })
      .select('*')
      .single();
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

    let query = ctx.client.from('assistant_activity').select('*').order('created_at', { ascending: false });
    if (actor.role !== ROLES.MASTER) query = query.eq('assistant_id', ctx.remoteSelfId);
    const result = await query;
    if (result.error) throw new Error(result.error.message || 'Could not load assistant activity.');

    const assistantUsers = await fetchRemoteUsersByIds(safeArray(result.data).map((row) => row.assistant_id), ctx.client).catch(() => []);
    const assistantMap = new Map(assistantUsers.map((user) => [user.supabaseUserId, user]));
    const items = safeArray(result.data).map((row) => normalizeRemoteAssistantActivityRow(row, assistantMap.get(row.assistant_id)));
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
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(clone);
  }

  function assignAssistant(applicationId, assistantId) {
    const actor = requireRole([ROLES.MASTER]);
    const assistant = getUsers().find((u) => u.id === assistantId && u.role === ROLES.ASSISTANT);
    if (!assistant) throw new Error('Assistant not found.');

    const updated = updateApplication(applicationId, { assistantId });
    pushNotification(updated.userId, 'Assistant assigned', `${assistant.fullName} was assigned to your application.`, 'info');

    logAssistantActivity({
      assistantId: actor.id,
      applicationId,
      action: 'assign_assistant',
      details: { assignedAssistantId: assistantId }
    });

    return updated;
  }

  async function createAssistantAccount(data) {
    requireRole([ROLES.MASTER]);

    const fullName = String(data?.fullName || '').trim();
    const email = normalizeEmail(data?.email);
    const password = String(data?.password || '123456');
    const phone = String(data?.phone || '').trim();

    if (!fullName) throw new Error('Assistant full name is required.');
    if (!email) throw new Error('Assistant email is required.');
    if (getUserByEmail(email)) throw new Error('An account with this email already exists.');

    const settings = getSettings();
    if (settings.supabase.adminCreateAssistantEndpoint) {
      try {
        const session = await getSupabaseSession().catch(() => read(KEYS.supabaseSessionCache, null));
        const accessToken = session?.access_token || read(KEYS.supabaseSessionCache, null)?.access_token || '';
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        const response = await fetch(settings.supabase.adminCreateAssistantEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fullName, email, password, phone })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || payload?.error || 'Secure assistant creation endpoint failed.');
        const remote = payload?.data || payload || {};
        const assistant = {
          id: uid('assistant'),
          supabaseUserId: remote?.id || remote?.supabaseUserId || '',
          fullName: remote?.fullName || fullName,
          email: normalizeEmail(remote?.email || email),
          password,
          phone: remote?.phone || phone,
          role: remote?.role || ROLES.ASSISTANT,
          profileImage: '',
          source: 'supabase',
          profile: {},
          createdAt: remote?.createdAt || nowISO(),
          updatedAt: remote?.updatedAt || nowISO()
        };
        upsertLocalUser(assistant);
        return sanitizeUser(assistant);
      } catch (err) {
        throw new Error(err.message || 'Could not create assistant account through secure endpoint.');
      }
    }

    const assistant = {
      id: uid('assistant'),
      supabaseUserId: '',
      fullName,
      email,
      password,
      phone,
      role: ROLES.ASSISTANT,
      profileImage: '',
      source: 'local',
      profile: {},
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    upsertLocalUser(assistant);
    return sanitizeUser(assistant);
  }

  async function createMasterAdminAccount(data) {
    requireRole([ROLES.MASTER]);
    const before = currentUserRaw();
    const admin = await registerUser({ ...data, role: ROLES.MASTER });
    if (before) setCurrentUser(before);
    return admin;
  }

  function getUsersByRole(role) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    return getUsers().filter((u) => u.role === role).map(sanitizeUser);
  }

  function getAllUsers() {
    requireRole([ROLES.MASTER]);
    return getUsers().map(sanitizeUser);
  }

  async function getUsersByRoleAsync(role) {
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getUsersByRole(role);

    const query = await ctx.client
      .from('profiles')
      .select('*')
      .eq('role', role)
      .order('created_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load users by role.');

    const remote = syncRemoteUsersFromProfiles(query.data || []).filter((user) => user.role === role);
    const merged = [...remote];
    getUsersByRole(role).forEach((user) => {
      if (!merged.find((item) => item.id === user.id || normalizeEmail(item.email) === normalizeEmail(user.email))) {
        merged.push(user);
      }
    });
    return merged;
  }

  async function getAllUsersAsync() {
    requireRole([ROLES.MASTER]);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getAllUsers();

    const query = await ctx.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load users.');

    const remote = syncRemoteUsersFromProfiles(query.data || []);
    const merged = [...remote];
    getAllUsers().forEach((user) => {
      if (!merged.find((item) => item.id === user.id || normalizeEmail(item.email) === normalizeEmail(user.email))) {
        merged.push(user);
      }
    });
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

    const query = await ctx.client
      .from('applications')
      .select(REMOTE_APPLICATION_SELECT)
      .eq('assistant_id', ctx.targetRemoteId)
      .order('updated_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load assigned applications.');

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
    requireRole([ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext();
    if (!ctx) return getAllApplicationsForAdmin();

    const query = await ctx.client
      .from('applications')
      .select(REMOTE_APPLICATION_SELECT)
      .order('updated_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load applications.');

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

    const apps = await hydrateRemoteApplications(query.data || [], ctx.viewer.id, profileMap);
    mirrorRemoteApplications(apps);
    return apps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async function assignAssistantAsync(applicationId, assistantId) {
    const actor = requireRole([ROLES.MASTER]);
    if (!isUuid(applicationId)) return assignAssistant(applicationId, assistantId);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return assignAssistant(applicationId, assistantId);

    const assistantCtx = await resolveSupabaseContext(assistantId);
    if (!assistantCtx?.targetRemoteId) throw new Error('Assistant not found.');

    const appSnapshot = await ctx.client.from('applications').select('id,user_id').eq('id', applicationId).maybeSingle();
    if (appSnapshot.error) throw new Error(appSnapshot.error.message || 'Could not load application.');
    if (!appSnapshot.data) throw new Error('Application not found.');

    const update = await ctx.client
      .from('applications')
      .update({ assistant_id: assistantCtx.targetRemoteId })
      .eq('id', applicationId);
    if (update.error) throw new Error(update.error.message || 'Could not assign assistant.');

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
    const applications = getAllApplications()
      .filter((app) => app.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(clone);
    const notifications = getNotifications(userId).slice(0, 5);
    const docs = getDocumentsByUser(userId);
    const reviews = getDocumentReviewsForUser(userId);
    const unreadNotifications = getNotifications(userId).filter((item) => !item.read).length;
    const notes = latest?.id ? getApplicationNotes(latest.id) : [];
    const deadlines = safeArray(latest?.institutions)
      .map((item) => getInstitutionCatalog({ search: item.institutionName || item.institution })[0])
      .filter(Boolean)
      .map((institution) => ({
        institutionName: institution.name,
        deadline: institution.applicationDeadline
      }))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const pendingTasks = [];
    if (!latest?.package) pendingTasks.push('Choose an application pack');
    if (!safeArray(latest?.institutions).length) pendingTasks.push('Add at least one institution');
    if (docs.length < 2) pendingTasks.push('Upload supporting documents');
    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION) pendingTasks.push('Wait for payment verification');
    if (latest?.status === STATUS.application.MISSING_DOCUMENTS) pendingTasks.push('Resolve missing documents');

    const smartAlerts = [];
    if (unreadNotifications) smartAlerts.push(`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`);
    if (latest?.status === STATUS.application.PROCESSING) smartAlerts.push('Your application is being processed');
    if (deadlines[0]?.deadline) smartAlerts.push(`Nearest deadline: ${deadlines[0].institutionName}`);

    return {
      user: userId === viewer.id ? viewer : sanitizeUser(getUserById(userId)),
      latestApplication: latest,
      applications,
      notifications,
      unreadNotifications,
      documents: docs,
      reviews,
      notes,
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

    if (profilesResult.error) throw new Error(profilesResult.error.message || 'Could not load profile totals.');
    if (applicationsResult.error) throw new Error(applicationsResult.error.message || 'Could not load application totals.');
    if (callbackResult.error) throw new Error(callbackResult.error.message || 'Could not load callback totals.');
    if (documentsResult.error) throw new Error(documentsResult.error.message || 'Could not load document totals.');

    const profiles = safeArray(profilesResult.data);
    const apps = safeArray(applicationsResult.data);
    const callbacks = safeArray(callbackResult.data);
    const docs = safeArray(documentsResult.data);

    return {
      totals: {
        users: profiles.filter((user) => user.role === ROLES.USER).length,
        assistants: profiles.filter((user) => user.role === ROLES.ASSISTANT).length,
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

    const [profileResult, userResult, guardianResult, schoolResult] = await Promise.all([
      ctx.client.from('profiles').select('*').eq('id', ctx.targetRemoteId).maybeSingle(),
      ctx.client.from('user_profiles').select('*').eq('user_id', ctx.targetRemoteId).maybeSingle(),
      ctx.client.from('guardian_profiles').select('*').eq('user_id', ctx.targetRemoteId).maybeSingle(),
      ctx.client.from('school_profiles').select('*').eq('user_id', ctx.targetRemoteId).maybeSingle()
    ]);

    if (profileResult.error) throw new Error(profileResult.error.message || 'Could not load profile.');
    if (userResult.error) throw new Error(userResult.error.message || 'Could not load learner profile.');
    if (guardianResult.error) throw new Error(guardianResult.error.message || 'Could not load guardian profile.');
    if (schoolResult.error) throw new Error(schoolResult.error.message || 'Could not load school profile.');

    const localBase = ctx.targetLocalUser?.id ? getProfile(ctx.targetLocalUser.id) || {} : {};
    const profileRow = profileResult.data || {};
    const userRow = userResult.data || {};
    const guardianRow = guardianResult.data || {};
    const schoolRow = schoolResult.data || {};

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
      idNumber: userRow.id_number || localBase.idNumber || '',
      surname: userRow.surname || localBase.surname || '',
      maidenName: userRow.maiden_name || localBase.maidenName || '',
      dob: userRow.date_of_birth || localBase.dob || '',
      gender: userRow.gender || localBase.gender || '',
      homeLanguage: userRow.home_language || localBase.homeLanguage || '',
      province: userRow.province || localBase.province || '',
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
    const email = normalizeEmail(merged.email || ctx.targetLocalUser?.email || actor.email || '');
    const phone = merged.phone || merged.cellphone || existing?.phone || '';
    const schoolName = merged.schoolName || merged.schoolAttended || '';

    const writes = await Promise.all([
      ctx.client.from('profiles').upsert({
        id: ctx.targetRemoteId,
        full_name: fullName,
        email,
        phone,
        role: ctx.targetLocalUser?.role || actor.role || ROLES.USER,
        profile_image: merged.profileImage || existing?.profileImage || ''
      }),
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
      }),
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
      }),
      ctx.client.from('school_profiles').upsert({
        user_id: ctx.targetRemoteId,
        school_name: schoolName,
        confirm_name: merged.confirmName || schoolName || '',
        school_province: merged.schoolProvince || '',
        school_type: merged.schoolType || '',
        completion_year: toIntegerOrNull(merged.completionYear),
        average: toNumericOrNull(merged.average)
      })
    ]);

    writes.forEach((result) => {
      if (result.error) throw new Error(result.error.message || 'Could not save profile.');
    });

    if (ctx.targetLocalUser?.id) {
      saveProfile(ctx.targetLocalUser.id, merged);
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

    if (existing.error) throw new Error(existing.error.message || 'Could not load draft.');

    let row = existing.data || null;
    if (!row) {
      const created = await ctx.client
        .from('applications')
        .insert({ user_id: ctx.targetRemoteId })
        .select(REMOTE_APPLICATION_SELECT)
        .single();
      if (created.error) throw new Error(created.error.message || 'Could not create draft.');
      row = created.data;
    }

    const [app] = await hydrateRemoteApplications([row], ctx.targetLocalUser?.id || targetUserId, profile);
    if (app) mirrorRemoteApplication(app, ctx.targetLocalUser?.id || ctx.viewer.id);
    return app || ensureDraft(targetUserId);
  }

  async function getApplicationByIdAsync(appId, userIdArg) {
    if (!isUuid(appId)) return getApplicationById(appId);
    const ctx = await resolveSupabaseContext(userIdArg);
    if (!ctx) return getApplicationById(appId);

    const query = await ctx.client.from('applications').select(REMOTE_APPLICATION_SELECT).eq('id', appId).maybeSingle();
    if (query.error) throw new Error(query.error.message || 'Could not load application.');
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
    if (query.error) throw new Error(query.error.message || 'Could not load latest application.');
    if (!query.data) return null;

    const [app] = await hydrateRemoteApplications([query.data], ctx.targetLocalUser?.id || targetUserId, profile);
    if (app) mirrorRemoteApplication(app, ctx.targetLocalUser?.id || ctx.viewer.id);
    return app || null;
  }

  async function getApplicationsByUserAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const ctx = await resolveSupabaseContext(targetUserId);
    if (!ctx) return getApplicationsByUser(targetUserId);

    const profile = await getProfileAsync(ctx.targetLocalUser?.id || targetUserId).catch(() => ({}));
    const query = await ctx.client
      .from('applications')
      .select(REMOTE_APPLICATION_SELECT)
      .eq('user_id', ctx.targetRemoteId)
      .order('updated_at', { ascending: false });
    if (query.error) throw new Error(query.error.message || 'Could not load applications.');

    const apps = await hydrateRemoteApplications(query.data || [], ctx.targetLocalUser?.id || targetUserId, profile);
    mirrorRemoteApplications(apps, ctx.targetLocalUser?.id || ctx.viewer.id);
    return apps;
  }

  async function updateApplicationAsync(appId, patch) {
    if (!isUuid(appId)) return updateApplication(appId, patch);
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const ctx = await resolveSupabaseContext(actor.id);
    if (!ctx) return updateApplication(appId, patch);

    const updates = {};

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
      updates.payer_name = patch.payment.payerName || '';
      updates.payer_phone = patch.payment.phone || '';
      updates.payment_reference = patch.payment.reference || '';
      updates.payment_method = patch.payment.method || '';
      updates.payment_note = patch.payment.note || '';
      updates.payment_amount = Number(patch.payment.amount || 0);
    }

    if (Object.prototype.hasOwnProperty.call(patch || {}, 'package')) {
      const remotePack = await findRemotePackRecord(patch.package);
      updates.package_id = remotePack?.id || null;
    }

    if (Object.keys(updates).length) {
      const baseUpdate = await ctx.client.from('applications').update(updates).eq('id', appId);
      if (baseUpdate.error) throw new Error(baseUpdate.error.message || 'Could not update application.');
    }

    if (Array.isArray(patch?.institutions)) {
      const cleared = await ctx.client.from('application_institutions').delete().eq('application_id', appId);
      if (cleared.error) throw new Error(cleared.error.message || 'Could not refresh institutions.');

      if (patch.institutions.length) {
        const rows = patch.institutions.map((item) => ({
          application_id: appId,
          province: item?.province || '',
          institution_type: item?.institutionType || '',
          institution_name: item?.institutionName || item?.name || '',
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

    const refreshed = await getApplicationByIdAsync(appId);
    if (patch?.status || patch?.paymentStatus) {
      await pushNotificationAsync(refreshed.userId, 'Application updated', `Status: ${refreshed.status} | Payment: ${refreshed.paymentStatus}`, 'info').catch(() => {});
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

    const entry = {
      id: institution?.id || uid('inst'),
      institutionName: institution?.institutionName || institution?.name || '',
      province: institution?.province || '',
      institutionType: institution?.institutionType || '',
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
    if (query.error) throw new Error(query.error.message || 'Could not load cart items.');

    const items = safeArray(query.data).map(normalizeRemoteCartItem);
    mirrorRemoteCart(items, remote.targetLocalUser?.id || remote.viewer.id);
    return items;
  }

  async function addCartItemAsync(itemArg, userIdArg) {
    const actor = requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]);
    const item = typeof itemArg === 'string' ? userIdArg : itemArg;
    const targetUserId = typeof itemArg === 'string' ? itemArg : userIdArg || actor.id;
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return addCartItem(itemArg, userIdArg);

    const normalizedType = item?.type === 'service_request' ? 'service' : item?.type || 'custom';
    const remotePack = normalizedType === 'application_pack' ? await findRemotePackRecord(item) : null;
    const finalItem = {
      id: item?.id || uid('cart'),
      type: normalizedType,
      name: item?.name || item?.serviceName || item?.packName || item?.institutionName || 'Cart item',
      price: Number(item?.price ?? item?.packPrice ?? item?.servicePrice ?? 0),
      quantity: Number(item?.quantity || 1),
      createdAt: nowISO(),
      ...item
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

    if (insert.error) throw new Error(insert.error.message || 'Could not add item to cart.');

    const rows = await getCartAsync(targetUserId);
    await syncRemoteCartTotal(remote.cart.id, targetUserId);
    return normalizeRemoteCartItem(insert.data) || rows[rows.length - 1];
  }

  async function removeCartItemAsync(itemId, userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return removeCartItem(itemId, targetUserId);

    const deleted = await remote.client.from('cart_items').delete().eq('id', itemId);
    if (deleted.error) throw new Error(deleted.error.message || 'Could not remove cart item.');

    await syncRemoteCartTotal(remote.cart.id, targetUserId);
    return getCartAsync(targetUserId);
  }

  async function clearCartAsync(userIdArg) {
    const targetUserId = userIdArg || requireRole([ROLES.USER, ROLES.ASSISTANT, ROLES.MASTER]).id;
    const remote = await getOrCreateRemoteCart(targetUserId);
    if (!remote) return clearCart(targetUserId);

    const cleared = await remote.client.from('cart_items').delete().eq('cart_id', remote.cart.id);
    if (cleared.error) throw new Error(cleared.error.message || 'Could not clear cart.');

    await syncRemoteCartTotal(remote.cart.id, targetUserId, []);
    mirrorRemoteCart([], remote.targetLocalUser?.id || remote.viewer.id);
    return true;
  }

  async function getCartTotalAsync(userIdArg) {
    const items = await getCartAsync(userIdArg);
    return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  }

  async function submitApplicationFromCartAsync(paymentData) {
    const user = requireRole([ROLES.USER]);
    const ctx = await resolveSupabaseContext(user.id);
    if (!ctx) return submitApplicationFromCart(paymentData);

    const cart = await getCartAsync(user.id);
    if (!cart.length) throw new Error('Your cart is empty.');

    const app = await ensureDraftAsync(user.id);
    const packageItem = cart.find((item) => item.type === 'application_pack') || null;
    const institutions = safeArray(packageItem?.institutions).length ? clone(packageItem.institutions) : safeArray(app.institutions);
    const amount = await getCartTotalAsync(user.id);

    const updated = await updateApplicationAsync(app.id, {
      package: packageItem || app.package || null,
      institutions,
      payment: {
        payerName: paymentData?.payerName || '',
        phone: paymentData?.phone || '',
        reference: paymentData?.reference || '',
        note: paymentData?.note || '',
        method: paymentData?.method || '',
        amount
      },
      status: STATUS.application.PROCESSING,
      paymentStatus: STATUS.payment.PENDING_VERIFICATION,
      submittedAt: nowISO()
    });

    const paymentInsert = await ctx.client.from('payments').insert({
      application_id: app.id,
      payer_name: paymentData?.payerName || '',
      phone: paymentData?.phone || '',
      reference: paymentData?.reference || '',
      method: paymentData?.method || '',
      note: paymentData?.note || '',
      amount,
      status: STATUS.payment.PENDING_VERIFICATION
    });
    if (paymentInsert.error) throw new Error(paymentInsert.error.message || 'Could not save payment details.');

      await clearCartAsync(user.id);
      await pushNotificationAsync(
        user.id,
        'Payment received',
        'Your application is being processed and payment is pending verification.',
        'success'
      ).catch(() => {
        pushNotification(user.id, 'Payment received', 'Your application is being processed and payment is pending verification.', 'success');
      });
      return getApplicationByIdAsync(updated.id, user.id);
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
    const recentNotifications = notifications.slice(0, 5);
    const unreadNotifications = notifications.filter((item) => !item.read).length;
    const notes = latest?.id ? getApplicationNotes(latest.id) : [];
    const deadlines = safeArray(latest?.institutions)
      .map((item) => getInstitutionCatalog({ search: item.institutionName || item.institution })[0])
      .filter(Boolean)
      .map((institution) => ({
        institutionName: institution.name,
        deadline: institution.applicationDeadline
      }))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const pendingTasks = [];
    if (!latest?.package) pendingTasks.push('Choose an application pack');
    if (!safeArray(latest?.institutions).length) pendingTasks.push('Add at least one institution');
    if (docs.length < 2) pendingTasks.push('Upload supporting documents');
    if (latest?.paymentStatus === STATUS.payment.PENDING_VERIFICATION) pendingTasks.push('Wait for payment verification');
    if (latest?.status === STATUS.application.MISSING_DOCUMENTS) pendingTasks.push('Resolve missing documents');

    const smartAlerts = [];
    if (unreadNotifications) smartAlerts.push(`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`);
    if (latest?.status === STATUS.application.PROCESSING) smartAlerts.push('Your application is being processed');
    if (deadlines[0]?.deadline) smartAlerts.push(`Nearest deadline: ${deadlines[0].institutionName}`);

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

    return {
      user: userId === viewer.id ? viewer : sanitizeUser(getUserById(userId)),
      latestApplication: latestForReadiness,
      applications,
      notifications: recentNotifications,
      unreadNotifications,
      documents: docs,
      reviews,
      notes,
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

    return {
      id: item?.id || uid('inst'),
      institutionName,
      institution: institutionName,
      university: institutionName,
      province: item?.province || '',
      institutionType: item?.institutionType || item?.type || '',
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
    return (
      currentUser()?.profileImage ||
      localStorage.getItem('kagie_profile_photo') ||
      localStorage.getItem('kagieProfileImage') ||
      localStorage.getItem('kagie_profile_avatar_v1') ||
      ''
    );
  }

  function getCatalog() {
    return clone(getKagieData());
  }

  function createAssistant(data) {
    requireRole([ROLES.MASTER]);

    const settings = getSettings();
    if (settings.supabase.adminCreateAssistantEndpoint) {
      return createAssistantAccount(data);
    }

    const fullName = String(data?.fullName || '').trim();
    const email = normalizeEmail(data?.email);
    const password = String(data?.password || '123456');
    const phone = String(data?.phone || '').trim();

    if (!fullName) throw new Error('Assistant full name is required.');
    if (!email) throw new Error('Assistant email is required.');
    if (getUserByEmail(email)) throw new Error('An account with this email already exists.');

    const assistant = {
      id: uid('assistant'),
      supabaseUserId: '',
      fullName,
      email,
      password,
      phone,
      role: ROLES.ASSISTANT,
      profileImage: '',
      source: 'local',
      profile: {},
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    upsertLocalUser(assistant);
    return sanitizeUser(assistant);
  }

  function removeAssistant(userId) {
    requireRole([ROLES.MASTER]);
    const user = getUserById(userId);
    if (!user || user.role !== ROLES.ASSISTANT) throw new Error('Assistant not found.');
    return deleteUserByAdmin(userId);
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
      if (value !== KEYS.cartPrefix) localStorage.removeItem(value);
    });
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(KEYS.cartPrefix)) localStorage.removeItem(key);
    });
    write(KEYS.settings, DEFAULT_SETTINGS);
    ensureSeedAdmins();
    return true;
  }

  ensureSeedAdmins();
  write(KEYS.settings, mergeDeep(DEFAULT_SETTINGS, read(KEYS.settings, DEFAULT_SETTINGS)));
  sanitizeStoredUsers();

  window.KagieAPI = {
    KEYS,
    STATUS,
    ROLES,

    getSettings,
    saveSettings,
    getCatalog,
    getPackCatalog,
    getServiceCatalog,
    getInstitutionCatalog,
    getHighSchoolCatalog,
    getSubjectCatalog,
    getProspectusCatalog,
    getUpdateFeed,
    configureSupabase,
    isSupabaseEnabled,
    initSupabaseClient,
    getSupabaseSession,
    getSupabaseVerifiedUser,
    restoreSession,

    registerUser,
    login,
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
    updateUserByAdmin,
    deleteUserByAdmin,
    createAssistantAccount,
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
    assignAssistant,
    assignAssistantAsync,
    addApplicationNote,
    addApplicationNoteAsync,
    getApplicationNotes,
    getApplicationNotesAsync,
    getNotes,
    addNote,
    getDashboardSummary,
    getDashboardSummaryAsync,
    getAdminSummary,
    getAdminSummaryAsync,
    stats,
    statusClass,

    getCart,
    getCartAsync,
    addCartItem,
    addCartItemAsync,
    removeCartItem,
    removeCartItemAsync,
    clearCart,
    clearCartAsync,
    getCartTotal,
    getCartTotalAsync,

    getNotifications,
    getNotificationsAsync,
    pushNotification,
    pushNotificationAsync,
    pushGlobalNotification,
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
})();
