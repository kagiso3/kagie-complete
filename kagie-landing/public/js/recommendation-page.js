(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const data = window.KagieRecommendationData;
  const model = window.KagieRecommendationModel;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
  const titles = {
    home: 'Course Recommendations',
    marks: 'My Marks',
    interests: 'Preferred Fields',
    courses: 'Recommended Courses',
    course: 'Course Details',
    saved: 'Saved Courses',
    analytics: 'Performance Analytics',
    compare: 'Compare Institutions',
    institutions: 'Matched Institutions'
  };
  const paths = {
    back: 'm14 5-7 7 7 7',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6',
    chevron: 'm9 5 7 7-7 7',
    check: 'm5 12 4 4L19 6',
    plus: 'M12 5v14M5 12h14',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    bookmark: 'M6 3h12v18l-6-4-6 4V3z',
    heart: 'M20 4c-3-2-6 0-8 3-2-3-5-5-8-3-6 4 0 10 8 16 8-6 14-12 8-16z',
    share: 'M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
    info: 'M12 10v7m0-11h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    bell: 'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M9 21h6',
    bulb: 'M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0l-1 4H9l-1-4z',
    compare: 'm9 3-4 4 4 4M5 7h14M15 13l4 4-4 4M19 17H5',
    chart: 'M4 20V10h3v10M11 20V5h3v15M18 20V2h3v18',
    laptop: 'M4 3h16v13H4zM2 20h20l-2-4H4l-2 4z',
    flask: 'M9 3h6M10 3v7l-6 10h16l-6-10V3M7 15h10',
    play: 'M9 7l8 5-8 5V7zM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    gear: 'm9 2-1 4-3 2-4-1-1 6 4 2 1 3-1 4 6 1 2-4 3-1 4 1 1-6-4-2-1-3 1-4-6-1-2 4-3 1-4-1-1 6 4 2 1 3m11-4a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    balance: 'M12 3v18M7 21h10M3 6h18M6 6l-4 9h8L6 6zm12 0-4 9h8l-4-9z',
    school: 'm2 8 10-5 10 5-10 5L2 8zm4 3v6l6 4 6-4v-6M22 8v8',
    building: 'M3 21h18M5 21V9h14v12M3 9l9-6 9 6M8 12v5m4-5v5m4-5v5',
    home: 'm3 10 9-7 9 7v10h-6v-7H9v7H3z',
    business_center: 'M3 7h18v13H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    apartment: 'M5 21V3h14v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3',
    directions_bus: 'M5 16V5c0-2 14-2 14 0v11M5 10h14M5 16h14M7 16v4m10-4v4M8 13h.01M16 13h.01'
  };
  const icons = new Map(Object.entries(paths).map(([name, path]) => [name, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="${path}"/>
      </svg>`]));
  const icon = name => icons.get(name) || icons.get('school');
  const fieldIcons = {
    Technology: 'laptop',
    Business: 'chart',
    Health: 'heart',
    Education: 'school',
    Law: 'balance',
    Science: 'flask',
    Engineering: 'gear',
    Media: 'play'
  };
  const courseById = new Map(data.courses.map(course => [course.id, course]));
  let api,
    user,
    profile = {},
    storageKey,
    toastTimer;
  let subjects = [],
    interests = [],
    saved = new Map(),
    comparison = [],
    results = [],
    ranked = new Map(),
    profileDirty = false;
  let ready = false,
    searchOpen = false,
    favoritesRevision = 0,
    route = readRoute(),
    lastHash = location.hash;
  const locks = new Set();
  function readRoute(hash = location.hash) {
    const [path, query = ''] = hash.replace(/^#/, '').split('?');
    const [view, rawId = ''] = path.split('/');
    const params = new URLSearchParams(query);
    let id = '';
    try {
      id = decodeURIComponent(rawId);
    } catch {/* Unknown course fallback. */}
    return {
      view: Object.hasOwn(titles, view) ? view : 'home',
      id,
      filter: ['high', 'more'].includes(params.get('filter')) ? params.get('filter') : 'all',
      q: (params.get('q') || '').slice(0, 200),
      tab: ['requirements', 'subjects', 'career', 'strengths', 'insights'].includes(params.get('tab')) ? params.get('tab') : 'overview',
      mode: params.get('mode') === 'compare' ? 'compare' : 'saved'
    };
  }
  function hashFor(next) {
    const params = new URLSearchParams();
    if (next.filter && next.filter !== 'all') {
      params.set('filter', next.filter);
    }
    if (next.q) {
      params.set('q', next.q);
    }
    if (next.tab && next.tab !== 'overview') {
      params.set('tab', next.tab);
    }
    if (next.mode === 'compare') {
      params.set('mode', 'compare');
    }
    return '#' + (next.view || 'home') + (next.id ? '/' + encodeURIComponent(next.id) : '') + (params.size ? '?' + params : '');
  }
  function link(view, extra = {}) {
    return esc(hashFor({
      ...route,
      view,
      id: '',
      tab: 'overview',
      ...extra
    }));
  }
  function navigate(next, replace = false) {
    history.replaceState({
      ...history.state,
      rcScroll: scrollY
    }, '', location.href);
    const depth = (history.state?.rcDepth || 0) + (replace ? 0 : 1);
    history[replace ? 'replaceState' : 'pushState']({
      rcDepth: depth,
      rcScroll: 0
    }, '', hashFor(next));
    route = next;
    lastHash = location.hash;
    render();
    window.scrollTo(0, 0);
    $('recommendationTitle')?.focus({
      preventScroll: true
    });
  }
  function back() {
    if (history.state?.rcDepth > 0) {
      history.back();
    } else {
      navigate({
        ...route,
        view: route.view === 'course' ? 'courses' : 'home',
        id: '',
        tab: 'overview'
      }, true);
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('recommendationToast').textContent = message;
    toastTimer = setTimeout(() => $('recommendationToast').textContent = '', 3500);
  }
  function safeImage(value) {
    if (!value) {
      return '';
    }
    try {
      const url = new URL(value, location.href);
      return !url.username && !url.password && (url.protocol === 'https:' || url.protocol === 'http:' && url.origin === location.origin) ? url.href : '';
    } catch {
      return '';
    }
  }
  function preferences() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
    } catch {
      return {};
    }
  }
  function persistPreferences() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        interests,
        comparison
      }));
    } catch {
      toast('Your preferences could not be saved on this device.');
    }
  }
  function recompute() {
    results = model.recommend(subjects, interests);
    ranked = new Map(results.map(course => [course.id, course]));
  }
  function courseFor(id) {
    return ranked.get(id) || (courseById.has(id) ? {
      ...courseById.get(id),
      score: null,
      match: 'Explore course',
      reasons: []
    } : null);
  }
  function loadSaved(entries) {
    saved = new Map();
    for (const favorite of entries || []) {
      if (favorite.type !== 'course') {
        continue;
      }
      const course = data.courses.find(item => model.key(item.courseName) === model.key(favorite.course) && model.key(item.institution) === model.key(favorite.institutionName));
      if (course) {
        saved.set(course.id, favorite.id);
      }
    }
  }
  async function locked(key, button, task) {
    if (locks.has(key)) {
      return;
    }
    locks.add(key);
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
    try {
      await task();
    } catch {
      toast('That change could not save. Please try again.');
    } finally {
      locks.delete(key);
      if (button?.isConnected) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }
  async function toggleSave(id, button) {
    const course = courseFor(id);
    if (!course) {
      return;
    }
    await locked('save:' + id, button, async () => {
      const wasSaved = saved.has(id);
      if (wasSaved) {
        await (api.removeFavoriteAsync ? api.removeFavoriteAsync(saved.get(id), user.id) : api.removeFavorite(saved.get(id), user.id));
        saved.delete(id);
        comparison = comparison.filter(value => value !== id);
        persistPreferences();
      } else {
        const entry = {
          type: 'course',
          institutionName: course.institution,
          province: course.province,
          institutionType: course.type,
          faculty: course.faculty,
          course: course.courseName
        };
        const favorite = await (api.addFavoriteAsync ? api.addFavoriteAsync(entry, user.id) : api.addFavorite(entry, user.id));
        if (!favorite?.id) {
          throw new Error('Favorite unavailable');
        }
        saved.set(id, favorite.id);
      }
      favoritesRevision++;
      toast(wasSaved ? 'Course removed from Saved.' : 'Course saved. Find it in Saved Courses or your application shortlist.');
      if (route.view === 'saved' || route.view === 'compare') {
        render();
      } else {
        syncSaveButtons(id);
      }
    });
  }
  function syncSaveButtons(id) {
    document.querySelectorAll('[data-save]').forEach(button => {
      if (button.dataset.save !== id) {
        return;
      }
      const isSaved = saved.has(id);
      button.setAttribute('aria-pressed', String(isSaved));
      button.setAttribute('aria-label', (isSaved ? 'Unsave ' : 'Save ') + courseById.get(id).courseName);
      if (button.classList.contains('rc-button')) {
        button.innerHTML = icon('bookmark') + (isSaved ? 'Saved' : 'Save');
      }
    });
  }
  function saveButton(course, className = 'rc-icon-button rc-course__save', text = false) {
    const isSaved = saved.has(course.id);
    return `<button class="${className}" type="button" data-save="${course.id}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Unsave' : 'Save'} ${esc(course.courseName)}">${icon(className.includes('rc-heart') ? 'heart' : 'bookmark')}${text ? isSaved ? 'Saved' : 'Save' : ''}</button>`;
  }
  function empty(title, copy, action = '') {
    return `<div class="rc-empty">
      <h2>${esc(title)}</h2>
      <p>${esc(copy)}</p>${action}</div>`;
  }
  function score(course) {
    return course.score === null ? '<span class="rc-score">Add marks</span>' : `<span class="rc-score">Score ${course.score}</span>`;
  }
  function match(course) {
    if (course.score === null) {
      return '';
    }
    return `<span class="rc-match ${course.match === 'High match' ? 'rc-match--high' : course.match === 'More options' ? 'rc-match--more' : ''}">${icon('check')}${esc(course.match)}</span>`;
  }
  function tags(course) {
    return `<div class="rc-tags">
      <span class="rc-tag">${icon('school')}${esc(course.faculty)}</span>
      <span class="rc-tag">${icon('building')}${course.type === 'College' ? 'TVET College' : 'Public University'}</span>
      </div>`;
  }
  function guidance() {
    return '<p class="rc-guidance">Kagie matches are study guidance. Check the institution’s current prospectus for programme availability, final entry requirements and duration.</p>';
  }
  function header() {
    const home = route.view === 'home';
    $('recommendationHeader').className = 'rc-header' + (home ? ' rc-header--home' : '');
    document.title = 'Kagie | ' + titles[route.view];
    if (home) {
      const name = String(profile.fullName || user.fullName || 'Learner');
      const avatar = safeImage(profile.profileImage || user.profileImage);
      $('recommendationHeader').innerHTML = `<a class="rc-brand" href="home.html">
      <span>K</span>Kagie.app</a>
      <div class="rc-header-actions">
      <a class="rc-icon-button" href="updates.html" aria-label="Updates">${icon('bell')}</a>
      <a class="rc-avatar" href="profile.html" aria-label="Your profile">${avatar ? `<img src="${esc(avatar)}" alt=""/>` : esc(name.charAt(0).toUpperCase())}</a>
      </div>`;
      return;
    }
    let actions = '';
    if (route.view === 'marks') {
      actions = '<button class="rc-link-button" type="button" data-clear-marks>Clear All</button>';
    }
    if (route.view === 'courses') {
      actions = `<button class="rc-icon-button" type="button" data-search-toggle aria-label="Search courses" aria-expanded="${searchOpen || !!route.q}">${icon('search')}</button>`;
    }
    if (route.view === 'course') {
      const course = courseFor(route.id);
      if (course) {
        actions = saveButton(course, 'rc-icon-button rc-heart') + `<button class="rc-icon-button" type="button" data-share aria-label="Share course">${icon('share')}</button>`;
      }
    }
    if (route.view === 'analytics') {
      actions = `<button class="rc-icon-button" type="button" data-aps-info aria-label="How APS is calculated">${icon('info')}</button>`;
    }
    $('recommendationHeader').innerHTML = `<a class="rc-icon-button" id="recommendationBack" href="#home" aria-label="Back">${icon('back')}</a>
      <h1 id="recommendationTitle" tabindex="-1">${titles[route.view]}</h1>
      <div class="rc-header-actions">${actions}</div>`;
  }
  function homeView() {
    const academic = model.academic(subjects);
    const firstName = String(profile.fullName || user.fullName || 'Learner').trim().split(/\s+/)[0];
    const hasMarks = academic.count > 0;
    const step = (number, title, copy, view, done, current) => `<div class="rc-step">
      <span class="rc-step-number ${done ? 'is-done' : current ? 'is-current' : ''}">${done ? icon('check') : number}</span>
      <div>
      <strong>${title}</strong>
      <p>${copy}</p>
      </div>
      <a class="rc-edit" href="${link(view)}">${number === 3 ? 'View' : 'Edit'}</a>
      </div>`;
    return `<section class="rc-content rc-home">
      <div>
      <h1 class="rc-heading" id="recommendationTitle" tabindex="-1">Hi ${esc(firstName)}! <span aria-hidden="true">👋</span>
      </h1>
      <p class="rc-copy">Let’s find the right courses for your future.</p>
        <a class="rc-smart" href="${link('marks')}">
      <span class="rc-smart-art">${icon('bulb')}</span>
      <div>
      <strong>Smart Recommendations</strong>
      <p>We analyse your marks, subject strengths and interests to match you with the best-fit courses.</p>
      </div>${icon('chevron')}</a>
        <div class="rc-stats">
      <a class="rc-stat" href="${link('analytics')}">
      <strong>${academic.aps}</strong>
      <span>APS Score</span>
      </a>
      <a class="rc-stat" href="${link('courses')}">
      <strong>${results.length}</strong>
      <span>Matched Courses</span>
      </a>
      <a class="rc-stat" href="${link('marks')}">
      <strong>${academic.count}</strong>
      <span>Subjects Added</span>
      </a>
      </div>
      </div>
      <div class="rc-home__journey">
      <h2 class="rc-subheading">Continue Your Journey</h2>
      <div class="rc-journey">
        ${step(1, 'Add your marks', hasMarks ? academic.count + ' subjects added' : 'Add your school results', 'marks', hasMarks, !hasMarks)}
        ${step(2, 'Choose your interests', interests.length ? interests.length + ' preferred fields selected' : 'Select preferred fields', 'interests', interests.length > 0, hasMarks && !interests.length)}
        ${step(3, 'View recommendations', 'Get your best match courses', 'courses', false, false)}
      </div>
      <a class="rc-button rc-button--wide" href="${link(hasMarks ? 'courses' : 'marks')}">View Recommendations ${icon('arrow')}</a>
      <div class="rc-home-links">
      <a href="${link('saved')}">${icon('bookmark')}Saved Courses</a>
      <a href="${link('analytics')}">${icon('chart')}Analytics</a>
      </div>
      </div>
    </section>`;
  }
  function subjectRows() {
    return subjects.map((row, index) => {
      const options = data.subjects.some(subject => model.key(subject) === model.key(row.name)) ? data.subjects : [row.name, ...data.subjects];
      return `<div class="rc-mark-row">
      <select aria-label="Subject ${index + 1}" data-subject="${index}">${options.filter(Boolean).map(subject => `<option value="${esc(subject)}" ${model.key(subject) === model.key(row.name) ? 'selected' : ''}>${esc(subject)}</option>`).join('')}</select>
      <div class="rc-mark-input">
      <input type="number" inputmode="decimal" min="0" max="100" step="any" aria-label="Percentage for subject ${index + 1}" data-mark="${index}" value="${esc(row.mark)}"/>
      <span aria-hidden="true">%</span>
      </div>
      <button class="rc-icon-button rc-remove" type="button" data-remove-subject="${index}" aria-label="Remove ${esc(row.name)}">${icon('trash')}</button>
      </div>`;
    }).join('');
  }
  function marksView() {
    return `<section class="rc-content rc-content--form">
      <p class="rc-copy">Add your school subjects and percentages so we can calculate your APS and find the best course matches.</p>
      <form id="marksForm" novalidate>
      <div class="rc-marks" id="subjectRows">${subjectRows()}</div>
      <button class="rc-add-subject" type="button" data-add-subject>${icon('plus')}Add Another Subject</button>
      <div class="rc-tip">${icon('info')}<p>Tip: Add at least 6 subjects for more accurate recommendations.</p>
      </div>
      <p class="rc-error" id="marksError" role="alert">
      </p>
      <div class="rc-form-actions">
      <button class="rc-button rc-button--wide" type="submit">Calculate &amp; Recommend ${icon('arrow')}</button>
      </div>
      </form>
      </section>`;
  }
  function fieldMarkup() {
    return data.fields.map(field => {
      const selected = interests.includes(field);
      const tone = field === 'Health' ? '#fd0505' : field === 'Education' || field === 'Technology' ? '#2d9df9' : '#677c98';
      return `<button class="rc-field" type="button" data-interest="${field}" aria-pressed="${selected}">
      <span class="rc-field-check" ${selected ? '' : 'hidden'}>${icon('check')}</span>
      <span class="rc-field-art" style="color:${tone}">${icon(fieldIcons[field])}</span>${field}</button>`;
    }).join('');
  }
  function selectedMarkup() {
    return `<h3>Selected interests (${interests.length})</h3>
      <div class="rc-chips">${interests.map(field => `<button class="rc-chip" type="button" data-interest="${field}" aria-label="Remove ${field} interest">${field}${icon('close')}</button>`).join('')}</div>`;
  }
  function interestsView() {
    return `<section class="rc-content rc-content--interests">
      <div class="rc-progress">
      <p>Step 2 of 3</p>
      <div class="rc-progress-track" role="progressbar" aria-label="Recommendation journey" aria-valuenow="2" aria-valuemin="0" aria-valuemax="3">
      <span>
      </span>
      </div>
      </div>
      <h2 class="rc-heading">What are you interested in?</h2>
      <p class="rc-copy">Select the fields that interest you. This helps us find courses that truly match your goals.</p>
      <div class="rc-fields" id="interestFields">${fieldMarkup()}</div>
      <div class="rc-selected" id="selectedInterests">${selectedMarkup()}</div>
      <p class="rc-error" id="interestsError" role="alert">
      </p>
      <div class="rc-form-actions">
      <button class="rc-button rc-button--wide" type="button" data-interest-continue>Continue ${icon('arrow')}</button>
      </div>
      </section>`;
  }
  function filteredResults() {
    const query = model.key(route.q);
    return results.filter(course => (route.filter === 'all' || (route.filter === 'high' ? course.match === 'High match' : course.match === 'More options')) && (!query || model.key(course.courseName + ' ' + course.institution + ' ' + course.faculty).includes(query)));
  }
  function courseCard(course) {
    return `<article class="rc-course">
      <div class="rc-course__top">${match(course)}${score(course)}</div>
      <a class="rc-course__link" href="${link('course', {
      id: course.id
    })}">
      <h2>${esc(course.courseName)}</h2>
      <p>${esc(course.institution)} · ${esc(course.province)}</p>
      <p>APS ${course.minAps} <span aria-hidden="true">&nbsp; | &nbsp;</span> ${esc(course.qualification)}</p>
      </a>${saveButton(course)}${tags(course)}</article>`;
  }
  function courseList() {
    const visible = filteredResults();
    $('courseResults').innerHTML = visible.length ? visible.map(courseCard).join('') : empty(results.length ? 'No matching courses' : 'Your matches start with your marks', results.length ? 'Try another search or match category.' : 'Add your subjects and percentages to find possible study paths.', `<a class="rc-button" href="${link(results.length ? 'courses' : 'marks', {
      filter: 'all',
      q: ''
    })}">${results.length ? 'View all matches' : 'Add your marks'}</a>`);
  }
  function coursesView() {
    const tabs = [['all', 'All Matches', results.length], ['high', 'High Match', results.filter(course => course.match === 'High match').length], ['more', 'More Options', results.filter(course => course.match === 'More options').length]];
    return `<section class="rc-content">
      <div class="rc-tabs" aria-label="Course match categories">${tabs.map(([filter, label, count]) => `<a class="rc-tab" href="${link('courses', {
      filter
    })}" aria-current="${route.filter === filter ? 'page' : 'false'}">${label}${filter === 'more' ? '' : ' ' + count}</a>`).join('')}</div>
      <div class="rc-search" id="courseSearchRow" ${searchOpen || route.q ? '' : 'hidden'}>${icon('search')}<input type="search" id="courseSearch" aria-label="Search courses" placeholder="Search courses or institutions…" maxlength="200" value="${esc(route.q)}"/>
      </div>
      <div class="rc-results" id="courseResults">
      </div>${guidance()}<div class="rc-home-links">
      <a href="${link('saved')}">${icon('bookmark')}Saved Courses</a>
      <a href="${link('interests')}">Edit interests ${icon('chevron')}</a>
      </div>
      </section>`;
  }
  function detailCopy(course) {
    if (route.tab === 'requirements') {
      return `<h2>Entry guidance</h2>
      <p>APS guide: <strong>${course.minAps}</strong>. Your current APS is <strong>${model.academic(subjects).aps}</strong>.</p>
      <ul>${course.requiredSubjects.map(subject => `<li>${esc(subject.name)}: ${subject.min}% in this Kagie guide</li>`).join('')}</ul>${guidance()}<a class="rc-edit" href="prospectus.html">Explore prospectuses ${icon('arrow')}</a>`;
    }
    if (route.tab === 'subjects') {
      return `<h2>Subject fit</h2>
      <ul>${course.reasons.map(reason => `<li>${esc(reason)}</li>`).join('') || '<li>Add your marks to see your subject fit.</li>'}</ul>
      <h2>Helpful subjects</h2>
      <p>${course.recommendedSubjects.map(subject => esc(subject.name)).join(', ') || 'Check the programme prospectus.'}</p>
      <a class="rc-edit" href="${link('marks')}">Edit your marks</a>`;
    }
    if (route.tab === 'career') {
      return `<h2>Explore your career path</h2>
      <p>${esc(course.description)} Find out how this field fits your goals with Kagie’s career guidance.</p>
      <a class="rc-button rc-button--secondary" href="career-guidance.html">Plan your career ${icon('arrow')}</a>`;
    }
    return `<h2>About this course</h2>
      <p>${esc(course.description)}</p>${guidance()}`;
  }
  function courseView() {
    const course = courseFor(route.id);
    if (!course) {
      return empty('Course unavailable', 'This course link is no longer available.', `<a class="rc-button" href="${link('courses')}">Back to courses</a>`);
    }
    const tabs = [['overview', 'Overview'], ['requirements', 'Requirements'], ['subjects', 'Subjects'], ['career', 'Career']];
    const currentTab = tabs.some(([tab]) => tab === route.tab) ? route.tab : 'overview';
    return `<section class="rc-content rc-detail">
      <div class="rc-detail-hero">
      <div class="rc-campus">
      <img src="images/updates-campus.webp" alt="Illustrative university campus" decoding="async"/>
      <div class="rc-campus-caption">
      <span>${esc(course.institution)}</span>
      <span>Campus illustration</span>
      </div>
      </div>
      <div class="rc-course__top">${match(course)}${score(course)}</div>
      <h2 class="rc-detail-title">${esc(course.courseName)}</h2>
      <p class="rc-detail-meta">${esc(course.institution)}<br/>${esc(course.province)} &nbsp; | &nbsp; ${course.type === 'College' ? 'TVET College' : 'Public University'}</p>
      <div class="rc-detail-facts">
      <div class="rc-fact">
      <strong>APS ${course.minAps}</strong>
      <span>Kagie entry guide</span>
      </div>
      <div class="rc-fact">
      <strong>Duration</strong>
      <span>Check prospectus</span>
      </div>
      <div class="rc-fact">
      <strong>${esc(course.qualification)}</strong>
      <span>Study pathway</span>
      </div>
      </div>
      </div>
      <div>
      <nav class="rc-detail-tabs" aria-label="Course information">${tabs.map(([tab, label]) => `<a href="${link('course', {
      id: course.id,
      tab
    })}" ${currentTab === tab ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <div class="rc-detail-copy">${detailCopy(course)}</div>
      <div class="rc-action-row">${saveButton(course, 'rc-button rc-button--secondary', true)}<a class="rc-button" href="${link('institutions', {
      id: course.id
    })}">View Matched Institutions</a>
      </div>
      </div>
      </section>`;
  }
  function savedView() {
    const comparing = route.mode === 'compare';
    const rows = [...saved.keys()].map(courseFor).filter(Boolean);
    return `<section class="rc-content">
      <div class="rc-tabs">
      <a class="rc-tab" href="${link('saved', {
      mode: 'saved'
    })}" aria-current="${comparing ? 'false' : 'page'}">Saved (${saved.size})</a>
      <a class="rc-tab" href="${link('saved', {
      mode: 'compare'
    })}" aria-current="${comparing ? 'page' : 'false'}">Compare (${comparison.length})</a>
      </div>
      <div class="rc-results">${rows.length ? rows.map(course => `<article class="rc-saved-course">
      <a href="${link('course', {
      id: course.id
    })}" tabindex="-1" aria-hidden="true">
      <img class="rc-saved-photo" src="images/updates-campus.webp" alt="" loading="lazy" decoding="async"/>
      </a>
      <div>
      <a href="${link('course', {
      id: course.id
    })}">
      <h2>${esc(course.courseName)}</h2>
      </a>
      <p>${esc(course.institution)}</p>
      <p>APS ${course.minAps} &nbsp; | &nbsp; ${esc(course.qualification)}</p>
      <span class="rc-tag">${icon('school')}${esc(course.faculty)}</span>
      <div>${score(course)}</div>
      </div>
      <div class="rc-saved-actions">${comparing ? `<input class="rc-compare-check" type="checkbox" data-compare="${course.id}" aria-label="Compare ${esc(course.courseName)}" ${comparison.includes(course.id) ? 'checked' : ''}/>` : `<button class="rc-icon-button rc-remove" type="button" data-save="${course.id}" aria-label="Remove ${esc(course.courseName)} from saved courses">${icon('close')}</button>`}</div>
      </article>`).join('') : empty('No saved courses yet', 'Save a course from your matches and find it here.', `<a class="rc-button" href="${link('courses')}">Explore courses</a>`)}</div>${rows.length ? comparing ? `<p class="rc-error" id="compareError" role="alert">
      </p>
      <button class="rc-button rc-button--wide" type="button" data-open-compare ${comparison.length === 2 ? '' : 'disabled'}>Compare Selected Courses ${icon('arrow')}</button>` : `<a class="rc-compare-prompt" href="${link('saved', {
      mode: 'compare'
    })}">${icon('compare')}<div>
      <strong>Compare Saved Courses</strong>
      <p>Select 2 courses to compare entry requirements, study pathways and more.</p>
      </div>${icon('chevron')}</a>` : ''}</section>`;
  }
  function analyticsView() {
    const academic = model.academic(subjects);
    const tabs = [['overview', 'APS Overview'], ['strengths', 'Subject Strengths'], ['insights', 'Insights']];
    const selected = ['strengths', 'insights'].includes(route.tab) ? route.tab : 'overview';
    const navigation = `<div class="rc-tabs">${tabs.map(([tab, label]) => `<a class="rc-tab" href="${link('analytics', {
      tab
    })}" aria-current="${selected === tab ? 'page' : 'false'}">${label}</a>`).join('')}</div>`;
    if (!academic.count) {
      return `<section class="rc-content">${navigation}${empty('Add your results first', 'Your APS and subject strengths will appear here once you add your marks.', `<a class="rc-button" href="${link('marks')}">Add your marks</a>`)}</section>`;
    }
    if (selected === 'strengths') {
      return `<section class="rc-content">${navigation}<div class="rc-strengths">${academic.strengths.length ? academic.strengths.map(row => `<article class="rc-strength">
      <h2>${esc(row.name)} <span class="rc-score">${row.mark}%</span>
      </h2>
      <p>${model.key(row.name) === 'life orientation' ? 'A strong result. Life Orientation is excluded from this APS calculation.' : 'One of your strongest subjects. Explore course guides that build on this result.'}</p>
      </article>`).join('') : empty('Keep building your strengths', 'Subjects with 60% or more will appear here.')}</div>
      </section>`;
    }
    if (selected === 'insights') {
      return `<section class="rc-content">${navigation}<div class="rc-strengths">
      <article class="rc-strength">
      <h2>Your subject mix</h2>
      <p>${academic.count} subjects added. ${academic.counted.length} contribute to your APS. Your overall average is ${academic.average}%.</p>
      </article>
      <article class="rc-strength">
      <h2>Your preferred fields</h2>
      <p>${interests.length ? esc(interests.join(', ')) : 'Choose your preferred fields to personalise your course ranking.'}</p>
      </article>
      <article class="rc-strength">
      <h2>Your course journey</h2>
      <p>${results.length} course guides match your current profile. ${saved.size} saved courses are ready to review.</p>
      </article>
      </div>
      <div class="rc-form-actions">
      <a class="rc-button rc-button--wide" href="${link('courses')}">Explore your matches ${icon('arrow')}</a>
      </div>
      </section>`;
    }
    return `<section class="rc-content">${navigation}<div class="rc-analytics">
      <div>
      <div class="rc-analytics-summary">
      <div class="rc-ring" style="--rc-progress:${Math.min(100, academic.aps / 42 * 100)}%" role="img" aria-label="APS score ${academic.aps} out of 42">
      <div>
      <strong>${academic.aps}</strong>
      <span>APS Score</span>
      </div>
      </div>
      <div>
      <h2>${results.length ? 'Your Path Ahead! 🎉' : 'Build Your Study Path'}</h2>
      <p>Your current APS is <strong>${academic.aps}</strong> with an average of <strong>${academic.average}%</strong>. ${results.length ? 'Explore your course matches and choose the path that fits your goals.' : 'Add your interests and review your marks to explore more study paths.'}</p>
      </div>
      </div>
      <p class="rc-guidance">APS uses your best six subjects, excluding Life Orientation. Institutions may calculate APS differently.</p>
      </div>
      <div class="rc-breakdown">
      <h2>Subject Breakdown</h2>${subjects.filter(row => row.mark !== '' && Number.isFinite(Number(row.mark))).map(row => `<div class="rc-subject-bar">
      <span>${esc(row.name)}</span>
      <div class="rc-bar">
      <span style="width:${Number(row.mark)}%">
      </span>
      </div>
      <strong>${row.mark}%</strong>
      </div>`).join('')}</div>
      </div>
      </section>`;
  }
  function compareView() {
    const courses = comparison.map(courseFor).filter(Boolean);
    if (courses.length !== 2) {
      return empty('Choose two courses to compare', 'Select two of your saved courses to see them side by side.', `<a class="rc-button" href="${link('saved', {
        mode: 'compare'
      })}">Choose courses</a>`);
    }
    const rows = [['APS guide', course => `APS ${course.minAps}`], ['Duration', () => 'Check prospectus'], ['Qualification Type', course => course.qualification], ['Field of Study', course => course.faculty], ['Campus Location', course => course.province], ['Your match score', course => course.score === null ? 'Add marks' : course.score + '/100'], ['Subject guidance', course => course.requiredSubjects.map(subject => subject.name + ' ' + subject.min + '%').join(', ')]];
    return `<section class="rc-content rc-content--compare">
      <div class="rc-tip">${icon('compare')}<div>
      <strong>Comparing 2 Courses</strong>
      <p>See how these options differ in entry guidance, study pathways and more.</p>
      </div>
      </div>
      <div class="rc-compare">
      <div class="rc-compare-head">${courses.map(course => `<article class="rc-compare-course">
      <img src="images/updates-campus.webp" alt="Illustrative campus"/>
      <button class="rc-icon-button rc-remove" type="button" data-remove-compare="${course.id}" aria-label="Remove ${esc(course.courseName)} from comparison">${icon('close')}</button>
      <h2>${esc(course.courseName)}</h2>
      <p>${esc(course.institution)}</p>
      </article>`).join('')}</div>
      <div class="rc-table-wrap" tabindex="0" aria-label="Course comparison">
      <table class="rc-table">
      <caption>Comparison of ${courses.map(course => esc(course.courseName)).join(' and ')}</caption>
      <thead>
      <tr>
      <th scope="col">Compare</th>${courses.map(course => `<th scope="col">${esc(course.courseName)}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows.map(([label, value]) => `<tr>
      <th scope="row">${label}</th>${courses.map(course => `<td>${esc(value(course))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      </div>
      </div>${guidance()}<div class="rc-action-row">
      <a class="rc-button rc-button--secondary" href="${link('saved', {
      mode: 'compare'
    })}">${icon('plus')}Change Courses</a>
      <button class="rc-button" type="button" data-find-similar>Find Similar Courses</button>
      </div>
      </section>`;
  }
  function institutionsView() {
    const course = courseFor(route.id);
    if (!course) {
      return empty('Course unavailable', 'Choose a course from your recommendations.');
    }
    const institution = (api.getInstitutionCatalog?.({
      includeInactive: false
    }) || []).find(item => model.key(item.name) === model.key(course.institution));
    return `<section class="rc-content rc-content--form">
      <p class="rc-copy">Explore the institution in your ${esc(course.courseName)} guide.</p>
      <article class="rc-institution">
      <h2>${esc(course.institution)}</h2>
      <p>${esc(course.province)} · ${esc(institution?.type || course.type)}</p>
      <p>Review current programme availability and entry requirements in the prospectus before making your application choices.</p>
      <div class="rc-action-row">
      <a class="rc-button rc-button--secondary" href="prospectus.html">View Prospectuses</a>
      <a class="rc-button" href="forms.html">Plan Application ${icon('arrow')}</a>
      </div>
      </article>
      </section>`;
  }
  function render() {
    if (!ready) {
      return;
    }
    header();
    const views = {
      home: homeView,
      marks: marksView,
      interests: interestsView,
      courses: coursesView,
      course: courseView,
      saved: savedView,
      analytics: analyticsView,
      compare: compareView,
      institutions: institutionsView
    };
    $('recommendationContent').innerHTML = views[route.view]();
    $('recommendationContent').setAttribute('aria-busy', 'false');
    if (route.view === 'courses') {
      courseList();
    }
  }
  function renderSubjectRows(focusLast = false) {
    $('subjectRows').innerHTML = subjectRows();
    if (focusLast) {
      $('subjectRows').lastElementChild?.querySelector('input')?.focus();
    }
  }
  function updateInterest(field) {
    if (!data.fields.includes(field)) {
      return;
    }
    interests = interests.includes(field) ? interests.filter(value => value !== field) : [...interests, field];
    persistPreferences();
    recompute();
    document.querySelectorAll('.rc-field').forEach(button => {
      const selected = interests.includes(button.dataset.interest);
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('.rc-field-check').hidden = !selected;
    });
    $('selectedInterests').innerHTML = selectedMarkup();
    $('interestsError').textContent = '';
  }
  function selectComparison(id, checked, checkbox) {
    if (!saved.has(id)) {
      return;
    }
    if (checked && comparison.length >= 2 && !comparison.includes(id)) {
      checkbox.checked = false;
      $('compareError').textContent = 'Choose up to two courses to compare.';
      return;
    }
    comparison = checked ? [...new Set([...comparison, id])] : comparison.filter(value => value !== id);
    persistPreferences();
    $('compareError').textContent = '';
    document.querySelector('[data-open-compare]').disabled = comparison.length !== 2;
    const tab = document.querySelector('.rc-tabs a:last-child');
    tab.textContent = `Compare (${comparison.length})`;
  }
  async function submitMarks(form) {
    const error = model.validate(subjects);
    if (error) {
      $('marksError').textContent = error;
      form.querySelector('input:invalid')?.focus();
      return;
    }
    await locked('marks', form.querySelector('[type=submit]'), async () => {
      const marks = subjects.map(row => ({
        subject: row.name,
        percent: Number(row.mark),
        level: model.level(Number(row.mark))
      }));
      // The existing profile contract retains academic marks locally for the signed-in learner.
      api.saveProfile(user.id, {
        marks
      });
      profileDirty = true;
      subjects = subjects.map(row => ({
        ...row,
        mark: Number(row.mark)
      }));
      recompute();
      navigate({
        ...route,
        view: 'interests',
        id: '',
        q: '',
        filter: 'all'
      });
    });
  }
  async function shareCourse() {
    const course = courseFor(route.id);
    if (!course) {
      return;
    }
    const url = new URL('recommendation.html', location.href);
    url.hash = hashFor({
      view: 'course',
      id: course.id
    });
    try {
      if (navigator.share) {
        await navigator.share({
          title: course.courseName,
          url: url.href
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.href);
        toast('Course link copied.');
      } else {
        toast('Copy this course link from your browser’s address bar.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast('Could not share. Copy the course link from the address bar.');
      }
    }
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }
    const target = event.target;
    if (target.closest('#recommendationBack')) {
      event.preventDefault();
      back();
      return;
    }
    const hashLink = target.closest('a[href^="#"]');
    if (hashLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault();
      navigate(readRoute(new URL(hashLink.href).hash));
      return;
    }
    const save = target.closest('[data-save]');
    if (save) {
      void toggleSave(save.dataset.save, save);
      return;
    }
    const field = target.closest('[data-interest]');
    if (field) {
      updateInterest(field.dataset.interest);
      return;
    }
    if (target.closest('[data-add-subject]')) {
      const used = new Set(subjects.map(row => model.key(row.name)));
      const next = data.subjects.find(subject => !used.has(model.key(subject)));
      if (!next) {
        toast('All available subjects have been added.');
        return;
      }
      subjects.push({
        name: next,
        mark: ''
      });
      profileDirty = true;
      recompute();
      renderSubjectRows(true);
      $('marksError').textContent = '';
    }
    const remove = target.closest('[data-remove-subject]');
    if (remove) {
      subjects.splice(Number(remove.dataset.removeSubject), 1);
      profileDirty = true;
      recompute();
      renderSubjectRows();
      $('marksError').textContent = '';
    }
    if (target.closest('[data-clear-marks]')) {
      subjects = [];
      profileDirty = true;
      recompute();
      renderSubjectRows();
      $('marksError').textContent = '';
    }
    if (target.closest('[data-interest-continue]')) {
      if (!interests.length) {
        $('interestsError').textContent = 'Select at least one field to continue.';
        return;
      }
      recompute();
      navigate({
        ...route,
        view: 'courses',
        id: '',
        filter: 'all',
        q: ''
      });
    }
    if (target.closest('[data-search-toggle]')) {
      searchOpen = !searchOpen;
      $('courseSearchRow').hidden = !searchOpen && !route.q;
      target.closest('[data-search-toggle]').setAttribute('aria-expanded', String(!$('courseSearchRow').hidden));
      if (!$('courseSearchRow').hidden) {
        $('courseSearch').focus();
      }
    }
    if (target.closest('[data-open-compare]')) {
      navigate({
        ...route,
        view: 'compare',
        id: ''
      });
    }
    const removeCompare = target.closest('[data-remove-compare]');
    if (removeCompare) {
      comparison = comparison.filter(id => id !== removeCompare.dataset.removeCompare);
      persistPreferences();
      navigate({
        ...route,
        view: 'saved',
        id: '',
        mode: 'compare'
      }, true);
    }
    if (target.closest('[data-find-similar]')) {
      const course = courseFor(comparison[0]);
      navigate({
        ...route,
        view: 'courses',
        id: '',
        filter: 'all',
        q: course?.faculty || ''
      });
    }
    if (target.closest('[data-share]')) {
      void shareCourse();
    }
    if (target.closest('[data-aps-info]')) {
      toast('APS adds the levels of your best six subjects, excluding Life Orientation. Maximum: 42.');
    }
    if (target.closest('[data-retry]')) {
      void main();
    }
  });
  document.addEventListener('input', event => {
    const target = event.target;
    if (target.matches('[data-mark]')) {
      subjects[Number(target.dataset.mark)].mark = target.value;
      profileDirty = true;
      recompute();
      $('marksError').textContent = '';
    }
    if (target.id === 'courseSearch') {
      route = {
        ...route,
        q: target.value
      };
      history.replaceState({
        ...history.state
      }, '', hashFor(route));
      lastHash = location.hash;
      courseList();
    }
  });
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-subject]')) {
      subjects[Number(target.dataset.subject)].name = target.value;
      profileDirty = true;
      recompute();
      $('marksError').textContent = '';
    }
    if (target.matches('[data-compare]')) {
      selectComparison(target.dataset.compare, target.checked, target);
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'marksForm') {
      event.preventDefault();
      void submitMarks(event.target);
    }
  });
  function restoreRoute() {
    if (lastHash === location.hash) {
      return;
    }
    route = readRoute();
    lastHash = location.hash;
    render();
    window.scrollTo(0, history.state?.rcScroll || 0);
  }
  window.addEventListener('popstate', restoreRoute);
  window.addEventListener('hashchange', restoreRoute);
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.rc-avatar')) {
      event.target.replaceWith(document.createTextNode(String(user?.fullName || 'K').charAt(0)));
    }
  }, true);
  async function main() {
    try {
      api = window.KagieAPI;
      if (!api) {
        throw new Error('API unavailable');
      }
      const restored = api.resolveSessionUser ? await api.resolveSessionUser({
        attempts: 2,
        delayMs: 200
      }) : api.currentUser?.();
      if (!restored || !['user', 'learner', 'student', 'authenticated'].includes(restored.role)) {
        location.replace('login.html?app=1');
        return;
      }
      user = api.requireRole('user');
      storageKey = 'kagie_recommendation_preferences:' + user.id;
      profile = api.getProfile(user.id) || {};
      subjects = model.readMarks(profile);
      const preferencesForUser = preferences();
      interests = Array.isArray(preferencesForUser.interests) ? [...new Set(preferencesForUser.interests.filter(field => data.fields.includes(field)))] : [];
      comparison = Array.isArray(preferencesForUser.comparison) ? [...new Set(preferencesForUser.comparison.filter(id => courseById.has(id)))].slice(0, 2) : [];
      loadSaved(api.getFavorites?.(user.id) || []);
      comparison = comparison.filter(id => saved.has(id));
      recompute();
      ready = true;
      render();
      document.querySelectorAll('.kagie-shared-bottom-nav .bottom-nav-icon').forEach(node => node.innerHTML = icon(node.textContent.trim()));
      const readRevision = favoritesRevision;
      const refreshed = await Promise.allSettled([api.getProfileAsync ? api.getProfileAsync(user.id) : profile, api.getFavoritesAsync ? api.getFavoritesAsync(user.id) : api.getFavorites(user.id)]);
      const editingMarks = route.view === 'marks' && document.activeElement?.closest('#marksForm');
      if (refreshed[0].status === 'fulfilled' && !profileDirty && !editingMarks) {
        profile = refreshed[0].value || profile;
        subjects = model.readMarks(profile);
        recompute();
        if (route.view === 'marks') {
          renderSubjectRows();
        }
      }
      if (refreshed[1].status === 'fulfilled' && readRevision === favoritesRevision && ![...locks].some(key => key.startsWith('save:'))) {
        const oldIds = [...saved.keys()].join(',');
        loadSaved(refreshed[1].value);
        if (route.view === 'saved' && oldIds !== [...saved.keys()].join(',')) {
          render();
        }
        if (route.view === 'course') {
          syncSaveButtons(route.id);
        }
      }
      // Background reads cannot discard a form draft, current search, or selected text.
      if (route.view === 'home' || route.view === 'analytics' || route.view === 'institutions') {
        render();
      }
      if (route.view === 'courses') {
        courseList();
      }
    } catch {
      $('recommendationContent').setAttribute('aria-busy', 'false');
      $('recommendationContent').innerHTML = empty('Your course journey could not load', 'Please try again to reconnect to Kagie.', '<button class="rc-button" type="button" data-retry>Try Again</button>');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main, {
      once: true
    });
  } else {
    void main();
  }
})();
