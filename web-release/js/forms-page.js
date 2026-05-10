(function () {
  window.KagieFormsPageLoaded = true;
  const $ = (id) => document.getElementById(id);
  const on = (id, eventName, handler, options) => {
    const element = $(id);
    if (element) element.addEventListener(eventName, handler, options);
    return element;
  };
  const setText = (id, value) => {
    const element = $(id);
    if (element) element.textContent = value;
    return element;
  };
  const setHtml = (id, value) => {
    const element = $(id);
    if (element) element.innerHTML = value;
    return element;
  };
  const setValue = (id, value) => {
    const element = $(id);
    if (element) element.value = value;
    return element;
  };
  const setPlaceholder = (id, value) => {
    const element = $(id);
    if (element) element.placeholder = value;
    return element;
  };
  const setDisplay = (id, value) => {
    const element = $(id);
    if (element) element.style.display = value;
    return element;
  };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin"].includes(value)) return "master_admin";
    return value || "user";
  };
  const money = (v) => `R${Number(v || 0).toLocaleString("en-ZA")}`;
  const institutionFeeLabel = (item) => {
    const fee = Number(item?.applicationFee || 0);
    if (fee > 0) return `Institution fee: ${money(fee)}`;
    return item?.applicationFeeLabel || "Institution fee: Free";
  };
  const readStore = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  const uniqueStrings = (items) => [...new Set(asArray(items).map((item) => String(item || "").trim()).filter(Boolean))];
  const institutionDedupeKey = (item) => {
    const name = String(item?.name || item?.institutionName || item?.institution || "").trim().replace(/\s+/g, " ").replace(/[.,'"]/g, "").toLowerCase();
    return name || "";
  };
  const uniqueInstitutions = (items) => {
    const seen = new Set();
    const records = [];
    asArray(items).forEach((item) => {
      const key = institutionDedupeKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      records.push(item);
    });
    return records;
  };
  const institutionGroupLabel = (type) => {
    const value = String(type || "").toLowerCase();
    if (value.includes("tvet")) return "TVET Colleges";
    if (value.includes("private")) return "Private Colleges";
    if (value.includes("university")) return "Universities";
    return "Other Institutions";
  };
  const safeSyncCall = (label, fn, fallback) => {
    try {
      return typeof fn === "function" ? fn() : fallback;
    } catch (error) {
      console.warn(`Kagie forms fallback for ${label}:`, error);
      return fallback;
    }
  };
  const debounce = (fn, delay = 140) => {
    let timer = 0;
    return (...args) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        fn(...args);
      }, delay);
    };
  };
  const schoolPhaseLabel = (school) => String(school?.phase || school?.schoolType || "School").trim();
  const schoolLocationLabel = (school) => [school?.town, school?.district, school?.province].map((item) => String(item || "").trim()).filter(Boolean).join(" · ");
  const facultyFocusLabel = (faculty) => uniqueStrings(faculty?.focusTags).slice(0, 3).join(" · ");
  const facultySummaryText = (faculty) => String(faculty?.summary || "").trim() || `${Number(faculty?.courseCount || asArray(faculty?.courses).length || 0)} visible course options available in Kagie.`;
  const courseCountLabel = (institution) => `${Number(institution?.facultyCount || asArray(institution?.faculties).length || 0)} faculties · ${Number(institution?.courseCount || 0)} visible courses`;

  async function main() {
    const api = window.KagieAPI;
    if (!api) {
      throw new Error("Kagie form services are still loading. Refresh and try again.");
    }
    let restored = safeSyncCall("current user", () => api.currentUser(), null);
    if (!restored && api.restoreSession) {
      restored = await Promise.resolve(api.restoreSession()).catch((error) => {
        console.warn("Kagie forms session restore fallback:", error);
        return safeSyncCall("current user", () => api.currentUser(), null);
      });
    }
    if (!restored) {
      restored = await new Promise((resolve) => {
        window.setTimeout(async () => {
          const retryUser = safeSyncCall("current user retry", () => api.currentUser(), null)
            || await Promise.resolve(api.restoreSession?.()).catch(() => null);
          resolve(retryUser);
        }, 220);
      });
    }
    if (!restored || normalizeRole(restored.role) !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const experiencePrefs = api.getUserExperiencePreferences ? api.getUserExperiencePreferences(user.id) : { lowDataMode: false, reducedMotion: false };
    document.body.classList.toggle("low-data-mode", !!experiencePrefs.lowDataMode);
    document.body.classList.toggle("reduced-motion", !!experiencePrefs.reducedMotion);
    let catalog = window.KagieData || {};
    let packs = safeSyncCall(
      "pack catalog",
      () => (api.getPackCatalog ? asArray(api.getPackCatalog()) : asArray(catalog.applicationPacks)),
      asArray(catalog.applicationPacks)
    );
    const currentYear = String(new Date().getFullYear());
    let institutionYears = safeSyncCall(
      "institution years",
      () => (api.getInstitutionYears ? asArray(api.getInstitutionYears()) : [currentYear]),
      [currentYear]
    );
    const provinces = asArray(catalog.provinces);
    const genders = asArray(catalog.genders);
    const homeLanguages = asArray(catalog.homeLanguages);
    const schoolTypes = asArray(catalog.schoolTypes);
    let subjectCatalog = safeSyncCall(
      "subject catalog",
      () => api.getSubjectCatalog
        ? asArray(api.getSubjectCatalog())
        : asArray(catalog.nscSubjects).length
          ? asArray(catalog.nscSubjects)
          : (asArray(catalog.iebSubjects).length ? asArray(catalog.iebSubjects) : asArray(catalog.dbeSubjects)),
      asArray(catalog.nscSubjects).length
        ? asArray(catalog.nscSubjects)
        : (asArray(catalog.iebSubjects).length ? asArray(catalog.iebSubjects) : asArray(catalog.dbeSubjects))
    );
    let searchableHighSchools = null;
    let schoolsByName = null;
    let schoolSuggestionMatches = [];
    let favoriteEntries = [];
    let currentRecommendationEntries = [];
    let nationalCatalogLoadPromise = null;
    let nationalCatalogLoaded = Boolean(asArray((window.KagieData || {}).highSchools).length);
    let minorRenderTimer = 0;
    let recommendationCacheKey = "";
    let recommendationCacheValue = { aps: { total: 0, withLifeOrientation: 0, averagePercent: 0, strengths: [] }, topMatches: [], safeAlternatives: [], balancedOptions: [], warnings: [] };
    const institutionCatalogByYear = new Map();
    const institutionSearchTextByKey = new Map();

    const refreshCatalogBindings = () => {
      catalog = window.KagieData || {};
      institutionCatalogByYear.clear();
      institutionSearchTextByKey.clear();
      institutionYears = safeSyncCall(
        "institution years",
        () => (api.getInstitutionYears ? asArray(api.getInstitutionYears()) : [currentYear]),
        [currentYear]
      );
      subjectCatalog = safeSyncCall(
        "subject catalog",
        () => api.getSubjectCatalog
          ? asArray(api.getSubjectCatalog())
          : asArray(catalog.nscSubjects).length
            ? asArray(catalog.nscSubjects)
            : (asArray(catalog.iebSubjects).length ? asArray(catalog.iebSubjects) : asArray(catalog.dbeSubjects)),
        asArray(catalog.nscSubjects).length
          ? asArray(catalog.nscSubjects)
          : (asArray(catalog.iebSubjects).length ? asArray(catalog.iebSubjects) : asArray(catalog.dbeSubjects))
      );
      searchableHighSchools = null;
      schoolsByName = null;
    };

    const refreshPackCatalog = async () => {
      if (!api.getPackCatalogAsync) return;
      try {
        const latestPacks = asArray(await api.getPackCatalogAsync(true));
        if (!latestPacks.length) return;
        packs = latestPacks;
        if (state?.selectedPackId && !packs.find((item) => item.id === state.selectedPackId)) {
          state.selectedPackId = "";
          saveWork();
        }
        renderAll();
      } catch (error) {
        console.warn("Kagie pack catalog refresh fallback:", error);
      }
    };

    const loadExternalScript = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-kagie-dynamic="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve(true);
          return;
        }
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.kagieDynamic = src;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve(true);
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      document.head.appendChild(script);
    });

    const ensureNationalCatalogLoaded = async () => {
      if (nationalCatalogLoaded || asArray((window.KagieData || {}).highSchools).length) {
        nationalCatalogLoaded = true;
        api.refreshCatalogCaches?.();
        refreshCatalogBindings();
        return true;
      }

      if (!nationalCatalogLoadPromise) {
        nationalCatalogLoadPromise = loadExternalScript("js/sa-catalog.js?v=20260426a")
          .then(() => {
            nationalCatalogLoaded = true;
            api.refreshCatalogCaches?.();
            refreshCatalogBindings();
            return true;
          })
          .catch((error) => {
            console.warn("Could not load Kagie's national catalog bundle:", error);
            return false;
          })
          .finally(() => {
            nationalCatalogLoadPromise = null;
          });
      }

      return nationalCatalogLoadPromise;
    };

    const scheduleNationalCatalogWarmup = () => {
      const warm = () => {
        ensureNationalCatalogLoaded().then((loaded) => {
          if (loaded && (state.current === "school" || state.current === "apply" || state.school.schoolName || state.institutions.length)) {
            renderAll();
          }
        });
      };
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(warm, { timeout: 1200 });
      } else {
        window.setTimeout(warm, 180);
      }
    };

    const ensureSchoolIndex = () => {
      if (searchableHighSchools && schoolsByName) return;
      const highSchools = safeSyncCall(
        "high school catalog",
        () => (api.getHighSchoolCatalog ? asArray(api.getHighSchoolCatalog({ phaseGroup: "senior" })) : asArray(catalog.highSchools)),
        asArray(catalog.highSchools)
      );
      searchableHighSchools = highSchools.map((school) => ({
        ...school,
        searchKey: normalizeText([school.name, school.province, school.district, school.town, school.address, school.phase, school.schoolType].filter(Boolean).join(" "))
      }));
      schoolsByName = searchableHighSchools.reduce((acc, school) => {
        const key = normalizeText(school.name);
        if (!key) return acc;
        const list = acc.get(key) || [];
        list.push(school);
        acc.set(key, list);
        return acc;
      }, new Map());
    };
    const loadFavorites = async () => {
      try {
        favoriteEntries = api.getFavoritesAsync ? asArray(await api.getFavoritesAsync(user.id)) : (api.getFavorites ? asArray(api.getFavorites(user.id)) : []);
      } catch (error) {
        console.warn("Could not load favorites:", error);
        favoriteEntries = api.getFavorites ? asArray(api.getFavorites(user.id)) : [];
      }
      return favoriteEntries;
    };
    const stepKey = "kagie_forms_section";
    const workKey = `kagie_forms_work_${user.id}`;
    const steps = [
      { key: "learner", label: "Learner", hint: "Personal details" },
      { key: "parent", label: "Parent", hint: "Guardian details" },
      { key: "school", label: "School", hint: "School details" },
      { key: "marks", label: "Marks", hint: "Subjects and %" },
      { key: "pack", label: "Package", hint: "Tap to choose" },
      { key: "apply", label: "Institutions", hint: "Choices" }
    ];
    const stepAliases = { package: "pack", packages: "pack", institution: "apply", institutions: "apply", recommendations: "apply" };
    const requestedStepParam = String(new URLSearchParams(window.location.search).get("step") || "").trim().toLowerCase();
    const requestedStep = stepAliases[requestedStepParam] || requestedStepParam;
    const defs = {
      learner: [["idNumber", "ID number"], ["fullNames", "Full names"], ["surname", "Surname"], ["maidenName", "Maiden name"], ["cellphone", "Cellphone"], ["email", "Email", "email"], ["province", "Province", "select"], ["postalCode", "Postal code"], ["dob", "Date of birth", "date"], ["gender", "Gender", "select"], ["homeLanguage", "Home language", "select"], ["address", "Home address", "textarea"], ["needsBursary", "Bursary required", "choice"], ["needsResidence", "Apply for residence", "choice"], ["hasDisability", "Disability", "choice"], ["disabilityDescription", "Describe the disability", "textarea"]],
      parent: [["guardianRelation", "Relation"], ["guardianId", "Guardian ID"], ["guardianFullNames", "Guardian full names"], ["guardianSurname", "Guardian surname"], ["guardianCell1", "Primary phone"], ["guardianCell2", "Alternative phone"], ["guardianEmail", "Email", "email"], ["guardianProvince", "Guardian province", "select"], ["guardianPostal", "Postal code"], ["guardianAddress", "Address", "textarea"]],
      school: [["schoolName", "High school"], ["confirmName", "Confirm high school"], ["schoolProvince", "School province", "select"], ["schoolType", "School type", "select"], ["completionYear", "Completion year", "number"], ["average", "Average percent", "number"]]
    };
    const fill = (id, list, selected, label) => {
      const field = $(id);
      if (!field) return;
      const items = [...new Set((list || []).filter(Boolean))];
      field.innerHTML = [`<option value="">${esc(label)}</option>`].concat(items.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`)).join("");
      field.value = items.includes(selected) ? selected : "";
    };
    const setDataList = (id, items) => {
      const node = $(id);
      if (!node) return;
      const seen = new Set();
      const records = [];
      (items || []).forEach((item) => {
        const entry = typeof item === "string"
          ? { value: item, label: "" }
          : { value: item?.value, label: item?.label || "" };
        const value = String(entry.value || "").trim();
        const labelText = String(entry.label || "").trim();
        const key = `${value}__${labelText}`;
        if (!value || seen.has(key)) return;
        seen.add(key);
        records.push({ value, label: labelText });
      });
      node.innerHTML = records.slice(0, 80).map((entry) => `<option value="${esc(entry.value)}"${entry.label ? ` label="${esc(entry.label)}"` : ""}></option>`).join("");
    };
    const normPack = (pack) => !pack ? null : (packs.find((item) => item.id === pack.id) || packs.find((item) => item.name === (pack.name || pack.packName)) || null);
    const institutionStatusClass = (status) => {
      if (status === "open") return "status-open";
      if (status === "closing_soon") return "status-soon";
      return "status-closed";
    };
    const institutionStatusLabel = (status) => {
      if (status === "open") return "Open";
      if (status === "closing_soon") return "Closing Soon";
      return "Closed";
    };
    const normInst = (items) => (Array.isArray(items) ? items : []).map((item, i) => ({
      id: item.id || `inst_${i + 1}`,
      institutionId: item.institutionId || "",
      province: item.province || "",
      institutionType: item.institutionType || "",
      institutionName: item.institutionName || item.institution || "",
      faculty: item.faculty || "",
      choice1: item.choice1 || "",
      choice2: item.choice2 || "",
      choice3: item.choice3 || "",
      year: String(item.year || currentYear),
      institutionStatus: item.institutionStatus || item.status || "",
      closingDate: item.closingDate || item.applicationDeadline || ""
    }));
    const getSchoolMatch = (name, provinceHint) => {
      ensureSchoolIndex();
      const matches = schoolsByName.get(normalizeText(name)) || [];
      if (!matches.length) return null;
      if (provinceHint) return matches.find((school) => school.province === provinceHint) || matches[0];
      return matches[0];
    };
    let noticeTimer = null;
    const showNotice = (msg, tone = "info") => {
      const n = $("notice");
      if (!n) {
        console.warn("Kagie notice target missing:", msg);
        return;
      }
      n.className = `notice ${tone} show`;
      n.textContent = msg;
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        n.className = "notice info";
        n.textContent = "";
      }, 3600);
    };
    const actionLocks = new Set();
    const withActionLock = async (button, key, busyText, task) => {
      const lockKey = String(key || button?.id || "form-action");
      if (actionLocks.has(lockKey)) return null;
      actionLocks.add(lockKey);
      const originalText = button?.textContent || "";
      const originalDisabled = Boolean(button?.disabled);
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (busyText) button.textContent = busyText;
      }
      const slowTimer = window.setTimeout(() => {
        showNotice("Still processing, please wait...", "info");
      }, 3200);
      try {
        return await task();
      } finally {
        window.clearTimeout(slowTimer);
        actionLocks.delete(lockKey);
        if (button?.isConnected) {
          button.disabled = originalDisabled;
          button.removeAttribute("aria-busy");
          if (busyText) button.textContent = originalText;
        }
      }
    };

    const localProfile = api.getProfile ? (api.getProfile(user.id) || {}) : {};
    const localDraft = api.ensureDraft ? api.ensureDraft(user.id) : {};
    let profile = localProfile;
    let draft = localDraft;
    try {
      if (api.getProfileAsync) {
        profile = await api.getProfileAsync(user.id) || localProfile;
      }
    } catch (error) {
      console.warn("Falling back to local profile:", error);
      profile = localProfile;
    }
    try {
      if (api.ensureDraftAsync) {
        draft = await api.ensureDraftAsync(user.id) || localDraft;
      }
    } catch (error) {
      console.warn("Falling back to local draft:", error);
      draft = localDraft;
    }
    const localLearnerSupport = safeSyncCall(
      "learner support",
      () => api.getApplicationLearnerSupport ? (api.getApplicationLearnerSupport(draft.id) || {}) : {},
      {}
    );
    let learnerSupport = localLearnerSupport;
    try {
      if (api.getApplicationLearnerSupportAsync) {
        learnerSupport = await api.getApplicationLearnerSupportAsync(draft.id) || localLearnerSupport;
      }
    } catch (error) {
      console.warn("Falling back to local learner support:", error);
      learnerSupport = localLearnerSupport;
    }
    const saved = readStore(workKey, {});
    const forms = draft.forms || {};
    const pack = normPack(draft.package);
    const state = {
      current: steps.some((s) => s.key === requestedStep) ? requestedStep : (steps.some((s) => s.key === saved.current) ? saved.current : (steps.some((s) => s.key === localStorage.getItem(stepKey)) ? localStorage.getItem(stepKey) : "learner")),
      learner: { idNumber: saved.learner?.idNumber ?? forms.learner?.idNumber ?? profile.idNumber ?? "", fullNames: saved.learner?.fullNames ?? forms.learner?.fullNames ?? profile.fullName ?? "", surname: saved.learner?.surname ?? forms.learner?.surname ?? profile.surname ?? "", maidenName: saved.learner?.maidenName ?? forms.learner?.maidenName ?? "", cellphone: saved.learner?.cellphone ?? forms.learner?.cellphone ?? profile.phone ?? "", email: saved.learner?.email ?? forms.learner?.email ?? profile.email ?? user.email ?? "", province: saved.learner?.province ?? forms.learner?.province ?? profile.province ?? "", postalCode: saved.learner?.postalCode ?? forms.learner?.postalCode ?? profile.postalCode ?? "", dob: saved.learner?.dob ?? forms.learner?.dob ?? profile.dob ?? "", gender: saved.learner?.gender ?? forms.learner?.gender ?? profile.gender ?? "", homeLanguage: saved.learner?.homeLanguage ?? forms.learner?.homeLanguage ?? profile.homeLanguage ?? "", address: saved.learner?.address ?? forms.learner?.address ?? profile.address ?? "", needsBursary: saved.learner?.needsBursary ?? learnerSupport.needsBursary ?? forms.learner?.needsBursary ?? profile.needsBursary ?? "", needsResidence: saved.learner?.needsResidence ?? learnerSupport.needsResidence ?? forms.learner?.needsResidence ?? profile.needsResidence ?? "", hasDisability: saved.learner?.hasDisability ?? learnerSupport.hasDisability ?? forms.learner?.hasDisability ?? profile.hasDisability ?? "", disabilityDescription: saved.learner?.disabilityDescription ?? learnerSupport.disabilityDescription ?? forms.learner?.disabilityDescription ?? profile.disabilityDescription ?? "" },
      parent: { guardianRelation: saved.parent?.guardianRelation ?? forms.parent?.guardianRelation ?? profile.guardianRelation ?? "", guardianId: saved.parent?.guardianId ?? forms.parent?.guardianId ?? profile.guardianId ?? "", guardianFullNames: saved.parent?.guardianFullNames ?? forms.parent?.guardianFullNames ?? profile.guardianName ?? "", guardianSurname: saved.parent?.guardianSurname ?? forms.parent?.guardianSurname ?? profile.guardianSurname ?? "", guardianCell1: saved.parent?.guardianCell1 ?? forms.parent?.guardianCell1 ?? profile.guardianPhone ?? "", guardianCell2: saved.parent?.guardianCell2 ?? forms.parent?.guardianCell2 ?? profile.guardianPhoneAlt ?? "", guardianEmail: saved.parent?.guardianEmail ?? forms.parent?.guardianEmail ?? profile.guardianEmail ?? "", guardianProvince: saved.parent?.guardianProvince ?? forms.parent?.guardianProvince ?? profile.guardianProvince ?? "", guardianPostal: saved.parent?.guardianPostal ?? forms.parent?.guardianPostal ?? profile.guardianPostal ?? "", guardianAddress: saved.parent?.guardianAddress ?? forms.parent?.guardianAddress ?? profile.guardianAddress ?? "" },
      school: { schoolName: saved.school?.schoolName ?? forms.school?.schoolName ?? profile.schoolName ?? profile.schoolAttended ?? "", confirmName: saved.school?.confirmName ?? forms.school?.confirmName ?? forms.school?.schoolName ?? profile.schoolName ?? profile.schoolAttended ?? "", schoolProvince: saved.school?.schoolProvince ?? forms.school?.schoolProvince ?? profile.schoolProvince ?? "", schoolType: saved.school?.schoolType ?? forms.school?.schoolType ?? profile.schoolType ?? "", completionYear: saved.school?.completionYear ?? forms.school?.completionYear ?? profile.completionYear ?? "", average: saved.school?.average ?? forms.school?.average ?? profile.average ?? "" },
      marks: Array.isArray(saved.marks) ? clone(saved.marks) : (Array.isArray(forms.marks?.subjects) ? clone(forms.marks.subjects) : clone(profile.marks || [])),
      selectedPackId: saved.selectedPackId ?? pack?.id ?? "",
      institutions: Array.isArray(saved.institutions) && saved.institutions.length ? normInst(saved.institutions) : normInst(draft.institutions),
      apply: {
        year: String(saved.apply?.year ?? currentYear),
        province: saved.apply?.province ?? "",
        institutionType: saved.apply?.institutionType ?? "",
        institutionName: saved.apply?.institutionName ?? "",
        facultyName: saved.apply?.facultyName ?? "",
        choice1: saved.apply?.choice1 ?? "",
        choice2: saved.apply?.choice2 ?? "",
        choice3: saved.apply?.choice3 ?? ""
      }
    };

    const normalizeDobForState = (value) => {
      const picker = window.KagieDobWheel;
      const normalized = picker?.normalize ? picker.normalize(value) : null;
      return normalized?.iso || String(value || "").trim();
    };

    const validateDobSelection = () => {
      if (!state.learner.dob) return { ok: true };
      const picker = window.KagieDobWheel;
      if (!picker?.validateValue) return { ok: true };
      const checked = picker.validateValue(state.learner.dob, { minAge: 13 });
      if (checked.ok) {
        state.learner.dob = checked.iso;
        return checked;
      }
      showNotice(checked.message || "Choose a valid date of birth.", "warn");
      const dobField = $("dob");
      if (dobField) {
        dobField.focus();
        picker.open?.(dobField);
      }
      return checked;
    };

    await loadFavorites();

    const DIRTY_PROFILE_SECTIONS = ["learner", "parent", "school"];
    const dirtySections = new Set();
    let localPersistTimer = 0;
    let autoSaveTimer = 0;
    let autoSaveInFlight = false;
    let autoSaveQueued = false;

    const buildWorkSnapshot = () => ({
      current: state.current,
      learner: state.learner,
      parent: state.parent,
      school: state.school,
      marks: state.marks,
      selectedPackId: state.selectedPackId,
      institutions: state.institutions,
      apply: state.apply
    });

    const persistWorkNow = () => {
      localStorage.setItem(stepKey, state.current);
      localStorage.setItem(workKey, JSON.stringify(buildWorkSnapshot()));
    };

    const queuePersistWork = () => {
      if (localPersistTimer) window.clearTimeout(localPersistTimer);
      localPersistTimer = window.setTimeout(() => {
        localPersistTimer = 0;
        persistWorkNow();
      }, 320);
    };

    const saveWork = (options = {}) => {
      if (options.immediate) {
        if (localPersistTimer) {
          window.clearTimeout(localPersistTimer);
          localPersistTimer = 0;
        }
        persistWorkNow();
        return;
      }
      queuePersistWork();
    };

    const scheduleProfileAutoSave = (delay = 1200) => {
      if (!api.saveFormSectionAsync) return;
      if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
      autoSaveTimer = window.setTimeout(() => {
        autoSaveTimer = 0;
        flushDirtySections();
      }, delay);
    };

    const markSectionDirty = (sectionKey) => {
      if (!DIRTY_PROFILE_SECTIONS.includes(sectionKey)) return;
      dirtySections.add(sectionKey);
      scheduleProfileAutoSave();
    };

    const flushDirtySections = async () => {
      if (!dirtySections.size) return true;
      if (autoSaveInFlight) {
        autoSaveQueued = true;
        return false;
      }

      autoSaveInFlight = true;
      const failed = [];
      try {
        for (const key of DIRTY_PROFILE_SECTIONS) {
          if (!dirtySections.has(key)) continue;
          dirtySections.delete(key);
          const saved = await saveStep(key, { silent: true });
          if (saved === false) failed.push(key);
        }
      } finally {
        autoSaveInFlight = false;
      }

      failed.forEach((key) => dirtySections.add(key));
      if (autoSaveQueued || dirtySections.size) {
        autoSaveQueued = false;
        scheduleProfileAutoSave(1100);
      }
      return failed.length === 0;
    };

    window.addEventListener("pagehide", () => saveWork({ immediate: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveWork({ immediate: true });
    });

    const selectedPack = () => packs.find((item) => item.id === state.selectedPackId) || null;
    const packFeatureMap = {
      launch: [
        "Up to 10 institutions",
        "Application tracking",
        "Profile auto-fill",
        "Basic document support",
        "Notifications and progress updates"
      ],
      growth: [
        "Everything in Starter",
        "Up to 15 institutions",
        "APS calculation",
        "Smart course suggestions",
        "Better shortlist coverage"
      ],
      premium: [
        "Everything in Smart Choice",
        "Up to 20 institutions",
        "Stronger recommendations",
        "Deadline alerts",
        "Proof-of-submission tracking"
      ],
      concierge: [
        "Everything in Ambition",
        "Unlimited institutions",
        "Priority processing queue",
        "Advanced timeline tracking",
        "Maximum coverage"
      ]
    };
    const markAvg = () => !state.marks.length ? null : Math.round(state.marks.reduce((s, m) => s + Number(m.percent || 0), 0) / state.marks.length);
    const workingAvg = () => {
      const schoolAvg = Number(state.school.average);
      return !Number.isNaN(schoolAvg) && schoolAvg > 0 ? Math.round(schoolAvg) : markAvg();
    };
    const apsSummary = () => safeSyncCall(
      "APS calculator",
      () => (api.calculateAps ? api.calculateAps(state.marks) : { total: 0, withLifeOrientation: 0, averagePercent: markAvg() || 0, strengths: [] }),
      { total: 0, withLifeOrientation: 0, averagePercent: markAvg() || 0, strengths: [] }
    );
    const packageUsage = () => safeSyncCall(
      "package usage",
      () => api.getPackageUsageSummary ? api.getPackageUsageSummary({ package: selectedPack(), institutions: state.institutions }) : {
        packageName: selectedPack()?.name || "",
        institutionLimit: selectedPack()?.institutionLimit || 0,
        usedSlots: state.institutions.length,
        remainingSlots: selectedPack()?.institutionLimit === "unlimited" ? "Unlimited" : Math.max(0, Number(selectedPack()?.institutionLimit || 0) - state.institutions.length)
      },
      {
        packageName: selectedPack()?.name || "",
        institutionLimit: selectedPack()?.institutionLimit || 0,
        usedSlots: state.institutions.length,
        remainingSlots: selectedPack()?.institutionLimit === "unlimited" ? "Unlimited" : Math.max(0, Number(selectedPack()?.institutionLimit || 0) - state.institutions.length)
      }
    );
    const recommendations = () => {
      const cacheKey = JSON.stringify({
        marks: state.marks.map((item) => [item.subject, Number(item.percent || 0)]),
        year: state.apply.year || currentYear,
        province: state.apply.province || state.learner.province || "",
        institutionType: state.apply.institutionType || "",
        institutionName: state.apply.institutionName || "",
        choice1: state.apply.choice1 || ""
      });
      if (cacheKey === recommendationCacheKey) {
        return recommendationCacheValue;
      }
      const fallback = { aps: apsSummary(), topMatches: [], safeAlternatives: [], balancedOptions: [], warnings: [] };
      recommendationCacheKey = cacheKey;
      recommendationCacheValue = safeSyncCall(
        "recommendation engine",
        () => api.getApplicationRecommendations ? api.getApplicationRecommendations({
          marks: state.marks,
          year: state.apply.year || currentYear,
          province: state.apply.province || state.learner.province || "",
          institutionType: state.apply.institutionType || "",
          institutionName: state.apply.institutionName || "",
          choice1: state.apply.choice1 || "",
          limit: 8
        }) : fallback,
        fallback
      ) || fallback;
      return recommendationCacheValue;
    };
    const applyFavorite = (favorite) => {
      if (!favorite) return;
      state.apply.year = String(favorite.year || state.apply.year || currentYear);
      state.apply.province = favorite.province || "";
      state.apply.institutionType = favorite.institutionType || "";
      state.apply.institutionName = favorite.institutionName || "";
      state.apply.facultyName = favorite.faculty || "";
      if (favorite.type === "course" && favorite.course) {
        state.apply.choice1 = favorite.course;
      }
      saveWork();
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
      showNotice(`${favorite.institutionName || favorite.course} loaded back into your Kagie shortlist form.`, "info");
    };
    const saveFavoriteEntry = async (entry, successMessage) => {
      if (!entry) return;
      try {
        if (api.addFavoriteAsync) await api.addFavoriteAsync(entry, user.id);
        else api.addFavorite(entry, user.id);
      } catch (error) {
        console.error(error);
      }
      await loadFavorites();
      renderFavorites();
      showNotice(successMessage || "Saved to your Kagie favorites.", "success");
    };
    const isWithinSelectedPackLimit = () => {
      const packChoice = selectedPack();
      if (!packChoice) return false;
      if (packChoice.institutionLimit === "unlimited") return true;
      return state.institutions.length <= Number(packChoice.institutionLimit || 0);
    };
    const complete = (key) => ({ learner: Boolean(state.learner.fullNames && state.learner.surname && (state.learner.cellphone || state.learner.email)), parent: Boolean(state.parent.guardianFullNames && state.parent.guardianCell1), school: Boolean(state.school.schoolName && state.school.schoolProvince && state.school.completionYear), marks: state.marks.length > 0, pack: Boolean(selectedPack()), apply: isWithinSelectedPackLimit() }[key] || false);
    const readiness = () => Math.round(steps.filter((step) => complete(step.key)).length / steps.length * 100);
    const learnerSupportPayload = () => ({
      needsBursary: state.learner.needsBursary || "",
      needsResidence: state.learner.needsResidence || "",
      hasDisability: state.learner.hasDisability || "",
      disabilityDescription: state.learner.hasDisability === "yes" ? state.learner.disabilityDescription || "" : ""
    });
    const profilePatch = () => ({ fullName: state.learner.fullNames || user.fullName || "", fullNames: state.learner.fullNames || "", surname: state.learner.surname || "", email: state.learner.email || user.email || "", phone: state.learner.cellphone || user.phone || "", cellphone: state.learner.cellphone || user.phone || "", province: state.learner.province || "", postalCode: state.learner.postalCode || "", address: state.learner.address || "", dob: state.learner.dob || "", gender: state.learner.gender || "", homeLanguage: state.learner.homeLanguage || "", idNumber: state.learner.idNumber || "", needsBursary: state.learner.needsBursary || "", needsResidence: state.learner.needsResidence || "", hasDisability: state.learner.hasDisability || "", disabilityDescription: state.learner.hasDisability === "yes" ? state.learner.disabilityDescription || "" : "", guardianRelation: state.parent.guardianRelation || "", guardianId: state.parent.guardianId || "", guardianName: state.parent.guardianFullNames || "", guardianFullNames: state.parent.guardianFullNames || "", guardianSurname: state.parent.guardianSurname || "", guardianPhone: state.parent.guardianCell1 || "", guardianCell1: state.parent.guardianCell1 || "", guardianPhoneAlt: state.parent.guardianCell2 || "", guardianCell2: state.parent.guardianCell2 || "", guardianEmail: state.parent.guardianEmail || "", guardianProvince: state.parent.guardianProvince || "", guardianPostal: state.parent.guardianPostal || "", guardianAddress: state.parent.guardianAddress || "", schoolName: state.school.schoolName || "", schoolAttended: state.school.schoolName || "", confirmName: state.school.confirmName || state.school.schoolName || "", schoolProvince: state.school.schoolProvince || "", schoolType: state.school.schoolType || "", completionYear: state.school.completionYear || "", average: state.school.average || "", marks: state.marks });

    const syncProfile = async () => {
      try {
        if (api.saveProfileAsync) await api.saveProfileAsync(user.id, profilePatch());
        else api.saveProfile(user.id, profilePatch());
        return true;
      } catch (error) {
        console.warn("Profile sync warning:", error);
        showNotice(`Draft saved, but your shared profile still needs attention: ${error.message}`, "warn");
        return false;
      }
    };

    const saveStep = async (key, options = {}) => {
      const silent = options.silent === true;
      try {
        if (key === "learner" && !validateDobSelection().ok) return false;
        if (key === "learner" || key === "parent" || key === "school") {
          if (api.saveFormSectionAsync) {
            await api.saveFormSectionAsync(key, clone(state[key]), draft.id);
            if (key === "learner" && api.saveApplicationLearnerSupportAsync) {
              await api.saveApplicationLearnerSupportAsync(draft.id, learnerSupportPayload());
            }
          } else {
            api.saveFormSection(key, clone(state[key]), draft.id);
            if (key === "learner" && api.saveApplicationLearnerSupport) {
              api.saveApplicationLearnerSupport(draft.id, learnerSupportPayload());
            }
            await syncProfile();
          }
        }
        if (key === "marks") {
          if (api.saveFormSectionAsync) {
            await api.saveFormSectionAsync("marks", { subjects: clone(state.marks) }, draft.id);
          } else {
            api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
            await syncProfile();
          }
        }
        if (key === "pack") {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: selectedPack() });
          else api.updateApplication(draft.id, { package: selectedPack() });
        }
        if (key === "apply") {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: selectedPack(), institutions: clone(state.institutions) });
          else api.updateApplication(draft.id, { package: selectedPack(), institutions: clone(state.institutions) });
        }
        return true;
      } catch (error) {
        console.error("Could not sync step:", key, error);
        try {
          if (key === "learner" || key === "parent" || key === "school") {
            api.saveFormSection(key, clone(state[key]), draft.id);
            if (key === "learner" && api.saveApplicationLearnerSupport) {
              api.saveApplicationLearnerSupport(draft.id, learnerSupportPayload());
            }
          } else if (key === "marks") {
            api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
          } else if (key === "pack") {
            api.updateApplication(draft.id, { package: selectedPack() });
          } else if (key === "apply") {
            api.updateApplication(draft.id, { package: selectedPack(), institutions: clone(state.institutions) });
          }
        } catch (localError) {
          console.warn("Local fallback save also failed:", localError);
        }
        if (!silent) {
          showNotice(`We kept your progress on this device, but ${key} could not fully save yet: ${error.message}`, "warn");
        }
        return false;
      }
    };

    const saveAll = async () => {
      saveWork({ immediate: true });
      const sectionResults = await Promise.all(
        ["learner", "parent", "school", "marks"].map((key) => saveStep(key, { silent: true }))
      );
      const applicationSaved = await saveStep("apply", { silent: true });
      return sectionResults.concat(applicationSaved).every(Boolean);
    };

    const refreshDraft = async () => {
      try {
        draft = api.getApplicationByIdAsync ? await api.getApplicationByIdAsync(draft.id, user.id) : (api.getApplicationById(draft.id) || api.ensureDraft(user.id));
      } catch (error) {
        console.warn("Falling back to local draft refresh:", error);
        draft = api.getApplicationById(draft.id) || api.ensureDraft(user.id);
      }
      state.institutions = normInst(draft.institutions);
      const livePack = normPack(draft.package);
      state.selectedPackId = livePack?.id || state.selectedPackId || "";
      saveWork();
    };

    const applyDraftSnapshot = (nextDraft) => {
      if (!nextDraft || typeof nextDraft !== "object") return;
      draft = nextDraft;
      state.institutions = normInst(nextDraft.institutions);
      const livePack = normPack(nextDraft.package);
      if (livePack?.id) state.selectedPackId = livePack.id;
      saveWork();
    };

    const optionsFor = (name, value) => {
      if (name === "province" || name === "guardianProvince" || name === "schoolProvince") return [provinces, value, "Select province"];
      if (name === "gender") return [genders, value, "Select gender"];
      if (name === "homeLanguage") return [homeLanguages, value, "Select home language"];
      if (name === "schoolType") return [schoolTypes, value, "Select school type"];
      return [[], value, ""];
    };

    const fieldPlaceholders = {
      idNumber: "Identity number",
      fullNames: "Full names",
      surname: "Surname",
      maidenName: "Maiden name",
      cellphone: "Cellphone number",
      email: "Email",
      province: "Province",
      postalCode: "Postal code",
      dob: "Date of birth",
      gender: "Gender",
      homeLanguage: "Home language",
      address: "Address",
      needsBursary: "Bursary required",
      needsResidence: "Apply for residence",
      hasDisability: "Disability",
      disabilityDescription: "Describe the disability",
      guardianRelation: "Relation",
      guardianId: "Identity number",
      guardianFullNames: "Full names",
      guardianSurname: "Surname",
      guardianCell1: "Cellphone number",
      guardianCell2: "Alternative number",
      guardianEmail: "Email",
      guardianProvince: "Province",
      guardianPostal: "Postal code",
      guardianAddress: "Address",
      schoolName: "High school",
      confirmName: "Confirm high school",
      schoolProvince: "Province",
      schoolType: "School type",
      completionYear: "Year of completion",
      average: "Average percent"
    };
    const yesNoLabel = (value) => {
      if (value === "yes") return "Yes";
      if (value === "no") return "No";
      return "";
    };
    const fieldHtml = (group, name, label, type, value) => {
      const placeholder = fieldPlaceholders[name] || label;
      if (group === "learner" && name === "disabilityDescription" && state.learner.hasDisability !== "yes") return "";
      if (type === "choice") {
        return `
          <div class="field-wrap field-span-all">
            <span class="choice-label">${esc(label)}</span>
            <div class="choice-group" role="group" aria-label="${esc(label)}">
              ${["yes", "no"].map((option) => `
                <button
                  class="choice-option ${value === option ? "active" : ""}"
                  type="button"
                  data-choice-group="${group}"
                  data-choice-name="${name}"
                  data-choice-value="${option}"
                  aria-pressed="${value === option ? "true" : "false"}"
                >
                  <span class="choice-tick">${value === option ? "✓" : ""}</span>
                  <span>${esc(yesNoLabel(option))}</span>
                </button>
              `).join("")}
            </div>
          </div>
        `;
      }
      if (type === "textarea") return `<div class="field-wrap field-span-all"><label class="label" for="${name}">${label}</label><textarea class="field" id="${name}" data-group="${group}" data-name="${name}" placeholder="${placeholder}">${esc(value || "")}</textarea></div>`;
      if (type === "select") return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><select class="field" id="${name}" data-group="${group}" data-name="${name}"></select></div>`;
      if (group === "learner" && name === "dob") {
        const normalized = window.KagieDobWheel?.normalize?.(value);
        const iso = normalized?.iso || String(value || "").trim();
        const display = normalized?.display || String(value || "").trim();
        return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><input class="field" id="${name}" data-group="${group}" data-name="${name}" data-dob-wheel data-min-age="13" data-iso-value="${esc(iso)}" type="text" inputmode="none" autocomplete="bday" placeholder="Day / Month / Year" value="${esc(display)}" readonly /></div>`;
      }
      if (group === "school" && name === "schoolName") return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><input class="field" id="${name}" data-group="${group}" data-name="${name}" type="text" list="schoolNameOptions" autocomplete="off" placeholder="${placeholder}" value="${esc(value || "")}" /></div>`;
      return `<div class="field-wrap"><label class="label" for="${name}">${label}</label><input class="field" id="${name}" data-group="${group}" data-name="${name}" type="${type || "text"}" placeholder="${placeholder}" value="${esc(value || "")}" /></div>`;
    };

    const renderFields = (target, group) => {
      const targetNode = $(target);
      if (!targetNode) return;
      targetNode.innerHTML = defs[group].map(([name, label, type]) => fieldHtml(group, name, label, type, state[group][name])).join("");
      defs[group].forEach(([name, , type]) => {
        if (type === "select") {
          const [list, value, placeholder] = optionsFor(name, state[group][name]);
          fill(name, list, value, placeholder);
        }
      });
      if (group === "learner") window.KagieDobWheel?.attachAll?.(targetNode);
    };

    const renderSchoolSuggestionCards = (matches) => {
      const container = $("schoolLookupResults");
      if (!container) return;
      const visible = asArray(matches).slice(0, 8);
      if (!visible.length) {
        container.innerHTML = '<div class="empty">No school suggestions yet. Keep typing and Kagie will search across South African high and secondary schools.</div>';
        return;
      }
      container.innerHTML = visible.map((school) => `
        <button class="school-match" data-school-pick="${esc(school.id || school.name)}" type="button">
          <strong>${esc(school.name)}</strong>
          <small>${esc(schoolLocationLabel(school) || school.province || "South Africa")}</small>
          <small>${esc(schoolPhaseLabel(school))}${school.address ? ` • ${esc(school.address)}` : ""}</small>
        </button>
      `).join("");
    };

    const renderSchoolSuggestions = (query) => {
      ensureSchoolIndex();
      const search = normalizeText(query);
      const provinceHint = state.school.schoolProvince;
      let matches = searchableHighSchools.filter((school) => (!search || school.searchKey.includes(search)) && (!provinceHint || school.province === provinceHint));
      if (!matches.length && provinceHint) {
        matches = searchableHighSchools.filter((school) => !search || school.searchKey.includes(search));
      }
      setDataList("schoolNameOptions", matches.slice(0, 60).map((school) => ({
        value: school.name,
        label: [school.province, school.town || school.district].filter(Boolean).join(" • ")
      })));
    };

    const refreshSchoolLookupResults = () => {
      ensureSchoolIndex();
      const search = normalizeText(state.school.schoolName);
      const provinceHint = state.school.schoolProvince;
      if (!search && !provinceHint) {
        schoolSuggestionMatches = [];
        renderSchoolSuggestionCards([]);
        const meta = $("schoolLookupMeta");
        if (meta) {
          meta.textContent = `Start typing your official school name. Kagie is ready to search across ${searchableHighSchools.length.toLocaleString("en-ZA")} South African high and secondary schools.`;
        }
        return;
      }
      schoolSuggestionMatches = searchableHighSchools.filter((school) => (!search || school.searchKey.includes(search)) && (!provinceHint || school.province === provinceHint)).slice(0, 20);
      if (!schoolSuggestionMatches.length && provinceHint) {
        schoolSuggestionMatches = searchableHighSchools.filter((school) => !search || school.searchKey.includes(search)).slice(0, 20);
      }
      renderSchoolSuggestionCards(schoolSuggestionMatches);
      const matched = getSchoolMatch(state.school.schoolName, state.school.schoolProvince);
      const meta = $("schoolLookupMeta");
      if (!meta) return;
      meta.textContent = matched
        ? `${matched.name} matched in Kagie’s South African high-school masterlist${matched.province ? ` • ${matched.province}` : ""}${matched.town ? ` • ${matched.town}` : ""}. ${searchableHighSchools.length.toLocaleString("en-ZA")} schools are searchable here.`
        : `Start typing your official school name. Kagie is searching across ${searchableHighSchools.length.toLocaleString("en-ZA")} South African high and secondary schools.`;
    };

    const syncSchoolLookup = () => {
      renderSchoolSuggestions(state.school.schoolName);
      const matched = getSchoolMatch(state.school.schoolName, state.school.schoolProvince);
      if (matched) {
        if (!state.school.schoolProvince) state.school.schoolProvince = matched.province || "";
        if (!state.school.schoolType || state.school.schoolType === "Other") state.school.schoolType = matched.schoolType || state.school.schoolType || "";
        const provinceField = $("schoolProvince");
        const typeField = $("schoolType");
        if (provinceField) provinceField.value = state.school.schoolProvince;
        if (typeField) typeField.value = state.school.schoolType;
      }
      const meta = $("schoolLookupMeta");
      if (!meta) return;
      meta.textContent = matched
        ? `${matched.name} matched in the Kagie school masterlist${matched.province ? ` • ${matched.province}` : ""}${matched.town ? ` • ${matched.town}` : ""}. You can still edit the school fields if needed.`
        : "Start typing your official school name. If it does not appear yet, you can still type it manually and keep moving.";
      refreshSchoolLookupResults();
    };

    const renderInstitutionStudyPanel = () => {
      const panel = $("institutionStudyPanel");
      if (!panel) return;
      if (!chosenInstitution) {
        panel.innerHTML = '<div class="empty">Choose an institution first to see faculty details, top courses, and study guidance.</div>';
        return;
      }
      const faculties = asArray(chosenInstitution.faculties);
      if (!faculties.length) {
        panel.innerHTML = `<div class="hintbox"><strong>${esc(chosenInstitution.name)}</strong><p class="helper-meta" style="margin:8px 0 0">${esc(chosenInstitution.studyOverview || "Kagie does not have the richer faculty breakdown for this institution yet, so you can type the official faculty and course names manually.")}</p></div>`;
        return;
      }
      panel.innerHTML = `
        <div class="hintbox">
          <div class="row">
            <strong>${esc(chosenInstitution.name)}</strong>
            <span class="pill">${esc(courseCountLabel(chosenInstitution))}</span>
          </div>
          <p class="helper-meta" style="margin:8px 0 0">${esc(chosenInstitution.studyOverview || `${chosenInstitution.name} has guided faculty and course suggestions ready in Kagie.`)}</p>
        </div>
        <div class="study-grid">
          ${faculties.slice(0, 6).map((faculty) => `
            <div class="study-card">
              <strong>${esc(faculty.name)}</strong>
              <small>${esc(facultySummaryText(faculty))}</small>
              ${facultyFocusLabel(faculty) ? `<small>${esc(facultyFocusLabel(faculty))}</small>` : ""}
              <div class="study-courses">
                ${asArray(faculty.featuredCourses && faculty.featuredCourses.length ? faculty.featuredCourses : faculty.courses).slice(0, 4).map((course) => `<span class="course-chip">${esc(course)}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    };

    const renderSteps = () => {
      setHtml("stepList", steps.map((step) => {
        const isActive = state.current === step.key;
        const isDone = complete(step.key);
        const helper = isActive ? step.hint : (isDone ? "Saved" : "Open");
        return `<button class="step-btn ${isActive ? "active" : ""} ${isDone ? "done" : ""}" data-step="${step.key}" type="button"><strong>${esc(step.label)}</strong><small>${esc(helper)}</small></button>`;
      }).join(""));
    };

    const renderSummary = () => {
      const packChoice = selectedPack();
      const avg = workingAvg();
      const aps = apsSummary();
      const nextAction = !complete("learner")
        ? "Start with the learner details."
        : !complete("parent")
          ? "Add a parent or guardian."
          : !complete("school")
            ? "Confirm the school details."
            : !complete("marks")
              ? "Add the NSC marks."
              : !complete("pack")
                ? "Choose a package."
                : !complete("apply")
                  ? "Add institutions now or later."
                  : "Everything is ready. Go to cart.";
      const tips = !state.marks.length
        ? { title: "Add your marks", text: "Once your marks are in, Kagie can suggest better options for you." }
        : aps.total >= 34
          ? { title: "Strong options available", text: "Your APS is strong. You can explore a wide range of universities and courses." }
          : aps.total >= 26
            ? { title: "Good shortlist range", text: "You have a balanced range. Kagie can help you mix safer and stronger options." }
            : { title: "Start with safer options", text: "Kagie can still help you build a realistic shortlist and keep moving." };
      setText("heroTitle", `Hello, ${user.fullName || state.learner.fullNames || "Student"}`);
      setText("packMeta", packChoice ? `${packChoice.name} selected` : "No package selected");
      setText("instMeta", `${state.institutions.length} institution${state.institutions.length === 1 ? "" : "s"}`);
      setText("markMeta", `${state.marks.length} subject${state.marks.length === 1 ? "" : "s"}`);
      setText("avgMeta", avg ? `Average ${avg}%` : "Average pending");
      setText("apsMeta", aps.total ? `APS ${aps.total}` : "APS pending");
      setText("readyMeta", `${readiness()}%`);
      const progressBar = $("progressBar");
      if (progressBar) progressBar.style.width = `${readiness()}%`;
      setText("stepMeta", steps.find((step) => step.key === state.current)?.label || "Learner");
      setText("stepHint", steps.find((step) => step.key === state.current)?.hint || "Complete the current section.");
      setText("guideTitle", tips.title);
      setText("guideText", tips.text);
      setText("heroText", nextAction);
    };

    const renderMarks = () => {
      const avg = markAvg();
      const aps = apsSummary();
      setText("marksCountPill", `${state.marks.length} subject${state.marks.length === 1 ? "" : "s"}`);
      setText("marksAvgPill", avg ? `Calculated average ${avg}%` : "Average pending");
      setText("apsPill", aps.total ? `APS ${aps.total}` : "APS pending");
      setHtml("marksList", state.marks.length ? state.marks.map((mark) => `<div class="item"><div class="row"><div><strong>${esc(mark.subject)}</strong><p>Percent: ${esc(mark.percent)}%<br>NSC level: ${esc(mark.level)}</p></div><button class="mini alt" data-remove-mark="${esc(mark.subject)}" type="button">Remove</button></div></div>`).join("") : `<div class="empty">No subjects added yet. Add each DBE or IEB NSC subject with its percent.</div>`);
    };

    let applyMatches = [];
    let chosenInstitution = null;

    const renderPacks = () => {
      const packChoice = selectedPack();
      setHtml("packGrid", packs.map((item) => {
        const features = packFeatureMap[item.id] || [];
        const countLabel = item.institutionLimit === "unlimited" ? "∞" : String(item.institutionLimit);
        const limitLabel = item.institutionLimit === "unlimited"
          ? "Unlimited institutions"
          : `${item.institutionLimit} institution${Number(item.institutionLimit) === 1 ? "" : "s"}`;
        return `
          <div class="pack ${packChoice?.id === item.id ? "active" : ""}">
            <div class="pack-top">${esc(item.name)}</div>
            <div class="pack-count">${esc(countLabel)}</div>
            <div class="pack-caption">institutions</div>
            <div class="pack-note">${esc(item.highlight)}</div>
            <span class="badge">${esc(money(item.price))}</span>
            <div class="pack-action">
              <button class="mini ${packChoice?.id === item.id ? "green" : ""}" data-pack-id="${esc(item.id)}" type="button">${packChoice?.id === item.id ? "Selected" : "Choose"}</button>
            </div>
            <details class="more-details">
              <summary><span class="more-closed">View more</span><span class="more-open">View less</span></summary>
              <div class="more-content">
                <p>${esc(limitLabel)}</p>
                <p>${esc(item.description)}</p>
                <ul class="feature-list">${features.map((feature) => `<li>${esc(feature)}</li>`).join("")}</ul>
              </div>
            </details>
          </div>
        `;
      }).join(""));
      const previewList = state.institutions.length
        ? `
          <p class="helper-meta" style="margin:0">Institutions inside this package:</p>
          ${state.institutions.slice(0, 4).map((item, index) => `<p>${esc(`${index + 1}. ${item.institutionName} | ${item.choice1 || "Choice 1 pending"}`)}</p>`).join("")}
          ${state.institutions.length > 4 ? `<p>${esc(`${state.institutions.length - 4} more institution${state.institutions.length - 4 === 1 ? "" : "s"} are attached to this package.`)}</p>` : ""}
        `
        : `<p class="helper-meta" style="margin-top:0">No institutions inside this package yet.</p>`;
      setHtml("packSummaryCard", `
        <div class="row">
          <div>
            <strong>${esc(packChoice ? `${packChoice.name} selected` : "No package selected")}</strong>
            <p>${esc(packChoice ? `${money(packChoice.price)} | ${state.institutions.length} inside package | ${packageUsage().remainingSlots} left.` : "Tap one package to continue.")}</p>
          </div>
          ${packChoice ? `<span class="pill">${esc(`${state.institutions.length} inside package`)}</span>` : ""}
        </div>
        ${packChoice ? `<details class="more-details"><summary><span class="more-closed">View package details</span><span class="more-open">View less</span></summary><div class="more-content">${previewList}${packChoice.description ? `<p>${esc(packChoice.description)}</p>` : ""}</div></details>` : previewList}
      `);
    };

    const renderFavorites = () => {
      const cards = favoriteEntries.map((favorite) => {
        const label = favorite.type === "course" ? "Saved course" : "Saved institution";
        const lineOne = favorite.type === "course"
          ? `${favorite.institutionName || ""}${favorite.faculty ? ` | ${favorite.faculty}` : ""}`
          : `${favorite.institutionName || ""}${favorite.faculty ? ` | ${favorite.faculty}` : ""}`;
        const lineTwo = favorite.type === "course"
          ? (favorite.course || "Course not set")
          : `${favorite.institutionType || "Institution"}${favorite.province ? ` | ${favorite.province}` : ""}`;
        return `<div class="item"><div class="row"><div><strong>${esc(label)}</strong><p>${esc(lineOne)}<br>${esc(lineTwo)}</p></div><span class="pill">${esc(favorite.year || currentYear)}</span></div><div class="row"><button class="mini" data-apply-favorite="${esc(favorite.id)}" type="button">Use</button><button class="mini alt" data-remove-favorite="${esc(favorite.id)}" type="button">Remove</button></div></div>`;
      });
      setHtml("favoritesList", cards.length
        ? cards.join("")
        : `<div class="empty">Saved institutions and courses will appear here so you can reuse them later.</div>`);
    };

    const getInstitutionCatalogForYear = (year) => {
      const yearKey = String(year || currentYear);
      if (!institutionCatalogByYear.has(yearKey)) {
        institutionCatalogByYear.set(yearKey, safeSyncCall(
          "institution catalog",
          () => api.getInstitutionCatalog
            ? asArray(api.getInstitutionCatalog({ year: yearKey, includeInactive: false }))
            : [],
          []
        ));
      }
      return institutionCatalogByYear.get(yearKey) || [];
    };

    const institutionSearchText = (item) => {
      const key = [
        institutionDedupeKey(item),
        String(item?.year || ""),
        String(item?.type || ""),
        String(item?.province || "")
      ].join("|");
      if (!institutionSearchTextByKey.has(key)) {
        institutionSearchTextByKey.set(key, normalizeText([
          item?.name,
          item?.shortName,
          item?.type,
          item?.province,
          item?.year,
          institutionStatusLabel(item?.status),
          ...asArray(item?.faculties).map((faculty) => `${faculty.name} ${asArray(faculty.courses).join(" ")}`)
        ].join(" ")));
      }
      return institutionSearchTextByKey.get(key) || "";
    };

    const fillInstitutionOptions = (items, selected) => {
      const field = $("institutionName");
      if (!field) return;
      const searchField = $("institutionSearch");
      const meta = $("institutionSearchMeta");
      const query = normalizeText(searchField?.value || "");
      const uniqueItems = uniqueInstitutions(items || []);
      let options = uniqueItems;
      if (query) {
        options = options.filter((item) => institutionSearchText(item).includes(query));
      }
      const selectedRecord = uniqueItems.find((item) => item.name === selected);
      if (selectedRecord && !options.some((item) => item.name === selectedRecord.name)) {
        options = [selectedRecord].concat(options);
      }
      const groups = options.reduce((acc, item) => {
        const label = institutionGroupLabel(item.type);
        acc[label] = acc[label] || [];
        acc[label].push(item);
        return acc;
      }, {});
      const groupOrder = ["Universities", "TVET Colleges", "Private Colleges", "Other Institutions"];
      const optionHtml = groupOrder
        .filter((label) => asArray(groups[label]).length)
        .map((label) => `
          <optgroup label="${esc(label)}">
            ${groups[label].map((item) => {
              const text = `${item.name} | ${item.type || label} | ${institutionStatusLabel(item.status)}${item.closingDate ? ` | Closes ${item.closingDate}` : ""} | ${institutionFeeLabel(item)}`;
              const selectedAttr = item.name === selected ? ` selected` : "";
              const disabledAttr = item.canApply ? "" : " disabled";
              return `<option class="institution-group-option" value="${esc(item.name)}"${selectedAttr}${disabledAttr}>${esc(text)}</option>`;
            }).join("")}
          </optgroup>
        `)
        .join("");
      field.innerHTML = [`<option value="">Select institution</option>`, optionHtml || `<option value="" disabled>No matching institution found</option>`].join("");

      if (meta) {
        const total = uniqueItems.length;
        meta.textContent = query
          ? `${options.length} of ${total} institutions match "${searchField.value}".`
          : `${total} institutions available, grouped into universities, TVET colleges, and private colleges.`;
      }

      if (options.some((item) => item.name === selected && item.canApply)) {
        field.value = selected;
      } else if (options.some((item) => item.name === selected)) {
        field.value = "";
      } else {
        field.value = "";
      }
    };

    const syncApply = () => {
      const provinceList = catalog.provinces || [];
      const availableYears = institutionYears.length ? institutionYears : [currentYear];
      if (!availableYears.includes(String(state.apply.year || ""))) state.apply.year = availableYears[0] || currentYear;
      const baseMatches = getInstitutionCatalogForYear(state.apply.year);
      const typeList = [...new Set(baseMatches.filter((item) => !state.apply.province || item.province === state.apply.province).map((item) => item.type).filter(Boolean))];
      if (!typeList.includes(state.apply.institutionType)) state.apply.institutionType = "";
      if (!provinceList.includes(state.apply.province)) state.apply.province = "";
      const matches = baseMatches.filter((item) => (!state.apply.province || item.province === state.apply.province) && (!state.apply.institutionType || item.type === state.apply.institutionType));
      applyMatches = matches;
      if (!matches.some((item) => item.name === state.apply.institutionName)) state.apply.institutionName = "";
      chosenInstitution = matches.find((item) => item.name === state.apply.institutionName) || null;
      const guidedFaculties = asArray(chosenInstitution?.faculties);
      const hasGuidedCatalog = guidedFaculties.length > 0;
      const facultyList = !chosenInstitution ? [] : guidedFaculties.map((item) => item.name).filter(Boolean);
      const faculty = guidedFaculties.find((item) => normalizeText(item.name) === normalizeText(state.apply.facultyName));
      const institutionWideCourseList = uniqueStrings(guidedFaculties.flatMap((item) => asArray(item.courses)));
      const courseList = !chosenInstitution
        ? []
        : uniqueStrings(asArray(faculty?.courses).length ? asArray(faculty?.courses) : institutionWideCourseList);
      fill("applyProvince", provinceList, state.apply.province, "Select province");
      fill("applyYear", availableYears, state.apply.year, "Select year");
      fill("institutionType", typeList, state.apply.institutionType, "Select institution type");
      fillInstitutionOptions(matches, state.apply.institutionName);
      setDataList("facultyOptions", facultyList.map((item) => ({ value: item })));
      setDataList("courseOptions", courseList.map((item) => ({ value: item })));
      setValue("facultyName", state.apply.facultyName || "");
      setValue("choice1", state.apply.choice1 || "");
      setValue("choice2", state.apply.choice2 || "");
      setValue("choice3", state.apply.choice3 || "");
      setPlaceholder("facultyName", chosenInstitution ? (hasGuidedCatalog ? "Select or type faculty" : "Type official faculty") : "Select institution first");
      setPlaceholder("choice1", state.apply.facultyName ? "Type or pick choice 1" : "Type choice 1");
      setPlaceholder("choice2", state.apply.facultyName ? "Type or pick choice 2" : "Type choice 2");
      setPlaceholder("choice3", state.apply.facultyName ? "Type or pick choice 3" : "Type choice 3");
      const statusPill = $("institutionStatusPill");
      const datesMeta = $("institutionDatesMeta");
      const addButton = $("addInstitutionBtn");
      const applyMeta = $("applyCatalogMeta");
      if (statusPill) {
        if (!chosenInstitution) {
          statusPill.className = "status-pill status-open";
          statusPill.textContent = `Application year ${state.apply.year}`;
        } else {
          statusPill.className = `status-pill ${institutionStatusClass(chosenInstitution.status)}`;
          statusPill.textContent = `${institutionStatusLabel(chosenInstitution.status)} for ${chosenInstitution.year}`;
        }
      }
      if (datesMeta) {
        datesMeta.textContent = !chosenInstitution
          ? "Choose institution, faculty, and courses."
          : `${chosenInstitution.name} | ${institutionFeeLabel(chosenInstitution)}${chosenInstitution.closingDate ? ` | Closes ${chosenInstitution.closingDate}` : ""}${chosenInstitution.canApply ? "" : " | Currently closed."}`;
      }
      if (applyMeta) {
        applyMeta.textContent = !chosenInstitution
          ? "Type the course if Kagie has not listed it yet."
          : !chosenInstitution.canApply
            ? `${chosenInstitution.name} is closed.`
            : hasGuidedCatalog
              ? `${chosenInstitution.name} is selected.`
              : `${chosenInstitution.name} is selected. Type the official names manually.`;
      }
      const packChoice = selectedPack();
      const addedCount = state.institutions.length;
      const limitLabel = packChoice ? `${addedCount} added / ${packChoice.institutionLimit === "unlimited" ? "Unlimited" : packChoice.institutionLimit}` : "No package selected yet";
      setText("instLimitPill", limitLabel);
      if (addButton) {
        addButton.disabled = !!chosenInstitution && !chosenInstitution.canApply;
        addButton.textContent = chosenInstitution && !chosenInstitution.canApply ? "Institution closed" : "Add institution";
      }
    };

    const loadInstitutionIntoForm = (institution) => {
      if (!institution) return;
      state.apply.year = String(institution.year || state.apply.year || currentYear);
      state.apply.province = institution.province || "";
      state.apply.institutionType = institution.type || "";
      state.apply.institutionName = institution.name || "";
      state.apply.facultyName = "";
      state.apply.choice1 = "";
      state.apply.choice2 = "";
      state.apply.choice3 = "";
      saveWork();
      renderAll();
      showNotice(`${institution.name} loaded into your form.`, "success");
    };

    const renderInst = () => {
      const packChoice = selectedPack();
      setText("packageInstitutionsTitle", packChoice ? `Inside ${packChoice.name}` : "Inside selected package");
      setText("packageInstitutionsMeta", packChoice
        ? "These institutions move with this package to cart."
        : "Choose a package first.");
      setHtml("institutionsList", state.institutions.length ? (() => {
        const rows = state.institutions.map((item, index) => {
          const status = item.institutionStatus || "open";
          return `
            <div class="institution-inline-row ${status === "closed" ? "institution-card closed" : ""}">
              <div class="institution-inline-main">
                <strong>${esc(`${index + 1}. ${item.institutionName}`)}</strong>
                <p>${esc(item.faculty || "Faculty pending")} | ${esc(item.choice1 || "Choice 1 pending")}</p>
              </div>
              <div class="institution-inline-meta">
                <div class="meta-left">
                  <span class="status-pill ${institutionStatusClass(status)}">${esc(institutionStatusLabel(status))}</span>
                  <span class="pill">${esc(institutionFeeLabel(item))}</span>
                </div>
                <div class="meta-right">
                  <button class="mini alt" data-remove-inst="${esc(item.id)}" type="button">Remove</button>
                </div>
              </div>
              <details class="more-details">
                <summary><span class="more-closed">View more</span><span class="more-open">View less</span></summary>
                <div class="more-content">
                  <p>${esc(`Choice 2: ${item.choice2 || "Pending"} | Choice 3: ${item.choice3 || "Pending"}`)}</p>
                  <p>${esc(`Province: ${item.province || "-"} | Year: ${item.year || currentYear}`)}</p>
                  ${item.closingDate ? `<p>${esc(`Closing date: ${item.closingDate}`)}</p>` : ""}
                </div>
              </details>
            </div>
          `;
        }).join("");
        return `
          <div class="item package-institutions-shell">
            <div class="row">
              <div>
                <strong>${esc(packChoice ? packChoice.name : "Selected package")}</strong>
                <p>${esc(`${state.institutions.length} institution${state.institutions.length === 1 ? "" : "s"} inside this package.`)}</p>
              </div>
              <span class="pill">${esc(`${state.institutions.length} inside package`)}</span>
            </div>
            <details class="more-details">
              <summary><span class="more-closed">View institutions</span><span class="more-open">View less</span></summary>
              <div class="institution-inline-list">${rows}</div>
            </details>
          </div>
        `;
      })() : `<div class="empty">No institutions added yet. Choose a package, add an institution, then it will show here.</div>`);
    };

    const safeRenderRecommendations = () => {
      return;
    };

    const safeSyncApply = () => {
      try {
        syncApply();
      } catch (error) {
        console.warn("Kagie forms institution sync fallback:", error);
        applyMatches = [];
        chosenInstitution = null;
        const applyMeta = $("applyCatalogMeta");
        if (applyMeta) {
          applyMeta.textContent = "Kagie could not load the institution guide layer right now, but you can keep saving your details and try the shortlist again after refresh.";
        }
      }
    };

    const queueMinorRender = (delay = 70) => {
      if (minorRenderTimer) window.clearTimeout(minorRenderTimer);
      minorRenderTimer = window.setTimeout(() => {
        minorRenderTimer = 0;
        renderSummary();
        renderSteps();
      }, delay);
    };

    const debouncedRecommendationRefresh = debounce(() => {
      safeRenderRecommendations();
    }, 140);

    const debouncedSchoolLookup = debounce(() => {
      try {
        syncSchoolLookup();
      } catch (error) {
        console.warn("Kagie forms school lookup fallback:", error);
      }
    }, 120);

    const debouncedApplyTypingRefresh = debounce(() => {
      safeSyncApply();
      queueMinorRender();
      safeRenderRecommendations();
    }, 140);

    const renderSections = () => {
      document.querySelectorAll("[data-step]").forEach((section) => section.classList.toggle("active", section.dataset.step === state.current));
      const i = steps.findIndex((step) => step.key === state.current);
      setDisplay("prevBtn", i <= 0 ? "none" : "inline-flex");
      setDisplay("nextBtn", state.current === "apply" ? "none" : "inline-flex");
      setText("nextBtn", "Continue");
    };

    const renderAll = () => {
      renderFields("learnerFields", "learner");
      renderFields("parentFields", "parent");
      renderFields("schoolFields", "school");
      fill("subjectSelect", subjectCatalog, "", "Select subject");
      if (state.current === "school" || state.school.schoolName || state.school.schoolProvince) {
        try {
          syncSchoolLookup();
        } catch (error) {
          console.warn("Kagie forms school lookup fallback:", error);
        }
      }
      renderSteps();
      renderSummary();
      renderMarks();
      renderPacks();
      if (state.current === "apply" || state.institutions.length || state.apply.province || state.apply.institutionType || state.apply.institutionName) {
        safeSyncApply();
      }
      safeRenderRecommendations();
      renderInst();
      renderSections();
      saveWork();
    };

    const renderApplyWorkspace = (options = {}) => {
      const { includePacks = true } = options;
      saveWork();
      safeSyncApply();
      if (includePacks) renderPacks();
      renderInst();
      renderSummary();
      renderSteps();
      safeRenderRecommendations();
    };

    const fieldChange = (event) => {
      const input = event.target;
      const tagName = String(input?.tagName || "").toLowerCase();
      const group = input.dataset.group;
      const name = input.dataset.name;
      if (!group || !name) return;
      if (event.type === "change" && (tagName === "textarea" || (tagName === "input" && !input.hasAttribute("data-dob-wheel")))) return;
      const previous = state[group][name];
      state[group][name] = name === "dob"
        ? normalizeDobForState(input.dataset.isoValue || input.value)
        : input.value;
      if (group === "school" && name === "schoolName" && (!state.school.confirmName || normalizeText(state.school.confirmName) === normalizeText(previous))) {
        state.school.confirmName = input.value;
        const confirmField = $("confirmName");
        if (confirmField) confirmField.value = input.value;
      }
      if (group === "school" && (name === "schoolName" || name === "schoolProvince")) {
        debouncedSchoolLookup();
      }
      saveWork();
      markSectionDirty(group);
      queueMinorRender();
      debouncedRecommendationRefresh();
    };

    document.body.addEventListener("input", fieldChange);
    document.body.addEventListener("change", fieldChange);
    document.body.addEventListener("click", (event) => {
      const button = event.target.closest("[data-choice-group][data-choice-name][data-choice-value]");
      if (!button) return;
      const group = button.getAttribute("data-choice-group");
      const name = button.getAttribute("data-choice-name");
      const value = button.getAttribute("data-choice-value");
      if (!group || !name || !state[group]) return;
      state[group][name] = value;
      if (group === "learner" && name === "hasDisability" && value !== "yes") {
        state.learner.disabilityDescription = "";
      }
      saveWork();
      markSectionDirty(group);
      if (group === "learner") renderFields("learnerFields", "learner");
      queueMinorRender();
    });
    $("schoolLookupResults")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-school-pick]");
      if (!button) return;
      const schoolKey = button.getAttribute("data-school-pick");
      const picked = schoolSuggestionMatches.find((school) => String(school.id || school.name) === schoolKey);
      if (!picked) return;
      state.school.schoolName = picked.name || "";
      state.school.confirmName = picked.name || "";
      state.school.schoolProvince = picked.province || state.school.schoolProvince || "";
      state.school.schoolType = picked.schoolType || state.school.schoolType || "";
      const schoolField = $("schoolName");
      const confirmField = $("confirmName");
      const provinceField = $("schoolProvince");
      const typeField = $("schoolType");
      if (schoolField) schoolField.value = state.school.schoolName;
      if (confirmField) confirmField.value = state.school.confirmName;
      if (provinceField) provinceField.value = state.school.schoolProvince;
      if (typeField) typeField.value = state.school.schoolType;
      syncSchoolLookup();
      saveWork();
      markSectionDirty("school");
      renderSummary();
      renderSteps();
      showNotice(`${picked.name} added from Kagie's South African school finder.`, "success");
    });

    const go = async (next) => {
      const previous = state.current;
      if (previous === next) return;
      if (previous === "learner" && !validateDobSelection().ok) return;
      saveWork({ immediate: true });
      state.current = next;
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (next === "school" || next === "apply") {
        ensureNationalCatalogLoaded().then((loaded) => {
          if (loaded && state.current === next) renderAll();
        });
      }
      saveStep(previous, { silent: true }).then((saved) => {
        if (saved === false) {
          showNotice("Your browser copy is saved. Kagie will retry live sync for the previous section.", "warn");
        }
      });
    };

    on("stepList", "click", async (e) => {
      const button = e.target.closest("[data-step]");
      if (!button) return;
      await withActionLock(button, `step:${button.dataset.step}`, "Saving...", () => go(button.dataset.step));
    });

    on("addSubjectBtn", "click", async (event) => withActionLock(event.currentTarget, "add-subject", "Saving...", async () => {
      const subject = $("subjectSelect")?.value || "";
      const percent = Number($("subjectPercent")?.value);
      if (!subject || Number.isNaN(percent)) {
        showNotice("Choose a subject and enter the percent before adding it.", "warn");
        $("subjectPercent")?.focus();
        return;
      }
      if (percent < 0 || percent > 100) {
        showNotice("Percent must be between 0 and 100.", "warn");
        $("subjectPercent")?.focus();
        return;
      }
      const item = { subject, percent, level: api.calculateNscLevel ? api.calculateNscLevel(percent) : (percent >= 80 ? 7 : percent >= 70 ? 6 : percent >= 60 ? 5 : percent >= 50 ? 4 : percent >= 40 ? 3 : percent >= 30 ? 2 : 1) };
      const idx = state.marks.findIndex((mark) => mark.subject === subject);
      if (idx >= 0) state.marks[idx] = item; else state.marks.push(item);
      setValue("subjectSelect", "");
      setValue("subjectPercent", "");
      saveWork();
      renderSummary();
      renderMarks();
      safeRenderRecommendations();
      renderSteps();
      try {
        if (api.saveFormSectionAsync) await api.saveFormSectionAsync("marks", { subjects: clone(state.marks) }, draft.id);
        else api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
        showNotice(`${subject} saved to your marks section.`, "success");
      } catch (error) {
        console.error(error);
        showNotice(`The subject was added here, but Kagie could not sync it yet: ${error.message}`, "warn");
      }
    }));

    on("marksList", "click", async (e) => {
      const subject = e.target.getAttribute("data-remove-mark");
      if (!subject) return;
      state.marks = state.marks.filter((item) => item.subject !== subject);
      saveWork();
      renderSummary();
      renderMarks();
      safeRenderRecommendations();
      renderSteps();
      try {
        if (api.saveFormSectionAsync) await api.saveFormSectionAsync("marks", { subjects: clone(state.marks) }, draft.id);
        else api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
        showNotice(`${subject} removed from your marks.`, "info");
      } catch (error) {
        console.error(error);
        showNotice(`The mark was removed here, but Kagie could not sync it yet: ${error.message}`, "warn");
      }
    });

    on("packGrid", "click", async (e) => {
      const button = e.target.closest("[data-pack-id]");
      if (!button) return;
      await withActionLock(button, `pack:${button.dataset.packId}`, "Saving...", async () => {
        state.selectedPackId = button.dataset.packId;
        saveWork();
        renderSummary();
        renderPacks();
        safeRenderRecommendations();
        renderSteps();
        safeSyncApply();
        try {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, { package: selectedPack() });
          else api.updateApplication(draft.id, { package: selectedPack() });
          showNotice("Package saved to your Kagie draft.", "success");
        } catch (error) {
          console.error(error);
          showNotice(`Package selected, but the draft could not sync yet: ${error.message}`, "warn");
        }
      });
    });

    const applyFieldMap = { applyYear: "year", applyProvince: "province", institutionType: "institutionType", institutionName: "institutionName", facultyName: "facultyName", choice1: "choice1", choice2: "choice2", choice3: "choice3" };
    const updateApplyField = (id, value) => {
      const key = applyFieldMap[id];
      if (!key) return;
      if (id === "applyYear" && state.apply.year !== value) {
        setValue("institutionSearch", "");
        state.apply.province = "";
        state.apply.institutionType = "";
        state.apply.institutionName = "";
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      } else if (id === "applyProvince" && state.apply.province !== value) {
        setValue("institutionSearch", "");
        state.apply.institutionType = "";
        state.apply.institutionName = "";
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      } else if (id === "institutionType" && state.apply.institutionType !== value) {
        setValue("institutionSearch", "");
        state.apply.institutionName = "";
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      } else if (id === "institutionName" && state.apply.institutionName !== value) {
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      } else if (id === "facultyName" && state.apply.facultyName !== value) {
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
      }
      state.apply[key] = value;
      saveWork();
      safeSyncApply();
      queueMinorRender();
      debouncedRecommendationRefresh();
    };

    Object.keys(applyFieldMap).forEach((id) => {
      on(id, "change", (e) => updateApplyField(id, e.target.value));
    });

    on("institutionSearch", "input", debounce(() => {
      safeSyncApply();
    }, 120));

    const syncApplyDraftFromFields = () => {
      ["facultyName", "choice1", "choice2", "choice3"].forEach((id) => {
        const field = $(id);
        if (!field) return;
        const key = applyFieldMap[id];
        state.apply[key] = String(field.value || "").trim();
      });
      saveWork();
    };

    ["facultyName", "choice1", "choice2", "choice3"].forEach((id) => {
      on(id, "input", () => {
        syncApplyDraftFromFields();
      });
    });

    const buildCurrentInstitutionItem = () => {
      syncApplyDraftFromFields();
      const chosen = chosenInstitution || applyMatches.find((item) => item.name === state.apply.institutionName) || null;
      return {
        chosen,
        item: {
          institutionId: String(chosen?.id || "").trim(),
          year: String(state.apply.year || chosen?.year || currentYear).trim(),
          province: String(state.apply.province || chosen?.province || "").trim(),
          institutionType: String(state.apply.institutionType || chosen?.type || "").trim(),
          institutionName: String(state.apply.institutionName || "").trim(),
          applicationFee: Number(chosen?.applicationFee || 0),
          applicationFeeLabel: String(chosen?.applicationFeeLabel || "").trim(),
          applicationFeeNote: String(chosen?.applicationFeeNote || "").trim(),
          faculty: String(state.apply.facultyName || "").trim(),
          choice1: String(state.apply.choice1 || "").trim(),
          choice2: String(state.apply.choice2 || "").trim(),
          choice3: String(state.apply.choice3 || "").trim(),
          institutionStatus: chosen?.status || "",
          closingDate: chosen?.closingDate || ""
        }
      };
    };

    const currentInstitutionDraftState = () => {
      const { item } = buildCurrentInstitutionItem();
      const values = [item.institutionName, item.faculty, item.choice1, item.choice2, item.choice3];
      const filledCount = values.filter(Boolean).length;
      return {
        item,
        isEmpty: filledCount === 0,
        isComplete: filledCount === values.length,
        isPartial: filledCount > 0 && filledCount < values.length
      };
    };

    const addCurrentInstitutionToDraft = async (options = {}) => {
      const { silentSuccess = false } = options;
      const packChoice = selectedPack();
      if (!packChoice) {
        showNotice("Select a package before adding institutions.", "warn");
        state.current = "pack";
        renderAll();
        return { ok: false, blocked: true };
      }

      const { chosen, item } = buildCurrentInstitutionItem();
      if (chosen && !chosen.canApply) {
        showNotice("Applications for this institution are currently closed.", "warn");
        return { ok: false, blocked: true };
      }
      if (!item.institutionName || !item.faculty || !item.choice1 || !item.choice2 || !item.choice3) {
        showNotice("Complete the institution, faculty, and all three course choices before adding.", "warn");
        return { ok: false, blocked: true };
      }
      if (new Set([normalizeText(item.choice1), normalizeText(item.choice2), normalizeText(item.choice3)]).size !== 3) {
        showNotice("All three course choices must be different.", "warn");
        return { ok: false, blocked: true };
      }
      if (packChoice.institutionLimit !== "unlimited" && state.institutions.length >= Number(packChoice.institutionLimit)) {
        showNotice(`Your ${packChoice.name} allows up to ${packChoice.institutionLimit} institutions.`, "warn");
        return { ok: false, blocked: true };
      }
      if (state.institutions.some((entry) => normalizeText(entry.institutionName) === normalizeText(item.institutionName) && normalizeText(entry.faculty) === normalizeText(item.faculty) && String(entry.year || currentYear) === item.year)) {
        showNotice("That institution and faculty combination is already in your shortlist.", "warn");
        return { ok: false, blocked: true };
      }

      try {
        const nextDraft = api.addInstitutionToDraftAsync
          ? await api.addInstitutionToDraftAsync(item, draft.id)
          : api.addInstitutionToDraft(item, draft.id);
        applyDraftSnapshot(nextDraft || api.getApplicationById?.(draft.id) || draft);
        await syncSelectedPackCartItem(packChoice).catch((error) => {
          console.warn("Kagie pack cart sync fallback after institution add:", error);
        });
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
        renderApplyWorkspace();
        if (!silentSuccess) {
          showNotice(`${item.institutionName} added to your selected package draft.`, "success");
        }
        return { ok: true, blocked: false };
      } catch (error) {
        console.error(error);
        const localDraftCopy = api.addInstitutionToDraft(item, draft.id);
        applyDraftSnapshot(localDraftCopy || api.getApplicationById(draft.id) || draft);
        await syncSelectedPackCartItem(packChoice).catch((syncError) => {
          console.warn("Kagie local pack cart sync fallback after institution add:", syncError);
        });
        state.apply.facultyName = "";
        state.apply.choice1 = "";
        state.apply.choice2 = "";
        state.apply.choice3 = "";
        renderApplyWorkspace();
        showNotice(`Institution saved into your selected package draft while Kagie finishes syncing the live copy: ${error.message}`, "warn");
        return { ok: true, blocked: false };
      }
    };

    on("saveInstitutionFavoriteBtn", "click", async (event) => withActionLock(event.currentTarget, "save-institution-favorite", "Saving...", async () => {
      const chosen = chosenInstitution || applyMatches.find((item) => item.name === state.apply.institutionName) || null;
      const institutionName = String(state.apply.institutionName || chosen?.name || "").trim();
      if (!institutionName) {
        showNotice("Choose an institution first, then save it to your favorites.", "warn");
        $("institutionName")?.focus();
        return;
      }
      await saveFavoriteEntry({
        type: "institution",
        institutionId: String(chosen?.id || "").trim(),
        institutionName,
        province: String(state.apply.province || chosen?.province || "").trim(),
        institutionType: String(state.apply.institutionType || chosen?.type || "").trim(),
        faculty: String(state.apply.facultyName || "").trim(),
        year: String(state.apply.year || chosen?.year || currentYear).trim(),
        status: String(chosen?.status || "").trim()
      }, `${institutionName} saved to your Kagie favorites.`);
    }));

    on("saveCourseFavoriteBtn", "click", async (event) => withActionLock(event.currentTarget, "save-course-favorite", "Saving...", async () => {
      const chosen = chosenInstitution || applyMatches.find((item) => item.name === state.apply.institutionName) || null;
      const institutionName = String(state.apply.institutionName || chosen?.name || "").trim();
      const course = String(state.apply.choice1 || "").trim();
      if (!institutionName || !course) {
        showNotice("Select an institution and enter Choice 1 before saving a course.", "warn");
        (!institutionName ? $("institutionName") : $("choice1"))?.focus();
        return;
      }
      await saveFavoriteEntry({
        type: "course",
        institutionId: String(chosen?.id || "").trim(),
        institutionName,
        province: String(state.apply.province || chosen?.province || "").trim(),
        institutionType: String(state.apply.institutionType || chosen?.type || "").trim(),
        faculty: String(state.apply.facultyName || "").trim(),
        course,
        year: String(state.apply.year || chosen?.year || currentYear).trim(),
        status: String(chosen?.status || "").trim()
      }, `${course} at ${institutionName} saved to your Kagie favorites.`);
    }));

    on("recommendationsList", "click", async (e) => {
      return;
    });

    on("addInstitutionBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, "add-institution", "Adding...", () => addCurrentInstitutionToDraft());
    });

    on("editPackageBtn", "click", async () => {
      state.current = "pack";
      saveWork();
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const buildPackCartPayload = (packChoice) => ({
      id: `pack_${draft.id}`,
      clientKey: `pack_${draft.id}`,
      type: "application_pack",
      name: packChoice.name,
      packName: packChoice.name,
      price: packChoice.price,
      packPrice: packChoice.price,
      institutionLimit: packChoice.institutionLimit,
      institutionCount: state.institutions.length,
      institutions: clone(state.institutions),
      learner: clone(state.learner),
      parentData: clone(state.parent),
      school: clone(state.school),
      marks: clone(state.marks),
      syncState: "syncing"
    });

    const syncSelectedPackCartItem = async (packChoiceArg) => {
      const packChoice = packChoiceArg || selectedPack();
      if (!packChoice) return null;
      if (!api.addCartItem && !api.addCartItemAsync && !api.replaceApplicationPackCartItemAsync) {
        throw new Error("Kagie cart service is not available yet.");
      }
      const cartPayload = buildPackCartPayload(packChoice);
      if (api.replaceApplicationPackCartItemAsync) {
        return api.replaceApplicationPackCartItemAsync({ ...cartPayload, syncState: "synced" }, user.id);
      }
      let localSaved = false;

      try {
        const localCart = api.getCart ? (api.getCart(user.id) || []) : [];
        if (api.removeCartItem) {
          for (const entry of localCart.filter((item) => item.type === "application_pack")) {
            api.removeCartItem(entry.id, user.id);
          }
        }
        if (api.addCartItem) {
          api.addCartItem({ ...cartPayload, syncState: "local" }, user.id);
          localSaved = true;
        }
      } catch (error) {
        console.warn("Kagie local cart save fallback:", error);
      }

      const hasLiveCartApi = Boolean(api.getCartAsync || api.removeCartItemAsync || api.addCartItemAsync);
      if (!hasLiveCartApi && localSaved) {
        return { ...cartPayload, syncState: "local" };
      }

      try {
        const existingCart = api.getCartAsync
          ? await api.getCartAsync(user.id)
          : (api.getCart ? (api.getCart(user.id) || []) : []);
        for (const entry of existingCart.filter((item) => item.type === "application_pack")) {
          if (api.removeCartItemAsync) await api.removeCartItemAsync(entry.id, user.id);
          else if (api.removeCartItem) api.removeCartItem(entry.id, user.id);
        }
        if (api.addCartItemAsync) {
          await api.addCartItemAsync({ ...cartPayload, syncState: "synced" }, user.id);
        } else if (api.addCartItem && !localSaved) {
          api.addCartItem({ ...cartPayload, syncState: "local" }, user.id);
          localSaved = true;
        }
        return { ...cartPayload, syncState: api.addCartItemAsync ? "synced" : "local" };
      } catch (error) {
        if (localSaved) {
          console.warn("Kagie live cart sync will retry from the saved local cart item:", error);
          return { ...cartPayload, syncState: "local" };
        }
        throw error;
      }
    };

    const withCartButtonState = (label, busy) => {
      const button = $("goCartBtn");
      if (!button) return;
      button.disabled = !!busy;
      button.textContent = label;
    };

    const addPackageToCartAndRedirect = async (options = {}) => {
      const { ignorePendingInstitutionDraft = false } = options;
      withCartButtonState("Preparing cart...", true);
      syncApplyDraftFromFields();

      if (!ignorePendingInstitutionDraft) {
        const pending = currentInstitutionDraftState();
        if (pending.isComplete) {
          withCartButtonState("Saving institution...", true);
          const added = await addCurrentInstitutionToDraft({ silentSuccess: true });
          if (!added.ok) {
            withCartButtonState("Add to cart", false);
            return;
          }
        } else if (pending.isPartial) {
          withCartButtonState("Add to cart", false);
          showNotice("Finish the current institution entry or clear it before going to cart, so Kagie does not lose those choices.", "warn");
          return;
        }
      }

      const packChoice = selectedPack();
      if (!packChoice) {
        withCartButtonState("Add to cart", false);
        showNotice("Choose a package first.", "warn");
        state.current = "pack";
        renderAll();
        return;
      }
      if (packChoice.institutionLimit !== "unlimited" && state.institutions.length > Number(packChoice.institutionLimit)) {
        withCartButtonState("Add to cart", false);
        showNotice(`${packChoice.name} only allows ${packChoice.institutionLimit} institutions.`, "warn");
        return;
      }

      try {
        withCartButtonState("Saving draft...", true);
        const fullySaved = [
          await flushDirtySections(),
          await saveStep("marks", { silent: true }),
          await saveStep("pack", { silent: true }),
          await saveStep("apply", { silent: true })
        ].every(Boolean);
        saveWork({ immediate: true });

        withCartButtonState("Adding package...", true);
        const cartItem = await syncSelectedPackCartItem(packChoice);
        showNotice(
          fullySaved && cartItem?.syncState === "synced"
            ? "Package added to cart."
            : "Package added to cart. Kagie saved a safe copy and will finish any live sync in the background.",
          fullySaved && cartItem?.syncState === "synced" ? "success" : "warn"
        );
        withCartButtonState("Opening cart...", true);
        window.location.assign("cart.html");
      } catch (error) {
        console.error(error);
        try {
          if (api.updateApplication) api.updateApplication(draft.id, { package: packChoice, institutions: clone(state.institutions) });
          const payload = buildPackCartPayload(packChoice);
          const localCart = api.getCart ? (api.getCart(user.id) || []) : [];
          if (api.removeCartItem) {
            for (const entry of localCart.filter((item) => item.type === "application_pack")) {
              api.removeCartItem(entry.id, user.id);
            }
          }
          if (api.addCartItem) {
            api.addCartItem({ ...payload, syncState: "local" }, user.id);
            saveWork({ immediate: true });
            showNotice("Package added to cart from your saved browser copy. Kagie will retry the live sync when services are ready.", "warn");
            withCartButtonState("Opening cart...", true);
            window.location.assign("cart.html");
            return;
          }
        } catch (localError) {
          console.warn("Kagie local cart fallback failed:", localError);
        }
        withCartButtonState("Add to cart", false);
        showNotice(`Kagie could not add this package to cart yet: ${error.message}`, "warn");
      }
    };

    on("goCartBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, "go-cart", "Preparing...", () => addPackageToCartAndRedirect());
    });

    on("institutionsList", "click", async (e) => {
      const id = e.target.getAttribute("data-remove-inst");
      if (!id) return;
      try {
        const nextDraft = api.removeInstitutionFromDraftAsync
          ? await api.removeInstitutionFromDraftAsync(id, draft.id)
          : api.removeInstitutionFromDraft(id, draft.id);
        applyDraftSnapshot(nextDraft || api.getApplicationById?.(draft.id) || draft);
        await syncSelectedPackCartItem().catch((error) => {
          console.warn("Kagie pack cart sync fallback after institution removal:", error);
        });
        renderApplyWorkspace();
        showNotice("Institution removed from your draft.", "info");
      } catch (error) {
        console.error(error);
        const localDraftCopy = api.removeInstitutionFromDraft(id, draft.id);
        applyDraftSnapshot(localDraftCopy || api.getApplicationById(draft.id) || draft);
        renderApplyWorkspace();
        showNotice(`Institution removed locally while Kagie finishes syncing the live draft: ${error.message}`, "warn");
      }
    });

    on("favoritesList", "click", async (e) => {
      const favoriteId = e.target.getAttribute("data-apply-favorite");
      if (favoriteId) {
        const favorite = favoriteEntries.find((item) => item.id === favoriteId);
        applyFavorite(favorite);
        return;
      }

      const removeId = e.target.getAttribute("data-remove-favorite");
      if (!removeId) return;
      try {
        if (api.removeFavoriteAsync) await api.removeFavoriteAsync(removeId, user.id);
        else api.removeFavorite(removeId, user.id);
      } catch (error) {
        console.error(error);
      }
      await loadFavorites();
      renderFavorites();
      showNotice("Favorite removed from your saved list.", "info");
    });

    on("saveBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, "save-all", "Saving...", async () => {
        const ok = await saveAll();
        saveWork({ immediate: true });
        showNotice(ok ? "Your Kagie draft is fully saved." : "Your browser copy is safe, but part of the draft still needs a final sync.", ok ? "success" : "warn");
      });
    });

    on("prevBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, "prev-step", "Saving...", async () => {
        const i = steps.findIndex((step) => step.key === state.current);
        if (i > 0) await go(steps[i - 1].key);
      });
    });

    on("nextBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, state.current === "apply" ? "go-cart" : "next-step", state.current === "apply" ? "Preparing..." : "Saving...", async () => {
        if (state.current !== "apply") {
          const i = steps.findIndex((step) => step.key === state.current);
          if (i < steps.length - 1) await go(steps[i + 1].key);
          return;
        }
        await addPackageToCartAndRedirect();
      });
    });

    renderAll();
    refreshPackCatalog();
    if (api.getInstitutionCatalogAsync) {
      api.getInstitutionCatalogAsync({ includeInactive: true })
        .then((records) => {
          if (!asArray(records).length) return;
          refreshCatalogBindings();
          renderAll();
        })
        .catch((error) => {
          console.warn("Kagie live institution catalog fallback:", error);
        });
    }
    scheduleNationalCatalogWarmup();
    if (saved && Object.keys(saved).length) showNotice("Your last working draft was restored so you can continue from where you stopped.", "info");
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const notice = $("notice");
      if (notice) {
        notice.className = "notice warn show";
        notice.textContent = error.message || "Kagie could not fully load your application workspace. Refresh and try again.";
      }
      const heroTitle = $("heroTitle");
      const guideTitle = $("guideTitle");
      const guideText = $("guideText");
      if (heroTitle) heroTitle.textContent = "Kagie application workspace";
      if (guideTitle) guideTitle.textContent = "Refresh this form";
      if (guideText) guideText.textContent = "Kagie hit a form-loading problem. Refresh once, then continue. Your browser copy stays safe.";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
