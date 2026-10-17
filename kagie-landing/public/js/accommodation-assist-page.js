(function () {
  "use strict";

  const api = window.KagieAPI,
    m = window.KagieHousingModel;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
  const art = "../images/accommodation/room-example.webp";
  const paths = {
    back: 'm15 18-6-6 6-6',
    next: 'm9 6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    heart: 'M20 4c-3-2-6 0-8 2-2-2-5-4-8-2-6 5 1 12 8 17 7-5 14-12 8-17Z',
    calendar: 'M5 5h14v16H5ZM5 10h14M8 3v4M16 3v4',
    wallet: 'M4 6h15v14H4ZM4 6V3h12v3M15 12h5v4h-5Z',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
    clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 3',
    filter: 'M3 6h18M3 12h18M3 18h18M7 4v4M16 10v4M9 16v4',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
    bed: 'M3 19V6M3 15h18v4M3 10h7v5M10 10h9a2 2 0 0 1 2 2v3',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6',
    wifi: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
    kitchen: 'M5 3v7h6V3M8 3v18M18 3v18M18 3c-5 3-5 8 0 8',
    laundry: 'M5 3h14v18H5ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0M8 6h.1M12 6h4',
    study: 'M4 9h16v7H4ZM8 16v5M16 16v5M8 3v6M16 3v6',
    car: 'M4 11l2-6h12l2 6v8H4ZM4 12h16M7 16h1M16 16h1',
    share: 'M12 16V2m-4 4 4-4 4 4M6 10H4v12h16V10h-2',
    send: 'm3 11 18-8-8 18-2-8ZM11 13 21 3',
    chat: 'M3 4h18v13H9l-6 4ZM7 9h10M7 13h6',
    check: 'm5 12 4 4L19 6',
    document: 'M5 2h10l4 4v16H5ZM14 2v6h5M8 12h8M8 16h8',
    home: 'm3 10 9-8 9 8v11h-6v-7H9v7H3Z',
    school: 'm2 8 10-5 10 5-10 5ZM6 11v7l6 3 6-3v-7M22 8v10',
    career: 'M3 7h18v14H3ZM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    housing: 'M4 21V3h11v18M15 11h5v10M7 7h5M7 11h5M7 15h5M8 21v-3h3v3',
    bus: 'M5 4h14v15H5ZM5 10h14M8 15h.1M16 15h.1M7 19v3M17 19v3',
    bell: 'M6 16V9a6 6 0 1 1 12 0v7l3 3H3ZM10 21h4'
  };
  const icon = name => `<svg class="ha-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.home}"/></svg>`;
  let user,
    profile = {},
    listings = [],
    byId = new Map(),
    requests = [],
    admin = null;
  let f = {
      ...m.defaults
    },
    route = {
      view: "home",
      id: ""
    },
    saved = [],
    recent = [],
    searchHistory = [],
    moveIn = "",
    students = "1",
    submitting = false;
  let toastTimer,
    listKey = "",
    listLimit = 24,
    refreshDone = false;
  const money = value => `R${Math.round(value).toLocaleString("en-ZA").replace(/,/g, " ")}`;
  const price = item => item.priceRange ? esc(item.priceRange) : item.price > 0 ? `${esc(money(item.price))}<small>/month</small>` : 'Ask for price';
  const href = (view, id = "") => `#${view}${id ? "/" + encodeURIComponent(id) : ""}`;
  const detailHref = item => href("detail", item.id);
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const storageKey = name => `kagie_housing_${name}_${user.id}`;
  function saveLocal(name, value) {
    try {
      localStorage.setItem(storageKey(name), JSON.stringify(value));
      return true;
    } catch {
      toast("Your browser could not save this change.");
      return false;
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $("housingToast").textContent = message;
    toastTimer = setTimeout(() => $("housingToast").textContent = "", 4200);
  }
  function date(value) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }) : "Date not provided";
  }
  function getImages(item) {
    return item.images.length ? item.images.map(photo => /^data:image\/svg/i.test(photo) ? art : photo) : [art];
  }
  function isIllustration(item, index = 0) {
    return !item.images.length || /^data:image\/svg/i.test(item.images[index] || "") || /\/accommodation\/room-example\.webp(?:\?|$)/.test(item.images[index] || "");
  }
  function locationLine(item) {
    return [item.distanceFromCampus, item.location || item.city || item.province].filter(Boolean).join(" · ") || "Location not provided";
  }
  function tags(item) {
    const known = m.features.filter(feature => m.hasFeature(item, feature.id)).slice(0, 3);
    if (!known.length) return `<div class="ha-tags"><span class="ha-tag">${esc(item.roomType || "Room details on request")}</span><span class="ha-tag">${esc(item.availabilityStatus || "Check availability")}</span></div>`;
    return `<div class="ha-tags">${known.map(feature => `<span class="ha-tag ${feature.color}">${feature.id === 'wifi' ? 'WiFi' : esc(feature.label)}</span>`).join("")}</div>`;
  }
  function saveButton(item) {
    return `<button class="ha-round ha-save" type="button" data-save="${esc(item.id)}" aria-label="${saved.includes(item.id) ? 'Unsave' : 'Save'} ${esc(item.propertyName)}" aria-pressed="${saved.includes(item.id)}">${icon("heart")}</button>`;
  }
  function card(item, index = 0) {
    return `<article class="ha-card">
    ${saveButton(item)}<a class="ha-card-media" href="${detailHref(item)}" aria-label="View ${esc(item.propertyName)}"><img src="${esc(getImages(item)[0])}" alt="${isIllustration(item) ? 'Example housing illustration' : esc(item.propertyName) + ' property photo'}" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async" width="600" height="260"/>${isIllustration(item) ? '<span class="ha-photo-label">Illustration</span>' : ''}</a>
    <div class="ha-card-body"><div class="ha-card-top"><h3><a href="${detailHref(item)}">${esc(item.propertyName)}</a></h3><div class="ha-price">${price(item)}</div></div><p class="ha-location">${icon("pin")}${esc(locationLine(item))}</p>${tags(item)}</div></article>`;
  }
  function empty(title, copy) {
    return `<div class="ha-empty">${icon("housing")}<h2>${esc(title)}</h2><p>${esc(copy)}</p><a class="ha-btn ha-outline" href="#home">Back to search</a></div>`;
  }
  function support() {
    return `<a class="ha-support" href="help-support.html">${icon("chat")}<span><strong>Need help? Talk to our team</strong><small>Get help finding a place or following up on a housing request.</small></span>${icon("next")}</a>`;
  }
  function localNav(active) {
    return `<nav class="ha-segments ha-section-nav" aria-label="Housing sections">${[["home", "search", "Search"], ["recent", "clock", "Recent"], ["saved", "heart", "Saved"], ["requests", "chat", "Requests"]].map(([view, ic, label]) => `<a href="${href(view)}" class="${active === view ? 'active' : ''}" ${active === view ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join("")}</nav>`;
  }
  function header(title = "", back = "#home", action = "") {
    $("housingHeader").innerHTML = title ? `<a class="ha-round ha-back" href="${back}" aria-label="Back">${icon("back")}</a><h1>${esc(title)}</h1>${action || '<span style="width:38px" aria-hidden="true"></span>'}` : `<a class="ha-brand" href="../home.html">Kagie.app</a><a class="ha-round" href="../notifications.html" aria-label="Notifications">${icon("bell")}</a><a class="ha-round ha-avatar" href="../profile.html" aria-label="Your profile">${esc((profile.fullName || profile.fullNames || user.fullName || user.name || "Learner").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase())}</a>`;
  }
  function home() {
    header();
    return `<div class="ha-home-grid"><section aria-label="Find student housing">
      <nav class="ha-segments" aria-label="Stay type">${[["rent", "Rent"], ["buy", "Buy"], ["short", "Short stay"]].map(([value, label]) => `<button type="button" data-mode="${value}" class="${f.mode === value ? 'active' : ''}" aria-pressed="${f.mode === value}">${label}</button>`).join("")}</nav>
      <form id="housingSearch" class="ha-form-fields">
        <div class="ha-search-field">${icon("pin")}<label><input name="query" aria-label="Search area, campus or suburb" placeholder="Search area, campus or suburb" maxlength="160" value="${esc(f.query)}"/></label></div>
        <div class="ha-search-field">${icon("calendar")}<label>Move-in date<input type="date" name="moveIn" aria-label="Move-in date" value="${esc(moveIn)}" min="${m.today()}"/></label>${icon("next")}</div>
        <div class="ha-search-field">${icon("wallet")}<label>Budget per month<select name="maxPrice" aria-label="Budget per month">${[[8000, "Any budget"], [3000, "Under R3 000"], [5000, "Under R5 000"], [7000, "Under R7 000"]].map(([v, label]) => `<option value="${v}" ${f.maxPrice === v ? 'selected' : ''}>${label}</option>`).join("")}${![8000, 3000, 5000, 7000].includes(f.maxPrice) ? `<option value="${f.maxPrice}" selected>${esc(money(f.maxPrice))}</option>` : ''}</select></label>${icon("next")}</div>
        <div class="ha-search-field">${icon("user")}<label>Students<select name="students" aria-label="Students">${[1, 2, 3, 4].map(v => `<option value="${v}" ${String(v) === students ? 'selected' : ''}>${v} student${v === 1 ? '' : 's'}</option>`).join("")}</select></label>${icon("next")}</div>
        <button class="ha-btn ha-full" type="submit">Search housing ${icon("next")}</button>
      </form>${localNav("home")}${f.mode !== "rent" ? '<p class="ha-notice">The current catalogue contains student rentals. Ask Kagie support about buying or short stays.</p>' : ''}
      <a class="ha-mini-link" href="#listings">${icon("housing")}<span><strong>Housing near campus</strong><small>${listings.length} places in the current catalogue</small></span>${icon("next")}</a>
      </section><aside class="ha-home-side"><img class="ha-home-art" src="${art}" alt="Illustration of a student bedroom" width="1100" height="733"/><div class="ha-side-body"><h2>A place for your next chapter</h2><p>Find housing near your institution, save your favourites, and ask Kagie for reservation support.</p><a class="ha-btn ha-outline" href="#listings">Browse places ${icon("next")}</a><a class="ha-mini-link" href="#safety">${icon("shield")}<span><strong>Your safety matters</strong><small>What to check before choosing a home.</small></span>${icon("next")}</a>${support()}</div></aside></div>`;
  }
  function filtered() {
    return listings.filter(item => m.matches(item, f));
  }
  function listingsPage() {
    header();
    return `<div class="ha-heading-row"><div><h1 class="ha-title">Housing near campus</h1><p class="ha-sub" id="housingCount"></p></div><a class="ha-btn ha-blue" href="#map">${icon("map")}Map</a></div>
      <div class="ha-search-field">${icon("search")}<label><input id="housingQuery" aria-label="Search listings" placeholder="Search area, campus or suburb" value="${esc(f.query)}" maxlength="160"/></label></div>
      <div class="ha-chips"><button type="button" class="ha-chip ${f.maxPrice === 8000 && f.distance === 'any' && !f.features.length && f.room === 'any' ? 'active' : ''}" data-preset="all">All</button><button type="button" class="ha-chip ${f.maxPrice === 3000 ? 'active' : ''}" data-preset="budget">Under R3 000</button><button type="button" class="ha-chip ${f.distance === '5' ? 'active' : ''}" data-preset="distance">Within 5km</button><a class="ha-chip ha-square" href="#filters" aria-label="Filter housing">${icon("filter")}</a></div>
      <p class="ha-quiet" id="housingFilterSummary"></p><div class="ha-list" id="housingList"></div><div id="housingMore"></div>${localNav("listings")}`;
  }
  function updateList() {
    if (!$("housingList")) return;
    const items = filtered(),
      visible = items.slice(0, listLimit);
    $("housingCount").textContent = `${items.length} place${items.length === 1 ? '' : 's'} found${f.query ? ' for “' + f.query + '”' : ' in the current catalogue'}`;
    $("housingFilterSummary").textContent = [f.maxPrice < 8000 ? `Budget: ${money(f.maxPrice)}` : '', f.distance !== 'any' ? `Within ${f.distance}km` : '', f.room !== 'any' ? f.room + ' room' : '', ...f.features.map(id => m.features.find(feature => feature.id === id)?.label)].filter(Boolean).join(" · ");
    const key = visible.map(item => item.id + ":" + saved.includes(item.id) + ":" + item.updatedAt).join("|") + "/" + f.mode;
    if (key !== listKey || !$("housingList").childElementCount) {
      $("housingList").innerHTML = visible.length ? visible.map(card).join("") : empty("No matching places", f.mode === 'rent' ? "Try clearing a filter or searching a different campus." : "There are no listed options for this stay type. Contact Kagie support for help.");
      listKey = key;
    }
    $("housingMore").innerHTML = items.length > listLimit ? `<button class="ha-btn ha-outline ha-full" type="button" data-more>Show more places (${items.length - listLimit})</button>` : "";
  }
  function savedPage(view) {
    header(view === 'saved' ? "Saved places" : "Recently viewed");
    const ids = view === 'saved' ? saved : recent,
      items = ids.map(id => byId.get(id)).filter(Boolean);
    return `${localNav(view)}<p class="ha-sub">${view === 'saved' ? 'Keep your housing shortlist here.' : 'Return to places you’ve opened.'} Saved on this device for your account.</p><div class="ha-list">${items.length ? items.map(card).join("") : empty(view === 'saved' ? "No saved places yet" : "No recently viewed places", "Browse housing and open a place to get started.")}</div>${view === 'recent' && searchHistory.length ? `<h2 class="ha-h2">Recent searches</h2>${searchHistory.map((item, index) => `<button class="ha-chip" data-history="${index}" type="button">${esc(item.query || 'All areas')} · ${item.maxPrice < 8000 ? esc(money(item.maxPrice)) : 'Any budget'}</button>`).join(" ")}` : ''}`;
  }
  function detail(item) {
    if (!item) {
      header("Place unavailable");
      return empty("This place is unavailable", "It may have been removed from the housing catalogue.");
    }
    header("Accommodation", "#listings");
    const photos = getImages(item),
      amen = m.features.filter(feature => m.hasFeature(item, feature.id));
    return `<article class="ha-detail"><div class="ha-detail-gallery"><div class="ha-gallery"><img class="ha-main-photo" id="housingMainPhoto" src="${esc(photos[0])}" alt="${isIllustration(item) ? 'Example housing illustration' : esc(item.propertyName) + ' property photo'}" width="1100" height="733"/><div class="ha-gallery-top"><a class="ha-round" href="#listings" aria-label="Back to listings">${icon("back")}</a>${saveButton(item)}<button type="button" class="ha-round" data-share="${esc(item.id)}" aria-label="Share place">${icon("share")}</button></div>${isIllustration(item) ? '<span class="ha-photo-label" id="housingPhotoLabel">Illustration</span>' : ''}<span class="ha-gallery-counter" id="housingPhotoCount">1/${photos.length}</span></div>
      ${photos.length > 1 ? `<div class="ha-thumbs" aria-label="Property photos">${photos.map((photo, index) => `<button type="button" class="ha-thumb ${index === 0 ? 'active' : ''}" data-photo="${index}" aria-label="View photo ${index + 1}" aria-pressed="${index === 0}"><img src="${esc(photo)}" alt="" loading="lazy"/></button>`).join("")}</div>` : ''}</div>
      <div class="ha-detail-body"><div class="ha-card-top"><h1 class="ha-title">${esc(item.propertyName)}</h1><div class="ha-price">${price(item)}</div></div><p class="ha-location">${icon("pin")}${esc(locationLine(item))}</p>${tags(item)}
      <div class="ha-facts"><div class="ha-fact">${icon("bed")}<span><strong>${esc(item.roomType || 'Room type')}</strong><small>${item.roomType ? 'Confirm furnishings' : 'Ask the provider'}</small></span></div><div class="ha-fact">${icon("calendar")}<span><strong>${esc(item.availabilityStatus || 'Availability')}</strong><small>${item.availableFrom ? esc(date(item.availableFrom)) : 'Confirm move-in date'}</small></span></div><div class="ha-fact">${icon("document")}<span><strong>Lease</strong><small>Confirm terms with provider</small></span></div></div>
      <div class="ha-heading-row"><h2 class="ha-h2">Amenities</h2><button class="ha-chip" type="button" data-amenities="${esc(item.id)}">See all</button></div>
      ${amen.length ? `<div class="ha-amenities">${amen.slice(0, 5).map(feature => `<div class="ha-amenity">${icon(feature.icon)}${esc(feature.label === 'WiFi included' ? 'WiFi' : feature.label)}</div>`).join("")}</div>` : '<p class="ha-quiet">Amenities have not been provided for this listing.</p>'}
      <div class="ha-benefits"><h2>At a glance</h2><div class="ha-benefit-grid"><div>${icon("pin")}<strong>Campus</strong><small>${esc(item.institutionName || 'Ask the provider')}</small></div><div>${icon("bed")}<strong>Room</strong><small>${esc(item.roomType || 'Not provided')}</small></div><div>${icon("shield")}<a href="${href('safety', item.id)}"><strong>Safety checks</strong><small>Review before booking</small></a></div></div></div>
      <div class="ha-actions"><button class="ha-btn ha-outline" data-contact="${esc(item.id)}" type="button">${icon("chat")}Contact host</button><a class="ha-btn" href="${href('request', item.id)}">Request to reserve</a></div>
      ${requests.some(request => request.listingId === item.id) ? `<a class="ha-mini-link" href="${href('status', requests.find(request => request.listingId === item.id).id)}">${icon('clock')}<span><strong>View your request status</strong></span>${icon('next')}</a>` : ''}
      <h2 class="ha-h2">About this place</h2><p class="ha-description">${esc(item.description || item.shortDescription || 'Contact the provider for room details, lease terms and current availability.')}</p><p class="ha-quiet">${esc(item.address || 'Full address not provided')}</p></div></article>`;
  }
  function choice(name, value, label, selected) {
    return `<label class="ha-check ha-radio"><input type="radio" name="${name}" value="${value}" ${selected === value ? 'checked' : ''}/>${label}</label>`;
  }
  function filtersPage() {
    header("Filters", "#listings", '<button class="ha-chip" type="button" data-reset>Reset</button>');
    return `<form id="housingFilters"><div class="ha-filter-grid"><div><fieldset class="ha-fieldset"><legend>Budget per month</legend><div class="ha-range-label"><span>R0</span><strong id="housingBudgetLabel">${f.maxPrice === 8000 ? 'Any budget' : esc(money(f.maxPrice))}</strong></div><input class="ha-range" type="range" name="maxPrice" aria-label="Maximum monthly budget" min="0" max="8000" step="100" value="${f.maxPrice}"/><div class="ha-range-label"><span>R0</span><span>R8 000 / any budget</span></div></fieldset>
      <fieldset class="ha-fieldset"><legend>Distance from campus</legend><div class="ha-chips">${[["1", "Within 1km"], ["2", "Within 2km"], ["5", "Within 5km"], ["any", "Any distance"]].map(([v, l]) => choice('distance', v, l, f.distance)).join('')}</div></fieldset>
      <fieldset class="ha-fieldset"><legend>Accommodation type</legend><div class="ha-chips">${[["single", "Single room"], ["shared", "Shared room"], ["studio", "Apartment / studio"], ["any", "Any type"]].map(([v, l]) => choice('room', v, l, f.room)).join('')}</div></fieldset></div>
      <div><fieldset class="ha-fieldset"><legend>Must-haves</legend><div class="ha-chips">${m.features.slice(0, 6).map(feature => `<label class="ha-check"><input type="checkbox" name="features" value="${feature.id}" ${f.features.includes(feature.id) ? 'checked' : ''}/>${esc(feature.label)}</label>`).join('')}</div></fieldset><p class="ha-notice">These filters use recorded listing amenities. Ask the provider to confirm costs, eligibility and current availability.</p></div></div>
      <div class="ha-actions"><button class="ha-btn ha-outline" type="button" data-reset>Reset</button><button class="ha-btn" type="submit">Apply filters</button></div></form>`;
  }
  function field(name, label, value = "", type = "text", required = false) {
    if (type === 'date') {
      const day = String(value || '').slice(0, 10);
      value = m.dateValid(day) ? day : '';
    }
    return `<label class="ha-label">${label}<input class="ha-input" type="${type}" name="${name}" value="${esc(value)}" ${required ? 'required' : ''} ${type === 'date' ? `min="${m.today()}"` : ''} ${type === 'tel' ? 'autocomplete="tel"' : type === 'email' ? 'autocomplete="email"' : ''}/></label>`;
  }
  function select(name, label, values, value = "", required = false) {
    return `<label class="ha-label">${label}<select class="ha-input" name="${name}" aria-label="${esc(label)}" ${required ? 'required' : ''}><option value="">Select</option>${values.map(v => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
  }
  function requestPage(item) {
    header("Request to reserve", item ? detailHref(item) : "#listings");
    if (!item) return empty("This place is unavailable", "Choose another place from the catalogue.");
    if (admin?.settings?.serviceStatus && admin.settings.serviceStatus !== 'open') return empty("Housing requests are paused", admin.body || "You can still browse places. Please contact Kagie support for assistance.");
    const old = requests.find(request => request.listingId === item.id) || {},
      values = {
        ...profile,
        ...old
      };
    return `<section class="ha-request"><h1 class="ha-title">${esc(item.propertyName)}</h1><p class="ha-sub">Send a housing brief to Kagie support. The provider must confirm availability and the reservation.</p><form id="housingRequest" data-listing="${esc(item.id)}"><div class="ha-form-grid">
      ${field('learnerName', 'Full name', old.learnerName || profile.fullName || profile.fullNames || user.fullName || user.name, 'text', true)}${field('learnerEmail', 'Email', old.learnerEmail || profile.email || user.email, 'email', true)}${field('learnerPhone', 'Phone number', old.learnerPhone || profile.phone || profile.cellphone || user.phone, 'tel', true)}${field('institutionName', 'Institution', old.institutionName || profile.institutionName || item.institutionName, 'text', true)}
      ${field('preferredMoveInDate', 'Move-in date', old.preferredMoveInDate || moveIn, 'date', true)}${select('preferredLeaseMonths', 'Lease preference', ['Month-to-month', '3 months', '6 months', '10 months', '12 months', 'Unsure'], old.preferredLeaseMonths)}
      ${select('fundingStatus', 'Funding plan', ['NSFAS', 'Self-funded', 'Bursary', 'Family / sponsor', 'Mixed funding', 'Awaiting funding'], old.fundingStatus, true)}${select('documentsReady', 'Document readiness', ['All ready', 'Most ready', 'Need help collecting them', 'Still waiting for funding proof'], old.documentsReady, true)}
      ${select('nsfasBeneficiary', 'NSFAS status', ['yes', 'no', 'pending'], old.nsfasBeneficiary)}${field('nsfasSinceYear', 'NSFAS start year (if funded)', old.nsfasSinceYear, 'number')}
      ${select('roomPreference', 'Room preference', ['Single room', 'Shared room', 'Studio', 'Any available'], old.roomPreference || item.roomType)}${field('yearOfStudy', 'Year of study', values.yearOfStudy || profile.grade)}
      </div><details><summary>Student, funding and emergency details</summary><div class="ha-form-grid">${field('studentNumber', 'Student number', values.studentNumber)}${field('campusName', 'Campus', values.campusName)}${field('alternatePhone', 'Alternative phone', values.alternatePhone, 'tel')}${field('bursaryProvider', 'Sponsor / bursary details', values.bursaryProvider)}${field('guardianName', 'Guardian / sponsor name', values.guardianName || profile.guardianFullNames)}${field('guardianPhone', 'Guardian / sponsor phone', values.guardianPhone || profile.guardianCell1, 'tel')}${field('emergencyContactName', 'Emergency contact name', values.emergencyContactName)}${field('emergencyContactPhone', 'Emergency contact phone', values.emergencyContactPhone, 'tel')}${select('transportNeeded', 'Transport support', ['yes', 'no', 'maybe'], values.transportNeeded)}${field('specialNeeds', 'Accessibility / room needs', values.specialNeeds === 'none' ? '' : values.specialNeeds)}</div></details>
      <label class="ha-label">Notes for Kagie<textarea class="ha-input" name="note" maxlength="2500" placeholder="Share any preferences or support needs…">${esc(old.note)}</textarea></label><p id="housingRequestError" class="ha-error" role="alert"></p><div class="ha-actions"><a class="ha-btn ha-outline" href="${detailHref(item)}">Cancel</a><button class="ha-btn" type="submit">${old.id ? 'Update request' : 'Send request to Kagie'} ${icon('send')}</button></div></form></section>`;
  }
  function requestsPage() {
    header("Your housing requests");
    return `${localNav('requests')}${requests.length ? requests.map(request => `<a class="ha-mini-link" href="${href('status', request.id)}">${icon('clock')}<span><strong>${esc(request.propertyName || 'Housing request')}</strong><small>${esc(request.status)} · ${esc(date(request.updatedAt || request.createdAt))}</small><small>${request.source === 'remote' ? 'Saved online' : 'Saved on this device'}</small></span>${icon('next')}</a>`).join('') : empty("No requests yet", "Open a place and send a request to Kagie support.")}`;
  }
  function statusPage(request) {
    header("Request status", "#requests");
    if (!request) return empty("Request not found", "Check your account’s housing requests.");
    const online = request.source === 'remote';
    return `<section class="ha-status-screen"><div class="ha-status-intro"><div class="ha-status-art">${icon('send')}</div><h1 class="ha-title">${online ? 'Request submitted!' : 'Request saved on this device'}</h1><p class="ha-sub">${online ? 'Your housing brief is saved for Kagie support. A reservation still needs confirmation.' : 'This request has not been confirmed online. Open it and send again when connected.'}</p><strong>${esc(request.propertyName)}</strong></div><ol class="ha-timeline">
      <li><span class="ha-step-dot done">${icon('check')}</span><div class="ha-step-copy"><strong>${online ? 'Request submitted' : 'Saved locally'}</strong><span class="ha-step-time">${esc(date(request.createdAt))}</span><small>${online ? 'Your details have been recorded.' : 'Details are available on this device.'}</small></div></li>
      <li class="current"><span class="ha-step-dot">${icon('clock')}</span><div class="ha-step-copy"><strong>${esc(request.status || 'Support review requested')}</strong><small>Last updated ${esc(date(request.updatedAt))}</small></div></li>
      <li><span class="ha-step-dot"></span><div class="ha-step-copy"><strong>Confirm with the provider</strong><small>Ask Kagie support about availability, lease terms and the next steps.</small></div></li></ol><a class="ha-mini-link" href="../documents.html">${icon('document')}<span><strong>Required documents</strong><small>Keep your documents ready. Requirements depend on the residence and your funding.</small></span>${icon('next')}</a>${byId.has(request.listingId) ? `<a class="ha-btn ha-outline ha-full" style="margin-top:16px" href="${href('request', request.listingId)}">Review or update request</a>` : ''}${support()}</section>`;
  }
  function safetyPage(item) {
    header("Your safety matters", item ? detailHref(item) : '#home');
    const inspection = m.safeUrl(item?.inspectionDocumentUrl);
    return `<section class="ha-safety"><div class="ha-safety-intro"><p class="ha-sub">Check the property, provider and lease before you commit to student housing.</p></div><div class="ha-trust-banner">${icon('shield')}<div><h2>Choose with confidence</h2><p>Ask for current inspection documents, a clear lease and confirmation of any funding accreditation.</p></div></div><div class="ha-safety-checks">${[['shield', 'Physical check', 'Request inspection'], ['document', 'Clear lease', 'Read the terms'], ['shield', 'NSFAS check', 'Confirm accreditation'], ['user', 'Host identity', 'Confirm the provider']].map(([ic, label, sub]) => `<div>${icon(ic)}<strong>${label}</strong><small>${sub}</small></div>`).join('')}</div>
      <h2 class="ha-h2">${item ? esc(item.propertyName) : 'Before you reserve'}</h2><p class="ha-notice">${inspection ? `<a href="${esc(inspection)}" target="_blank" rel="noopener noreferrer">${icon('document')} View the supplied inspection document</a>` : 'Inspection evidence has not been supplied here. Ask the provider or Kagie support before booking.'}</p>
      <div class="ha-mini-link">${icon('document')}<span><strong>Check costs and terms</strong><small>Confirm the rent, deposit, utility costs, cancellation terms and the payment recipient.</small></span></div><h2 class="ha-h2">Student reviews</h2><p class="ha-description">There are no verified student reviews available on this page yet.</p>${support()}</section>`;
  }
  function mapPage() {
    header("Find places on a map", '#listings');
    return `<p class="ha-sub">Open a map search using each listing’s supplied address. Confirm the precise location with the provider.</p>${filtered().map(item => `<article class="ha-map-row"><div><h2><a href="${detailHref(item)}">${esc(item.propertyName)}</a></h2><p class="ha-quiet">${esc(item.address || item.location || 'Address not supplied')}</p></div>${item.address || item.location ? `<a class="ha-btn ha-blue" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address || item.location)}">${icon('map')}Open map</a>` : ''}</article>`).join('') || empty('No places to show', 'Try widening your search.')}`;
  }
  function parseRoute() {
    const [view, id] = location.hash.slice(1).split('/');
    let decoded = '';
    try {
      decoded = decodeURIComponent(id || '');
    } catch {}
    return {
      view: ['home', 'listings', 'saved', 'recent', 'requests', 'detail', 'filters', 'request', 'status', 'safety', 'map'].includes(view) ? view : 'home',
      id: decoded
    };
  }
  function render(focus = false) {
    if (!user) return;
    listKey = '';
    const item = byId.get(route.id);
    let html;
    if (route.view === 'home') html = home();else if (route.view === 'listings') html = listingsPage();else if (['saved', 'recent'].includes(route.view)) html = savedPage(route.view);else if (route.view === 'detail') html = detail(item);else if (route.view === 'filters') html = filtersPage();else if (route.view === 'request') html = requestPage(item);else if (route.view === 'requests') html = requestsPage();else if (route.view === 'status') html = statusPage(requests.find(request => request.id === route.id));else if (route.view === 'safety') html = safetyPage(item);else html = mapPage();
    $("housingContent").innerHTML = html;
    $("housingContent").setAttribute('aria-busy', 'false');
    if (route.view === 'listings') updateList();
    if (focus) {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
      const title = $("housingHeader").querySelector('h1') || $("housingContent").querySelector('h1');
      if (title) {
        title.tabIndex = -1;
        title.focus({
          preventScroll: true
        });
      }
    }
  }
  function persistFilters() {
    saveLocal('filters', {
      ...f,
      moveIn,
      students
    });
  }
  function remember(item) {
    if (!item) return;
    const next = [item.id, ...recent.filter(id => id !== item.id)].slice(0, 20);
    if (saveLocal('recent', next)) recent = next;
  }
  function dialog(title, body) {
    const node = $("housingDialog");
    node.innerHTML = `<button class="ha-round" data-dialog-close type="button" aria-label="Close">${icon('close')}</button><h2 id="housingDialogTitle">${esc(title)}</h2>${body}`;
    node.showModal();
  }
  async function submit(form) {
    if (submitting) return;
    const item = byId.get(form.dataset.listing),
      errorNode = $("housingRequestError");
    if (!refreshDone) {
      errorNode.textContent = 'Please wait while Kagie checks the housing service.';
      return;
    }
    if (!item || admin?.settings?.serviceStatus && admin.settings.serviceStatus !== 'open') {
      errorNode.textContent = 'Housing requests are unavailable right now.';
      return;
    }
    const old = requests.find(request => request.listingId === item.id) || {};
    const payload = {
      ...old,
      ...Object.fromEntries(new FormData(form)),
      listingId: item.id,
      propertyName: item.propertyName,
      province: item.province,
      location: item.location,
      address: item.address,
      roomType: item.roomType,
      price: item.price,
      images: item.images,
      providerPhone: item.contactPhone,
      status: old.status || 'Support review requested'
    };
    payload.contactPhone = payload.learnerPhone;
    payload.supportSummary = `Move-in ${payload.preferredMoveInDate} | Funding ${payload.fundingStatus} | Documents ${payload.documentsReady} | Students ${students}`;
    payload.supportChecklist = [`Funding: ${payload.fundingStatus}`, `Documents: ${payload.documentsReady}`];
    const errors = m.validate(payload);
    if (errors.length) {
      errorNode.textContent = errors.join(' ');
      errorNode.tabIndex = -1;
      errorNode.focus();
      return;
    }
    submitting = true;
    errorNode.textContent = '';
    const button = form.querySelector('button[type=submit]'),
      original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Saving…';
    try {
      const result = await (api.submitAccommodationRequestAsync ? api.submitAccommodationRequestAsync(payload, user.id) : api.submitAccommodationRequest(payload, user.id));
      if (!result?.id) throw new Error('The request was not saved. Please try again.');
      requests = [result, ...requests.filter(request => request.id !== result.id && request.listingId !== item.id)];
      if (route.view === 'request' && route.id === item.id) location.hash = href('status', result.id);else toast(result.source === 'remote' ? 'Housing request submitted.' : 'Housing request saved on this device.');
    } catch (error) {
      errorNode.textContent = error.message || 'Could not save your request. Your form is still here.';
    } finally {
      submitting = false;
      if (button.isConnected) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = original;
      }
    }
  }
  function bind() {
    document.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-save')) {
        const item = byId.get(button.dataset.save);
        if (!item) return;
        const next = saved.includes(item.id) ? saved.filter(id => id !== item.id) : [...saved, item.id];
        if (!saveLocal('saved', next)) return;
        saved = next;
        if (route.view === 'saved') render();else {
          document.querySelectorAll('[data-save]').forEach(node => {
            const active = saved.includes(node.dataset.save);
            node.setAttribute('aria-pressed', active);
            node.setAttribute('aria-label', `${active ? 'Unsave' : 'Save'} ${byId.get(node.dataset.save)?.propertyName || 'place'}`);
          });
        }
        toast(saved.includes(item.id) ? 'Place saved.' : 'Place removed from saved.');
      } else if (button.hasAttribute('data-mode')) {
        const form = $('housingSearch');
        if (form) {
          const data = new FormData(form);
          f = m.filters({...f, query:data.get('query'), maxPrice:data.get('maxPrice')});
          moveIn = String(data.get('moveIn') || '');
          students = String(data.get('students') || '1');
        }
        f.mode = button.dataset.mode;
        persistFilters();
        render();
      } else if (button.hasAttribute('data-preset')) {
        if (button.dataset.preset === 'all') f = {
          ...m.defaults,
          query: f.query,
          mode: f.mode
        };else if (button.dataset.preset === 'budget') f.maxPrice = f.maxPrice === 3000 ? 8000 : 3000;else f.distance = f.distance === '5' ? 'any' : '5';
        persistFilters();
        render();
      } else if (button.hasAttribute('data-reset')) {
        f = {
          ...m.defaults,
          query: f.query,
          mode: f.mode
        };
        persistFilters();
        render();
      } else if (button.hasAttribute('data-more')) {
        listLimit += 24;
        updateList();
      } else if (button.hasAttribute('data-history')) {
        f = m.filters(searchHistory[Number(button.dataset.history)]);
        persistFilters();
        location.hash = '#listings';
      } else if (button.hasAttribute('data-photo')) {
        const item = byId.get(route.id),
          photos = getImages(item),
          index = Number(button.dataset.photo);
        if (!photos[index]) return;
        $("housingMainPhoto").src = photos[index];
        delete $("housingMainPhoto").dataset.fallback;
        $("housingMainPhoto").alt = isIllustration(item, index) ? 'Example housing illustration' : item.propertyName + ' property photo';
        const caption = document.querySelector('.ha-gallery .ha-photo-label');
        if (caption) caption.hidden = !isIllustration(item, index);
        else if (isIllustration(item, index)) document.querySelector('.ha-gallery')?.insertAdjacentHTML('beforeend', '<span class="ha-photo-label">Illustration</span>');
        $("housingPhotoCount").textContent = `${index + 1}/${photos.length}`;
        document.querySelectorAll('[data-photo]').forEach(node => {
          const active = Number(node.dataset.photo) === index;
          node.classList.toggle('active', active);
          node.setAttribute('aria-pressed', active);
        });
      } else if (button.hasAttribute('data-amenities')) {
        const item = byId.get(button.dataset.amenities);
        if (item) dialog('All amenities', item.amenities.length ? `<ul>${item.amenities.map(value => `<li>${esc(value)}</li>`).join('')}</ul>` : '<p>Amenities have not been supplied. Ask the provider for details.</p>');
      } else if (button.hasAttribute('data-contact')) {
        const item = byId.get(button.dataset.contact);
        if (!item) return;
        const phone = String(item.contactPhone || '').replace(/[^\d+]/g, ''),
          email = String(item.contactEmail || '');
        dialog('Contact the provider', `<p>${esc(item.propertyName)}</p>${/^\+?\d{7,15}$/.test(phone) ? `<a class="ha-mini-link" href="tel:${esc(phone)}">${icon('chat')}Call ${esc(item.contactPhone)}</a>` : ''}${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `<a class="ha-mini-link" href="mailto:${encodeURIComponent(email)}">${icon('send')}Email the provider</a>` : ''}<p>Confirm the current room, costs and availability directly.</p>${support()}`);
      } else if (button.hasAttribute('data-dialog-close')) $("housingDialog").close();else if (button.hasAttribute('data-share')) {
        const item = byId.get(button.dataset.share);
        if (!item) return;
        const data = {
          title: item.propertyName,
          url: location.origin + location.pathname + detailHref(item)
        };
        try {
          if (navigator.share) await navigator.share(data);else if (navigator.clipboard) {
            await navigator.clipboard.writeText(data.url);
            toast('Link copied.');
          } else dialog('Share place', `<label class="ha-label">Copy this link<input class="ha-input" readonly value="${esc(data.url)}"/></label>`);
        } catch (error) {
          if (error.name !== 'AbortError') toast('Could not share this place. Try copying the page link.');
        }
      }
    });
    $("housingContent").addEventListener('submit', event => {
      event.preventDefault();
      const form = event.target;
      if (form.id === 'housingSearch') {
        const data = new FormData(form);
        f = m.filters({
          ...f,
          query: data.get('query'),
          maxPrice: data.get('maxPrice')
        });
        moveIn = String(data.get('moveIn') || '');
        students = String(data.get('students') || '1');
        persistFilters();
        const next = [{
          ...f
        }, ...searchHistory.filter(item => JSON.stringify(item) !== JSON.stringify(f))].slice(0, 6);
        if (saveLocal('searches', next)) searchHistory = next;
        location.hash = '#listings';
      } else if (form.id === 'housingFilters') {
        const data = new FormData(form);
        f = m.filters({
          ...f,
          maxPrice: data.get('maxPrice'),
          distance: data.get('distance'),
          room: data.get('room'),
          features: data.getAll('features')
        });
        persistFilters();
        location.hash = '#listings';
      } else if (form.id === 'housingRequest') void submit(form);
    });
    $("housingContent").addEventListener('input', event => {
      const input = event.target;
      if (input.id === 'housingQuery') {
        f.query = input.value.trim().slice(0, 160);
        persistFilters();
        listLimit = 24;
        updateList();
      } else if (input.matches('[name=maxPrice][type=range]')) $("housingBudgetLabel").textContent = Number(input.value) === 8000 ? 'Any budget' : money(Number(input.value));
    });
    $("housingContent").addEventListener('error', event => {
      const img = event.target;
      if (img instanceof HTMLImageElement && img.dataset.fallback !== 'true') {
        img.dataset.fallback = 'true';
        img.src = art;
        img.alt = 'Example housing illustration';
        const media = img.closest('.ha-card-media,.ha-gallery');
        if (media && !media.querySelector('.ha-photo-label')) media.insertAdjacentHTML('beforeend', '<span class="ha-photo-label">Illustration · photo unavailable</span>');
      }
    }, true);
    window.addEventListener('hashchange', () => {
      route = parseRoute();
      listLimit = 24;
      if (route.view === 'detail') remember(byId.get(route.id));
      if ($("housingDialog").open) $("housingDialog").close();
      render(true);
    });
    window.addEventListener('storage', event => {
      if (event.key === storageKey('saved')) {
        const next = read(storageKey('saved'), []);
        saved = Array.isArray(next) ? next.filter(id => typeof id === 'string') : [];
        if (['saved', 'listings', 'detail'].includes(route.view)) render();
      }
    });
  }
  async function main() {
    try {
      if (!api || !m) throw new Error('Please refresh to load the housing section.');
      user = api.resolveSessionUser ? await api.resolveSessionUser({
        attempts: 2,
        delayMs: 200
      }) : await api.restoreSession();
      user = user || api.currentUser?.();
      if (!user || !['user', 'learner', 'student'].includes(api.normalizeRole ? api.normalizeRole(user.role) : user.role)) {
        location.replace('../login.html?app=1');
        return;
      }
      const previous = read(storageKey('filters'), {});
      f = m.filters(previous);
      moveIn = m.dateValid(previous.moveIn) ? previous.moveIn : '';
      students = ['1', '2', '3', '4'].includes(previous.students) ? previous.students : '1';
      saved = read(storageKey('saved'), []);
      if (!Array.isArray(saved)) saved = [];
      saved = saved.filter(id => typeof id === 'string');
      recent = read(storageKey('recent'), []);
      if (!Array.isArray(recent)) recent = [];
      searchHistory = read(storageKey('searches'), []);
      if (!Array.isArray(searchHistory)) searchHistory = [];
      listings = m.normalize(api.getAccommodationListings?.() || []);
      byId = new Map(listings.map(item => [item.id, item]));
      requests = api.getAccommodationRequests?.(user.id) || [];
      profile = api.getProfile?.(user.id) || {};
      route = parseRoute();
      bind();
      render();
      ['home', 'career', 'school', 'housing', 'bus'].forEach((name, index) => {
        const node = document.querySelectorAll('.bottom-nav-icon')[index];
        if (node) node.innerHTML = icon(name);
      });
      const results = await Promise.allSettled([api.getProfileAsync?.(user.id) || profile, api.getAdminContentAsync?.('housing_hub') || null, api.getAccommodationListingsAsync?.() || listings, api.getAccommodationRequestsAsync?.(user.id) || requests]);
      if (results[0].status === 'fulfilled') profile = results[0].value || {};
      if (results[1].status === 'fulfilled') admin = results[1].value;
      if (results[2].status === 'fulfilled') {
        listings = m.normalize(results[2].value);
        byId = new Map(listings.map(item => [item.id, item]));
      }
      if (results[3].status === 'fulfilled') requests = results[3].value || [];
      requests.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      refreshDone = true;
      // Preserve input and focus while remote data arrives.
      if (route.view === 'listings') updateList();else if (route.view === 'request' && !$("housingRequest")) render();else if (!['request', 'filters'].includes(route.view) && !$("housingContent").contains(document.activeElement)) render();
      if (route.view === 'request' && admin?.settings?.serviceStatus && admin.settings.serviceStatus !== 'open') render();
      if (route.view === 'detail') remember(byId.get(route.id));
      if (results.some(result => result.status === 'rejected')) toast('Some information could not be refreshed. Showing the details already on this device.');
      $("housingContent").dataset.ready = 'true';
    } catch (error) {
      $("housingContent").innerHTML = empty('Housing unavailable', error.message);
      $("housingContent").setAttribute('aria-busy', 'false');
      $("housingContent").dataset.ready = 'true';
    }
  }
  document.addEventListener('DOMContentLoaded', main, {
    once: true
  });
})();
