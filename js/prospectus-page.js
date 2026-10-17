(function () {
  "use strict";

  const model = window.KagieProspectusModel;
  const api = window.KagieAPI;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
  const icons = {
    back: '<path d="m15 18-6-6 6-6"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    filters: '<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4m8 2v4M10 16v4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10ZM10 21h4"/>',
    pdf: '<path d="M6 2h8l5 5v15H6Z"/><path d="M14 2v6h5M9 12h7M9 16h7"/>',
    book: '<path d="M12 5C8 2 4 3 2 4v16c3-2 6-2 10 0 4-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v15"/>',
    school: '<path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7m4-2v9"/>',
    pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M8 15h3m-3 3h3"/>',
    download: '<path d="M12 2v13m-5-5 5 5 5-5M3 15v6h18v-6"/>',
    external: '<path d="M14 3h7v7m0-7L11 13M10 3H3v18h18v-7"/>',
    saved: '<path d="M6 3h12v19l-6-4-6 4V3Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
    building: '<path d="m2 7 10-5 10 5H2Zm1 14h18M5 8v10m5-10v10m4-10v10m5-10v10"/>',
    home: '<path d="m3 10 9-8 9 8v11h-7v-7h-4v7H3V10Z"/>',
    career: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-12 0v3h6v-3"/>',
    housing: '<path d="M4 21V3h12v18M16 8h4v13M8 7h4m-4 4h4m-4 4h4m-4 6v-3h4v3"/>',
    bus: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 12h16M7 19v3m10-3v3M8 15h1m6 0h1"/>',
    bulb: '<path d="M8 16c0-3-3-3-3-8a7 7 0 0 1 14 0c0 5-3 5-3 8ZM9 19h6m-5 3h4M12 5v6"/>'
  };
  const svgCache = new Map();
  function icon(name) {
    if (!svgCache.has(name)) svgCache.set(name, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.pdf}</svg>`);
    return svgCache.get(name);
  }
  const url = (value, kind) => model.safeUrl(value, kind, location.href);
  const date = value => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }) : "Check with institution";
  };
  const size = bytes => Number(bytes) > 0 ? Number(bytes) < 1048576 ? `${Math.max(1, Math.round(Number(bytes) / 1024))} KB` : `${(Number(bytes) / 1048576).toFixed(1)} MB` : "PDF";
  const typeLabels = {
    all: "All",
    University: "Universities",
    "University of Technology": "Universities of Technology",
    TVET: "TVET"
  };
  const defaultFilters = {
    q: "",
    type: "all",
    province: "",
    pdf: "all",
    sort: "az"
  };
  let user,
    staff = false,
    staffHome = "home.html",
    institutions = [],
    byId = new Map(),
    groups = new Map();
  let documents = [],
    history = {
      downloads: [],
      recent: []
    },
    route,
    draft,
    readPending,
    documentRevision = 0;
  let toastTimer,
    renderRevision = 0,
    listSignature = "",
    listLimit = 24;
  const locks = new Set();
  const historyKey = () => `kagie_prospectus_history:${user.id}`;
  const views = ["home", "library", "filters", "institution", "missing", "guide", "downloads", "manage"];
  function parseRoute() {
    const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
    const [view = "home", encodedId = ""] = path.split("/");
    let id = "";
    try {
      id = decodeURIComponent(encodedId);
    } catch {}
    const params = new URLSearchParams(query);
    return {
      view: views.includes(view) ? view : "home",
      id,
      filters: model.filters(params),
      tab: ["prospectus", "applications", "dates", "recent"].includes(params.get("tab")) ? params.get("tab") : "overview"
    };
  }
  function href(view, id = "", options = route?.filters || defaultFilters, tab = "") {
    const params = new URLSearchParams();
    for (const key of ["q", "type", "province", "pdf", "sort"]) if (options[key] && options[key] !== defaultFilters[key]) params.set(key, options[key]);
    if (tab && tab !== "overview") params.set("tab", tab);
    return `#${view}${id ? "/" + encodeURIComponent(id) : ""}${params.size ? "?" + params : ""}`;
  }
  function go(view, id = "", options, tab = "", replace = false) {
    const target = href(view, id, options, tab);
    if (replace) window.history.replaceState({
      ...window.history.state
    }, "", target);else window.history.pushState({
      prDepth: (window.history.state?.prDepth || 0) + 1
    }, "", target);
    route = parseRoute();
    draft = {
      ...route.filters
    };
    listLimit = 24;
    listSignature = "";
    render();
    window.scrollTo(0, 0);
  }
  function backHref() {
    if (["guide", "missing"].includes(route.view)) return href("institution", route.id);
    if (route.view === "institution") return href("library");
    return href("home");
  }
  function toast(message) {
    $("prospectusToast").textContent = message;
    $("prospectusToast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("prospectusToast").classList.remove("show"), 4500);
  }
  function readHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey()) || "{}");
      history = {
        downloads: Array.isArray(stored.downloads) ? stored.downloads.filter(item => item && typeof item.documentKey === "string").slice(0, 60) : [],
        recent: Array.isArray(stored.recent) ? stored.recent.filter(item => item && typeof item.institutionId === "string").slice(0, 30) : []
      };
    } catch {
      history = {
        downloads: [],
        recent: []
      };
    }
  }
  function persistHistory() {
    try {
      localStorage.setItem(historyKey(), JSON.stringify(history));
    } catch {
      toast("Your device could not save the download history.");
    }
  }
  function rememberInstitution(id) {
    if (!byId.has(id)) return;
    history.recent = [{
      institutionId: id,
      viewedAt: new Date().toISOString()
    }, ...history.recent.filter(item => item.institutionId !== id)].slice(0, 30);
    persistHistory();
  }
  function logo(item) {
    const source = url(item.logo);
    const initials = item.shortName && item.shortName.length <= 6 ? item.shortName : item.name.split(/\s+/).map(word => word[0]).slice(0, 4).join("");
    return `<span class="pr-logo">${source ? `<img src="${esc(source)}" alt="${esc(item.name)} logo" loading="lazy" decoding="async" />` : esc(initials)}</span>`;
  }
  function badge(item) {
    const label = item.type === "University of Technology" ? "UoT" : item.type || "Institution";
    return `<span class="pr-badge ${item.type === "University" ? "blue" : ""} ${label.length > 12 ? "long" : ""}">${esc(label)}</span>`;
  }
  function navigation() {
    return `<nav class="pr-section-nav" aria-label="Prospectus sections">
      <a href="${href("home")}"${route.view === "home" ? ' aria-current="page"' : ""}>${icon("book")}Library Home</a>
      <a href="${href("library")}"${route.view === "library" ? ' aria-current="page"' : ""}>${icon("building")}Institutions</a>
      <a href="${href("downloads")}"${route.view === "downloads" ? ' aria-current="page"' : ""}>${icon("download")}Saved &amp; Downloads</a>
      ${staff ? `<a href="${href("manage")}"${route.view === "manage" ? ' aria-current="page"' : ""}>${icon("upload")}Upload PDF</a><a href="${esc(staffHome)}">Staff dashboard</a>` : ""}
    </nav>`;
  }
  function renderHeader() {
    const title = {
      filters: "Search & Filters",
      downloads: "Saved & Downloads",
      guide: "Student Guide",
      manage: "Upload Prospectus"
    }[route.view];
    const initials = String(user.fullName || user.name || "Student").trim().split(/\s+/).map(word => word[0]).slice(0, 2).join("").toUpperCase();
    const avatar = url(user.avatarUrl || user.profile?.avatarUrl);
    $("prospectusHeader").innerHTML = `${route.view !== "home" && route.view !== "library" ? `<a class="pr-icon-button" href="${backHref()}" data-back aria-label="Back">${icon("back")}</a>` : ""}
      ${title ? `<h1>${esc(title)}</h1>` : '<a class="pr-brand" href="home.html" aria-label="Kagie app home"><span>Kagie</span>.app</a>'}
      ${route.view === "filters" ? '<button class="pr-text-button" type="button" data-reset-filters>Reset</button>' : `${!title ? `<a class="pr-icon-button" href="${href("downloads")}" aria-label="Your downloads">${icon("download")}</a>` : ""}<a class="pr-icon-button" href="updates.html" aria-label="Updates">${icon("bell")}</a><a class="pr-avatar" href="profile.html" aria-label="Your profile">${avatar ? `<img src="${esc(avatar)}" alt="" />` : esc(initials)}</a>`}`;
  }
  function searchInput(state) {
    return `<label class="pr-search">${icon("search")}<input id="prospectusSearch" type="search" maxlength="200" value="${esc(state.q)}" placeholder="Search institutions or programmes…" aria-label="Search institutions or programmes" autocomplete="off" /></label>`;
  }
  function searchControl(state) {
    return `<form class="pr-search-row" id="prospectusSearchForm" role="search">${searchInput(state)}<button type="submit" class="pr-search-submit">Search</button><a class="pr-icon-button pr-filter-button" href="${href("filters", "", state)}" aria-label="Search and filters">${icon("filters")}</a></form>`;
  }
  function chips(state) {
    return `<div class="pr-chips" role="group" aria-label="Institution types">${model.types.map(type => `<button type="button" class="pr-chip" data-type="${esc(type)}" aria-pressed="${state.type === type}">${typeLabels[type]}</button>`).join("")}</div>`;
  }
  function visible(state = route.filters) {
    return model.filter(institutions, groups, state);
  }
  function homeView() {
    return `<div class="pr-home">
      <section class="pr-hero"><div class="pr-hero-copy"><p class="pr-kicker">PROSPECTUS LIBRARY</p><h1>Your future<br>starts with the<br>right information</h1><p>Browse, compare and download official prospectuses from universities, universities of technology and TVET colleges across South Africa.</p></div><img class="pr-hero-art" src="images/prospectus-student.webp" alt="" width="512" height="608" fetchpriority="high" /></section>
      <section class="pr-home-controls">${searchControl(route.filters)}${chips(route.filters)}
        <div class="pr-tiles"><a class="pr-tile" data-browse-pdfs href="${href("library", "", {
      ...route.filters,
      pdf: "with"
    })}"><span class="pr-tile-icon">${icon("pdf")}</span><h2>Browse<br>Prospectus PDFs</h2><p>Download official institution prospectuses.</p><span class="pr-tile-arrow">${icon("arrow")}</span></a>
        <a class="pr-tile yellow" data-browse-guides href="${href("library", "", {
      ...route.filters,
      pdf: "without"
    })}"><span class="pr-tile-icon">${icon("school")}</span><h2>Student Guides</h2><p>Use Kagie guides when a PDF is not available.</p><span class="pr-tile-arrow">${icon("arrow")}</span></a></div>
        <p class="pr-home-status" id="prospectusHomeCount">${visible().length} institutions · ${documents.length} prospectus files</p>
      </section>
    </div>${navigation()}`;
  }
  function row(item) {
    const doc = groups.get(item.id)?.[0];
    return `<article class="pr-institution" data-institution-id="${esc(item.id)}">${badge(item)}${logo(item)}
      <a class="pr-institution-name" href="${href("institution", item.id)}">${esc(item.name)}</a><a class="pr-row-chevron" href="${href("institution", item.id)}" aria-label="View ${esc(item.name)}">${icon("chevron")}</a>
      <div class="pr-row-place">${icon("pin")}${esc(item.province || "Location to be confirmed")}</div>
      <div class="pr-row-bottom"><div class="pr-row-facts"><span class="pr-row-fact">${icon("calendar")}Application fee: ${esc(model.feeLabel(item))}</span><span class="pr-row-fact">${icon("calendar")}Deadline: ${esc(item.applicationDeadline ? date(item.applicationDeadline) : "Check with institution")}</span></div>
      ${doc ? `<button class="pr-row-action" type="button" data-download="${esc(doc.key)}">Download PDF</button>` : `<a class="pr-row-action" href="${href("guide", item.id)}">View Guide</a>`}</div>
    </article>`;
  }
  function libraryView() {
    return `<div class="pr-pad"><div class="pr-intro"><h1>Institution Library</h1><p>Explore and download prospectuses from universities, universities of technology and TVET colleges across South Africa.</p></div>${searchControl(route.filters)}${chips(route.filters)}
      <div class="pr-list-meta"><span id="prospectusResultCount" role="status"></span><label class="pr-sort">Sort: <select id="prospectusSort" aria-label="Sort institutions"><option value="az"${route.filters.sort === "az" ? " selected" : ""}>A – Z</option><option value="za"${route.filters.sort === "za" ? " selected" : ""}>Z – A</option></select></label></div><div class="pr-institution-list" id="prospectusList"></div><div class="pr-actions" id="prospectusMore"></div>
    </div>${navigation()}`;
  }
  function updateList() {
    const result = visible();
    const count = $("prospectusResultCount");
    if (count) count.textContent = `${result.length} institution${result.length === 1 ? "" : "s"}`;
    const list = $("prospectusList");
    if (!list) return;
    const signature = JSON.stringify([renderRevision, result.slice(0, listLimit).map(item => item.id)]);
    if (signature !== listSignature) {
      listSignature = signature;
      list.innerHTML = result.length ? result.slice(0, listLimit).map(row).join("") : '<div class="pr-empty"><h2>No institutions found</h2><p>Try another programme or reset your filters.</p><button class="pr-text-button" type="button" data-clear-library>Reset filters</button></div>';
    } else {
      // Keep existing rows when the matches are identical while carrying the
      // latest filter context into their detail and guide links.
      for (const node of list.querySelectorAll("[data-institution-id]")) {
        for (const anchor of node.querySelectorAll("a")) anchor.setAttribute("href", href(anchor.classList.contains("pr-row-action") ? "guide" : "institution", node.dataset.institutionId));
      }
    }
    $("prospectusMore").innerHTML = result.length > listLimit ? `<button class="pr-outline" type="button" data-show-more>Show more institutions (${result.length - listLimit} remaining)</button>` : "";
  }
  function filterView() {
    draft = {
      ...route.filters
    };
    const provinces = [...new Set(institutions.map(item => item.province).filter(Boolean))].sort();
    return `<div class="pr-pad"><form class="pr-filter-form" id="prospectusFilterForm"><div class="pr-search-row">${searchInput(draft)}</div>
      <fieldset class="pr-filter-group"><legend>${icon("building")}Institution Type</legend><div class="pr-radios">${model.types.map(type => `<label class="pr-radio"><input type="radio" name="institutionType" value="${esc(type)}"${draft.type === type ? " checked" : ""} />${type === "all" ? "All Types" : type === "TVET" ? "TVET Colleges" : typeLabels[type]}</label>`).join("")}</div></fieldset>
      <fieldset class="pr-filter-group"><legend>${icon("pin")}Province</legend><select id="prospectusProvince" aria-label="Province"><option value="">All provinces</option>${provinces.map(province => `<option${draft.province === province ? " selected" : ""}>${esc(province)}</option>`).join("")}</select></fieldset>
      <fieldset class="pr-filter-group"><legend>${icon("pdf")}PDF Status</legend><div class="pr-radios pdf">${[["all", "All"], ["with", "With PDF"], ["without", "Without PDF"]].map(([value, label]) => `<label class="pr-radio"><input type="radio" name="pdfStatus" value="${value}"${draft.pdf === value ? " checked" : ""} />${label}</label>`).join("")}</div></fieldset>
      <button class="pr-primary" type="submit" id="prospectusApplyFilters">${icon("search")}<span>Show Results (${visible(draft).length})</span></button>
    </form></div>`;
  }
  function updateFilterCount() {
    const label = $("prospectusApplyFilters")?.querySelector("span");
    if (label) label.textContent = `Show Results (${visible(draft).length})`;
  }
  function facts(item) {
    return `<div class="pr-facts"><div class="pr-fact">${icon("calendar")}<span>Application fee<strong>${esc(model.feeLabel(item))}</strong></span></div><div class="pr-fact red">${icon("calendar")}<span>Application deadline<strong>${esc(item.applicationDeadline ? date(item.applicationDeadline) : "Check with institution")}</strong></span></div></div>`;
  }
  function websiteAction(item) {
    const site = url(item.website);
    return site ? `<a class="pr-outline" href="${esc(site)}" target="_blank" rel="noopener noreferrer">${icon("external")}Open Institution Page</a>` : "";
  }
  function documentCard(item) {
    const docs = groups.get(item.id) || [];
    return `<section class="pr-box"><h2>${icon("pdf")}Prospectus PDF</h2>${docs.length ? docs.map(doc => `<div class="pr-document"><span class="pr-document-icon">${icon("pdf")}</span><div><strong>${esc(doc.title || doc.fileName)}</strong><p>PDF${doc.fileSize > 0 ? " · " + esc(size(doc.fileSize)) : ""}${doc.updatedAt ? " · Updated " + esc(date(doc.updatedAt)) : ""}</p></div></div><div class="pr-actions"><button class="pr-primary" type="button" data-download="${esc(doc.key)}">${icon("download")}Download Prospectus</button>${url(doc.fileUrl, "pdf") ? `<a class="pr-outline" href="${esc(url(doc.fileUrl, "pdf"))}" target="_blank" rel="noopener noreferrer">${icon("external")}Open PDF</a>` : ""}${staff ? `<button class="pr-text-button" type="button" data-remove-document="${esc(doc.key)}">Remove PDF from library</button>` : ""}</div>`).join("") : `<p class="pr-copy">No PDF has been uploaded for this institution yet.</p><div class="pr-actions"><a class="pr-primary" href="${href("missing", item.id)}">${icon("pdf")}View PDF Availability</a><a class="pr-outline" href="${href("guide", item.id)}">${icon("book")}Open Kagie Guide</a></div>`}${websiteAction(item)}</section>`;
  }
  function guideContent(item) {
    return `<div class="pr-copy"><h2>Study areas &amp; programmes</h2><p>Use this guide to explore the programmes currently listed in Kagie. Confirm entry requirements and the current intake with the institution.</p></div><div class="pr-guide-list">${item.faculties.length ? item.faculties.map(faculty => `<section class="pr-faculty"><h3>${esc(faculty.name)}</h3>${faculty.summary ? `<p class="pr-copy">${esc(faculty.summary)}</p>` : ""}<ul>${faculty.courses.map(course => `<li>${esc(course)}</li>`).join("")}</ul></section>`).join("") : '<p class="pr-empty">Programme information is still being added. Check the institution’s website for its latest course list.</p>'}</div>`;
  }
  function institutionView(item) {
    const tab = ["prospectus", "applications", "dates"].includes(route.tab) ? route.tab : "overview";
    let body;
    if (tab === "prospectus") body = documentCard(item);else if (tab === "applications") body = `<section class="pr-copy"><h2>Plan your application</h2><p>Review your course requirements, prepare your documents, and confirm the intake before applying.</p>${facts(item)}${item.applicationFeeNote ? `<p class="pr-note">${esc(item.applicationFeeNote)}</p>` : ""}<div class="pr-actions"><a class="pr-primary" href="forms.html">${icon("arrow")}Start a Kagie Application</a><a class="pr-outline" href="${href("guide", item.id)}">${icon("book")}View Programmes</a>${websiteAction(item)}</div></section>`;else if (tab === "dates") body = `<section class="pr-copy"><h2>Important dates</h2><div class="pr-date-list"><div class="pr-fact">${icon("calendar")}<span>Catalogue opening date<strong>${esc(item.openingDate ? date(item.openingDate) : "Check with institution")}</strong></span></div><div class="pr-fact red">${icon("calendar")}<span>Catalogue closing date<strong>${esc(item.applicationDeadline ? date(item.applicationDeadline) : "Check with institution")}</strong></span></div></div><p class="pr-note">${icon("info")}Intake dates can differ by programme. Confirm current dates with the institution before applying.</p><div class="pr-actions">${websiteAction(item)}<a class="pr-outline" href="updates.html">View Latest Updates</a></div></section>`;else body = `<section class="pr-copy"><h2>About this institution</h2><p>${esc(item.description || `${item.name} is listed in Kagie’s ${item.type || "institution"} library. Explore its study areas, available prospectuses and application information below.`)}</p><div class="pr-actions">${facts(item)}</div>${item.applicationFeeNote ? `<p class="pr-note">${esc(item.applicationFeeNote)}</p>` : ""}<p class="pr-note">${icon("info")}Confirm current programmes, fees and intake dates with the institution.</p></section>${documentCard(item)}`;
    return `<div class="pr-banner"><img src="images/updates-campus.webp" alt="" width="1200" height="600" /><small>Campus illustration</small></div><div class="pr-detail-head">${logo(item)}<div class="pr-detail-title"><h1>${esc(item.name)}</h1>${badge(item)}</div><div class="pr-row-place">${icon("pin")}${esc(item.province)}</div></div><nav class="pr-tabs" aria-label="Institution details">${[["overview", "Overview"], ["prospectus", "Prospectus"], ["applications", "Applications"], ["dates", "Important Dates"]].map(([value, label]) => `<a class="pr-tab" href="${href("institution", item.id, route.filters, value)}"${tab === value ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav><div class="pr-detail-content ${tab}">${body}</div>${navigation()}`;
  }
  function missingView(item) {
    return `<section class="pr-missing"><img src="images/prospectus-empty.webp" alt="" width="600" height="400" /><h1>No PDF uploaded yet</h1><p>A prospectus PDF for ${esc(item.name)} has not been uploaded to Kagie yet.</p><p class="pr-note">${icon("bulb")}Don’t worry! You can still use our Kagie guides for information about this institution, including programmes and how to apply.</p><div class="pr-actions"><a class="pr-primary" href="${href("guide", item.id)}">${icon("book")}Open Kagie Guide</a>${websiteAction(item)}<a class="pr-outline" href="${href("library")}">Browse Other Institutions</a></div></section>`;
  }
  function downloadsView() {
    const recent = route.tab === "recent",
      rows = recent ? history.recent : history.downloads;
    return `<nav class="pr-tabs pr-downloads-tabs" aria-label="Download history"><a class="pr-tab" href="${href("downloads")}"${!recent ? ' aria-current="page"' : ""}>Downloaded (${history.downloads.length})</a><a class="pr-tab" href="${href("downloads", "", route.filters, "recent")}"${recent ? ' aria-current="page"' : ""}>Recently Viewed (${history.recent.length})</a></nav><div class="pr-pad"><div class="pr-downloads-list">${rows.length ? rows.map(entry => {
      const item = byId.get(entry.institutionId),
        doc = documents.find(document => model.documentKey(document) === entry.documentKey);
      return `<article class="pr-history-row">${recent && item ? logo(item) : `<span class="pr-document-icon">${icon("pdf")}</span>`}<div class="pr-history-main"><a href="${href("institution", entry.institutionId, route.filters, recent ? "overview" : "prospectus")}"><strong>${esc(recent ? item?.name || entry.institutionId : entry.title)}</strong></a><p>${esc(item ? `${item.name} · ${item.type} · ${item.province}` : "Institution no longer listed")}</p><p>${recent ? "Viewed " + esc(date(entry.viewedAt)) : `${esc(size(entry.fileSize))} · Download started ${esc(date(entry.downloadedAt))}`}</p>${!recent && doc ? `<button class="pr-text-button" type="button" data-download="${esc(entry.documentKey)}">Download again</button>` : !recent ? '<p>PDF no longer available in the library.</p>' : ""}</div><button class="pr-icon-button" type="button" data-remove-history="${esc(recent ? entry.institutionId : entry.documentKey)}" data-history-kind="${recent ? "recent" : "downloads"}" aria-label="Remove ${esc(recent ? item?.name || entry.institutionId : entry.title)} from history">${icon("trash")}</button></article>`;
    }).join("") : `<div class="pr-empty"><h2>${recent ? "No recently viewed institutions" : "No downloads yet"}</h2><p>${recent ? "Open an institution to see it here." : "Download a prospectus from the institution library to see it here."}</p><a class="pr-primary" href="${href("library")}">Browse Institutions</a></div>`}</div><p class="pr-note">${icon("info")}History is saved for your account on this device. Downloaded files are in your device’s Downloads folder.</p></div>${navigation()}`;
  }
  function manageView() {
    if (!staff) return '<div class="pr-empty"><h2>Staff access required</h2><a href="#library">Back to the institution library</a></div>';
    return `<div class="pr-pad"><form class="pr-upload" id="prospectusUploadForm"><div class="pr-copy"><h2>Keep the library up to date</h2><p>Add an institution’s current PDF prospectus to Kagie’s shared library.</p></div><div class="pr-upload-fields"><label class="pr-field">Institution<select id="prospectusUploadInstitution" aria-label="Institution" required>${institutions.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}</select></label><label class="pr-field">Title<input id="prospectusUploadTitle" maxlength="180" placeholder="2026 Main Prospectus" required /></label><label class="pr-field full">Description<textarea id="prospectusUploadDescription" maxlength="2000" placeholder="Optional admissions or campus note"></textarea></label><label class="pr-field full">Prospectus PDF<input id="prospectusUploadFile" type="file" accept="application/pdf,.pdf" required /></label></div><button class="pr-primary" type="submit">${icon("upload")}Upload PDF</button><button class="pr-outline" type="reset">Clear Form</button><p class="pr-upload-message" id="prospectusUploadMessage" role="status"></p></form></div>${navigation()}`;
  }
  function render() {
    renderHeader();
    const item = byId.get(route.id);
    if (["institution", "guide", "missing"].includes(route.view) && !item) {
      $("prospectusContent").innerHTML = '<div class="pr-empty"><h2>Institution not found</h2><p>This institution is no longer available in the library.</p><a class="pr-primary" href="#library">Browse Institutions</a></div>';
    } else {
      if (route.view === "institution" || route.view === "guide") rememberInstitution(route.id);
      if (route.view === "missing" && groups.has(route.id)) {
        go("institution", route.id, route.filters, "prospectus", true);
        return;
      }
      const renderers = {
        home: homeView,
        library: libraryView,
        filters: filterView,
        downloads: downloadsView,
        manage: manageView,
        institution: () => institutionView(item),
        missing: () => missingView(item),
        guide: () => `<div class="pr-pad"><div class="pr-intro"><h1>${esc(item.name)}</h1><p>Kagie Student Guide · ${esc(item.province)}</p></div>${facts(item)}${guideContent(item)}<div class="pr-actions"><button class="pr-primary" type="button" data-download-guide="${esc(item.id)}">${icon("download")}Download Kagie Guide (TXT)</button><a class="pr-outline" href="forms.html">Start an Application</a>${websiteAction(item)}</div></div>${navigation()}`
      };
      $("prospectusContent").innerHTML = renderers[route.view]();
      listSignature = "";
      if (route.view === "library") updateList();
    }
    $("prospectusContent").setAttribute("aria-busy", "false");
    for (const button of document.querySelectorAll("[data-download]")) if (locks.has(button.dataset.download)) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
  }
  function updateDataView() {
    renderRevision++;
    if (route.view === "library") updateList();else if (route.view === "filters") updateFilterCount();else if (route.view === "home") {
      const node = $("prospectusHomeCount");
      if (node) node.textContent = `${visible().length} institutions · ${documents.length} prospectus files`;
    } else if (route.view === "manage") {
      // Refresh server institution IDs without replacing the user's title, file or form.
      const select = $("prospectusUploadInstitution");
      if (select) {
        const previousId = select.value, previousName = select.selectedOptions[0]?.textContent;
        const selected = institutions.find(item => item.id === previousId) || institutions.find(item => item.name === previousName);
        const options = institutions.map(item => { const option = document.createElement("option"); option.value = item.id; option.textContent = item.name; return option; });
        select.replaceChildren(...options);
        if (selected) select.value = selected.id;
      }
    } else if (locks.size === 0) render();
  }
  function setDocuments(records) {
    groups = model.groupDocuments(records);
    documents = [...groups.values()].flat();
    updateDataView();
  }
  async function refreshDocuments() {
    if (readPending) return readPending;
    const revision = documentRevision;
    readPending = (async () => {
      try {
        const records = api.getProspectusDocumentsAsync ? await api.getProspectusDocumentsAsync() : api.getProspectusDocuments();
        if (revision === documentRevision) setDocuments(records);
      } catch {
        toast("Could not refresh PDFs. Showing the library already on this device.");
      } finally {
        readPending = null;
      }
    })();
    return readPending;
  }
  function downloadBlob(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = String(fileName || "prospectus.pdf").replace(/[\\/:*?"<>|\x00-\x1f]/g, "-");
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }
  async function fetchPdf(doc, retry = true) {
    const source = url(doc?.fileUrl, "pdf");
    if (!source) {
      if (retry && doc?.remotePath) {
        await refreshDocuments();
        return fetchPdf(documents.find(item => item.key === doc.key), false);
      }
      throw new Error("This PDF is temporarily unavailable. Please try again shortly.");
    }
    const response = await fetch(source, {
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      if (retry && doc.remotePath && [401, 403].includes(response.status)) {
        await refreshDocuments();
        return fetchPdf(documents.find(item => item.key === doc.key), false);
      }
      throw new Error("The PDF could not be downloaded. Please try again.");
    }
    const blob = await response.blob();
    if (!(await blob.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("This file is not a valid PDF. Please contact Kagie support.");
    return {
      blob,
      doc
    };
  }
  async function downloadPdf(key) {
    if (locks.has(key)) return;
    const doc = documents.find(item => item.key === key);
    if (!doc) {
      toast("This PDF is no longer available.");
      return;
    }
    locks.add(key);
    const buttons = [...document.querySelectorAll("[data-download]")].filter(button => button.dataset.download === key);
    for (const button of buttons) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    try {
      const result = await fetchPdf(doc);
      downloadBlob(result.blob, result.doc.fileName);
      history.downloads = [{
        documentKey: key,
        institutionId: doc.institutionId,
        title: doc.title || doc.fileName,
        fileSize: result.blob.size,
        downloadedAt: new Date().toISOString()
      }, ...history.downloads.filter(item => item.documentKey !== key)].slice(0, 60);
      persistHistory();
      toast("Download started. Check your device’s Downloads folder.");
      if (route.view === "downloads") render();
    } catch (error) {
      toast(error.name === "TimeoutError" ? "The download timed out. Please try again." : error.message || "Could not download this PDF.");
    } finally {
      locks.delete(key);
      for (const button of buttons) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  }
  async function removeDocument(key, button) {
    if (!staff || locks.has(key)) return;
    const doc = documents.find(item => item.key === key);
    if (!doc) return;
    locks.add(key);
    button.disabled = true;
    try {
      await api.deleteProspectusDocumentByStaffAsync(doc.remotePath || doc.id);
      documentRevision++;
      setDocuments(documents.filter(item => item.key !== key));
      toast("The PDF was removed from the library.");
    } catch (error) {
      toast(error.message || "Could not remove this PDF.");
    } finally {
      locks.delete(key);
      button.disabled = false;
      render();
    }
  }
  async function upload(event) {
    event.preventDefault();
    if (!staff || locks.has("upload")) return;
    const form = event.target,
      button = form.querySelector('button[type="submit"]'),
      message = $("prospectusUploadMessage"),
      file = $("prospectusUploadFile").files?.[0];
    message.className = "pr-upload-message";
    const payload = {
      institutionId: $("prospectusUploadInstitution").value,
      title: $("prospectusUploadTitle").value.trim(),
      description: $("prospectusUploadDescription").value.trim(),
      file
    };
    const controls = [...form.querySelectorAll("input,select,textarea,button")];
    locks.add("upload");
    controls.forEach(control => {
      control.disabled = true;
    });
    button.setAttribute("aria-busy", "true");
    message.textContent = "Uploading prospectus…";
    try {
      if (!file || !/\.pdf$/i.test(file.name) || !(await file.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("Choose a valid PDF prospectus file.");
      const record = await api.saveProspectusDocumentByStaffAsync(payload);
      if (record.source !== "remote" && api.getProspectusDocuments && !api.getProspectusDocuments().some(item => model.documentKey(item) === model.documentKey(record))) throw new Error("Your device could not save this PDF. Please try again when shared storage is available.");
      documentRevision++;
      setDocuments([record, ...documents.filter(item => model.documentKey(item) !== model.documentKey(record))]);
      locks.delete("upload");
      form.reset();
      message.textContent = record.source === "remote" ? "PDF uploaded to the shared Kagie library." : "PDF saved to this device’s library. It has not been uploaded to shared storage.";
    } catch (error) {
      message.textContent = error.message || "Could not upload the PDF.";
      message.classList.add("error");
    } finally {
      locks.delete("upload");
      controls.forEach(control => {
        control.disabled = false;
      });
      button.removeAttribute("aria-busy");
    }
  }
  function replaceFilterUrl() {
    window.history.replaceState({
      ...window.history.state
    }, "", href(route.view, route.id, route.filters, route.tab));
    document.querySelector('.pr-filter-button')?.setAttribute("href", href("filters", "", route.filters));
    document.querySelector('[data-browse-pdfs]')?.setAttribute("href", href("library", "", {
      ...route.filters,
      pdf: "with"
    }));
    document.querySelector('[data-browse-guides]')?.setAttribute("href", href("library", "", {
      ...route.filters,
      pdf: "without"
    }));
  }
  function bind() {
    document.addEventListener("click", event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const button = event.target.closest("button"),
        anchor = event.target.closest('a[href^="#"]');
      if (anchor) {
        event.preventDefault();
        if (anchor.hasAttribute("data-back") && window.history.state?.prDepth > 0) {
          window.history.back();
          return;
        }
        window.history.pushState({
          prDepth: (window.history.state?.prDepth || 0) + 1
        }, "", anchor.getAttribute("href"));
        route = parseRoute();
        draft = {
          ...route.filters
        };
        listLimit = 24;
        render();
        window.scrollTo(0, 0);
        return;
      }
      if (!button) return;
      if (button.hasAttribute("data-type")) {
        route.filters.type = button.dataset.type;
        if (route.view === "home") {
          go("library", "", route.filters);
          return;
        }
        document.querySelectorAll("[data-type]").forEach(node => node.setAttribute("aria-pressed", String(node.dataset.type === route.filters.type)));
        listLimit = 24;
        replaceFilterUrl();
        updateList();
      } else if (button.hasAttribute("data-reset-filters")) {
        route.filters = {
          ...defaultFilters
        };
        go("filters", "", defaultFilters, "", true);
      } else if (button.hasAttribute("data-clear-library")) go("library", "", defaultFilters, "", true);else if (button.hasAttribute("data-show-more")) {
        listLimit += 24;
        updateList();
      } else if (button.hasAttribute("data-download")) downloadPdf(button.dataset.download);else if (button.hasAttribute("data-download-guide")) {
        const item = byId.get(button.dataset.downloadGuide);
        if (item) downloadBlob(new Blob([model.guide(item)], {
          type: "text/plain;charset=utf-8"
        }), `${item.shortName || item.name}-kagie-guide.txt`);
      } else if (button.hasAttribute("data-remove-history")) {
        const kind = button.dataset.historyKind;
        if (["recent", "downloads"].includes(kind)) {
          history[kind] = history[kind].filter(item => (kind === "recent" ? item.institutionId : item.documentKey) !== button.dataset.removeHistory);
          persistHistory();
          render();
        }
      } else if (button.hasAttribute("data-remove-document")) removeDocument(button.dataset.removeDocument, button);
    });
    document.addEventListener("input", event => {
      if (event.target.id !== "prospectusSearch") return;
      if (route.view === "filters") {
        draft.q = event.target.value;
        updateFilterCount();
      } else {
        route.filters.q = event.target.value;
        replaceFilterUrl();
        listLimit = 24;
        if (route.view === "library") updateList();else $("prospectusHomeCount").textContent = `${visible().length} institutions match your search. Press Enter to view results.`;
      }
    });
    document.addEventListener("change", event => {
      if (event.target.id === "prospectusSort") {
        route.filters.sort = event.target.value;
        replaceFilterUrl();
        updateList();
      }
      if (route.view === "filters") {
        if (event.target.name === "institutionType") draft.type = event.target.value;
        if (event.target.name === "pdfStatus") draft.pdf = event.target.value;
        if (event.target.id === "prospectusProvince") draft.province = event.target.value;
        updateFilterCount();
      }
    });
    document.addEventListener("submit", event => {
      if (event.target.id === "prospectusSearchForm") {
        event.preventDefault();
        go("library", "", route.filters);
      }
      if (event.target.id === "prospectusFilterForm") {
        event.preventDefault();
        go("library", "", draft);
      }
      if (event.target.id === "prospectusUploadForm") upload(event);
    });
    document.addEventListener("reset", event => {
      if (event.target.id === "prospectusUploadForm" && locks.has("upload")) event.preventDefault();else if (event.target.id === "prospectusUploadForm") $("prospectusUploadMessage").textContent = "";
    });
    document.addEventListener("error", event => {
      const image = event.target;
      if (image instanceof HTMLImageElement && image.closest(".pr-logo")) {
        const item = image.closest("[data-institution-id]");
        image.parentElement.textContent = byId.get(item?.dataset.institutionId)?.shortName || "Institution";
      }
    }, true);
    window.addEventListener("popstate", () => {
      route = parseRoute();
      draft = {
        ...route.filters
      };
      listLimit = 24;
      render();
    });
    window.addEventListener("hashchange", () => {
      route = parseRoute();
      draft = {
        ...route.filters
      };
      listLimit = 24;
      render();
    });
  }
  async function main() {
    try {
      if (!api || !model) throw new Error("The library could not be loaded. Please refresh this page.");
      user = api.resolveSessionUser ? await api.resolveSessionUser({
        attempts: 2,
        delayMs: 200
      }) : await api.restoreSession();
      user = user || api.currentUser?.() || api.getCurrentUser?.();
      const role = api.normalizeRole ? api.normalizeRole(user?.role) : String(user?.role || "").toLowerCase();
      if (!user || !["user", "learner", "student", "master_admin", "assistant_admin"].includes(role)) {
        location.replace("login.html?app=1");
        return;
      }
      staff = ["master_admin", "assistant_admin"].includes(role);
      staffHome = role === "master_admin" ? "master-admin/dashboard.html" : "assistant/dashboard.html";
      institutions = model.institutions(api.getInstitutionCatalog ? api.getInstitutionCatalog({
        includeInactive: false
      }) : window.KagieData?.institutions);
      byId = new Map(institutions.map(item => [item.id, item]));
      documents = api.getProspectusDocuments ? api.getProspectusDocuments() : [];
      groups = model.groupDocuments(documents);
      documents = [...groups.values()].flat();
      readHistory();
      route = parseRoute();
      const legacy = new URLSearchParams(location.search).get("institution");
      if (legacy && !location.hash) {
        const item = institutions.find(item => item.id.toLowerCase() === legacy.toLowerCase());
        if (item) {
          window.history.replaceState({}, "", location.pathname + href("institution", item.id, defaultFilters));
          route = parseRoute();
        }
      }
      // Reuse the app footer links and layout with local SVG equivalents so its
      // icons remain legible when the external icon font is unavailable.
      const footerIcons = ["home", "career", "school", "housing", "bus"];
      document.querySelectorAll(".bottom-nav-icon").forEach((node, index) => {
        node.innerHTML = icon(footerIcons[index]);
      });
      draft = {
        ...route.filters
      };
      bind();
      render();
      refreshDocuments();
      if (api.getInstitutionCatalogAsync) api.getInstitutionCatalogAsync({
        includeInactive: false
      }).then(records => {
        institutions = model.institutions(records);
        byId = new Map(institutions.map(item => [item.id, item]));
        updateDataView();
      }).catch(() => toast("Could not refresh institutions. Showing the catalogue already on this device."));
    } catch (error) {
      $("prospectusContent").innerHTML = `<div class="pr-empty"><h2>Library unavailable</h2><p>${esc(error.message)}</p><a href="home.html">Back to Home</a></div>`;
      $("prospectusContent").setAttribute("aria-busy", "false");
    }
  }
  document.addEventListener("DOMContentLoaded", main, {
    once: true
  });
})();
