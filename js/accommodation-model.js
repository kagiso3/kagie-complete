(function (root) {
  "use strict";

  const defaults = Object.freeze({
    query: "",
    mode: "rent",
    maxPrice: 8000,
    distance: "any",
    room: "any",
    features: []
  });
  const features = [{
    id: "nsfas",
    label: "NSFAS-friendly",
    icon: "shield",
    color: "green",
    pattern: /nsfas[- ](?:friendly|accredited|approved)\b/i
  }, {
    id: "wifi",
    label: "WiFi",
    icon: "wifi",
    color: "blue",
    pattern: /wi[- ]?fi|internet/i
  }, {
    id: "female",
    label: "Female-only",
    icon: "shield",
    color: "pink",
    pattern: /female[- ]only|women[- ]only/i
  }, {
    id: "security",
    label: "24/7 Security",
    icon: "shield",
    color: "green",
    pattern: /24(?:\s*\/\s*7|[- ]hour).*secur/i
  }, {
    id: "parking",
    label: "Parking",
    icon: "car",
    color: "gray",
    pattern: /parking/i
  }, {
    id: "furnished",
    label: "Furnished",
    icon: "bed",
    color: "gray",
    pattern: /\bfurnished\b/i
  }, {
    id: "kitchen",
    label: "Kitchen",
    icon: "kitchen",
    color: "gray",
    pattern: /kitchen/i
  }, {
    id: "laundry",
    label: "Laundry",
    icon: "laundry",
    color: "gray",
    pattern: /laundry/i
  }, {
    id: "study",
    label: "Study area",
    icon: "study",
    color: "gray",
    pattern: /study (?:area|zone|lounge|space)/i
  }];
  function safeUrl(value, images = false) {
    const text = String(value || "").trim();
    if (images && /^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/i.test(text)) return text;
    try {
      const url = new URL(text, "https://kagie.invalid/");
      return text && /^https?:$/.test(url.protocol) ? text : "";
    } catch {
      return "";
    }
  }
  function distance(value) {
    const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*(km|kilomet(?:er|re)s?|m|met(?:er|re)s?)\b/i);
    return match ? Number(match[1]) / (/^(m|met)/i.test(match[2]) ? 1000 : 1) : Infinity;
  }
  function hasFeature(item, id) {
    const feature = features.find(feature => feature.id === id);
    if (!feature) return false;
    // Labels come from recorded amenities, never inferred from price or distance.
    return (Array.isArray(item.amenities) ? item.amenities : []).some(text => !/\b(?:no|not|without|excluded|unfurnished)\b/i.test(text) && feature.pattern.test(text));
  }
  function normalize(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(item => {
      if (!item?.id || seen.has(String(item.id)) || item.isActive === false || item.listingState === "archived") return false;
      seen.add(String(item.id));
      return true;
    }).map(item => ({
      ...item,
      id: String(item.id),
      propertyName: String(item.propertyName || "Student accommodation"),
      price: Number.isFinite(Number(item.price)) ? Math.max(0, Number(item.price)) : 0,
      images: (Array.isArray(item.images) ? item.images : []).map(value => safeUrl(value, true)).filter(Boolean),
      amenities: (Array.isArray(item.amenities) ? item.amenities : []).map(String),
      distanceKm: distance(item.distanceFromCampus),
      searchText: [item.propertyName, item.institutionName, item.province, item.city, item.location, item.address, item.description, item.roomType].join(" ").toLowerCase()
    }));
  }
  function filters(input = {}) {
    return {
      query: String(input.query || "").trim().slice(0, 160),
      mode: ["rent", "buy", "short"].includes(input.mode) ? input.mode : "rent",
      maxPrice: Number.isFinite(Number(input.maxPrice)) ? Math.min(8000, Math.max(0, Number(input.maxPrice))) : 8000,
      distance: ["1", "2", "5"].includes(String(input.distance)) ? String(input.distance) : "any",
      room: ["single", "shared", "studio"].includes(input.room) ? input.room : "any",
      features: [...new Set((Array.isArray(input.features) ? input.features : []).filter(id => features.some(feature => feature.id === id)))]
    };
  }
  function matches(item, input) {
    const f = filters(input);
    return (item.accommodationMode || "rent") === f.mode && (!f.query || item.searchText.includes(f.query.toLowerCase())) && (f.maxPrice === 8000 || item.price > 0 && !item.priceRange && item.price <= f.maxPrice) && (f.distance === "any" || item.distanceKm <= Number(f.distance)) && (f.room === "any" || String(item.roomType || "").toLowerCase().includes(f.room)) && f.features.every(id => hasFeature(item, id));
  }
  function dateValid(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function validate(payload) {
    const errors = [];
    for (const [name, label] of [["learnerName", "full name"], ["institutionName", "institution"], ["fundingStatus", "funding plan"], ["documentsReady", "document readiness"]]) if (!String(payload[name] || "").trim()) errors.push(`Add your ${label}.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.learnerEmail || "")) errors.push("Enter a valid email address.");
    if (!/^\+?[\d ()-]{9,20}$/.test(payload.learnerPhone || "")) errors.push("Enter a valid phone number.");
    if (!dateValid(payload.preferredMoveInDate) || payload.preferredMoveInDate < today()) errors.push("Choose a move-in date that is today or later.");
    if (payload.nsfasBeneficiary === "yes" && !/^\d{4}$/.test(payload.nsfasSinceYear || "")) errors.push("Add the year your NSFAS funding started.");
    return errors;
  }
  const model = {
    defaults,
    features,
    safeUrl,
    distance,
    hasFeature,
    normalize,
    filters,
    matches,
    dateValid,
    today,
    validate
  };
  if (typeof module !== "undefined" && module.exports) module.exports = model;else root.KagieHousingModel = model;
})(typeof window !== "undefined" ? window : globalThis);
