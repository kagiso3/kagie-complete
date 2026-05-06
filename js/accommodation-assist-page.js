(() => {
  const META_BY_ID = {
    acc_campus_lofts: {
      ribbon: "Best value",
      rating: 4.8,
      reviews: 42,
      safety: 88,
      amenities: ["WiFi", "Secure access", "Study lounge", "Taxi route"],
      femaleOnly: false,
      solar: false,
      accent: "linear-gradient(135deg,#123c74,#1f8aea)"
    },
    acc_rosebank_court: {
      ribbon: "Popular",
      rating: 4.7,
      reviews: 31,
      safety: 90,
      amenities: ["Biometric access", "Shuttle route", "Private studio", "Study zone"],
      femaleOnly: true,
      solar: true,
      accent: "linear-gradient(135deg,#c24848,#f39a38)"
    },
    acc_capitol_residence: {
      ribbon: "Budget pick",
      rating: 4.4,
      reviews: 26,
      safety: 82,
      amenities: ["WiFi", "Laundry", "Shared kitchen", "Study support"],
      femaleOnly: false,
      solar: false,
      accent: "linear-gradient(135deg,#164d36,#1a6b4a)"
    },
    acc_table_mountain_house: {
      ribbon: "Premium",
      rating: 4.9,
      reviews: 64,
      safety: 95,
      amenities: ["Private room", "Controlled access", "Quiet study", "Power backup"],
      femaleOnly: false,
      solar: true,
      accent: "linear-gradient(135deg,#10233d,#2b5fa8)"
    }
  };

  const MAP_POSITIONS = [
    { top: "28px", left: "56px", color: "rgba(31,138,234,.78)" },
    { top: "42px", right: "52px", color: "rgba(26,107,74,.82)" },
    { bottom: "20px", right: "40px", color: "rgba(242,205,103,.82)" }
  ];

  const REQUEST_PROGRESS_FIELDS = [
    "reqLearnerName",
    "reqLearnerEmail",
    "reqLearnerPhone",
    "reqInstitutionName",
    "reqYearOfStudy",
    "reqFundingStatus",
    "reqNsfasBeneficiary",
    "reqMoveInDate",
    "reqDocumentsReady",
    "reqGuardianName",
    "reqGuardianPhone",
    "reqEmergencyName",
    "reqEmergencyPhone"
  ];

  const state = {
    user: null,
    profile: {},
    listings: [],
    requests: [],
    query: "",
    activePreset: "all",
    showAll: false,
    compareIds: [],
    activeListingId: "",
    filters: {
      maxPrice: 8000,
      roomType: "any",
      distance: "any",
      mustHaves: new Set()
    }
  };

  const el = {};

  function $(id) {
    return document.getElementById(id);
  }

  function debounceFrame(fn, delay) {
    let timer = 0;
    return (...args) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        fn(...args);
      }, delay);
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(value) {
    return `R${Number(value || 0).toLocaleString("en-ZA")}`;
  }

  function shortName(value) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase() || "").join("") || "KG";
  }

  function parseDistanceKm(value) {
    const match = String(value || "").match(/([\d.]+)/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function extractCampusName(value) {
    const match = String(value || "").match(/from\s+(.+)$/i);
    return match ? match[1].trim() : "";
  }

  function getMeta(listing) {
    const seeded = META_BY_ID[listing.id] || {};
    const distanceKm = parseDistanceKm(listing.distanceFromCampus);
    const price = Number(listing.price || 0);
    const inferredAmenities = seeded.amenities || [
      price <= 5000 ? "NSFAS-friendly" : "Private only",
      /studio|single/i.test(listing.roomType || "") ? "Private room" : "Shared space",
      distanceKm <= 1.2 ? "Walkable" : "Shuttle route",
      /secure|controlled|biometric/i.test(listing.description || "") ? "Security" : "Student support"
    ];
    return {
      ribbon: seeded.ribbon || "",
      rating: seeded.rating || 4.5,
      reviews: seeded.reviews || 20,
      safety: seeded.safety || Math.max(76, Math.min(96, 90 - Math.round(distanceKm * 4))),
      amenities: inferredAmenities.slice(0, 4),
      femaleOnly: Boolean(seeded.femaleOnly),
      solar: Boolean(seeded.solar),
      accent: seeded.accent || "linear-gradient(135deg,#10233d,#1f8aea)"
    };
  }

  function isNsfasFriendly(listing) {
    return Number(listing.price || 0) <= 5000;
  }

  function hasFeature(listing, feature) {
    const meta = getMeta(listing);
    const haystack = [
      listing.propertyName,
      listing.description,
      listing.roomType,
      meta.amenities.join(" ")
    ].join(" ").toLowerCase();
    if (feature === "wifi") return haystack.includes("wifi");
    if (feature === "female") return meta.femaleOnly || haystack.includes("female");
    if (feature === "solar") return meta.solar || haystack.includes("solar") || haystack.includes("backup");
    if (feature === "nsfas") return isNsfasFriendly(listing);
    return false;
  }

  function listingMatchesPreset(listing) {
    switch (state.activePreset) {
      case "budget": return Number(listing.price || 0) <= 3000;
      case "close": return parseDistanceKm(listing.distanceFromCampus) <= 1;
      case "nsfas": return isNsfasFriendly(listing);
      case "single": return /single/i.test(listing.roomType || "");
      case "female": return hasFeature(listing, "female");
      case "wifi": return hasFeature(listing, "wifi");
      default: return true;
    }
  }

  function listingMatchesFilters(listing) {
    const query = state.query.trim().toLowerCase();
    if (query) {
      const haystack = [
        listing.propertyName,
        listing.institutionName,
        listing.location,
        listing.address,
        listing.description,
        listing.roomType
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (Number(listing.price || 0) > Number(state.filters.maxPrice || 0)) return false;
    if (state.filters.roomType !== "any" && !String(listing.roomType || "").toLowerCase().includes(state.filters.roomType)) return false;
    if (state.filters.distance !== "any" && state.filters.distance !== "map" && parseDistanceKm(listing.distanceFromCampus) > Number(state.filters.distance)) return false;

    for (const mustHave of state.filters.mustHaves) {
      if (!hasFeature(listing, mustHave)) return false;
    }

    return listingMatchesPreset(listing);
  }

  function getFilteredListings() {
    return state.listings.filter(listingMatchesFilters);
  }

  function getVisibleListings() {
    const filtered = getFilteredListings();
    return state.showAll ? filtered : filtered.slice(0, 3);
  }

  function getRequestForListing(listingId) {
    return state.requests.find((request) => String(request.listingId || "") === String(listingId || ""));
  }

  function isRequested(listingId) {
    return Boolean(getRequestForListing(listingId));
  }

  function getRequestButtonLabel(listingId) {
    return isRequested(listingId) ? "Update request" : "Request stay";
  }

  function sortRequests(items) {
    return items.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  function getRequestFieldValue(id) {
    const node = $(id);
    return node ? String(node.value || "").trim() : "";
  }

  function setRequestFieldValue(id, value) {
    const node = $(id);
    if (node) node.value = value == null ? "" : String(value);
  }

  function getCurrentListing() {
    return state.listings.find((listing) => listing.id === state.activeListingId) || null;
  }

  function updateHero() {
    const name = state.profile.fullName || state.profile.fullNames || state.user?.name || "Kagie learner";
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const filtered = getFilteredListings();
    const closest = filtered.reduce((best, listing) => {
      const distance = parseDistanceKm(listing.distanceFromCampus);
      return distance < best ? distance : best;
    }, Number.POSITIVE_INFINITY);

    if (el.heroGreeting) el.heroGreeting.textContent = greeting;
    if (el.heroName) el.heroName.textContent = name;
    if (el.heroAvatar) el.heroAvatar.textContent = shortName(name);
    el.statListings.textContent = String(filtered.length);
    el.statRequests.textContent = String(state.requests.length);
    el.statClosest.textContent = Number.isFinite(closest) ? `${closest.toFixed(1)}km` : "-";
    el.heroSub.textContent = state.requests.length
      ? `Kagie is already tracking ${state.requests.length} housing request${state.requests.length === 1 ? "" : "s"} for your account.`
      : "Verified student housing. Real safety scores. Zero guessing.";
  }

  function renderRequestTracker() {
    if (!el.requestTracker) return;

    if (!state.requests.length) {
      el.requestTracker.innerHTML = `
        <div class="helper-kicker">Housing tracker</div>
        <div class="helper-title">No housing requests yet</div>
        <div class="helper-copy">Browse verified listings, compare a few options, then tap Request stay to send Kagie your move-in, NSFAS, and support details in one proper housing brief.</div>
      `;
      return;
    }

    const latest = state.requests[0];
    const summary = latest.supportSummary
      || `Move-in ${latest.preferredMoveInDate || "not set yet"} | Funding ${latest.fundingStatus || "not shared yet"}`;
    const status = latest.status || "Support review requested";

    el.requestTracker.innerHTML = `
      <div class="helper-kicker">Housing tracker</div>
      <div class="helper-title">${escapeHtml(latest.propertyName || "Accommodation request")} is with Kagie</div>
      <div class="helper-copy">${escapeHtml(summary)}</div>
      <div class="field-hint" style="margin-top:8px;">Status: ${escapeHtml(status)}. Last updated ${escapeHtml(formatDate(latest.updatedAt || latest.createdAt))}.</div>
    `;
  }

  function renderListings() {
    const filtered = getFilteredListings();
    const visible = getVisibleListings();
    el.resultsTitle.textContent = filtered.length ? `${filtered.length} housing match${filtered.length === 1 ? "" : "es"} for you` : "No matches yet";
    el.seeAllBtn.textContent = state.showAll ? "Show top picks" : `See all ${filtered.length}`;

    if (!filtered.length) {
      el.listingResults.innerHTML = `<div class="empty-state">No listings match that search and filter combination yet. Try clearing a filter or raising your max price.</div>`;
      return;
    }

    el.listingResults.innerHTML = visible.map((listing, index) => {
      const meta = getMeta(listing);
      const selected = state.compareIds.includes(listing.id);
      const requested = isRequested(listing.id);
      const tags = [
        `<span class="tag ${String(listing.availabilityStatus || "").toLowerCase().includes("available") ? "tag-green" : "tag-gold"}">${escapeHtml(listing.availabilityStatus || "Available")}</span>`,
        `<span class="tag tag-blue">${escapeHtml(listing.roomType || "Room")}</span>`,
        isNsfasFriendly(listing) ? `<span class="tag tag-gold">NSFAS-friendly</span>` : "",
        meta.femaleOnly ? `<span class="tag tag-red">Female-only</span>` : "",
        requested ? `<span class="tag tag-blue">Kagie tracking</span>` : ""
      ].filter(Boolean).join("");
      const features = meta.amenities.map((amenity) => `<span class="feat"><span class="feat-icon">+</span>${escapeHtml(amenity)}</span>`).join("");
      const image = Array.isArray(listing.images) && listing.images[0] ? listing.images[0] : "";
      const backgroundStyle = image
        ? `background:${meta.accent};background-image:linear-gradient(to bottom, rgba(16,35,61,.12), rgba(16,35,61,.22)), url('${escapeHtml(image)}');background-size:cover;background-position:center;`
        : `background:${meta.accent};`;

      return `
        <div class="listing-card ${index === 0 ? "featured" : ""} ${selected ? "selected" : ""}" data-card-id="${escapeHtml(listing.id)}">
          ${meta.ribbon && index === 0 ? `<div class="featured-ribbon">${escapeHtml(meta.ribbon)}</div>` : ""}
          <div class="listing-img">
            <div class="listing-img-bg" style="${backgroundStyle}">${escapeHtml(shortName(listing.propertyName))}</div>
            <div class="img-overlay">
              <div class="price-tag">${escapeHtml(money(listing.price))} <small>/ month</small></div>
              <div class="verified-chip"><div class="verified-dot"></div>Verified</div>
            </div>
          </div>
          <div class="listing-body">
            <div class="listing-name">${escapeHtml(listing.propertyName)}</div>
            <div class="listing-loc">
              <div class="loc-dot"></div>
              ${escapeHtml(listing.distanceFromCampus || listing.location || "Near campus")}
            </div>
            <div class="tag-row">${tags}</div>
            <div class="feat-row">${features}</div>
            <div class="safety-row">
              <span class="safety-label">Safety</span>
              <div class="safety-track"><div class="safety-fill" style="width:${escapeHtml(meta.safety)}%"></div></div>
              <span class="safety-score">${escapeHtml(meta.safety)}/100</span>
            </div>
            <div class="listing-footer">
              <div class="stars-row">
                <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span class="rating">${escapeHtml(meta.rating.toFixed(1))}</span>
                <span class="review-count">(${escapeHtml(meta.reviews)} reviews)</span>
              </div>
              <div class="listing-cta-row">
                <button class="cta-btn secondary ${selected ? "active" : ""}" type="button" data-compare-id="${escapeHtml(listing.id)}">${selected ? "Selected" : "Compare"}</button>
                <button class="cta-btn" type="button" data-request-id="${escapeHtml(listing.id)}">${getRequestButtonLabel(listing.id)}</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderProximity() {
    const items = getFilteredListings()
      .slice()
      .sort((a, b) => parseDistanceKm(a.distanceFromCampus) - parseDistanceKm(b.distanceFromCampus))
      .slice(0, 3);

    if (!items.length) {
      el.mapDots.innerHTML = "";
      el.proximityRows.innerHTML = `<div class="empty-state" style="box-shadow:none;border:none;padding:6px 0;">Add a broader filter to see the campus proximity view.</div>`;
      return;
    }

    el.mapDots.innerHTML = items.map((listing, index) => {
      const pos = MAP_POSITIONS[index] || MAP_POSITIONS[MAP_POSITIONS.length - 1];
      const style = Object.entries(pos).map(([key, value]) => `${key}:${value}`).join(";");
      return `
        <div class="map-dot" style="${style}">
          <div class="map-dot-circle" style="background:${escapeHtml(pos.color)}"></div>
          <div class="map-dot-label">${escapeHtml((listing.propertyName || "").split(" ")[0] || "Stay")}</div>
        </div>
      `;
    }).join("");

    el.proximityRows.innerHTML = items.map((listing) => {
      const distance = parseDistanceKm(listing.distanceFromCampus);
      const walkLabel = Number.isFinite(distance) ? `${Math.max(3, Math.round(distance * 12))} min` : "Nearby";
      const travelLabel = distance <= 1 ? "On route" : distance <= 1.8 ? "Shuttle 5 min" : "Taxi needed";
      const travelClass = distance <= 1.8 ? "prox-taxi" : "";
      const travelStyle = distance > 1.8 ? 'style="background:rgba(242,205,103,.14);color:#8B6500;"' : "";
      return `
        <div class="prox-row">
          <span class="prox-name">${escapeHtml(listing.propertyName)}</span>
          <div class="prox-tags">
            <span class="prox-tag prox-walk">Walk ${escapeHtml(walkLabel)}</span>
            <span class="prox-tag ${travelClass}" ${travelStyle}>${escapeHtml(travelLabel)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderNearby() {
    const items = getFilteredListings().slice(3, 8);
    if (!items.length) {
      el.nearbyListings.innerHTML = `<div class="empty-state" style="min-width:100%;margin-right:16px;">No extra nearby options yet. Try See all or clear one of the filters.</div>`;
      return;
    }

    el.nearbyListings.innerHTML = items.map((listing) => {
      const meta = getMeta(listing);
      const image = Array.isArray(listing.images) && listing.images[0] ? listing.images[0] : "";
      const backgroundStyle = image
        ? `background-image:linear-gradient(to bottom, rgba(16,35,61,.08), rgba(16,35,61,.18)), url('${escapeHtml(image)}');background-size:cover;background-position:center;`
        : `background:${meta.accent};`;
      return `
        <div class="mini-card" data-compare-id="${escapeHtml(listing.id)}">
          <div class="mini-card-img" style="${backgroundStyle}">${escapeHtml(shortName(listing.propertyName))}</div>
          <div class="mini-card-body">
            <div class="mini-card-name">${escapeHtml(listing.propertyName)}</div>
            <div class="mini-card-dist"><span>Near</span>${escapeHtml(listing.distanceFromCampus || listing.location || "Near campus")}</div>
            <div class="mini-card-price">${escapeHtml(money(listing.price))}<small>/mo</small></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderCompareTray() {
    const selected = state.listings.filter((listing) => state.compareIds.includes(listing.id)).slice(0, 3);
    el.compareSlots.innerHTML = [0, 1, 2].map((slot) => {
      const listing = selected[slot];
      if (!listing) return `<div class="tray-slot empty">+ Add</div>`;
      return `<div class="tray-slot filled">${escapeHtml((listing.propertyName || "").split(" ").slice(0, 2).join(" "))}</div>`;
    }).join("");
    el.compareBtn.disabled = selected.length < 2;
    el.compareTray.classList.toggle("hidden", selected.length === 0);
  }

  function renderCompareOverlay() {
    const selected = state.listings.filter((listing) => state.compareIds.includes(listing.id)).slice(0, 3);
    if (!selected.length) {
      el.compareIntro.textContent = "Choose at least two listings to compare.";
      el.compareGrid.innerHTML = `<div class="empty-state">Tap Compare on a few listings and Kagie will line them up here.</div>`;
      return;
    }
    el.compareIntro.textContent = `${selected.length} selected stay${selected.length === 1 ? "" : "s"} lined up for a fast side-by-side check.`;
    el.compareGrid.innerHTML = selected.map((listing) => {
      const meta = getMeta(listing);
      return `
        <div class="compare-card">
          <div class="compare-name">${escapeHtml(listing.propertyName)}</div>
          <div class="compare-line"><span>Price</span><strong>${escapeHtml(money(listing.price))}/mo</strong></div>
          <div class="compare-line"><span>Room</span><strong>${escapeHtml(listing.roomType || "Room")}</strong></div>
          <div class="compare-line"><span>Distance</span><strong>${escapeHtml(listing.distanceFromCampus || "Near campus")}</strong></div>
          <div class="compare-line"><span>Safety</span><strong>${escapeHtml(meta.safety)}/100</strong></div>
          <div class="compare-line"><span>Status</span><strong>${escapeHtml(listing.availabilityStatus || "Available")}</strong></div>
        </div>
      `;
    }).join("");
  }

  function renderAssistantResponse(query) {
    const q = String(query || "").trim().toLowerCase();
    const listings = getFilteredListings();
    if (!q) {
      el.assistantMsg.textContent = "Ask me about budget, safety, distance, or what Kagie needs before sending a housing request.";
      return;
    }
    if (!listings.length) {
      el.assistantMsg.textContent = "Your current filters are too tight. Try widening the price or distance and I will point out the strongest options.";
      return;
    }

    const safest = listings.slice().sort((a, b) => getMeta(b).safety - getMeta(a).safety)[0];
    const cheapest = listings.slice().sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];
    const closest = listings.slice().sort((a, b) => parseDistanceKm(a.distanceFromCampus) - parseDistanceKm(b.distanceFromCampus))[0];
    const single = listings.find((listing) => /single|studio/i.test(listing.roomType || ""));

    if (/safe|security/.test(q)) {
      el.assistantMsg.textContent = `${safest.propertyName} is the safest match right now at ${getMeta(safest).safety}/100, and it is marked ${safest.availabilityStatus || "Available"}.`;
      return;
    }
    if (/cheap|budget|afford|nsfas/.test(q)) {
      el.assistantMsg.textContent = `${cheapest.propertyName} is your best budget pick at ${money(cheapest.price)} per month${isNsfasFriendly(cheapest) ? ", and it still fits the NSFAS-friendly range." : "."}`;
      return;
    }
    if (/close|near|distance|walk/.test(q)) {
      el.assistantMsg.textContent = `${closest.propertyName} is the closest option in this list at ${closest.distanceFromCampus || "a short distance from campus"}.`;
      return;
    }
    if (/single|private|studio/.test(q) && single) {
      el.assistantMsg.textContent = `${single.propertyName} gives you the most private setup in this filtered list with a ${single.roomType || "single room"} option.`;
      return;
    }
    if (/request|book|reserve|stay/.test(q)) {
      el.assistantMsg.textContent = "Tap Request stay to open the full Kagie housing form. It asks for move-in timing, NSFAS or funding, guardian contacts, and any support notes before the team starts the reservation.";
      return;
    }

    el.assistantMsg.textContent = `Right now I would start with ${closest.propertyName} for distance, ${cheapest.propertyName} for budget, and ${safest.propertyName} for safety.`;
  }

  function syncFilterSheet() {
    el.priceRange.value = String(state.filters.maxPrice);
    el.priceVal.textContent = String(state.filters.maxPrice);
    document.querySelectorAll(".filter-option").forEach((option) => {
      const value = option.dataset.value || "";
      const group = option.closest(".filter-grid")?.dataset.group || "";
      let selected = false;
      if (group === "roomType") selected = state.filters.roomType === value;
      if (group === "distance") selected = state.filters.distance === value;
      if (group === "mustHave") selected = state.filters.mustHaves.has(value);
      option.classList.toggle("sel", selected);
    });
  }

  function rerender() {
    updateHero();
    renderRequestTracker();
    renderListings();
    renderProximity();
    renderNearby();
    renderCompareTray();
    renderCompareOverlay();
  }

  function buildSupportChecklist(payload) {
    const checklist = [];
    if (payload.fundingStatus) checklist.push(`Funding: ${payload.fundingStatus}`);
    if (payload.nsfasBeneficiary === "yes") checklist.push(`NSFAS since ${payload.nsfasSinceYear || "year not given"}`);
    if (payload.nsfasBeneficiary === "pending") checklist.push("Awaiting NSFAS outcome");
    if (payload.documentsReady) checklist.push(`Documents: ${payload.documentsReady}`);
    if (payload.transportNeeded === "yes") checklist.push("Needs transport help");
    if (payload.specialNeeds && payload.specialNeeds !== "none") checklist.push(`Need: ${payload.specialNeeds}`);
    return checklist;
  }

  function buildSupportSummary(payload) {
    const parts = [];
    if (payload.preferredMoveInDate) parts.push(`Move-in ${payload.preferredMoveInDate}`);
    if (payload.fundingStatus) parts.push(`Funding ${payload.fundingStatus}`);
    if (payload.nsfasBeneficiary === "yes") parts.push(`NSFAS since ${payload.nsfasSinceYear || "unknown year"}`);
    if (payload.nsfasBeneficiary === "pending") parts.push("NSFAS pending");
    if (payload.documentsReady) parts.push(`Docs ${payload.documentsReady}`);
    if (payload.transportNeeded === "yes") parts.push("Transport support needed");
    return parts.join(" | ");
  }

  function renderRequestListingCard(listing) {
    if (!listing || !el.requestListingCard) return;
    const meta = getMeta(listing);
    const existing = getRequestForListing(listing.id);
    const campus = extractCampusName(listing.distanceFromCampus);
    const trackerText = existing
      ? `Already in Kagie tracker - last updated ${formatDate(existing.updatedAt || existing.createdAt)}`
      : "Not yet submitted to Kagie";
    el.requestListingCard.innerHTML = `
      <div class="request-property-head">
        <div>
          <div class="request-property-name">${escapeHtml(listing.propertyName)}</div>
          <div class="request-property-sub">${escapeHtml(listing.location || listing.address || "Near campus")}${campus ? ` | Campus: ${escapeHtml(campus)}` : ""}</div>
        </div>
        <div class="price-tag">${escapeHtml(money(listing.price))} <small>/ month</small></div>
      </div>
      <div class="request-pill-row">
        <span class="request-pill">${escapeHtml(listing.roomType || "Room")}</span>
        <span class="request-pill">${escapeHtml(listing.availabilityStatus || "Available")}</span>
        <span class="request-pill">Safety ${escapeHtml(meta.safety)}/100</span>
      </div>
      <div class="field-hint">${escapeHtml(trackerText)}</div>
    `;
  }

  function populateRequestForm(listing) {
    const existing = getRequestForListing(listing.id) || {};
    const profile = state.profile || {};
    const user = state.user || {};
    const campusName = existing.campusName || profile.campusName || extractCampusName(listing.distanceFromCampus);
    const yearOfStudy = existing.yearOfStudy || profile.yearOfStudy || profile.grade || "";

    setRequestFieldValue("requestListingId", listing.id);
    setRequestFieldValue("reqLearnerName", existing.learnerName || profile.fullName || profile.fullNames || user.name || "");
    setRequestFieldValue("reqLearnerEmail", existing.learnerEmail || profile.email || user.email || "");
    setRequestFieldValue("reqLearnerPhone", existing.learnerPhone || profile.phone || profile.cellphone || user.phone || user.cellphone || "");
    setRequestFieldValue("reqAltPhone", existing.alternatePhone || profile.guardianPhoneAlt || profile.guardianCell2 || "");
    setRequestFieldValue("reqInstitutionName", existing.institutionName || profile.institutionName || listing.institutionName || "");
    setRequestFieldValue("reqCampusName", campusName);
    setRequestFieldValue("reqStudentNumber", existing.studentNumber || profile.studentNumber || "");
    setRequestFieldValue("reqYearOfStudy", yearOfStudy);
    setRequestFieldValue("reqGender", existing.gender || profile.gender || "");
    setRequestFieldValue("reqIdNumber", existing.idNumber || profile.idNumber || "");

    setRequestFieldValue("reqFundingStatus", existing.fundingStatus || "");
    setRequestFieldValue("reqNsfasBeneficiary", existing.nsfasBeneficiary || "");
    setRequestFieldValue("reqNsfasSinceYear", existing.nsfasSinceYear || "");
    setRequestFieldValue("reqNsfasReference", existing.nsfasReferenceNumber || "");
    setRequestFieldValue("reqNsfasAllowanceStatus", existing.nsfasAllowanceStatus || "");
    setRequestFieldValue("reqBursaryProvider", existing.bursaryProvider || "");

    setRequestFieldValue("reqMoveInDate", existing.preferredMoveInDate || "");
    setRequestFieldValue("reqLeaseMonths", existing.preferredLeaseMonths || "");
    setRequestFieldValue("reqRoomPreference", existing.roomPreference || listing.roomType || "");
    setRequestFieldValue("reqTransportNeeded", existing.transportNeeded || "");
    setRequestFieldValue("reqDocumentsReady", existing.documentsReady || "");

    setRequestFieldValue("reqGuardianName", existing.guardianName || profile.guardianName || profile.guardianFullNames || "");
    setRequestFieldValue("reqGuardianPhone", existing.guardianPhone || profile.guardianPhone || profile.guardianCell1 || "");
    setRequestFieldValue("reqGuardianEmail", existing.guardianEmail || profile.guardianEmail || "");
    setRequestFieldValue("reqEmergencyName", existing.emergencyContactName || profile.guardianName || "");
    setRequestFieldValue("reqEmergencyPhone", existing.emergencyContactPhone || profile.guardianPhone || profile.guardianCell1 || "");
    setRequestFieldValue("reqEmergencyRelationship", existing.emergencyRelationship || profile.guardianRelation || "");

    setRequestFieldValue("reqSpecialNeeds", existing.specialNeeds || "none");
    setRequestFieldValue("reqMedicalNotes", existing.medicalNotes || "");
    setRequestFieldValue("reqSupportNote", existing.note || "");
  }

  function setRequestStatus(message, kind) {
    if (!el.requestStatus) return;
    el.requestStatus.className = "request-status";
    el.requestStatus.textContent = "";
    if (!message) return;
    el.requestStatus.classList.add(kind === "success" ? "success" : "error");
    el.requestStatus.textContent = message;
  }

  function updateConditionalFields() {
    const nsfasState = getRequestFieldValue("reqNsfasBeneficiary");
    const fundingStatus = getRequestFieldValue("reqFundingStatus");
    const showNsfasDetails = nsfasState === "yes" || nsfasState === "pending";
    const showSponsorDetails = /bursary|sponsor|mixed/i.test(fundingStatus);

    el.nsfasDetailBlock.classList.toggle("hidden", !showNsfasDetails);
    el.sponsorDetailBlock.classList.toggle("hidden", !showSponsorDetails);
  }

  function updateRequestProgress() {
    const requiredFields = REQUEST_PROGRESS_FIELDS.slice();
    if (getRequestFieldValue("reqNsfasBeneficiary") === "yes") requiredFields.push("reqNsfasSinceYear");
    if (/bursary|sponsor|mixed/i.test(getRequestFieldValue("reqFundingStatus"))) requiredFields.push("reqBursaryProvider");

    const completed = requiredFields.filter((fieldId) => getRequestFieldValue(fieldId)).length;
    const total = requiredFields.length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    el.requestProgressText.textContent = `${completed} of ${total} key details filled`;
    el.requestProgressFill.style.width = `${percent}%`;

    const missingLabels = [];
    if (!getRequestFieldValue("reqLearnerName")) missingLabels.push("full name");
    if (!getRequestFieldValue("reqFundingStatus")) missingLabels.push("funding plan");
    if (!getRequestFieldValue("reqNsfasBeneficiary")) missingLabels.push("NSFAS status");
    if (!getRequestFieldValue("reqMoveInDate")) missingLabels.push("move-in date");
    if (!getRequestFieldValue("reqGuardianPhone")) missingLabels.push("guardian phone");

    el.requestProgressHint.textContent = missingLabels.length
      ? `Still helpful to add: ${missingLabels.slice(0, 3).join(", ")}${missingLabels.length > 3 ? "..." : ""}.`
      : "Strong brief. Kagie support now has the core contact, funding, and move-in details needed to act fast.";
  }

  const queueSearchRerender = debounceFrame(() => {
    rerender();
  }, 160);

  const queueRequestProgressRefresh = debounceFrame(() => {
    updateConditionalFields();
    updateRequestProgress();
  }, 120);

  function openRequestForm(listingId) {
    const listing = state.listings.find((item) => item.id === listingId);
    if (!listing) return;

    state.activeListingId = listingId;
    renderRequestListingCard(listing);
    populateRequestForm(listing);
    updateConditionalFields();
    updateRequestProgress();
    setRequestStatus("", "error");
    el.requestSheetSub.textContent = isRequested(listingId)
      ? "Review or update the details Kagie support already has for this stay."
      : "Share the details Kagie support needs before we reserve a room for you.";
    el.requestOverlay.classList.add("open");
  }

  function closeRequestFormInternal() {
    el.requestOverlay.classList.remove("open");
    state.activeListingId = "";
    setRequestStatus("", "error");
  }

  function buildRequestPayload(listing) {
    const payload = {
      listingId: listing.id,
      propertyName: listing.propertyName,
      institutionName: getRequestFieldValue("reqInstitutionName") || listing.institutionName || "",
      province: listing.province || "",
      location: listing.location || "",
      address: listing.address || "",
      roomType: listing.roomType || "",
      price: listing.price || 0,
      providerPhone: listing.contactPhone || "",
      images: listing.images || [],
      learnerName: getRequestFieldValue("reqLearnerName"),
      learnerEmail: getRequestFieldValue("reqLearnerEmail"),
      learnerPhone: getRequestFieldValue("reqLearnerPhone"),
      alternatePhone: getRequestFieldValue("reqAltPhone"),
      idNumber: getRequestFieldValue("reqIdNumber"),
      studentNumber: getRequestFieldValue("reqStudentNumber"),
      campusName: getRequestFieldValue("reqCampusName"),
      yearOfStudy: getRequestFieldValue("reqYearOfStudy"),
      gender: getRequestFieldValue("reqGender"),
      preferredMoveInDate: getRequestFieldValue("reqMoveInDate"),
      preferredLeaseMonths: getRequestFieldValue("reqLeaseMonths"),
      roomPreference: getRequestFieldValue("reqRoomPreference"),
      fundingStatus: getRequestFieldValue("reqFundingStatus"),
      nsfasBeneficiary: getRequestFieldValue("reqNsfasBeneficiary"),
      nsfasSinceYear: getRequestFieldValue("reqNsfasSinceYear"),
      nsfasReferenceNumber: getRequestFieldValue("reqNsfasReference"),
      nsfasAllowanceStatus: getRequestFieldValue("reqNsfasAllowanceStatus"),
      bursaryProvider: getRequestFieldValue("reqBursaryProvider"),
      guardianName: getRequestFieldValue("reqGuardianName"),
      guardianPhone: getRequestFieldValue("reqGuardianPhone"),
      guardianEmail: getRequestFieldValue("reqGuardianEmail"),
      emergencyContactName: getRequestFieldValue("reqEmergencyName"),
      emergencyContactPhone: getRequestFieldValue("reqEmergencyPhone"),
      emergencyRelationship: getRequestFieldValue("reqEmergencyRelationship"),
      documentsReady: getRequestFieldValue("reqDocumentsReady"),
      transportNeeded: getRequestFieldValue("reqTransportNeeded"),
      specialNeeds: getRequestFieldValue("reqSpecialNeeds"),
      medicalNotes: getRequestFieldValue("reqMedicalNotes"),
      note: getRequestFieldValue("reqSupportNote"),
      contactPhone: getRequestFieldValue("reqLearnerPhone"),
      status: "Support review requested"
    };
    payload.supportChecklist = buildSupportChecklist(payload);
    payload.supportSummary = buildSupportSummary(payload);
    return payload;
  }

  function validateRequestPayload(payload) {
    const errors = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const moveInDate = payload.preferredMoveInDate ? new Date(`${payload.preferredMoveInDate}T00:00:00`) : null;

    if (!payload.learnerName) errors.push("Add the learner's full name.");
    if (!payload.learnerEmail) errors.push("Add the learner's email address.");
    if (!payload.learnerPhone) errors.push("Add the learner's main phone number.");
    if (!payload.institutionName) errors.push("Add the institution name.");
    if (!payload.yearOfStudy) errors.push("Choose the learner's year of study.");
    if (!payload.fundingStatus) errors.push("Choose how accommodation will be funded.");
    if (!payload.nsfasBeneficiary) errors.push("Choose the learner's NSFAS status.");
    if (payload.nsfasBeneficiary === "yes" && !payload.nsfasSinceYear) errors.push("Say from which year the learner has been an NSFAS beneficiary.");
    if (/bursary|sponsor|mixed/i.test(payload.fundingStatus) && !payload.bursaryProvider) errors.push("Add the bursary, sponsor, or family funding detail.");
    if (!payload.preferredMoveInDate) {
      errors.push("Choose the preferred move-in date.");
    } else if (!Number.isNaN(moveInDate?.getTime()) && moveInDate < today) {
      errors.push("Choose a move-in date that is today or later.");
    }
    if (!payload.documentsReady) errors.push("Tell Kagie how ready the housing documents are.");
    if (!payload.guardianName) errors.push("Add a guardian or sponsor name.");
    if (!payload.guardianPhone) errors.push("Add a guardian or sponsor phone number.");
    if (!payload.emergencyContactName) errors.push("Add an emergency contact name.");
    if (!payload.emergencyContactPhone) errors.push("Add an emergency contact phone number.");
    return errors;
  }

  async function submitRequestForm(event) {
    event.preventDefault();
    const listing = getCurrentListing();
    if (!listing || !state.user) return;

    const payload = buildRequestPayload(listing);
    const errors = validateRequestPayload(payload);
    if (errors.length) {
      setRequestStatus(errors.slice(0, 3).join(" "), "error");
      return;
    }

    const api = window.KagieAPI;
    if (!api) return;

    el.requestSubmitBtn.disabled = true;
    el.requestCancelBtn.disabled = true;
    el.requestCloseBtn.disabled = true;
    setRequestStatus("Saving your housing brief for Kagie support...", "success");

    try {
      const result = api.submitAccommodationRequestAsync
        ? await api.submitAccommodationRequestAsync(payload, state.user.id)
        : api.submitAccommodationRequest(payload, state.user.id);

      const existingIndex = state.requests.findIndex((request) =>
        String(request.id || "") === String(result.id || "")
        || String(request.listingId || "") === String(result.listingId || "")
      );
      if (existingIndex >= 0) state.requests[existingIndex] = result;
      else state.requests.unshift(result);
      state.requests = sortRequests(state.requests);

      setRequestStatus(`${listing.propertyName} is now in Kagie's housing tracker.`, "success");
      el.assistantMsg.textContent = `${listing.propertyName} has been sent with your move-in, funding, and support details. Kagie can now follow up from a proper housing brief.`;
      rerender();

      window.setTimeout(() => {
        closeRequestFormInternal();
        el.requestTracker?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 420);
    } catch (error) {
      console.error(error);
      setRequestStatus(error?.message || "Kagie could not save that housing request right now.", "error");
    } finally {
      el.requestSubmitBtn.disabled = false;
      el.requestCancelBtn.disabled = false;
      el.requestCloseBtn.disabled = false;
    }
  }

  function toggleCompare(listingId) {
    if (state.compareIds.includes(listingId)) state.compareIds = state.compareIds.filter((id) => id !== listingId);
    else if (state.compareIds.length < 3) state.compareIds = state.compareIds.concat(listingId);
    else state.compareIds = state.compareIds.slice(1).concat(listingId);
    rerender();
  }

  function bindEvents() {
    el.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value || "";
      state.showAll = false;
      queueSearchRerender();
    });

    document.querySelectorAll(".filter-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".filter-pill").forEach((item) => item.classList.remove("active"));
        pill.classList.add("active");
        state.activePreset = pill.dataset.preset || "all";
        state.showAll = false;
        rerender();
      });
    });

    el.seeAllBtn.addEventListener("click", () => {
      state.showAll = !state.showAll;
      renderListings();
    });

    el.mapViewBtn.addEventListener("click", () => {
      document.querySelector(".proximity-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    el.listingResults.addEventListener("click", (event) => {
      const requestButton = event.target.closest("[data-request-id]");
      if (requestButton) {
        openRequestForm(requestButton.dataset.requestId || "");
        return;
      }
      const compareButton = event.target.closest("[data-compare-id]");
      if (compareButton) toggleCompare(compareButton.dataset.compareId || "");
    });

    el.nearbyListings.addEventListener("click", (event) => {
      const card = event.target.closest("[data-compare-id]");
      if (card) toggleCompare(card.dataset.compareId || "");
    });

    el.assistantSend.addEventListener("click", () => {
      renderAssistantResponse(el.assistantInput.value);
      el.assistantInput.value = "";
    });

    el.assistantInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        renderAssistantResponse(el.assistantInput.value);
        el.assistantInput.value = "";
      }
    });

    el.priceRange.addEventListener("input", (event) => {
      el.priceVal.textContent = String(event.target.value || state.filters.maxPrice);
    });

    document.querySelectorAll(".filter-option").forEach((option) => {
      option.addEventListener("click", () => {
        const groupEl = option.closest(".filter-grid");
        const group = groupEl?.dataset.group || "";
        const value = option.dataset.value || "";
        const isMulti = groupEl?.dataset.multi === "true";

        if (isMulti && group === "mustHave") {
          if (state.filters.mustHaves.has(value)) state.filters.mustHaves.delete(value);
          else state.filters.mustHaves.add(value);
        } else if (group === "roomType") {
          state.filters.roomType = value;
        } else if (group === "distance") {
          state.filters.distance = value;
        }
        syncFilterSheet();
      });
    });

    el.applyFilterBtn.addEventListener("click", () => {
      state.filters.maxPrice = Number(el.priceRange.value || 8000);
      rerender();
      window.closeFilter?.({ target: el.filterOverlay });
      if (state.filters.distance === "map") {
        document.querySelector(".proximity-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    el.compareBtn.addEventListener("click", () => {
      if (state.compareIds.length >= 2) el.compareOverlay.classList.add("open");
    });

    el.requestForm.addEventListener("submit", submitRequestForm);
    el.requestCancelBtn.addEventListener("click", closeRequestFormInternal);
    el.requestCloseBtn.addEventListener("click", closeRequestFormInternal);

    el.requestForm.addEventListener("input", () => {
      queueRequestProgressRefresh();
      if (el.requestStatus.classList.contains("error")) setRequestStatus("", "error");
    });
    el.requestForm.addEventListener("change", () => {
      updateConditionalFields();
      updateRequestProgress();
    });
  }

  function cacheElements() {
    el.heroGreeting = $("heroGreeting");
    el.heroName = $("heroName");
    el.heroAvatar = $("heroAvatar");
    el.heroSub = $("heroSub");
    el.statListings = $("statListings");
    el.statRequests = $("statRequests");
    el.statClosest = $("statClosest");
    el.searchInput = $("searchInput");
    el.requestTracker = $("requestTracker");
    el.resultsTitle = $("resultsTitle");
    el.seeAllBtn = $("seeAllBtn");
    el.listingResults = $("listingResults");
    el.mapDots = $("mapDots");
    el.proximityRows = $("proximityRows");
    el.nearbyListings = $("nearbyListings");
    el.mapViewBtn = $("mapViewBtn");
    el.assistantMsg = $("assistantMsg");
    el.assistantInput = $("assistantInput");
    el.assistantSend = $("assistantSend");
    el.compareSlots = $("compareSlots");
    el.compareBtn = $("compareBtn");
    el.compareTray = document.querySelector(".compare-tray");
    el.compareOverlay = $("compareOverlay");
    el.compareIntro = $("compareIntro");
    el.compareGrid = $("compareGrid");
    el.filterOverlay = $("filterOverlay");
    el.priceRange = $("priceRange");
    el.priceVal = $("priceVal");
    el.applyFilterBtn = $("applyFilterBtn");
    el.requestOverlay = $("requestOverlay");
    el.requestForm = $("requestForm");
    el.requestSheetSub = $("requestSheetSub");
    el.requestListingCard = $("requestListingCard");
    el.requestProgressText = $("requestProgressText");
    el.requestProgressFill = $("requestProgressFill");
    el.requestProgressHint = $("requestProgressHint");
    el.requestStatus = $("requestStatus");
    el.requestSubmitBtn = $("requestSubmitBtn");
    el.requestCancelBtn = $("requestCancelBtn");
    el.requestCloseBtn = $("requestCloseBtn");
    el.nsfasDetailBlock = $("nsfasDetailBlock");
    el.sponsorDetailBlock = $("sponsorDetailBlock");
  }

  async function init() {
    cacheElements();
    bindEvents();

    const api = window.KagieAPI;
    if (!api) return;

    try {
      if (api.restoreSession) await api.restoreSession();
    } catch (error) {
      console.warn("Accommodation session restore skipped:", error);
    }

    try {
      state.user = api.requireRole("user");
    } catch (_error) {
      window.location.href = "../login.html";
      return;
    }

    try {
      state.profile = api.getProfileAsync
        ? await api.getProfileAsync(state.user.id)
        : (api.getProfile ? (api.getProfile(state.user.id) || {}) : {});
      state.listings = api.getAccommodationListingsAsync
        ? await api.getAccommodationListingsAsync()
        : (api.getAccommodationListings ? api.getAccommodationListings() : []);
      state.requests = api.getAccommodationRequestsAsync
        ? await api.getAccommodationRequestsAsync(state.user.id)
        : (api.getAccommodationRequests ? api.getAccommodationRequests(state.user.id) : []);
      state.requests = sortRequests(state.requests);
      rerender();
      syncFilterSheet();
    } catch (error) {
      console.error(error);
      el.listingResults.innerHTML = `<div class="empty-state">Kagie could not load accommodation listings right now. Refresh the page and try again.</div>`;
    }
  }

  window.openFilter = function openFilter() {
    el.filterOverlay?.classList.add("open");
  };

  window.closeFilter = function closeFilter(event) {
    if (!el.filterOverlay) return;
    if (!event || event.target === el.filterOverlay) el.filterOverlay.classList.remove("open");
  };

  window.closeCompare = function closeCompare(event) {
    if (!el.compareOverlay) return;
    if (!event || event.target === el.compareOverlay) el.compareOverlay.classList.remove("open");
  };

  window.closeRequestForm = function closeRequestForm(event) {
    if (!el.requestOverlay) return;
    if (!event || event.target === el.requestOverlay) closeRequestFormInternal();
  };

  document.addEventListener("DOMContentLoaded", () => {
    void init();
  }, { once: true });
})();
