(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const framePalette = ["is-a", "is-b", "is-c", "is-d", "is-e"];
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin"].includes(value)) return "master_admin";
    return value || "user";
  };
  const dashboardByRole = {
    user: { href: "home.html", label: "Home" },
    assistant_admin: { href: "assistant/dashboard.html", label: "Assistant Dashboard" },
    master_admin: { href: "master-admin/dashboard.html", label: "Master Dashboard" }
  };

  const roleCopyByRole = {
    user: {
      badge: "Learner Hub",
      intro: "Past papers, memos, learner guides, and progress tracking now live in one calmer Kagie study space.",
      heroHeading: "Practice smarter, not harder",
      heroCopy: "Move through papers one step at a time, keep your revision memory, and stop repeating the same work blindly.",
      staffTitle: "",
      staffCopy: ""
    },
    assistant_admin: {
      badge: "Assistant Admin",
      intro: "Support learner revision with faster uploads, memo updates, and cleaner paper coverage.",
      heroHeading: "Assistant Upload Hub",
      heroCopy: "Upload papers, memos, and learner guides for learners while keeping the Kagie practice library organised and easy to manage.",
      staffTitle: "Assistant Upload Desk",
      staffCopy: "Upload and tidy learner-facing papers, memos, and guides for the assistant lane without mixing it with master-level oversight."
    },
    master_admin: {
      badge: "Master Admin",
      intro: "Manage the full Kagie paper library, oversee uploads, and keep every learner paper lane clean and complete.",
      heroHeading: "Master Resource Hub",
      heroCopy: "Oversee the Kagie practice library across grades, subjects, provinces, and revision resources from one stronger control space.",
      staffTitle: "Master Resource Desk",
      staffCopy: "Manage the full Kagie paper library, including uploads, memos, learner guides, and broader resource control across the platform."
    }
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function frameClass(index) {
    return framePalette[index % framePalette.length];
  }

  function formatDate(value) {
    if (!value) return "No date yet";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "No date yet";
    return parsed.toLocaleString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function averagePerformance(entries) {
    const scored = entries.filter((entry) => Number.isFinite(Number(entry?.performance)));
    if (!scored.length) return 0;
    const total = scored.reduce((sum, entry) => sum + Number(entry.performance || 0), 0);
    return Math.round(total / scored.length);
  }

  function extractGradeNumber(value) {
    const match = String(value || "").match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function buildCoverageSummary(blueprintArg) {
    const blueprint = blueprintArg || {};
    const grades = Array.isArray(blueprint.grades) ? blueprint.grades : [];
    const gradeNumbers = grades
      .map(extractGradeNumber)
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);
    const gradeLabel = gradeNumbers.length
      ? gradeNumbers[0] === gradeNumbers[gradeNumbers.length - 1]
        ? `Grade ${gradeNumbers[0]}`
        : `Grades ${gradeNumbers[0]} to ${gradeNumbers[gradeNumbers.length - 1]}`
      : "Grades ready";
    const subjects = Object.values(blueprint.subjectsByGrade || {}).flat().filter(Boolean);
    const uniqueSubjects = Array.from(new Set(subjects));
    const provinceCount = Array.isArray(blueprint.provinces) ? blueprint.provinces.length : 0;
    return {
      gradeLabel,
      subjectCount: uniqueSubjects.length,
      provinceCount
    };
  }

  function parseQuestionTopics(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((topic, index) => ({
        id: `q_${index + 1}`,
        label: `Question ${index + 1}`,
        topic,
        maxMarks: 10
      }));
  }

  function buildHistoryMap(history) {
    return new Map((history || []).map((entry) => [entry.paperId, entry]));
  }

  function getProgressForPaper(historyMap, paper) {
    return historyMap.get(paper.paperSignature) || null;
  }

  function buildDefaultProgress(paper) {
    const questions = Array.isArray(paper?.questions) ? paper.questions : [];
    return {
      paperId: paper?.paperSignature || "",
      attempts: 0,
      completedQuestions: 0,
      totalQuestions: questions.length,
      performance: null,
      note: "",
      lastPractisedAt: "",
      questionProgress: questions.map((question) => ({
        id: question.id,
        label: question.label,
        topic: question.topic,
        maxMarks: question.maxMarks,
        completed: false,
        score: null,
        note: "",
        attempts: 0,
        failedAttempts: 0,
        solvedOnAttempt: null,
        lastAttemptAt: ""
      }))
    };
  }

  function buildQuestionProgressMap(entry) {
    return new Map((entry?.questionProgress || []).map((question) => [question.id, question]));
  }

  function getPaperTypeClass(paper) {
    const label = String(paper?.paperNumberLabel || "").toLowerCase();
    if (label.includes("memo")) return "memo";
    if (label.includes("guide")) return "guide";
    return "";
  }

  function isMemoPaper(paper) {
    return /memo/i.test(String(paper?.paperNumber || paper?.paperNumberLabel || ""));
  }

  function isGuidePaper(paper) {
    return /guide/i.test(String(paper?.paperNumber || paper?.paperNumberLabel || ""));
  }

  function getPaperBaseNumber(paperNumberArg) {
    const paperNumber = String(paperNumberArg || "").trim().toLowerCase();
    if (paperNumber === "paper_1_memo") return "paper_1";
    if (paperNumber === "paper_2_memo") return "paper_2";
    return paperNumber;
  }

  function findRelatedPaperSet(activePaper, papersArg) {
    const papers = Array.isArray(papersArg) ? papersArg : [];
    const lanePapers = papers.filter((paper) =>
      paper?.grade === activePaper?.grade
      && String(paper?.year) === String(activePaper?.year)
      && paper?.province === activePaper?.province
      && paper?.subject === activePaper?.subject
      && paper?.session === activePaper?.session
    );
    const questionTabs = lanePapers
      .filter((paper) => !isMemoPaper(paper) && !isGuidePaper(paper))
      .sort((left, right) => String(left.paperNumberLabel || "").localeCompare(String(right.paperNumberLabel || "")));
    const matchingMemo = lanePapers.find((paper) =>
      isMemoPaper(paper) && getPaperBaseNumber(paper.paperNumber) === getPaperBaseNumber(activePaper?.paperNumber)
    ) || null;
    const learnerGuide = lanePapers.find((paper) => isGuidePaper(paper)) || null;
    return {
      lanePapers,
      questionTabs,
      matchingMemo,
      learnerGuide
    };
  }

  function formatAttemptCount(value) {
    const total = Math.max(0, Number(value || 0));
    return `${total} attempt${total === 1 ? "" : "s"}`;
  }

  function ordinalAttempt(value) {
    const number = Math.max(1, Number(value || 1));
    if (number % 100 >= 11 && number % 100 <= 13) return `${number}th`;
    if (number % 10 === 1) return `${number}st`;
    if (number % 10 === 2) return `${number}nd`;
    if (number % 10 === 3) return `${number}rd`;
    return `${number}th`;
  }

  function questionOutcomeBadges(question) {
    const solvedOnAttempt = Number(question?.solvedOnAttempt || 0);
    const failedAttempts = Number(question?.failedAttempts || 0);
    const score = Number.isFinite(Number(question?.score)) ? Number(question.score) : null;
    const maxMarks = Math.max(0, Number(question?.maxMarks || 0));
    const badges = [];
    if (solvedOnAttempt === 1) {
      badges.push({ label: "Solved on 1st attempt", tone: "good" });
    } else if (solvedOnAttempt > 1) {
      badges.push({ label: `Solved on ${ordinalAttempt(solvedOnAttempt)} attempt`, tone: "info" });
    }
    if (failedAttempts >= 3) {
      badges.push({ label: `Failed ${failedAttempts} times`, tone: "danger" });
    } else if (failedAttempts === 2) {
      badges.push({ label: "Failed twice", tone: "warn" });
    } else if (failedAttempts === 1) {
      badges.push({ label: "Failed once", tone: "warn" });
    }
    if (score !== null && maxMarks > 0) {
      badges.push({ label: `${score}/${maxMarks}`, tone: solvedOnAttempt ? "good" : failedAttempts ? "warn" : "info" });
    }
    if (!badges.length) {
      badges.push({ label: "Fresh question", tone: "info" });
    }
    return badges;
  }

  function summarizeTroubleQuestions(entry) {
    return (entry?.troubleQuestions || []).slice(0, 3).map((question) => {
      if (Number(question?.failedAttempts || 0) > 0) {
        return `${question.label}: ${question.failedAttempts} failed ${Number(question.failedAttempts || 0) === 1 ? "attempt" : "attempts"}`;
      }
      return `${question.label}: needs review`;
    });
  }

  function normalizeViewerQuestions(progress, paper) {
    const questionProgressMap = buildQuestionProgressMap(progress);
    return (paper?.questions || []).map((question) => {
      const saved = questionProgressMap.get(question.id) || {};
      const attempts = Math.max(0, Number(saved.attempts || 0));
      const failedAttempts = Math.max(0, Number(saved.failedAttempts || 0));
      const solvedOnAttempt = Math.max(0, Number(saved.solvedOnAttempt || 0));
      const completed = Boolean(saved.completed);
      const firstTryWin = solvedOnAttempt === 1;
      const solvedAfterRetry = solvedOnAttempt > 1;
      const unresolved = !solvedOnAttempt && (failedAttempts > 0 || (attempts > 0 && !completed));
      const fresh = attempts === 0 && failedAttempts === 0 && !completed;
      const needsFocus = failedAttempts > 0 || solvedAfterRetry || unresolved;
      return {
        ...question,
        ...saved,
        attempts,
        failedAttempts,
        solvedOnAttempt: solvedOnAttempt || null,
        completed,
        firstTryWin,
        solvedAfterRetry,
        unresolved,
        fresh,
        needsFocus
      };
    }).sort((left, right) => {
      const leftWeight = (left.failedAttempts * 10) + (left.solvedAfterRetry ? 5 : 0) + (left.unresolved ? 8 : 0);
      const rightWeight = (right.failedAttempts * 10) + (right.solvedAfterRetry ? 5 : 0) + (right.unresolved ? 8 : 0);
      if (leftWeight !== rightWeight) return rightWeight - leftWeight;
      return Number(left.id?.replace(/\D+/g, "") || 0) - Number(right.id?.replace(/\D+/g, "") || 0);
    });
  }

  function buildRevisionSnapshot(progress, paper) {
    const questions = normalizeViewerQuestions(progress, paper);
    const failedQuestions = questions.filter((question) => question.needsFocus);
    const masteredQuestions = questions.filter((question) => question.firstTryWin);
    const freshQuestions = questions.filter((question) => question.fresh);
    const retrySolvedQuestions = questions.filter((question) => question.solvedAfterRetry);
    const unresolvedQuestions = questions.filter((question) => question.unresolved);
    return {
      questions,
      focusQuestions: failedQuestions,
      failedQuestions,
      masteredQuestions,
      freshQuestions,
      retrySolvedQuestions,
      unresolvedQuestions,
      hardestQuestions: failedQuestions.slice(0, 5)
    };
  }

  function getDefaultQuestionViewMode(snapshot, progress) {
    if (snapshot.failedQuestions.length) return "failed";
    if (snapshot.freshQuestions.length) return "all";
    if (Number(progress?.attempts || 0) > 0 && snapshot.masteredQuestions.length) return "first";
    return "all";
  }

  function resolveQuestionViewMode(snapshot, progress, currentMode) {
    if (currentMode === "first" && !snapshot.masteredQuestions.length) {
      return getDefaultQuestionViewMode(snapshot, progress);
    }
    if (currentMode === "failed" && !snapshot.failedQuestions.length && snapshot.masteredQuestions.length) {
      return getDefaultQuestionViewMode(snapshot, progress);
    }
    if (!["failed", "all", "first"].includes(currentMode || "")) {
      return getDefaultQuestionViewMode(snapshot, progress);
    }
    return currentMode;
  }

  function buildQuestionGroups(snapshot, mode) {
    if (mode === "first") {
      return snapshot.masteredQuestions.length ? [{
        title: "First-attempt questions",
        subtitle: "These are the questions you got right the first time. Kagie keeps them separate so you do not waste revision time on work you already understood quickly.",
        questions: snapshot.masteredQuestions
      }] : [];
    }

    if (mode === "failed") {
      const groups = [];
      if (snapshot.failedQuestions.length) {
        groups.push({
          title: "Failed before or needed retries",
          subtitle: "These are the questions that beat you before, needed second or third attempts, or still take too much energy. This is the lane that should get your real attention.",
          questions: snapshot.failedQuestions
        });
      }
      if (snapshot.freshQuestions.length) {
        groups.push({
          title: "Still fresh",
          subtitle: "You have not tried these questions yet. Do them after the problem questions so Kagie can build memory for them too.",
          questions: snapshot.freshQuestions
        });
      }
      return groups;
    }

    const groups = [];
    if (snapshot.failedQuestions.length) {
      groups.push({
        title: "Failed before or needed retries",
        subtitle: "Questions that beat you before or needed more than one attempt.",
        questions: snapshot.failedQuestions
      });
    }
    if (snapshot.freshQuestions.length) {
      groups.push({
        title: "Still fresh",
        subtitle: "Questions with no attempt history yet.",
        questions: snapshot.freshQuestions
      });
    }
    if (snapshot.masteredQuestions.length) {
      groups.push({
        title: "First-attempt questions",
        subtitle: "You already solved these quickly before. Use them for a short confidence boost, not your main revision block.",
        questions: snapshot.masteredQuestions
      });
    }
    return groups;
  }

  function renderMemoryButtons(mode, snapshot) {
    return `
      <div class="memory-controls">
        <button class="memory-btn ${mode === "failed" ? "active" : ""}" type="button" data-question-view-mode="failed" ${snapshot.failedQuestions.length ? "" : "disabled"}>Failed before</button>
        <button class="memory-btn ${mode === "all" ? "active" : ""}" type="button" data-question-view-mode="all">Show all questions</button>
        <button class="memory-btn ${mode === "first" ? "active" : ""}" type="button" data-question-view-mode="first" ${snapshot.masteredQuestions.length ? "" : "disabled"}>First attempt</button>
      </div>
    `;
  }

  function renderMemorySummary(snapshot) {
    const hardest = snapshot.hardestQuestions.map((question) => {
      if (question.failedAttempts > 0) {
        return `${question.label}: failed ${question.failedAttempts} ${question.failedAttempts === 1 ? "time" : "times"}`;
      }
      if (question.solvedOnAttempt > 1) {
        return `${question.label}: solved on ${ordinalAttempt(question.solvedOnAttempt)} attempt`;
      }
      return `${question.label}: still needs a calm retry`;
    });

    return `
      <div class="memory-board">
        <div class="memory-copy">
          <strong>Revision memory</strong>
          <p>Kagie is separating the questions you solved on the first attempt from the ones that failed before or needed retries, so learners can revise with intention instead of repeating the same easy work again.</p>
        </div>
        <div class="memory-stats">
          <span class="memory-chip danger">${snapshot.failedQuestions.length} failed-before question${snapshot.failedQuestions.length === 1 ? "" : "s"}</span>
          <span class="memory-chip good">${snapshot.masteredQuestions.length} first-attempt question${snapshot.masteredQuestions.length === 1 ? "" : "s"}</span>
          <span class="memory-chip info">${snapshot.freshQuestions.length} still fresh</span>
          <span class="memory-chip warn">${snapshot.retrySolvedQuestions.length} solved after retries</span>
        </div>
        ${hardest.length ? `<div class="trouble-list">${hardest.map((item) => `<span class="q-badge danger">${esc(item)}</span>`).join("")}</div>` : '<div class="trouble-list"><span class="q-badge good">No pressure points yet. Kagie will build them as you practise.</span></div>'}
      </div>
    `;
  }

  function renderQuestionCard(paper, question, showSkipHint) {
    const badges = questionOutcomeBadges(question);
    const skipNote = showSkipHint
      ? '<div class="memory-note good">Already solved on the first try before. Unless you want a confidence warm-up, Kagie suggests saving energy for the harder questions.</div>'
      : question.failedAttempts > 0 || question.solvedAfterRetry || question.unresolved
        ? '<div class="memory-note danger">This question has given you trouble before. Keep it in your active revision lane until it becomes a calm first-time solve.</div>'
        : question.fresh
          ? '<div class="memory-note info">Fresh question. Once you attempt it, Kagie will start remembering whether it was easy or difficult for you.</div>'
          : "";

    return `
      <div class="question-item ${question.failedAttempts > 0 && !question.solvedOnAttempt ? "problem" : ""}">
        <div class="question-copy">
          <strong>${esc(question.label)}</strong>
          <p>${esc(question.topic)}<br>Max marks: ${esc(question.maxMarks)}</p>
          <div class="question-insights">${badges.map((badge) => `<span class="q-badge ${esc(badge.tone)}">${esc(badge.label)}</span>`).join("")}</div>
          ${skipNote}
        </div>
        <input type="checkbox" ${question.completed ? "checked" : ""} data-question-toggle="${esc(paper.paperSignature)}|${esc(question.id)}" />
        <input class="question-score" type="number" min="0" max="${esc(question.maxMarks)}" step="1" value="${question.score === null || question.score === undefined ? "" : esc(question.score)}" placeholder="Score out of ${esc(question.maxMarks)}" data-question-score="${esc(paper.paperSignature)}|${esc(question.id)}" />
        <input class="question-note" type="text" value="${esc(question.note || "")}" placeholder="Note what made this question difficult or what helped you solve it" data-question-note="${esc(paper.paperSignature)}|${esc(question.id)}" />
      </div>
    `;
  }

  function renderPaperTabs(activePaper, relatedSet) {
    const tabs = relatedSet.questionTabs || [];
    if (!tabs.length) return "";
    return `
      <div class="paper-switcher">
        ${tabs.map((paper) => `
          <button class="paper-switch-tab ${paper.paperSignature === activePaper.paperSignature ? "active" : ""}" type="button" data-open-paper="${esc(paper.paperSignature)}">
            ${esc(`${paper.sessionLabel.toUpperCase()} ${paper.year} ${paper.paperNumberLabel}`)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderResourceStrip(activePaper, relatedSet) {
    const actions = [];
    if (activePaper.fileUrl) {
      actions.push(`<a class="resource-pill" href="${esc(activePaper.fileUrl)}" target="_blank" rel="noopener">Open question paper</a>`);
      actions.push(`<a class="resource-pill" href="${esc(activePaper.fileUrl)}" target="_blank" rel="noopener" download="${esc((activePaper.fileName || activePaper.title || "kagie-paper") + ".pdf")}">Download paper</a>`);
    }
    if (relatedSet.matchingMemo?.fileUrl) {
      actions.push(`<button class="resource-pill memo" type="button" data-open-answer-question="all">View memo</button>`);
    }
    if (relatedSet.learnerGuide?.fileUrl) {
      actions.push(`<a class="resource-pill guide" href="${esc(relatedSet.learnerGuide.fileUrl)}" target="_blank" rel="noopener">Learner guide</a>`);
    }
    return actions.length ? `<div class="resource-strip">${actions.join("")}</div>` : "";
  }

  function renderAnswerPanel(questionId, memoPaper, isOpen) {
    if (!memoPaper) {
      return `
        <button class="answer-cta disabled" type="button" disabled>Memo not uploaded yet</button>
      `;
    }
    if (!isOpen) {
      return `<button class="answer-cta" type="button" data-open-answer-question="${esc(questionId)}">View Answers</button>`;
    }
    return `
      <div class="answer-panel">
        <div class="answer-panel-head">
          <strong>${esc(memoPaper.paperNumberLabel || "Memo")} ready</strong>
          <div class="action-row">
            <button class="mini red" type="button" data-hide-answer-question="${esc(questionId)}">Hide answers</button>
            <a class="mini yellow" href="${esc(memoPaper.fileUrl)}" target="_blank" rel="noopener">Open memo</a>
            <a class="mini yellow" href="${esc(memoPaper.fileUrl)}" target="_blank" rel="noopener" download="${esc((memoPaper.fileName || memoPaper.title || "kagie-memo") + ".pdf")}">Download memo</a>
          </div>
        </div>
        <p>This answer file matches ${esc(getPaperBaseNumber(memoPaper.paperNumber).replace("_", " ").toUpperCase())}. Use it after your attempt so Kagie can help you compare what you missed without leaving the study lane.</p>
        ${memoPaper.fileUrl ? `<iframe class="answer-frame" src="${esc(memoPaper.fileUrl)}#toolbar=0"></iframe>` : ""}
      </div>
    `;
  }

  function buildPromptCards(state, currentRole) {
    const prompts = [];
    const isStaff = currentRole === "assistant_admin" || currentRole === "master_admin";
    const historyMap = buildHistoryMap(state.history);

    if (!(state.grade && state.year && state.province && state.subject && state.session)) {
      prompts.push({
        title: "Follow the picker one step at a time",
        body: "Choose grade, year, province, subject, then session. Kagie keeps the journey calm so learners do not get mentally overloaded."
      });
    } else {
      const freshPaper = state.papers.find((paper) => !(getProgressForPaper(historyMap, paper)?.attempts > 0));
      const usedPaper = state.papers.find((paper) => getProgressForPaper(historyMap, paper)?.attempts > 0);
      if (freshPaper) {
        prompts.push({
          title: "Fresh paper ready",
          body: `${freshPaper.paperNumberLabel} in ${freshPaper.sessionLabel} is still fresh. Kagie will remember every question you complete so you do not lose your place later.`
        });
      } else if (usedPaper) {
        const progress = getProgressForPaper(historyMap, usedPaper);
        prompts.push({
          title: "Repeat shield is active",
          body: `You already used this paper ${progress.attempts} time${progress.attempts === 1 ? "" : "s"}. Kagie is showing it with history so you can revise on purpose instead of repeating blindly.`
        });
      }
    }

    const unfinished = state.history.find((entry) => Number(entry.completedQuestions || 0) < Number(entry.totalQuestions || 0));
    if (unfinished) {
      prompts.push({
        title: "Finish an unfinished paper first",
        body: `${unfinished.paperMeta?.title || "A paper"} still has ${Math.max(0, Number(unfinished.totalQuestions || 0) - Number(unfinished.completedQuestions || 0))} question${Math.max(0, Number(unfinished.totalQuestions || 0) - Number(unfinished.completedQuestions || 0)) === 1 ? "" : "s"} left. Finishing it will strengthen recall better than abandoning it.`
      });
    }

    const weakest = state.history
      .filter((entry) => Number.isFinite(Number(entry.performance)))
      .sort((a, b) => Number(a.performance || 0) - Number(b.performance || 0))[0];
    if (weakest) {
      prompts.push({
        title: "Your weakest paper is visible",
        body: `${weakest.paperMeta?.title || "One paper"} is sitting at ${weakest.performance}%. Kagie keeps that memory alive so you can repair the real weakness instead of guessing.`
      });
    }

    if (isStaff) {
      prompts.push({
        title: currentRole === "master_admin" ? "Master resource control is live" : "Assistant upload lane is live",
        body: currentRole === "master_admin"
          ? "Master admin can oversee the wider Kagie paper library here, including uploads, memos, learner guides, and cleaner subject coverage."
          : "Assistant admin can upload question papers, memos, and learner guides here without leaving the Kagie learner study flow."
      });
    }

    return prompts.slice(0, 4);
  }

  async function main() {
    const api = window.KagieAPI;
    if (!api) return;

    let restored = null;
    try {
      restored = api.resolveSessionUser
        ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
        : await api.restoreSession();
    } catch (error) {
      console.warn("Career practice session restore failed:", error);
    }

    const currentUser = restored || api.currentUser?.() || api.getCurrentUser?.() || null;
    const normalizedRole = normalizeRole(currentUser?.role);
    if (!currentUser || !["user", "assistant_admin", "master_admin"].includes(normalizedRole)) {
      window.location.href = "login.html";
      return;
    }

    const isStaff = normalizedRole === "assistant_admin" || normalizedRole === "master_admin";
    const roleCopy = roleCopyByRole[normalizedRole] || roleCopyByRole.user;
    const dashboardMeta = dashboardByRole[normalizedRole] || dashboardByRole.user;
    $("dashboardBtn").href = dashboardMeta.href;
    $("dashboardBtn").textContent = dashboardMeta.label;
    $("homeBtn").href = normalizedRole === "user" ? "home.html" : dashboardMeta.href;
    $("homeBtn").textContent = normalizedRole === "user" ? "Home" : "Back";
    $("staffUploadCard").hidden = !isStaff;

    const blueprint = api.getPastPaperBlueprint ? api.getPastPaperBlueprint() : (window.KagieData?.pastPaperBlueprint || {});
    const sessions = Array.isArray(blueprint.sessions) ? blueprint.sessions : [];
    const paperNumbers = blueprint.paperNumbers || {};
    const coverage = buildCoverageSummary(blueprint);

    if ($("roleBadge")) $("roleBadge").textContent = roleCopy.badge;
    if ($("topIntro")) $("topIntro").textContent = roleCopy.intro;
    if ($("heroHeading")) $("heroHeading").textContent = roleCopy.heroHeading;
    if ($("heroCopy")) $("heroCopy").textContent = roleCopy.heroCopy;
    if ($("coverageGrades")) $("coverageGrades").textContent = `${coverage.gradeLabel}`;
    if ($("coverageSubjects")) $("coverageSubjects").textContent = `${coverage.subjectCount || "All"} DBE subjects`;
    if ($("coverageProvinces")) $("coverageProvinces").textContent = `${coverage.provinceCount || "All"} provinces covered`;
    if ($("staffUploadTitle") && roleCopy.staffTitle) $("staffUploadTitle").textContent = roleCopy.staffTitle;
    if ($("staffUploadCopy") && roleCopy.staffCopy) $("staffUploadCopy").textContent = roleCopy.staffCopy;

    const state = {
      grade: "",
      year: "",
      province: "",
      subject: "",
      session: "",
      subjectSearch: "",
      questionViewMode: "failed",
      openAnswerQuestionId: "",
      activePaperId: "",
      papers: [],
      history: [],
      staffUploads: []
    };

    const stepOrder = ["grade", "year", "province", "subject", "session"];
    const stepLabels = {
      grade: "Grade",
      year: "Year",
      province: "Province",
      subject: "Subject",
      session: "Session"
    };

    function getCurrentStepKey() {
      return stepOrder.find((key) => !state[key]) || "session";
    }

    function getSelectionValue(key) {
      if (key === "session") return sessions.find((item) => item.id === state.session)?.label || "";
      return String(state[key] || "").trim();
    }

    function renderSelectionSummary() {
      const node = $("selectionSummary");
      const helper = $("selectionHelper");
      if (!node || !helper) return;

      const selectedItems = stepOrder
        .map((key) => ({ key, label: stepLabels[key], value: getSelectionValue(key) }))
        .filter((item) => item.value);

      node.innerHTML = selectedItems.length
        ? selectedItems.map((item) => `<span class="selection-pill"><strong>${esc(item.label)}</strong> ${esc(item.value)}</span>`).join("")
        : '<div class="empty" style="padding:8px 0;text-align:left;">No selection yet. Start with grade.</div>';

      if (!(state.grade && state.year && state.province && state.subject && state.session)) {
        const currentStep = getCurrentStepKey();
        helper.textContent = `Next step: ${stepLabels[currentStep]}. Kagie is only opening the next choice you need.`;
      } else {
        helper.textContent = "Your paper lane is ready. Open a paper below and Kagie will track your study memory automatically.";
      }
    }

    function renderStepState() {
      const currentStep = getCurrentStepKey();
      stepOrder.forEach((key) => {
        const wrap = $(`step${key.charAt(0).toUpperCase()}${key.slice(1)}Wrap`);
        const body = $(`step${key.charAt(0).toUpperCase()}${key.slice(1)}Body`);
        const selected = $(`step${key.charAt(0).toUpperCase()}${key.slice(1)}Selected`);
        if (!wrap || !body || !selected) return;

        const stepIndex = stepOrder.indexOf(key);
        const currentIndex = stepOrder.indexOf(currentStep);
        const hasValue = Boolean(state[key]);
        const isPast = hasValue && stepIndex < currentIndex;
        const isCurrent = stepIndex === currentIndex;
        const isFuture = stepIndex > currentIndex;
        const labelValue = getSelectionValue(key);

        wrap.hidden = isFuture;
        wrap.classList.toggle("active", isCurrent || (key === "session" && stepOrder.every((step) => state[step])));
        body.classList.toggle("collapsed", isPast);
        selected.innerHTML = hasValue
          ? `<span class="step-badge">${esc(labelValue)}</span>${isPast ? `<button class="step-link" type="button" data-change-step="${esc(key)}">Change</button>` : ""}`
          : "";
      });

      renderSelectionSummary();
    }

    function renderFrameGroup(targetId, items, activeValue, key, unlocked) {
      const node = $(targetId);
      if (!node) return;
      if (!unlocked) {
        node.innerHTML = '<div class="empty">Finish the previous step to unlock this picker.</div>';
        return;
      }
      if (!items.length) {
        node.innerHTML = '<div class="empty">Nothing is available for this step yet.</div>';
        return;
      }
      node.innerHTML = items.map((item, index) => {
        const value = typeof item === "object" ? item.value : item;
        const label = typeof item === "object" ? item.label : item;
        const note = typeof item === "object" ? item.note : "";
        return `
          <button class="frame-option ${frameClass(index)} ${String(activeValue) === String(value) ? "active" : ""}" type="button" data-filter-key="${esc(key)}" data-filter-value="${esc(value)}">
            <span>${esc(label)}</span>
            ${note ? `<small>${esc(note)}</small>` : ""}
          </button>
        `;
      }).join("");
    }

    function renderFilters() {
      const allSubjects = state.grade ? ((blueprint.subjectsByGrade || {})[state.grade] || []) : [];
      const search = String(state.subjectSearch || "").trim().toLowerCase();
      const subjects = search
        ? allSubjects.filter((subject) => String(subject || "").toLowerCase().includes(search))
        : allSubjects;
      renderFrameGroup("gradeOptions", (blueprint.grades || []).map((grade) => ({ value: grade, label: grade })), state.grade, "grade", true);
      renderFrameGroup("yearOptions", state.grade ? (blueprint.years || []).map((year) => ({ value: String(year), label: String(year) })) : [], state.year, "year", Boolean(state.grade));
      renderFrameGroup("provinceOptions", state.grade && state.year ? (blueprint.provinces || []).map((province) => ({ value: province, label: province })) : [], state.province, "province", Boolean(state.grade && state.year));
      renderFrameGroup("subjectOptions", state.grade && state.year && state.province ? subjects.map((subject) => ({ value: subject, label: subject })) : [], state.subject, "subject", Boolean(state.grade && state.year && state.province));
      renderFrameGroup("sessionOptions", state.grade && state.year && state.province && state.subject ? sessions.map((session) => ({
        value: session.id,
        label: session.label,
        note: session.description
      })) : [], state.session, "session", Boolean(state.grade && state.year && state.province && state.subject));
      renderStepState();
    }

    function renderSummary() {
      const totalPractised = state.history.length;
      const totalQuestions = state.history.reduce((sum, entry) => sum + Number(entry.completedQuestions || 0), 0);
      const repeatWarnings = state.history.filter((entry) => Number(entry.attempts || 0) > 1).length;
      $("summaryPractised").textContent = String(totalPractised);
      $("summaryQuestions").textContent = String(totalQuestions);
      $("summaryPerformance").textContent = `${averagePerformance(state.history)}%`;
      $("summaryAvoided").textContent = String(repeatWarnings);
    }

    function renderPrompts() {
      const node = $("promptList");
      if (!node) return;
      const prompts = buildPromptCards(state, normalizedRole);
      node.innerHTML = prompts.length ? prompts.map((prompt) => `
        <div class="prompt-card">
          <strong>${esc(prompt.title)}</strong>
          <p>${esc(prompt.body)}</p>
        </div>
      `).join("") : '<div class="empty">Start a paper and Kagie will begin coaching your revision path here.</div>';
    }

    function renderHistory() {
      const node = $("historyList");
      if (!node) return;
      node.innerHTML = state.history.length ? state.history.slice(0, 12).map((entry) => `
        <div class="history-card">
          <div class="paper-head">
            <div>
              <strong>${esc(entry.paperMeta?.title || "Past paper")}</strong>
              <p>${esc(entry.paperMeta?.grade || "")}${entry.paperMeta?.grade ? " | " : ""}${esc(String(entry.paperMeta?.year || ""))}${entry.paperMeta?.year ? " | " : ""}${esc(entry.paperMeta?.province || "")}${entry.paperMeta?.province ? " | " : ""}${esc(entry.paperMeta?.sessionLabel || "")}</p>
            </div>
            <span class="status-pill ${Number(entry.attempts || 0) > 1 ? "repeat" : "done"}">${esc(formatAttemptCount(entry.attempts))}</span>
          </div>
          <p>Completed questions: ${esc(entry.completedQuestions)}/${esc(entry.totalQuestions)}<br>Performance: ${Number.isFinite(Number(entry.performance)) ? `${esc(entry.performance)}%` : "Not scored yet"}<br>First-attempt wins: ${esc(entry.firstAttemptSolvedQuestions || 0)}<br>Last used: ${esc(formatDate(entry.lastPractisedAt))}</p>
          ${entry.troubleQuestionCount ? `<div class="trouble-list">${summarizeTroubleQuestions(entry).map((item) => `<span class="q-badge danger">${esc(item)}</span>`).join("")}</div>` : `<div class="trouble-list"><span class="q-badge good">No problem questions stored yet</span></div>`}
        </div>
      `).join("") : '<div class="empty">No practice history yet. Start one paper and Kagie will build your study memory here.</div>';
    }

    function renderPaperList() {
      const node = $("paperList");
      if (!node) return;

      if (!(state.grade && state.year && state.province && state.subject && state.session)) {
        $("paperStageHint").textContent = "Finish the picker above and Kagie will open the exact paper lane for that learner.";
        node.innerHTML = '<div class="empty">Choose grade, year, province, subject, and session to unlock the paper stage.</div>';
        return;
      }

      const historyMap = buildHistoryMap(state.history);
      const activeSession = sessions.find((session) => session.id === state.session);
      $("paperStageHint").textContent = `Showing ${state.papers.length} study frame${state.papers.length === 1 ? "" : "s"} for ${state.subject} in ${state.province} | ${activeSession?.label || state.session}.`;

      node.innerHTML = state.papers.length ? state.papers.map((paper, index) => {
        const progress = getProgressForPaper(historyMap, paper);
        const attempts = Number(progress?.attempts || 0);
        const performance = Number.isFinite(Number(progress?.performance)) ? `${progress.performance}%` : "No score yet";
        const completedLabel = progress ? `${progress.completedQuestions}/${progress.totalQuestions} done` : `0/${paper.questions.length} done`;
        const statusClass = !progress ? "new" : attempts > 1 ? "repeat" : "done";
        const statusText = !progress ? "Fresh paper" : attempts > 1 ? "Repeated before" : "Used before";
        const openPdfButton = paper.fileUrl ? `<a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener">View PDF</a>` : "";
        const downloadPdfButton = paper.fileUrl ? `<a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener" download="${esc((paper.fileName || paper.title || "kagie-paper") + ".pdf")}">Download</a>` : "";
        const progressLabel = progress ? `Progress ${completedLabel}` : `Progress ${completedLabel}`;
        const primaryLabel = progress ? "Continue" : "Start paper";
        const paperTypeClass = getPaperTypeClass(paper);
        const firstTrySolved = Number(progress?.firstAttemptSolvedQuestions || 0);
        const troubleCount = Number(progress?.troubleQuestionCount || 0);
        return `
          <div class="paper-card simple">
            <div class="paper-head">
              <div>
                <span class="paper-tag ${paperTypeClass}">${esc(paper.paperNumberLabel)}</span>
                <p><strong>${esc(paper.title)}</strong></p>
                <p>${esc(paper.grade)} | ${esc(String(paper.year))} | ${esc(paper.province)} | ${esc(paper.sessionLabel)}</p>
              </div>
              <span class="status-pill ${statusClass}">${esc(statusText)}</span>
            </div>
            <div class="paper-meta-row">
              <span class="paper-meta-chip">${esc(progressLabel)}</span>
              <span class="paper-meta-chip">${esc(performance)}</span>
              <span class="paper-meta-chip">${esc(formatAttemptCount(attempts))}</span>
              ${firstTrySolved ? `<span class="paper-meta-chip good">${esc(firstTrySolved)} first-try win${firstTrySolved === 1 ? "" : "s"}</span>` : ""}
              ${troubleCount ? `<span class="paper-meta-chip danger">${esc(troubleCount)} trouble question${troubleCount === 1 ? "" : "s"}</span>` : ""}
              ${paper.fileUrl ? `<span class="paper-meta-chip info">Uploaded PDF ready</span>` : ""}
            </div>
            <div class="action-row">
              <button class="mini ${frameClass(index)}" type="button" data-open-paper="${esc(paper.paperSignature)}">${esc(primaryLabel)}</button>
              <button class="mini green" type="button" data-open-paper="${esc(paper.paperSignature)}">Progress</button>
              ${openPdfButton}
              ${downloadPdfButton}
            </div>
          </div>
        `;
      }).join("") : '<div class="empty">No paper matches this exact lane yet. Staff can upload one above and Kagie will place it here.</div>';
    }

    function renderViewer() {
      const paper = state.papers.find((item) => item.paperSignature === state.activePaperId)
        || state.staffUploads.find((item) => item.paperSignature === state.activePaperId)
        || null;
      const viewerCard = $("viewerCard");
      const viewerBody = $("viewerBody");
      if (!viewerCard || !viewerBody) return;

      if (!paper) {
        viewerCard.hidden = true;
        viewerBody.innerHTML = "";
        return;
      }

      const historyMap = buildHistoryMap(state.history);
      const progress = getProgressForPaper(historyMap, paper) || buildDefaultProgress(paper);
      const snapshot = buildRevisionSnapshot(progress, paper);
      const relatedSet = findRelatedPaperSet(paper, state.papers);
      state.questionViewMode = resolveQuestionViewMode(snapshot, progress, state.questionViewMode);
      const questionGroups = buildQuestionGroups(snapshot, state.questionViewMode);
      const groupedQuestionsHtml = questionGroups.length ? questionGroups.map((group) => `
        <section class="question-section">
          <div class="question-section-head">
            <strong>${esc(group.title)}</strong>
            <p>${esc(group.subtitle)}</p>
          </div>
          <div class="question-sheet-list">
            ${group.questions.map((question, index) => `
              <article class="question-sheet ${question.failedAttempts > 0 && !question.solvedOnAttempt ? "problem" : question.firstTryWin ? "mastered" : ""}">
                <div class="sheet-head">
                  <div>
                    <span class="sheet-kicker">${esc(`${paper.sessionLabel} ${paper.year}`)}</span>
                    <h4>${esc(question.label.toUpperCase())}</h4>
                  </div>
                  <div class="question-insights">${questionOutcomeBadges(question).map((badge) => `<span class="q-badge ${esc(badge.tone)}">${esc(badge.label)}</span>`).join("")}</div>
                </div>
                <div class="sheet-paper">
                  <div class="sheet-copy">
                    <p class="sheet-topic">${esc(question.topic)}</p>
                    <p class="sheet-note-line">Marks available: ${esc(question.maxMarks)}. Kagie is storing whether you solved this on the first try or only after retries.</p>
                    ${state.questionViewMode === "first" || question.firstTryWin
                      ? '<div class="memory-note good">You already solved this on the first attempt before. Kagie is keeping it separate so you can spend more time on harder questions.</div>'
                      : question.failedAttempts > 0 || question.solvedAfterRetry || question.unresolved
                        ? '<div class="memory-note danger">This one caused pressure before. Keep using it as an active revision target until it becomes easy.</div>'
                        : question.fresh
                          ? '<div class="memory-note info">Fresh question. Once you attempt it, Kagie will remember whether it was easy or difficult for you.</div>'
                          : ""
                    }
                  </div>
                </div>
                ${renderAnswerPanel(question.id, relatedSet.matchingMemo, state.openAnswerQuestionId === question.id || (state.openAnswerQuestionId === "all" && index === 0))}
                <div class="question-controls">
                  <label class="control-check"><input type="checkbox" ${question.completed ? "checked" : ""} data-question-toggle="${esc(paper.paperSignature)}|${esc(question.id)}" /> <span>Finished</span></label>
                  <input class="question-score" type="number" min="0" max="${esc(question.maxMarks)}" step="1" value="${question.score === null || question.score === undefined ? "" : esc(question.score)}" placeholder="Score out of ${esc(question.maxMarks)}" data-question-score="${esc(paper.paperSignature)}|${esc(question.id)}" />
                  <input class="question-note" type="text" value="${esc(question.note || "")}" placeholder="Write what made this question easy or difficult" data-question-note="${esc(paper.paperSignature)}|${esc(question.id)}" />
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("") : '<div class="empty">No question matches this filter yet. Switch the view or start the paper to let Kagie build the memory.</div>';

      $("viewerTitle").textContent = paper.title;
      $("viewerSubtitle").textContent = `${paper.paperNumberLabel} | ${paper.sessionLabel} | ${paper.grade} | ${paper.province}`;
      viewerCard.hidden = false;

      viewerBody.innerHTML = `
        ${renderPaperTabs(paper, relatedSet)}
        <div class="viewer-summary">
          <strong>${esc(paper.subject)}</strong>
          <p>${esc(paper.description || paper.summary || "Kagie keeps the pace calm while storing your question-by-question memory.")}</p>
          <div class="progress-grid" style="margin-top:12px">
            <div class="progress-chip">Completed: ${esc(progress.completedQuestions)}/${esc(progress.totalQuestions)}</div>
            <div class="progress-chip">Performance: ${Number.isFinite(Number(progress.performance)) ? `${esc(progress.performance)}%` : "Not scored yet"}</div>
            <div class="progress-chip">Attempts: ${esc(progress.attempts || 0)}</div>
            <div class="progress-chip">First-attempt wins: ${esc(progress.firstAttemptSolvedQuestions || 0)}</div>
            <div class="progress-chip">Trouble questions: ${esc(progress.troubleQuestionCount || 0)}</div>
            <div class="progress-chip">${paper.fileUrl ? "Uploaded PDF available" : "Question tracker active"}</div>
          </div>
          ${progress.troubleQuestionCount ? `<div class="trouble-list" style="margin-top:12px">${summarizeTroubleQuestions(progress).map((item) => `<span class="q-badge danger">${esc(item)}</span>`).join("")}</div>` : ""}
          <div class="action-row" style="margin-top:12px">
            <button class="mini green" type="button" data-start-paper="${esc(paper.paperSignature)}">${progress.attempts ? "Practise again" : "Start practice"}</button>
            <button class="mini ${progress.completedQuestions === progress.totalQuestions && progress.totalQuestions ? "yellow" : "green"}" type="button" data-save-session="${esc(paper.paperSignature)}">${progress.completedQuestions === progress.totalQuestions && progress.totalQuestions ? "Save completed session" : "Save progress"}</button>
            ${paper.fileUrl ? `<a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener">View uploaded PDF</a>` : ""}
            ${paper.fileUrl ? `<a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener" download="${esc((paper.fileName || paper.title || "kagie-paper") + ".pdf")}">Download PDF</a>` : ""}
          </div>
        </div>
        ${renderResourceStrip(paper, relatedSet)}
        ${renderMemorySummary(snapshot)}
        ${renderMemoryButtons(state.questionViewMode, snapshot)}
        ${paper.fileUrl ? `
          <div class="paper-preview-card">
            <div class="paper-preview-head">
              <strong>${esc(`${paper.sessionLabel.toUpperCase()} ${paper.year} ${paper.paperNumberLabel.toUpperCase()}`)}</strong>
              <div class="viewer-downloads">
                <a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener">Open paper</a>
                <a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener" download="${esc((paper.fileName || paper.title || "kagie-paper") + ".pdf")}">Download</a>
              </div>
            </div>
            <iframe class="pdf-frame compact" src="${esc(paper.fileUrl)}#toolbar=0"></iframe>
          </div>
        ` : ""}
        <div class="question-stage">
          ${groupedQuestionsHtml}
        </div>
        <div class="prompt-card">
          <strong>Reflection note</strong>
          <p>Capture what you learned from this paper. Kagie uses this memory to stop weak repetition and keep study sessions more deliberate.</p>
          <textarea class="textarea" id="paperReflection">${esc(progress.note || "")}</textarea>
        </div>
      `;
    }

    function renderStaffUploadList() {
      const node = $("staffUploadList");
      if (!isStaff || !node) return;
      const uploads = state.staffUploads.filter((paper) => paper.fileName || paper.fileUrl || paper.remotePath || paper.uploadedById);
      node.innerHTML = uploads.length ? uploads.slice(0, 12).map((paper) => `
        <div class="upload-item">
          <div class="paper-head">
            <div>
              <strong>${esc(paper.title)}</strong>
              <p>${esc(paper.grade)} | ${esc(String(paper.year))} | ${esc(paper.province)} | ${esc(paper.subject)} | ${esc(paper.sessionLabel)} | ${esc(paper.paperNumberLabel)}</p>
            </div>
            <div class="action-row">
              ${paper.fileUrl ? `<a class="mini yellow" href="${esc(paper.fileUrl)}" target="_blank" rel="noopener">Open PDF</a>` : ""}
              <button class="mini red" type="button" data-remove-upload="${esc(paper.paperSignature)}">Remove</button>
            </div>
          </div>
          <p>${esc(paper.description || "Stored in Kagie's study library.")}<br>${paper.uploadedByName ? `Uploaded by ${esc(paper.uploadedByName)} | ` : ""}${esc(formatDate(paper.updatedAt || paper.createdAt))}</p>
        </div>
      `).join("") : '<div class="empty">No staff-uploaded papers, memos, or learner guides yet. Use the upload form above to add the first one.</div>';
    }

    async function refreshHistory() {
      state.history = api.getPastPaperPracticeHistory ? api.getPastPaperPracticeHistory() : [];
      renderSummary();
      renderPrompts();
      renderHistory();
      renderPaperList();
      renderViewer();
    }

    async function refreshStaffUploads() {
      if (!isStaff) return;
      try {
        state.staffUploads = api.getPastPaperCatalogAsync ? await api.getPastPaperCatalogAsync({}) : api.getPastPaperCatalog({});
      } catch (error) {
        console.warn("Could not refresh uploaded past papers:", error);
        state.staffUploads = api.getPastPaperCatalog ? api.getPastPaperCatalog({}) : [];
      }
      renderStaffUploadList();
    }

    async function refreshPaperList() {
      if (!(state.grade && state.year && state.province && state.subject && state.session)) {
        state.papers = [];
        renderPaperList();
        renderViewer();
        renderPrompts();
        return;
      }
      const filters = {
        grade: state.grade,
        year: state.year,
        province: state.province,
        subject: state.subject,
        session: state.session
      };
      try {
        state.papers = api.getPastPaperCatalogAsync ? await api.getPastPaperCatalogAsync(filters) : api.getPastPaperCatalog(filters);
      } catch (error) {
        console.warn("Could not refresh filtered papers:", error);
        state.papers = api.getPastPaperCatalog ? api.getPastPaperCatalog(filters) : [];
      }
      renderPaperList();
      renderViewer();
      renderPrompts();
    }

    function updateUploadSubjects() {
      const grade = $("uploadGrade")?.value || "";
      const subjects = (blueprint.subjectsByGrade || {})[grade] || [];
      const subjectNode = $("uploadSubject");
      if (!subjectNode) return;
      subjectNode.innerHTML = subjects.map((subject) => `<option value="${esc(subject)}">${esc(subject)}</option>`).join("");
    }

    function updateUploadPaperNumbers() {
      const sessionId = $("uploadSession")?.value || "";
      const session = sessions.find((item) => item.id === sessionId);
      const options = Array.isArray(session?.paperNumbers) ? session.paperNumbers : [];
      const node = $("uploadPaperNumber");
      if (!node) return;
      node.innerHTML = options.map((paperNumber) => `<option value="${esc(paperNumber)}">${esc(paperNumbers[paperNumber]?.label || paperNumber)}</option>`).join("");
    }

    function updateUploadTitleSuggestion() {
      const titleNode = $("uploadTitle");
      if (!titleNode || titleNode.value.trim()) return;
      const grade = $("uploadGrade")?.value || "";
      const year = $("uploadYear")?.value || "";
      const subject = $("uploadSubject")?.value || "";
      const sessionId = $("uploadSession")?.value || "";
      const paperNumber = $("uploadPaperNumber")?.value || "";
      const sessionLabel = sessions.find((item) => item.id === sessionId)?.label || sessionId;
      const paperLabel = paperNumbers[paperNumber]?.label || paperNumber;
      titleNode.value = [grade, subject, paperLabel, sessionLabel, year].filter(Boolean).join(" ");
    }

    function setUploadMessage(text, tone) {
      const node = $("uploadMsg");
      if (!node) return;
      node.textContent = text || "";
      node.className = tone ? `msg ${tone}` : "msg";
    }

    async function handleUploadSubmit(event) {
      event.preventDefault();
      const file = $("uploadFile")?.files?.[0] || null;
      try {
        await api.savePastPaperByStaffAsync({
          grade: $("uploadGrade").value,
          year: $("uploadYear").value,
          province: $("uploadProvince").value,
          subject: $("uploadSubject").value,
          session: $("uploadSession").value,
          paperNumber: $("uploadPaperNumber").value,
          title: $("uploadTitle").value,
          description: $("uploadDescription").value,
          questions: parseQuestionTopics($("uploadQuestionTopics").value),
          file
        });
        $("paperUploadForm").reset();
        updateUploadSubjects();
        updateUploadPaperNumbers();
        updateUploadTitleSuggestion();
        setUploadMessage("Past paper uploaded into Kagie's study library and is ready for learners inside the app.", "success");
        await refreshStaffUploads();
        await refreshPaperList();
      } catch (error) {
        setUploadMessage(error?.message || "Could not upload the past paper.", "error");
      }
    }

    async function handleQuestionUpdate(paperId, questionId, patch) {
      api.setPastPaperQuestionProgress(paperId, questionId, patch);
      await refreshHistory();
    }

    function scrollNodeIntoView(node) {
      if (!node || typeof node.scrollIntoView !== "function") return;
      try {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (_error) {
        node.scrollIntoView();
      }
    }

    function scrollToCurrentStep() {
      const currentStep = getCurrentStepKey();
      const currentWrap = $(`step${currentStep.charAt(0).toUpperCase()}${currentStep.slice(1)}Wrap`);
      if (currentWrap) scrollNodeIntoView(currentWrap);
    }

    function resetPicker() {
      state.grade = "";
      state.year = "";
      state.province = "";
      state.subject = "";
      state.session = "";
      state.subjectSearch = "";
      state.questionViewMode = "failed";
      state.openAnswerQuestionId = "";
      state.activePaperId = "";
      const subjectSearchNode = $("subjectSearch");
      if (subjectSearchNode) subjectSearchNode.value = "";
      renderFilters();
      refreshPaperList();
    }

    if (isStaff) {
      $("uploadGrade").innerHTML = (blueprint.grades || []).map((grade) => `<option value="${esc(grade)}">${esc(grade)}</option>`).join("");
      $("uploadYear").innerHTML = (blueprint.years || []).map((year) => `<option value="${esc(String(year))}">${esc(String(year))}</option>`).join("");
      $("uploadProvince").innerHTML = (blueprint.provinces || []).map((province) => `<option value="${esc(province)}">${esc(province)}</option>`).join("");
      $("uploadSession").innerHTML = sessions.map((session) => `<option value="${esc(session.id)}">${esc(session.label)}</option>`).join("");
      updateUploadSubjects();
      updateUploadPaperNumbers();
      updateUploadTitleSuggestion();

      ["uploadGrade", "uploadYear", "uploadProvince", "uploadSubject", "uploadSession", "uploadPaperNumber"].forEach((id) => {
        $(id)?.addEventListener("change", () => {
          if (id === "uploadGrade") updateUploadSubjects();
          if (id === "uploadSession") updateUploadPaperNumbers();
          updateUploadTitleSuggestion();
        });
      });

      $("paperUploadForm")?.addEventListener("submit", handleUploadSubmit);
      $("uploadResetBtn")?.addEventListener("click", () => {
        $("paperUploadForm").reset();
        updateUploadSubjects();
        updateUploadPaperNumbers();
        setUploadMessage("");
      });
    }

    document.addEventListener("click", async (event) => {
      const changeStep = event.target.closest("[data-change-step]")?.dataset?.changeStep;
      if (changeStep) {
        if (changeStep === "grade") {
          state.grade = "";
          state.year = "";
          state.province = "";
          state.subject = "";
          state.session = "";
        } else if (changeStep === "year") {
          state.year = "";
          state.province = "";
          state.subject = "";
          state.session = "";
        } else if (changeStep === "province") {
          state.province = "";
          state.subject = "";
          state.session = "";
        } else if (changeStep === "subject") {
          state.subject = "";
          state.session = "";
        } else if (changeStep === "session") {
          state.session = "";
        }
        state.questionViewMode = "failed";
        state.openAnswerQuestionId = "";
        state.activePaperId = "";
        renderFilters();
        await refreshPaperList();
        scrollToCurrentStep();
        return;
      }

      const filterNode = event.target.closest("[data-filter-key]");
      if (filterNode) {
        const key = filterNode.dataset.filterKey;
        const value = filterNode.dataset.filterValue || "";
        if (key === "grade") {
          state.grade = value;
          state.year = "";
          state.province = "";
          state.subject = "";
          state.session = "";
          state.subjectSearch = "";
        } else if (key === "year") {
          state.year = value;
          state.province = "";
          state.subject = "";
          state.session = "";
          state.subjectSearch = "";
        } else if (key === "province") {
          state.province = value;
          state.subject = "";
          state.session = "";
          state.subjectSearch = "";
        } else if (key === "subject") {
          state.subject = value;
          state.session = "";
        } else if (key === "session") {
          state.session = value;
        }
        state.questionViewMode = "failed";
        state.openAnswerQuestionId = "";
        state.activePaperId = "";
        renderFilters();
        await refreshPaperList();
        if (key === "session") {
          scrollNodeIntoView($("paperList"));
        } else {
          scrollToCurrentStep();
        }
        return;
      }

      const questionViewMode = event.target.closest("[data-question-view-mode]")?.dataset?.questionViewMode;
      if (questionViewMode) {
        state.questionViewMode = questionViewMode;
        renderViewer();
        scrollNodeIntoView($("viewerCard"));
        return;
      }

      const openAnswerQuestion = event.target.closest("[data-open-answer-question]")?.dataset?.openAnswerQuestion;
      if (openAnswerQuestion !== undefined) {
        state.openAnswerQuestionId = openAnswerQuestion || "all";
        renderViewer();
        scrollNodeIntoView($("viewerCard"));
        return;
      }

      const hideAnswerQuestion = event.target.closest("[data-hide-answer-question]")?.dataset?.hideAnswerQuestion;
      if (hideAnswerQuestion !== undefined) {
        state.openAnswerQuestionId = "";
        renderViewer();
        scrollNodeIntoView($("viewerCard"));
        return;
      }

      const openPaperId = event.target.closest("[data-open-paper]")?.dataset?.openPaper;
      if (openPaperId) {
        if (state.activePaperId !== openPaperId) {
          state.questionViewMode = "failed";
          state.openAnswerQuestionId = "";
        }
        state.activePaperId = openPaperId;
        renderViewer();
        scrollNodeIntoView($("viewerCard"));
        return;
      }

      const startPaperId = event.target.closest("[data-start-paper]")?.dataset?.startPaper;
      if (startPaperId) {
        api.markPastPaperPractised(startPaperId, { status: "started", incrementAttempt: true });
        state.questionViewMode = "failed";
        state.openAnswerQuestionId = "";
        state.activePaperId = startPaperId;
        await refreshHistory();
        scrollNodeIntoView($("viewerCard"));
        return;
      }

      const saveSessionId = event.target.closest("[data-save-session]")?.dataset?.saveSession;
      if (saveSessionId) {
        const activeEntry = state.history.find((entry) => entry.paperId === saveSessionId);
        const completed = Number(activeEntry?.completedQuestions || 0) > 0 && Number(activeEntry?.completedQuestions || 0) === Number(activeEntry?.totalQuestions || 0);
        api.savePastPaperPerformance(saveSessionId, {
          note: $("paperReflection")?.value || "",
          completed
        });
        await refreshHistory();
        return;
      }

      const removeUploadId = event.target.closest("[data-remove-upload]")?.dataset?.removeUpload;
      if (removeUploadId && isStaff) {
        try {
          await api.deletePastPaperByStaffAsync(removeUploadId);
          setUploadMessage("Past paper removed from Kagie's upload library.", "success");
          await refreshStaffUploads();
          await refreshPaperList();
        } catch (error) {
          setUploadMessage(error?.message || "Could not remove this past paper.", "error");
        }
      }
    });

    document.addEventListener("change", async (event) => {
      const toggleMeta = event.target?.dataset?.questionToggle;
      if (toggleMeta) {
        const [paperId, questionId] = toggleMeta.split("|");
        await handleQuestionUpdate(paperId, questionId, { completed: Boolean(event.target.checked) });
        return;
      }

      const scoreMeta = event.target?.dataset?.questionScore;
      if (scoreMeta) {
        const [paperId, questionId] = scoreMeta.split("|");
        await handleQuestionUpdate(paperId, questionId, {
          score: event.target.value,
          completed: event.target.value !== ""
        });
        return;
      }

      const noteMeta = event.target?.dataset?.questionNote;
      if (noteMeta) {
        const [paperId, questionId] = noteMeta.split("|");
        await handleQuestionUpdate(paperId, questionId, {
          note: event.target.value
        });
      }
    });

    $("resetPickerBtn")?.addEventListener("click", () => {
      resetPicker();
      scrollToCurrentStep();
    });

    $("subjectSearch")?.addEventListener("input", (event) => {
      state.subjectSearch = String(event.target.value || "");
      renderFilters();
    });

    renderFilters();
    await refreshHistory();
    await refreshStaffUploads();
    await refreshPaperList();
  }

  document.addEventListener("DOMContentLoaded", main);
})();
