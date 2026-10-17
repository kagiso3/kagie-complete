(function careerHubApp() {
  "use strict";

  var khScriptSource =
    document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : "";
  var khStorePrefix = "kh-career-hub:";
  var khToastTimer = 0;
  var khLastFocusedElement = null;

  function khEscapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function replaceCharacter(character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#2d9df9;",
        }[character];
      }
    );
  }

  function khReadStore(key, fallback) {
    try {
      var storedValue = window.localStorage.getItem(khStorePrefix + key);
      return storedValue == null ? fallback : JSON.parse(storedValue);
    } catch (error) {
      return fallback;
    }
  }

  function khWriteStore(key, value) {
    try {
      window.localStorage.setItem(khStorePrefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function khIcon(name, className, solid) {
    var paths = {
      "arrow-left":
        '<path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path>',
      "arrow-right":
        '<path d="m9 18 6-6-6-6"></path>',
      "briefcase":
        '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path><path d="M10 12v2h4v-2"></path>',
      "search":
        '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>',
      "bell":
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
      "bookmark":
        '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"></path>',
      "heart":
        '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"></path>',
      "file":
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M8 13h8M8 17h6"></path>',
      "pen":
        '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>',
      "send":
        '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
      "clipboard":
        '<rect x="5" y="4" width="14" height="18" rx="2"></rect><path d="M9 4V2h6v2"></path><path d="M9 10h6M9 14h6M9 18h4"></path>',
      "target":
        '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
      "home":
        '<path d="m3 11 9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>',
      "compass":
        '<circle cx="12" cy="12" r="9"></circle><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"></path>',
      "graduation":
        '<path d="m2 10 10-5 10 5-10 5Z"></path><path d="M6 12.5V17c3 2.5 9 2.5 12 0v-4.5"></path><path d="M22 10v6"></path>',
      "building":
        '<path d="M3 21h18"></path><path d="M6 21V4h12v17"></path><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"></path>',
      "menu":
        '<path d="M4 6h16M4 12h16M4 18h16"></path>',
      "pin":
        '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle>',
      "clock":
        '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
      "calendar":
        '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
      "share":
        '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"></path>',
      "filter":
        '<path d="M4 5h16l-6 7v5l-4 2v-7Z"></path>',
      "upload":
        '<path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"></path>',
      "check":
        '<path d="m5 12 4 4L19 6"></path>',
      "check-circle":
        '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
      "copy":
        '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>',
      "download":
        '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
      "close":
        '<path d="m6 6 12 12M18 6 6 18"></path>',
      "sparkles":
        '<path d="m12 3 1.2 3.3L16.5 8l-3.3 1.2L12 12.5l-1.2-3.3L7.5 8l3.3-1.7Z"></path><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"></path><path d="m5 14 .7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7Z"></path>',
      "career":
        '<circle cx="15.5" cy="8.5" r="5.5"></circle><path d="m19.5 12.5 3 3"></path><rect x="2" y="12" width="12" height="8" rx="2"></rect><path d="M6 12V9h4v3M2 16h12"></path>',
      "document-search":
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7"></path><path d="M14 2v6h6v4"></path><circle cx="17" cy="17" r="3"></circle><path d="m19 19 3 3"></path>',
      "user-search":
        '<circle cx="9" cy="7" r="4"></circle><path d="M2.5 21a6.5 6.5 0 0 1 13 0"></path><circle cx="17.5" cy="14.5" r="3"></circle><path d="m20 17 2 2"></path>',
      "chevron-down":
        '<path d="m6 9 6 6 6-6"></path>',
      "more":
        '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
      "edit":
        '<path d="M12 20h9"></path><path d="m16.5 3.5 4 4L8 20l-5 1 1-5Z"></path>',
      "eye":
        '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
      "lightbulb":
        '<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.2 1.3-1.3 2.5h-4.4c-.1-1.2-.4-1.8-1.3-2.5Z"></path>',
    };
    var iconClass = className ? "kh-icon " + className : "kh-icon";
    var fillValue = solid ? "currentColor" : "none";
    return (
      '<svg class="' +
      iconClass +
      '" aria-hidden="true" viewBox="0 0 24 24" fill="' +
      fillValue +
      '" stroke="currentColor">' +
      (paths[name] || paths.briefcase) +
      "</svg>"
    );
  }

  var khInternships = [
    {
      id: "deloitte-audit",
      kind: "internships",
      company: "Deloitte",
      brand: "Deloitte",
      brandStyle: "kh-brand-mark--dark",
      title: "Audit Internship",
      location: "Johannesburg, Gauteng",
      workMode: "On-site",
      type: "Full-time",
      category: "Accounting",
      level: "Graduate",
      closing: "31 May 2026",
      closingShort: "Closing 31 May 2026",
      posted: "2 days ago",
      startDate: "01 July 2026",
      duration: "12 Months",
      tags: ["Internship", "Closing soon"],
      description:
        "Gain practical experience in auditing, financial analysis and advisory services while working with industry experts on real client engagements.",
      requirements: [
        "Currently studying towards a BCom or related qualification",
        "Completed second year or above",
        "Strong analytical and communication skills",
        "MS Excel proficiency",
        "South African citizen or permanent resident",
      ],
    },
    {
      id: "standard-bank-it",
      kind: "internships",
      company: "Standard Bank",
      brand: "SB",
      brandStyle: "kh-brand-mark--navy",
      title: "IT Internship Programme",
      location: "Cape Town, Western Cape",
      workMode: "Hybrid",
      type: "Full-time",
      category: "Technology",
      level: "Graduate",
      closing: "10 May 2026",
      closingShort: "Closing 10 May 2026",
      posted: "4 days ago",
      startDate: "15 June 2026",
      duration: "12 Months",
      tags: ["Technology", "Hybrid"],
      description:
        "Build hands-on technology experience across digital banking, software delivery and data platforms with structured mentorship.",
      requirements: [
        "Diploma or degree in IT, Computer Science or related field",
        "Basic programming or data skills",
        "Strong problem-solving ability",
        "Available for the full programme",
      ],
    },
    {
      id: "absa-graduate",
      kind: "internships",
      company: "Absa Group",
      brand: "absa",
      brandStyle: "kh-brand-mark--red",
      title: "Graduate Internship",
      location: "Durban, KwaZulu-Natal",
      workMode: "On-site",
      type: "Full-time",
      category: "Finance",
      level: "Graduate",
      closing: "15 May 2026",
      closingShort: "Closing 15 May 2026",
      posted: "1 week ago",
      startDate: "01 July 2026",
      duration: "12 Months",
      tags: ["Finance", "Internship"],
      description:
        "Join a rotational graduate internship that develops commercial, customer and financial services capability.",
      requirements: [
        "Relevant three-year tertiary qualification",
        "No more than one year of formal work experience",
        "Excellent interpersonal skills",
        "Willingness to learn across business units",
      ],
    },
    {
      id: "clicks-learnership",
      kind: "internships",
      company: "Clicks Group",
      brand: "clicks",
      brandStyle: "kh-brand-mark--red",
      title: "Retail Learnership Programme",
      location: "Pretoria, Gauteng",
      workMode: "On-site",
      type: "Learnership",
      category: "Retail",
      level: "Entry level",
      closing: "22 May 2026",
      closingShort: "Closing 22 May 2026",
      posted: "3 days ago",
      startDate: "15 June 2026",
      duration: "10 Months",
      tags: ["Learnership", "Entry level"],
      description:
        "Develop practical retail and customer-service skills through accredited learning and workplace experience.",
      requirements: [
        "Grade 12 certificate",
        "Between 18 and 29 years old",
        "Currently unemployed",
        "Customer-focused attitude",
      ],
    },
  ];

  var khJobs = [
    {
      id: "investec-data-analyst",
      kind: "jobs",
      company: "Investec",
      brand: "Investec",
      brandStyle: "kh-brand-mark--dark",
      title: "Junior Data Analyst",
      location: "Sandton, Gauteng",
      workMode: "Hybrid",
      type: "Permanent",
      category: "Data",
      level: "Entry level",
      closing: "08 June 2026",
      closingShort: "Closing 08 June 2026",
      posted: "Today",
      startDate: "As soon as possible",
      duration: "Permanent",
      tags: ["Entry level", "Hybrid"],
      description:
        "Turn business data into clear insights and reporting while growing your analytics capability in a collaborative financial services team.",
      requirements: [
        "Degree or diploma in a quantitative field",
        "Working knowledge of Excel and SQL",
        "Clear written and verbal communication",
        "Curiosity and attention to detail",
      ],
    },
    {
      id: "takealot-customer-experience",
      kind: "jobs",
      company: "takealot.com",
      brand: "takealot",
      brandStyle: "kh-brand-mark--navy",
      title: "Customer Experience Agent",
      location: "Cape Town, Western Cape",
      workMode: "On-site",
      type: "Permanent",
      category: "Customer service",
      level: "Entry level",
      closing: "04 June 2026",
      closingShort: "Closing 04 June 2026",
      posted: "Yesterday",
      startDate: "As soon as possible",
      duration: "Permanent",
      tags: ["Customer service", "Entry level"],
      description:
        "Support customers across digital channels and resolve queries with empathy, accuracy and a strong ownership mindset.",
      requirements: [
        "Grade 12 certificate",
        "Excellent written and spoken English",
        "Comfortable working shifts",
        "Customer support experience is beneficial",
      ],
    },
    {
      id: "mtn-software-engineer",
      kind: "jobs",
      company: "MTN",
      brand: "MTN",
      brandStyle: "kh-brand-mark--red",
      title: "Graduate Software Engineer",
      location: "Johannesburg, Gauteng",
      workMode: "Hybrid",
      type: "Permanent",
      category: "Technology",
      level: "Graduate",
      closing: "12 June 2026",
      closingShort: "Closing 12 June 2026",
      posted: "2 days ago",
      startDate: "01 August 2026",
      duration: "Permanent",
      tags: ["Technology", "Graduate"],
      description:
        "Join a product engineering team building reliable digital services used by customers across the continent.",
      requirements: [
        "Computer Science or Software Engineering qualification",
        "Understanding of web or mobile development",
        "Familiarity with source control",
        "Strong teamwork and learning mindset",
      ],
    },
    {
      id: "woolworths-marketing",
      kind: "jobs",
      company: "Woolworths",
      brand: "W",
      brandStyle: "kh-brand-mark--dark",
      title: "Marketing Assistant",
      location: "Remote, South Africa",
      workMode: "Remote",
      type: "Contract",
      category: "Marketing",
      level: "Entry level",
      closing: "18 June 2026",
      closingShort: "Closing 18 June 2026",
      posted: "4 days ago",
      startDate: "01 July 2026",
      duration: "6 Months",
      tags: ["Remote", "Marketing"],
      description:
        "Coordinate campaign content, reporting and administration for a fast-moving customer marketing team.",
      requirements: [
        "Marketing or communications qualification",
        "Strong organisational skills",
        "Comfort with digital content tools",
        "Reliable internet connection",
      ],
    },
  ];

  var khDefaultTrackerItems = [
    {
      id: "track-deloitte",
      opportunityId: "deloitte-audit",
      company: "Deloitte",
      brand: "Deloitte",
      brandStyle: "kh-brand-mark--dark",
      title: "Audit Internship",
      status: "interview",
      statusLabel: "Interview",
      date: "Interview: 29 May 2026",
    },
    {
      id: "track-standard-bank",
      opportunityId: "standard-bank-it",
      company: "Standard Bank",
      brand: "SB",
      brandStyle: "kh-brand-mark--navy",
      title: "IT Internship Programme",
      status: "review",
      statusLabel: "In review",
      date: "Updated 2 days ago",
    },
    {
      id: "track-absa",
      opportunityId: "absa-graduate",
      company: "Absa Group",
      brand: "absa",
      brandStyle: "kh-brand-mark--red",
      title: "Graduate Internship",
      status: "applied",
      statusLabel: "Applied",
      date: "Applied 18 May 2026",
    },
    {
      id: "track-investec",
      opportunityId: "investec-data-analyst",
      company: "Investec",
      brand: "Investec",
      brandStyle: "kh-brand-mark--dark",
      title: "Junior Data Analyst",
      status: "saved",
      statusLabel: "Saved",
      date: "Saved yesterday",
    },
  ];

  var khNotifications = [
    {
      id: "new-internship",
      group: "Today",
      title: "New Internship Alert",
      text: "Deloitte has posted a new Audit Internship in Johannesburg.",
      time: "10:15",
      icon: "briefcase",
    },
    {
      id: "application-update",
      group: "Today",
      title: "Application Update",
      text: "Your application for Audit Internship is now in review.",
      time: "09:42",
      icon: "clipboard",
    },
    {
      id: "cv-ready",
      group: "Today",
      title: "CV Revamp Ready",
      text: "Your improved CV is ready to download.",
      time: "08:10",
      icon: "file",
    },
    {
      id: "new-job-match",
      group: "Yesterday",
      title: "New Job Match",
      text: "We found 3 new roles that match your profile.",
      time: "16:25",
      icon: "target",
    },
    {
      id: "closing-soon",
      group: "Yesterday",
      title: "Closing Soon",
      text: "The Standard Bank IT Internship closes soon.",
      time: "12:08",
      icon: "clock",
    },
  ];

  var khStoredBookmarks = khReadStore("bookmarks", [
    "standard-bank-it",
    "investec-data-analyst",
  ]);
  var khStoredReadNotifications = khReadStore("read-notifications", []);
  var khStoredTrackerItems = khReadStore("tracker-items", []);
  var khStoredLetter = khReadStore("generated-letter", null);
  var khPaperGrades = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
  var khPaperSubjects = [
    "Mathematics",
    "Mathematical Literacy",
    "Physical Sciences",
    "Life Sciences",
    "Accounting",
    "Business Studies",
    "Economics",
    "Geography",
    "History",
    "English",
    "Afrikaans",
    "IsiZulu",
    "Life Orientation",
    "Agricultural Sciences",
    "Tourism",
    "Computer Applications Technology",
    "Information Technology",
  ];

  var khState = {
    route: "career",
    selectedOpportunityId: "deloitte-audit",
    detailReturnRoute: "internships",
    bookmarks: new Set(
      Array.isArray(khStoredBookmarks) ? khStoredBookmarks : []
    ),
    readNotifications: new Set(
      Array.isArray(khStoredReadNotifications)
        ? khStoredReadNotifications
        : []
    ),
    trackerItems: Array.isArray(khStoredTrackerItems)
      ? khStoredTrackerItems
      : [],
    searches: {
      internships: "",
      jobs: "",
    },
    filters: {
      internships: "all",
      jobs: "all",
    },
    trackerFilter: "all",
    cvFile: null,
    cvService: "professional",
    cvRevampFree: true,
    adminContent: null,
    adminArticles: [],
    adminLoaded: false,
    paperLibrary: [],
    papersLoading: false,
    papersLoaded: false,
    papersError: "",
    paperSearch: "",
    paperFilters: {
      grade: "",
      subject: "",
    },
    applyMode: "guided",
    applyTargetId: "deloitte-audit",
    letterEditMode: false,
    generatedLetter:
      khStoredLetter && typeof khStoredLetter.text === "string"
        ? khStoredLetter.text
        : "",
    generatedLetterMeta:
      khStoredLetter && khStoredLetter.meta ? khStoredLetter.meta : null,
  };

  var khRefs = {
    app: null,
    header: null,
    main: null,
    live: null,
    toast: null,
    modal: null,
  };

  function khTextList(value) {
    if (Array.isArray(value)) {
      return value
        .map(function normalizeListItem(item) {
          return String(item || "").trim();
        })
        .filter(Boolean);
    }
    return String(value || "")
      .split(/\r?\n|,/)
      .map(function normalizeTextItem(item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function khArticleType(article) {
    var type = String(
      article && (article.contentType || article.content_type || article.type || article.kind)
    )
      .trim()
      .toLowerCase();
    if (type === "job" || type === "jobs" || type === "vacancy") return "jobs";
    if (
      type === "internship" ||
      type === "internships" ||
      type === "learnership" ||
      type === "learnerships"
    ) {
      return "internships";
    }
    return "";
  }

  function khInitials(value, fallback) {
    var parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return fallback || "KG";
    return parts
      .slice(0, 2)
      .map(function partInitial(part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");
  }

  function khArticleOpportunity(article) {
    var kind = khArticleType(article);
    if (!kind || !article || article.status !== "published" || !article.title) {
      return null;
    }
    var company = String(article.company || "Kagie opportunity partner").trim();
    var tags = khTextList(article.tags);
    var requirements = khTextList(article.requirements);
    if (!requirements.length) {
      requirements = [
        "Updated CV",
        "Certified ID or passport copy",
        "Academic record or latest results",
        "Any employer-specific documents listed in the advert",
      ];
    }
    return {
      id: String(article.id || "admin-career-" + article.title).trim(),
      kind: kind,
      company: company,
      brand: khInitials(company, kind === "jobs" ? "JOB" : "INT"),
      brandStyle: kind === "jobs" ? "kh-brand-mark--navy" : "kh-brand-mark--red",
      title: String(article.title || "").trim(),
      location: String(article.location || "South Africa").trim(),
      workMode: String(article.workMode || article.work_mode || "Not specified").trim(),
      type: String(
        article.employmentType ||
          article.employment_type ||
          (kind === "jobs" ? "Job" : "Internship")
      ).trim(),
      category: String(article.category || "Career").trim(),
      level: String(article.level || "Entry level").trim(),
      closing: String(article.closingDate || article.closing_date || "Not specified").trim(),
      closingShort: article.closingDate || article.closing_date
        ? "Closing " + String(article.closingDate || article.closing_date).trim()
        : "Closing date not listed",
      posted: "Official Kagie opportunity",
      startDate: String(article.startDate || article.start_date || "Not specified").trim(),
      duration: String(article.duration || "Not specified").trim(),
      tags: tags.length ? tags : [kind === "jobs" ? "Job" : "Internship", "Kagie verified"],
      description: String(article.body || article.summary || "Open this opportunity for more details.").trim(),
      requirements: requirements,
      applicationUrl: String(article.applicationUrl || article.application_url || "").trim(),
      fileUrl: String(article.fileUrl || article.file_url || "").trim(),
      imageUrl: String(article.imageUrl || article.image_url || "").trim(),
    };
  }

  function khCareerOpportunitySource(kind) {
    var adminSource = (khState.adminArticles || [])
      .map(khArticleOpportunity)
      .filter(function onlyKind(item) {
        return item && item.kind === kind;
      });
    return adminSource;
  }

  function khAllOpportunities() {
    return khCareerOpportunitySource("internships").concat(khCareerOpportunitySource("jobs"));
  }

  function khFindOpportunity(id) {
    return khAllOpportunities().find(function findItem(item) {
      return item.id === id;
    });
  }

  function khSafeAssetUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "";
    try {
      var parsed = new URL(url, window.location.href);
      return ["http:", "https:", "data:", "blob:"].indexOf(parsed.protocol) > -1
        ? parsed.href
        : "";
    } catch (error) {
      return "";
    }
  }

  function khPaperTitle(paper) {
    return (
      String(
        paper?.title ||
          paper?.paperTitle ||
          paper?.paper_title ||
          paper?.fileName ||
          paper?.file_name ||
          "Question paper"
      ).trim() || "Question paper"
    );
  }

  function khPaperFileUrl(paper) {
    return khSafeAssetUrl(
      paper?.fileUrl ||
        paper?.file_url ||
        paper?.publicUrl ||
        paper?.public_url ||
        paper?.downloadUrl ||
        paper?.download_url ||
        paper?.url ||
        ""
    );
  }

  function khNormalizePaper(paper) {
    var source = paper && typeof paper === "object" ? paper : {};
    return {
      id: String(
        source.id ||
          [
            source.grade,
            source.subject,
            source.year,
            source.term,
            khPaperTitle(source),
          ].join("-")
      ).trim(),
      title: khPaperTitle(source),
      grade: String(source.grade || "").trim(),
      subject: String(source.subject || "").trim(),
      year: String(source.year || "").trim(),
      term: String(source.term || "").trim(),
      province: String(source.province || "National").trim() || "National",
      paperType:
        String(source.paperType || source.paper_type || source.type || "").trim() ||
        "Question Paper",
      status: String(source.status || "Published").trim() || "Published",
      fileUrl: khPaperFileUrl(source),
      updatedAt: String(source.updatedAt || source.updated_at || "").trim(),
    };
  }

  function khNormalizePapers(papers) {
    var seen = new Set();
    return (Array.isArray(papers) ? papers : [])
      .map(khNormalizePaper)
      .filter(function onlyPublished(paper) {
        return paper.status.toLowerCase() === "published";
      })
      .filter(function uniquePaper(paper) {
        var key = [
          paper.grade,
          paper.subject,
          paper.year,
          paper.term,
          paper.paperType,
          paper.title,
          paper.fileUrl,
        ]
          .join("|")
          .toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function khPaperSubjectOptions() {
    var seen = new Set();
    return khPaperSubjects
      .concat(
        khState.paperLibrary.map(function paperSubject(paper) {
          return paper.subject;
        })
      )
      .filter(function uniqueSubject(subject) {
        var value = String(subject || "").trim();
        var key = value.toLowerCase();
        if (!value || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  async function khLoadAdminData() {
    var api = window.KagieAPI;
    if (!api) {
      khState.adminLoaded = true;
      khState.papersLoaded = true;
      return;
    }
    try {
      if (api.restoreSession) await api.restoreSession();
      var results = await Promise.all([
        api.getAdminContentAsync
          ? api.getAdminContentAsync("career_hub").catch(function ignoreContentError() {
              return null;
            })
          : Promise.resolve(null),
        api.getCareerArticlesAsync
          ? api.getCareerArticlesAsync().catch(function showArticleError(error) {
              khState.opportunitiesError = error.message || "Opportunities could not load. Try again.";
              return [];
            })
          : Promise.resolve([]),
        api.getQuestionPapersAsync
          ? api.getQuestionPapersAsync({ status: "Published" }).catch(
              function ignorePaperError(error) {
                khState.papersError =
                  error?.message || "Could not load question papers.";
                return [];
              }
            )
          : Promise.resolve([]),
      ]);
      khState.adminContent = results[0] || null;
      khState.adminArticles = Array.isArray(results[1]) ? results[1] : [];
      khState.paperLibrary = khNormalizePapers(results[2]);
      khState.papersLoaded = true;
      khState.cvRevampFree =
        !khState.adminContent ||
        khState.adminContent.settings?.cvRevampFree !== false;
    } catch (error) {
      console.warn("Career Hub admin content could not be loaded.", error);
    } finally {
      khState.adminLoaded = true;
    }
  }

  function khAdminLandingHtml() {
    var content = khState.adminContent;
    var active = !content || content.status !== "inactive";
    var noticeHtml = "";
    if (content && active) {
      var featuredTopic = String(content.settings?.featuredTopic || "").trim();
      var message = String(content.body || "").trim();
      if (featuredTopic || message) {
        noticeHtml =
          '<aside class="kh-admin-notice" aria-label="Career Hub update">' +
          '<span class="kh-admin-notice__icon">' +
          khIcon("bell", "kh-icon--small") +
          "</span><span>" +
          (featuredTopic
            ? '<strong class="kh-admin-notice__title">' +
              khEscapeHtml(featuredTopic) +
              "</strong>"
            : "") +
          (message
            ? '<span class="kh-admin-notice__text">' +
              khEscapeHtml(message) +
              "</span>"
            : "") +
          "</span></aside>";
      }
    }
    var articles = active
      ? khState.adminArticles.filter(function publishedArticle(article) {
          return (
            article &&
            article.status === "published" &&
            article.title &&
            !khArticleType(article)
          );
        })
      : [];
    if (!articles.length) return noticeHtml;
    var cards = articles
      .slice(0, 6)
      .map(function renderAdminResource(article) {
        var imageUrl = khSafeAssetUrl(article.imageUrl);
        var fileUrl = khSafeAssetUrl(article.fileUrl);
        return (
          '<article class="kh-resource-card">' +
          (imageUrl
            ? '<img class="kh-resource-card__image" src="' +
              khEscapeHtml(imageUrl) +
              '" alt="">'
            : '<span class="kh-resource-card__icon">' +
              khIcon("file") +
              "</span>") +
          '<div class="kh-resource-card__copy">' +
          '<strong class="kh-resource-card__title">' +
          khEscapeHtml(article.title) +
          "</strong>" +
          '<span class="kh-resource-card__text">' +
          khEscapeHtml(article.summary || article.body || "Career guidance from Kagie.") +
          "</span>" +
          (fileUrl
            ? '<a class="kh-resource-card__link" href="' +
              khEscapeHtml(fileUrl) +
              '" target="_blank" rel="noopener">Open resource ' +
              khIcon("arrow-right", "kh-icon--small") +
              "</a>"
            : "") +
          "</div></article>"
        );
      })
      .join("");
    return (
      noticeHtml +
      '<section class="kh-resource-section" aria-labelledby="kh-resource-heading">' +
      '<div class="kh-section-heading"><div><h2 class="kh-section-heading__title" id="kh-resource-heading">Career resources</h2>' +
      '<p class="kh-section-heading__text">Official guidance and resources</p></div></div>' +
      '<div class="kh-resource-list">' +
      cards +
      "</div></section>"
    );
  }

  function khInjectStylesheet() {
    if (document.getElementById("kh-career-hub-styles")) {
      return;
    }
    var stylesheetUrl = "css/career-hub-ui.css?v=20261014-palette-blue";
    if (khScriptSource) {
      try {
        stylesheetUrl = new URL(
          "../css/career-hub-ui.css?v=20261014-palette-blue",
          khScriptSource
        ).href;
      } catch (error) {
        stylesheetUrl = "css/career-hub-ui.css?v=20261014-palette-blue";
      }
    }
    var stylesheetLink = document.createElement("link");
    stylesheetLink.id = "kh-career-hub-styles";
    stylesheetLink.rel = "stylesheet";
    stylesheetLink.href = stylesheetUrl;
    document.head.appendChild(stylesheetLink);
  }

  function khRouteFromHash() {
    var hash = window.location.hash || "";
    if (hash.indexOf("#kh-detail/") === 0) {
      var detailId = decodeURIComponent(hash.slice("#kh-detail/".length));
      if (khFindOpportunity(detailId)) {
        khState.selectedOpportunityId = detailId;
        return "detail";
      }
    }
    var route = hash.replace(/^#kh-/, "");
    var validRoutes = [
      "career",
      "internships",
      "jobs",
      "papers",
      "cv",
      "cover",
      "generated",
      "apply",
      "tracker",
      "saved",
      "notifications",
    ];
    return validRoutes.indexOf(route) > -1 ? route : "career";
  }

  function khHashForRoute(route) {
    if (route === "detail") {
      return "#kh-detail/" + encodeURIComponent(khState.selectedOpportunityId);
    }
    return "#kh-" + route;
  }

  function khIsMoreServicePage() {
    return String(window.location.pathname || "")
      .replace(/\\/g, "/")
      .toLowerCase()
      .indexOf("/more-service/") > -1;
  }

  function khPageHref(path) {
    var targetPath = String(path || "home.html");
    if (/^(https?:|mailto:|tel:|#)/i.test(targetPath)) {
      return targetPath;
    }
    if (!khIsMoreServicePage()) {
      return targetPath;
    }
    if (targetPath.indexOf("more-service/") === 0) {
      return targetPath.replace(/^more-service\//, "");
    }
    return "../" + targetPath;
  }

  function khNavigate(route, options) {
    var navigationOptions = options || {};
    if (route === "detail" && navigationOptions.id) {
      khState.selectedOpportunityId = navigationOptions.id;
      khState.detailReturnRoute =
        navigationOptions.returnRoute ||
        (khFindOpportunity(navigationOptions.id) || {}).kind ||
        "internships";
    }
    if (route === "apply") {
      khState.applyTargetId =
        navigationOptions.id ||
        khState.selectedOpportunityId ||
        khState.applyTargetId;
    }
    khState.route = route;
    var nextHash = khHashForRoute(route);
    if (navigationOptions.replace) {
      window.history.replaceState({ khRoute: route }, "", nextHash);
    } else if (window.location.hash !== nextHash) {
      window.history.pushState({ khRoute: route }, "", nextHash);
    }
    khRender();
    window.scrollTo(0, 0);
    if (khRefs.main) {
      khRefs.main.scrollTop = 0;
    }
    window.requestAnimationFrame(function focusPageTitle() {
      var title = document.getElementById("kh-page-title");
      if (title) {
        title.setAttribute("tabindex", "-1");
        title.focus({ preventScroll: true });
      }
    });
  }

  function khHeader(config) {
    var backControl = config.back
      ? '<button class="kh-icon-button" type="button" data-kh-action="back" aria-label="Go back">' +
        khIcon("arrow-left") +
        "</button>"
      : '<button class="kh-icon-button" type="button" data-kh-action="go-home" aria-label="Return to Kagie home">' +
        khIcon("arrow-left") +
        "</button>";
    var rightControl =
      config.right ||
      '<span class="kh-icon-button kh-icon-button--placeholder" aria-hidden="true"></span>';
    return (
      '<div class="kh-topbar' +
      (config.landing ? " kh-topbar--landing" : "") +
      '">' +
      backControl +
      '<div class="kh-topbar__copy">' +
      '<h1 class="kh-topbar__title" id="kh-page-title">' +
      khEscapeHtml(config.title) +
      "</h1>" +
      (config.subtitle
        ? '<p class="kh-topbar__subtitle">' +
          khEscapeHtml(config.subtitle) +
          "</p>"
        : "") +
      "</div>" +
      rightControl +
      "</div>"
    );
  }

  function khBottomNav() {
    return (
      '<nav class="bottom-nav kagie-shared-bottom-nav" aria-label="Primary">' +
      '<a class="bottom-nav-item" href="' +
      khPageHref("home.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">home</span><span class="bottom-nav-label">App Home</span></a>' +
      '<a class="bottom-nav-item active" href="#kh-career" data-kh-route="career" aria-current="page"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">business_center</span><span class="bottom-nav-label">Plan Career</span></a>' +
      '<a class="bottom-nav-item" href="' +
      khPageHref("recommendation.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">school</span><span class="bottom-nav-label">Match Courses</span></a>' +
      '<a class="bottom-nav-item" href="' +
      khPageHref("more-service/accommodation-assist.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">apartment</span><span class="bottom-nav-label">Housing</span></a>' +
      '<a class="bottom-nav-item" href="' +
      khPageHref("more-service/transport-assist.html") +
      '"><span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">directions_bus</span><span class="bottom-nav-label">Transport</span></a>' +
      "</nav>"
    );
  }

  function khRenderCareerLanding() {
    var unreadCount = khNotifications.filter(function countUnread(notification) {
      return !khState.readNotifications.has(notification.id);
    }).length;
    var menuItems = [
      {
        route: "internships",
        icon: "bell",
        title: "Internship Updates",
        description: "Find the latest internship opportunities",
      },
      {
        route: "jobs",
        icon: "briefcase",
        title: "Job Updates",
        description: "Browse jobs, learnerships & more",
      },
      {
        route: "cv",
        icon: "file",
        title: "CV Revamp",
        description: "Improve your CV with experts",
      },
      {
        route: "cover",
        icon: "pen",
        title: "Cover Letter Generator",
        description: "Create professional cover letters",
      },
      {
        route: "apply",
        icon: "user-search",
        title: "Apply for Me",
        description: "We help you apply",
      },
      {
        route: "tracker",
        icon: "clock",
        title: "Application Tracker",
        description: "Track all your applications",
      },
      {
        route: "saved",
        icon: "heart",
        title: "Saved Opportunities",
        description: "View your saved jobs & internships",
      },
      {
        route: "notifications",
        icon: "bell",
        title: "Notifications",
        description: "Stay updated on new opportunities",
        badge: unreadCount,
      },
    ];
    var menuHtml = menuItems
      .map(function renderMenuItem(item) {
        return (
          '<button class="kh-menu-card" type="button" data-kh-route="' +
          item.route +
          '">' +
          '<span class="kh-menu-card__icon">' +
          khIcon(item.icon, "kh-icon--small") +
          "</span>" +
          "<span>" +
          '<span class="kh-menu-card__title">' +
          khEscapeHtml(item.title) +
          "</span>" +
          '<span class="kh-menu-card__description">' +
          khEscapeHtml(item.description) +
          "</span>" +
          "</span>" +
          '<span class="kh-menu-card__tail">' +
          (item.badge
            ? '<span class="kh-count-badge" aria-label="' +
              item.badge +
              ' unread">' +
              item.badge +
              "</span>"
            : khIcon("arrow-right", "kh-icon--small")) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    khRefs.main.classList.add("kh-main--landing");
    khRefs.header.innerHTML = khHeader({
      title: "Career Hub",
      subtitle: "Your future. Our mission.",
      landing: true,
      right:
        '<button class="kh-icon-button" type="button" data-kh-route="saved" aria-label="View saved opportunities">' +
        khIcon("heart") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<section class="kh-page kh-page--landing" aria-labelledby="kh-page-title">' +
      '<div class="kh-hero">' +
      '<p class="kh-hero__eyebrow">Kagie Career Hub</p>' +
      '<h2 class="kh-hero__title">Find. Prepare. Apply.</h2>' +
      '<p class="kh-hero__text">We help you land the right opportunities.</p>' +
      '<div class="kh-hero__art" aria-hidden="true">' +
      khIcon("career") +
      "</div>" +
      "</div>" +
      '<div class="kh-menu" aria-label="Career Hub services">' +
      menuHtml +
      "</div>" +
      "</section>";
  }

  function khOpportunityFilters(kind) {
    if (kind === "jobs") {
      return [
        ["all", "All Jobs"],
        ["entry", "Entry Level"],
        ["gauteng", "Gauteng"],
        ["remote", "Remote"],
        ["technology", "Technology"],
      ];
    }
    return [
      ["all", "All Fields"],
      ["gauteng", "Gauteng"],
      ["hybrid", "Hybrid"],
      ["closing", "Closing Soon"],
      ["technology", "Technology"],
    ];
  }

  function khFilterOpportunities(kind) {
    var source = khCareerOpportunitySource(kind);
    var search = (khState.searches[kind] || "").trim().toLowerCase();
    var filter = khState.filters[kind] || "all";
    return source.filter(function filterOpportunity(item, index) {
      var searchText = [
        item.title,
        item.company,
        item.location,
        item.category,
        item.type,
        item.workMode,
      ]
        .join(" ")
        .toLowerCase();
      var matchesSearch = !search || searchText.indexOf(search) > -1;
      var matchesFilter = true;
      if (filter === "entry") {
        matchesFilter = String(item.level || "").toLowerCase().indexOf("entry") > -1;
      } else if (filter === "gauteng") {
        matchesFilter = String(item.location || "").toLowerCase().indexOf("gauteng") > -1;
      } else if (filter === "remote") {
        matchesFilter = String(item.workMode || "").toLowerCase() === "remote";
      } else if (filter === "hybrid") {
        matchesFilter = String(item.workMode || "").toLowerCase() === "hybrid";
      } else if (filter === "closing") {
        matchesFilter = index < 2;
      } else if (filter === "technology") {
        matchesFilter = String(item.category || "").toLowerCase() === "technology";
      }
      return matchesSearch && matchesFilter;
    });
  }

  function khOpportunityCard(item, origin) {
    var saved = khState.bookmarks.has(item.id);
    var firstTag = item.tags && item.tags[0] ? item.tags[0] : item.category;
    var secondTag = item.tags && item.tags[1] ? item.tags[1] : item.workMode;
    return (
      '<article class="kh-opportunity-card">' +
      (khSafeAssetUrl(item.imageUrl) ? '<img class="kh-opportunity-image" src="' + khEscapeHtml(khSafeAssetUrl(item.imageUrl)) + '" alt="' + khEscapeHtml(item.company + ' opportunity') + '" loading="lazy">' : '') +
      '<div class="kh-opportunity-card__top">' +
      '<div class="kh-brand-mark ' +
      khEscapeHtml(item.brandStyle || "") +
      '" aria-hidden="true">' +
      khEscapeHtml(item.brand) +
      "</div>" +
      "<div>" +
      '<button class="kh-card-title-button" type="button" data-kh-action="open-detail" data-kh-id="' +
      khEscapeHtml(item.id) +
      '" data-kh-origin="' +
      khEscapeHtml(origin || item.kind) +
      '">' +
      khEscapeHtml(item.title) +
      "</button>" +
      '<p class="kh-opportunity-card__company">' +
      khEscapeHtml(item.company) +
      "</p>" +
      '<div class="kh-opportunity-card__meta">' +
      '<span class="kh-meta-item">' +
      khIcon("pin", "kh-icon--small") +
      khEscapeHtml(item.location) +
      "</span>" +
      '<span class="kh-meta-item">' +
      khIcon("briefcase", "kh-icon--small") +
      khEscapeHtml(item.workMode) +
      "</span>" +
      "</div>" +
      '<div class="kh-tags">' +
      '<span class="kh-tag">' +
      khEscapeHtml(firstTag) +
      "</span>" +
      '<span class="kh-tag kh-tag--navy">' +
      khEscapeHtml(secondTag) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<button class="kh-bookmark-button" type="button" data-kh-action="bookmark" data-kh-id="' +
      khEscapeHtml(item.id) +
      '" aria-label="' +
      (saved ? "Remove from saved opportunities" : "Save opportunity") +
      '" aria-pressed="' +
      saved +
      '">' +
      khIcon("bookmark", "kh-icon--small", saved) +
      "</button>" +
      "</div>" +
      '<div class="kh-opportunity-card__footer">' +
      '<span class="kh-closing"><strong>' +
      khEscapeHtml(item.closingShort) +
      "</strong></span>" +
      '<button class="kh-button kh-button--small" type="button" data-kh-action="open-detail" data-kh-id="' +
      khEscapeHtml(item.id) +
      '" data-kh-origin="' +
      khEscapeHtml(origin || item.kind) +
      '">View &amp; Apply</button>' +
      "</div>" +
      "</article>"
    );
  }

  function khOpportunityResultsHtml(kind) {
    if (khState.opportunitiesError) return '<div class="kh-empty-state" role="alert"><p>' + khEscapeHtml(khState.opportunitiesError) + '</p><button class="kh-button" type="button" onclick="location.reload()">Try again</button></div>';
    var items = khFilterOpportunities(kind);
    var sourceCount = khCareerOpportunitySource(kind).length;
    var listHtml = items.length
      ? items
          .map(function renderOpportunity(item) {
            return khOpportunityCard(item, kind);
          })
          .join("")
      : '<div class="kh-empty-state">' +
        '<div class="kh-empty-state__icon">' +
        khIcon("search", "kh-icon--large") +
        "</div>" +
        '<h2 class="kh-empty-state__title">No opportunities found</h2>' +
        '<p class="kh-empty-state__text">Try another search or clear the selected filter.</p>' +
        '<button class="kh-button kh-button--secondary" type="button" data-kh-action="reset-opportunity-filters" data-kh-kind="' +
        kind +
        '">Clear filters</button>' +
        "</div>";
    return (
      '<div class="kh-results-meta" id="kh-results-meta">' +
      "<span><strong>" +
      items.length +
      "</strong> of " +
      sourceCount +
      " opportunities</span>" +
      "<span>Newest first</span>" +
      "</div>" +
      '<div class="kh-opportunity-list" id="kh-results-list">' +
      listHtml +
      "</div>"
    );
  }

  function khRenderOpportunityResults(kind) {
    var results = document.getElementById("kh-results");
    if (results) {
      results.innerHTML = khOpportunityResultsHtml(kind);
    }
    var chips = khRefs.main.querySelectorAll("[data-kh-filter-kind]");
    chips.forEach(function updateChip(chip) {
      chip.setAttribute(
        "aria-pressed",
        String(chip.getAttribute("data-kh-filter-value") === khState.filters[kind])
      );
    });
  }

  function khRenderOpportunitiesScreen(kind) {
    var isJobs = kind === "jobs";
    var title = isJobs ? "Job Updates" : "Internship Updates";
    var placeholder = isJobs
      ? "Search jobs or companies"
      : "Search internships";
    var filters = khOpportunityFilters(kind)
      .map(function renderFilter(filter) {
        var value = filter[0];
        var label = filter[1];
        return (
          '<button class="kh-filter-chip" type="button" data-kh-action="opportunity-filter" data-kh-filter-kind="' +
          kind +
          '" data-kh-filter-value="' +
          value +
          '" aria-pressed="' +
          (khState.filters[kind] === value) +
          '">' +
          khEscapeHtml(label) +
          "</button>"
        );
      })
      .join("");
    khRefs.header.innerHTML = khHeader({
      title: title,
      back: true,
      right:
        '<button class="kh-icon-button" type="button" data-kh-action="focus-filters" aria-label="Show filters">' +
        khIcon("filter") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-search-wrap">' +
      khIcon("search") +
      '<label class="kh-visually-hidden" for="kh-search-input">Search ' +
      khEscapeHtml(title) +
      "</label>" +
      '<input class="kh-search-input" id="kh-search-input" type="search" autocomplete="off" placeholder="' +
      khEscapeHtml(placeholder) +
      '" value="' +
      khEscapeHtml(khState.searches[kind]) +
      '" data-kh-search-kind="' +
      kind +
      '">' +
      (khState.searches[kind]
        ? '<button class="kh-search-clear" type="button" data-kh-action="clear-search" data-kh-kind="' +
          kind +
          '" aria-label="Clear search">' +
          khIcon("close", "kh-icon--small") +
          "</button>"
        : "") +
      "</div>" +
      '<div class="kh-filter-row" aria-label="' +
      khEscapeHtml(title) +
      ' filters">' +
      filters +
      "</div>" +
      '<div id="kh-results">' +
      khOpportunityResultsHtml(kind) +
      "</div>" +
      "</section>";
  }

  async function khRefreshQuestionPapers() {
    var api = window.KagieAPI;
    khState.papersLoading = true;
    khState.papersError = "";
    if (khState.route === "papers") {
      khRenderPaperResults();
    }
    try {
      if (!api || !api.getQuestionPapersAsync) {
        khState.paperLibrary = [];
        khState.papersError = "Question papers are not available right now.";
      } else {
        var papers = await api.getQuestionPapersAsync({ status: "Published" });
        khState.paperLibrary = khNormalizePapers(papers);
        khState.papersError = "";
      }
    } catch (error) {
      khState.paperLibrary = [];
      khState.papersError =
        error?.message || "Could not load published question papers.";
    } finally {
      khState.papersLoaded = true;
      khState.papersLoading = false;
      if (khState.route === "papers") {
        khRenderPaperResults();
      }
    }
  }

  function khFilteredQuestionPapers() {
    var search = khState.paperSearch.trim().toLowerCase();
    var grade = khState.paperFilters.grade;
    var subject = khState.paperFilters.subject;
    return khState.paperLibrary.filter(function filterPaper(paper) {
      if (grade && paper.grade !== grade) return false;
      if (subject && paper.subject !== subject) return false;
      if (search) {
        var haystack = [
          paper.title,
          paper.grade,
          paper.subject,
          paper.year,
          paper.term,
          paper.province,
          paper.paperType,
        ]
          .join(" ")
          .toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });
  }

  function khSelectOptions(options, selected, emptyLabel) {
    return (
      '<option value="">' +
      khEscapeHtml(emptyLabel) +
      "</option>" +
      options
        .map(function renderOption(option) {
          return (
            '<option value="' +
            khEscapeHtml(option) +
            '"' +
            (selected === option ? " selected" : "") +
            ">" +
            khEscapeHtml(option) +
            "</option>"
          );
        })
        .join("")
    );
  }

  function khPaperCard(paper) {
    var gradeMark = paper.grade ? paper.grade.replace("Grade ", "G") : "PDF";
    var fileControl = paper.fileUrl
      ? '<a class="kh-paper-card__download" href="' +
        khEscapeHtml(paper.fileUrl) +
        '" target="_blank" rel="noopener" download>' +
        khIcon("download", "kh-icon--small") +
        "Download PDF</a>"
      : '<button class="kh-paper-card__download kh-paper-card__download--disabled" type="button" disabled>' +
        khIcon("file", "kh-icon--small") +
        "No PDF yet</button>";
    return (
      '<article class="kh-paper-card">' +
      '<span class="kh-paper-card__mark" aria-hidden="true">' +
      khEscapeHtml(gradeMark) +
      "</span>" +
      '<div class="kh-paper-card__copy">' +
      '<span class="kh-paper-card__eyebrow">' +
      khEscapeHtml([paper.grade, paper.subject].filter(Boolean).join(" / ")) +
      "</span>" +
      '<h2 class="kh-paper-card__title">' +
      khEscapeHtml(paper.title) +
      "</h2>" +
      '<p class="kh-paper-card__meta">' +
      khEscapeHtml(
        [paper.year, paper.term, paper.province].filter(Boolean).join(" / ")
      ) +
      "</p>" +
      '<div class="kh-tags">' +
      '<span class="kh-tag">' +
      khEscapeHtml(paper.paperType) +
      "</span>" +
      '<span class="kh-tag kh-tag--navy">Published</span>' +
      "</div>" +
      "</div>" +
      fileControl +
      "</article>"
    );
  }

  function khPaperResultsHtml() {
    if (khState.papersLoading) {
      return (
        '<div class="kh-results-meta"><span>Loading published papers...</span><span>Grade 8-12</span></div>' +
        '<div class="kh-empty-state kh-empty-state--compact">' +
        '<div class="kh-empty-state__icon">' +
        khIcon("document-search", "kh-icon--large") +
        "</div>" +
        '<h2 class="kh-empty-state__title">Getting papers ready</h2>' +
        '<p class="kh-empty-state__text">Please wait while Kagie checks the latest published uploads.</p>' +
        "</div>"
      );
    }
    if (khState.papersError) {
      return (
        '<div class="kh-empty-state">' +
        '<div class="kh-empty-state__icon">' +
        khIcon("file", "kh-icon--large") +
        "</div>" +
        '<h2 class="kh-empty-state__title">Papers could not load</h2>' +
        '<p class="kh-empty-state__text">' +
        khEscapeHtml(khState.papersError) +
        "</p>" +
        '<button class="kh-button kh-button--secondary" type="button" data-kh-action="refresh-papers">Try again</button>' +
        "</div>"
      );
    }
    var papers = khFilteredQuestionPapers();
    var paperCards = papers.length
      ? papers.map(khPaperCard).join("")
      : '<div class="kh-empty-state">' +
        '<div class="kh-empty-state__icon">' +
        khIcon("search", "kh-icon--large") +
        "</div>" +
        '<h2 class="kh-empty-state__title">No papers found</h2>' +
        '<p class="kh-empty-state__text">Try a different grade, subject, or search phrase.</p>' +
        '<button class="kh-button kh-button--secondary" type="button" data-kh-action="reset-paper-filters">Clear filters</button>' +
        "</div>";
    return (
      '<div class="kh-results-meta" id="kh-paper-results-meta">' +
      "<span><strong>" +
      papers.length +
      "</strong> of " +
      khState.paperLibrary.length +
      " published papers</span>" +
      "<span>Newest uploads first</span>" +
      "</div>" +
      '<div class="kh-paper-list">' +
      paperCards +
      "</div>"
    );
  }

  function khRenderPaperResults() {
    var results = document.getElementById("kh-paper-results");
    if (results) {
      results.innerHTML = khPaperResultsHtml();
    }
  }

  function khRenderPapers() {
    var subjectOptions = khPaperSubjectOptions();
    khRefs.header.innerHTML = khHeader({
      title: "Question Papers",
      subtitle: "Grade 8-12 DBE library",
      back: true,
      right:
        '<button class="kh-icon-button" type="button" data-kh-action="refresh-papers" aria-label="Refresh question papers">' +
        khIcon("download") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-intro-card kh-intro-card--papers">' +
      "<div>" +
      '<h2 class="kh-intro-card__title">Past papers inside Kagie</h2>' +
      '<p class="kh-intro-card__text">Download official Grade 8-12 question papers, memos and study guides available through Kagie.</p>' +
      "</div>" +
      '<div class="kh-intro-card__art">' +
      khIcon("document-search", "kh-icon--large") +
      "</div>" +
      "</div>" +
      '<div class="kh-search-wrap">' +
      khIcon("search") +
      '<label class="kh-visually-hidden" for="kh-paper-search">Search question papers</label>' +
      '<input class="kh-search-input" id="kh-paper-search" type="search" autocomplete="off" placeholder="Search title, province, year..." value="' +
      khEscapeHtml(khState.paperSearch) +
      '" data-kh-paper-search>' +
      (khState.paperSearch
        ? '<button class="kh-search-clear" type="button" data-kh-action="clear-paper-search" aria-label="Clear paper search">' +
          khIcon("close", "kh-icon--small") +
          "</button>"
        : "") +
      "</div>" +
      '<div class="kh-paper-filters" aria-label="Question paper filters">' +
      '<label class="kh-select-field"><span>Grade</span><select data-kh-paper-filter="grade">' +
      khSelectOptions(khPaperGrades, khState.paperFilters.grade, "All grades") +
      "</select></label>" +
      '<label class="kh-select-field"><span>Subject</span><select data-kh-paper-filter="subject">' +
      khSelectOptions(
        subjectOptions,
        khState.paperFilters.subject,
        "All subjects"
      ) +
      "</select></label>" +
      "</div>" +
      '<div id="kh-paper-results">' +
      khPaperResultsHtml() +
      "</div>" +
      "</section>";
    if (!khState.papersLoaded && !khState.papersLoading) {
      khRefreshQuestionPapers();
    }
  }

  function khRequirementsList(requirements) {
    return requirements
      .map(function renderRequirement(requirement) {
        return (
          '<li class="kh-check-list__item">' +
          '<span class="kh-check-list__icon">' +
          khIcon("check", "kh-icon--small") +
          "</span>" +
          "<span>" +
          khEscapeHtml(requirement) +
          "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function khRenderDetail() {
    var item = khFindOpportunity(khState.selectedOpportunityId);
    if (!item) {
      khNavigate("career", { replace: true });
      return;
    }
    var saved = khState.bookmarks.has(item.id);
    khRefs.header.innerHTML = khHeader({
      title: item.kind === "jobs" ? "Job Details" : "Internship Details",
      back: true,
      right:
        '<button class="kh-icon-button" type="button" data-kh-action="share-opportunity" aria-label="Share opportunity">' +
        khIcon("share") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<article class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-detail-hero">' +
      '<span class="kh-detail-hero__brand">' +
      khEscapeHtml(item.brand) +
      "</span>" +
      '<h2 class="kh-detail-hero__title">' +
      khEscapeHtml(item.title) +
      "</h2>" +
      '<div class="kh-detail-hero__meta">' +
      '<span class="kh-meta-item">' +
      khIcon("pin", "kh-icon--small") +
      khEscapeHtml(item.location) +
      "</span>" +
      '<span class="kh-meta-item">' +
      khIcon("briefcase", "kh-icon--small") +
      khEscapeHtml(item.type) +
      "</span>" +
      '<span class="kh-meta-item">' +
      khIcon("building", "kh-icon--small") +
      khEscapeHtml(item.category) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="kh-info-grid" aria-label="Opportunity information">' +
      khInfoItem("calendar", "Closing date", item.closing) +
      khInfoItem("clock", "Posted", item.posted) +
      khInfoItem("calendar", "Start date", item.startDate) +
      khInfoItem("briefcase", "Duration", item.duration) +
      "</div>" +
      '<section class="kh-content-section">' +
      '<h2 class="kh-content-section__title">About the role</h2>' +
      '<p class="kh-content-section__text">' +
      khEscapeHtml(item.description) +
      "</p>" +
      "</section>" +
      '<section class="kh-content-section">' +
      '<h2 class="kh-content-section__title">Requirements</h2>' +
      '<ul class="kh-check-list">' +
      khRequirementsList(item.requirements) +
      "</ul>" +
      "</section>" +
      '<div class="kh-detail-actions">' +
      '<button class="kh-button kh-button--wide" type="button" data-kh-action="apply" data-kh-id="' +
      khEscapeHtml(item.id) +
      '">Apply Now</button>' +
      (item.applicationUrl
        ? '<button class="kh-button kh-button--secondary kh-button--wide" type="button" data-kh-action="go-external" data-kh-href="' +
          khEscapeHtml(item.applicationUrl) +
          '">Open official link</button>'
        : "") +
      '<button class="kh-button kh-button--secondary kh-button--wide" type="button" data-kh-action="bookmark" data-kh-id="' +
      khEscapeHtml(item.id) +
      '" aria-pressed="' +
      saved +
      '">' +
      khIcon("bookmark", "kh-icon--small", saved) +
      (saved ? "Saved" : "Save") +
      "</button>" +
      "</div>" +
      "</article>";
  }

  function khInfoItem(iconName, label, value) {
    return (
      '<div class="kh-info-item">' +
      '<span class="kh-info-item__icon">' +
      khIcon(iconName, "kh-icon--small") +
      "</span>" +
      "<span>" +
      '<span class="kh-info-item__label">' +
      khEscapeHtml(label) +
      "</span>" +
      '<span class="kh-info-item__value">' +
      khEscapeHtml(value) +
      "</span>" +
      "</span>" +
      "</div>"
    );
  }

  function khFileSize(bytes) {
    if (!bytes && bytes !== 0) {
      return "";
    }
    if (bytes < 1024 * 1024) {
      return Math.max(1, Math.round(bytes / 1024)) + " KB";
    }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function khCvServiceCard(value, title, description, price) {
    return (
      '<label class="kh-choice-card">' +
      '<input class="kh-radio-input" type="radio" name="kh-cv-service" value="' +
      value +
      '" data-kh-cv-service="' +
      value +
      '"' +
      (khState.cvService === value ? " checked" : "") +
      ">" +
      "<span>" +
      '<span class="kh-choice-card__title">' +
      khEscapeHtml(title) +
      "</span>" +
      '<span class="kh-choice-card__text">' +
      khEscapeHtml(description) +
      "</span>" +
      "</span>" +
      '<span class="kh-choice-card__price">' +
      khEscapeHtml(price) +
      "</span>" +
      "</label>"
    );
  }

  function khRenderCv() {
    khRefs.header.innerHTML = khHeader({
      title: "CV Revamp",
      back: true,
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-intro-card">' +
      "<div>" +
      '<h2 class="kh-intro-card__title">Make your CV stand out</h2>' +
      '<p class="kh-intro-card__text">Upload your CV and let our experts improve the structure, wording and impact.</p>' +
      '<span class="kh-free-badge">100% Free</span>' +
      "</div>" +
      '<div class="kh-intro-card__art">' +
      khIcon("check-circle", "kh-icon--large") +
      "</div>" +
      "</div>" +
      '<button class="kh-button kh-button--secondary kh-button--wide" type="button" data-kh-action="open-cv-builder">' +
      khIcon("file", "kh-icon--small") +
      "Build CV from scratch</button>" +
      '<form class="kh-form" id="kh-cv-form">' +
      '<label class="kh-upload-zone" id="kh-upload-zone" for="kh-cv-file">' +
      '<input class="kh-file-input" id="kh-cv-file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">' +
      "<span>" +
      '<span class="kh-upload-zone__icon">' +
      khIcon("upload") +
      "</span>" +
      '<span class="kh-upload-zone__title">' +
      (khState.cvFile ? "CV selected" : "Tap to upload your CV") +
      "</span>" +
      '<span class="kh-upload-zone__text">PDF, DOC or DOCX · maximum 10 MB</span>' +
      (khState.cvFile
        ? '<span class="kh-upload-zone__file">' +
          khIcon("file", "kh-icon--small") +
          khEscapeHtml(khState.cvFile.name) +
          " · " +
          khEscapeHtml(khFileSize(khState.cvFile.size)) +
          "</span>"
        : "") +
      "</span>" +
      "</label>" +
      '<div class="kh-section-heading">' +
      "<div>" +
      '<h2 class="kh-section-heading__title">Choose a service</h2>' +
      '<p class="kh-section-heading__text">Select the support that fits your needs</p>' +
      "</div>" +
      "</div>" +
      '<div class="kh-choice-list">' +
      khCvServiceCard(
        "basic",
        "Basic CV Cleanup",
        "Formatting and spelling corrections",
        "Free"
      ) +
      khCvServiceCard(
        "professional",
        "Professional CV Revamp",
        "Complete rewrite for stronger impact",
        "Free"
      ) +
      khCvServiceCard(
        "student",
        "Student CV",
        "Built for bursaries and first roles",
        "Free"
      ) +
      khCvServiceCard(
        "graduate",
        "Graduate CV",
        "Position your qualification and skills",
        "Free"
      ) +
      "</div>" +
      '<button class="kh-button kh-button--wide" type="submit">Submit Free CV Revamp</button>' +
      "</form>" +
      "</section>";
  }

  function khRenderCoverForm() {
    var meta = khState.generatedLetterMeta || {};
    khRefs.header.innerHTML = khHeader({
      title: "Cover Letter Generator",
      back: true,
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-intro-card">' +
      "<div>" +
      '<h2 class="kh-intro-card__title">Create a tailored cover letter</h2>' +
      '<p class="kh-intro-card__text">Fill in your details and we will prepare a professional letter for you.</p>' +
      "</div>" +
      '<div class="kh-intro-card__art">' +
      khIcon("sparkles", "kh-icon--large") +
      "</div>" +
      "</div>" +
      '<form class="kh-form" id="kh-cover-form">' +
      '<div class="kh-form-card kh-form">' +
      khFormField(
        "kh-cover-name",
        "kh-full-name",
        "Full name",
        "e.g. Lerato Molefe",
        meta.fullName || "",
        true
      ) +
      khFormField(
        "kh-cover-field",
        "kh-field-of-study",
        "Field of study",
        "e.g. Information Technology",
        meta.fieldOfStudy || "",
        true
      ) +
      khFormField(
        "kh-cover-role",
        "kh-role-title",
        "Job / internship title",
        "e.g. Software Engineering Intern",
        meta.roleTitle || "",
        true
      ) +
      khFormField(
        "kh-cover-company",
        "kh-company-name",
        "Company name",
        "e.g. Microsoft",
        meta.companyName || "",
        true
      ) +
      '<div class="kh-field">' +
      '<label class="kh-field__label" for="kh-cover-strengths">Strengths to highlight <span class="kh-muted">(optional)</span></label>' +
      '<textarea class="kh-field__control" id="kh-cover-strengths" name="kh-strengths" placeholder="e.g. teamwork, coding, leadership">' +
      khEscapeHtml(meta.strengths || "") +
      "</textarea>" +
      "</div>" +
      "</div>" +
      '<p class="kh-form-help">Your information is used only to create this letter.</p>' +
      '<button class="kh-button kh-button--wide" type="submit">' +
      khIcon("sparkles", "kh-icon--small") +
      "Generate Cover Letter</button>" +
      "</form>" +
      "</section>";
  }

  function khFormField(
    id,
    name,
    label,
    placeholder,
    value,
    required
  ) {
    return (
      '<div class="kh-field">' +
      '<label class="kh-field__label" for="' +
      id +
      '">' +
      khEscapeHtml(label) +
      "</label>" +
      '<input class="kh-field__control" id="' +
      id +
      '" name="' +
      name +
      '" type="text" placeholder="' +
      khEscapeHtml(placeholder) +
      '" value="' +
      khEscapeHtml(value) +
      '"' +
      (required ? " required" : "") +
      ">" +
      "</div>"
    );
  }

  function khBuildLetter(meta) {
    var today = new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());
    var strengths = meta.strengths
      ? " My strengths in " +
        meta.strengths +
        " would allow me to contribute meaningfully from the outset."
      : "";
    return (
      today +
      "\n\nDear Hiring Manager,\n\n" +
      "I am writing to express my interest in the " +
      meta.roleTitle +
      " opportunity at " +
      meta.companyName +
      ". As a motivated " +
      meta.fieldOfStudy +
      " candidate, I am eager to apply my knowledge, grow through practical experience and contribute to your team." +
      strengths +
      "\n\n" +
      "Throughout my studies, I have developed a disciplined approach to learning, problem-solving and working with others. I am drawn to " +
      meta.companyName +
      " because of its reputation for meaningful work and professional development. I would value the opportunity to bring my energy, curiosity and commitment to the role." +
      "\n\n" +
      "Thank you for considering my application. I would welcome the opportunity to discuss how my background and potential align with your requirements." +
      "\n\nYours sincerely,\n" +
      meta.fullName
    );
  }

  function khRenderGeneratedLetter() {
    if (!khState.generatedLetter) {
      khNavigate("cover", { replace: true });
      return;
    }
    khRefs.header.innerHTML = khHeader({
      title: "Generated Cover Letter",
      back: true,
      right:
        '<button class="kh-icon-button" type="button" data-kh-action="toggle-letter-edit" aria-label="' +
        (khState.letterEditMode ? "Preview cover letter" : "Edit cover letter") +
        '">' +
        khIcon(khState.letterEditMode ? "eye" : "edit") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-progress" aria-label="Cover letter progress">' +
      '<span class="kh-progress__step kh-progress__step--active">Prepare</span>' +
      '<span class="kh-progress__step kh-progress__step--active">Review</span>' +
      '<span class="kh-progress__step">Use</span>' +
      "</div>" +
      '<div class="kh-letter-card">' +
      (khState.letterEditMode
        ? '<label class="kh-visually-hidden" for="kh-letter-editor">Edit generated cover letter</label>' +
          '<textarea class="kh-letter-editor" id="kh-letter-editor" data-kh-letter-editor>' +
          khEscapeHtml(khState.generatedLetter) +
          "</textarea>"
        : '<div class="kh-letter-copy" id="kh-letter-copy">' +
          khEscapeHtml(khState.generatedLetter) +
          "</div>") +
      "</div>" +
      '<div class="kh-action-row">' +
      '<button class="kh-button kh-button--secondary" type="button" data-kh-action="download-letter">' +
      khIcon("download", "kh-icon--small") +
      "Download</button>" +
      '<button class="kh-button kh-button--secondary" type="button" data-kh-action="copy-letter">' +
      khIcon("copy", "kh-icon--small") +
      "Copy</button>" +
      '<button class="kh-button kh-button--secondary" type="button" data-kh-action="share-letter">' +
      khIcon("share", "kh-icon--small") +
      "Share</button>" +
      "</div>" +
      '<button class="kh-button kh-button--ghost kh-button--wide" type="button" data-kh-route="cover">Change details</button>' +
      "</section>";
  }

  function khApplyChoice(value, title, description, price) {
    return (
      '<label class="kh-choice-card">' +
      '<input class="kh-radio-input" type="radio" name="kh-apply-mode" value="' +
      value +
      '" data-kh-apply-mode="' +
      value +
      '"' +
      (khState.applyMode === value ? " checked" : "") +
      ">" +
      "<span>" +
      '<span class="kh-choice-card__title">' +
      khEscapeHtml(title) +
      "</span>" +
      '<span class="kh-choice-card__text">' +
      khEscapeHtml(description) +
      "</span>" +
      "</span>" +
      '<span class="kh-choice-card__price">' +
      khEscapeHtml(price) +
      "</span>" +
      "</label>"
    );
  }

  function khApplyHelpText() {
    if (khState.applyMode === "self") {
      return {
        title: "Apply yourself",
        text: "Kagie will save this opportunity and give you a checklist before you continue to the employer application.",
      };
    }
    if (khState.applyMode === "managed") {
      return {
        title: "Kagie applies for you",
        text: "Our team prepares and submits the application with your approval. We will notify you before anything is sent.",
      };
    }
    return {
      title: "Apply with guidance",
      text: "A Kagie advisor checks your CV and application, then guides you through submission.",
    };
  }

  function khRenderApply() {
    var item =
      khFindOpportunity(khState.applyTargetId) ||
      khFindOpportunity(khState.selectedOpportunityId) ||
      khInternships[0];
    var help = khApplyHelpText();
    khRefs.header.innerHTML = khHeader({
      title: "Apply for Me",
      back: true,
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-apply-summary">' +
      '<div class="kh-brand-mark ' +
      khEscapeHtml(item.brandStyle || "") +
      '">' +
      khEscapeHtml(item.brand) +
      "</div>" +
      "<div>" +
      '<h2 class="kh-apply-summary__title">' +
      khEscapeHtml(item.title) +
      "</h2>" +
      '<p class="kh-apply-summary__text">' +
      khEscapeHtml(item.company + " · " + item.location) +
      "</p>" +
      "</div>" +
      "</div>" +
      '<div class="kh-section-heading">' +
      "<div>" +
      '<h2 class="kh-section-heading__title">Choose how you want to apply</h2>' +
      '<p class="kh-section-heading__text">You stay in control at every step</p>' +
      "</div>" +
      "</div>" +
      '<div class="kh-choice-list">' +
      khApplyChoice(
        "self",
        "Apply Myself",
        "Get the official link and checklist",
        "Free"
      ) +
      khApplyChoice(
        "guided",
        "Kagie Helps Me Apply",
        "Review and step-by-step support",
        "R50"
      ) +
      khApplyChoice(
        "managed",
        "Kagie Applies for Me",
        "We prepare and submit with approval",
        "R100"
      ) +
      "</div>" +
      '<div class="kh-help-card" id="kh-apply-help">' +
      "<strong>" +
      khEscapeHtml(help.title) +
      "</strong>" +
      khEscapeHtml(help.text) +
      "</div>" +
      '<div class="kh-section-heading">' +
      '<h2 class="kh-section-heading__title">What we will need</h2>' +
      "</div>" +
      '<ul class="kh-check-list">' +
      khRequirementsList([
        "Your latest CV",
        "A copy of your ID or passport",
        "Qualification or academic record",
        "Any documents requested by the employer",
      ]) +
      "</ul>" +
      '<hr class="kh-divider">' +
      '<button class="kh-button kh-button--wide" type="button" data-kh-action="review-apply">Continue</button>' +
      "</section>";
  }

  function khCombinedTrackerItems() {
    var merged = khDefaultTrackerItems.concat(khState.trackerItems || []);
    var seen = {};
    return merged.filter(function uniqueTrackerItem(item) {
      if (!item || !item.id || seen[item.id]) {
        return false;
      }
      seen[item.id] = true;
      return true;
    });
  }

  function khTrackerListHtml() {
    var items = khCombinedTrackerItems().filter(function filterTracker(item) {
      return (
        khState.trackerFilter === "all" ||
        item.status === khState.trackerFilter
      );
    });
    if (!items.length) {
      return (
        '<div class="kh-empty-state">' +
        '<div class="kh-empty-state__icon">' +
        khIcon("clipboard", "kh-icon--large") +
        "</div>" +
        '<h2 class="kh-empty-state__title">Nothing here yet</h2>' +
        '<p class="kh-empty-state__text">Applications with this status will appear here.</p>' +
        '<button class="kh-button kh-button--secondary" type="button" data-kh-action="tracker-filter" data-kh-filter-value="all">View all</button>' +
        "</div>"
      );
    }
    return items
      .map(function renderTrackerItem(item) {
        return (
          '<button class="kh-tracker-card" type="button" data-kh-action="open-tracker-item" data-kh-id="' +
          khEscapeHtml(item.opportunityId || "") +
          '">' +
          '<span class="kh-brand-mark ' +
          khEscapeHtml(item.brandStyle || "") +
          '">' +
          khEscapeHtml(item.brand || item.company.slice(0, 2)) +
          "</span>" +
          "<span>" +
          '<span class="kh-tracker-card__title">' +
          khEscapeHtml(item.title) +
          "</span>" +
          '<span class="kh-tracker-card__company">' +
          khEscapeHtml(item.company) +
          "</span>" +
          '<span class="kh-tracker-card__date">' +
          khEscapeHtml(item.date) +
          "</span>" +
          "</span>" +
          '<span class="kh-status kh-status--' +
          khEscapeHtml(item.status) +
          '">' +
          khEscapeHtml(item.statusLabel) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function khRenderTrackerList() {
    var list = document.getElementById("kh-tracker-list");
    if (list) {
      list.innerHTML = khTrackerListHtml();
    }
    var tabs = khRefs.main.querySelectorAll("[data-kh-action='tracker-filter']");
    tabs.forEach(function updateTrackerTab(tab) {
      tab.setAttribute(
        "aria-pressed",
        String(
          tab.getAttribute("data-kh-filter-value") === khState.trackerFilter
        )
      );
    });
  }

  function khRenderTracker() {
    var trackerFilters = [
      ["all", "All"],
      ["saved", "Saved"],
      ["applied", "Applied"],
      ["review", "In review"],
      ["interview", "Interview"],
      ["declined", "Declined"],
    ]
      .map(function renderTrackerFilter(filter) {
        return (
          '<button class="kh-tracker-tab" type="button" data-kh-action="tracker-filter" data-kh-filter-value="' +
          filter[0] +
          '" aria-pressed="' +
          (khState.trackerFilter === filter[0]) +
          '">' +
          khEscapeHtml(filter[1]) +
          "</button>"
        );
      })
      .join("");
    khRefs.header.innerHTML = khHeader({
      title: "Application Tracker",
      back: true,
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      '<div class="kh-tracker-tabs" aria-label="Application status filters">' +
      trackerFilters +
      "</div>" +
      '<div class="kh-tracker-list" id="kh-tracker-list">' +
      khTrackerListHtml() +
      "</div>" +
      "</section>";
  }

  function khRenderSaved() {
    var items = khAllOpportunities().filter(function filterSaved(item) {
      return khState.bookmarks.has(item.id);
    });
    khRefs.header.innerHTML = khHeader({
      title: "Saved Opportunities",
      subtitle:
        items.length === 1 ? "1 saved opportunity" : items.length + " saved",
      back: true,
      right:
        '<button class="kh-icon-button" type="button" data-kh-route="internships" aria-label="Find opportunities">' +
        khIcon("search") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      (items.length
        ? '<div class="kh-opportunity-list">' +
          items
            .map(function renderSavedItem(item) {
              return khOpportunityCard(item, "saved");
            })
            .join("") +
          "</div>"
        : '<div class="kh-empty-state">' +
          '<div class="kh-empty-state__icon">' +
          khIcon("heart", "kh-icon--large") +
          "</div>" +
          '<h2 class="kh-empty-state__title">No saved opportunities yet</h2>' +
          '<p class="kh-empty-state__text">Tap the bookmark on an internship or job to keep it here.</p>' +
          '<button class="kh-button" type="button" data-kh-route="internships">Browse opportunities</button>' +
          "</div>") +
      "</section>";
  }

  function khNotificationItem(notification) {
    var isRead = khState.readNotifications.has(notification.id);
    return (
      '<button class="kh-notification' +
      (isRead ? "" : " kh-notification--unread") +
      '" type="button" data-kh-action="mark-notification" data-kh-id="' +
      khEscapeHtml(notification.id) +
      '" aria-label="' +
      (isRead ? "" : "Unread: ") +
      khEscapeHtml(notification.title) +
      '">' +
      '<span class="kh-notification__icon">' +
      khIcon(notification.icon, "kh-icon--small") +
      "</span>" +
      "<span>" +
      '<span class="kh-notification__title">' +
      khEscapeHtml(notification.title) +
      "</span>" +
      '<span class="kh-notification__text">' +
      khEscapeHtml(notification.text) +
      "</span>" +
      "</span>" +
      '<span class="kh-notification__time">' +
      khEscapeHtml(notification.time) +
      "</span>" +
      "</button>"
    );
  }

  function khRenderNotifications() {
    var groups = ["Today", "Yesterday"];
    var unreadCount = khNotifications.filter(function filterUnread(item) {
      return !khState.readNotifications.has(item.id);
    }).length;
    var groupsHtml = groups
      .map(function renderGroup(group) {
        var groupItems = khNotifications.filter(function filterGroup(item) {
          return item.group === group;
        });
        return (
          '<div class="kh-notification-heading"><span>' +
          group +
          "</span><span>" +
          groupItems.length +
          "</span></div>" +
          '<div class="kh-notification-list">' +
          groupItems.map(khNotificationItem).join("") +
          "</div>"
        );
      })
      .join("");
    khRefs.header.innerHTML = khHeader({
      title: "Notifications",
      subtitle: unreadCount ? unreadCount + " unread" : "You're all caught up",
      back: true,
      right:
        '<button class="kh-icon-button kh-icon-button--red" type="button" data-kh-action="mark-all-read" aria-label="Mark all notifications as read">' +
        khIcon("check-circle") +
        "</button>",
    });
    khRefs.main.innerHTML =
      '<section class="kh-page" aria-labelledby="kh-page-title">' +
      (unreadCount
        ? '<div class="kh-results-meta"><span>Recent activity</span><button class="kh-link-button" type="button" data-kh-action="mark-all-read">Mark all as read</button></div>'
        : "") +
      groupsHtml +
      "</section>";
  }

  function khRender() {
    if (!khRefs.header || !khRefs.main) {
      return;
    }
    khRefs.main.className = "kh-main";
    switch (khState.route) {
      case "internships":
        khRenderOpportunitiesScreen("internships");
        break;
      case "jobs":
        khRenderOpportunitiesScreen("jobs");
        break;
      case "papers":
        khRenderPapers();
        break;
      case "detail":
        khRenderDetail();
        break;
      case "cv":
        khRenderCv();
        break;
      case "cover":
        khRenderCoverForm();
        break;
      case "generated":
        khRenderGeneratedLetter();
        break;
      case "apply":
        khRenderApply();
        break;
      case "tracker":
        khRenderTracker();
        break;
      case "saved":
        khRenderSaved();
        break;
      case "notifications":
        khRenderNotifications();
        break;
      default:
        khState.route = "career";
        khRenderCareerLanding();
        break;
    }
    document.title =
      ((document.getElementById("kh-page-title") || {}).textContent ||
        "Career Hub") + " | Kagie";
  }

  function khShowToast(message, iconName) {
    if (!khRefs.toast) {
      return;
    }
    window.clearTimeout(khToastTimer);
    khRefs.toast.innerHTML =
      khIcon(iconName || "check-circle", "kh-icon--small") +
      "<span>" +
      khEscapeHtml(message) +
      "</span>";
    khRefs.toast.classList.add("kh-toast--show");
    khRefs.toast.setAttribute("aria-hidden", "false");
    if (khRefs.live) {
      khRefs.live.textContent = message;
    }
    khToastTimer = window.setTimeout(function hideToast() {
      khRefs.toast.classList.remove("kh-toast--show");
      khRefs.toast.setAttribute("aria-hidden", "true");
    }, 2800);
  }

  function khPersistBookmarks() {
    khWriteStore("bookmarks", Array.from(khState.bookmarks));
  }

  function khToggleBookmark(id) {
    var item = khFindOpportunity(id);
    if (!item) {
      return;
    }
    var wasSaved = khState.bookmarks.has(id);
    if (wasSaved) {
      khState.bookmarks.delete(id);
    } else {
      khState.bookmarks.add(id);
    }
    khPersistBookmarks();
    khShowToast(
      wasSaved ? "Removed from saved opportunities" : "Opportunity saved",
      wasSaved ? "bookmark" : "check-circle"
    );
    if (
      khState.route === "saved" ||
      khState.route === "detail" ||
      khState.route === "career"
    ) {
      khRender();
    } else if (
      khState.route === "internships" ||
      khState.route === "jobs"
    ) {
      khRenderOpportunityResults(khState.route);
    }
  }

  function khBack() {
    var routeMap = {
      internships: "career",
      jobs: "career",
      papers: "career",
      detail: khState.detailReturnRoute || "internships",
      cv: "career",
      cover: "career",
      generated: "cover",
      apply: khState.selectedOpportunityId ? "detail" : "career",
      tracker: "career",
      saved: "career",
      notifications: "career",
    };
    khNavigate(routeMap[khState.route] || "career");
  }

  function khCopyText(text, successMessage) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(function copied() {
          khShowToast(successMessage || "Copied to clipboard");
        })
        .catch(function fallbackCopy() {
          khLegacyCopy(text, successMessage);
        });
      return;
    }
    khLegacyCopy(text, successMessage);
  }

  function khLegacyCopy(text, successMessage) {
    var textArea = document.createElement("textarea");
    textArea.className = "kh-visually-hidden";
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      khShowToast(successMessage || "Copied to clipboard");
    } catch (error) {
      khShowToast("Copy was not available. Select the text and copy it.");
    }
    textArea.remove();
  }

  function khShareOpportunity() {
    var item = khFindOpportunity(khState.selectedOpportunityId);
    if (!item) {
      return;
    }
    var shareData = {
      title: item.title + " at " + item.company,
      text:
        "Take a look at this " +
        (item.kind === "jobs" ? "job" : "internship") +
        " on Kagie: " +
        item.title +
        " at " +
        item.company,
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(function ignoreShareCancel() {});
    } else {
      khCopyText(shareData.text + " " + shareData.url, "Opportunity link copied");
    }
  }

  function khDownloadLetter() {
    var blob = new Blob([khState.generatedLetter], {
      type: "text/plain;charset=utf-8",
    });
    var objectUrl = URL.createObjectURL(blob);
    var link = document.createElement("a");
    var meta = khState.generatedLetterMeta || {};
    var safeCompany = (meta.companyName || "Kagie")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    link.className = "kh-visually-hidden";
    link.href = objectUrl;
    link.download = "Cover-Letter-" + safeCompany + ".txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function releaseObjectUrl() {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
    khShowToast("Cover letter downloaded", "download");
  }

  function khShareLetter() {
    var meta = khState.generatedLetterMeta || {};
    if (navigator.share) {
      navigator
        .share({
          title:
            "Cover letter" +
            (meta.companyName ? " for " + meta.companyName : ""),
          text: khState.generatedLetter,
        })
        .catch(function ignoreShareCancel() {});
    } else {
      khCopyText(khState.generatedLetter, "Cover letter copied for sharing");
    }
  }

  function khShowModal(options) {
    if (!khRefs.modal) {
      return;
    }
    khLastFocusedElement = document.activeElement;
    khRefs.modal.innerHTML =
      '<div class="kh-modal" role="presentation" data-kh-action="modal-backdrop">' +
      '<section class="kh-modal__panel" id="kh-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="kh-modal-title" aria-describedby="kh-modal-description">' +
      '<h2 class="kh-modal__title" id="kh-modal-title">' +
      khEscapeHtml(options.title) +
      "</h2>" +
      '<p class="kh-modal__text" id="kh-modal-description">' +
      khEscapeHtml(options.text) +
      "</p>" +
      '<div class="kh-modal__actions">' +
      '<button class="kh-button kh-button--secondary" type="button" data-kh-action="close-modal">' +
      khEscapeHtml(options.cancelLabel || "Cancel") +
      "</button>" +
      '<button class="kh-button" type="button" data-kh-action="' +
      khEscapeHtml(options.confirmAction || "close-modal") +
      '">' +
      khEscapeHtml(options.confirmLabel || "Continue") +
      "</button>" +
      "</div>" +
      "</section>" +
      "</div>";
    document.body.classList.add("kh-no-scroll");
    window.requestAnimationFrame(function focusModal() {
      var dialogButton = khRefs.modal.querySelector(".kh-button");
      if (dialogButton) {
        dialogButton.focus();
      }
    });
  }

  function khCloseModal() {
    if (!khRefs.modal) {
      return;
    }
    khRefs.modal.innerHTML = "";
    document.body.classList.remove("kh-no-scroll");
    if (
      khLastFocusedElement &&
      typeof khLastFocusedElement.focus === "function"
    ) {
      khLastFocusedElement.focus();
    }
    khLastFocusedElement = null;
  }

  function khReviewApply() {
    var item =
      khFindOpportunity(khState.applyTargetId) || khInternships[0];
    var labels = {
      self: "apply yourself",
      guided: "apply with Kagie guidance",
      managed: "let Kagie prepare the application",
    };
    khShowModal({
      title: "Ready to continue?",
      text:
        "You chose to " +
        labels[khState.applyMode] +
        " for " +
        item.title +
        " at " +
        item.company +
        ". We will add it to your tracker.",
      cancelLabel: "Not yet",
      confirmLabel: "Continue",
      confirmAction: "confirm-apply",
    });
  }

  function khGetApiUser() {
    var api = window.KagieAPI;
    if (!api || typeof api.getCurrentUser !== "function") {
      return null;
    }
    return api.getCurrentUser();
  }

  async function khCreateCareerSupportTicket(options) {
    var api = window.KagieAPI;
    var user = khGetApiUser();
    if (!api || !user || !user.id) {
      throw new Error("Please sign in first so Kagie support can see your request.");
    }
    if (api.createSupportTicketAsync || api.createSupportTicket) {
      return api.createSupportTicketAsync
        ? api.createSupportTicketAsync({
            userId: user.id,
            subject: options.subject,
            category: "Career Hub",
            priority: options.priority || "normal",
            message: options.message,
          })
        : Promise.resolve(
            api.createSupportTicket({
              userId: user.id,
              subject: options.subject,
              category: "Career Hub",
              priority: options.priority || "normal",
              message: options.message,
            })
          );
    }
    if (api.sendSupportMessageAsync) {
      return api.sendSupportMessageAsync(
        "support_" + user.id,
        "[Career Hub] " + options.subject + " - " + options.message
      );
    }
    throw new Error("Career Hub support is not available right now.");
  }

  async function khConfirmApply() {
    var item =
      khFindOpportunity(khState.applyTargetId) || khInternships[0];
    var requiresKagieSupport = khState.applyMode !== "self";
    if (requiresKagieSupport) {
      var supportMessage =
        "Learner requested " +
        (khState.applyMode === "managed"
          ? "Kagie Apply for Me"
          : "Kagie application guidance") +
        " for " +
        item.title +
        " at " +
        item.company +
        ". Location: " +
        item.location +
        ". Closing date: " +
        item.closing +
        (item.applicationUrl ? ". Official link: " + item.applicationUrl : "") +
        ".";
      try {
        await khCreateCareerSupportTicket({
          subject: "Career Hub - " + item.title,
          message: supportMessage,
          priority: khState.applyMode === "managed" ? "high" : "normal",
        });
      } catch (error) {
        khShowToast(
          error?.message || "Could not notify Kagie support right now.",
          "send"
        );
        return;
      }
    }
    var status =
      khState.applyMode === "self"
        ? "applied"
        : khState.applyMode === "managed"
        ? "review"
        : "review";
    var statusLabel =
      khState.applyMode === "self" ? "Applied" : "In review";
    var existing = khState.trackerItems.some(function alreadyTracked(entry) {
      return entry.opportunityId === item.id;
    });
    if (!existing) {
      khState.trackerItems.unshift({
        id: "track-user-" + item.id,
        opportunityId: item.id,
        company: item.company,
        brand: item.brand,
        brandStyle: item.brandStyle,
        title: item.title,
        status: status,
        statusLabel: statusLabel,
        date:
          khState.applyMode === "self"
            ? "Added today"
            : "Kagie review started today",
      });
      khWriteStore("tracker-items", khState.trackerItems);
    }
    khCloseModal();
    khNavigate("tracker");
    khShowToast(
      requiresKagieSupport
        ? "Kagie support request sent and tracker updated"
        : "Application added to your tracker"
    );
  }

  function khHandleFile(file) {
    if (!file) {
      return;
    }
    var allowedExtensions = /\.(pdf|doc|docx)$/i;
    if (!allowedExtensions.test(file.name || "")) {
      khShowToast("Please choose a PDF, DOC or DOCX file", "file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      khShowToast("Your CV must be 8 MB or smaller", "file");
      return;
    }
    khState.cvFile = file;
    khRenderCv();
    khShowToast("CV selected successfully");
  }

  function khMarkNotification(id) {
    if (!id || khState.readNotifications.has(id)) {
      return;
    }
    khState.readNotifications.add(id);
    khWriteStore(
      "read-notifications",
      Array.from(khState.readNotifications)
    );
    khRenderNotifications();
  }

  function khMarkAllNotifications() {
    khNotifications.forEach(function markRead(notification) {
      khState.readNotifications.add(notification.id);
    });
    khWriteStore(
      "read-notifications",
      Array.from(khState.readNotifications)
    );
    khRenderNotifications();
    khShowToast("All notifications marked as read");
  }

  function khClickHandler(event) {
    var routeControl = event.target.closest("[data-kh-route]");
    if (routeControl && khRefs.app.contains(routeControl)) {
      event.preventDefault();
      khNavigate(routeControl.getAttribute("data-kh-route"));
      return;
    }
    var actionControl = event.target.closest("[data-kh-action]");
    if (!actionControl || !khRefs.app.contains(actionControl)) {
      return;
    }
    var action = actionControl.getAttribute("data-kh-action");
    var id = actionControl.getAttribute("data-kh-id");
    var kind =
      actionControl.getAttribute("data-kh-kind") ||
      actionControl.getAttribute("data-kh-filter-kind");
    event.preventDefault();
    switch (action) {
      case "back":
        khBack();
        break;
      case "go-home":
        window.location.assign(khPageHref("home.html"));
        break;
      case "go-external":
        window.location.assign(
          khPageHref(actionControl.getAttribute("data-kh-href") || "home.html")
        );
        break;
      case "open-cv-builder":
        if (window.KagieCvRevampBuilder && window.KagieCvRevampBuilder.open) {
          window.KagieCvRevampBuilder.open();
        } else {
          window.location.hash = "#kh-cv-builder";
        }
        break;
      case "open-detail":
        khNavigate("detail", {
          id: id,
          returnRoute:
            actionControl.getAttribute("data-kh-origin") || khState.route,
        });
        break;
      case "bookmark":
        khToggleBookmark(id);
        break;
      case "apply":
        khNavigate("apply", { id: id });
        break;
      case "share-opportunity":
        khShareOpportunity();
        break;
      case "opportunity-filter":
        khState.filters[kind] =
          actionControl.getAttribute("data-kh-filter-value") || "all";
        khRenderOpportunityResults(kind);
        break;
      case "focus-filters":
        var firstFilter = khRefs.main.querySelector(
          "[data-kh-action='opportunity-filter']"
        );
        if (firstFilter) {
          firstFilter.focus();
          firstFilter.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "start",
          });
        }
        break;
      case "clear-search":
        khState.searches[kind] = "";
        khRenderOpportunitiesScreen(kind);
        var searchInput = document.getElementById("kh-search-input");
        if (searchInput) {
          searchInput.focus();
        }
        break;
      case "reset-opportunity-filters":
        khState.searches[kind] = "";
        khState.filters[kind] = "all";
        khRenderOpportunitiesScreen(kind);
        break;
      case "refresh-papers":
        khRefreshQuestionPapers();
        khShowToast("Refreshing question papers", "download");
        break;
      case "clear-paper-search":
        khState.paperSearch = "";
        khRenderPapers();
        var paperSearchInput = document.getElementById("kh-paper-search");
        if (paperSearchInput) {
          paperSearchInput.focus();
        }
        break;
      case "reset-paper-filters":
        khState.paperSearch = "";
        khState.paperFilters.grade = "";
        khState.paperFilters.subject = "";
        khRenderPapers();
        break;
      case "toggle-letter-edit":
        khState.letterEditMode = !khState.letterEditMode;
        khRenderGeneratedLetter();
        if (khState.letterEditMode) {
          var editor = document.getElementById("kh-letter-editor");
          if (editor) {
            editor.focus();
          }
        }
        break;
      case "copy-letter":
        khCopyText(khState.generatedLetter, "Cover letter copied");
        break;
      case "download-letter":
        khDownloadLetter();
        break;
      case "share-letter":
        khShareLetter();
        break;
      case "tracker-filter":
        khState.trackerFilter =
          actionControl.getAttribute("data-kh-filter-value") || "all";
        khRenderTrackerList();
        break;
      case "open-tracker-item":
        if (khFindOpportunity(id)) {
          khNavigate("detail", { id: id, returnRoute: "tracker" });
        }
        break;
      case "mark-notification":
        khMarkNotification(id);
        break;
      case "mark-all-read":
        khMarkAllNotifications();
        break;
      case "review-apply":
        khReviewApply();
        break;
      case "confirm-apply":
        khConfirmApply();
        break;
      case "close-modal":
        khCloseModal();
        break;
      case "modal-backdrop":
        if (event.target === actionControl) {
          khCloseModal();
        }
        break;
      default:
        break;
    }
  }

  function khInputHandler(event) {
    var target = event.target;
    if (target.hasAttribute("data-kh-search-kind")) {
      var kind = target.getAttribute("data-kh-search-kind");
      khState.searches[kind] = target.value;
      khRenderOpportunityResults(kind);
      var clearControl = target.parentElement.querySelector(
        "[data-kh-action='clear-search']"
      );
      if (target.value && !clearControl) {
        var clearButton = document.createElement("button");
        clearButton.className = "kh-search-clear";
        clearButton.type = "button";
        clearButton.setAttribute("data-kh-action", "clear-search");
        clearButton.setAttribute("data-kh-kind", kind);
        clearButton.setAttribute("aria-label", "Clear search");
        clearButton.innerHTML = khIcon("close", "kh-icon--small");
        target.parentElement.appendChild(clearButton);
      } else if (!target.value && clearControl) {
        clearControl.remove();
      }
    }
    if (target.hasAttribute("data-kh-paper-search")) {
      khState.paperSearch = target.value;
      khRenderPaperResults();
      var paperClearControl = target.parentElement.querySelector(
        "[data-kh-action='clear-paper-search']"
      );
      if (target.value && !paperClearControl) {
        var paperClearButton = document.createElement("button");
        paperClearButton.className = "kh-search-clear";
        paperClearButton.type = "button";
        paperClearButton.setAttribute("data-kh-action", "clear-paper-search");
        paperClearButton.setAttribute("aria-label", "Clear paper search");
        paperClearButton.innerHTML = khIcon("close", "kh-icon--small");
        target.parentElement.appendChild(paperClearButton);
      } else if (!target.value && paperClearControl) {
        paperClearControl.remove();
      }
    }
    if (target.hasAttribute("data-kh-letter-editor")) {
      khState.generatedLetter = target.value;
      khWriteStore("generated-letter", {
        text: khState.generatedLetter,
        meta: khState.generatedLetterMeta,
      });
    }
  }

  function khChangeHandler(event) {
    var target = event.target;
    if (target.id === "kh-cv-file") {
      khHandleFile(target.files && target.files[0]);
      return;
    }
    if (target.hasAttribute("data-kh-cv-service")) {
      khState.cvService = target.value;
      return;
    }
    if (target.hasAttribute("data-kh-paper-filter")) {
      var paperFilter = target.getAttribute("data-kh-paper-filter");
      if (paperFilter === "grade" || paperFilter === "subject") {
        khState.paperFilters[paperFilter] = target.value;
        khRenderPaperResults();
      }
      return;
    }
    if (target.hasAttribute("data-kh-apply-mode")) {
      khState.applyMode = target.value;
      var help = khApplyHelpText();
      var helpElement = document.getElementById("kh-apply-help");
      if (helpElement) {
        helpElement.innerHTML =
          "<strong>" +
          khEscapeHtml(help.title) +
          "</strong>" +
          khEscapeHtml(help.text);
      }
    }
  }

  async function khSubmitHandler(event) {
    if (event.target.id === "kh-cv-form") {
      event.preventDefault();
      if (!khState.cvFile) {
        khShowToast("Upload your current CV to continue", "upload");
        var uploadZone = document.getElementById("kh-upload-zone");
        if (uploadZone) {
          uploadZone.focus();
        }
        return;
      }
      var api = window.KagieAPI;
      var user = api && api.getCurrentUser ? api.getCurrentUser() : null;
      if (!user || !user.id) {
        khShowToast("Sign in to submit your free CV Revamp request.", "file");
        return;
      }
      if (!api.saveDocumentsAsync) {
        khShowToast("CV upload is temporarily unavailable. Please try again.", "upload");
        return;
      }
      var submitButton = event.target.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting free request...";
      }
      try {
        await api.saveDocumentsAsync(
          {
            file: khState.cvFile,
            name: khState.cvFile.name,
            type: khState.cvFile.type,
            size: khState.cvFile.size,
            category: "cv",
          },
          user.id
        );
        var cvMessage =
          "Free CV Revamp request submitted. Service: " +
          khState.cvService +
          ". Uploaded file: " +
          khState.cvFile.name +
          ".";
        if (api.createSupportTicketAsync || api.createSupportTicket) {
          await (api.createSupportTicketAsync
            ? api.createSupportTicketAsync({
                userId: user.id,
                subject: "Career Hub - Free CV Revamp",
                category: "Career Hub",
                priority: "normal",
                message: cvMessage,
              })
            : Promise.resolve(
                api.createSupportTicket({
                  userId: user.id,
                  subject: "Career Hub - Free CV Revamp",
                  category: "Career Hub",
                  priority: "normal",
                  message: cvMessage,
                })
              )).catch(function ignoreTicketError(error) {
            console.warn("Career Hub CV support ticket fallback:", error);
            if (api.sendSupportMessageAsync) {
              return api.sendSupportMessageAsync("support_" + user.id, "[Career Hub - Free CV Revamp] " + cvMessage);
            }
            return null;
          });
        } else if (api.sendSupportMessageAsync) {
          await api
            .sendSupportMessageAsync("support_" + user.id, "[Career Hub - Free CV Revamp] " + cvMessage)
            .catch(function ignoreSupportMessageError() {});
        }
        khState.cvFile = null;
        khShowModal({
          title: "Free CV Revamp submitted",
          text: "Your CV has been uploaded. A Kagie advisor can now review it and contact you through support. No payment is required.",
          cancelLabel: "Back to Career Hub",
          confirmLabel: "Done",
          confirmAction: "close-modal",
        });
      } catch (error) {
        khShowToast(error?.message || "Could not submit your CV right now.", "upload");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Submit Free CV Revamp";
        }
      }
      return;
    }
    if (event.target.id === "kh-cover-form") {
      event.preventDefault();
      var formData = new FormData(event.target);
      var meta = {
        fullName: String(formData.get("kh-full-name") || "").trim(),
        fieldOfStudy: String(
          formData.get("kh-field-of-study") || ""
        ).trim(),
        roleTitle: String(formData.get("kh-role-title") || "").trim(),
        companyName: String(formData.get("kh-company-name") || "").trim(),
        strengths: String(formData.get("kh-strengths") || "").trim(),
      };
      if (
        !meta.fullName ||
        !meta.fieldOfStudy ||
        !meta.roleTitle ||
        !meta.companyName
      ) {
        khShowToast("Complete all required fields", "file");
        return;
      }
      khState.generatedLetterMeta = meta;
      khState.generatedLetter = khBuildLetter(meta);
      khState.letterEditMode = false;
      khWriteStore("generated-letter", {
        text: khState.generatedLetter,
        meta: khState.generatedLetterMeta,
      });
      khNavigate("generated");
      khShowToast("Your cover letter is ready", "sparkles");
    }
  }

  function khDragHandler(event) {
    var uploadZone = event.target.closest(".kh-upload-zone");
    if (!uploadZone) {
      return;
    }
    event.preventDefault();
    if (event.type === "dragenter" || event.type === "dragover") {
      uploadZone.classList.add("kh-upload-zone--drag");
    } else {
      uploadZone.classList.remove("kh-upload-zone--drag");
    }
    if (event.type === "drop") {
      khHandleFile(
        event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0]
      );
    }
  }

  function khKeydownHandler(event) {
    if (event.key === "Escape" && khRefs.modal && khRefs.modal.firstChild) {
      khCloseModal();
      return;
    }
    if (
      event.key === "Tab" &&
      khRefs.modal &&
      khRefs.modal.firstChild
    ) {
      var focusable = khRefs.modal.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable.length) {
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function khMount() {
    if (document.documentElement.dataset.khCareerMounted === "true") {
      return;
    }
    document.documentElement.dataset.khCareerMounted = "true";
    khInjectStylesheet();
    var replacementBody = document.createElement("body");
    replacementBody.className = "kh-app-body kagie-bottom-nav-ready";
    replacementBody.dataset.kagiePage = document.body.dataset.kagiePage || "career-guidance";
    replacementBody.innerHTML =
      '<div class="kh-app" id="kh-app">' +
      '<a class="kh-skip-link" href="#kh-main">Skip to main content</a>' +
      '<div class="kh-live-region" id="kh-live" aria-live="polite" aria-atomic="true"></div>' +
      '<header id="kh-header"></header>' +
      '<main class="kh-main" id="kh-main"></main>' +
      khBottomNav() +
      '<div class="kh-toast" id="kh-toast" role="status" aria-hidden="true"></div>' +
      '<div id="kh-modal-root"></div>' +
      "</div>";
    // Keep the body node so shared navigation and icon observers stay connected.
    document.body.className = replacementBody.className;
    document.body.dataset.kagiePage = replacementBody.dataset.kagiePage;
    document.body.replaceChildren(...replacementBody.childNodes);

    khRefs.app = document.getElementById("kh-app");
    khRefs.header = document.getElementById("kh-header");
    khRefs.main = document.getElementById("kh-main");
    khRefs.live = document.getElementById("kh-live");
    khRefs.toast = document.getElementById("kh-toast");
    khRefs.modal = document.getElementById("kh-modal-root");

    khRefs.app.addEventListener("click", khClickHandler);
    khRefs.app.addEventListener("input", khInputHandler);
    khRefs.app.addEventListener("change", khChangeHandler);
    khRefs.app.addEventListener("submit", khSubmitHandler);
    khRefs.app.addEventListener("dragenter", khDragHandler);
    khRefs.app.addEventListener("dragover", khDragHandler);
    khRefs.app.addEventListener("dragleave", khDragHandler);
    khRefs.app.addEventListener("drop", khDragHandler);
    document.addEventListener("keydown", khKeydownHandler);

    khState.route = khRouteFromHash();
    // The advanced CV builder owns this route and mounts after the hub.
    if (!/^#kh-cv-builder(?:$|\?)/.test(window.location.hash)) {
    window.history.replaceState(
      { khRoute: khState.route },
      "",
      khHashForRoute(khState.route)
    );
    }
    window.addEventListener("popstate", function handlePopState() {
      khState.route = khRouteFromHash();
      khRender();
      window.scrollTo(0, 0);
    });
    khRender();
    window.scrollTo(0, 0);
    khLoadAdminData().then(function refreshAdminContent() {
      if (
        khState.route === "career" ||
        khState.route === "jobs" ||
        khState.route === "internships" ||
        khState.route === "cv" ||
        khState.route === "papers"
      ) {
        khRender();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", khMount, { once: true });
  } else {
    window.setTimeout(khMount, 0);
  }
})();
