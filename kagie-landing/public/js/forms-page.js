(function () {
  window.KagieFormsPageLoaded = true;
  const $ = (id) => document.getElementById(id);
  const scrollToFormStart = () => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduced-motion");
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };
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
  const renderedHtml = new WeakMap();
  const setHtml = (id, value) => {
    const element = $(id);
    if (element && renderedHtml.get(element) !== value) {
      element.innerHTML = value;
      renderedHtml.set(element, value);
    }
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
  const readValue = (key) => {
    try { return localStorage.getItem(key) || ""; }
    catch { return ""; }
  };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const firstFilled = (...values) => values.find((value) => String(value ?? "").trim()) || "";
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
    let nationalCatalogLoadPromise = null;
    let nationalCatalogLoaded = Boolean(asArray((window.KagieData || {}).highSchools).length);
    let minorRenderTimer = 0;
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
        if (state?.selectedPackId && !packagesForApplicationType("undergraduate").some((item) => packageId(item) === state.selectedPackId)) {
          state.selectedPackId = "";
          saveWork();
        }
        if (state?.dynamicApplication?.selectedPackage && !packagesForApplicationType(state.dynamicApplication.type).some((item) => packageId(item) === state.dynamicApplication.selectedPackage)) {
          state.dynamicApplication.selectedPackage = "";
          saveWork();
        }
        if (state.current === "pack" || state.current === "apply") renderPacks();
        if (state.current === "late" && state.lateApplication.currentStep === 3) renderLateApplicationFlow();
        if (state.current === "dynamic" && dynamicSteps()[state.dynamicApplication.currentStep - 1]?.kind === "package") renderDynamicApplicationFlow();
        renderSummary();
        renderSteps();
        syncCartButtonLabel();
      } catch (error) {
        console.warn("Kagie pack catalog refresh fallback:", error);
      }
    };

    const scriptLoads = new Map();
    const loadExternalScript = (src) => {
      if (scriptLoads.has(src)) return scriptLoads.get(src);
      const pending = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const finish = (error) => {
          window.clearTimeout(timeout);
          script.onload = null;
          script.onerror = null;
          if (error) {
            script.remove();
            reject(error);
          } else {
            resolve(true);
          }
        };
        const timeout = window.setTimeout(() => finish(new Error(`Timed out loading ${src}`)), 15000);
        script.src = src;
        script.defer = true;
        script.dataset.kagieDynamic = src;
        script.onload = () => finish();
        script.onerror = () => finish(new Error(`Could not load ${src}`));
        document.head.appendChild(script);
      }).catch((error) => {
        scriptLoads.delete(src);
        throw error;
      });
      scriptLoads.set(src, pending);
      return pending;
    };

    const ensureNationalCatalogLoaded = async () => {
      if (nationalCatalogLoaded || asArray((window.KagieData || {}).highSchools).length) {
        nationalCatalogLoaded = true;
        return true;
      }

      if (!nationalCatalogLoadPromise) {
        nationalCatalogLoadPromise = loadExternalScript("js/sa-catalog.js?v=20261014-palette-blue")
          .then(() => {
            nationalCatalogLoaded = true;
            api.refreshCatalogCaches?.({ preserveRemote: true });
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
    const applicationTypeSteps = [
      { key: "type", label: "Choose Application Type", hint: "Start" },
      { key: "learner", label: "Personal Details", hint: "Application forms" },
      { key: "school", label: "Academic Information", hint: "School and marks" },
      { key: "apply", label: "Select Institutions", hint: "Shortlist" },
      { key: "apply", label: "Choose Courses", hint: "Choices" },
      { key: "pack", label: "Review & Payment", hint: "Cart" }
    ];
    const lateApplicationSteps = [
      { id: 1, label: "Details", sub: "Application info" },
      { id: 2, label: "Learner", sub: "Learner details" },
      { id: 3, label: "Package", sub: "Choose package" },
      { id: 4, label: "Institutions", sub: "Choose institutions" },
      { id: 5, label: "Courses", sub: "Choose courses" },
      { id: 6, label: "Documents", sub: "Upload files" },
      { id: 7, label: "Review", sub: "Review & submit" }
    ];
    const latePackages = [
      { id: "quick", name: "Quick Apply", price: 180, limit: 5, limitLabel: "5 institutions", desc: "Good for a few urgent late applications.", features: ["Basic support", "Application tracking", "Available-space matching"] },
      { id: "priority", name: "Priority Late", price: 300, limit: 10, limitLabel: "10 institutions", badge: "Most Popular", desc: "Best for learners who want more late options.", features: ["Priority processing", "Late application alerts", "Institution tracking"] },
      { id: "emergency", name: "Emergency Unlimited", price: 600, limit: Infinity, limitLabel: "Unlimited institutions", desc: "Maximum reach with unlimited late applications.", features: ["Unlimited late applications", "Fast support", "Urgent updates"] }
    ];
    const specialisedPackageFallbacks = {
      bridging: [
        { id: "BRIDGING_BASIC", code: "BRIDGING_BASIC", applicationType: "bridging", level: "BASIC", name: "Basic Bridging Package", price: 150, institutionLimit: 1, highlight: "1 bridging programme", description: "Specialised Kagie application support package.", features: ["1 bridging programme application", "Document checklist", "Basic form completion", "Upload support", "Application reference tracking"] },
        { id: "BRIDGING_STANDARD", code: "BRIDGING_STANDARD", applicationType: "bridging", level: "STANDARD", name: "Standard Bridging Package", price: 300, institutionLimit: 2, highlight: "Most Popular", badge: "Most Popular", description: "Specialised Kagie application support package.", features: ["Up to 2 institution applications", "Subject marks review", "Programme matching", "Document review", "Upload support", "Submission tracking", "Dashboard updates"] },
        { id: "BRIDGING_PREMIUM", code: "BRIDGING_PREMIUM", applicationType: "bridging", level: "PREMIUM", name: "Premium Bridging Package", price: 500, institutionLimit: 3, highlight: "Best Support", badge: "Best Support", description: "Specialised Kagie application support package.", features: ["Up to 3 institution applications", "Programme matching based on marks", "Future qualification planning", "Document review", "Funding checklist", "Accommodation/transport support option", "Priority application tracking", "Status updates"] }
      ],
      postgraduate: [
        { id: "POSTGRADUATE_BASIC", code: "POSTGRADUATE_BASIC", applicationType: "postgraduate", level: "BASIC", name: "Basic Postgraduate Package", price: 250, institutionLimit: 1, highlight: "1 institution", description: "Specialised Kagie application support package.", features: ["1 institution application", "1 programme choice", "Document checklist", "Basic form completion", "Upload of required documents", "Application reference tracking"] },
        { id: "POSTGRADUATE_STANDARD", code: "POSTGRADUATE_STANDARD", applicationType: "postgraduate", level: "STANDARD", name: "Standard Postgraduate Package", price: 450, institutionLimit: 2, highlight: "Most Popular", badge: "Most Popular", description: "Specialised Kagie application support package.", features: ["Up to 2 institution applications", "Up to 3 programme choices", "Document review before submission", "CV checklist", "Motivation letter structure/check", "Application submission support", "Reference number tracking", "Status updates on Kagie dashboard"] },
        { id: "POSTGRADUATE_PREMIUM", code: "POSTGRADUATE_PREMIUM", applicationType: "postgraduate", level: "PREMIUM", name: "Premium Postgraduate Package", price: 750, institutionLimit: 3, highlight: "Best Support", badge: "Best Support", description: "Specialised Kagie application support package.", features: ["Up to 3 institution applications", "Up to 5 programme choices", "Full document review", "CV review", "Motivation letter improvement", "Research proposal checklist", "Supervisor/contact guidance", "Application submission support", "Priority tracking", "Application status updates"] }
      ],
      transfer: [
        { id: "TRANSFER_BASIC", code: "TRANSFER_BASIC", applicationType: "transfer", level: "BASIC", name: "Basic Transfer Package", price: 300, institutionLimit: 1, highlight: "1 transfer application", description: "Specialised Kagie application support package.", features: ["1 transfer application", "Basic form completion", "Document checklist", "Upload support", "Application reference tracking"] },
        { id: "TRANSFER_STANDARD", code: "TRANSFER_STANDARD", applicationType: "transfer", level: "STANDARD", name: "Standard Transfer Package", price: 550, institutionLimit: 2, highlight: "Most Popular", badge: "Most Popular", description: "Specialised Kagie application support package.", features: ["Up to 2 institution applications", "Academic record review", "Transfer reason/motivation checklist", "Document review", "Credit transfer document checklist", "Submission support", "Application tracking"] },
        { id: "TRANSFER_PREMIUM", code: "TRANSFER_PREMIUM", applicationType: "transfer", level: "PREMIUM", name: "Premium Transfer Package", price: 850, institutionLimit: 3, highlight: "Best Support", badge: "Best Support", description: "Specialised Kagie application support package.", features: ["Up to 3 institution applications", "Academic record review", "Credit transfer checklist", "Module outline checklist", "Transfer motivation improvement", "Document review before submission", "Priority support", "Status updates"] }
      ]
    };
    const lateInstitutions = [
      { id: "uj", initials: "UJ", name: "University of Johannesburg", type: "University", province: "Gauteng", status: "Open", closingDate: "Verified during matching" },
      { id: "tut", initials: "TUT", name: "Tshwane University of Technology", type: "University of Technology", province: "Gauteng", status: "Closing Soon", closingDate: "Verified during matching" },
      { id: "ehlanzeni", initials: "E", name: "Ehlanzeni TVET College", type: "TVET College", province: "Mpumalanga", status: "Open", closingDate: "Verified during matching" },
      { id: "dut", initials: "DUT", name: "Durban University of Technology", type: "University of Technology", province: "KwaZulu-Natal", status: "Closing Soon", closingDate: "Verified during matching" },
      { id: "vut", initials: "VUT", name: "Vaal University of Technology", type: "University of Technology", province: "Gauteng", status: "Open", closingDate: "Verified during matching" },
      { id: "mut", initials: "MUT", name: "Mangosuthu University of Technology", type: "University of Technology", province: "KwaZulu-Natal", status: "Open", closingDate: "Verified during matching" },
      { id: "uzulu", initials: "UNIZULU", name: "University of Zululand", type: "University", province: "KwaZulu-Natal", status: "Limited Space", closingDate: "Verified during matching" },
      { id: "coastal", initials: "C", name: "Coastal TVET College", type: "TVET College", province: "Eastern Cape", status: "Open", closingDate: "Verified during matching" }
    ];
    const lateCourses = [
      { id: "uj-bed", instId: "uj", name: "Bachelor of Education", inst: "University of Johannesburg", field: "Education", qual: "Bachelor", requiredAps: 26 },
      { id: "uj-nursing", instId: "uj", name: "Bachelor of Nursing", inst: "University of Johannesburg", field: "Health Sciences", qual: "Bachelor", requiredAps: 30 },
      { id: "uj-computer-science", instId: "uj", name: "BSc Computer Science", inst: "University of Johannesburg", field: "Information Technology", qual: "Bachelor", requiredAps: 33 },
      { id: "uj-engineering", instId: "uj", name: "BSc Engineering", inst: "University of Johannesburg", field: "Engineering", qual: "Bachelor", requiredAps: 35 },
      { id: "uj-commerce", instId: "uj", name: "Bachelor of Commerce", inst: "University of Johannesburg", field: "Business & Management Studies", qual: "Bachelor", requiredAps: 28 },
      { id: "tut-it-diploma", instId: "tut", name: "Diploma in Information Technology", inst: "Tshwane University of Technology", field: "Information Technology", qual: "Diploma", requiredAps: 20 },
      { id: "tut-computer-systems", instId: "tut", name: "Higher Certificate in Computer Systems", inst: "Tshwane University of Technology", field: "Information Technology", qual: "Higher Certificate", requiredAps: 18 },
      { id: "tut-public-management", instId: "tut", name: "Diploma in Public Management", inst: "Tshwane University of Technology", field: "Public Management", qual: "Diploma", requiredAps: 22 },
      { id: "ehlanzeni-electrical", instId: "ehlanzeni", name: "NATED Electrical Engineering", inst: "Ehlanzeni TVET College", field: "Engineering", qual: "Certificate", requiredAps: 18 },
      { id: "ehlanzeni-office-admin", instId: "ehlanzeni", name: "NCV Office Administration", inst: "Ehlanzeni TVET College", field: "Office Administration", qual: "Certificate", requiredAps: 18 },
      { id: "dut-logistics", instId: "dut", name: "Diploma in Logistics", inst: "Durban University of Technology", field: "Business & Management Studies", qual: "Diploma", requiredAps: 24 },
      { id: "dut-engineering", instId: "dut", name: "Diploma in Engineering Technology", inst: "Durban University of Technology", field: "Engineering", qual: "Diploma", requiredAps: 28 },
      { id: "vut-logistics", instId: "vut", name: "Diploma in Logistics", inst: "Vaal University of Technology", field: "Business & Management Studies", qual: "Diploma", requiredAps: 21 },
      { id: "vut-it", instId: "vut", name: "Diploma in Information Technology", inst: "Vaal University of Technology", field: "Information Technology", qual: "Diploma", requiredAps: 22 },
      { id: "mut-public-management", instId: "mut", name: "Diploma in Public Management", inst: "Mangosuthu University of Technology", field: "Public Management", qual: "Diploma", requiredAps: 22 },
      { id: "mut-office-admin", instId: "mut", name: "Higher Certificate in Office Administration", inst: "Mangosuthu University of Technology", field: "Office Administration", qual: "Higher Certificate", requiredAps: 18 },
      { id: "uzulu-education", instId: "uzulu", name: "Bachelor of Education Foundation Phase", inst: "University of Zululand", field: "Education", qual: "Bachelor", requiredAps: 24 },
      { id: "coastal-business", instId: "coastal", name: "NCV Office Administration", inst: "Coastal TVET College", field: "Office Administration", qual: "Certificate", requiredAps: 18 }
    ];
    const lateDocuments = [
      { id: "id", label: "Certified ID Copy", note: "Required", icon: "badge", defaultStatus: "missing" },
      { id: "parentId", label: "Parent / Guardian ID (if applicable)", note: "Optional", icon: "person", defaultStatus: "optional" },
      { id: "results", label: "Grade 11 / Grade 12 Results", note: "Required", icon: "description", defaultStatus: "missing" },
      { id: "passport", label: "Passport Photo", note: "Optional", icon: "photo_camera", defaultStatus: "optional" },
      { id: "residence", label: "Proof of Residence", note: "Required", icon: "home", defaultStatus: "missing" },
      { id: "other", label: "Other Supporting Documents", note: "Optional", icon: "upload_file", defaultStatus: "optional" }
    ];
    const applicationFormRegistry = {
      undergraduate: {
        type: "undergraduate",
        label: "Undergraduate Applications",
        engine: "legacy",
        startStep: "learner"
      },
      late: {
        type: "late",
        label: "Late Applications",
        engine: "late"
      },
      postgraduate: {
        type: "postgraduate",
        label: "Postgraduate Applications",
        engine: "dynamic",
        icon: "menu_book",
        steps: [
          {
            label: "Applicant",
            title: "Postgraduate Applicant Details",
            subtitle: "Capture prior study information for honours, masters, or PhD applications.",
            fields: [
              { name: "highestQualification", label: "Highest qualification completed", placeholder: "e.g. Bachelor of Commerce", type: "text" },
              { name: "previousInstitution", label: "Previous institution", placeholder: "Institution where you studied", type: "text" },
              { name: "qualificationLevel", label: "Qualification applying for", type: "select", options: ["Honours", "Postgraduate Diploma", "Masters", "PhD"] },
              { name: "averageMark", label: "Final / latest average", placeholder: "e.g. 68%", type: "text" }
            ]
          },
          {
            label: "Programme",
            title: "Postgraduate Programme Details",
            subtitle: "Choose the institution and programme Kagie must support.",
            fields: [
              { name: "institution", label: "Institution you want to apply to", placeholder: "e.g. University of Johannesburg", type: "text" },
              { name: "programme", label: "Programme / research area", placeholder: "e.g. MSc Computer Science", type: "text" },
              { name: "faculty", label: "Faculty / department", placeholder: "e.g. Faculty of Science", type: "text" },
              { name: "supervisorContacted", label: "Have you contacted a supervisor?", type: "select", options: ["Yes", "No", "Not required"] }
            ]
          },
          {
            label: "Documents",
            title: "Postgraduate Documents",
            subtitle: "Upload the documents needed for postgraduate support.",
            fields: [
              { name: "transcriptFile", label: "Academic transcript", type: "file" },
              { name: "qualificationFile", label: "Degree / diploma certificate", type: "file" },
              { name: "proposalFile", label: "Research proposal or motivation", type: "file", required: false },
              { name: "documentsConfirmed", label: "I confirm these postgraduate documents are ready for review.", type: "checkbox" }
            ]
          }
        ]
      },
      transfer: {
        type: "transfer",
        label: "Transfer Applications",
        engine: "dynamic",
        icon: "sync_alt",
        steps: [
          {
            label: "Current study",
            title: "Current Study Details",
            subtitle: "Tell Kagie where the applicant is transferring from.",
            fields: [
              { name: "currentInstitution", label: "Current institution", placeholder: "Current university or college", type: "text" },
              { name: "currentProgramme", label: "Current programme", placeholder: "Programme currently registered for", type: "text" },
              { name: "currentYearLevel", label: "Current year level", type: "select", options: ["First year", "Second year", "Third year", "Final year", "Other"] },
              { name: "academicStanding", label: "Academic standing", type: "select", options: ["Good standing", "At risk", "Failed modules", "Awaiting results"] }
            ]
          },
          {
            label: "Transfer",
            title: "Transfer Request",
            subtitle: "Capture the target institution and programme.",
            fields: [
              { name: "targetInstitution", label: "Institution you want to transfer to", placeholder: "Target institution", type: "text" },
              { name: "targetProgramme", label: "Programme you want to transfer into", placeholder: "Target programme", type: "text" },
              { name: "creditsCompleted", label: "Credits / modules completed", placeholder: "e.g. 8 modules completed", type: "text" },
              { name: "transferReason", label: "Reason for transfer", placeholder: "Briefly explain the transfer reason", type: "textarea" }
            ]
          },
          {
            label: "Documents",
            title: "Transfer Documents",
            subtitle: "Upload documents needed to assess the transfer.",
            fields: [
              { name: "transcriptFile", label: "Latest academic transcript", type: "file" },
              { name: "registrationProofFile", label: "Proof of current registration", type: "file" },
              { name: "documentsConfirmed", label: "I confirm these transfer documents are ready for review.", type: "checkbox" }
            ]
          }
        ]
      },
      bridging: {
        type: "bridging",
        label: "Bridging Programmes",
        engine: "dynamic",
        icon: "account_balance",
        steps: [
          {
            label: "Applicant",
            title: "Bridging Applicant Details",
            subtitle: "Capture the learner's current level and support need.",
            fields: [
              { name: "highestGrade", label: "Highest grade / qualification", type: "select", options: ["Grade 11", "Grade 12", "Matric completed", "NCV", "Other"] },
              { name: "currentStatus", label: "Current study status", type: "select", options: ["In school", "Finished school", "Upgrading marks", "Not currently studying"] },
              { name: "subjectToBridge", label: "Subject or area to bridge", placeholder: "e.g. Mathematics, Science, English", type: "text" },
              { name: "supportNeeded", label: "Support needed", placeholder: "Briefly describe the support needed", type: "textarea" }
            ]
          },
          {
            label: "Programme",
            title: "Target Programme",
            subtitle: "Choose the programme the learner is preparing for.",
            fields: [
              { name: "targetInstitution", label: "Preferred institution", placeholder: "Institution offering the bridge", type: "text" },
              { name: "targetProgramme", label: "Target programme", placeholder: "Programme after bridging", type: "text" },
              { name: "preferredStart", label: "Preferred start period", type: "select", options: ["As soon as possible", "Next semester", "Next academic year"] },
              { name: "fundingRequired", label: "Funding support needed?", type: "select", options: ["Yes", "No", "Not sure"] }
            ]
          },
          {
            label: "Documents",
            title: "Bridging Documents",
            subtitle: "Upload the documents needed for bridging support.",
            fields: [
              { name: "latestResultsFile", label: "Latest school / academic results", type: "file" },
              { name: "idFile", label: "Certified ID copy", type: "file" },
              { name: "documentsConfirmed", label: "I confirm these bridging documents are ready for review.", type: "checkbox" }
            ]
          }
        ]
      }
    };
    const steps = [
      { key: "learner", label: "Learner", hint: "Personal details" },
      { key: "parent", label: "Parent", hint: "Guardian details" },
      { key: "school", label: "School", hint: "School details" },
      { key: "marks", label: "Marks", hint: "Subjects and %" },
      { key: "pack", label: "Package", hint: "Tap to choose" },
      { key: "apply", label: "Institutions", hint: "Choices" }
    ];
    const stepAliases = {
      package: "pack",
      packages: "pack",
      institution: "apply",
      institutions: "apply",
      recommendations: "apply",
      "late-application": "late",
      late_application: "late",
      lateapplications: "late"
    };
    const pageParams = new URLSearchParams(window.location.search);
    const requestedApplicationId = String(pageParams.get("applicationId") || pageParams.get("appId") || "").trim();
    const requestedApplicationType = String(pageParams.get("applicationType") || pageParams.get("type") || "").trim().toLowerCase();
    const requestedApplicationTypeKey = (() => {
      const key = requestedApplicationType.replace(/\s+/g, "_").replace(/-/g, "_");
      if (["late", "late_application", "late_applications"].includes(key)) return "late";
      if (["postgraduate", "post_graduate", "post_grad", "postgrad"].includes(key)) return "postgraduate";
      if (["undergraduate", "undergrad", "under_graduate"].includes(key)) return "undergraduate";
      if (key.includes("transfer")) return "transfer";
      if (key.includes("bridging") || key.includes("bridge")) return "bridging";
      return applicationFormRegistry[key] ? key : "";
    })();
    const requestedStepParam = String(pageParams.get("step") || (requestedApplicationTypeKey === "late" ? "late" : "")).trim().toLowerCase();
    const requestedStep = stepAliases[requestedStepParam] || requestedStepParam;
    const requestedSection = String(pageParams.get("section") || "").trim().toLowerCase();
    const freshTypeSelection = ["1", "true", "yes", "new"].includes(String(pageParams.get("fresh") || "").trim().toLowerCase());
    const resetApplicationTypeSelection = requestedStep === "type" && freshTypeSelection && !requestedApplicationType;
    const defs = {
      learner: [["idNumber", "ID number"], ["fullNames", "Full names"], ["surname", "Surname"], ["maidenName", "Maiden name"], ["cellphone", "Cellphone"], ["email", "Email", "email"], ["province", "Province", "select"], ["postalCode", "Postal code"], ["dob", "Date of birth", "date"], ["gender", "Gender", "select"], ["homeLanguage", "Home language", "select"], ["address", "Home address", "textarea"], ["needsBursary", "Bursary required", "choice"], ["needsResidence", "Apply for residence", "choice"], ["hasDisability", "Disability", "choice"], ["disabilityDescription", "Describe the disability", "textarea"]],
      parent: [["guardianRelation", "Relation"], ["guardianId", "Guardian ID"], ["guardianFullNames", "Guardian full names"], ["guardianSurname", "Guardian surname"], ["guardianCell1", "Primary phone"], ["guardianCell2", "Alternative phone"], ["guardianEmail", "Email", "email"], ["guardianProvince", "Guardian province", "select"], ["guardianPostal", "Postal code"], ["guardianAddress", "Address", "textarea"]],
      school: [["schoolName", "High school"], ["confirmName", "Confirm high school"], ["schoolProvince", "School province", "select"], ["schoolType", "School type", "select"], ["completionYear", "Completion year", "number"], ["average", "Average percent", "number"]]
    };
    const fill = (id, list, selected, label) => {
      const field = $(id);
      if (!field) return;
      const items = [...new Set((list || []).filter(Boolean))];
      setHtml(id, [`<option value="">${esc(label)}</option>`].concat(items.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`)).join(""));
      const value = items.includes(selected) ? selected : "";
      if (field.value !== value) field.value = value;
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
      choice1Faculty: item.choice1Faculty || item.choice_1_faculty || item.choiceFaculties?.choice1 || "",
      choice2Faculty: item.choice2Faculty || item.choice_2_faculty || item.choiceFaculties?.choice2 || "",
      choice3Faculty: item.choice3Faculty || item.choice_3_faculty || item.choiceFaculties?.choice3 || "",
      choiceDetails: Array.isArray(item.choiceDetails) ? clone(item.choiceDetails) : [
        { choice: 1, faculty: item.choice1Faculty || item.choiceFaculties?.choice1 || item.faculty || "", course: item.choice1 || "" },
        { choice: 2, faculty: item.choice2Faculty || item.choiceFaculties?.choice2 || item.faculty || "", course: item.choice2 || "" },
        { choice: 3, faculty: item.choice3Faculty || item.choiceFaculties?.choice3 || item.faculty || "", course: item.choice3 || "" }
      ],
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
    const fallbackActionLocks = new Set();
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
    const withActionLock = async (button, key, busyText, task) => {
      const ux = window.KagieUX;
      if (ux?.withButtonLock) {
        return ux.withButtonLock(button, key, busyText, task, {
          onSlow: () => showNotice("Still processing, please wait...", "info")
        });
      }
      if (fallbackActionLocks.has(key) || button?.dataset?.kagieBusy === "1") return null;
      fallbackActionLocks.add(key);
      const originalText = button?.textContent || "";
      if (button) {
        button.dataset.kagieBusy = "1";
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (busyText) button.textContent = busyText;
      }
      try {
        return await task();
      } finally {
        fallbackActionLocks.delete(key);
        if (button?.isConnected) {
          delete button.dataset.kagieBusy;
          button.disabled = false;
          button.removeAttribute("aria-busy");
          if (busyText) button.textContent = originalText;
        }
      }
    };

    const saved = asObject(readStore(workKey, {}));
    const recoveryApplication = !resetApplicationTypeSelection && asArray(saved.pendingSyncSections).length && api.getApplicationById
      ? api.getApplicationById(saved.pendingSyncApplicationId) : null;
    const resumeApplicationId = requestedApplicationId || (recoveryApplication?.userId === user.id ? recoveryApplication.id : "");
    const localProfile = api.getProfile ? (api.getProfile(user.id) || {}) : {};
    const localDraft = resumeApplicationId && api.getApplicationById
      ? (api.getApplicationById(resumeApplicationId) || (api.ensureDraft ? api.ensureDraft(user.id) : {}))
      : (api.ensureDraft ? api.ensureDraft(user.id) : {});
    const loadWithFallback = async (label, load, fallback) => {
      try { return await load() || fallback; }
      catch (error) {
        console.warn(`Falling back to local ${label}:`, error);
        return fallback;
      }
    };
    const [profile, loadedDraft] = await Promise.all([
      loadWithFallback("profile", () => api.getProfileAsync ? api.getProfileAsync(user.id) : localProfile, localProfile),
      loadWithFallback("draft", () => resumeApplicationId && api.getApplicationByIdAsync
        ? api.getApplicationByIdAsync(resumeApplicationId, user.id)
        : api.ensureDraftAsync ? api.ensureDraftAsync(user.id) : localDraft, localDraft)
    ]);
    let draft = loadedDraft;
    const localLearnerSupport = safeSyncCall(
      "learner support",
      () => api.getApplicationLearnerSupport ? (api.getApplicationLearnerSupport(draft.id) || {}) : {},
      {}
    );
    const learnerSupport = localLearnerSupport;
    const learnerSupportRequest = loadWithFallback("learner support", () => api.getApplicationLearnerSupportAsync
      ? api.getApplicationLearnerSupportAsync(draft.id) : localLearnerSupport, localLearnerSupport);
    const supportFields = ["needsBursary", "needsResidence", "hasDisability", "disabilityDescription"];
    const pendingSupportFields = new Set(asArray(saved.pendingSupportFields));
    const editedSupportFields = new Set();
    let learnerSupportLoaded = false;
    let learnerSupportReady = Promise.resolve();
    const forms = draft.forms || {};
    const pack = normPack(draft.package);
    const savedLate = saved.lateApplication || {};
    const savedDynamic = saved.dynamicApplication || {};
    const lateDocumentStatuses = lateDocuments.reduce((acc, doc) => {
      acc[doc.id] = savedLate.documents?.statuses?.[doc.id] || doc.defaultStatus;
      return acc;
    }, {});
    const lateDocumentFileNames = {
      ...(savedLate.documents?.fileNames && typeof savedLate.documents.fileNames === "object" ? savedLate.documents.fileNames : {})
    };
    const dynamicDefaults = (type) => {
      const definition = applicationFormRegistry[type];
      const values = {};
      asArray(definition?.steps).forEach((step) => {
        asArray(step.fields).forEach((field) => {
          values[field.name] = field.type === "checkbox" ? false : "";
        });
      });
      return values;
    };
    const defaultLatePersonal = {
      fullName: forms.learner?.fullNames || profile.fullName || "",
      surname: forms.learner?.surname || profile.surname || "",
      idNumber: forms.learner?.idNumber || profile.idNumber || "",
      dob: forms.learner?.dob || profile.dob || "",
      gender: forms.learner?.gender || profile.gender || "",
      phone: forms.learner?.cellphone || profile.phone || user.phone || "",
      email: forms.learner?.email || profile.email || user.email || "",
      province: forms.learner?.province || profile.province || "",
      town: "",
      address: forms.learner?.address || profile.address || "",
      schoolName: forms.school?.schoolName || profile.schoolName || profile.schoolAttended || "",
      examYear: forms.school?.completionYear || profile.completionYear || "",
      educationLevel: "",
      confirmed: false
    };
    const savedLateDetails = savedLate.details && typeof savedLate.details === "object" ? savedLate.details : {};
    const defaultLateDetails = {
      appliedBefore: "",
      institutionType: "",
      province: forms.learner?.province || profile.province || "",
      institution: "",
      course: "",
      educationLevel: defaultLatePersonal.educationLevel,
      resultsFile: "",
      phone: defaultLatePersonal.phone,
      email: defaultLatePersonal.email,
      agreedSpace: false,
      institutionSearch: "",
      filterProvince: "",
      filterType: "",
      selectedInstitutionFilter: "",
      studyFieldFilter: "",
      qualificationFilter: ""
    };
    const hydratedLateDetails = { ...defaultLateDetails, ...savedLateDetails };
    if (!hydratedLateDetails.phone) hydratedLateDetails.phone = defaultLatePersonal.phone;
    if (!hydratedLateDetails.email) hydratedLateDetails.email = defaultLatePersonal.email;
    if (!hydratedLateDetails.province) hydratedLateDetails.province = defaultLatePersonal.province;
    if (hydratedLateDetails.resultsFile) lateDocumentStatuses.results = "uploaded";
    if (hydratedLateDetails.resultsFile && !lateDocumentFileNames.results) lateDocumentFileNames.results = hydratedLateDetails.resultsFile;
    const savedStep = String(saved.current || readValue(stepKey)).trim();
    const savedApplicationType = resetApplicationTypeSelection ? "" : (requestedApplicationTypeKey || saved.applicationType || readValue("kagie_application_type"));
    const hasSavedApplicationType = Boolean(savedApplicationType);
    const state = {
      current: requestedStep === "type"
        ? "type"
        : requestedStep === "late"
          ? "late"
        : requestedStep === "dynamic"
          ? "dynamic"
        : steps.some((s) => s.key === requestedStep)
          ? requestedStep
          : (["late", "dynamic"].includes(savedStep) ? savedStep : (hasSavedApplicationType && steps.some((s) => s.key === savedStep) ? savedStep : "type")),
      applicationType: savedApplicationType,
      lateApplication: {
        currentStep: Math.min(7, Math.max(1, Number(savedLate.currentStep || 1))),
        submitted: Boolean(savedLate.submitted),
        reference: savedLate.reference || "",
        details: hydratedLateDetails,
        personal: { ...defaultLatePersonal, ...(savedLate.personal || {}) },
        selectedPackage: savedLate.selectedPackage || "",
        selectedInstitutions: asArray(savedLate.selectedInstitutions),
        selectedCourse: savedLate.selectedCourse || "",
        selectedCourses: asArray(savedLate.selectedCourses).length
          ? asArray(savedLate.selectedCourses)
          : (savedLate.selectedCourse ? [savedLate.selectedCourse] : []),
        documents: {
          statuses: lateDocumentStatuses,
          fileNames: lateDocumentFileNames,
          confirmed: Boolean(savedLate.documents?.confirmed),
          extraFile: savedLate.documents?.extraFile || ""
        },
        reviewConfirmed: Boolean(savedLate.reviewConfirmed)
      },
      dynamicApplication: {
        type: savedDynamic.type || "",
        currentStep: Math.max(1, Number(savedDynamic.currentStep || 1)),
        submitted: Boolean(savedDynamic.submitted),
        reference: savedDynamic.reference || "",
        selectedPackage: savedDynamic.selectedPackage || "",
        values: savedDynamic.values && typeof savedDynamic.values === "object" ? savedDynamic.values : {}
      },
      learner: { idNumber: saved.learner?.idNumber ?? forms.learner?.idNumber ?? profile.idNumber ?? "", fullNames: saved.learner?.fullNames ?? forms.learner?.fullNames ?? profile.fullName ?? "", surname: saved.learner?.surname ?? forms.learner?.surname ?? profile.surname ?? "", maidenName: saved.learner?.maidenName ?? forms.learner?.maidenName ?? "", cellphone: saved.learner?.cellphone ?? forms.learner?.cellphone ?? profile.phone ?? "", email: saved.learner?.email ?? forms.learner?.email ?? profile.email ?? user.email ?? "", province: saved.learner?.province ?? forms.learner?.province ?? profile.province ?? "", postalCode: saved.learner?.postalCode ?? forms.learner?.postalCode ?? profile.postalCode ?? "", dob: saved.learner?.dob ?? forms.learner?.dob ?? profile.dob ?? "", gender: saved.learner?.gender ?? forms.learner?.gender ?? profile.gender ?? "", homeLanguage: saved.learner?.homeLanguage ?? forms.learner?.homeLanguage ?? profile.homeLanguage ?? "", address: saved.learner?.address ?? forms.learner?.address ?? profile.address ?? "", needsBursary: saved.learner?.needsBursary ?? learnerSupport.needsBursary ?? forms.learner?.needsBursary ?? profile.needsBursary ?? "", needsResidence: saved.learner?.needsResidence ?? learnerSupport.needsResidence ?? forms.learner?.needsResidence ?? profile.needsResidence ?? "", hasDisability: saved.learner?.hasDisability ?? learnerSupport.hasDisability ?? forms.learner?.hasDisability ?? profile.hasDisability ?? "", disabilityDescription: saved.learner?.disabilityDescription ?? learnerSupport.disabilityDescription ?? forms.learner?.disabilityDescription ?? profile.disabilityDescription ?? "" },
      parent: { guardianRelation: saved.parent?.guardianRelation ?? forms.parent?.guardianRelation ?? profile.guardianRelation ?? "", guardianId: saved.parent?.guardianId ?? forms.parent?.guardianId ?? profile.guardianId ?? "", guardianFullNames: saved.parent?.guardianFullNames ?? forms.parent?.guardianFullNames ?? profile.guardianName ?? "", guardianSurname: saved.parent?.guardianSurname ?? forms.parent?.guardianSurname ?? profile.guardianSurname ?? "", guardianCell1: saved.parent?.guardianCell1 ?? forms.parent?.guardianCell1 ?? profile.guardianPhone ?? "", guardianCell2: saved.parent?.guardianCell2 ?? forms.parent?.guardianCell2 ?? profile.guardianPhoneAlt ?? "", guardianEmail: saved.parent?.guardianEmail ?? forms.parent?.guardianEmail ?? profile.guardianEmail ?? "", guardianProvince: saved.parent?.guardianProvince ?? forms.parent?.guardianProvince ?? profile.guardianProvince ?? "", guardianPostal: saved.parent?.guardianPostal ?? forms.parent?.guardianPostal ?? profile.guardianPostal ?? "", guardianAddress: saved.parent?.guardianAddress ?? forms.parent?.guardianAddress ?? profile.guardianAddress ?? "" },
      school: { schoolName: saved.school?.schoolName ?? forms.school?.schoolName ?? profile.schoolName ?? profile.schoolAttended ?? "", confirmName: saved.school?.confirmName ?? forms.school?.confirmName ?? forms.school?.schoolName ?? profile.schoolName ?? profile.schoolAttended ?? "", schoolProvince: saved.school?.schoolProvince ?? forms.school?.schoolProvince ?? profile.schoolProvince ?? "", schoolType: saved.school?.schoolType ?? forms.school?.schoolType ?? profile.schoolType ?? "", completionYear: saved.school?.completionYear ?? forms.school?.completionYear ?? profile.completionYear ?? "", average: saved.school?.average ?? forms.school?.average ?? profile.average ?? "" },
      marks: Array.isArray(saved.marks) ? clone(saved.marks) : (Array.isArray(forms.marks?.subjects) ? clone(forms.marks.subjects) : clone(profile.marks || [])),
      selectedPackId: saved.selectedPackId ?? pack?.id ?? "",
      institutions: Array.isArray(saved.institutions) ? normInst(saved.institutions) : normInst(draft.institutions),
      apply: {
        year: String(saved.apply?.year ?? currentYear),
        province: saved.apply?.province ?? "",
        institutionType: saved.apply?.institutionType ?? "",
        institutionName: saved.apply?.institutionName ?? "",
        facultyName: saved.apply?.facultyName ?? "",
        choice1Faculty: saved.apply?.choice1Faculty ?? saved.apply?.choiceFaculties?.choice1 ?? "",
        choice2Faculty: saved.apply?.choice2Faculty ?? saved.apply?.choiceFaculties?.choice2 ?? "",
        choice3Faculty: saved.apply?.choice3Faculty ?? saved.apply?.choiceFaculties?.choice3 ?? "",
        choice1: saved.apply?.choice1 ?? "",
        choice2: saved.apply?.choice2 ?? "",
        choice3: saved.apply?.choice3 ?? ""
      }
    };
    if (state.current === "late") state.applicationType = "late";

    if (!state.dynamicApplication.type && applicationFormRegistry[state.applicationType]?.engine === "dynamic") {
      state.dynamicApplication.type = state.applicationType;
      state.dynamicApplication.values = {
        ...dynamicDefaults(state.applicationType),
        ...(state.dynamicApplication.values || {})
      };
    }

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

    favoriteEntries = safeSyncCall("local favorites", () => api.getFavorites ? asArray(api.getFavorites(user.id)) : [], []);

    const SAVEABLE_SECTIONS = ["learner", "parent", "school", "marks", "pack", "apply"];
    const dirtySections = new Set(saved.pendingSyncApplicationId === draft.id
      ? asArray(saved.pendingSyncSections).filter((key) => SAVEABLE_SECTIONS.includes(key)) : []);
    let localPersistTimer = 0;
    let autoSaveTimer = 0;
    let autoSaveInFlight = false;
    let autoSaveQueued = false;
    let autoSaveRetryDelay = 0;
    let saveRecoveryPending = dirtySections.size > 0;
    let sectionSaveQueue = Promise.resolve();
    const savedSectionSnapshots = new Map();
    let storageWarningShown = false;

    const buildWorkSnapshot = () => ({
      current: state.current,
      applicationType: state.applicationType,
      lateApplication: state.lateApplication,
      dynamicApplication: state.dynamicApplication,
      learner: state.learner,
      parent: state.parent,
      school: state.school,
      marks: state.marks,
      selectedPackId: state.selectedPackId,
      institutions: state.institutions,
      apply: state.apply,
      pendingSyncSections: [...dirtySections],
      pendingSyncApplicationId: draft.id,
      pendingSupportFields: learnerSupportLoaded ? [] : supportFields.filter((name) =>
        !editedSupportFields.has(name) && (saved.learner?.[name] == null || pendingSupportFields.has(name)))
    });

    const persistWorkNow = () => {
      try {
        // Save the actual draft before optional navigation preferences.
        localStorage.setItem(workKey, JSON.stringify(buildWorkSnapshot()));
        localStorage.setItem(stepKey, state.current);
        if (state.applicationType) localStorage.setItem("kagie_application_type", state.applicationType);
        else localStorage.removeItem("kagie_application_type");
        storageWarningShown = false;
        return true;
      } catch (error) {
        console.warn("Could not store the application draft on this device:", error);
        if (!storageWarningShown) {
          showNotice("Your browser storage is unavailable or full. Keep this page open while Kagie saves your details online.", "warn");
          storageWarningShown = true;
        }
        return false;
      }
    };

    const queuePersistWork = () => {
      if (localPersistTimer) window.clearTimeout(localPersistTimer);
      localPersistTimer = window.setTimeout(() => {
        localPersistTimer = 0;
        persistWorkNow();
      }, 320);
    };
    const storeSubmissionRecord = (key, submission) => {
      try {
        localStorage.setItem(key, JSON.stringify([submission].concat(asArray(readStore(key, [])))));
        return true;
      } catch (error) {
        console.warn("The online submission could not be copied to browser storage:", error);
        return false;
      }
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
      if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
      autoSaveTimer = 0;
      if (!dirtySections.size || navigator.onLine === false || document.hidden) return;
      autoSaveTimer = window.setTimeout(() => {
        autoSaveTimer = 0;
        flushDirtySections();
      }, delay);
    };

    const markSectionDirty = (sectionKey) => {
      if (!SAVEABLE_SECTIONS.includes(sectionKey)) return;
      dirtySections.add(sectionKey);
      scheduleProfileAutoSave(Math.max(1200, autoSaveRetryDelay));
    };

    const flushDirtySections = async () => {
      if (!dirtySections.size) return true;
      if (navigator.onLine === false || document.hidden) return false;
      if (autoSaveInFlight) {
        autoSaveQueued = true;
        return false;
      }

      autoSaveInFlight = true;
      const failed = [];
      try {
        for (const key of SAVEABLE_SECTIONS) {
          if (!dirtySections.has(key)) continue;
          const saved = await saveStep(key, { silent: true });
          if (saved === false) failed.push(key);
        }
      } finally {
        autoSaveInFlight = false;
      }

      failed.forEach((key) => dirtySections.add(key));
      autoSaveRetryDelay = failed.length ? Math.min(Math.max(2000, autoSaveRetryDelay * 2), 30000) : 0;
      if (autoSaveQueued || dirtySections.size) {
        autoSaveQueued = false;
        scheduleProfileAutoSave(autoSaveRetryDelay || 1100);
      }
      return failed.length === 0;
    };

    const pauseAutoSave = () => {
      if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
      autoSaveTimer = 0;
      saveWork({ immediate: true });
    };
    const resumeAutoSave = () => {
      autoSaveRetryDelay = 0;
      scheduleProfileAutoSave(0);
    };
    window.addEventListener("pagehide", pauseAutoSave);
    window.addEventListener("pageshow", resumeAutoSave);
    window.addEventListener("offline", pauseAutoSave);
    window.addEventListener("online", resumeAutoSave);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseAutoSave();
      else resumeAutoSave();
    });

    const normalizeApplicationType = (value) => {
      const key = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (!key) return "";
      if (["postgraduate", "post_graduate", "post_grad", "postgrad"].includes(key)) return "postgraduate";
      if (["late", "late_application", "late_applications"].includes(key)) return "late";
      if (key.includes("transfer")) return "transfer";
      if (key.includes("bridging") || key.includes("bridge")) return "bridging";
      if (key.includes("undergraduate") || key.includes("undergrad")) return "undergraduate";
      return key;
    };
    const packageId = (pack) => String(pack?.id || pack?.code || pack?.remoteId || "").trim();
    const packageApplicationType = (pack) => {
      const explicit = normalizeApplicationType(pack?.applicationType || pack?.application_type || pack?.type);
      if (explicit) return explicit;
      const code = String(pack?.code || pack?.id || "").trim().toUpperCase();
      if (code.startsWith("POSTGRADUATE_") || code.startsWith("POST_GRADUATE_")) return "postgraduate";
      if (code.startsWith("TRANSFER_")) return "transfer";
      if (code.startsWith("BRIDGING_")) return "bridging";
      return "";
    };
    const packageMatchesApplicationType = (pack, type) => {
      const wanted = normalizeApplicationType(type) || "undergraduate";
      const actual = packageApplicationType(pack);
      if (wanted === "undergraduate") return !actual || actual === "undergraduate";
      return actual === wanted;
    };
    const packagesForApplicationType = (type) => {
      const wanted = normalizeApplicationType(type) || "undergraduate";
      if (wanted === "late") return latePackages.map(clone);
      const filtered = packs.filter((pack) => packageMatchesApplicationType(pack, wanted));
      if (filtered.length) return filtered;
      return (specialisedPackageFallbacks[wanted] || []).map(clone);
    };
    const applicationTypeLabelFor = (type, fallback = "Undergraduate Applications") => (
      applicationFormRegistry[normalizeApplicationType(type)]?.label || fallback
    );
    const packageIdFromSource = (type, sourceArg) => {
      const source = asObject(sourceArg);
      const directId = packageId(source);
      const options = packagesForApplicationType(type);
      const directMatch = directId
        ? options.find((item) => [packageId(item), item.id, item.code, item.remoteId].map((value) => String(value || "").trim()).includes(directId))
        : null;
      if (directMatch) return packageId(directMatch);
      if (normalizeApplicationType(type) === "late" && directId.startsWith("late_")) {
        const lateMatch = options.find((item) => packageId(item) === directId.replace(/^late_/, ""));
        if (lateMatch) return packageId(lateMatch);
      }
      const sourceName = normalizeText(source.name || source.packName || source.packageName);
      const nameMatch = sourceName ? options.find((item) => normalizeText(item.name || item.packName) === sourceName) : null;
      if (nameMatch) return packageId(nameMatch);
      return directId;
    };
    const draftApplicationType = () => normalizeApplicationType(firstFilled(
      requestedApplicationTypeKey,
      draft?.applicationType,
      draft?.forms?.applicationType?.type,
      draft?.applicationEngine?.type,
      state.applicationType
    )) || "undergraduate";
    const draftPackageIdForType = (type) => packageIdFromSource(
      type,
      draft?.selectedPackage || draft?.package || draft?.forms?.packageSelection?.package || draft?.forms?.package
    );
    const selectedPack = () => packagesForApplicationType("undergraduate").find((item) => packageId(item) === state.selectedPackId) || null;
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
    const packageFeatures = (pack) => asArray(pack?.features).length ? asArray(pack.features) : (packFeatureMap[packageId(pack)] || []);
    const packageLimit = (pack) => {
      const raw = pack?.institutionLimit ?? pack?.institution_limit ?? pack?.limit;
      if (raw === Infinity || raw === "unlimited" || pack?.isUnlimited || pack?.is_unlimited) return "unlimited";
      const value = Number(raw || 0);
      return Number.isFinite(value) && value > 0 ? value : 1;
    };
    const packageLimitLabel = (pack) => {
      const limit = packageLimit(pack);
      return limit === "unlimited" ? "Unlimited applications" : `${limit} application${Number(limit) === 1 ? "" : "s"}`;
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
    const applyFavorite = (favorite) => {
      if (!favorite) return;
      state.apply.year = String(favorite.year || state.apply.year || currentYear);
      state.apply.province = favorite.province || "";
      state.apply.institutionType = favorite.institutionType || "";
      state.apply.institutionName = favorite.institutionName || "";
      resetApplyChoices();
      if (favorite.type === "course" && favorite.course) {
        state.apply.choice1Faculty = favorite.faculty || "";
        state.apply.choice1 = favorite.course;
      }
      state.apply.facultyName = summarizeChoiceFaculties();
      saveWork();
      renderAll();
      scrollToFormStart();
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
    const complete = (key) => ({ learner: Boolean(state.learner.fullNames && state.learner.surname && (state.learner.cellphone || state.learner.email)), parent: Boolean(state.parent.guardianFullNames && state.parent.guardianCell1), school: Boolean(state.school.schoolName && state.school.schoolProvince && state.school.completionYear), marks: state.marks.length >= 5, pack: Boolean(selectedPack()), apply: isWithinSelectedPackLimit() }[key] || false);
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

    const applicationPaymentHasStarted = () => {
      const status = String(draft?.status || "").trim().toLowerCase();
      const paymentStatus = String(draft?.paymentStatus || draft?.payment?.status || "").trim().toLowerCase();
      return status.includes("pending details")
        || status.includes("incomplete")
        || status.includes("submitted")
        || ["pending verification", "verified", "paid"].includes(paymentStatus);
    };
    const packageSelectionApplicationPatch = (extra = {}) => {
      const packChoice = selectedPack();
      const patch = {
        package: packChoice,
        ...extra
      };
      if (packChoice && !applicationPaymentHasStarted()) {
        patch.status = "Awaiting Payment";
      }
      return patch;
    };

    const sectionSnapshot = (key) => key === "marks" ? { subjects: clone(state.marks) }
      : key === "pack" ? packageSelectionApplicationPatch()
      : key === "apply" ? packageSelectionApplicationPatch({ institutions: clone(state.institutions) })
      : clone(state[key] || {});
    const confirmSaveRecovery = () => {
      if (!saveRecoveryPending || dirtySections.size) return;
      saveRecoveryPending = false;
      autoSaveRetryDelay = 0;
      showNotice("Your latest changes are saved.", "success");
    };
    const saveStep = (key, options = {}) => {
      // These writes merge the same profile/application. Serialize them so an older
      // autosave cannot finish after a newer navigation or explicit save.
      const pending = sectionSaveQueue.then(() => performSaveStep(key, options));
      sectionSaveQueue = pending.catch(() => false);
      return pending;
    };
    const performSaveStep = async (key, options = {}) => {
      const silent = options.silent === true;
      try {
        // Hydrate support before the first write, while allowing the UI to open immediately.
        if (key === "learner") await learnerSupportReady;
        if (key === "learner" && !validateDobSelection().ok) return false;
        if (!SAVEABLE_SECTIONS.includes(key)) return true;
        const snapshot = sectionSnapshot(key);
        const signature = JSON.stringify(snapshot);
        const snapshotKey = `${draft.id}:${key}`;
        if (savedSectionSnapshots.get(snapshotKey) === signature) {
          dirtySections.delete(key);
          confirmSaveRecovery();
          saveWork();
          return true;
        }
        const supportSnapshot = key === "learner" ? learnerSupportPayload() : null;
        if (key === "learner" || key === "parent" || key === "school") {
          if (api.saveFormSectionAsync) {
            await api.saveFormSectionAsync(key, snapshot, draft.id);
            if (key === "learner" && api.saveApplicationLearnerSupportAsync) {
              await api.saveApplicationLearnerSupportAsync(draft.id, supportSnapshot);
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
            await api.saveFormSectionAsync("marks", snapshot, draft.id);
          } else {
            api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
            await syncProfile();
          }
        }
        if (key === "pack") {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, snapshot);
          else api.updateApplication(draft.id, snapshot);
        }
        if (key === "apply") {
          if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, snapshot);
          else api.updateApplication(draft.id, snapshot);
        }
        savedSectionSnapshots.set(snapshotKey, signature);
        if (JSON.stringify(sectionSnapshot(key)) === signature) dirtySections.delete(key);
        confirmSaveRecovery();
        if (!dirtySections.size) autoSaveRetryDelay = 0;
        saveWork();
        return true;
      } catch (error) {
        console.error("Could not sync step:", key, error);
        dirtySections.add(key);
        saveRecoveryPending = true;
        saveWork();
        if (!autoSaveInFlight) {
          autoSaveRetryDelay = Math.min(Math.max(2000, autoSaveRetryDelay * 2), 30000);
          scheduleProfileAutoSave(autoSaveRetryDelay);
        }
        try {
          if (key === "learner" || key === "parent" || key === "school") {
            api.saveFormSection(key, clone(state[key]), draft.id);
            if (key === "learner" && api.saveApplicationLearnerSupport) {
              api.saveApplicationLearnerSupport(draft.id, learnerSupportPayload());
            }
          } else if (key === "marks") {
            api.saveFormSection("marks", { subjects: clone(state.marks) }, draft.id);
          } else if (key === "pack") {
            api.updateApplication(draft.id, packageSelectionApplicationPatch());
          } else if (key === "apply") {
            api.updateApplication(draft.id, packageSelectionApplicationPatch({ institutions: clone(state.institutions) }));
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
      if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
      autoSaveTimer = 0;
      const sectionResults = [];
      for (const key of ["learner", "parent", "school", "marks"]) {
        sectionResults.push(await saveStep(key, { silent: true }));
      }
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
      if (type === "textarea") return `<div class="field-wrap field-span-all"${name === "disabilityDescription" && state.learner.hasDisability !== "yes" ? " hidden" : ""}><label class="label" for="${name}">${label}</label><textarea class="field" id="${name}" data-group="${group}" data-name="${name}" placeholder="${placeholder}">${esc(value || "")}</textarea></div>`;
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

    const renderedFieldGroups = new Set();
    const renderFields = (target, group) => {
      const targetNode = $(target);
      if (!targetNode) return;
      if (!renderedFieldGroups.has(group)) {
        targetNode.innerHTML = defs[group].map(([name, label, type]) => fieldHtml(group, name, label, type, state[group][name])).join("");
        renderedFieldGroups.add(group);
        if (group === "learner") window.KagieDobWheel?.attachAll?.(targetNode);
      }
      defs[group].forEach(([name, , type]) => {
        const field = $(name);
        if (type === "choice") {
          targetNode.querySelectorAll(`[data-choice-name="${name}"]`).forEach((button) => {
            const active = button.dataset.choiceValue === state[group][name];
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
            button.querySelector(".choice-tick").textContent = active ? "✓" : "";
          });
        } else if (name === "dob" && field) {
          const normalized = window.KagieDobWheel?.normalize?.(state[group][name]);
          field.dataset.isoValue = normalized?.iso || state[group][name] || "";
          const display = normalized?.display || state[group][name] || "";
          if (field.value !== display) field.value = display;
        } else if (type !== "select" && field && field.value !== String(state[group][name] || "")) {
          field.value = state[group][name] || "";
        }
        if (type === "select") {
          const [list, value, placeholder] = optionsFor(name, state[group][name]);
          fill(name, list, value, placeholder);
        }
        if (name === "disabilityDescription" && field) field.closest(".field-wrap").hidden = state.learner.hasDisability !== "yes";
      });
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

    const stepButtonHtml = ({ number, label, hint, active, done, attribute, value }) => `
      <button class="step-btn ${active ? "active" : ""} ${done ? "done" : ""}"${attribute ? ` ${attribute}="${esc(value)}"` : ""}${active ? ' aria-current="step"' : ""} type="button" aria-label="${esc(`${number}. ${label}${hint ? `: ${hint}` : ""}`)}">
        <span class="step-circle">${number}</span><strong>${esc(label)}</strong><small>${esc(hint || "")}</small>
      </button>
    `;

    const renderSteps = () => {
      if (state.current === "type") {
        setHtml("stepList", applicationTypeSteps.map((step, index) => {
          const isActive = index === 0;
          return stepButtonHtml({ number: index + 1, label: step.label, hint: step.hint, active: isActive, attribute: isActive ? "data-step" : "", value: "type" });
        }).join(""));
        return;
      }

      if (state.current === "late") {
        const currentLateStep = state.lateApplication.currentStep;
        setHtml("stepList", lateApplicationSteps.map((step) => {
          const isActive = step.id === currentLateStep;
          const isDone = step.id < currentLateStep || state.lateApplication.submitted;
          const helper = isDone ? "Saved" : step.sub;
          return stepButtonHtml({ number: step.id, label: step.label, hint: helper, active: isActive, done: isDone, attribute: "data-late-step", value: step.id });
        }).join(""));
        return;
      }

      if (state.current === "dynamic") {
        const definition = dynamicDefinition();
        const currentDynamicStep = state.dynamicApplication.currentStep;
        const stepsForType = dynamicSteps();
        setHtml("stepList", stepsForType.map((step, index) => {
          const id = index + 1;
          const isActive = id === currentDynamicStep;
          const isDone = id < currentDynamicStep || state.dynamicApplication.submitted;
          const helper = isDone ? "Saved" : (step.subtitle || definition.label);
          const label = step.label || (step.kind === "package" ? "Package" : step.title);
          return stepButtonHtml({ number: id, label, hint: helper, active: isActive, done: isDone, attribute: "data-dynamic-step", value: id });
        }).join(""));
        return;
      }

      setHtml("stepList", steps.map((step, index) => {
        const isActive = state.current === step.key;
        const isDone = complete(step.key);
        const helper = isActive ? step.hint : (isDone ? "Saved" : "Open");
        return stepButtonHtml({ number: index + 1, label: step.label, hint: helper, active: isActive, done: isDone, attribute: "data-step", value: step.key });
      }).join(""));
    };

    const renderApplicationTypes = () => {
      document.querySelectorAll("[data-application-type]").forEach((button) => {
        const selected = button.getAttribute("data-application-type") === state.applicationType;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    };

    const latePackage = () => latePackages.find((item) => item.id === state.lateApplication.selectedPackage) || null;
    const lateSelectedInstitutions = () => lateInstitutions.filter((item) => state.lateApplication.selectedInstitutions.includes(item.id));
    const lateSelectedCourses = () => lateCourses.filter((item) => state.lateApplication.selectedCourses.includes(item.id));
    const lateSelectedCourse = () => lateSelectedCourses()[0] || lateCourses.find((item) => item.id === state.lateApplication.selectedCourse) || null;
    const lateFilterValue = (value) => {
      const text = String(value || "").trim();
      if (!text || /^all(\s|$)/i.test(text)) return "";
      return normalizeText(text);
    };
    const lateFilteredInstitutions = () => {
      const details = state.lateApplication.details || {};
      const search = normalizeText(details.institutionSearch);
      const province = lateFilterValue(details.filterProvince);
      const type = lateFilterValue(details.filterType);
      return lateInstitutions.filter((item) => {
        if (search && !normalizeText([item.name, item.type, item.province, item.status].join(" ")).includes(search)) return false;
        if (province && normalizeText(item.province) !== province) return false;
        if (type) {
          const itemType = normalizeText(item.type);
          if (type === "university" ? itemType !== "university" : itemType !== type) return false;
        }
        return true;
      });
    };
    const lateFilteredCourses = () => {
      const details = state.lateApplication.details || {};
      const selectedInstitutions = lateSelectedInstitutions();
      const selectedIds = new Set(selectedInstitutions.map((item) => item.id));
      const activeInstitutionId = details.selectedInstitutionFilter || selectedInstitutions[0]?.id || "";
      return lateCourses.filter((item) => {
        if (selectedIds.size && !selectedIds.has(item.instId)) return false;
        if (activeInstitutionId && item.instId !== activeInstitutionId) return false;
        return true;
      });
    };
    const prepareLateInstitutionsStep = () => {
      const details = state.lateApplication.details || {};
      if (!details.filterProvince && details.province) details.filterProvince = details.province;
      if (!details.filterType && details.institutionType) {
        details.filterType = details.institutionType === "Public University" ? "University" : details.institutionType;
      }
      if (!state.lateApplication.selectedInstitutions.length && details.institution) {
        const match = lateInstitutions.find((item) => normalizeText(item.name) === normalizeText(details.institution));
        if (match) state.lateApplication.selectedInstitutions = [match.id];
      }
    };
    const prepareLateCoursesStep = () => {
      const details = state.lateApplication.details || {};
      const selectedInstitutions = lateSelectedInstitutions();
      const selectedIds = new Set(selectedInstitutions.map((item) => item.id));
      if (!selectedIds.has(details.selectedInstitutionFilter)) {
        details.selectedInstitutionFilter = selectedInstitutions[0]?.id || "";
      }
      state.lateApplication.selectedCourses = state.lateApplication.selectedCourses.filter((courseId) => {
        const course = lateCourses.find((item) => item.id === courseId);
        return course && selectedIds.has(course.instId);
      });
      state.lateApplication.selectedCourse = state.lateApplication.selectedCourses[0] || "";
    };
    const lateStatusClass = (status) => {
      const value = String(status || "").toLowerCase();
      if (value.includes("soon")) return "soon";
      if (value.includes("limited")) return "limited";
      if (value.includes("missing")) return "missing";
      if (value.includes("optional")) return "optional";
      return "open";
    };
    const validateLateUpload = (file) => {
      if (!file) return false;
      if (!/\.(pdf|jpe?g|png)$/i.test(String(file.name || ""))) {
        showNotice("Upload a PDF, JPG, JPEG, or PNG document.", "warn");
        return false;
      }
      if (Number(file.size || 0) > 10 * 1024 * 1024) {
        showNotice("This document is larger than 10MB. Choose a smaller file.", "warn");
        return false;
      }
      return true;
    };
    const lateField = (section, name, label, placeholder, type = "text") => {
      const value = state.lateApplication[section]?.[name] || "";
      return `
        <div class="late-field-wrap">
          <label for="late-${section}-${name}">${esc(label)}</label>
          <input class="late-field" id="late-${section}-${name}" data-late-section="${esc(section)}" data-late-name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder || "")}" />
        </div>
      `;
    };
    const lateSelect = (section, name, label, options) => {
      const value = state.lateApplication[section]?.[name] || "";
      return `
        <div class="late-field-wrap">
          <label for="late-${section}-${name}">${esc(label)}</label>
          <select class="late-field" id="late-${section}-${name}" data-late-section="${esc(section)}" data-late-name="${esc(name)}">
            <option value="">Select ${esc(label.toLowerCase())}</option>
            ${options.map((item) => `<option value="${esc(item)}"${item === value ? " selected" : ""}>${esc(item)}</option>`).join("")}
          </select>
        </div>
      `;
    };
    const lateRadio = (section, name, label, options) => {
      const value = state.lateApplication[section]?.[name] || "";
      return `
        <div>
          <div class="late-radio-label">${esc(label)}</div>
          <div class="late-radio-group">
            ${options.map((item) => `
              <button class="late-radio ${item === value ? "active" : ""}" type="button" data-late-radio-section="${esc(section)}" data-late-radio-name="${esc(name)}" data-late-radio-value="${esc(item)}">
                <span class="late-check-dot"></span>
                <span>${esc(item)}</span>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    };
    const lateAlert = (text, tone = "info") => `
      <div class="late-alert ${tone === "warn" ? "warn" : ""}">
        <span class="material-icons-outlined" aria-hidden="true">${tone === "warn" ? "warning" : "info"}</span>
        <span>${esc(text)}</span>
      </div>
    `;
    const lateTitle = (icon, title, subtitle) => `
      <div class="late-page-title">
        <span class="late-page-icon"><span class="material-icons-outlined" aria-hidden="true">${esc(icon)}</span></span>
        <div>
          <h3>${esc(title)}</h3>
          <p>${esc(subtitle)}</p>
        </div>
      </div>
    `;
    const lateActions = (nextLabel = "Continue", disabled = false) => `
      <div class="late-actions">
        <button class="late-back" type="button" data-late-action="back">Back</button>
        <button class="late-next" type="button" data-late-action="next"${disabled ? " disabled" : ""}>${esc(nextLabel)} <span class="material-icons-outlined" aria-hidden="true">arrow_forward</span></button>
      </div>
    `;
    const dynamicActions = (nextLabel = "Continue", disabled = false) => `
      <div class="late-actions">
        <button class="late-back" type="button" data-dynamic-action="back">Back</button>
        <button class="late-next" type="button" data-dynamic-action="next"${disabled ? " disabled" : ""}>${esc(nextLabel)} <span class="material-icons-outlined" aria-hidden="true">arrow_forward</span></button>
      </div>
    `;
    const isLateStepValid = (step = state.lateApplication.currentStep) => {
      const late = state.lateApplication;
      const details = late.details || {};
      const personal = late.personal || {};
      if (step === 1) {
        return Boolean(details.appliedBefore && details.institutionType && details.province && details.institution && details.course && details.educationLevel && details.resultsFile && details.phone && details.email && details.agreedSpace);
      }
      if (step === 2) {
        return Boolean(personal.fullName && personal.surname && personal.idNumber && personal.dob && personal.gender && personal.phone && personal.email && personal.province && personal.town && personal.address && personal.schoolName && personal.examYear && personal.educationLevel && personal.confirmed);
      }
      if (step === 3) return Boolean(late.selectedPackage);
      if (step === 4) return late.selectedInstitutions.length > 0;
      if (step === 5) return late.selectedCourses.length > 0;
      if (step === 6) {
        const statuses = late.documents?.statuses || {};
        return Boolean(late.documents?.confirmed && statuses.results === "uploaded" && statuses.id === "uploaded" && statuses.residence === "uploaded");
      }
      if (step === 7) return Boolean(late.reviewConfirmed);
      return true;
    };
    const firstInvalidLateStep = () => {
      const invalid = lateApplicationSteps.find((step) => !isLateStepValid(step.id));
      return invalid?.id || 0;
    };
    const setLateStep = (step) => {
      state.lateApplication.currentStep = Math.min(7, Math.max(1, Number(step || 1)));
      state.current = "late";
      state.applicationType = "late";
      saveWork({ immediate: true });
      renderAll();
      scrollToFormStart();
    };
    const renderLateDetailsStep = () => `
      ${lateTitle("event_available", "Late Application Details", "Fill in the details needed for late application support.")}
      ${lateAlert("Late applications depend on available space. Apply early to secure your space.")}
      ${lateRadio("details", "appliedBefore", "Have you applied before?", ["Yes", "No"])}
      <div class="late-grid">
        ${lateSelect("details", "institutionType", "Institution type", ["Public University", "University of Technology", "TVET College", "Private College"])}
        ${lateSelect("details", "province", "Province", ["Gauteng", "KwaZulu-Natal", "Mpumalanga", "Limpopo", "Eastern Cape", "Western Cape", "Free State", "North West", "Northern Cape"])}
        ${lateSelect("details", "institution", "Institution you want to apply to", ["University of Johannesburg", "Tshwane University of Technology", "Ehlanzeni TVET College", "Durban University of Technology", "Vaal University of Technology", "Mangosuthu University of Technology", "University of Zululand", "Coastal TVET College"])}
        ${lateSelect("details", "course", "Course / study field", ["Business & Management Studies", "Information Technology", "Education", "Public Management", "Office Administration", "Engineering"])}
        ${lateSelect("details", "educationLevel", "Current education level", ["Grade 12", "Matric completed", "Rewriting / upgrading", "TVET student", "University student"])}
      </div>
      <label class="late-upload-box">
        <span class="material-icons-outlined" aria-hidden="true">cloud_upload</span>
        <strong>${esc(state.lateApplication.details.resultsFile || "Upload your latest result")}</strong>
        <span>Choose a file from your device</span>
        <input type="file" data-late-file="resultsFile" accept=".pdf,.jpg,.jpeg,.png" hidden />
      </label>
      <div class="late-grid">
        ${lateField("details", "phone", "Phone number", "e.g. 082 123 4567")}
        ${lateField("details", "email", "Email address", "Enter your email address", "email")}
      </div>
      ${lateAlert("Only programmes with available space will appear.")}
      <label class="choice-option ${state.lateApplication.details.agreedSpace ? "active" : ""}">
        <span class="choice-tick">${state.lateApplication.details.agreedSpace ? "&#10003;" : ""}</span>
        <input type="checkbox" data-late-section="details" data-late-name="agreedSpace" ${state.lateApplication.details.agreedSpace ? "checked" : ""} hidden />
        <span>I understand that late applications are subject to space availability.</span>
      </label>
      ${lateActions("Continue", !isLateStepValid(1))}
    `;
    const renderLatePersonalStep = () => `
      ${lateTitle("person", "Personal Learner Details", "Fill in the learner's details before continuing.")}
      ${lateAlert("Accurate information helps us match the learner with the right late-application opportunities faster.")}
      <div class="late-grid">
        ${lateField("personal", "fullName", "Full name", "Enter full name")}
        ${lateField("personal", "surname", "Surname", "Enter surname")}
        ${lateField("personal", "idNumber", "South African ID number", "Enter 13-digit ID number")}
        ${lateField("personal", "dob", "Date of birth", "", "date")}
        ${lateSelect("personal", "gender", "Gender", ["Male", "Female", "Other", "Prefer not to say"])}
        ${lateField("personal", "phone", "Phone number", "e.g. 082 123 4567")}
        ${lateField("personal", "email", "Email address", "Enter your email address", "email")}
        ${lateSelect("personal", "province", "Province", ["Gauteng", "KwaZulu-Natal", "Mpumalanga", "Limpopo", "Eastern Cape", "Western Cape", "Free State", "North West", "Northern Cape"])}
        ${lateSelect("personal", "town", "Town / City", ["Johannesburg", "Pretoria", "Durban", "Cape Town", "Port Elizabeth", "Bloemfontein", "Polokwane", "Nelspruit"])}
        ${lateField("personal", "address", "Home address", "Enter your home address")}
        ${lateField("personal", "schoolName", "School / institution name", "Enter school or institution name")}
        ${lateSelect("personal", "examYear", "Exam year", ["2026", "2025", "2024", "2023", "2022", "2021", "2020"])}
        ${lateSelect("personal", "educationLevel", "Current education level", ["Grade 12", "Matric completed", "Rewriting / upgrading", "TVET student", "University student"])}
      </div>
      <label class="choice-option ${state.lateApplication.personal.confirmed ? "active" : ""}">
        <span class="choice-tick">${state.lateApplication.personal.confirmed ? "&#10003;" : ""}</span>
        <input type="checkbox" data-late-section="personal" data-late-name="confirmed" ${state.lateApplication.personal.confirmed ? "checked" : ""} hidden />
        <span>I confirm that the learner details are correct.</span>
      </label>
      ${lateActions("Continue", !isLateStepValid(2))}
    `;
    const renderLatePackageStep = () => {
      const selected = latePackage();
      return `
        ${lateTitle("business_center", "Choose Your Late Application Package", "Select a package based on how many institutions you want to apply to.")}
        ${lateAlert("Complete payment now and finish your late application details later from your Dashboard. Final submission will stay locked until the required information is complete.")}
        <div class="late-package-list">
          ${latePackages.map((item) => `
            <button class="late-option-card ${item.id === state.lateApplication.selectedPackage ? "selected" : ""}" type="button" data-late-package="${esc(item.id)}">
              ${item.badge ? `<span class="late-badge">${esc(item.badge)}</span>` : ""}
              <strong>${esc(item.name)}</strong>
              <div class="late-package-price">${money(item.price)}</div>
              <p class="helper-meta">${esc(item.limitLabel)}</p>
              <p>${esc(item.desc)}</p>
              <ul class="feature-list">${item.features.map((feature) => `<li>${esc(feature)}</li>`).join("")}</ul>
            </button>
          `).join("")}
        </div>
        ${selected ? `
          <div class="late-alert">
            <span class="material-icons-outlined" aria-hidden="true">check_circle</span>
            <span>${esc(selected.name)} selected - ${money(selected.price)} | ${esc(selected.limitLabel)} | 1 package chosen</span>
            <button class="late-link-btn alt" type="button" data-late-action="cart">Open cart</button>
          </div>
        ` : ""}
        ${lateActions("Continue", !isLateStepValid(3))}
      `;
    };
    const renderLateInstitutionsStep = () => {
      const selectedPackage = latePackage();
      const limit = selectedPackage?.limit || 10;
      const selectedCount = state.lateApplication.selectedInstitutions.length;
      const visibleInstitutions = lateFilteredInstitutions();
      const selectedInstitutions = lateSelectedInstitutions();
      return `
        ${lateTitle("apartment", "Choose Institutions", "Select the institutions where you want to apply.")}
        <div class="late-grid-3">
          ${lateField("details", "institutionSearch", "Search institutions", "Search...")}
          ${lateSelect("details", "filterProvince", "Province", ["All Provinces", "Gauteng", "KwaZulu-Natal", "Mpumalanga", "Limpopo", "Eastern Cape", "Western Cape"])}
          ${lateSelect("details", "filterType", "Institution Type", ["All types", "University", "University of Technology", "TVET College", "Private College"])}
        </div>
        ${lateAlert("Showing institutions that are still accepting late applications.")}
        <div class="late-institution-list">
        ${visibleInstitutions.length ? visibleInstitutions.map((item) => {
          const selected = state.lateApplication.selectedInstitutions.includes(item.id);
          const disabled = !selected && selectedCount >= limit;
          return `
            <div class="late-row-card late-institution-row ${selected ? "selected" : ""}">
              <span class="late-institution-mark">${esc(item.initials || item.name.slice(0, 2))}</span>
              <span class="late-row-main">
                <strong>${esc(item.name)}</strong>
                <small>${esc(item.province)} &bull; ${esc(item.type)}<br>Late application closes: ${esc(item.closingDate)}</small>
              </span>
              <span class="late-status ${lateStatusClass(item.status)}">${esc(item.status)}</span>
              <button class="late-institution-add ${selected ? "selected" : ""}" type="button" data-late-institution="${esc(item.id)}"${disabled ? " disabled" : ""}>
                <span class="material-icons-outlined" aria-hidden="true">${selected ? "check" : "add"}</span>
                ${selected ? "Added" : "Add"}
              </button>
            </div>
          `;
        }).join("") : `<div class="late-empty-state">No open late institutions match those filters. Try another province, institution type, or search term.</div>`}
        </div>
        <div class="late-selected-panel">
          <strong>Selected Institutions (${selectedCount} of ${limit === Infinity ? "Unlimited" : limit})</strong>
          <div class="late-selected-chips">
            ${selectedInstitutions.length ? selectedInstitutions.map((item) => `
              <button type="button" data-late-institution="${esc(item.id)}">${esc(item.name)} <span aria-hidden="true">&times;</span></button>
            `).join("") : `<span class="helper-meta">No institutions selected yet.</span>`}
          </div>
        </div>
        ${lateActions("Continue", !isLateStepValid(4))}
      `;
    };
    const renderLateCoursesStep = () => {
      const selectedCourses = lateSelectedCourses();
      const visibleCourses = lateFilteredCourses();
      const selectedInstitutions = lateSelectedInstitutions();
      const activeInstitutionId = state.lateApplication.details.selectedInstitutionFilter || selectedInstitutions[0]?.id || "";
      const applicantAps = Number(apsSummary()?.total || 0);
      const eligibility = (item) => {
        if (!applicantAps) return { tone: "pending", label: "APS check pending" };
        if (applicantAps >= item.requiredAps) return { tone: "qualify", label: "You qualify" };
        if (applicantAps >= item.requiredAps - 2) return { tone: "backup", label: "Close - Consider backup" };
        return { tone: "below", label: "Below requirement" };
      };
      return `
        ${lateTitle("school", "Choose Courses", "Select the courses you want to apply for in each institution.")}
        <div class="late-course-tabs">
          ${selectedInstitutions.map((item) => `
            <button class="${item.id === activeInstitutionId ? "active" : ""}" type="button" data-late-course-institution="${esc(item.id)}">${esc(item.name)}</button>
          `).join("")}
        </div>
        <div class="late-course-list">
        ${visibleCourses.length ? visibleCourses.map((item) => {
          const selected = state.lateApplication.selectedCourses.includes(item.id);
          const match = eligibility(item);
          return `
            <button class="late-row-card late-course-row ${selected ? "selected" : ""}" type="button" data-late-course="${esc(item.id)}">
              <span class="late-row-main">
                <strong>${esc(item.name)}</strong>
                <small>APS Required: ${esc(item.requiredAps)}<br>Late application availability confirmed during matching</small>
              </span>
              <span class="late-course-aps">Your APS: <strong>${applicantAps || "Pending"}</strong></span>
              <span class="late-eligibility ${match.tone}">
                ${match.tone === "qualify" ? `<span class="material-icons-outlined" aria-hidden="true">check_circle</span>` : ""}
                ${esc(match.label)}
              </span>
              <span class="late-course-check">${selected ? "&#10003;" : ""}</span>
            </button>
          `;
        }).join("") : `<div class="late-empty-state">No courses match those filters yet. Go back to institutions or loosen the study field / qualification filters.</div>`}
        </div>
        ${selectedCourses.length ? lateAlert(`${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"} selected across your institutions.`) : ""}
        ${lateActions("Continue", !isLateStepValid(5))}
      `;
    };
    const renderLateDocumentsStep = () => `
      ${lateTitle("description", "Upload Documents", "Upload clear documents for your application.")}
      <div class="late-doc-list">
      ${lateDocuments.map((doc) => {
        const status = state.lateApplication.documents.statuses[doc.id] || doc.defaultStatus;
        const fileName = state.lateApplication.documents.fileNames?.[doc.id] || (doc.id === "results" ? state.lateApplication.details.resultsFile : "");
        return `
          <div class="late-row-card late-doc-row">
            <span class="late-doc-icon"><span class="material-icons-outlined" aria-hidden="true">${esc(doc.icon)}</span></span>
            <span class="late-row-main"><strong>${esc(doc.label)}</strong><small>${esc(doc.note)}${fileName ? `<br>${esc(fileName)}` : ""}</small></span>
            <span class="late-doc-state ${status === "uploaded" ? "uploaded" : status === "missing" ? "missing" : "optional"}">${esc(status === "uploaded" ? "Uploaded" : status === "missing" ? "Not uploaded" : "Optional")}</span>
            <span class="late-doc-actions">
              ${status === "uploaded"
                ? `<button class="alt" type="button" data-late-doc-view="${esc(doc.id)}">View</button>`
                : `<button type="button" data-late-doc-pick="${esc(doc.id)}">Upload</button>`}
            </span>
            <input type="file" data-late-doc-file="${esc(doc.id)}" accept=".pdf,.jpg,.jpeg,.png" hidden />
          </div>
        `;
      }).join("")}
      </div>
      <label class="late-upload-box">
        <span class="material-icons-outlined" aria-hidden="true">cloud_upload</span>
        <strong>${esc(state.lateApplication.documents.extraFile || "Upload another supporting document")}</strong>
        <span>Add any other document relevant to your application.</span>
        <input type="file" data-late-extra-file accept=".pdf,.jpg,.jpeg,.png" hidden />
      </label>
      ${lateAlert("Accepted file types: PDF, JPG, JPEG, PNG. File size should not exceed 10MB per file. Make sure documents are clear, complete and not blurry.", "warn")}
      <label class="choice-option ${state.lateApplication.documents.confirmed ? "active" : ""}">
        <span class="choice-tick">${state.lateApplication.documents.confirmed ? "&#10003;" : ""}</span>
        <input type="checkbox" data-late-doc-confirm ${state.lateApplication.documents.confirmed ? "checked" : ""} hidden />
        <span>I confirm that the uploaded documents are correct.</span>
      </label>
      ${lateActions("Continue", !isLateStepValid(6))}
    `;
    const renderLateReviewStep = () => {
      const late = state.lateApplication;
      const pkg = latePackage();
      const selectedCourses = lateSelectedCourses();
      const insts = lateSelectedInstitutions();
      const row = (label, value) => `<div><small class="helper-meta">${esc(label)}</small><strong style="display:block">${esc(value || "Not added")}</strong></div>`;
      return `
        ${lateTitle("fact_check", "Review Your Late Application", "Check your details before submitting.")}
        <div class="late-review-grid">
          <div class="late-review-card"><div class="late-review-title">Late Application Details <button class="late-link-btn alt" type="button" data-late-edit-step="1">Edit</button></div>${row("Applied before", late.details.appliedBefore)}${row("Institution type", late.details.institutionType)}${row("Province", late.details.province)}${row("Applying to", late.details.institution)}${row("Course / study field", late.details.course)}${row("Latest result", late.details.resultsFile)}</div>
          <div class="late-review-card"><div class="late-review-title">Personal Details <button class="late-link-btn alt" type="button" data-late-edit-step="2">Edit</button></div>${row("Full name", `${late.personal.fullName || ""} ${late.personal.surname || ""}`.trim())}${row("ID number", late.personal.idNumber)}${row("Phone", late.personal.phone)}${row("Email", late.personal.email)}</div>
          <div class="late-review-card"><div class="late-review-title">Selected Package <button class="late-link-btn alt" type="button" data-late-edit-step="3">Edit</button></div>${row("Package name", pkg?.name)}${row("Price", pkg ? money(pkg.price) : "")}${row("Limit", pkg?.limitLabel)}</div>
          <div class="late-review-card"><div class="late-review-title">Selected Institutions <button class="late-link-btn alt" type="button" data-late-edit-step="4">Edit</button></div>${insts.length ? insts.map((inst, index) => `<p>${index + 1}. <strong>${esc(inst.name)}</strong><br><span class="helper-meta">${esc(inst.type)} | ${esc(inst.province)}</span></p>`).join("") : "<p>No institutions selected.</p>"}</div>
          <div class="late-review-card"><div class="late-review-title">Selected Courses <button class="late-link-btn alt" type="button" data-late-edit-step="5">Edit</button></div>${selectedCourses.length ? selectedCourses.map((course) => row(course.inst, course.name)).join("") : row("Courses", "")}</div>
          <div class="late-review-card"><div class="late-review-title">Documents <button class="late-link-btn alt" type="button" data-late-edit-step="6">Edit</button></div>${lateDocuments.map((doc) => row(doc.label, late.documents.statuses[doc.id] === "uploaded" ? "Uploaded" : late.documents.statuses[doc.id] === "missing" ? "Missing" : "Optional")).join("")}</div>
        </div>
        ${lateAlert("Your late application is ready for submission.")}
        <label class="choice-option ${late.reviewConfirmed ? "active" : ""}">
          <span class="choice-tick">${late.reviewConfirmed ? "&#10003;" : ""}</span>
          <input type="checkbox" data-late-review-confirm ${late.reviewConfirmed ? "checked" : ""} hidden />
          <span>I confirm that all information is correct and ready for submission.</span>
        </label>
        ${lateActions("Submit the application", !isLateStepValid(7))}
      `;
    };
    const renderLateSuccess = () => {
      const pkg = latePackage();
      return `
        <div class="late-success">
          <span class="late-success-icon"><span class="material-icons-outlined" aria-hidden="true">check</span></span>
          <div>
            <h3 style="margin:0;color:#008a2e;font-size:24px">Late Application Submitted</h3>
            <p class="helper-meta" style="max-width:480px;margin:8px auto 0">Your late application has been received. Kagie will review your details and update you about available spaces.</p>
          </div>
          <div class="late-review-grid">
            <div class="late-review-card">${lateTitle("tag", "Reference number", state.lateApplication.reference || "Pending")}</div>
            <div class="late-review-card">${lateTitle("business_center", "Package selected", pkg?.name || "Not selected")}</div>
            <div class="late-review-card">${lateTitle("apartment", "Institutions selected", String(state.lateApplication.selectedInstitutions.length))}</div>
            <div class="late-review-card">${lateTitle("pending_actions", "Status", "Under Review")}</div>
          </div>
          <div class="late-actions">
            <button class="late-back" type="button" data-late-action="track">Track Application</button>
            <button class="late-next" type="button" data-late-action="dashboard">Go to Dashboard</button>
          </div>
        </div>
      `;
    };
    const renderLateApplicationFlow = () => {
      const node = $("lateApplicationFlow");
      if (!node) return;
      if (state.lateApplication.submitted) {
        node.innerHTML = renderLateSuccess();
        return;
      }
      const views = {
        1: renderLateDetailsStep,
        2: renderLatePersonalStep,
        3: renderLatePackageStep,
        4: renderLateInstitutionsStep,
        5: renderLateCoursesStep,
        6: renderLateDocumentsStep,
        7: renderLateReviewStep
      };
      node.innerHTML = (views[state.lateApplication.currentStep] || renderLateDetailsStep)();
    };
    let lateFlowRefreshTimer = 0;
    const scheduleLateFlowRefresh = (focusId = "") => {
      if (lateFlowRefreshTimer) window.clearTimeout(lateFlowRefreshTimer);
      lateFlowRefreshTimer = window.setTimeout(() => {
        lateFlowRefreshTimer = 0;
        renderLateApplicationFlow();
        renderSummary();
        renderSteps();
        if (focusId) {
          const field = $(focusId);
          if (field) {
            const cursorAt = String(field.value || "").length;
            field.focus({ preventScroll: true });
            if (field.setSelectionRange) field.setSelectionRange(cursorAt, cursorAt);
          }
        }
      }, 90);
    };
    const dynamicDefinition = () => applicationFormRegistry[state.dynamicApplication.type] || null;
    const dynamicPackageStep = (definition) => ({
      kind: "package",
      title: "Choose Package",
      subtitle: `Select the Kagie package for ${definition?.label || "this application"}.`
    });
    const dynamicSteps = () => {
      const definition = dynamicDefinition();
      return definition ? [dynamicPackageStep(definition)].concat(asArray(definition.steps)) : [];
    };
    const dynamicPackages = () => packagesForApplicationType(state.dynamicApplication.type);
    const dynamicPackage = () => dynamicPackages().find((item) => packageId(item) === state.dynamicApplication.selectedPackage) || null;
    const dynamicFieldValue = (name) => state.dynamicApplication.values?.[name] ?? "";
    const ensureDynamicValues = (type) => {
      const definition = applicationFormRegistry[type];
      if (!definition?.steps) return;
      state.dynamicApplication.values = {
        ...dynamicDefaults(type),
        ...(state.dynamicApplication.values || {})
      };
      if (state.dynamicApplication.selectedPackage && !dynamicPackages().some((item) => packageId(item) === state.dynamicApplication.selectedPackage)) {
        state.dynamicApplication.selectedPackage = "";
      }
      state.dynamicApplication.currentStep = Math.min(
        [dynamicPackageStep(definition)].concat(asArray(definition.steps)).length,
        Math.max(1, Number(state.dynamicApplication.currentStep || 1))
      );
    };
    const renderDynamicPackageStep = () => {
      const options = dynamicPackages();
      if (!options.length) {
        return `<div class="late-empty-state">Packages for this application type are still loading. Try again in a moment.</div>`;
      }
      return `
        <div class="late-package-list dynamic-package-list">
          ${options.map((item) => {
            const id = packageId(item);
            const features = packageFeatures(item);
            const badge = item.badge || (/most popular|best support/i.test(String(item.highlight || "")) ? item.highlight : "");
            const selected = id === state.dynamicApplication.selectedPackage;
            return `
              <button class="late-option-card dynamic-package-card ${selected ? "selected" : ""}" type="button" data-dynamic-package="${esc(id)}">
                ${badge ? `<span class="late-badge">${esc(badge)}</span>` : ""}
                <strong>${esc(item.name)}</strong>
                <div class="late-package-price">${esc(money(item.price))}</div>
                <p>${esc(packageLimitLabel(item))}</p>
                <p>${esc(item.description || item.desc || item.highlight || "Specialised Kagie application support package.")}</p>
                <ul class="feature-list">${features.map((feature) => `<li>${esc(feature)}</li>`).join("")}</ul>
              </button>
            `;
          }).join("")}
        </div>
      `;
    };
    const renderDynamicField = (field) => {
      const value = dynamicFieldValue(field.name);
      const requiredMark = field.required === false ? "" : " *";
      if (field.type === "select") {
        return `
          <div class="late-field-wrap">
            <label for="dynamic-${field.name}">${esc(field.label)}${requiredMark}</label>
            <select class="late-field" id="dynamic-${field.name}" data-dynamic-name="${esc(field.name)}">
              <option value="">Select ${esc(field.label.toLowerCase())}</option>
              ${asArray(field.options).map((option) => `<option value="${esc(option)}"${option === value ? " selected" : ""}>${esc(option)}</option>`).join("")}
            </select>
          </div>
        `;
      }
      if (field.type === "textarea") {
        return `
          <div class="late-field-wrap">
            <label for="dynamic-${field.name}">${esc(field.label)}${requiredMark}</label>
            <textarea class="late-field" id="dynamic-${field.name}" data-dynamic-name="${esc(field.name)}" placeholder="${esc(field.placeholder || "")}">${esc(value)}</textarea>
          </div>
        `;
      }
      if (field.type === "file") {
        return `
          <label class="late-upload-box">
            <span class="material-icons-outlined" aria-hidden="true">cloud_upload</span>
            <strong>${esc(value || field.label)}</strong>
            <span>Click to choose file or drag here${field.required === false ? " (optional)" : ""}</span>
            <input type="file" data-dynamic-file="${esc(field.name)}" hidden />
          </label>
        `;
      }
      if (field.type === "checkbox") {
        return `
          <label class="choice-option ${value ? "active" : ""}">
            <span class="choice-tick">${value ? "&#10003;" : ""}</span>
            <input type="checkbox" data-dynamic-name="${esc(field.name)}" ${value ? "checked" : ""} hidden />
            <span>${esc(field.label)}</span>
          </label>
        `;
      }
      return `
        <div class="late-field-wrap">
          <label for="dynamic-${field.name}">${esc(field.label)}${requiredMark}</label>
          <input class="late-field" id="dynamic-${field.name}" data-dynamic-name="${esc(field.name)}" type="${esc(field.type || "text")}" value="${esc(value)}" placeholder="${esc(field.placeholder || "")}" />
        </div>
      `;
    };
    const isDynamicStepValid = (stepIndex = state.dynamicApplication.currentStep) => {
      const step = dynamicSteps()[stepIndex - 1];
      if (!step) return false;
      if (step.kind === "package") return Boolean(dynamicPackage());
      return asArray(step.fields).every((field) => {
        if (field.required === false) return true;
        const value = dynamicFieldValue(field.name);
        return field.type === "checkbox" ? Boolean(value) : Boolean(String(value || "").trim());
      });
    };
    const firstInvalidDynamicStep = () => {
      const stepsForType = dynamicSteps();
      const invalidIndex = stepsForType.findIndex((step, index) => {
        if (!step) return true;
        if (step.kind === "package") return !dynamicPackage();
        return !isDynamicStepValid(index + 1);
      });
      return invalidIndex >= 0 ? invalidIndex + 1 : 0;
    };
    const hasObjectKeys = (value) => Object.keys(asObject(value)).length > 0;
    const unwrapDynamicValues = (sourceArg) => {
      const source = asObject(sourceArg);
      if (hasObjectKeys(source.values)) return asObject(source.values);
      if (hasObjectKeys(source.current?.values)) return asObject(source.current.values);
      if (hasObjectKeys(source.current) && !source.current?.currentStep) return asObject(source.current);
      const ignored = new Set(["applicationType", "package", "learner", "parent", "school", "marks", "apply", "institutions", "current", "type", "currentStep", "submitted", "reference", "selectedPackage"]);
      return Object.fromEntries(Object.entries(source).filter(([key]) => !ignored.has(key)));
    };
    const dynamicValuesFromDraft = (type) => {
      const forms = asObject(draft?.forms);
      return [
        forms.dynamicApplications?.[type],
        forms.specialisedApplication?.values,
        forms.current,
        draft?.applicationEngine?.formData
      ].map(unwrapDynamicValues).find(hasObjectKeys) || {};
    };
    const hydrateLateFromPaidDraft = () => {
      const latePackageId = draftPackageIdForType("late");
      if (latePackageId && !state.lateApplication.selectedPackage) {
        state.lateApplication.selectedPackage = latePackageId;
      }
      const source = asObject(
        draft?.lateApplication?.data ||
        draft?.forms?.dynamicApplications?.late ||
        draft?.applicationEngine?.formData ||
        draft?.forms?.current
      );
      if (!hasObjectKeys(source)) return;
      state.lateApplication = {
        ...state.lateApplication,
        ...source,
        details: { ...state.lateApplication.details, ...asObject(source.details) },
        personal: { ...state.lateApplication.personal, ...asObject(source.personal) },
        documents: { ...state.lateApplication.documents, ...asObject(source.documents) },
        selectedInstitutions: asArray(source.selectedInstitutions).length ? asArray(source.selectedInstitutions) : state.lateApplication.selectedInstitutions,
        selectedCourses: asArray(source.selectedCourses).length ? asArray(source.selectedCourses) : state.lateApplication.selectedCourses
      };
      if (latePackageId && !state.lateApplication.selectedPackage) {
        state.lateApplication.selectedPackage = latePackageId;
      }
    };
    const hydrateDynamicFromPaidDraft = (type) => {
      state.dynamicApplication.type = type;
      ensureDynamicValues(type);
      const savedValues = dynamicValuesFromDraft(type);
      if (hasObjectKeys(savedValues)) {
        state.dynamicApplication.values = {
          ...dynamicDefaults(type),
          ...state.dynamicApplication.values,
          ...savedValues
        };
      }
      const selectedPackageId = draftPackageIdForType(type);
      if (selectedPackageId && !state.dynamicApplication.selectedPackage) {
        state.dynamicApplication.selectedPackage = selectedPackageId;
      }
      ensureDynamicValues(type);
    };
    const hydratePaidApplicationResume = () => {
      if (!applicationPaymentHasStarted()) return;
      const type = draftApplicationType();
      if (type === "late") {
        hydrateLateFromPaidDraft();
        if (requestedApplicationId || requestedStep === "late" || state.current === "late") {
          state.current = "late";
          state.applicationType = "late";
          if (!state.lateApplication.submitted) {
            state.lateApplication.currentStep = firstInvalidLateStep() || 7;
          }
        }
        return;
      }
      if (applicationFormRegistry[type]?.engine === "dynamic") {
        hydrateDynamicFromPaidDraft(type);
        if (requestedApplicationId || requestedStep === "dynamic" || state.current === "dynamic") {
          state.current = "dynamic";
          state.applicationType = type;
          if (!state.dynamicApplication.submitted) {
            state.dynamicApplication.currentStep = firstInvalidDynamicStep() || dynamicSteps().length;
          }
        }
      }
    };
    const dynamicApplicationMeta = () => {
      const values = state.dynamicApplication.values || {};
      const institution = firstFilled(values.institution, values.targetInstitution, values.currentInstitution, values.preferredInstitution);
      const programme = firstFilled(values.programme, values.targetProgramme, values.currentProgramme, values.subjectToBridge, values.qualificationLevel);
      return { institution, programme };
    };
    const setDynamicStep = (step) => {
      const maxStep = Math.max(1, dynamicSteps().length);
      state.dynamicApplication.currentStep = Math.min(maxStep, Math.max(1, Number(step || 1)));
      state.current = "dynamic";
      state.applicationType = state.dynamicApplication.type;
      saveWork({ immediate: true });
      renderAll();
      scrollToFormStart();
    };
    const openDynamicApplicationFlow = (type, options = {}) => {
      const switchingType = state.dynamicApplication.type && state.dynamicApplication.type !== type;
      state.applicationType = type;
      state.current = "dynamic";
      state.dynamicApplication.type = type;
      if (options.startAtFirst || state.dynamicApplication.submitted || switchingType) {
        state.dynamicApplication.currentStep = 1;
        state.dynamicApplication.submitted = false;
        state.dynamicApplication.reference = switchingType ? "" : state.dynamicApplication.reference;
        state.dynamicApplication.selectedPackage = "";
        state.dynamicApplication.values = dynamicDefaults(type);
      }
      ensureDynamicValues(type);
      saveWork({ immediate: true });
      renderAll();
      scrollToFormStart();
    };
    const submitDynamicApplication = async () => {
      const definition = dynamicDefinition();
      if (!definition) return;
      const firstInvalid = firstInvalidDynamicStep();
      if (firstInvalid) {
        setDynamicStep(firstInvalid);
        showNotice("Complete all required application details before final submission.", "warn");
        return;
      }
      const selectedDynamicPackage = dynamicPackage();
      if (!selectedDynamicPackage) {
        state.dynamicApplication.currentStep = 1;
        showNotice("Choose a package before submitting this application.", "warn");
        renderAll();
        return;
      }
      const reference = state.dynamicApplication.reference || `KAG-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
      const submittedAt = new Date().toISOString();
      const paymentStarted = applicationPaymentHasStarted();
      state.dynamicApplication.reference = reference;
      const { institution, programme } = dynamicApplicationMeta();
      const values = clone(state.dynamicApplication.values || {});
      const packagePrice = Number(selectedDynamicPackage.price || 0);
      const selectedPackage = clone(selectedDynamicPackage);
      const submission = {
        id: `application_${definition.type}_${Date.now()}`,
        reference,
        type: definition.type,
        label: definition.label,
        status: "Submitted",
        submittedAt,
        selectedPackage,
        packagePrice,
        finalTotal: packagePrice,
        values
      };
      const submissionsKey = `kagie_application_submissions_${user.id}`;
      const patch = {
        status: "Submitted",
        submittedAt,
        applicationType: definition.type,
        applicationTypeLabel: definition.label,
        package: selectedPackage,
        selectedPackage,
        packagePrice,
        finalTotal: packagePrice,
        institutionName: institution,
        programme,
        program: programme,
        applicationEngine: {
          version: "multi-application-v1",
          type: definition.type,
          label: definition.label,
          submittedAt,
          reference,
          selectedPackage,
          packagePrice,
          formData: values
        },
        forms: {
          applicationType: {
            type: definition.type,
            label: definition.label,
            submittedAt,
            reference
          },
          packageSelection: {
            applicationType: definition.type,
            package: selectedPackage,
            packagePrice,
            finalTotal: packagePrice,
            savedAt: submittedAt
          },
          specialisedApplication: {
            type: definition.type,
            label: definition.label,
            values
          },
          dynamicApplications: {
            [definition.type]: values
          }
        },
        institutions: institution ? [{
          id: `${definition.type}_${Date.now()}`,
          institutionName: institution,
          institutionType: definition.label,
          faculty: values.faculty || "",
          choice1: programme,
          programme,
          applicationType: definition.type,
          createdAt: submittedAt
        }] : []
      };
      saveWork({ immediate: true });
      try {
        const submittedDraft = api.updateApplicationAsync
          ? await api.updateApplicationAsync(draft.id, patch)
          : api.updateApplication(draft.id, patch);
        if (submittedDraft) draft = submittedDraft;
      } catch (error) {
        console.warn("Dynamic application submission failed:", error);
        saveWork({ immediate: true });
        showNotice(`Your details are kept on this page. Kagie could not submit the application yet: ${error.message}. Please retry.`, "warn");
        return;
      }
      state.dynamicApplication.submitted = true;
      const storedLocally = storeSubmissionRecord(submissionsKey, submission);
      saveWork({ immediate: true });
      if (!paymentStarted) {
        try {
          await syncDynamicPackageCartItem(selectedDynamicPackage);
        } catch (error) {
          console.warn("Dynamic application cart sync fallback:", error);
        }
      }
      renderAll();
      showNotice(storedLocally
        ? `${definition.label} submitted. Kagie saved it for admin review and dashboard tracking.`
        : `${definition.label} submitted online. Your browser storage is full or unavailable, so a device copy could not be saved.`, storedLocally ? "success" : "warn");
    };
    const renderDynamicSuccess = () => {
      const definition = dynamicDefinition();
      const { institution, programme } = dynamicApplicationMeta();
      const selectedDynamicPackage = dynamicPackage();
      return `
        <div class="late-success">
          <span class="late-success-icon"><span class="material-icons-outlined" aria-hidden="true">check</span></span>
          <div>
            <h3 style="margin:0;color:var(--flow-main,#008a2e);font-size:24px">${esc(definition?.label || "Application")} Submitted</h3>
            <p class="helper-meta" style="max-width:520px;margin:8px auto 0">Your application has been received. Kagie will review the details and show progress on your dashboard.</p>
          </div>
          <div class="late-review-grid">
            <div class="late-review-card">${lateTitle("tag", "Reference number", state.dynamicApplication.reference || "Pending")}</div>
            <div class="late-review-card">${lateTitle("category", "Application type", definition?.label || "Application")}</div>
            <div class="late-review-card">${lateTitle("inventory_2", "Package", selectedDynamicPackage ? `${selectedDynamicPackage.name} - ${money(selectedDynamicPackage.price)}` : "Not selected")}</div>
            <div class="late-review-card">${lateTitle("apartment", "Institution", institution || "Not added")}</div>
            <div class="late-review-card">${lateTitle("school", "Programme", programme || "Not added")}</div>
          </div>
          <div class="late-actions">
            <button class="late-back" type="button" data-dynamic-action="track">Track Application</button>
            <button class="late-next" type="button" data-dynamic-action="dashboard">Go to Dashboard</button>
          </div>
        </div>
      `;
    };
    const renderDynamicApplicationFlow = () => {
      const node = $("dynamicApplicationFlow");
      if (!node) return;
      const definition = dynamicDefinition();
      if (!definition) {
        node.innerHTML = "";
        return;
      }
      ensureDynamicValues(definition.type);
      if (state.dynamicApplication.submitted) {
        node.innerHTML = renderDynamicSuccess();
        return;
      }
      const stepsForType = dynamicSteps();
      const step = stepsForType[state.dynamicApplication.currentStep - 1] || stepsForType[0];
      const isLast = state.dynamicApplication.currentStep >= stepsForType.length;
      if (step?.kind === "package") {
        node.innerHTML = `
          ${lateTitle(definition.icon || "inventory_2", step.title, step.subtitle)}
          ${lateAlert(`${definition.label} has its own Kagie package options. Choose a package, complete payment, and finish the remaining details later from your Dashboard.`)}
          ${renderDynamicPackageStep()}
          ${dynamicPackage() ? `
            <div class="late-alert">
              <span class="material-icons-outlined" aria-hidden="true">shopping_cart</span>
              <span>${esc(dynamicPackage().name)} is selected and ready for checkout.</span>
              <button class="late-link-btn alt" type="button" data-dynamic-action="cart">Open cart</button>
            </div>
          ` : ""}
          ${dynamicActions("Continue details", !isDynamicStepValid())}
        `;
        return;
      }
      node.innerHTML = `
        ${lateTitle(definition.icon || "assignment", step.title, step.subtitle)}
        ${lateAlert(`Complete the required fields for ${definition.label.toLowerCase()} and continue to the next step.`)}
        <div class="late-grid">
          ${asArray(step.fields).map(renderDynamicField).join("")}
        </div>
        ${isLast ? `
          <div class="late-review-card">
            <div class="late-review-title">Application Summary</div>
            <div class="dynamic-review-list">
              ${dynamicPackage() ? `<div class="dynamic-review-row"><span>Package</span><strong>${esc(`${dynamicPackage().name} - ${money(dynamicPackage().price)}`)}</strong></div>` : ""}
              ${Object.entries(state.dynamicApplication.values || {}).filter(([, value]) => String(value || "").trim()).map(([key, value]) => `<div class="dynamic-review-row"><span>${esc(key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()))}</span><strong>${esc(value === true ? "Yes" : value)}</strong></div>`).join("")}
            </div>
          </div>
        ` : ""}
        ${dynamicActions(isLast ? "Submit Application" : "Continue", !isDynamicStepValid())}
      `;
    };

    const renderSummary = () => {
      const isLateSummary = state.current === "late";
      const isDynamicSummary = state.current === "dynamic";
      const dynamicInfo = isDynamicSummary ? dynamicDefinition() : null;
      const dynamicMeta = isDynamicSummary ? dynamicApplicationMeta() : {};
      const packChoice = isDynamicSummary ? dynamicPackage() : isLateSummary ? latePackage() : selectedPack();
      const institutionCount = isDynamicSummary
        ? (dynamicMeta.institution ? 1 : 0)
        : isLateSummary
          ? lateSelectedInstitutions().length
          : state.institutions.length;
      const avg = workingAvg();
      const aps = apsSummary();
      const nextAction = isLateSummary
        ? (state.lateApplication.submitted ? "Late application submitted. Track it from your dashboard." : "Complete the late application steps.")
        : isDynamicSummary
          ? (state.dynamicApplication.submitted ? `${dynamicInfo?.label || "Application"} submitted. Track it from your dashboard.` : `Complete the ${dynamicInfo?.label || "application"} steps.`)
          : !complete("learner")
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
      const tips = isLateSummary
        ? { title: "Late Applications", text: "Choose a package, shortlist open institutions, and submit the review when everything is ready." }
        : isDynamicSummary
          ? { title: dynamicInfo?.label || "Application", text: packChoice ? "Your package is selected. Complete the required details and submit for Kagie review." : "Start by choosing the package for this application type." }
          : !state.marks.length
            ? { title: "Add your marks", text: "Once your marks are in, Kagie can suggest better options for you." }
            : aps.total >= 34
              ? { title: "Strong options available", text: "Your APS is strong. You can explore a wide range of universities and courses." }
              : aps.total >= 26
                ? { title: "Good shortlist range", text: "You have a balanced range. Kagie can help you mix safer and stronger options." }
                : { title: "Start with safer options", text: "Kagie can still help you build a realistic shortlist and keep moving." };
      const progressValue = isLateSummary
        ? Math.round((state.lateApplication.submitted ? 7 : state.lateApplication.currentStep) / 7 * 100)
        : isDynamicSummary
          ? Math.round((state.dynamicApplication.submitted ? dynamicSteps().length : state.dynamicApplication.currentStep) / Math.max(1, dynamicSteps().length) * 100)
          : readiness();
      setText("heroTitle", `Hello, ${user.fullName || state.learner.fullNames || "Student"}`);
      setText("packMeta", packChoice ? `${packChoice.name} selected` : "No package selected");
      setText("instMeta", `${institutionCount} institution${institutionCount === 1 ? "" : "s"}`);
      setText("markMeta", `${state.marks.length} subject${state.marks.length === 1 ? "" : "s"}`);
      setText("avgMeta", avg ? `Average ${avg}%` : "Average pending");
      setText("apsMeta", aps.total ? `APS ${aps.total}` : "APS pending");
      setText("readyMeta", `${progressValue}%`);
      const progressBar = $("progressBar");
      if (progressBar) progressBar.style.width = `${progressValue}%`;
      if (state.current === "late") {
        const lateStep = lateApplicationSteps.find((step) => step.id === state.lateApplication.currentStep) || lateApplicationSteps[0];
        setText("stepMeta", "Late Applications");
        setText("stepHint", lateStep.sub || "Complete the current late application step.");
        setText("stepIntroBadge", state.lateApplication.submitted ? "Submitted" : `Step ${state.lateApplication.currentStep} / 7`);
      } else if (state.current === "dynamic") {
        const definition = dynamicInfo;
        const stepsForType = dynamicSteps();
        const currentStep = stepsForType[state.dynamicApplication.currentStep - 1] || stepsForType[0];
        setText("stepMeta", definition?.label || "Application");
        setText("stepHint", currentStep?.subtitle || "Complete the current application step.");
        setText("stepIntroBadge", state.dynamicApplication.submitted ? "Submitted" : `Step ${state.dynamicApplication.currentStep} / ${Math.max(1, stepsForType.length)}`);
      } else {
        setText("stepMeta", steps.find((step) => step.key === state.current)?.label || "Learner");
        setText("stepHint", steps.find((step) => step.key === state.current)?.hint || "Complete the current section.");
        const activeStepIndex = state.current === "type" ? 1 : Math.max(1, steps.findIndex((step) => step.key === state.current) + 1);
        setText("stepIntroBadge", `Step ${activeStepIndex} / 6`);
      }
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
    const choiceKeys = ["choice1", "choice2", "choice3"];
    const choiceNumber = (key) => key.replace("choice", "");
    const choiceFacultyKey = (key) => `${key}Faculty`;
    const choiceTitle = (key) => `Type choice ${choiceNumber(key)}`;
    const choiceSearch = choiceKeys.reduce((acc, key) => {
      acc[key] = { faculty: "", course: "" };
      return acc;
    }, {});
    const getChoiceFaculty = (key) => String(state.apply[choiceFacultyKey(key)] || "").trim();
    const getChoiceCourse = (key) => String(state.apply[key] || "").trim();
    const resetApplyChoices = () => {
      state.apply.facultyName = "";
      choiceKeys.forEach((key) => {
        state.apply[key] = "";
        state.apply[choiceFacultyKey(key)] = "";
        choiceSearch[key].faculty = "";
        choiceSearch[key].course = "";
      });
    };
    const choiceDetailsFromState = () => choiceKeys.map((key) => ({
      choice: Number(choiceNumber(key)),
      faculty: getChoiceFaculty(key),
      course: getChoiceCourse(key)
    }));
    const summarizeChoiceFaculties = () => uniqueStrings(choiceKeys.map((key) => getChoiceFaculty(key))).join(" | ");
    const getFacultyRecord = (faculties, facultyName) => asArray(faculties).find((item) => normalizeText(item.name) === normalizeText(facultyName));
    const closeChoicePanels = (exceptKey = "") => {
      choiceKeys.forEach((key) => {
        if (key === exceptKey) return;
        const panel = $(`${key}Panel`);
        if (panel) panel.hidden = true;
      });
    };

    const focusChoiceSearch = (key, type) => {
      const selector = type === "course"
        ? `[data-choice-course-search="${key}"]`
        : `[data-choice-faculty-search="${key}"]`;
      requestAnimationFrame(() => {
        const field = document.querySelector(selector);
        if (!field) return;
        const cursorAt = String(field.value || "").length;
        field.focus({ preventScroll: true });
        if (field.setSelectionRange) field.setSelectionRange(cursorAt, cursorAt);
      });
    };

    const renderChoicePicker = (key, faculties, hasGuidedCatalog) => {
      const faculty = getChoiceFaculty(key);
      const course = getChoiceCourse(key);
      const search = choiceSearch[key] || { faculty: "", course: "" };
      const facultyInputValue = search.faculty || faculty;
      const courseInputValue = search.course || course;
      const facultyQuery = normalizeText(facultyInputValue);
      const selectedFaculty = getFacultyRecord(faculties, faculty);
      const courses = asArray(selectedFaculty?.courses).map((item) => String(item || "").trim()).filter(Boolean);
      const courseQuery = normalizeText(courseInputValue);
      const visibleFaculties = facultyQuery
        ? faculties.filter((item) => normalizeText(item?.name || "").includes(facultyQuery))
        : faculties;
      const visibleCourses = courseQuery
        ? courses.filter((item) => normalizeText(item).includes(courseQuery))
        : courses;
      const summary = course ? course : faculty ? "Choose a course" : "Choose faculty first";
      const meta = course && faculty
        ? faculty
          : faculty
          ? selectedFaculty
            ? `${courses.length || 0} course${courses.length === 1 ? "" : "s"} available`
            : "Manual faculty entered"
          : hasGuidedCatalog
            ? "Type faculty or choose one below."
            : "Manual entry is available for this institution.";

      setText(`${key}Summary`, summary);
      setText(`${key}Meta`, meta);
      setText(`${key}FacultyHint`, hasGuidedCatalog ? `${faculties.length} faculties` : "Manual");
      setText(`${key}CourseHint`, faculty ? (selectedFaculty ? `${courses.length} courses` : "Manual course") : "Pick faculty first");
      setValue(key, course);
      setValue(choiceFacultyKey(key), faculty);

      if (!hasGuidedCatalog) {
        setHtml(`${key}FacultyList`, `
          <div class="choice-manual">
            <input class="field" data-choice-manual-faculty="${esc(key)}" value="${esc(faculty)}" placeholder="Type official faculty for ${esc(choiceTitle(key))}" autocomplete="off" />
          </div>
        `);
        setHtml(`${key}CourseList`, `
          <div class="choice-manual">
            <input class="field" data-choice-manual-course="${esc(key)}" value="${esc(course)}" placeholder="Type official course for ${esc(choiceTitle(key))}" autocomplete="off" />
          </div>
        `);
        return;
      }

      setHtml(`${key}FacultyList`, `
        <div class="choice-search-row field-span-all">
          <input class="field" data-choice-faculty-search="${esc(key)}" value="${esc(facultyInputValue)}" placeholder="Type or search faculty for ${esc(choiceTitle(key))}" autocomplete="off" />
        </div>
        ${faculties.length
        ? (visibleFaculties.length ? visibleFaculties.map((item) => {
          const name = String(item?.name || "").trim();
          return `<button class="choice-pick ${normalizeText(name) === normalizeText(faculty) ? "active" : ""}" type="button" data-choice-faculty="${esc(key)}" data-faculty-name="${esc(name)}">${esc(name)}</button>`;
        }).join("") : `<div class="empty field-span-all">${facultyInputValue ? `No faculty matches "${esc(facultyInputValue)}". Kagie will use your typed faculty manually.` : "No faculty matches your search."}</div>`)
        : `<div class="empty field-span-all">Choose an institution first.</div>`}
      `);

      setHtml(`${key}CourseList`, faculty
        ? `
          <div class="choice-search-row field-span-all">
            <input class="field" data-choice-course-search="${esc(key)}" value="${esc(courseInputValue)}" placeholder="Type or search course under ${esc(faculty)}" autocomplete="off" />
          </div>
          ${courses.length
            ? (visibleCourses.length ? visibleCourses.map((item) => `<button class="choice-pick ${normalizeText(item) === normalizeText(course) ? "active" : ""}" type="button" data-choice-course="${esc(key)}" data-course-name="${esc(item)}">${esc(item)}</button>`).join("") : `<div class="empty field-span-all">No course matches your search under ${esc(faculty)}.</div>`)
            : `<div class="empty field-span-all">Type the official course name above.</div>`}
        `
        : `<div class="empty">Select a faculty above to show its courses.</div>`);
    };

    const renderPacks = () => {
      const packChoice = selectedPack();
      const undergraduatePacks = packagesForApplicationType("undergraduate");
      setHtml("packGrid", undergraduatePacks.map((item) => {
        const features = packageFeatures(item);
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
        : `<p class="helper-meta" style="margin-top:0">No institution details yet. You can pay now and finish these choices from your Dashboard.</p>`;
      setHtml("packSummaryCard", `
        <div class="row">
          <div>
            <strong>${esc(packChoice ? `${packChoice.name} selected` : "No package selected")}</strong>
            <p>${esc(packChoice ? `${money(packChoice.price)} | ${state.institutions.length} inside package | ${packageUsage().remainingSlots} left.` : "Tap one package to continue to payment.")}</p>
          </div>
          ${packChoice ? `<span class="pill">${esc(`${state.institutions.length} inside package`)}</span>` : ""}
        </div>
        <div class="application-payment-note pack-payment-note">
          <span class="material-icons-outlined" aria-hidden="true">info</span>
          <span>${esc("Complete payment now and finish the remaining application details later from your Dashboard. Final submission stays locked until all required information is complete.")}</span>
        </div>
        ${packChoice ? `<div class="pack-checkout-row"><button class="mini green" type="button" data-pack-checkout>Continue to checkout</button><button class="mini alt" type="button" data-pack-details>Complete details now</button></div>` : ""}
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
            ? asArray(api.getInstitutionCatalog({ year: yearKey, includeInactive: false, canApplyOnly: true }))
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
      field.innerHTML = [
        `<option value="">Select institution</option>`,
        optionHtml || `<option value="" disabled>${uniqueItems.length ? "No matching institution found" : "No institutions are currently open for applications. Please check again later."}</option>`
      ].join("");

      if (meta) {
        const total = uniqueItems.length;
        meta.textContent = !total
          ? "No institutions are currently open for applications. Please check again later."
          : query
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
      choiceKeys.forEach((key) => {
        const facultyKey = choiceFacultyKey(key);
        if (!chosenInstitution) {
          state.apply[facultyKey] = "";
          state.apply[key] = "";
        }
      });
      state.apply.facultyName = summarizeChoiceFaculties();
      fill("applyProvince", provinceList, state.apply.province, "Select province");
      fill("applyYear", availableYears, state.apply.year, "Select year");
      fill("institutionType", typeList, state.apply.institutionType, "Select institution type");
      fillInstitutionOptions(matches, state.apply.institutionName);
      setValue("facultyName", state.apply.facultyName || "");
      setValue("choice1", state.apply.choice1 || "");
      setValue("choice2", state.apply.choice2 || "");
      setValue("choice3", state.apply.choice3 || "");
      setValue("choice1Faculty", state.apply.choice1Faculty || "");
      setValue("choice2Faculty", state.apply.choice2Faculty || "");
      setValue("choice3Faculty", state.apply.choice3Faculty || "");
      choiceKeys.forEach((key) => renderChoicePicker(key, guidedFaculties, hasGuidedCatalog));
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
              ? `${chosenInstitution.name} is selected. Each choice can use its own faculty and course.`
              : `${chosenInstitution.name} is selected. Type official faculty and course names for each choice.`;
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
      resetApplyChoices();
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
          const choiceRows = (Array.isArray(item.choiceDetails) && item.choiceDetails.length
            ? item.choiceDetails
            : [
              { choice: 1, faculty: item.choice1Faculty || item.faculty || "", course: item.choice1 || "" },
              { choice: 2, faculty: item.choice2Faculty || item.faculty || "", course: item.choice2 || "" },
              { choice: 3, faculty: item.choice3Faculty || item.faculty || "", course: item.choice3 || "" }
            ])
            .map((choice, choiceIndex) => {
              const label = choice.choice || choiceIndex + 1;
              const faculty = choice.faculty || "Faculty pending";
              const course = choice.course || `Choice ${label} pending`;
              return `<p>${esc(`Choice ${label}: ${faculty} | ${course}`)}</p>`;
            })
            .join("");
          return `
            <div class="institution-inline-row ${status === "closed" ? "institution-card closed" : ""}">
              <div class="institution-inline-main">
                <strong>${esc(`${index + 1}. ${item.institutionName}`)}</strong>
                <p>${esc(item.choice1 ? `Choice 1: ${item.choice1}` : "Choice 1 pending")}</p>
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
                  ${choiceRows}
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
    }, 140);

    const renderSections = () => {
      const isLateStep = state.current === "late";
      const isDynamicStep = state.current === "dynamic";
      document.body.classList.toggle("forms-late-mode", isLateStep || isDynamicStep);
      document.body.classList.toggle("forms-dynamic-mode", isDynamicStep);
      const activeApplicationType = normalizeApplicationType(
        isLateStep ? "late" : isDynamicStep ? state.dynamicApplication.type : state.applicationType
      );
      ["undergraduate", "late", "transfer", "bridging", "postgraduate"].forEach((type) => {
        document.body.classList.toggle(`forms-type-${type}`, activeApplicationType === type);
      });
      document.querySelectorAll("[data-step]").forEach((section) => section.classList.toggle("active", section.dataset.step === state.current));
      const i = steps.findIndex((step) => step.key === state.current);
      const isTypeStep = state.current === "type";
      setDisplay("prevBtn", (isLateStep || isDynamicStep) ? "none" : (isTypeStep || i >= 0 ? "inline-flex" : "none"));
      setDisplay("nextBtn", isLateStep || isDynamicStep || state.current === "apply" ? "none" : "inline-flex");
      setText("nextBtn", "Continue");
    };

    const renderAll = () => {
      if (state.current === "learner") renderFields("learnerFields", "learner");
      if (state.current === "parent") renderFields("parentFields", "parent");
      if (state.current === "school") {
        renderFields("schoolFields", "school");
        try {
          syncSchoolLookup();
        } catch (error) {
          console.warn("Kagie forms school lookup fallback:", error);
        }
      }
      renderSteps();
      if (state.current === "type") renderApplicationTypes();
      if (state.current === "late") renderLateApplicationFlow();
      if (state.current === "dynamic") renderDynamicApplicationFlow();
      renderSummary();
      if (state.current === "marks") {
        fill("subjectSelect", subjectCatalog, $("subjectSelect")?.value || "", "Select subject");
        renderMarks();
      }
      if (state.current === "pack" || state.current === "apply") renderPacks();
      if (state.current === "apply") {
        safeSyncApply();
        renderInst();
        renderFavorites();
      }
      renderSections();
      syncCartButtonLabel();
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
    };

    const fieldChange = (event) => {
      const input = event.target;
      const tagName = String(input?.tagName || "").toLowerCase();
      const group = input.dataset.group;
      const name = input.dataset.name;
      if (!group || !name) return;
      if (event.type === "change" && (tagName === "textarea" || (tagName === "input" && !input.hasAttribute("data-dob-wheel")))) return;
      const previous = state[group][name];
      if (group === "learner" && supportFields.includes(name)) editedSupportFields.add(name);
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
      if (group === "learner" && supportFields.includes(name)) editedSupportFields.add(name);
      state[group][name] = value;
      if (group === "learner" && name === "hasDisability" && value !== "yes") {
        editedSupportFields.add("disabilityDescription");
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
      scrollToFormStart();
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

    const openLateApplicationFlow = (options = {}) => {
      if (options.startAtPackage) {
        state.lateApplication.currentStep = 3;
        state.lateApplication.submitted = false;
        state.lateApplication.reviewConfirmed = false;
      } else if (options.startAtDetails) {
        state.lateApplication.currentStep = 1;
        state.lateApplication.submitted = false;
        state.lateApplication.reviewConfirmed = false;
      }
      state.applicationType = "late";
      state.current = "late";
      state.dynamicApplication.type = "";
      state.dynamicApplication.submitted = false;
      state.dynamicApplication.selectedPackage = "";
      saveWork({ immediate: true });
      renderAll();
      scrollToFormStart();
    };

    const submitLateApplication = async () => {
      const firstInvalid = firstInvalidLateStep();
      if (firstInvalid) {
        setLateStep(firstInvalid);
        showNotice("Complete all required late-application details before final submission.", "warn");
        return;
      }
      const reference = state.lateApplication.reference || `KAG-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
      const submittedAt = new Date().toISOString();
      const paymentStarted = applicationPaymentHasStarted();
      state.lateApplication.reference = reference;
      state.lateApplication.currentStep = 7;
      const pkg = latePackage();
      const selectedCourses = lateSelectedCourses();
      const selectedCourse = selectedCourses[0] || lateSelectedCourse();
      const selectedInstitutions = lateSelectedInstitutions();
      const submission = {
        id: `late_${Date.now()}`,
        reference,
        userId: user.id,
        applicationId: draft.id,
        type: "late_application",
        label: "Late Application",
        status: "Under Review",
        createdAt: submittedAt,
        submittedAt,
        data: { ...clone(state.lateApplication), submitted: true }
      };
      const submissionsKey = `kagie_late_applications_${user.id}`;
      saveWork({ immediate: true });
      const patch = {
        status: "Submitted",
        submittedAt,
        applicationType: "late",
        applicationTypeLabel: "Late Applications",
        institutionName: selectedInstitutions[0]?.name || state.lateApplication.details.institution || "",
        programme: selectedCourse?.name || state.lateApplication.details.course || "",
        program: selectedCourse?.name || state.lateApplication.details.course || "",
        applicationEngine: {
          version: "multi-application-v1",
          type: "late",
          label: "Late Applications",
          submittedAt,
          reference,
          formData: clone(state.lateApplication)
        },
        lateApplication: submission,
        forms: {
          applicationType: {
            type: "late",
            label: "Late Applications",
            submittedAt,
            reference
          },
          dynamicApplications: {
            late: clone(state.lateApplication)
          }
        },
        package: pkg ? { id: `late_${pkg.id}`, name: pkg.name, price: pkg.price, institutionLimit: pkg.limit } : draft.package || null,
        institutions: selectedInstitutions.map((item) => {
          const institutionCourses = selectedCourses.filter((course) => course.instId === item.id);
          return {
            id: `late_${item.id}`,
            institutionName: item.name,
            institutionType: item.type,
            province: item.province,
            institutionStatus: item.status,
            choice1: institutionCourses[0]?.name || "",
            choice2: institutionCourses[1]?.name || "",
            choice3: institutionCourses[2]?.name || "",
            programme: institutionCourses.map((course) => course.name).join(" | "),
            applicationType: "late",
            createdAt: submittedAt
          };
        })
      };
      try {
        const submittedDraft = api.updateApplicationAsync
          ? await api.updateApplicationAsync(draft.id, patch)
          : api.updateApplication(draft.id, patch);
        if (submittedDraft) draft = submittedDraft;
      } catch (error) {
        console.warn("Late application submission failed:", error);
        saveWork({ immediate: true });
        showNotice(`Your details are kept on this page. Kagie could not submit the late application yet: ${error.message}. Please retry.`, "warn");
        return;
      }
      state.lateApplication.submitted = true;
      const storedLocally = storeSubmissionRecord(submissionsKey, submission);
      saveWork({ immediate: true });
      if (!paymentStarted) {
        try {
          await syncLatePackageCartItem(pkg);
        } catch (error) {
          console.warn("Late application cart sync fallback:", error);
        }
      }
      renderAll();
      showNotice(storedLocally
        ? "Late application submitted. Kagie saved your reference and will show it on your dashboard."
        : "Late application submitted online. Your browser storage is full or unavailable, so a device copy could not be saved.", storedLocally ? "success" : "warn");
    };

    const submitLateApplicationToCart = async () => {
      const pkg = latePackage();
      if (!pkg) {
        showNotice("Choose a package before opening cart.", "warn");
        setLateStep(3);
        return;
      }
      saveWork({ immediate: true });
      try {
        await syncLatePackageCartItem(pkg);
        showNotice("Application package added to cart.", "success");
        window.location.href = "cart.html";
      } catch (error) {
        showNotice(`Kagie could not add this package to cart yet: ${error.message}`, "warn");
      }
    };

    const openSelectedApplicationType = async () => {
      if (!state.applicationType) {
        showNotice("Please choose an application type first.", "warn");
        return;
      }
      if (state.applicationType === "late") {
        openLateApplicationFlow({ startAtPackage: true });
        return;
      }
      const definition = applicationFormRegistry[state.applicationType];
      if (definition?.engine === "dynamic") {
        openDynamicApplicationFlow(state.applicationType, { startAtFirst: true });
        return;
      }
      if (state.applicationType !== "undergraduate") {
        showNotice("This application type is not configured yet.", "warn");
        return;
      }
      const undergraduatePatch = {
        applicationType: "undergraduate",
        applicationTypeLabel: "Undergraduate Applications",
        forms: {
          applicationType: {
            type: "undergraduate",
            label: "Undergraduate Applications"
          }
        }
      };
      try {
        if (api.updateApplication) api.updateApplication(draft.id, undergraduatePatch);
        if (api.updateApplicationAsync) await api.updateApplicationAsync(draft.id, undergraduatePatch);
      } catch (error) {
        console.warn("Could not save undergraduate application type metadata:", error);
      }
      await go("learner");
    };

    on("applicationTypeList", "click", async (e) => {
      const button = e.target.closest("[data-application-type]");
      if (!button) return;
      state.applicationType = button.getAttribute("data-application-type") || "";
      saveWork({ immediate: true });
      renderApplicationTypes();
      if (!applicationFormRegistry[state.applicationType]) {
        showNotice("This application type is not configured yet.", "warn");
        return;
      }
      if (state.applicationType === "late") {
        openLateApplicationFlow({ startAtPackage: true });
        return;
      }
      await withActionLock(button, `application-type:${state.applicationType}`, "Opening...", openSelectedApplicationType);
    });

    on("stepList", "click", async (e) => {
      const lateButton = e.target.closest("[data-late-step]");
      if (lateButton && state.current === "late") {
        const targetStep = Number(lateButton.getAttribute("data-late-step") || 1);
        if (targetStep <= state.lateApplication.currentStep || state.lateApplication.submitted) {
          setLateStep(targetStep);
        }
        return;
      }
      const dynamicButton = e.target.closest("[data-dynamic-step]");
      if (dynamicButton && state.current === "dynamic") {
        const targetStep = Number(dynamicButton.getAttribute("data-dynamic-step") || 1);
        if (targetStep <= state.dynamicApplication.currentStep || state.dynamicApplication.submitted) {
          setDynamicStep(targetStep);
        }
        return;
      }
      const button = e.target.closest("[data-step]");
      if (!button) return;
      await withActionLock(button, `step:${button.dataset.step}`, "Saving...", () => go(button.dataset.step));
    });

    document.body.addEventListener("input", (event) => {
      const input = event.target;
      const section = input.getAttribute?.("data-late-section");
      const name = input.getAttribute?.("data-late-name");
      if (!section || !name || !state.lateApplication[section]) return;
      state.lateApplication[section][name] = input.type === "checkbox" ? input.checked : input.value;
      saveWork();
      const lateNext = document.querySelector('[data-late-action="next"]');
      if (lateNext) lateNext.disabled = !isLateStepValid();
      if (section === "details" && name === "institutionSearch" && state.current === "late") {
        scheduleLateFlowRefresh(input.id);
        return;
      }
      renderSummary();
    });

    document.body.addEventListener("input", (event) => {
      const input = event.target;
      const name = input.getAttribute?.("data-dynamic-name");
      if (!name) return;
      state.dynamicApplication.values[name] = input.type === "checkbox" ? input.checked : input.value;
      saveWork();
      const dynamicNext = document.querySelector('[data-dynamic-action="next"]');
      if (dynamicNext) dynamicNext.disabled = !isDynamicStepValid();
      renderSummary();
    });

    document.body.addEventListener("change", (event) => {
      const input = event.target;
      const section = input.getAttribute?.("data-late-section");
      const name = input.getAttribute?.("data-late-name");
      if (section && name && state.lateApplication[section]) {
        state.lateApplication[section][name] = input.type === "checkbox" ? input.checked : input.value;
        if (section === "details" && ["selectedInstitutionFilter", "studyFieldFilter", "qualificationFilter"].includes(name)) {
          prepareLateCoursesStep();
        }
        saveWork();
        if (input.tagName === "SELECT") renderLateApplicationFlow();
        const nextButton = document.querySelector('[data-late-action="next"]');
        if (nextButton) nextButton.disabled = !isLateStepValid();
        renderSummary();
        return;
      }
      const dynamicName = input.getAttribute?.("data-dynamic-name");
      if (dynamicName) {
        state.dynamicApplication.values[dynamicName] = input.type === "checkbox" ? input.checked : input.value;
        saveWork({ immediate: true });
        // The input event already updates text fields. Preserve their caret on blur.
        const nextButton = document.querySelector('[data-dynamic-action="next"]');
        if (nextButton) nextButton.disabled = !isDynamicStepValid();
        renderSummary();
        return;
      }
      const dynamicFile = input.getAttribute?.("data-dynamic-file");
      if (dynamicFile && input.files?.[0]) {
        state.dynamicApplication.values[dynamicFile] = input.files[0].name;
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const fileKey = input.getAttribute?.("data-late-file");
      if (fileKey && input.files?.[0]) {
        if (!validateLateUpload(input.files[0])) {
          input.value = "";
          return;
        }
        state.lateApplication.details[fileKey] = input.files[0].name;
        if (fileKey === "resultsFile") {
          state.lateApplication.documents.statuses.results = "uploaded";
          state.lateApplication.documents.fileNames = state.lateApplication.documents.fileNames || {};
          state.lateApplication.documents.fileNames.results = input.files[0].name;
        }
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const docFile = input.getAttribute?.("data-late-doc-file");
      if (docFile && input.files?.[0]) {
        if (!validateLateUpload(input.files[0])) {
          input.value = "";
          return;
        }
        state.lateApplication.documents.statuses[docFile] = "uploaded";
        state.lateApplication.documents.fileNames = state.lateApplication.documents.fileNames || {};
        state.lateApplication.documents.fileNames[docFile] = input.files[0].name;
        if (docFile === "results" && !state.lateApplication.details.resultsFile) {
          state.lateApplication.details.resultsFile = input.files[0].name;
        }
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      if (input.hasAttribute?.("data-late-extra-file") && input.files?.[0]) {
        if (!validateLateUpload(input.files[0])) {
          input.value = "";
          return;
        }
        state.lateApplication.documents.extraFile = input.files[0].name;
        saveWork({ immediate: true });
        renderAll();
      }
    });

    document.body.addEventListener("click", async (event) => {
      const radio = event.target.closest("[data-late-radio-section][data-late-radio-name][data-late-radio-value]");
      if (radio) {
        const section = radio.getAttribute("data-late-radio-section");
        const name = radio.getAttribute("data-late-radio-name");
        state.lateApplication[section][name] = radio.getAttribute("data-late-radio-value");
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const pkgButton = event.target.closest("[data-late-package]");
      if (pkgButton) {
        await withActionLock(pkgButton, `late-package:${pkgButton.getAttribute("data-late-package")}`, "Adding...", async () => {
          state.lateApplication.selectedPackage = pkgButton.getAttribute("data-late-package") || "";
          saveWork({ immediate: true });
          renderAll();
          const pkg = latePackage();
          try {
            const cartItem = await syncLatePackageCartItem(pkg);
            showNotice(
              cartItem?.syncState === "synced"
                ? "Late application package added to cart."
                : "Late application package selected. Kagie saved a safe cart copy and will finish live sync shortly.",
              cartItem?.syncState === "synced" ? "success" : "warn"
            );
          } catch (error) {
            console.warn("Late application package cart sync fallback:", error);
            showNotice("Package selected, but Kagie could not add it to cart yet. Try Open cart again in a moment.", "warn");
          }
        });
        return;
      }
      const institutionButton = event.target.closest("[data-late-institution]");
      if (institutionButton && !institutionButton.disabled) {
        const id = institutionButton.getAttribute("data-late-institution");
        const selected = state.lateApplication.selectedInstitutions;
        const pkg = latePackage();
        const limit = pkg?.limit || 10;
        state.lateApplication.selectedInstitutions = selected.includes(id)
          ? selected.filter((item) => item !== id)
          : (selected.length < limit ? selected.concat(id) : selected);
        prepareLateCoursesStep();
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const courseInstitutionButton = event.target.closest("[data-late-course-institution]");
      if (courseInstitutionButton) {
        state.lateApplication.details.selectedInstitutionFilter = courseInstitutionButton.getAttribute("data-late-course-institution") || "";
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const courseButton = event.target.closest("[data-late-course]");
      if (courseButton) {
        const id = courseButton.getAttribute("data-late-course") || "";
        const selected = state.lateApplication.selectedCourses;
        state.lateApplication.selectedCourses = selected.includes(id)
          ? selected.filter((item) => item !== id)
          : selected.concat(id);
        state.lateApplication.selectedCourse = state.lateApplication.selectedCourses[0] || "";
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const docButton = event.target.closest("[data-late-doc-pick]");
      if (docButton) {
        const row = docButton.closest(".late-doc-row");
        const input = row?.querySelector("input[data-late-doc-file]");
        if (input) input.click();
        return;
      }
      const docViewButton = event.target.closest("[data-late-doc-view]");
      if (docViewButton) {
        const id = docViewButton.getAttribute("data-late-doc-view");
        const fileName = state.lateApplication.documents.fileNames?.[id] || (id === "results" ? state.lateApplication.details.resultsFile : "");
        showNotice(fileName ? `${fileName} is attached to this application.` : "This document is marked as uploaded.", "success");
        return;
      }
      const editButton = event.target.closest("[data-late-edit-step]");
      if (editButton) {
        setLateStep(Number(editButton.getAttribute("data-late-edit-step") || 1));
        return;
      }
      const reviewConfirm = event.target.closest("[data-late-review-confirm]");
      if (reviewConfirm) {
        state.lateApplication.reviewConfirmed = reviewConfirm.checked;
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const docConfirm = event.target.closest("[data-late-doc-confirm]");
      if (docConfirm) {
        state.lateApplication.documents.confirmed = docConfirm.checked;
        saveWork({ immediate: true });
        renderAll();
        return;
      }
      const action = event.target.closest("[data-late-action]")?.getAttribute("data-late-action");
      if (!action) return;
      if (action === "back") {
        if (state.lateApplication.currentStep <= 1) {
          state.current = "type";
          saveWork({ immediate: true });
          renderAll();
        } else {
          setLateStep(state.lateApplication.currentStep - 1);
        }
        return;
      }
      if (action === "next") {
        if (!isLateStepValid()) {
          showNotice("Complete the required late application details before continuing.", "warn");
          return;
        }
        if (state.lateApplication.currentStep >= 7) {
          await withActionLock(event.target.closest("[data-late-action]"), "submit-late", "Submitting...", submitLateApplication);
        } else {
          const nextStep = state.lateApplication.currentStep + 1;
          if (nextStep === 4) prepareLateInstitutionsStep();
          if (nextStep === 5) prepareLateCoursesStep();
          setLateStep(state.lateApplication.currentStep + 1);
        }
        return;
      }
      if (action === "cart") {
        const pkg = latePackage();
        if (!pkg) {
          showNotice("Choose a package before opening cart.", "warn");
          setLateStep(3);
          return;
        }
        try {
          await syncLatePackageCartItem(pkg);
          window.location.href = "cart.html";
        } catch (error) {
          showNotice(`Kagie could not add this package to cart yet: ${error.message}`, "warn");
        }
        return;
      }
      if (action === "dashboard" || action === "track") {
        window.location.href = "Dashboard.html";
      }
    });

    document.body.addEventListener("click", async (event) => {
      const packageButton = event.target.closest("[data-dynamic-package]");
      if (packageButton) {
        await withActionLock(packageButton, `dynamic-package:${packageButton.getAttribute("data-dynamic-package")}`, "Adding...", async () => {
          state.dynamicApplication.selectedPackage = packageButton.getAttribute("data-dynamic-package") || "";
          saveWork({ immediate: true });
          renderDynamicApplicationFlow();
          renderSteps();
          const pkg = dynamicPackage();
          try {
            const cartItem = await syncDynamicPackageCartItem(pkg);
            showNotice(
              cartItem?.syncState === "synced"
                ? "Package selected and added to cart."
                : "Package selected. Kagie saved a safe cart copy and will finish live sync shortly.",
              cartItem?.syncState === "synced" ? "success" : "warn"
            );
          } catch (error) {
            console.warn("Dynamic package cart sync fallback:", error);
            showNotice("Package selected, but Kagie could not add it to cart yet. Try Open cart again in a moment.", "warn");
          }
        });
        return;
      }
      const action = event.target.closest("[data-dynamic-action]")?.getAttribute("data-dynamic-action");
      if (!action) return;
      if (action === "back") {
        if (state.dynamicApplication.currentStep <= 1) {
          state.current = "type";
          saveWork({ immediate: true });
          renderAll();
        } else {
          setDynamicStep(state.dynamicApplication.currentStep - 1);
        }
        return;
      }
      if (action === "next") {
        if (!isDynamicStepValid()) {
          showNotice("Complete the required application details before continuing.", "warn");
          return;
        }
        if (state.dynamicApplication.currentStep >= dynamicSteps().length) {
          await withActionLock(event.target.closest("[data-dynamic-action]"), "submit-dynamic", "Submitting...", submitDynamicApplication);
        } else {
          setDynamicStep(state.dynamicApplication.currentStep + 1);
        }
        return;
      }
      if (action === "cart") {
        const pkg = dynamicPackage();
        if (!pkg) {
          showNotice("Choose a package before opening cart.", "warn");
          setDynamicStep(1);
          return;
        }
        try {
          await syncDynamicPackageCartItem(pkg);
          window.location.href = "cart.html";
        } catch (error) {
          showNotice(`Kagie could not add this package to cart yet: ${error.message}`, "warn");
        }
        return;
      }
      if (action === "dashboard" || action === "track") {
        window.location.href = "Dashboard.html";
      }
    });

    on("addSubjectBtn", "click", async (event) => withActionLock(event.currentTarget, "add-subject", "Saving...", async () => {
      const subject = $("subjectSelect")?.value || "";
      const rawPercent = String($("subjectPercent")?.value || "").trim();
      const percent = Number(rawPercent);
      if (!subject || !rawPercent || !Number.isFinite(percent)) {
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
      renderSteps();
      try {
        if (!await saveStep("marks")) return;
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
      renderSteps();
      try {
        if (!await saveStep("marks")) return;
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
        renderSteps();
        safeSyncApply();
        try {
          if (!await saveStep("pack")) return;
          const cartItem = await syncSelectedPackCartItem(selectedPack(), { institutions: clone(state.institutions) });
          showNotice(
            cartItem?.syncState === "synced"
              ? "Package selected and added to cart. You can continue to checkout now."
              : "Package selected. Kagie saved a safe cart copy and will finish live sync shortly.",
            cartItem?.syncState === "synced" ? "success" : "warn"
          );
        } catch (error) {
          console.error(error);
          showNotice(`Package selected, but the draft could not sync yet: ${error.message}`, "warn");
        }
      });
    });

    const applyFieldMap = { applyYear: "year", applyProvince: "province", institutionType: "institutionType", institutionName: "institutionName" };
    const updateApplyField = (id, value) => {
      const key = applyFieldMap[id];
      if (!key) return;
      if (id === "applyYear" && state.apply.year !== value) {
        setValue("institutionSearch", "");
        state.apply.province = "";
        state.apply.institutionType = "";
        state.apply.institutionName = "";
        resetApplyChoices();
      } else if (id === "applyProvince" && state.apply.province !== value) {
        setValue("institutionSearch", "");
        state.apply.institutionType = "";
        state.apply.institutionName = "";
        resetApplyChoices();
      } else if (id === "institutionType" && state.apply.institutionType !== value) {
        setValue("institutionSearch", "");
        state.apply.institutionName = "";
        resetApplyChoices();
      } else if (id === "institutionName" && state.apply.institutionName !== value) {
        resetApplyChoices();
      }
      state.apply[key] = value;
      saveWork();
      safeSyncApply();
      queueMinorRender();
    };

    Object.keys(applyFieldMap).forEach((id) => {
      on(id, "change", (e) => updateApplyField(id, e.target.value));
    });

    on("institutionSearch", "input", debounce(() => {
      safeSyncApply();
    }, 120));

    const syncApplyDraftFromFields = () => {
      choiceKeys.forEach((key) => {
        const courseField = $(key);
        const facultyField = $(choiceFacultyKey(key));
        if (courseField) state.apply[key] = String(courseField.value || state.apply[key] || "").trim();
        if (facultyField) state.apply[choiceFacultyKey(key)] = String(facultyField.value || state.apply[choiceFacultyKey(key)] || "").trim();
      });
      state.apply.facultyName = summarizeChoiceFaculties();
      saveWork();
    };

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-choice-open]");
      if (trigger) {
        const key = trigger.getAttribute("data-choice-open");
        if (!choiceKeys.includes(key)) return;
        if (!state.apply.institutionName) {
          showNotice("Choose an institution first, then select faculties and courses.", "warn");
          $("institutionName")?.focus();
          return;
        }
        const panel = $(`${key}Panel`);
        if (!panel) return;
        const nextHidden = !panel.hidden;
        closeChoicePanels(key);
        panel.hidden = nextHidden;
        return;
      }

      const facultyButton = event.target.closest("[data-choice-faculty]");
      if (facultyButton) {
        const key = facultyButton.getAttribute("data-choice-faculty");
        if (!choiceKeys.includes(key)) return;
        const faculty = String(facultyButton.getAttribute("data-faculty-name") || "").trim();
        state.apply[choiceFacultyKey(key)] = faculty;
        state.apply[key] = "";
        choiceSearch[key].faculty = faculty;
        choiceSearch[key].course = "";
        state.apply.facultyName = summarizeChoiceFaculties();
        saveWork();
        safeSyncApply();
        focusChoiceSearch(key, "course");
        return;
      }

      const courseButton = event.target.closest("[data-choice-course]");
      if (courseButton) {
        const key = courseButton.getAttribute("data-choice-course");
        if (!choiceKeys.includes(key)) return;
        const course = String(courseButton.getAttribute("data-course-name") || "").trim();
        state.apply[key] = course;
        choiceSearch[key].course = course;
        state.apply.facultyName = summarizeChoiceFaculties();
        saveWork();
        safeSyncApply();
        closeChoicePanels();
      }
    });

    const refreshChoiceInput = debounce((event) => {
      const facultySearchInput = event.target.closest("[data-choice-faculty-search]");
      const courseSearchInput = event.target.closest("[data-choice-course-search]");
      const facultyInput = event.target.closest("[data-choice-manual-faculty]");
      const courseInput = event.target.closest("[data-choice-manual-course]");
      if (facultySearchInput) {
        const key = facultySearchInput.getAttribute("data-choice-faculty-search");
        if (!choiceKeys.includes(key)) return;
        const faculty = String(facultySearchInput.value || "").trim();
        choiceSearch[key].faculty = faculty;
        state.apply[choiceFacultyKey(key)] = faculty;
        if (!getFacultyRecord(asArray(chosenInstitution?.faculties), faculty)) {
          choiceSearch[key].course = state.apply[key] || "";
        }
        state.apply.facultyName = summarizeChoiceFaculties();
        setValue(choiceFacultyKey(key), faculty);
        syncApplyDraftFromFields();
        renderChoicePicker(key, asArray(chosenInstitution?.faculties), Boolean(asArray(chosenInstitution?.faculties).length));
        focusChoiceSearch(key, "faculty");
        return;
      }
      if (courseSearchInput) {
        const key = courseSearchInput.getAttribute("data-choice-course-search");
        if (!choiceKeys.includes(key)) return;
        const course = String(courseSearchInput.value || "").trim();
        choiceSearch[key].course = course;
        state.apply[key] = course;
        setValue(key, course);
        syncApplyDraftFromFields();
        renderChoicePicker(key, asArray(chosenInstitution?.faculties), Boolean(asArray(chosenInstitution?.faculties).length));
        focusChoiceSearch(key, "course");
        return;
      }
      if (facultyInput) {
        const key = facultyInput.getAttribute("data-choice-manual-faculty");
        if (!choiceKeys.includes(key)) return;
        state.apply[choiceFacultyKey(key)] = String(facultyInput.value || "").trim();
        state.apply.facultyName = summarizeChoiceFaculties();
        setValue(choiceFacultyKey(key), state.apply[choiceFacultyKey(key)]);
        setText(`${key}Summary`, state.apply[key] || (state.apply[choiceFacultyKey(key)] ? "Choose a course" : "Choose faculty first"));
        setText(`${key}Meta`, state.apply[choiceFacultyKey(key)] || "Manual entry is available for this institution.");
        syncApplyDraftFromFields();
        return;
      }
      if (courseInput) {
        const key = courseInput.getAttribute("data-choice-manual-course");
        if (!choiceKeys.includes(key)) return;
        state.apply[key] = String(courseInput.value || "").trim();
        setValue(key, state.apply[key]);
        setText(`${key}Summary`, state.apply[key] || "Choose a course");
        setText(`${key}Meta`, state.apply[choiceFacultyKey(key)] || "Manual entry is available for this institution.");
        syncApplyDraftFromFields();
      }
    }, 180);
    document.addEventListener("input", (event) => {
      const field = event.target.closest("[data-choice-faculty-search], [data-choice-course-search], [data-choice-manual-faculty], [data-choice-manual-course]");
      if (!field) return;
      const facultyKey = field.getAttribute("data-choice-faculty-search") || field.getAttribute("data-choice-manual-faculty");
      const courseKey = field.getAttribute("data-choice-course-search") || field.getAttribute("data-choice-manual-course");
      const key = facultyKey || courseKey;
      if (!choiceKeys.includes(key)) return;
      const value = String(field.value || "").trim();
      if (facultyKey) {
        state.apply[choiceFacultyKey(key)] = value;
        if (field.hasAttribute("data-choice-faculty-search")) choiceSearch[key].faculty = value;
        setValue(choiceFacultyKey(key), value);
      } else {
        state.apply[key] = value;
        if (field.hasAttribute("data-choice-course-search")) choiceSearch[key].course = value;
        setValue(key, value);
      }
      state.apply.facultyName = summarizeChoiceFaculties();
      saveWork();
      refreshChoiceInput(event);
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
          faculty: summarizeChoiceFaculties(),
          choice1Faculty: getChoiceFaculty("choice1"),
          choice2Faculty: getChoiceFaculty("choice2"),
          choice3Faculty: getChoiceFaculty("choice3"),
          choice1: String(state.apply.choice1 || "").trim(),
          choice2: String(state.apply.choice2 || "").trim(),
          choice3: String(state.apply.choice3 || "").trim(),
          choiceDetails: choiceDetailsFromState(),
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
      const missingChoice = item.choiceDetails.find((choice) => !choice.faculty || !choice.course);
      if (!item.institutionName || missingChoice) {
        const choiceLabel = missingChoice ? `Type choice ${missingChoice.choice}` : "the institution";
        showNotice(`Complete ${choiceLabel}: choose a faculty first, then a course.`, "warn");
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
        resetApplyChoices();
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
        resetApplyChoices();
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
        faculty: summarizeChoiceFaculties(),
        year: String(state.apply.year || chosen?.year || currentYear).trim(),
        status: String(chosen?.status || "").trim()
      }, `${institutionName} saved to your Kagie favorites.`);
    }));

    on("saveCourseFavoriteBtn", "click", async (event) => withActionLock(event.currentTarget, "save-course-favorite", "Saving...", async () => {
      const chosen = chosenInstitution || applyMatches.find((item) => item.name === state.apply.institutionName) || null;
      const institutionName = String(state.apply.institutionName || chosen?.name || "").trim();
      const course = String(state.apply.choice1 || "").trim();
      if (!institutionName || !course) {
        showNotice("Select an institution and complete Type choice 1 before saving a course.", "warn");
        (!institutionName ? $("institutionName") : $("choice1Trigger"))?.focus();
        return;
      }
      await saveFavoriteEntry({
        type: "course",
        institutionId: String(chosen?.id || "").trim(),
        institutionName,
        province: String(state.apply.province || chosen?.province || "").trim(),
        institutionType: String(state.apply.institutionType || chosen?.type || "").trim(),
        faculty: getChoiceFaculty("choice1"),
        course,
        year: String(state.apply.year || chosen?.year || currentYear).trim(),
        status: String(chosen?.status || "").trim()
      }, `${course} at ${institutionName} saved to your Kagie favorites.`);
    }));

    on("addInstitutionBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, "add-institution", "Adding...", () => addCurrentInstitutionToDraft());
    });

    on("editPackageBtn", "click", async () => {
      state.current = "pack";
      saveWork();
      renderAll();
      scrollToFormStart();
    });

    const cartSafeId = (value) => String(value || "").trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
    const normalizeCartInstitutionLimit = (value) => {
      if (value === Infinity || value === "unlimited") return "unlimited";
      const numeric = Number(value || 0);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
    };
    const buildCartPackageSnapshot = (packChoice, applicationType, applicationTypeLabel, institutionLimit) => {
      const id = packageId(packChoice);
      const price = Number(packChoice?.price ?? packChoice?.packPrice ?? 0);
      return {
        ...clone(packChoice || {}),
        id,
        packageId: id,
        code: packChoice?.code || packChoice?.id || id,
        remoteId: packChoice?.remoteId || "",
        level: packChoice?.level || packChoice?.packageLevel || packChoice?.package_level || "",
        name: packChoice?.name || packChoice?.packName || "Application Pack",
        packName: packChoice?.name || packChoice?.packName || "Application Pack",
        price,
        packPrice: price,
        institutionLimit,
        limit: institutionLimit,
        applicationType,
        applicationTypeLabel
      };
    };
    const buildCartFormValues = ({ applicationType, applicationTypeLabel, institutions, learner, parentData, school, marks, packageSnapshot, currentValues }) => ({
      applicationType: {
        type: applicationType,
        label: applicationTypeLabel
      },
      package: clone(packageSnapshot),
      learner: clone(learner),
      parent: clone(parentData),
      school: clone(school),
      marks: {
        subjects: clone(marks)
      },
      apply: clone(state.apply),
      institutions: clone(institutions),
      current: clone(currentValues)
    });
    const buildPackCartPayload = (packChoice, options = {}) => {
      const applicationType = normalizeApplicationType(options.applicationType || state.applicationType || "undergraduate") || "undergraduate";
      const applicationTypeLabel = options.applicationTypeLabel || applicationTypeLabelFor(applicationType, "Application");
      const cartIdSuffix = cartSafeId(options.cartIdSuffix || `${draft.id}_${applicationType}`) || cartSafeId(draft.id);
      const institutions = asArray(options.institutions ?? state.institutions);
      const limit = options.institutionLimit ?? packageLimit(packChoice);
      const normalizedLimit = normalizeCartInstitutionLimit(limit);
      const learner = clone(options.learner || state.learner);
      const parentData = clone(options.parentData || state.parent);
      const school = clone(options.school || state.school);
      const marks = clone(options.marks || state.marks);
      const packageSnapshot = buildCartPackageSnapshot(packChoice, applicationType, applicationTypeLabel, normalizedLimit);
      const currentValues = options.formValues === undefined
        ? {
          learner,
          parent: parentData,
          school,
          marks: { subjects: marks },
          apply: clone(state.apply)
        }
        : options.formValues;
      const formValues = buildCartFormValues({
        applicationType,
        applicationTypeLabel,
        institutions,
        learner,
        parentData,
        school,
        marks,
        packageSnapshot,
        currentValues
      });
      return {
        id: `pack_${cartIdSuffix}`,
        clientKey: `pack_${cartIdSuffix}`,
        type: "application_pack",
        applicationId: options.applicationId || draft.id,
        applicationType,
        applicationTypeLabel,
        packageId: packageSnapshot.packageId,
        packageCode: packageSnapshot.code,
        code: packageSnapshot.code,
        remoteId: packageSnapshot.remoteId,
        level: packageSnapshot.level,
        name: packageSnapshot.name,
        packName: packageSnapshot.packName,
        price: packageSnapshot.price,
        packPrice: packageSnapshot.packPrice,
        institutionLimit: normalizedLimit,
        institutionCount: institutions.length,
        institutions: clone(institutions),
        learner,
        learnerDetails: clone(learner),
        parentData,
        school,
        marks,
        formValues,
        forms: clone(formValues),
        package: clone(packageSnapshot),
        selectedPackage: clone(packageSnapshot),
        syncState: "syncing"
      };
    };

    const syncSelectedPackCartItem = async (packChoiceArg, options = {}) => {
      const packChoice = packChoiceArg || selectedPack();
      if (!packChoice) return null;
      if (!api.addCartItem && !api.addCartItemAsync && !api.replaceApplicationPackCartItemAsync) {
        throw new Error("Kagie cart service is not available yet.");
      }
      const cartPayload = buildPackCartPayload(packChoice, options);
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

    const syncLatePackageCartItem = async (packChoiceArg) => {
      const pkg = packChoiceArg || latePackage();
      if (!pkg) return null;
      const personal = state.lateApplication.personal || {};
      const details = state.lateApplication.details || {};
      const selectedCourses = lateSelectedCourses();
      const selectedInstitutions = lateSelectedInstitutions().map((item) => ({
        id: `late_${item.id}`,
        institutionName: item.name,
        institutionType: item.type,
        province: item.province,
        institutionStatus: item.status,
        choice1: selectedCourses.filter((course) => course.instId === item.id)[0]?.name || "",
        choice2: selectedCourses.filter((course) => course.instId === item.id)[1]?.name || "",
        choice3: selectedCourses.filter((course) => course.instId === item.id)[2]?.name || "",
        programme: selectedCourses.filter((course) => course.instId === item.id).map((course) => course.name).join(" | "),
        applicationType: "late"
      }));
      return syncSelectedPackCartItem(pkg, {
        applicationType: "late",
        applicationTypeLabel: "Late Applications",
        cartIdSuffix: `${draft.id}_late`,
        institutionLimit: pkg.limit === Infinity ? "unlimited" : pkg.limit,
        institutions: selectedInstitutions,
        learner: {
          ...personal,
          fullNames: personal.fullName || state.learner.fullNames,
          surname: personal.surname || state.learner.surname,
          cellphone: personal.phone || details.phone || state.learner.cellphone,
          email: personal.email || details.email || state.learner.email
        },
        school: {
          schoolName: personal.schoolName || state.school.schoolName,
          schoolProvince: personal.province || state.school.schoolProvince,
          completionYear: personal.examYear || state.school.completionYear,
          educationLevel: personal.educationLevel || details.educationLevel || ""
        },
        marks: state.marks,
        formValues: clone(state.lateApplication)
      });
    };

    const syncDynamicPackageCartItem = async (packChoiceArg) => {
      const definition = dynamicDefinition();
      const pkg = packChoiceArg || dynamicPackage();
      if (!pkg || !definition) return null;
      const values = clone(state.dynamicApplication.values || {});
      const { institution, programme } = dynamicApplicationMeta();
      const institutions = institution ? [{
        id: `${definition.type}_${cartSafeId(institution || definition.type)}`,
        institutionName: institution,
        institutionType: definition.label,
        faculty: values.faculty || "",
        choice1: programme,
        programme,
        applicationType: definition.type
      }] : [];
      return syncSelectedPackCartItem(pkg, {
        applicationType: definition.type,
        applicationTypeLabel: definition.label,
        cartIdSuffix: `${draft.id}_${definition.type}`,
        institutionLimit: packageLimit(pkg),
        institutions,
        learner: state.learner,
        parentData: state.parent,
        school: state.school,
        marks: state.marks,
        formValues: clone(state.dynamicApplication)
      });
    };

    const CART_READY_LABEL = "Continue to checkout";
    const FINAL_DETAILS_LABEL = "Submit completed details";
    const paidApplicationAwaitingDetails = () => applicationPaymentHasStarted();
    const cartReadyLabel = () => paidApplicationAwaitingDetails() ? FINAL_DETAILS_LABEL : CART_READY_LABEL;
    const firstIncompleteFinalStep = () => {
      if (!complete("learner")) return "learner";
      if (!complete("parent")) return "parent";
      if (!complete("school")) return "school";
      if (!complete("marks")) return "marks";
      if (!selectedPack()) return "pack";
      if (!state.institutions.length || !isWithinSelectedPackLimit()) return "apply";
      return "";
    };
    const syncCartButtonLabel = () => {
      const button = $("goCartBtn");
      if (!button || button.disabled) return;
      button.textContent = cartReadyLabel();
    };
    const withCartButtonState = (label, busy) => {
      const button = $("goCartBtn");
      if (!button) return;
      button.disabled = !!busy;
      button.textContent = label;
    };

    const submitCompletedApplicationDetails = async () => {
      withCartButtonState("Checking details...", true);
      syncApplyDraftFromFields();
      const firstIncomplete = firstIncompleteFinalStep();
      if (firstIncomplete) {
        state.current = firstIncomplete;
        renderAll();
        withCartButtonState(cartReadyLabel(), false);
        showNotice("Complete all required information before final submission.", "warn");
        return;
      }

      try {
        withCartButtonState("Submitting details...", true);
        const fullySaved = await saveAll();
        const submittedAt = new Date().toISOString();
        const selectedPackage = selectedPack();
        const finalApplicationType = draftApplicationType();
        const finalApplicationTypeLabel = applicationTypeLabelFor(finalApplicationType);
        const detailPatch = {
          forms: {
            ...(draft.forms || {}),
            learner: clone(state.learner),
            parent: clone(state.parent),
            school: clone(state.school),
            marks: { subjects: clone(state.marks) },
            applicationType: {
              type: finalApplicationType,
              label: finalApplicationTypeLabel
            }
          },
          institutions: clone(state.institutions),
          applicationType: finalApplicationType,
          applicationTypeLabel: finalApplicationTypeLabel,
          package: selectedPackage,
          selectedPackage
        };
        const updatedDetails = api.updateApplicationAsync
          ? await api.updateApplicationAsync(draft.id, detailPatch)
          : api.updateApplication(draft.id, detailPatch);
        const submitted = api.submitApplicationDetailsAsync
          ? await api.submitApplicationDetailsAsync(draft.id)
          : (api.updateApplicationAsync
            ? await api.updateApplicationAsync(draft.id, { status: "Submitted", submittedAt })
            : api.updateApplication(draft.id, { status: "Submitted", submittedAt }));
        applyDraftSnapshot(submitted || updatedDetails || { ...draft, ...detailPatch, status: "Submitted", submittedAt });
        showNotice(
          fullySaved
            ? "Application details submitted. Kagie will review your completed application."
            : "Application details submitted from your saved browser copy. Kagie will finish live sync shortly.",
          fullySaved ? "success" : "warn"
        );
        window.setTimeout(() => {
          window.location.href = "Dashboard.html";
        }, 700);
      } catch (error) {
        console.error(error);
        withCartButtonState(cartReadyLabel(), false);
        showNotice(`Kagie could not submit the completed details yet: ${error.message}`, "warn");
      }
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
            withCartButtonState(cartReadyLabel(), false);
            return;
          }
        } else if (pending.isPartial) {
          console.warn("Kagie checkout is skipping an unfinished institution draft. The browser copy remains available for dashboard completion.", pending.item);
        }
      }

      const packChoice = selectedPack();
      if (!packChoice) {
        withCartButtonState(cartReadyLabel(), false);
        showNotice("Choose a package first.", "warn");
        state.current = "pack";
        renderAll();
        return;
      }
      if (packChoice.institutionLimit !== "unlimited" && state.institutions.length > Number(packChoice.institutionLimit)) {
        withCartButtonState(cartReadyLabel(), false);
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
        withCartButtonState(cartReadyLabel(), false);
        showNotice(`Kagie could not add this package to cart yet: ${error.message}`, "warn");
      }
    };

    on("goCartBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, paidApplicationAwaitingDetails() ? "submit-details" : "go-cart", paidApplicationAwaitingDetails() ? "Submitting..." : "Preparing...", () => (
        paidApplicationAwaitingDetails() ? submitCompletedApplicationDetails() : addPackageToCartAndRedirect()
      ));
    });

    on("packSummaryCard", "click", async (event) => {
      const checkoutButton = event.target.closest("[data-pack-checkout]");
      const detailsButton = event.target.closest("[data-pack-details]");
      if (detailsButton) {
        await go("learner");
        return;
      }
      if (!checkoutButton) return;
      await withActionLock(checkoutButton, "pack-checkout", "Preparing...", () => addPackageToCartAndRedirect({ ignorePendingInstitutionDraft: true }));
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
        if (state.current === "type") {
          window.location.href = "home.html";
          return;
        }
        const i = steps.findIndex((step) => step.key === state.current);
        if (i === 0) {
          state.current = "type";
          saveWork({ immediate: true });
          renderAll();
          scrollToFormStart();
          return;
        }
        if (i > 0) await go(steps[i - 1].key);
      });
    });

    on("nextBtn", "click", async (event) => {
      await withActionLock(event.currentTarget, state.current === "apply" ? "go-cart" : "next-step", state.current === "apply" ? "Preparing..." : "Saving...", async () => {
        if (state.current === "type") {
          await openSelectedApplicationType();
          return;
        }
        if (state.current !== "apply") {
          const i = steps.findIndex((step) => step.key === state.current);
          if (i < steps.length - 1) await go(steps[i + 1].key);
          return;
        }
        await addPackageToCartAndRedirect();
      });
    });

    hydratePaidApplicationResume();
    if (!applicationPaymentHasStarted()) {
      if (state.current === "late" && ["package", "institutions"].includes(requestedSection)) {
        state.lateApplication.currentStep = requestedSection === "package" ? 3 : 4;
      }
      if (state.current === "dynamic" && ["package", "institutions"].includes(requestedSection)) {
        state.dynamicApplication.currentStep = requestedSection === "package" ? 1 : 3;
      }
    }
    renderAll();
    learnerSupportReady = learnerSupportRequest.then((latest) => {
      supportFields.forEach((name) => {
        if ((saved.learner?.[name] != null && !pendingSupportFields.has(name)) || editedSupportFields.has(name) || latest[name] == null) return;
        state.learner[name] = latest[name];
      });
      learnerSupportLoaded = true;
      if (state.learner.hasDisability !== "yes") state.learner.disabilityDescription = "";
      if (state.current === "learner") renderFields("learnerFields", "learner");
      queueMinorRender();
      saveWork({ immediate: true });
    });
    scheduleProfileAutoSave(0);
    loadFavorites().then(() => {
      if (state.current === "apply") renderFavorites();
    });
    refreshPackCatalog();
    if (api.getInstitutionCatalogAsync) {
      api.getInstitutionCatalogAsync({ includeInactive: false, canApplyOnly: true })
        .then((records) => {
          if (!asArray(records).length) return;
          refreshCatalogBindings();
          if (state.current === "apply" || state.current === "school") renderAll();
        })
        .catch((error) => {
          console.warn("Kagie live institution catalog fallback:", error);
        });
    }
    if (state.current === "school" || state.current === "apply") {
      ensureNationalCatalogLoaded().then((loaded) => {
        if (loaded && (state.current === "school" || state.current === "apply")) renderAll();
      });
    }
    if (saved && Object.keys(saved).length) showNotice("Your last working draft was restored so you can continue from where you stopped.", "info");
  }

  const start = () => {
    const revealLoadedIcons = () => {
      document.fonts?.load('24px "Material Icons Outlined"').then((fonts) => {
        if (fonts.length) document.documentElement.classList.add("icons-ready");
      }).catch(() => {});
    };
    const iconStyles = $("kagieIconStyles");
    if (iconStyles?.sheet) revealLoadedIcons();
    else iconStyles?.addEventListener("load", revealLoadedIcons, { once: true });
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
