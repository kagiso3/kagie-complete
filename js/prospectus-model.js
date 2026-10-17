(function (root) {
  "use strict";

  const text = value => String(value ?? "").trim();
  const array = value => Array.isArray(value) ? value : [];
  const key = value => text(value).toLowerCase();
  const types = ["all", "University", "University of Technology", "TVET"];
  function safeUrl(value, kind = "link", base = "https://kagie.invalid/") {
    const raw = text(value);
    if (!raw) return "";
    if (kind === "pdf" && /^data:application\/pdf;base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
    try {
      const url = new URL(raw, base);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  function institutions(records) {
    const seen = new Set();
    return array(records).filter(item => item && typeof item === "object").map((item, index) => {
      const faculties = array(item.faculties).filter(faculty => faculty && text(faculty.name)).map(faculty => ({
        name: text(faculty.name),
        summary: text(faculty.summary),
        courses: array(faculty.courses).map(text).filter(Boolean)
      }));
      const fee = Number(item.applicationFee);
      const institution = {
        ...item,
        id: text(item.id) || `institution_${index + 1}`,
        name: text(item.name || item.institution),
        shortName: text(item.shortName),
        type: text(item.type),
        province: text(item.province),
        faculties,
        applicationFee: item.applicationFee == null || item.applicationFee === "" || !Number.isFinite(fee) || fee < 0 ? null : fee,
        applicationFeeLabel: text(item.applicationFeeLabel),
        applicationFeeNote: text(item.applicationFeeNote),
        applicationDeadline: text(item.closingDate || item.applicationDeadline),
        openingDate: text(item.openingDate),
        description: text(item.description || item.studyOverview),
        website: text(item.website),
        logo: text(item.logo)
      };
      institution.searchText = key([institution.name, institution.shortName, institution.type, institution.province, ...faculties.flatMap(faculty => [faculty.name, ...faculty.courses])].join(" "));
      return institution;
    }).filter(item => {
      if (!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, "en-ZA", {
      sensitivity: "base"
    }));
  }
  const documentKey = doc => text(doc?.remotePath || doc?.id);
  function groupDocuments(records) {
    const groups = new Map(),
      seen = new Set();
    for (const doc of array(records)) {
      if (!doc || !text(doc.institutionId) || !documentKey(doc) || seen.has(documentKey(doc))) continue;
      seen.add(documentKey(doc));
      const id = text(doc.institutionId);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push({
        ...doc,
        key: documentKey(doc)
      });
    }
    const time = doc => Date.parse(doc.updatedAt || doc.createdAt) || 0;
    for (const docs of groups.values()) docs.sort((a, b) => time(b) - time(a));
    return groups;
  }
  function filters(params) {
    return {
      q: text(params.get("q")).slice(0, 200),
      type: types.includes(params.get("type")) ? params.get("type") : "all",
      province: text(params.get("province")),
      pdf: ["with", "without"].includes(params.get("pdf")) ? params.get("pdf") : "all",
      sort: params.get("sort") === "za" ? "za" : "az"
    };
  }
  function filter(records, groups, state) {
    const words = key(state.q).split(/\s+/).filter(Boolean);
    const result = records.filter(item => (!state.type || state.type === "all" || item.type === state.type) && (!state.province || item.province === state.province) && words.every(word => item.searchText.includes(word)) && (!state.pdf || state.pdf === "all" || (state.pdf === "with" ? groups.has(item.id) : !groups.has(item.id))));
    return state.sort === "za" ? result.slice().reverse() : result;
  }
  function feeLabel(item) {
    if (item.applicationFeeLabel) return item.applicationFeeLabel.replace(/^Institution fee:\s*/i, "");
    if (item.applicationFee === null) return "Check with institution";
    return item.applicationFee > 0 ? `R${item.applicationFee.toLocaleString("en-ZA")}` : "Free";
  }
  function guide(item) {
    return ["Kagie Student Guide", "", `Institution: ${item.name}`, `Type: ${item.type}`, `Province: ${item.province}`, `Application fee: ${feeLabel(item)}`, `Application deadline: ${item.applicationDeadline || "Check with institution"}`, item.applicationFeeNote, "", "Study areas and programmes:", ...item.faculties.map(faculty => `${faculty.name}\n${faculty.courses.map(course => `- ${course}`).join("\n")}`), "", "Use this Kagie guide to plan your shortlist. Confirm current programmes, requirements, fees and dates with the institution."].filter(line => line !== undefined && line !== null).join("\n");
  }
  const model = {
    institutions,
    groupDocuments,
    documentKey,
    filter,
    filters,
    feeLabel,
    guide,
    safeUrl,
    types
  };
  if (typeof module !== "undefined" && module.exports) module.exports = model;else root.KagieProspectusModel = model;
})(typeof window !== "undefined" ? window : globalThis);
