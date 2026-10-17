(function () {
  "use strict";

  const GRADES = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
  const SUBJECTS = [
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
    "Information Technology"
  ];

  const state = {
    papers: [],
    grade: "",
    subject: "",
    search: "",
    loading: true,
    error: ""
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));

  const compact = (value) => String(value || "").trim();
  const lower = (value) => compact(value).toLowerCase();
  const isPublished = (paper) => lower(paper?.status) === "published";

  function getPaperTitle(paper) {
    return compact(paper.paper_title || paper.title || paper.name || "Question paper");
  }

  function getFileUrl(paper) {
    return compact(paper.file_url || paper.fileUrl || paper.public_url || paper.publicUrl || paper.download_url || paper.downloadUrl || paper.url);
  }

  function getBackend() {
    return window.KagieBackend || window.KagieAPI || window.KagieApp || null;
  }

  function getSupabaseClient() {
    const api = getBackend();
    if (api?.getSupabaseClient) return api.getSupabaseClient();
    if (api?.supabase) return api.supabase;
    if (window.KagieSupabaseClient) return window.KagieSupabaseClient;
    if (window.supabaseClient) return window.supabaseClient;
    if (window.KAGIE_SUPABASE_CLIENT) return window.KAGIE_SUPABASE_CLIENT;

    const config = window.KAGIE_SUPABASE_CONFIG || window.KagieSupabaseConfig || window.SUPABASE_CONFIG || {};
    const url = config.url || config.supabaseUrl || window.SUPABASE_URL;
    const key = config.anonKey || config.supabaseAnonKey || config.key || window.SUPABASE_ANON_KEY;
    if (window.supabase?.createClient && url && key) {
      return window.supabase.createClient(url, key);
    }
    return null;
  }

  async function loadPapersFromBackend() {
    const api = getBackend();
    const candidates = [
      "getPublishedQuestionPapersAsync",
      "getQuestionPapersAsync",
      "listQuestionPapersAsync",
      "getPastPaperCatalogAsync"
    ];
    for (const name of candidates) {
      if (typeof api?.[name] !== "function") continue;
      const rows = await api[name]({ status: "Published" });
      if (Array.isArray(rows)) return rows;
    }
    return null;
  }

  async function loadPapersFromSupabase() {
    const client = getSupabaseClient();
    if (!client?.from) return null;
    const result = await client
      .from("question_papers")
      .select("*")
      .eq("status", "Published")
      .order("year", { ascending: false })
      .order("updated_at", { ascending: false });
    if (result.error) throw new Error(result.error.message || "Could not load question papers.");
    return Array.isArray(result.data) ? result.data : [];
  }

  function normalizePaper(row) {
    return {
      id: compact(row.id || row.paper_id || `${row.grade}-${row.subject}-${row.year}-${row.title}`),
      title: getPaperTitle(row),
      grade: compact(row.grade),
      subject: compact(row.subject),
      year: compact(row.year),
      term: compact(row.term),
      province: compact(row.province),
      paperType: compact(row.paper_type || row.paperType || row.type || "Question Paper"),
      status: compact(row.status || "Published"),
      fileUrl: getFileUrl(row),
      source: row
    };
  }

  function uniquePublished(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : [])
      .map(normalizePaper)
      .filter(isPublished)
      .filter((paper) => {
        const key = [paper.grade, paper.subject, paper.year, paper.term, paper.paperType, paper.title, paper.fileUrl].map(lower).join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function ensureCareerSection() {
    let section = document.getElementById("careerQuestionPapers");
    if (section) return section;

    const main = document.querySelector(".main") || document.querySelector("main") || document.body;
    section = document.createElement("section");
    section.id = "careerQuestionPapers";
    section.className = "career-live-papers";
    section.innerHTML = `
      <div class="career-live-head">
        <div>
          <div class="sec-label">Published DBE library</div>
          <h2>Question papers</h2>
          <p>Filter Grade 8 to Grade 12 papers uploaded by Kagie staff.</p>
        </div>
        <button class="btn-search career-live-refresh" type="button" id="careerPaperRefresh">Refresh</button>
      </div>
      <div class="career-live-filters">
        <label>
          <span>Grade</span>
          <select id="careerPaperGrade">
            <option value="">All grades</option>
            ${GRADES.map((grade) => `<option value="${esc(grade)}">${esc(grade)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select id="careerPaperSubject">
            <option value="">All subjects</option>
            ${SUBJECTS.map((subject) => `<option value="${esc(subject)}">${esc(subject)}</option>`).join("")}
          </select>
        </label>
        <label class="career-live-search">
          <span>Search</span>
          <input id="careerPaperSearchLive" type="search" placeholder="Search title, province, year..." />
        </label>
      </div>
      <div class="career-live-status" id="careerPaperStatus" aria-live="polite">Loading published papers...</div>
      <div class="career-live-grid" id="careerPaperGrid"></div>
    `;

    const results = document.getElementById("results-section");
    if (results?.parentNode) {
      results.parentNode.insertBefore(section, results);
    } else {
      main.appendChild(section);
    }
    return section;
  }

  function injectStyles() {
    if (document.getElementById("careerQuestionPapersStyle")) return;
    const style = document.createElement("style");
    style.id = "careerQuestionPapersStyle";
    style.textContent = `
      .career-live-papers{background:var(--k-surface,#fff);border:1px solid var(--k-border,#e4e8e3);border-radius:var(--r,12px);padding:16px;display:flex;flex-direction:column;gap:14px}
      .career-live-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .career-live-head h2{font-size:20px;line-height:1.15;color:var(--k-text,#1a1f18);margin:0 0 4px}
      .career-live-head p{font-size:13px;color:var(--k-muted,#6b7569);margin:0}
      .career-live-refresh{width:auto;margin:0;white-space:nowrap;padding:10px 14px;background:var(--k-green,#fd0505)}
      .career-live-refresh:hover{background:var(--k-green-mid,#fd0505)}
      .career-live-filters{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .career-live-filters label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:600;color:var(--k-muted,#6b7569);text-transform:uppercase;letter-spacing:.45px}
      .career-live-filters select,.career-live-filters input{width:100%;padding:10px 12px;border:1px solid var(--k-border,#c9e6fd);border-radius:8px;font:inherit;font-size:14px;color:var(--k-text,#10233d);background:var(--k-bg,#f5f8fc);outline:none}
      .career-live-filters select:focus,.career-live-filters input:focus{border-color:var(--k-green,#fd0505);background:#fff}
      .career-live-search{grid-column:1/-1}
      .career-live-status{font-size:12px;color:var(--k-muted,#6b7569)}
      .career-live-status.err{color:var(--k-red,#fd0505)}
      .career-live-grid{display:flex;flex-direction:column;gap:8px}
      .career-paper-card{border:1px solid var(--k-border,#e4e8e3);border-radius:var(--r,12px);padding:13px;background:var(--k-bg,#f7f8f6);display:flex;gap:12px;align-items:flex-start}
      .career-paper-mark{width:38px;height:38px;border-radius:10px;background:var(--k-green-light,#fff5f5);color:var(--k-green,#fd0505);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}
      .career-paper-body{flex:1;min-width:0}
      .career-paper-title{font-weight:700;color:var(--k-text,#1a1f18);font-size:14px}
      .career-paper-meta{color:var(--k-muted,#6b7569);font-size:12px;margin-top:3px}
      .career-paper-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
      .career-paper-tag{font-size:10px;font-weight:700;border-radius:999px;padding:3px 7px;background:var(--k-amber-light,#fff4d9);color:#8a5700}
      .career-paper-actions{display:flex;align-items:center;gap:7px;flex-shrink:0}
      .career-paper-download{border:0;border-radius:8px;background:var(--k-green,#fd0505);color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:9px 11px}
      .career-paper-download.disabled{background:var(--k-border,#e4e8e3);color:var(--k-muted,#6b7569);pointer-events:none}
      @media(max-width:560px){
        .career-live-head{flex-direction:column}
        .career-live-refresh{width:100%}
        .career-live-filters{grid-template-columns:1fr}
        .career-paper-card{flex-direction:column}
        .career-paper-actions,.career-paper-download{width:100%;justify-content:center;text-align:center}
      }
    `;
    document.head.appendChild(style);
  }

  function filteredPapers() {
    const needle = lower(state.search);
    return state.papers.filter((paper) => {
      if (state.grade && paper.grade !== state.grade) return false;
      if (state.subject && paper.subject !== state.subject) return false;
      if (needle) {
        const haystack = [paper.title, paper.grade, paper.subject, paper.year, paper.term, paper.province, paper.paperType].map(lower).join(" ");
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }

  function render() {
    const section = ensureCareerSection();
    const status = section.querySelector("#careerPaperStatus");
    const grid = section.querySelector("#careerPaperGrid");
    const rows = filteredPapers();

    status.classList.toggle("err", Boolean(state.error));
    if (state.loading) {
      status.textContent = "Loading published papers...";
      grid.innerHTML = "";
      return;
    }
    if (state.error) {
      status.textContent = state.error;
      grid.innerHTML = "";
      return;
    }
    status.textContent = rows.length
      ? `Showing ${rows.length} published paper${rows.length === 1 ? "" : "s"}.`
      : "No published papers match these filters yet.";
    grid.innerHTML = rows.map((paper) => {
      const url = paper.fileUrl;
      return `
        <article class="career-paper-card">
          <div class="career-paper-mark">${esc(String(paper.grade || "G").replace("Grade ", "G"))}</div>
          <div class="career-paper-body">
            <div class="career-paper-title">${esc(paper.title)}</div>
            <div class="career-paper-meta">${esc([paper.subject, paper.year, paper.term, paper.province].filter(Boolean).join(" | "))}</div>
            <div class="career-paper-tags">
              <span class="career-paper-tag">${esc(paper.paperType)}</span>
              <span class="career-paper-tag">Published</span>
            </div>
          </div>
          <div class="career-paper-actions">
            <a class="career-paper-download ${url ? "" : "disabled"}" href="${esc(url || "#")}" target="_blank" rel="noopener" ${url ? "download" : ""}>Download PDF</a>
          </div>
        </article>
      `;
    }).join("");
  }

  async function refresh() {
    state.loading = true;
    state.error = "";
    render();
    try {
      const rows = await loadPapersFromBackend() || await loadPapersFromSupabase() || [];
      state.papers = uniquePublished(rows);
      state.error = "";
    } catch (error) {
      state.papers = [];
      state.error = error?.message || "Could not load published question papers.";
    } finally {
      state.loading = false;
      render();
    }
  }

  function bind() {
    const section = ensureCareerSection();
    const grade = section.querySelector("#careerPaperGrade");
    const subject = section.querySelector("#careerPaperSubject");
    const search = section.querySelector("#careerPaperSearchLive");
    const refreshBtn = section.querySelector("#careerPaperRefresh");

    grade.addEventListener("change", () => {
      state.grade = grade.value;
      render();
    });
    subject.addEventListener("change", () => {
      state.subject = subject.value;
      render();
    });
    search.addEventListener("input", () => {
      state.search = search.value;
      render();
    });
    refreshBtn.addEventListener("click", refresh);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    bind();
    refresh();
  });
})();
