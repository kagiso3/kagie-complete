(function kagieCvRevampBuilder() {
  "use strict";

  if (window.KagieCvRevampBuilder) return;

  var VERSION = "20261013-unity";
  var DRAFT_KEY_ROOT = "kagie.cv-builder.draft.v1";
  var RECENTS_KEY_ROOT = "kagie.cv-builder.recents.v1";
  var AUTOSAVE_DELAY = 650;
  var renderTimer = null;
  var autosaveTimer = null;
  var toastTimer = null;
  var observer = null;
  var hydrationPromise = null;

  var steps = [
    { id: "template", label: "Template", hint: "Choose your design", marker: "1" },
    { id: "personal", label: "Personal Info", hint: "Your contact details", marker: "2" },
    { id: "summary", label: "Summary", hint: "Professional overview", marker: "3" },
    { id: "experience", label: "Work Experience", hint: "Your work history", marker: "▣" },
    { id: "education", label: "Education", hint: "Your academic background", marker: "◇" },
    { id: "skills", label: "Skills", hint: "Your key skills", marker: "✣" },
    { id: "certifications", label: "Certifications", hint: "Your certifications", marker: "♙" },
    { id: "languages", label: "Languages", hint: "Languages you speak", marker: "◎" },
    { id: "references", label: "References", hint: "Professional references", marker: "♧" },
    { id: "additional", label: "Additional Info", hint: "Awards, projects, interests", marker: "▧" },
    { id: "preview", label: "Preview & Download", hint: "Review and export", marker: "↓" },
  ];

  var templates = [
    { id: "charcoal", label: "Charcoal" },
    { id: "ocean", label: "Ocean" },
    { id: "midnight", label: "Midnight" },
    { id: "emerald", label: "Emerald" },
    { id: "ivory", label: "Ivory" },
  ];

  function cvbUid(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function cvbDefaultState() {
    return {
      activeStep: "personal",
      template: "charcoal",
      previewMode: "desktop",
      lastSavedAt: null,
      userHydrated: false,
      profilePhoto: "",
      personal: {
        fullName: "",
        title: "",
        email: "",
        phone: "",
        location: "South Africa",
        linkedin: "",
        website: "",
      },
      summary: "",
      experiences: [
        {
          id: cvbUid("exp"),
          jobTitle: "",
          company: "",
          from: "",
          to: "",
          current: false,
          achievements: "",
        },
      ],
      education: [
        {
          id: cvbUid("edu"),
          degree: "",
          institution: "",
          from: "",
          to: "",
        },
      ],
      skills: [],
      certifications: "",
      languages: "",
      references: "",
      additional: "",
    };
  }

  function cvbClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cvbReadJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function cvbCurrentUserId() {
    try {
      var api = window.KagieAPI;
      var user = api && api.getCurrentUser ? api.getCurrentUser() : null;
      return user && user.id
        ? String(user.id).replace(/[^a-z0-9_-]/gi, "_")
        : "guest";
    } catch (error) {
      return "guest";
    }
  }

  function cvbScopedKey(root) {
    return root + "." + cvbCurrentUserId();
  }

  function cvbMergeDraft(draft) {
    var base = cvbDefaultState();
    if (!draft || typeof draft !== "object") return base;
    var merged = Object.assign(base, draft);
    merged.personal = Object.assign(base.personal, draft.personal || {});
    merged.experiences =
      Array.isArray(draft.experiences) && draft.experiences.length
        ? draft.experiences
        : base.experiences;
    merged.education =
      Array.isArray(draft.education) && draft.education.length
        ? draft.education
        : base.education;
    merged.skills =
      Array.isArray(draft.skills) && draft.skills.length ? draft.skills : base.skills;
    return merged;
  }

  var state = cvbMergeDraft(cvbReadJson(cvbScopedKey(DRAFT_KEY_ROOT), null));

  function cvbEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#2d9df9;");
  }

  function cvbAttr(value) {
    return cvbEscape(value).replace(/`/g, "&#096;");
  }

  function cvbIsRoute() {
    return /^#kh-cv-builder(?:$|\?)/.test(String(window.location.hash || ""));
  }

  function cvbInitials() {
    var name = String(state.personal.fullName || "Kagie User").trim();
    return (
      name
        .split(/\s+/)
        .slice(0, 2)
        .map(function initialsPart(part) {
          return part.charAt(0).toUpperCase();
        })
        .join("") || "KU"
    );
  }

  function cvbSafeFilename() {
    return (
      String(state.personal.fullName || "Kagie")
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() + "-cv"
    );
  }

  function cvbLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map(function trimLine(line) {
        return line.trim();
      })
      .filter(Boolean);
  }

  function cvbCalculateAts() {
    var personalFields = [
      state.personal.fullName,
      state.personal.title,
      state.personal.email,
      state.personal.phone,
      state.personal.location,
    ];
    var score =
      (personalFields.filter(Boolean).length / personalFields.length) * 20;
    score +=
      ((state.personal.linkedin ? 1 : 0) + (state.personal.website ? 1 : 0)) * 3;
    score += Math.min(String(state.summary || "").trim().length / 120, 1) * 18;
    score += state.experiences.some(function hasExperience(item) {
      return item.jobTitle && item.company && item.achievements;
    })
      ? 20
      : 0;
    score += state.education.some(function hasEducation(item) {
      return item.degree && item.institution;
    })
      ? 14
      : 0;
    score += Math.min(state.skills.filter(Boolean).length / 5, 1) * 14;
    score += state.certifications.trim() ? 3 : 0;
    score += state.languages.trim() ? 2 : 0;
    score += state.references.trim() ? 1 : 0;
    score += state.additional.trim() ? 2 : 0;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function cvbStepComplete(id) {
    if (id === "template") return Boolean(state.template);
    if (id === "personal") {
      return Boolean(
        state.personal.fullName && state.personal.email && state.personal.title
      );
    }
    if (id === "summary") return state.summary.trim().length >= 80;
    if (id === "experience") {
      return state.experiences.some(function completeExperience(item) {
        return item.jobTitle && item.company;
      });
    }
    if (id === "education") {
      return state.education.some(function completeEducation(item) {
        return item.degree && item.institution;
      });
    }
    if (id === "skills") return state.skills.filter(Boolean).length >= 3;
    if (id === "certifications") return Boolean(state.certifications.trim());
    if (id === "languages") return Boolean(state.languages.trim());
    if (id === "references") return Boolean(state.references.trim());
    if (id === "additional") return Boolean(state.additional.trim());
    if (id === "preview") return cvbCalculateAts() >= 70;
    return false;
  }

  function cvbInputField(label, path, value, type, extra) {
    return (
      '<label class="kh-cvb-editor__field">' +
      '<span class="kh-cvb-editor__label">' +
      cvbEscape(label) +
      "</span>" +
      '<input class="kh-cvb-editor__input" type="' +
      cvbAttr(type || "text") +
      '" data-cvb-field="' +
      cvbAttr(path) +
      '" value="' +
      cvbAttr(value) +
      '" ' +
      (extra || "") +
      ">" +
      "</label>"
    );
  }

  function cvbPhotoHtml(className) {
    if (state.profilePhoto) {
      return (
        '<img class="' +
        cvbAttr(className) +
        '" src="' +
        cvbAttr(state.profilePhoto) +
        '" alt="' +
        cvbAttr(state.personal.fullName || "Profile") +
        '">'
      );
    }
    return (
      '<span class="' +
      cvbAttr(className + " kh-cvb-avatar-fallback") +
      '" aria-hidden="true">' +
      cvbEscape(cvbInitials()) +
      "</span>"
    );
  }

  function cvbIsMoreServicePage() {
    return String(window.location.pathname || "")
      .replace(/\\/g, "/")
      .toLowerCase()
      .indexOf("/more-service/") > -1;
  }

  function cvbPageHref(path) {
    var targetPath = String(path || "home.html");
    if (/^(https?:|mailto:|tel:|#)/i.test(targetPath)) {
      return targetPath;
    }
    if (!cvbIsMoreServicePage()) {
      return targetPath;
    }
    if (targetPath.indexOf("more-service/") === 0) {
      return targetPath.replace(/^more-service\//, "");
    }
    return "../" + targetPath;
  }

  function cvbTopbarHtml() {
    return (
      '<header class="kh-cvb__topbar">' +
      '<button class="kh-cvb__back-app" type="button" data-cvb-action="back" aria-label="Back to CV Revamp">‹</button>' +
      '<a class="kh-cvb__brand" href="#kh-cv" aria-label="Back to Career Hub CV Revamp">' +
      '<span class="kh-cvb__brand-mark">K</span>' +
      '<span class="kh-cvb__brand-name">Kagie<span> Career Hub</span></span>' +
      "</a>" +
      '<div class="kh-cvb__screen-title"><strong>CV Builder</strong><span>Build and download your CV</span></div>' +
      '<div class="kh-cvb__account">' +
      '<a class="kh-cvb__notification" href="' +
      cvbPageHref("notifications.html") +
      '" aria-label="Notifications">!</a>' +
      cvbPhotoHtml("kh-cvb__account-photo") +
      '<strong class="kh-cvb__account-name">' +
      cvbEscape(state.personal.fullName || "Kagie User") +
      "</strong>" +
      "</div>" +
      "</header>"
    );
  }

  function cvbPageHeadHtml() {
    return (
      '<section class="kh-cvb__pagehead">' +
      '<div class="kh-cvb__pagehead-copy">' +
      '<div class="kh-cvb__breadcrumb">' +
      '<button type="button" data-cvb-action="back" aria-label="Back to CV Revamp">Back</button>' +
      '<a href="#kh-cv">CV Revamp</a><span>›</span><strong>CV Builder</strong>' +
      "</div>" +
      '<div class="kh-cvb__heading-row">' +
      '<h1 class="kh-cvb__title" id="kh-page-title">CV Builder <span class="kh-cvb__verified">✓</span></h1>' +
      '<p class="kh-cvb__subtitle">Create, preview and download a professional CV.</p>' +
      "</div>" +
      "</div>" +
      '<div class="kh-cvb__head-actions">' +
      '<span class="kh-cvb__autosave" id="cvb-autosave"><i>✓</i> ' +
      (state.lastSavedAt ? "Auto-saved just now" : "Ready to auto-save") +
      "</span>" +
      '<button class="kh-cvb__btn kh-cvb__btn--secondary" type="button" data-cvb-action="save">Save Draft</button>' +
      '<button class="kh-cvb__btn kh-cvb__btn--primary" type="button" data-cvb-action="continue">Continue <span>→</span></button>' +
      "</div>" +
      "</section>"
    );
  }

  function cvbStepsHtml() {
    return (
      '<aside class="kh-cvb__panel kh-cvb-steps" aria-label="CV sections">' +
      steps
        .map(function renderStep(step) {
          var current = state.activeStep === step.id;
          var complete = cvbStepComplete(step.id);
          return (
            '<button class="kh-cvb-steps__item' +
            (current ? " kh-cvb-steps__item--current" : "") +
            (complete ? " kh-cvb-steps__item--complete" : "") +
            '" type="button" data-cvb-step="' +
            cvbAttr(step.id) +
            '">' +
            '<span class="kh-cvb-steps__marker">' +
            cvbEscape(step.marker) +
            "</span>" +
            '<span class="kh-cvb-steps__copy"><strong class="kh-cvb-steps__label">' +
            cvbEscape(step.label) +
            '</strong><small class="kh-cvb-steps__hint">' +
            cvbEscape(step.hint) +
            "</small></span>" +
            '<span class="kh-cvb-steps__status">' +
            (complete ? "✓" : "") +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</aside>"
    );
  }

  function cvbExperienceHtml() {
    return state.experiences
      .map(function renderExperience(item, index) {
        return (
          '<article class="kh-cvb-editor__repeat-card">' +
          '<span class="kh-cvb-editor__drag" aria-hidden="true">⋮⋮</span>' +
          '<div class="kh-cvb-editor__repeat-grid">' +
          '<label class="kh-cvb-editor__field"><span class="kh-cvb-editor__label">Job Title</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-exp-index="' +
          index +
          '" data-cvb-exp-field="jobTitle" value="' +
          cvbAttr(item.jobTitle) +
          '"></label>' +
          '<label class="kh-cvb-editor__field"><span class="kh-cvb-editor__label">Company</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-exp-index="' +
          index +
          '" data-cvb-exp-field="company" value="' +
          cvbAttr(item.company) +
          '"></label>' +
          '<label class="kh-cvb-editor__field kh-cvb-editor__field--short"><span class="kh-cvb-editor__label">From</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-exp-index="' +
          index +
          '" data-cvb-exp-field="from" value="' +
          cvbAttr(item.from) +
          '"></label>' +
          '<label class="kh-cvb-editor__field kh-cvb-editor__field--short"><span class="kh-cvb-editor__label">To</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-exp-index="' +
          index +
          '" data-cvb-exp-field="to" value="' +
          cvbAttr(item.to) +
          '" ' +
          (item.current ? "disabled" : "") +
          "></label>" +
          '<label class="kh-cvb-editor__current"><input type="checkbox" data-cvb-exp-index="' +
          index +
          '" data-cvb-exp-field="current" ' +
          (item.current ? "checked" : "") +
          "> I currently work here</label>" +
          '<button class="kh-cvb-editor__delete" type="button" data-cvb-action="delete-experience" data-cvb-index="' +
          index +
          '" aria-label="Delete experience">♲</button>' +
          '<label class="kh-cvb-editor__field kh-cvb-editor__field--wide"><span class="kh-cvb-editor__label">Achievements</span>' +
          '<textarea class="kh-cvb-editor__textarea kh-cvb-editor__textarea--small" data-cvb-exp-index="' +
          index +
          '" data-cvb-exp-field="achievements">' +
          cvbEscape(item.achievements) +
          "</textarea></label>" +
          "</div></article>"
        );
      })
      .join("");
  }

  function cvbEducationHtml() {
    return state.education
      .map(function renderEducation(item, index) {
        return (
          '<article class="kh-cvb-editor__repeat-card kh-cvb-editor__repeat-card--education">' +
          '<span class="kh-cvb-editor__drag" aria-hidden="true">⋮⋮</span>' +
          '<div class="kh-cvb-editor__repeat-grid kh-cvb-editor__repeat-grid--education">' +
          '<label class="kh-cvb-editor__field"><span class="kh-cvb-editor__label">Degree / Qualification</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-edu-index="' +
          index +
          '" data-cvb-edu-field="degree" value="' +
          cvbAttr(item.degree) +
          '"></label>' +
          '<label class="kh-cvb-editor__field"><span class="kh-cvb-editor__label">Institution</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-edu-index="' +
          index +
          '" data-cvb-edu-field="institution" value="' +
          cvbAttr(item.institution) +
          '"></label>' +
          '<label class="kh-cvb-editor__field kh-cvb-editor__field--short"><span class="kh-cvb-editor__label">From</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-edu-index="' +
          index +
          '" data-cvb-edu-field="from" value="' +
          cvbAttr(item.from) +
          '"></label>' +
          '<label class="kh-cvb-editor__field kh-cvb-editor__field--short"><span class="kh-cvb-editor__label">To</span>' +
          '<input class="kh-cvb-editor__input" data-cvb-edu-index="' +
          index +
          '" data-cvb-edu-field="to" value="' +
          cvbAttr(item.to) +
          '"></label>' +
          '<button class="kh-cvb-editor__delete" type="button" data-cvb-action="delete-education" data-cvb-index="' +
          index +
          '" aria-label="Delete education">♲</button>' +
          "</div></article>"
        );
      })
      .join("");
  }

  function cvbEditorHtml() {
    return (
      '<form class="kh-cvb__panel kh-cvb-editor" id="cvb-editor-form" novalidate>' +
      '<div class="kh-cvb-editor__scroll">' +
      '<section class="kh-cvb-editor__section" id="cvb-section-personal" data-cvb-section="personal">' +
      '<div class="kh-cvb-editor__intro"><h2>Personal Information</h2><p>Add your personal details as you want them to appear on your CV.</p></div>' +
      '<div class="kh-cvb-editor__personal-grid">' +
      '<div class="kh-cvb-editor__photo"><span class="kh-cvb-editor__photo-label">Profile Photo</span>' +
      '<div class="kh-cvb-editor__portrait">' +
      cvbPhotoHtml("kh-cvb-editor__portrait-image") +
      "</div>" +
      '<input class="kh-cvb__visually-hidden" id="cvb-photo-input" type="file" accept="image/jpeg,image/png,image/webp">' +
      '<button class="kh-cvb-editor__photo-btn" type="button" data-cvb-action="choose-photo">↥ <span>Upload Photo</span></button>' +
      '<button class="kh-cvb-editor__photo-btn kh-cvb-editor__photo-btn--remove" type="button" data-cvb-action="remove-photo">♲ <span>Remove</span></button>' +
      "<small>JPG, PNG or WEBP. Max 5MB.</small></div>" +
      '<div class="kh-cvb-editor__details-grid">' +
      cvbInputField("Full Name", "personal.fullName", state.personal.fullName) +
      cvbInputField("Professional Title", "personal.title", state.personal.title) +
      cvbInputField("Email", "personal.email", state.personal.email, "email") +
      cvbInputField("Phone", "personal.phone", state.personal.phone, "tel") +
      cvbInputField("Location", "personal.location", state.personal.location) +
      cvbInputField("LinkedIn / Portfolio", "personal.linkedin", state.personal.linkedin) +
      cvbInputField("Website (Optional)", "personal.website", state.personal.website, "url") +
      "</div></div></section>" +
      '<section class="kh-cvb-editor__section" id="cvb-section-summary" data-cvb-section="summary">' +
      '<div class="kh-cvb-editor__section-head"><h2>Professional Summary</h2><span id="cvb-summary-count">' +
      String(state.summary || "").length +
      "/500</span></div>" +
      '<div class="kh-cvb-editor__toolbar" role="toolbar" aria-label="Summary formatting">' +
      '<button type="button" data-cvb-action="format-bold" aria-label="Bold"><strong>B</strong></button>' +
      '<button type="button" data-cvb-action="format-italic" aria-label="Italic"><em>I</em></button>' +
      '<button type="button" data-cvb-action="format-underline" aria-label="Underline"><u>U</u></button>' +
      '<span></span><button type="button" data-cvb-action="insert-bullet" aria-label="Insert bullet">☷</button>' +
      '<button type="button" data-cvb-action="insert-number" aria-label="Insert numbered item">≡</button>' +
      '<button type="button" data-cvb-action="format-link" aria-label="Insert link">↗</button>' +
      "</div>" +
      '<textarea class="kh-cvb-editor__textarea" id="cvb-summary" data-cvb-field="summary" maxlength="500">' +
      cvbEscape(state.summary) +
      "</textarea></section>" +
      '<section class="kh-cvb-editor__section" id="cvb-section-experience" data-cvb-section="experience">' +
      '<div class="kh-cvb-editor__section-head"><h2>Work Experience</h2></div>' +
      cvbExperienceHtml() +
      '<button class="kh-cvb-editor__add" type="button" data-cvb-action="add-experience">＋ <span>Add Experience</span></button>' +
      "</section>" +
      '<section class="kh-cvb-editor__section" id="cvb-section-education" data-cvb-section="education">' +
      '<div class="kh-cvb-editor__section-head"><h2>Education</h2></div>' +
      cvbEducationHtml() +
      '<button class="kh-cvb-editor__add" type="button" data-cvb-action="add-education">＋ <span>Add Education</span></button>' +
      "</section>" +
      '<section class="kh-cvb-editor__section kh-cvb-editor__section--compact" id="cvb-section-skills" data-cvb-section="skills">' +
      '<div class="kh-cvb-editor__section-head"><h2>Skills</h2><span>Separate each skill with a comma</span></div>' +
      '<textarea class="kh-cvb-editor__textarea kh-cvb-editor__textarea--small" data-cvb-field="skills">' +
      cvbEscape(state.skills.join(", ")) +
      "</textarea></section>" +
      '<section class="kh-cvb-editor__section kh-cvb-editor__section--compact" id="cvb-section-certifications" data-cvb-section="certifications">' +
      '<div class="kh-cvb-editor__section-head"><h2>Certifications</h2></div>' +
      '<textarea class="kh-cvb-editor__textarea kh-cvb-editor__textarea--small" data-cvb-field="certifications" placeholder="Certification name, issuer and year">' +
      cvbEscape(state.certifications) +
      "</textarea></section>" +
      '<section class="kh-cvb-editor__section kh-cvb-editor__section--compact" id="cvb-section-languages" data-cvb-section="languages">' +
      '<div class="kh-cvb-editor__section-head"><h2>Languages</h2></div>' +
      '<textarea class="kh-cvb-editor__textarea kh-cvb-editor__textarea--small" data-cvb-field="languages" placeholder="English — Fluent">' +
      cvbEscape(state.languages) +
      "</textarea></section>" +
      '<section class="kh-cvb-editor__section kh-cvb-editor__section--compact" id="cvb-section-references" data-cvb-section="references">' +
      '<div class="kh-cvb-editor__section-head"><h2>References</h2></div>' +
      '<textarea class="kh-cvb-editor__textarea kh-cvb-editor__textarea--small" data-cvb-field="references" placeholder="Name, role and contact details">' +
      cvbEscape(state.references) +
      "</textarea></section>" +
      '<section class="kh-cvb-editor__section kh-cvb-editor__section--compact" id="cvb-section-additional" data-cvb-section="additional">' +
      '<div class="kh-cvb-editor__section-head"><h2>Additional Information</h2></div>' +
      '<textarea class="kh-cvb-editor__textarea kh-cvb-editor__textarea--small" data-cvb-field="additional" placeholder="Awards, projects, volunteer work and interests">' +
      cvbEscape(state.additional) +
      "</textarea></section>" +
      "</div>" +
      '<footer class="kh-cvb-editor__footer"><button class="kh-cvb__btn kh-cvb__btn--secondary" type="button" data-cvb-action="save">Save Draft</button>' +
      '<button class="kh-cvb__btn kh-cvb__btn--primary" type="button" data-cvb-action="continue">Continue <span>→</span></button></footer>' +
      "</form>"
    );
  }

  function cvbTemplateHtml(template) {
    return (
      '<button class="kh-cvb-preview__template kh-cvb-preview__template--' +
      cvbAttr(template.id) +
      (state.template === template.id
        ? " kh-cvb-preview__template--selected"
        : "") +
      '" type="button" data-cvb-template="' +
      cvbAttr(template.id) +
      '" aria-label="Use ' +
      cvbAttr(template.label) +
      ' template">' +
      '<span class="kh-cvb-preview__template-paper"><i></i><b></b><em></em><small></small></span>' +
      (state.template === template.id
        ? '<span class="kh-cvb-preview__template-check">✓</span>'
        : "") +
      "</button>"
    );
  }

  function cvbPreviewDocumentHtml() {
    var firstExperience = state.experiences[0] || {};
    var firstEducation = state.education[0] || {};
    var skills = state.skills.filter(Boolean).slice(0, 8);
    return (
      '<article class="kh-cvb-doc kh-cvb-doc--' +
      cvbAttr(state.template) +
      '">' +
      '<aside class="kh-cvb-doc__aside">' +
      '<div class="kh-cvb-doc__portrait">' +
      cvbPhotoHtml("kh-cvb-doc__portrait-image") +
      "</div>" +
      '<ul class="kh-cvb-doc__contact">' +
      (state.personal.location
        ? "<li><span>●</span>" + cvbEscape(state.personal.location) + "</li>"
        : "") +
      (state.personal.phone
        ? "<li><span>⌕</span>" + cvbEscape(state.personal.phone) + "</li>"
        : "") +
      (state.personal.email
        ? "<li><span>✉</span>" + cvbEscape(state.personal.email) + "</li>"
        : "") +
      (state.personal.linkedin
        ? "<li><span>in</span>" + cvbEscape(state.personal.linkedin) + "</li>"
        : "") +
      (state.personal.website
        ? "<li><span>◉</span>" + cvbEscape(state.personal.website) + "</li>"
        : "") +
      "</ul>" +
      '<section class="kh-cvb-doc__skills"><h3>Skills</h3>' +
      skills
        .map(function renderPreviewSkill(skill, index) {
          return (
            "<div><span>" +
            cvbEscape(skill) +
            '</span><i><b style="width:' +
            Math.max(55, 92 - index * 5) +
            '%"></b></i></div>'
          );
        })
        .join("") +
      "</section></aside>" +
      '<div class="kh-cvb-doc__main">' +
      '<header class="kh-cvb-doc__header"><h2>' +
      cvbEscape(state.personal.fullName || "Your Name") +
      "</h2><p>" +
      cvbEscape(state.personal.title || "Professional Title") +
      "</p></header>" +
      '<section class="kh-cvb-doc__section"><h3>Professional Summary</h3><p>' +
      cvbEscape(state.summary || "Add a professional summary to introduce yourself.") +
      "</p></section>" +
      '<section class="kh-cvb-doc__section"><h3>Work Experience</h3>' +
      '<div class="kh-cvb-doc__timeline"><i></i><div><strong>' +
      cvbEscape(firstExperience.jobTitle || "Your role") +
      "</strong><span>" +
      cvbEscape(
        [
          firstExperience.company,
          firstExperience.from && firstExperience.to
            ? firstExperience.from + " – " + firstExperience.to
            : "",
        ]
          .filter(Boolean)
          .join(" · ")
      ) +
      "</span><ul>" +
      cvbLines(firstExperience.achievements)
        .slice(0, 3)
        .map(function renderAchievement(line) {
          return "<li>" + cvbEscape(line) + "</li>";
        })
        .join("") +
      "</ul></div></div></section>" +
      '<section class="kh-cvb-doc__section"><h3>Education</h3>' +
      '<div class="kh-cvb-doc__timeline"><i></i><div><strong>' +
      cvbEscape(firstEducation.degree || "Your qualification") +
      "</strong><span>" +
      cvbEscape(
        [
          firstEducation.institution,
          firstEducation.from && firstEducation.to
            ? firstEducation.from + " – " + firstEducation.to
            : "",
        ]
          .filter(Boolean)
          .join(" · ")
      ) +
      "</span></div></div></section>" +
      "</div></article>"
    );
  }

  function cvbPreviewHtml() {
    return (
      '<aside class="kh-cvb__panel kh-cvb-preview" id="cvb-section-preview" data-cvb-section="preview">' +
      '<div class="kh-cvb-preview__templates-head"><h2>Choose Template</h2><button type="button" data-cvb-action="show-templates">See all</button></div>' +
      '<div class="kh-cvb-preview__template-strip">' +
      templates.map(cvbTemplateHtml).join("") +
      "</div>" +
      '<div class="kh-cvb-preview__live-head"><h2>Live Preview</h2>' +
      '<div class="kh-cvb-preview__device-toggle" aria-label="Preview size">' +
      '<button class="' +
      (state.previewMode === "desktop" ? "is-active" : "") +
      '" type="button" data-cvb-preview-mode="desktop" aria-label="Desktop preview">▣</button>' +
      '<button class="' +
      (state.previewMode === "mobile" ? "is-active" : "") +
      '" type="button" data-cvb-preview-mode="mobile" aria-label="Mobile preview">▯</button>' +
      "</div></div>" +
      '<div class="kh-cvb-preview__canvas kh-cvb-preview__canvas--' +
      cvbAttr(state.previewMode) +
      '" id="cvb-preview-canvas">' +
      cvbPreviewDocumentHtml() +
      "</div>" +
      '<div class="kh-cvb-preview__downloads">' +
      '<button type="button" data-cvb-action="download-pdf"><span class="kh-cvb-preview__download-icon kh-cvb-preview__download-icon--pdf">PDF</span><strong>Download PDF</strong><small>Best for applications</small></button>' +
      '<button type="button" data-cvb-action="download-docx"><span class="kh-cvb-preview__download-icon kh-cvb-preview__download-icon--doc">W</span><strong>Download DOCX</strong><small>Editable file</small></button>' +
      '<button type="button" data-cvb-action="share"><span class="kh-cvb-preview__download-icon kh-cvb-preview__download-icon--share">↗</span><strong>Share Link</strong><small>Generate shareable link</small></button>' +
      '<button type="button" data-cvb-action="print"><span class="kh-cvb-preview__download-icon">▣</span><strong>Print</strong><small>Print your CV</small></button>' +
      "</div></aside>"
    );
  }

  function cvbRecentItemsHtml() {
    var recents = cvbReadJson(cvbScopedKey(RECENTS_KEY_ROOT), []);
    if (!Array.isArray(recents) || !recents.length) {
      recents = [
        { title: "Software Developer CV", updated: "Updated just now", type: "PDF" },
        { title: "Data Analyst CV", updated: "Updated 1 week ago", type: "W" },
      ];
    }
    return recents
      .slice(0, 2)
      .map(function renderRecent(item, index) {
        return (
          '<button type="button" data-cvb-action="load-recent" data-cvb-index="' +
          index +
          '"><span class="' +
          (item.type === "W" ? "is-word" : "") +
          '">' +
          cvbEscape(item.type || "PDF") +
          "</span><i><strong>" +
          cvbEscape(item.title || "Saved CV") +
          "</strong><small>" +
          cvbEscape(item.updated || "Saved draft") +
          "</small></i></button>"
        );
      })
      .join("");
  }

  function cvbInsightsHtml() {
    var score = cvbCalculateAts();
    return (
      '<section class="kh-cvb__insights" aria-label="CV insights">' +
      '<article class="kh-cvb-stat kh-cvb-stat--score"><h2>ATS Score</h2>' +
      '<div class="kh-cvb-stat__score"><span class="kh-cvb-stat__ring" style="--cvb-score:' +
      score +
      '"><i></i></span><div><strong id="cvb-ats-score">' +
      score +
      '%</strong><small>' +
      (score >= 85 ? "Excellent" : score >= 70 ? "Good" : "Needs work") +
      '</small></div><button type="button" data-cvb-action="ats-report">View full report →</button></div></article>' +
      '<article class="kh-cvb-stat kh-cvb-stat--tips"><span class="kh-cvb-stat__bulb">♙</span><div><h2>CV Tips</h2><p>Use action verbs, quantify your achievements and tailor your CV to the job description for higher impact.</p></div><button type="button" data-cvb-action="show-tips">View all tips →</button></article>' +
      '<article class="kh-cvb-stat kh-cvb-stat--ai"><span class="kh-cvb-stat__spark">✧</span><div><h2>AI Improve My CV</h2><p>Get free suggestions to improve your CV content, keywords and overall impact.</p></div><button type="button" data-cvb-action="improve">Improve My CV</button>' +
      '<input class="kh-cvb__visually-hidden" id="cvb-source-cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">' +
      '<label for="cvb-learner-note">What would you like help with?<textarea id="cvb-learner-note" maxlength="2000" placeholder="Tell your assistant about your goals or questions."></textarea></label>' +
      '<button class="kh-cvb-stat__review" type="button" data-cvb-action="request-review">Request free expert review</button></article>' +
      '<article class="kh-cvb-stat kh-cvb-stat--recent"><div class="kh-cvb-stat__recent-head"><h2>Recent CVs</h2><button type="button" data-cvb-action="show-recents">View all ›</button></div><div class="kh-cvb-stat__recent-list">' +
      cvbRecentItemsHtml() +
      "</div></article></section>"
    );
  }

  function cvbMobileNavHtml() {
    return (
      '<nav class="bottom-nav kagie-shared-bottom-nav kh-cvb-mobile-nav" aria-label="Primary">' +
      '<a class="bottom-nav-item" href="' +
      cvbPageHref("home.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">home</span><span class="bottom-nav-label">App Home</span></a>' +
      '<a class="bottom-nav-item active" href="#kh-cv" aria-current="page"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">business_center</span><span class="bottom-nav-label">Plan Career</span></a>' +
      '<a class="bottom-nav-item" href="' +
      cvbPageHref("recommendation.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">school</span><span class="bottom-nav-label">Match Courses</span></a>' +
      '<a class="bottom-nav-item" href="' +
      cvbPageHref("more-service/accommodation-assist.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">apartment</span><span class="bottom-nav-label">Housing</span></a>' +
      '<a class="bottom-nav-item" href="' +
      cvbPageHref("more-service/transport-assist.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">directions_bus</span><span class="bottom-nav-label">Transport</span></a>' +
      "</nav>"
    );
  }

  function cvbBuilderHtml() {
    return (
      '<a class="kh-cvb__skip" href="#cvb-editor-form">Skip to CV editor</a>' +
      cvbTopbarHtml() +
      '<main class="kh-cvb__workspace">' +
      cvbPageHeadHtml() +
      '<section class="kh-cvb__primary-row">' +
      cvbStepsHtml() +
      cvbEditorHtml() +
      cvbPreviewHtml() +
      "</section>" +
      cvbInsightsHtml() +
      "</main>" +
      cvbMobileNavHtml() +
      '<div class="kh-cvb-toast" id="cvb-toast" role="status" aria-live="polite"></div>'
    );
  }

  function cvbEnsureStyles() {
    if (document.getElementById("kh-cvb-styles")) return;
    var link = document.createElement("link");
    link.id = "kh-cvb-styles";
    link.rel = "stylesheet";
    var currentScript = document.currentScript;
    var source =
      currentScript && currentScript.src
        ? currentScript.src
        : new URL("js/cv-revamp-builder.js", window.location.href).href;
    try {
      link.href = new URL(
        "../css/cv-revamp-builder.css?v=" + VERSION,
        source
      ).href;
    } catch (error) {
      link.href = "css/cv-revamp-builder.css?v=" + VERSION;
    }
    document.head.appendChild(link);
  }

  function cvbHydrateCurrentUser() {
    if (state.userHydrated || hydrationPromise) return hydrationPromise;
    hydrationPromise = (async function hydrateSignedInLearner() {
      var api = window.KagieAPI;
      var user = api && api.getCurrentUser ? api.getCurrentUser() : null;
      if (!user) {
        state.userHydrated = true;
        return;
      }
      var metadata = user.user_metadata || {};
      var profile = null;
      if (api.getProfileAsync) {
        try {
          profile = await api.getProfileAsync();
        } catch (error) {
          profile = null;
        }
      }
      profile = profile || {};
      var name =
        profile.fullName ||
        metadata.full_name ||
        metadata.name ||
        [metadata.first_name, metadata.last_name].filter(Boolean).join(" ");
      var phone = profile.phone || profile.cellphone || metadata.phone;
      var location = [profile.city, profile.province].filter(Boolean).join(", ");
      var image =
        profile.profileImage ||
        profile.avatarUrl ||
        metadata.avatar_url ||
        metadata.picture;

      if (name && state.personal.fullName === "Kagie Learner") {
        state.personal.fullName = name;
      }
      if (
        (profile.email || user.email) &&
        state.personal.email === "yourname@email.com"
      ) {
        state.personal.email = profile.email || user.email;
      }
      if (phone && state.personal.phone === "+27 00 000 0000") {
        state.personal.phone = phone;
      }
      if (location && state.personal.location === "South Africa") {
        state.personal.location = location;
      }
      if (image && !state.profilePhoto) {
        state.profilePhoto = image;
      }
      state.userHydrated = true;
      cvbPersistDraft(false);
      if (cvbIsRoute()) cvbMount(true);
    })().finally(function finishHydration() {
      hydrationPromise = null;
    });
    return hydrationPromise;
  }

  function cvbMount(force) {
    if (!cvbIsRoute()) {
      cvbUnmount();
      return;
    }
    cvbEnsureStyles();
    var root = document.getElementById("kh-cvb-root");
    if (root && !force) {
      document.body.classList.add("kh-cv-builder-mode");
      return;
    }
    var previousScroll = root ? root.scrollTop : 0;
    if (!root) {
      root = document.createElement("div");
      root.id = "kh-cvb-root";
      root.className = "kh-cvb";
      root.setAttribute("data-version", VERSION);
      document.body.appendChild(root);
    }
    cvbHydrateCurrentUser();
    document.body.classList.add("kh-cv-builder-mode");
    root.innerHTML = cvbBuilderHtml();
    root.scrollTop = previousScroll;
  }

  function cvbUnmount() {
    document.body.classList.remove("kh-cv-builder-mode", "kh-cvb-printing");
    var root = document.getElementById("kh-cvb-root");
    if (root) root.remove();
  }

  function cvbScheduleMount(force) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(function mountAfterCareerRender() {
      cvbMount(Boolean(force));
    }, 0);
  }

  function cvbPersistDraft(includeRecent) {
    state.lastSavedAt = Date.now();
    try {
      window.localStorage.setItem(
        cvbScopedKey(DRAFT_KEY_ROOT),
        JSON.stringify(state)
      );
      if (includeRecent) {
        var recents = cvbReadJson(cvbScopedKey(RECENTS_KEY_ROOT), []);
        if (!Array.isArray(recents)) recents = [];
        recents.unshift({
          title: (state.personal.title || "Professional") + " CV",
          updated: "Updated just now",
          type: "PDF",
          savedAt: state.lastSavedAt,
          draft: cvbClone(state),
        });
        window.localStorage.setItem(
          cvbScopedKey(RECENTS_KEY_ROOT),
          JSON.stringify(recents.slice(0, 6))
        );
      }
    } catch (error) {
      cvbShowToast("Your draft is too large to save on this device.", true);
      return false;
    }
    cvbUpdateAutosave("Auto-saved just now");
    return true;
  }

  function cvbUpdateAutosave(text) {
    var indicator = document.getElementById("cvb-autosave");
    if (indicator) indicator.innerHTML = "<i>✓</i> " + cvbEscape(text);
  }

  function cvbQueueAutosave() {
    cvbUpdateAutosave("Saving changes...");
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(function autosaveDraft() {
      cvbPersistDraft(false);
    }, AUTOSAVE_DELAY);
  }

  function cvbShowToast(message, isError) {
    var toast = document.getElementById("cvb-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function hideToast() {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function cvbSetPath(path, value) {
    var parts = String(path || "").split(".");
    if (parts[0] === "personal" && parts[1]) {
      state.personal[parts[1]] = value;
      return;
    }
    if (path === "summary") state.summary = value;
    else if (path === "skills") {
      state.skills = String(value)
        .split(",")
        .map(function trimSkill(skill) {
          return skill.trim();
        })
        .filter(Boolean);
    } else if (Object.prototype.hasOwnProperty.call(state, path)) {
      state[path] = value;
    }
  }

  function cvbRefreshPreview() {
    var canvas = document.getElementById("cvb-preview-canvas");
    if (canvas) {
      canvas.className =
        "kh-cvb-preview__canvas kh-cvb-preview__canvas--" + state.previewMode;
      canvas.innerHTML = cvbPreviewDocumentHtml();
    }
    var count = document.getElementById("cvb-summary-count");
    if (count) count.textContent = String(state.summary || "").length + "/500";
    var score = cvbCalculateAts();
    var scoreText = document.getElementById("cvb-ats-score");
    if (scoreText) scoreText.textContent = score + "%";
    var scoreRing = document.querySelector(".kh-cvb-stat__ring");
    if (scoreRing) scoreRing.style.setProperty("--cvb-score", score);
    var accountName = document.querySelector(".kh-cvb__account-name");
    if (accountName) accountName.textContent = state.personal.fullName || "Kagie User";
  }

  function cvbScrollToStep(stepId) {
    var target =
      stepId === "template"
        ? document.querySelector(".kh-cvb-preview__template-strip")
        : document.getElementById("cvb-section-" + stepId);
    if (!target && stepId === "preview") {
      target = document.getElementById("cvb-section-preview");
    }
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function cvbContinue() {
    var index = steps.findIndex(function findActive(step) {
      return step.id === state.activeStep;
    });
    var next = steps[Math.min(Math.max(index + 1, 0), steps.length - 1)];
    state.activeStep = next.id;
    cvbMount(true);
    window.requestAnimationFrame(function scrollNextStep() {
      cvbScrollToStep(next.id);
    });
    cvbQueueAutosave();
  }

  function cvbApplyTextFormat(action) {
    var textarea = document.getElementById("cvb-summary");
    if (!textarea) return;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var selected = textarea.value.slice(start, end);
    var before = textarea.value.slice(0, start);
    var after = textarea.value.slice(end);
    var replacement = selected;
    if (action === "format-bold") replacement = "**" + (selected || "text") + "**";
    if (action === "format-italic") replacement = "*" + (selected || "text") + "*";
    if (action === "format-underline") replacement = "_" + (selected || "text") + "_";
    if (action === "insert-bullet") replacement = "\n• " + (selected || "achievement");
    if (action === "insert-number") replacement = "\n1. " + (selected || "achievement");
    if (action === "format-link") replacement = selected || "https://";
    textarea.value = (before + replacement + after).slice(0, 500);
    state.summary = textarea.value;
    textarea.focus();
    textarea.setSelectionRange(start, start + replacement.length);
    cvbRefreshPreview();
    cvbQueueAutosave();
  }

  function cvbResizePhoto(file) {
    return new Promise(function resizePhotoPromise(resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function photoReadError() {
        reject(new Error("Could not read that photo."));
      };
      reader.onload = function photoLoaded() {
        var image = new Image();
        image.onerror = function photoImageError() {
          reject(new Error("That image could not be opened."));
        };
        image.onload = function resizeLoadedPhoto() {
          var size = Math.min(image.width, image.height);
          var sourceX = Math.max(0, (image.width - size) / 2);
          var sourceY = Math.max(0, (image.height - size) / 2);
          var canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 320;
          var context = canvas.getContext("2d");
          context.drawImage(
            image,
            sourceX,
            sourceY,
            size,
            size,
            0,
            0,
            320,
            320
          );
          resolve(canvas.toDataURL("image/jpeg", 0.84));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function cvbHandlePhoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
      cvbShowToast("Choose a JPG, PNG or WEBP photo.", true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      cvbShowToast("Your photo must be smaller than 5MB.", true);
      return;
    }
    try {
      state.profilePhoto = await cvbResizePhoto(file);
      cvbMount(true);
      cvbQueueAutosave();
      cvbShowToast("Profile photo added.");
    } catch (error) {
      cvbShowToast(error.message || "Could not add that photo.", true);
    }
  }

  function cvbXmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function cvbDocxParagraph(text, options) {
    var config = options || {};
    var paragraphProperties =
      "<w:pPr>" +
      (config.align ? '<w:jc w:val="' + config.align + '"/>' : "") +
      '<w:spacing w:before="' +
      (config.before || 0) +
      '" w:after="' +
      (config.after == null ? 80 : config.after) +
      '" w:line="' +
      (config.line || 276) +
      '" w:lineRule="auto"/>' +
      (config.keepNext ? "<w:keepNext/>" : "") +
      "</w:pPr>";
    var runProperties =
      "<w:rPr>" +
      (config.bold ? "<w:b/>" : "") +
      (config.italic ? "<w:i/>" : "") +
      (config.color ? '<w:color w:val="' + config.color + '"/>' : "") +
      (config.size
        ? '<w:sz w:val="' +
          config.size +
          '"/><w:szCs w:val="' +
          config.size +
          '"/>'
        : "") +
      (config.caps ? "<w:caps/>" : "") +
      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' +
      "</w:rPr>";
    return (
      "<w:p>" +
      paragraphProperties +
      "<w:r>" +
      runProperties +
      '<w:t xml:space="preserve">' +
      cvbXmlEscape(text) +
      "</w:t></w:r></w:p>"
    );
  }

  function cvbDocxDocumentXml() {
    var parts = [];
    parts.push(
      cvbDocxParagraph(state.personal.fullName || "Kagie Learner", {
        bold: true,
        size: 40,
        align: "center",
        after: 45,
        keepNext: true,
      })
    );
    parts.push(
      cvbDocxParagraph(state.personal.title || "Professional Title", {
        bold: true,
        color: "ED0016",
        size: 22,
        align: "center",
        after: 70,
        keepNext: true,
      })
    );
    parts.push(
      cvbDocxParagraph(
        [
          state.personal.location,
          state.personal.phone,
          state.personal.email,
          state.personal.linkedin,
          state.personal.website,
        ]
          .filter(Boolean)
          .join("  ·  "),
        { color: "66788F", size: 18, align: "center", after: 180 }
      )
    );

    function addHeading(label) {
      parts.push(
        cvbDocxParagraph(label.toUpperCase(), {
          bold: true,
          caps: true,
          color: "10233D",
          size: 22,
          before: 150,
          after: 55,
          keepNext: true,
        })
      );
    }

    addHeading("Professional Summary");
    parts.push(cvbDocxParagraph(state.summary, { size: 19, line: 290, after: 100 }));

    addHeading("Work Experience");
    state.experiences.forEach(function addDocxExperience(item) {
      parts.push(
        cvbDocxParagraph(item.jobTitle || "Role", {
          bold: true,
          size: 20,
          after: 20,
          keepNext: true,
        })
      );
      parts.push(
        cvbDocxParagraph(
          [
            item.company,
            [item.from, item.to].filter(Boolean).join(" – "),
          ]
            .filter(Boolean)
            .join("  ·  "),
          { color: "66788F", size: 18, after: 35, keepNext: true }
        )
      );
      cvbLines(item.achievements).forEach(function addDocxAchievement(line) {
        parts.push(
          cvbDocxParagraph("•  " + line, {
            size: 18,
            after: 25,
            line: 276,
          })
        );
      });
    });

    addHeading("Education");
    state.education.forEach(function addDocxEducation(item) {
      parts.push(
        cvbDocxParagraph(item.degree || "Qualification", {
          bold: true,
          size: 20,
          after: 20,
          keepNext: true,
        })
      );
      parts.push(
        cvbDocxParagraph(
          [
            item.institution,
            [item.from, item.to].filter(Boolean).join(" – "),
          ]
            .filter(Boolean)
            .join("  ·  "),
          { color: "66788F", size: 18, after: 65 }
        )
      );
    });

    addHeading("Skills");
    parts.push(
      cvbDocxParagraph(state.skills.filter(Boolean).join("  ·  "), {
        size: 19,
        after: 90,
      })
    );
    [
      ["Certifications", state.certifications],
      ["Languages", state.languages],
      ["References", state.references],
      ["Additional Information", state.additional],
    ].forEach(function addOptionalDocxSection(section) {
      if (!String(section[1] || "").trim()) return;
      addHeading(section[0]);
      cvbLines(section[1]).forEach(function addOptionalLine(line) {
        parts.push(cvbDocxParagraph(line, { size: 18, after: 30 }));
      });
    });

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body>" +
      parts.join("") +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="540" w:footer="540" w:gutter="0"/></w:sectPr>' +
      "</w:body></w:document>"
    );
  }

  var cvbCrcTable = null;

  function cvbCrc32(bytes) {
    if (!cvbCrcTable) {
      cvbCrcTable = new Uint32Array(256);
      for (var tableIndex = 0; tableIndex < 256; tableIndex += 1) {
        var value = tableIndex;
        for (var bit = 0; bit < 8; bit += 1) {
          value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        cvbCrcTable[tableIndex] = value >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var index = 0; index < bytes.length; index += 1) {
      crc = cvbCrcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function cvbZipStore(files, mimeType) {
    var encoder = new TextEncoder();
    var localParts = [];
    var centralParts = [];
    var localOffset = 0;
    var now = new Date();
    var dosTime =
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      Math.floor(now.getSeconds() / 2);
    var dosDate =
      ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate();

    files.forEach(function addZipFile(file) {
      var nameBytes = encoder.encode(file.name);
      var dataBytes =
        file.data instanceof Uint8Array ? file.data : encoder.encode(file.data);
      var crc = cvbCrc32(dataBytes);
      var localHeader = new Uint8Array(30 + nameBytes.length);
      var localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      localParts.push(localHeader, dataBytes);

      var centralHeader = new Uint8Array(46 + nameBytes.length);
      var centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, localOffset, true);
      centralHeader.set(nameBytes, 46);
      centralParts.push(centralHeader);
      localOffset += localHeader.length + dataBytes.length;
    });

    var centralSize = centralParts.reduce(function sumCentral(total, part) {
      return total + part.length;
    }, 0);
    var end = new Uint8Array(22);
    var endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, localOffset, true);
    endView.setUint16(20, 0, true);
    return new Blob(localParts.concat(centralParts, [end]), { type: mimeType });
  }

  function cvbCreateDocxBlob() {
    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>";
    var relationships =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>";
    return cvbZipStore(
      [
        { name: "[Content_Types].xml", data: contentTypes },
        { name: "_rels/.rels", data: relationships },
        { name: "word/document.xml", data: cvbDocxDocumentXml() },
      ],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }

  function cvbDownloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function releaseDocxUrl() {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function cvbDownloadDocx() {
    cvbDownloadBlob(cvbCreateDocxBlob(), cvbSafeFilename() + ".docx");
    cvbShowToast("Editable CV downloaded.");
  }

  function cvbPrintCv() {
    document.body.classList.add("kh-cvb-printing");
    var previousTitle = document.title;
    document.title = cvbSafeFilename();
    window.setTimeout(function openPrintDialog() {
      window.print();
      window.setTimeout(function restorePrintView() {
        document.body.classList.remove("kh-cvb-printing");
        document.title = previousTitle;
      }, 350);
    }, 60);
  }

  async function cvbShare() {
    cvbPersistDraft(false);
    var blob = cvbCreateDocxBlob();
    var filename = cvbSafeFilename() + ".docx";
    var file = null;
    try {
      file = new File([blob], filename, { type: blob.type });
    } catch (error) {
      file = null;
    }
    try {
      if (
        file &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: (state.personal.fullName || "Kagie") + " CV",
          text: "My professional CV, created with Kagie.",
          files: [file],
        });
        cvbShowToast("CV file shared securely.");
        return;
      }
      cvbDownloadBlob(blob, filename);
      cvbShowToast("CV downloaded. You can now attach and share the file.");
    } catch (error) {
      if (error && error.name !== "AbortError") {
        cvbShowToast("Could not share this CV file.", true);
      }
    }
  }

  async function cvbCreateCareerSupportTicket(api, user, subject, message) {
    if (api.createSupportTicketAsync || api.createSupportTicket) {
      return api.createSupportTicketAsync
        ? api.createSupportTicketAsync({
            userId: user.id,
            subject: subject,
            category: "Career Hub",
            priority: "normal",
            message: message,
          })
        : Promise.resolve(
            api.createSupportTicket({
              userId: user.id,
              subject: subject,
              category: "Career Hub",
              priority: "normal",
              message: message,
            })
          );
    }
    if (api.sendSupportMessageAsync) {
      return api.sendSupportMessageAsync("support_" + user.id, "[Career Hub] " + subject + " - " + message);
    }
    return null;
  }

  async function cvbSubmitFreeReview(file) {
    if (!file) return;
    var extension = String(file.name || "").split(".").pop().toLowerCase();
    if (["pdf", "doc", "docx"].indexOf(extension) < 0) {
      cvbShowToast("Choose a PDF, DOC or DOCX CV.", true);
      return;
    }
    if (!file.size || file.size > 8 * 1024 * 1024) {
      cvbShowToast("Your CV must be smaller than 8MB.", true);
      return;
    }
    var api = window.KagieAPI;
    var user = api && api.getCurrentUser ? api.getCurrentUser() : null;
    if (!user || !user.id) {
      cvbShowToast("Sign in to request your free CV review.", true);
      return;
    }
    if (!api.saveDocumentsAsync) {
      cvbShowToast("CV review is temporarily unavailable.", true);
      return;
    }
    cvbShowToast("Submitting your free expert review...");
    try {
      var client = api.initSupabaseClient();
      if (!client) throw new Error("Live CV review is unavailable. Your draft is still saved on this device.");
      var verified = await client.auth.getUser();
      if (verified.error || !verified.data.user || verified.data.user.id !== user.id) throw new Error("Sign in again before requesting a CV review.");
      var path = user.id + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      var uploaded = await client.storage.from("kagie-documents").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploaded.error) throw uploaded.error;
      var inserted = await client.from("documents").insert({ user_id: user.id, document_type: "cv", file_name: file.name, file_url: path, file_size: file.size, mime_type: file.type, status: "Pending Review", metadata: { cvDraft: cvbClone(state), learnerNote: String(document.getElementById("cvb-learner-note")?.value || "").trim() } }).select("id").single();
      if (inserted.error || !inserted.data.id) throw inserted.error || new Error("The server did not confirm your review request.");
      cvbShowToast("Free expert review requested successfully.");
    } catch (error) {
      cvbShowToast(error.message || "Could not submit your CV.", true);
    }
  }

  function cvbImproveSummary() {
    var summary = String(state.summary || "").trim();
    if (!summary) {
      summary =
        "Results-driven professional with a strong record of learning quickly, solving problems and delivering high-quality work.";
    } else if (!/results-driven/i.test(summary)) {
      summary =
        "Results-driven " +
        summary.charAt(0).toLowerCase() +
        summary.slice(1).replace(/\s+$/, "") +
        " Focused on measurable impact, collaboration and continuous improvement.";
    } else {
      summary = summary.replace(/\bhelped\b/gi, "delivered").replace(/\bworked on\b/gi, "led");
    }
    state.summary = summary.slice(0, 500);
    cvbMount(true);
    cvbQueueAutosave();
    cvbShowToast("Your summary has been strengthened.");
  }

  function cvbShowAtsReport() {
    var score = cvbCalculateAts();
    var missing = steps
      .filter(function incompleteStep(step) {
        return !cvbStepComplete(step.id) && step.id !== "preview";
      })
      .map(function missingLabel(step) {
        return step.label;
      });
    cvbShowToast(
      "ATS score " +
        score +
        "%. " +
        (missing.length
          ? "Complete: " + missing.slice(0, 3).join(", ") + "."
          : "Your CV is ready for applications.")
    );
  }

  function cvbHandleAction(action, trigger) {
    if (action === "back") {
      window.location.hash = "#kh-cv";
      return;
    }
    if (action === "save") {
      if (cvbPersistDraft(true)) {
        cvbMount(true);
        cvbShowToast("Draft saved.");
      }
      return;
    }
    if (action === "continue") {
      cvbContinue();
      return;
    }
    if (action.indexOf("format-") === 0 || action.indexOf("insert-") === 0) {
      cvbApplyTextFormat(action);
      return;
    }
    if (action === "choose-photo") {
      var photoInput = document.getElementById("cvb-photo-input");
      if (photoInput) photoInput.click();
      return;
    }
    if (action === "remove-photo") {
      state.profilePhoto = "";
      cvbMount(true);
      cvbQueueAutosave();
      return;
    }
    if (action === "add-experience") {
      state.experiences.push({
        id: cvbUid("exp"),
        jobTitle: "",
        company: "",
        from: "",
        to: "",
        current: false,
        achievements: "",
      });
      cvbMount(true);
      cvbScrollToStep("experience");
      cvbQueueAutosave();
      return;
    }
    if (action === "delete-experience") {
      var experienceIndex = Number(trigger.getAttribute("data-cvb-index"));
      if (state.experiences.length > 1) state.experiences.splice(experienceIndex, 1);
      else {
        state.experiences[0] = {
          id: cvbUid("exp"),
          jobTitle: "",
          company: "",
          from: "",
          to: "",
          current: false,
          achievements: "",
        };
      }
      cvbMount(true);
      cvbQueueAutosave();
      return;
    }
    if (action === "add-education") {
      state.education.push({
        id: cvbUid("edu"),
        degree: "",
        institution: "",
        from: "",
        to: "",
      });
      cvbMount(true);
      cvbScrollToStep("education");
      cvbQueueAutosave();
      return;
    }
    if (action === "delete-education") {
      var educationIndex = Number(trigger.getAttribute("data-cvb-index"));
      if (state.education.length > 1) state.education.splice(educationIndex, 1);
      else {
        state.education[0] = {
          id: cvbUid("edu"),
          degree: "",
          institution: "",
          from: "",
          to: "",
        };
      }
      cvbMount(true);
      cvbQueueAutosave();
      return;
    }
    if (action === "download-pdf" || action === "print") {
      cvbPrintCv();
      return;
    }
    if (action === "download-docx") {
      cvbDownloadDocx();
      return;
    }
    if (action === "share") {
      cvbShare();
      return;
    }
    if (action === "improve") {
      cvbImproveSummary();
      return;
    }
    if (action === "request-review") {
      var sourceInput = document.getElementById("cvb-source-cv");
      if (sourceInput) sourceInput.click();
      return;
    }
    if (action === "ats-report") {
      cvbShowAtsReport();
      return;
    }
    if (action === "show-tips") {
      cvbShowToast("Use job keywords, add numbers to achievements and keep your CV concise.");
      return;
    }
    if (action === "show-templates") {
      var templateStrip = document.querySelector(".kh-cvb-preview__template-strip");
      if (templateStrip) templateStrip.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (action === "show-recents") {
      cvbShowToast("Your six most recent saved drafts are stored on this device.");
      return;
    }
    if (action === "load-recent") {
      var recentIndex = Number(trigger.getAttribute("data-cvb-index"));
      var recents = cvbReadJson(cvbScopedKey(RECENTS_KEY_ROOT), []);
      if (recents[recentIndex] && recents[recentIndex].draft) {
        state = cvbMergeDraft(recents[recentIndex].draft);
        cvbMount(true);
        cvbShowToast("Saved CV loaded.");
      } else {
        cvbShowToast("This example CV will appear after you save a draft.");
      }
    }
  }

  function cvbClickHandler(event) {
    var root = document.getElementById("kh-cvb-root");
    if (!root || !root.contains(event.target)) return;
    var stepTrigger = event.target.closest("[data-cvb-step]");
    if (stepTrigger) {
      event.preventDefault();
      event.stopPropagation();
      state.activeStep = stepTrigger.getAttribute("data-cvb-step");
      cvbMount(true);
      window.requestAnimationFrame(function scrollSelectedStep() {
        cvbScrollToStep(state.activeStep);
      });
      return;
    }
    var templateTrigger = event.target.closest("[data-cvb-template]");
    if (templateTrigger) {
      event.preventDefault();
      event.stopPropagation();
      state.template = templateTrigger.getAttribute("data-cvb-template");
      state.activeStep = "template";
      cvbMount(true);
      cvbQueueAutosave();
      return;
    }
    var previewTrigger = event.target.closest("[data-cvb-preview-mode]");
    if (previewTrigger) {
      event.preventDefault();
      event.stopPropagation();
      state.previewMode = previewTrigger.getAttribute("data-cvb-preview-mode");
      cvbMount(true);
      return;
    }
    var actionTrigger = event.target.closest("[data-cvb-action]");
    if (!actionTrigger) return;
    event.preventDefault();
    event.stopPropagation();
    cvbHandleAction(actionTrigger.getAttribute("data-cvb-action"), actionTrigger);
  }

  function cvbInputHandler(event) {
    var root = document.getElementById("kh-cvb-root");
    if (!root || !root.contains(event.target)) return;
    var target = event.target;
    if (target.hasAttribute("data-cvb-field")) {
      cvbSetPath(target.getAttribute("data-cvb-field"), target.value);
      cvbRefreshPreview();
      cvbQueueAutosave();
      return;
    }
    if (target.hasAttribute("data-cvb-exp-index")) {
      var experienceIndex = Number(target.getAttribute("data-cvb-exp-index"));
      var experienceField = target.getAttribute("data-cvb-exp-field");
      if (state.experiences[experienceIndex] && experienceField !== "current") {
        state.experiences[experienceIndex][experienceField] = target.value;
        cvbRefreshPreview();
        cvbQueueAutosave();
      }
      return;
    }
    if (target.hasAttribute("data-cvb-edu-index")) {
      var educationIndex = Number(target.getAttribute("data-cvb-edu-index"));
      var educationField = target.getAttribute("data-cvb-edu-field");
      if (state.education[educationIndex]) {
        state.education[educationIndex][educationField] = target.value;
        cvbRefreshPreview();
        cvbQueueAutosave();
      }
    }
  }

  function cvbChangeHandler(event) {
    var root = document.getElementById("kh-cvb-root");
    if (!root || !root.contains(event.target)) return;
    var target = event.target;
    if (target.id === "cvb-photo-input") {
      cvbHandlePhoto(target.files && target.files[0]);
      return;
    }
    if (target.id === "cvb-source-cv") {
      cvbSubmitFreeReview(target.files && target.files[0]);
      target.value = "";
      return;
    }
    if (
      target.type === "checkbox" &&
      target.hasAttribute("data-cvb-exp-index")
    ) {
      var index = Number(target.getAttribute("data-cvb-exp-index"));
      if (state.experiences[index]) {
        state.experiences[index].current = target.checked;
        if (target.checked) state.experiences[index].to = "Present";
        cvbMount(true);
        cvbQueueAutosave();
      }
    }
  }

  function cvbHashHandler() {
    cvbScheduleMount(false);
  }

  function cvbStart() {
    cvbEnsureStyles();
    document.addEventListener("click", cvbClickHandler, true);
    document.addEventListener("input", cvbInputHandler, true);
    document.addEventListener("change", cvbChangeHandler, true);
    window.addEventListener("hashchange", cvbHashHandler);
    observer = new MutationObserver(function watchCareerHubRender() {
      if (cvbIsRoute()) {
        document.body.classList.add("kh-cv-builder-mode");
        if (!document.getElementById("kh-cvb-root")) {
          cvbScheduleMount(false);
        }
      }
      if (!cvbIsRoute() && document.getElementById("kh-cvb-root")) {
        cvbUnmount();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    cvbScheduleMount(false);
  }

  window.KagieCvRevampBuilder = {
    version: VERSION,
    open: function openCvBuilder() {
      window.location.hash = "#kh-cv-builder";
    },
    save: function saveCvBuilder() {
      return cvbPersistDraft(true);
    },
    getState: function getCvBuilderState() {
      return cvbClone(state);
    },
    createDocxBlob: function createCvBuilderDocxBlob() {
      return cvbCreateDocxBlob();
    },
    previewDraft: function previewDraft(draft) {
      var previous = state;
      try { state = cvbMergeDraft(cvbClone(draft)); if (!templates.some(function (t) { return t.id === state.template; })) state.template = "charcoal"; return cvbPreviewDocumentHtml(); }
      finally { state = previous; }
    },
    createDocxForDraft: function createDocxForDraft(draft) {
      var previous = state;
      try { state = cvbMergeDraft(cvbClone(draft)); return cvbCreateDocxBlob(); }
      finally { state = previous; }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cvbStart, { once: true });
  } else {
    cvbStart();
  }
})();
