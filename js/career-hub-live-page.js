(function () {
  "use strict";

  const api = window.KagieAPI;
  if (!api) return;

  const originalShowResults = typeof window.showResults === "function" ? window.showResults : null;

  const state = {
    papers: [],
    results: [],
    selectedIndex: 0
  };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const gradeSelect = $("gradeSelect");
  const yearSelect = $("yearSelect");
  const provinceSelect = $("provinceSelect");
  const subjectSelect = $("subjectSelect");
  const paperSelect = $("paperSelect");
  const resultsSection = $("results-section");
  const resultsList = $("resultsList");
  const workspace = $("workspace");
  const workspaceTitle = $("workspaceTitle");
  const workspaceSub = $("workspaceSub");

  function groupKey(record) {
    return [
      record.grade,
      record.subject,
      String(record.year),
      record.province,
      record.term,
      record.title
    ].join("|");
  }

  function statusBadge(record) {
    if (record.paperType === "Memo") return { label: "Memo ready", className: "badge-done" };
    if (record.paperType === "Study Guide") return { label: "Guide ready", className: "badge-new" };
    return { label: "Published", className: "badge-done" };
  }

  function getPublishedQuestionPapers() {
    return state.papers.filter((record) => record.status === "Published" && record.paperType === "Question Paper");
  }

  function filterRecords() {
    const grade = String(gradeSelect?.value || "").trim();
    const year = String(yearSelect?.value || "").trim();
    const province = String(provinceSelect?.value || "").trim();
    const subject = String(subjectSelect?.value || "").trim();
    const selectedGroup = String(paperSelect?.value || "").trim();
    return getPublishedQuestionPapers().filter((record) => {
      if (grade && record.grade !== grade) return false;
      if (year && String(record.year) !== year) return false;
      if (province && record.province !== province) return false;
      if (subject && record.subject !== subject) return false;
      if (selectedGroup && groupKey(record) !== selectedGroup) return false;
      return true;
    });
  }

  function relatedBundle(record) {
    const key = groupKey(record);
    const related = state.papers.filter((item) => groupKey(item) === key);
    return {
      paper: related.find((item) => item.paperType === "Question Paper") || record,
      memo: related.find((item) => item.paperType === "Memo") || null,
      guide: related.find((item) => item.paperType === "Study Guide") || null
    };
  }

  function wireActionButton(node, url, label, fallbackLabel) {
    if (!node) return;
    node.disabled = !url;
    node.classList.toggle("is-disabled", !url);
    node.title = url ? label : fallbackLabel;
    node.onclick = url ? () => window.open(url, "_blank", "noopener") : null;
  }

  function renderPaperOptions() {
    if (!paperSelect) return;
    const grade = String(gradeSelect?.value || "").trim();
    const year = String(yearSelect?.value || "").trim();
    const province = String(provinceSelect?.value || "").trim();
    const subject = String(subjectSelect?.value || "").trim();
    const options = getPublishedQuestionPapers().filter((record) => {
      if (grade && record.grade !== grade) return false;
      if (year && String(record.year) !== year) return false;
      if (province && record.province !== province) return false;
      if (subject && record.subject !== subject) return false;
      return true;
    });

    const groups = [];
    const seen = new Set();
    options.forEach((record) => {
      const key = groupKey(record);
      if (seen.has(key)) return;
      seen.add(key);
      groups.push({
        value: key,
        label: `${record.title} • ${record.term} • ${record.year}`
      });
    });

    paperSelect.innerHTML = groups.length
      ? groups.map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("")
      : `<option value="">No published paper matches this lane</option>`;
  }

  function renderResults() {
    if (!resultsList) return;
    resultsList.innerHTML = state.results.map((item, index) => {
      const bundle = relatedBundle(item);
      const badges = [
        statusBadge(item),
        bundle.memo ? { label: "Memo ready", className: "badge-done" } : null,
        bundle.guide ? { label: "Guide ready", className: "badge-new" } : null
      ].filter(Boolean);
      return `
        <div class="paper-row ${index === state.selectedIndex ? "selected" : ""}" onclick="selectPaperByIndex(${index})">
          <div class="paper-icon">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/></svg>
          </div>
          <div class="paper-meta">
            <div class="paper-title">${esc(item.title)}</div>
            <div class="paper-sub">${esc(`${item.grade} - ${item.province} - ${item.term} ${item.year}`)}</div>
            <div class="paper-badges">${badges.map((badge) => `<span class="badge ${esc(badge.className)}">${esc(badge.label)}</span>`).join("")}</div>
          </div>
          <div class="paper-score"><div class="score-n">${bundle.memo ? "Memo" : "PDF"}</div><div class="score-l">${bundle.guide ? "guide ready" : "published"}</div></div>
        </div>
      `;
    }).join("");
  }

  function applyWorkspace(record) {
    const bundle = relatedBundle(record);
    if (workspaceTitle) workspaceTitle.textContent = `${record.title} - ${record.year}`;
    if (workspaceSub) workspaceSub.textContent = `${record.province} - ${record.grade} - ${record.term}`;
    wireActionButton($("careerPaperOpenBtn"), bundle.paper?.fileUrl, "Open question paper", "Question paper PDF not uploaded yet");
    wireActionButton($("careerMemoOpenBtn"), bundle.memo?.fileUrl, "Open memo", "Memo not uploaded yet");
    wireActionButton($("careerGuideOpenBtn"), bundle.guide?.fileUrl, "Open study guide", "Study guide not uploaded yet");
    const topicsBtn = $("careerTopicsBtn");
    if (topicsBtn) {
      topicsBtn.disabled = false;
      topicsBtn.onclick = function () {
        const lines = [
          `${record.subject} • ${record.grade}`,
          `${record.term} ${record.year} • ${record.province}`,
          bundle.memo ? "Memo uploaded" : "Memo not uploaded yet",
          bundle.guide ? "Study guide uploaded" : "Study guide not uploaded yet"
        ];
        window.alert(lines.join("\n"));
      };
    }
  }

  function selectPaper(index) {
    const record = state.results[index];
    if (!record) return;
    state.selectedIndex = index;
    renderResults();
    applyWorkspace(record);
    if (workspace) {
      workspace.style.display = "block";
      workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (typeof window.buildQGrid === "function") window.buildQGrid();
  }

  async function showLiveResults() {
    renderPaperOptions();
    state.results = filterRecords();
    state.selectedIndex = 0;
    if (!state.results.length) {
      if (!state.papers.length && originalShowResults) {
        originalShowResults();
        return;
      }
      if (resultsSection) resultsSection.style.display = "block";
      if (resultsList) {
        resultsList.innerHTML = `<div class="paper-row" style="cursor:default"><div class="paper-meta"><div class="paper-title">No published question paper found</div><div class="paper-sub">The Master Admin has not published a matching paper for this grade, subject, year, and province yet.</div></div></div>`;
      }
      if (workspace) workspace.style.display = "none";
      return;
    }
    renderResults();
    if (resultsSection) {
      resultsSection.style.display = "block";
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    selectPaper(0);
  }

  async function loadPublishedPapers() {
    try {
      const records = api.getQuestionPapersAsync
        ? await api.getQuestionPapersAsync()
        : [];
      state.papers = Array.isArray(records) ? records : [];
    } catch (error) {
      console.warn("Career Hub live question paper load failed, keeping inline fallback.", error);
      state.papers = [];
    }
  }

  async function main() {
    await loadPublishedPapers();
    if (!state.papers.length) return;
    window.showResults = showLiveResults;
    window.selectPaperByIndex = selectPaper;
    [gradeSelect, yearSelect, provinceSelect, subjectSelect].forEach((node) => node?.addEventListener("change", renderPaperOptions));
    renderPaperOptions();
    await showLiveResults();
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((error) => console.warn("Career Hub live data binding skipped.", error));
  });
})();
