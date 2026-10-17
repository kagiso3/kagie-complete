(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
  const categories = [
    ['announcement', 'Announcements', 'Announcement'],
    ['deadline', 'Deadlines', 'Deadline'],
    ['opportunity', 'Opportunities', 'Opportunity'],
    ['recommendation', 'Recommendations', 'Recommendation'],
    ['news', 'News', 'News'],
    ['system', 'System Updates', 'System Update'],
    ['application', 'Applications', 'Application']
  ];
  const categoryMetadata = new Map(categories.map(([key, label, badge]) => [key, {
    label,
    badge
  }]));
  const categoryKeys = new Set(categoryMetadata.keys());
  const categoryKey = value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const categoryAliases = new Map(categories.flatMap(([key, label, badge]) => [key, label, badge].map(value => [categoryKey(value), key])));
  for (const [alias, key] of [['info', 'announcement'], ['warning', 'announcement'], ['service', 'news'], ['support', 'news'], ['applicationupdate', 'application']]) {
    categoryAliases.set(alias, key);
  }
  const catalogById = new Map((window.KagieData?.updates || []).map(item => [item.id, item]));
  const guidePoints = {
    pack: ['Choose the application type and intake you need.', 'Check intake availability before submitting.', 'Select your institutions and preferred courses.', 'Keep your core documents up to date.'],
    documents: ['Upload a clear ID copy and your latest academic results.', 'Check that your documents are readable and current.'],
    upd_1: ['Use one learner profile for your applications.', 'Explore both university and TVET study options.'],
    upd_2: ['Review your Mathematics and Physical Sciences results.', 'Compare courses across universities and universities of technology.'],
    upd_3: ['Confirm opening and closing dates with each institution.', 'Prepare your application pack before submitting.'],
    upd_4: ['Open More Services to choose the assistance you need.', 'Track your request through Kagie support.']
  };
  const evergreenGuides = [{
    id: 'guide-pack',
    source: 'catalog',
    category: 'announcement',
    title: 'Choose an application pack',
    message: 'Select the application type and intake that match your study plans, then choose your institutions.',
    ctaLabel: 'Choose Application Pack',
    ctaHref: 'forms.html'
  }, {
    id: 'guide-documents',
    source: 'catalog',
    category: 'announcement',
    title: 'Upload your core documents',
    message: 'Certified ID copy and latest results help your application move faster.',
    ctaLabel: 'Upload Documents',
    ctaHref: 'upload.html'
  }];
  const viewTitles = {
    feed: 'Updates',
    search: 'Search Results',
    filters: 'Filter Updates',
    detail: 'Update Details'
  };
  const completedReads = new Set();
  const pendingReads = new Map();
  const paths = {
    back: 'm14 5-7 7 7 7',
    chevron: 'm10 5 7 7-7 7',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    filter: 'M3 4h18l-7 8v7l-4 2v-9L3 4z',
    share: 'm8 11 8-5M8 13l8 5',
    home: 'm3 10 9-7 9 7v10h-6v-7H9v7H3z',
    business_center: 'M3 7h18v13H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    school: 'm2 8 10-5 10 5-10 5L2 8zm4 3v6l6 4 6-4v-6M22 8v8',
    apartment: 'M5 21V3h14v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3',
    directions_bus: 'M5 16V5c0-2 14-2 14 0v11M5 10h14M5 16h14M7 16v4m10-4v4M8 13h.01M16 13h.01'
  };
  function createIcon(name) {
    if (name === 'more') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/>${name === 'share' ? '<circle cx="5" cy="12" r="3"/><circle cx="19" cy="4" r="3"/><circle cx="19" cy="20" r="3"/>' : ''}</svg>`;
  }
  // Build fixed SVG markup once, rather than reconstructing it for every result.
  const icons = new Map([...Object.keys(paths), 'more'].map(name => [name, createIcon(name)]));
  const icon = name => icons.get(name) || icons.get('arrow');
  const categoryIcons = (() => {
    const document = '<path fill="#ffb500" d="M9 3h15l10 10v26H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/><path fill="#ffb500" d="M24 3v10h10z"/><path d="M12 20h15M12 25h15M12 30h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
    const clock = '<circle cx="22" cy="22" r="17" fill="#fd0505"/><path d="M22 11v12l7 5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 17a14 14 0 0 1 7-8" stroke="#fd0505" stroke-width="2" stroke-linecap="round"/>';
    const university = '<path fill="#2d9df9" d="m22 4 20 12H2zM6 18h32v4H6zM5 35h34v5H5z"/><path d="M10 23h5v12h-5zm10 0h5v12h-5zm10 0h5v12h-5z" fill="#2d9df9"/><circle cx="22" cy="13" r="2" fill="#fff"/><path d="M12 25v7m10-7v7m10-7v7" stroke="#b8defd" stroke-width="2"/>';
    const gear = '<path fill="currentColor" d="m18 3 1 5h6l1-5 6 3-2 4 4 4 4-2 3 6-5 1v6l5 1-3 6-4-2-4 4 2 4-6 3-1-5h-6l-1 5-6-3 2-4-4-4-4 2-3-6 5-1v-6l-5-1 3-6 4 2 4-4-2-4z"/><circle cx="22" cy="22" r="7" fill="#fff"/>';
    const headset = '<path d="M8 23v-5a14 14 0 0 1 28 0v5" stroke="#00985e" stroke-width="4" fill="none"/><rect x="4" y="19" width="9" height="15" rx="4" fill="#00985e"/><rect x="31" y="19" width="9" height="15" rx="4" fill="#00985e"/><path d="M35 32c0 6-6 8-11 8" stroke="#00985e" stroke-width="3" fill="none"/><rect x="20" y="37" width="8" height="5" rx="2.5" fill="#00985e"/>';
    const application = '<rect x="9" y="5" width="27" height="36" rx="4" fill="#2d9df9"/><rect x="16" y="2" width="13" height="7" rx="2" fill="#2d9df9"/><path d="m15 26 5 5 10-12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    const grid = '<rect x="5" y="5" width="15" height="15" rx="5"/><rect x="24" y="5" width="15" height="15" rx="5"/><rect x="5" y="24" width="15" height="15" rx="5"/><rect x="24" y="24" width="15" height="15" rx="5"/>';
    const artwork = {
      announcement: document,
      deadline: clock,
      opportunity: university,
      recommendation: gear,
      news: headset,
      system: gear,
      application,
      all: grid
    };
    return new Map(Object.entries(artwork).map(([key, body]) => [key, `<svg viewBox="0 0 44 44" fill="currentColor" aria-hidden="true">${body}</svg>`]));
  })();
  const categoryIcon = key => categoryIcons.get(key) || categoryIcons.get('announcement');
  const categoryLabel = key => categoryMetadata.get(key)?.label || 'Updates';
  const badgeLabel = key => categoryMetadata.get(key)?.badge || 'Announcement';
  const category = value => categoryAliases.get(categoryKey(value)) || 'announcement';
  const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const dateTime = value => {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : null;
  };
  const localDay = value => {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function validDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number(value.slice(0, 4)) === 0) {
      return '';
    }
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
  }
  function safeUrl(value, image = false) {
    if (!value) {
      return '';
    }
    try {
      const url = new URL(String(value), location.href);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        return '';
      }
      if (image && url.protocol !== 'https:' && url.origin !== location.origin) {
        return '';
      }
      if (url.origin === location.origin && /\/dashboard\.html$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/dashboard\.html$/i, 'Dashboard.html');
      }
      return url.href;
    } catch {
      return '';
    }
  }
  // Dynamic feed IDs are generated on each API call; semantic IDs keep links reloadable.
  function stableKey(text) {
    let hash = 2166136261;
    for (const char of text) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  let api,
    user,
    records = [],
    byId = new Map(),
    loadIssues = false,
    loading = false,
    ready = false,
    toastTimer;
  let recordsRevision = 0,
    listSnapshot = null;
  let route = readRoute(),
    lastHash = location.hash;
  function readRoute(hash = location.hash) {
    const raw = hash.slice(1),
      [path, query = ''] = raw.split('?'),
      params = new URLSearchParams(query);
    const [view, encodedId] = path.split('/');
    let id = '';
    try {
      id = decodeURIComponent(encodedId || '');
    } catch {/* Malformed links show the missing update state. */}
    const cats = (params.get('categories') || '').split(',').filter(key => categoryKeys.has(key));
    return {
      view: ['category', 'detail', 'filters', 'search'].includes(view) ? view : 'feed',
      id,
      category: categoryKeys.has(id) && view === 'category' ? id : categoryKeys.has(params.get('category')) ? params.get('category') : 'all',
      q: (params.get('q') || '').slice(0, 200),
      cats,
      from: validDay(params.get('from')),
      to: validDay(params.get('to'))
    };
  }
  function hashFor(next) {
    const params = new URLSearchParams();
    if (next.q) {
      params.set('q', next.q);
    }
    if (next.category && next.category !== 'all' && next.view !== 'category') {
      params.set('category', next.category);
    }
    if (next.cats?.length) {
      params.set('categories', next.cats.join(','));
    }
    if (next.from) {
      params.set('from', next.from);
    }
    if (next.to) {
      params.set('to', next.to);
    }
    const path = next.view === 'feed' ? '' : next.view + (['detail', 'category'].includes(next.view) ? '/' + encodeURIComponent(next.view === 'category' ? next.category : next.id) : '');
    return '#' + path + (params.size ? '?' + params.toString() : '');
  }
  function navigate(next, replace = false) {
    if (!replace) {
      history.replaceState({
        ...history.state,
        upScroll: scrollY
      }, '', location.href);
    }
    const depth = replace ? history.state?.upDepth || 0 : (history.state?.upDepth || 0) + 1;
    history[replace ? 'replaceState' : 'pushState']({
      upDepth: depth,
      upScroll: 0
    }, '', hashFor(next));
    route = next;
    lastHash = location.hash;
    render();
    window.scrollTo(0, 0);
    $('updatesTitle').focus({
      preventScroll: true
    });
  }
  function back() {
    if (history.state?.upDepth > 0) {
      history.back();
    } else {
      navigate({
        ...route,
        view: 'feed',
        id: '',
        category: 'all',
        q: ''
      }, true);
    }
  }
  function toast(text) {
    clearTimeout(toastTimer);
    $('updatesToast').textContent = text;
    toastTimer = setTimeout(() => $('updatesToast').textContent = '', 4500);
  }
  function normalize(entry, source) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const title = String(entry.title || entry.status || 'Kagie update').trim();
    const kind = source || entry.source || 'catalog';
    const catalog = kind === 'catalog' ? catalogById.get(entry.id) : null;
    const dynamic = kind === 'dynamic';
    const packGuide = /^choose an application pack$/i.test(title);
    const documentGuide = /^upload your core documents$/i.test(title);
    const key = source === 'application' ? 'application' : catalog?.id === 'upd_1' ? 'opportunity' : dynamic && (packGuide || documentGuide) ? 'announcement' : category(entry.category || entry.type);
    const message = String(entry.message || entry.body || '');
    const id = dynamic ? 'dynamic-' + stableKey(title + '|' + key) : kind + '-' + String(entry.id || stableKey(title + '|' + message));
    // Undated built-in guides are not freshly published notices.
    const date = catalog && !catalog.createdAt || dynamic ? '' : entry.updateAt || entry.createdAt || entry.created_at || '';
    const points = Array.isArray(entry.keyInformation) ? entry.keyInformation.map(String) : [];
    const imageUrl = safeUrl(entry.imageUrl || entry.image_url || entry.thumbnailUrl || (catalog?.id === 'upd_4' ? 'images/students.webp' : catalog?.id === 'upd_1' || packGuide ? 'images/updates-campus.webp' : ''), true);
    const time = dateTime(date);
    const href = safeUrl(entry.ctaHref || entry.actionUrl || (source === 'application' ? 'Dashboard.html' : ''));
    return {
      id,
      originalId: entry.id,
      source: kind,
      title,
      message,
      category: key,
      time,
      day: time === null ? '' : localDay(time),
      dateLabel: time === null ? 'Kagie guide' : dateFormatter.format(time),
      search: [title, message, badgeLabel(key), categoryLabel(key)].join(' ').toLocaleLowerCase(),
      href,
      external: !!href && new URL(href).origin !== location.origin,
      actionLabel: String(entry.ctaLabel || entry.actionLabel || (source === 'application' ? 'Open application' : 'Continue')),
      image: imageUrl,
      imageAlt: String(entry.imageAlt || (imageUrl.endsWith('/images/updates-campus.webp') ? 'Decorative image of a fictional university campus' : 'Image for ' + title)),
      points: points.length ? points : guidePoints[packGuide ? 'pack' : documentGuide ? 'documents' : catalog?.id] || [],
      guideRank: packGuide ? 0 : documentGuide ? 1 : catalog?.id ? Number(catalog.id.slice(4)) + 1 : 99,
      read: !!entry.read || completedReads.has(kind + ':' + entry.id),
      public: kind === 'catalog' || entry.source === 'announcement' || entry.userId === 'all'
    };
  }
  function merge(base, applications, notifications) {
    const items = new Map();
    for (const entry of base) {
      const item = normalize(entry);
      if (item) {
        items.set(item.id, item);
      }
    }
    // Stable source-prefixed IDs let fresh notifications replace cached ones directly.
    for (const entry of notifications) {
      const item = normalize(entry, 'notification');
      if (item) {
        items.set(item.id, item);
      }
    }
    for (const entry of applications) {
      const item = normalize(entry, 'application');
      if (item) {
        items.set(item.id, item);
      }
    }
    // Keep the two reference guides available after a learner completes their first steps.
    // They are clearly undated guides, rather than invented published notices.
    if (base.some(entry => entry.source === 'catalog' && entry.id === 'upd_1')) {
      const titles = new Set([...items.values()].map(item => item.title.toLowerCase()));
      for (const guide of evergreenGuides) {
        if (!titles.has(guide.title.toLowerCase())) {
          const item = normalize(guide);
          items.set(item.id, item);
        }
      }
    }
    records = [...items.values()].sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || a.guideRank - b.guideRank);
    byId = new Map(records.map(item => [item.id, item]));
    recordsRevision++;
  }
  function visibleRecords() {
    const search = route.q.trim().toLocaleLowerCase();
    return records.filter(item => (route.category === 'all' || route.view !== 'category' || item.category === route.category) && (!route.cats.length || route.cats.includes(item.category)) && (!search || item.search.includes(search)) && (!route.from && !route.to || item.time !== null && (!route.from || item.day >= route.from) && (!route.to || item.day <= route.to)));
  }
  const badge = item => `<span class="up-badge">${esc(badgeLabel(item.category))}</span>`;
  const stamp = item => `<span class="up-date">${esc(item.dateLabel)}</span>`;
  function card(item, related = false) {
    const next = {
      ...route,
      view: 'detail',
      id: item.id
    };
    const art = related && item.image ? `<img class="up-card__photo" src="${esc(item.image)}" alt="" loading="lazy" decoding="async" />` : `<span class="up-card__icon">${categoryIcon(item.category)}</span>`;
    const heading = related ? 'h3' : 'h2';
    return `<a class="up-card up-tone-${item.category}" href="${esc(hashFor(next))}" data-update="${esc(item.id)}">
      ${art}
      <div class="up-card__body">
        <div class="up-card__meta">${badge(item)}${related ? '' : stamp(item)}</div>
        <${heading}>${esc(item.title)}</${heading}>
        ${related ? stamp(item) : `<p>${esc(item.message)}</p>`}
      </div>
      <span class="up-card__arrow">${icon('arrow')}</span>
    </a>`;
  }
  function statusBanner() {
    return loadIssues ? '<div class="up-status" role="status"><p>Some updates could not refresh. Your available updates are shown below.</p><button type="button" data-retry>Try Again</button></div>' : '';
  }
  function searchBar() {
    return `<div class="up-search-row">
      <div class="up-search">
        ${icon('search')}
        <input id="updateSearch" type="search" aria-label="Search updates" placeholder="Search updates..." maxlength="200" value="${esc(route.q)}" />
        <button class="up-icon-button" id="clearSearch" type="button" aria-label="Clear search" ${route.q ? '' : 'hidden'}>${icon('close')}</button>
      </div>
      <a class="up-icon-button up-filter-button" href="${esc(hashFor({
      ...route,
      view: 'filters'
    }))}" aria-label="Filter updates">
        ${icon('filter')}${route.cats.length || route.from || route.to ? '<span class="up-filter-dot"></span>' : ''}
      </a>
    </div>`;
  }
  function empty(title, description, action = '') {
    return `<div class="up-empty"><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`;
  }
  function listContent() {
    const visible = visibleRecords();
    const count = $('resultsCount'),
      list = $('updateList');
    const label = `Results (${visible.length})`;
    if (count && count.textContent !== label) {
      count.textContent = label;
    }
    // Keep filter links in sync with the current query while the input stays mounted.
    const filterLink = document.querySelector('.up-filter-button');
    if (filterLink) {
      filterLink.setAttribute('href', hashFor({
        ...route,
        view: 'filters'
      }));
    }
    const unchanged = listSnapshot?.node === list && listSnapshot.revision === recordsRevision && visible.length === listSnapshot.ids.length && visible.every((item, index) => item.id === listSnapshot.ids[index]);
    if (unchanged) {
      // Reuse matching rows, but preserve the latest search context in detail links.
      visible.forEach((item, index) => {
        const link = list.children[index],
          href = hashFor({
            ...route,
            view: 'detail',
            id: item.id
          });
        if (link.getAttribute('href') !== href) {
          link.setAttribute('href', href);
        }
      });
      return;
    }
    list.innerHTML = visible.length ? visible.map(item => card(item)).join('') : empty(records.length ? 'No matching updates' : 'No updates yet', records.length ? 'Try another search, category, or date range.' : 'New notices and application updates will appear here.', records.length ? '<button class="up-button" type="button" data-clear-filters>Clear filters</button>' : '');
    listSnapshot = {
      node: list,
      revision: recordsRevision,
      ids: visible.map(item => item.id)
    };
  }
  function tabsMarkup() {
    return `<nav class="up-tabs" aria-label="Update categories"><a class="up-tab" href="${esc(hashFor({
      ...route,
      view: 'feed',
      category: 'all',
      cats: [],
      q: ''
    }))}" ${route.cats.length ? '' : 'aria-current="page"'}>All</a>${categories.map(([key, label]) => `<a class="up-tab" href="${esc(hashFor({
      ...route,
      view: 'category',
      category: key,
      cats: [],
      q: ''
    }))}">${label}</a>`).join('')}</nav>`;
  }
  function renderList() {
    const searching = route.view === 'search';
    const compact = searching || route.view === 'category';
    $('updatesContent').innerHTML = `<section class="${searching ? 'up-search-results' : route.view === 'category' ? 'up-category' : 'up-feed'}">
      ${route.view === 'feed' ? tabsMarkup() : ''}
      ${route.view === 'category' ? '' : searchBar()}
      <div id="updateLoadStatus">${statusBanner()}</div>
      ${searching ? '<h2 class="up-results-title" id="resultsCount" aria-live="polite"></h2>' : ''}
      <div class="up-list${compact ? ' up-list--compact' : ''}" id="updateList"></div>
    </section>`;
    listContent();
    $('updateSearch')?.addEventListener('input', searchChanged);
    $('clearSearch')?.addEventListener('click', () => {
      navigate({
        ...route,
        view: 'feed',
        q: '',
        category: 'all'
      });
      $('updateSearch')?.focus();
    });
  }
  function searchChanged(event) {
    const value = event.target.value;
    const becomesSearch = !!value.trim();
    const priorView = route.view;
    route = {
      ...route,
      q: value,
      view: becomesSearch ? 'search' : 'feed',
      category: 'all'
    };
    if (priorView !== route.view) {
      // Keep the input node mounted while typing: no lost focus or mobile keyboard jumps.
      const section = $('updatesContent').firstElementChild;
      section.className = becomesSearch ? 'up-search-results' : 'up-feed';
      section.querySelector('.up-tabs')?.remove();
      if (becomesSearch) {
        const count = document.createElement('h2');
        count.className = 'up-results-title';
        count.id = 'resultsCount';
        count.setAttribute('aria-live', 'polite');
        $('updateList').before(count);
      } else {
        $('resultsCount')?.remove();
        section.insertAdjacentHTML('afterbegin', tabsMarkup());
      }
      $('updateList').classList.toggle('up-list--compact', becomesSearch);
      renderHeader();
    }
    $('clearSearch').hidden = !value;
    // One history entry for search; subsequent keystrokes replace it.
    if (priorView === 'feed' && becomesSearch) {
      history.pushState({
        upDepth: (history.state?.upDepth || 0) + 1
      }, '', hashFor(route));
    } else {
      history.replaceState({
        ...history.state
      }, '', hashFor(route));
    }
    lastHash = location.hash;
    listContent();
  }
  function renderFilters() {
    const chosen = route.cats.length ? route.cats : route.category !== 'all' ? [route.category] : [];
    const options = [['all', 'All'], ...categories.map(([key, label]) => [key, label])];
    const optionMarkup = options.map(([key, label]) => {
      const checked = key === 'all' ? !chosen.length : chosen.includes(key);
      return `<label class="up-filter-option up-tone-${key === 'all' ? 'deadline' : key}">
        <span class="up-checkbox"><input type="checkbox" name="category" value="${key}" ${checked ? 'checked' : ''} /></span>
        <span class="up-card__icon">${categoryIcon(key)}</span>
        <span class="up-filter-option__label">${label}</span>
      </label>`;
    }).join('');
    $('updatesContent').innerHTML = `<form class="up-filters" id="updatesFilterForm" novalidate>
      <h2>Categories</h2>
      <div class="up-filter-options">${optionMarkup}</div>
      <section class="up-date-section">
        <h2>Date Range</h2>
        <div class="up-date-fields">
          <label for="filterFrom">From<input id="filterFrom" type="date" name="from" value="${esc(route.from)}" /></label>
          <label for="filterTo">To<input id="filterTo" type="date" name="to" value="${esc(route.to)}" /></label>
        </div>
      </section>
      <p class="up-filter-error" id="filterError" role="alert"></p>
      <button class="up-button" type="submit">Apply Filters</button>
    </form>`;
    const form = $('updatesFilterForm');
    form.addEventListener('change', event => {
      if (event.target.name !== 'category') {
        return;
      }
      const all = form.querySelector('[value="all"]'),
        others = [...form.querySelectorAll('[name="category"]')].filter(input => input !== all);
      if (event.target === all) {
        // All represents no category restriction; do not allow an ambiguous empty selection.
        all.checked = true;
        others.forEach(input => input.checked = false);
      } else {
        all.checked = !others.some(input => input.checked);
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const from = $('filterFrom').value,
        to = $('filterTo').value;
      if (from && to && from > to) {
        $('filterError').textContent = 'The From date must be on or before the To date.';
        $('filterFrom').focus();
        return;
      }
      const cats = [...form.querySelectorAll('[name="category"]:checked')].map(input => input.value).filter(key => key !== 'all');
      navigate({
        ...route,
        view: route.q ? 'search' : 'feed',
        category: 'all',
        id: '',
        cats,
        from,
        to
      }, true);
    });
  }
  async function markRead(item) {
    if (item.read || !['application', 'notification'].includes(item.source) || !item.originalId) {
      return;
    }
    const method = item.source === 'application' ? api.markApplicationUpdateReadAsync : api.markNotificationReadAsync;
    if (!method) {
      return;
    }
    const key = item.source + ':' + item.originalId;
    let request = pendingReads.get(key);
    if (!request) {
      request = Promise.resolve().then(() => method.call(api, item.originalId));
      pendingReads.set(key, request);
    }
    try {
      if ((await request) !== false) {
        completedReads.add(key);
        item.read = true;
        const current = byId.get(item.id);
        if (current) {
          current.read = true;
        }
      }
    } catch {
      toast('The update is open. Its read status could not save.');
    } finally {
      if (pendingReads.get(key) === request) {
        pendingReads.delete(key);
      }
    }
  }
  function relatedRecords(item) {
    const matching = [],
      others = [];
    for (const candidate of records) {
      if (candidate.id === item.id) {
        continue;
      }
      if (candidate.category === item.category) {
        matching.push(candidate);
        if (matching.length === 2) {
          break;
        }
      } else if (others.length < 2) {
        others.push(candidate);
      }
    }
    return matching.concat(others).slice(0, 2);
  }
  function actionLink(item, className = '', arrow = false) {
    if (!item.href) {
      return '';
    }
    const attributes = item.external ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="${className}" href="${esc(item.href)}" ${attributes}>${esc(item.actionLabel)}${arrow ? icon('arrow') : ''}</a>`;
  }
  function renderDetail() {
    const item = byId.get(route.id);
    if (!item) {
      $('updatesContent').innerHTML = empty('Update unavailable', 'This update may have been removed or may not belong to your account.', '<a class="up-button" href="#">Back to Updates</a>');
      return;
    }
    const related = relatedRecords(item);
    const action = actionLink(item, 'up-button', true);
    const keyInformation = item.points.length ? `<section class="up-key-info">
      <h3><span aria-hidden="true">💡</span>Key Information</h3>
      <ul>${item.points.map(point => `<li>${esc(point)}</li>`).join('')}</ul>
    </section>` : '';
    const relatedMarkup = related.length ? `<aside class="up-related">
      <div class="up-related__header"><h2>Related Updates</h2><a href="#">See all${icon('chevron')}</a></div>
      <div class="up-list">${related.map(other => card(other, true)).join('')}</div>
    </aside>` : '';
    $('updatesContent').innerHTML = `<div class="up-detail">
      <article class="up-detail__article up-tone-${item.category}">
        <div class="up-detail__meta">${badge(item)}${stamp(item)}</div>
        <div class="up-detail__heading">
          <h2>${esc(item.title)}</h2>
          ${item.public ? `<button class="up-icon-button" type="button" data-share aria-label="Share update">${icon('share')}</button>` : ''}
        </div>
        ${item.image ? `<img class="up-detail__photo" src="${esc(item.image)}" alt="${esc(item.imageAlt)}" decoding="async" />` : ''}
        <div class="up-detail__copy">${item.message.split(/\n\s*\n/).map(text => `<p>${esc(text)}</p>`).join('')}</div>
        ${keyInformation}
        ${action ? `<div class="up-detail__action">${action}</div>` : ''}
      </article>
      ${relatedMarkup}
    </div>`;
    $('headerAction').innerHTML = `<button class="up-icon-button" type="button" id="updateMenuButton" aria-label="More update options" aria-expanded="false" aria-controls="updateMenu">${icon('more')}</button>
      <div class="up-menu" id="updateMenu" hidden>
        ${item.public ? '<button type="button" data-copy>Copy update link</button>' : ''}
        <a href="#">All updates</a>
        ${actionLink(item)}
      </div>`;
    $('updateMenuButton').addEventListener('click', () => {
      const menu = $('updateMenu'),
        open = menu.hidden;
      menu.hidden = !open;
      $('updateMenuButton').setAttribute('aria-expanded', String(open));
      if (open) {
        menu.querySelector('button,a')?.focus();
      }
    });
    void markRead(item);
  }
  async function share(copyOnly = false) {
    const item = byId.get(route.id);
    if (!item?.public) {
      return;
    }
    // Public links contain no search terms, date filters or private feed context.
    const url = new URL('updates.html', location.href);
    url.hash = hashFor({
      view: 'detail',
      id: item.id
    });
    try {
      if (!copyOnly && navigator.share) {
        await navigator.share({
          title: item.title,
          url: url.href
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.href);
        toast('Update link copied.');
      } else {
        toast('Copy the update link from your browser’s address bar.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast('Could not share. Copy the link from your browser’s address bar.');
      }
    }
    closeMenu();
  }
  function closeMenu() {
    if ($('updateMenu')) {
      $('updateMenu').hidden = true;
      $('updateMenuButton')?.setAttribute('aria-expanded', 'false');
    }
  }
  function renderHeader() {
    const title = route.view === 'category' ? categoryLabel(route.category) : viewTitles[route.view];
    $('updatesTitle').textContent = title;
    document.title = 'Kagie | ' + title;
    $('updatesBack').innerHTML = icon(route.view === 'filters' ? 'close' : 'back');
    $('updatesBack').setAttribute('aria-label', route.view === 'feed' ? 'Back to Home' : route.view === 'filters' ? 'Close filters' : 'Back to Updates');
    $('updatesBack').href = route.view === 'feed' ? 'home.html' : '#';
    $('headerAction').innerHTML = route.view === 'filters' ? '<button type="button" class="up-reset" id="resetFilters">Reset</button>' : route.view === 'category' ? `<a class="up-icon-button" href="${esc(hashFor({
      ...route,
      view: 'search',
      q: ''
    }))}" aria-label="Search updates">${icon('search')}</a>` : '';
  }
  function render() {
    if (!ready) {
      return;
    }
    if (route.view === 'filters' || route.view === 'detail') {
      listSnapshot = null;
    }
    renderHeader();
    if (route.view === 'filters') {
      renderFilters();
      $('resetFilters').addEventListener('click', () => {
        $('updatesFilterForm').reset();
        document.querySelectorAll('[name="category"]').forEach(input => input.checked = input.value === 'all');
        $('filterFrom').value = '';
        $('filterTo').value = '';
        $('filterError').textContent = '';
      });
    } else if (route.view === 'detail') {
      renderDetail();
    } else {
      renderList();
    }
    $('updatesContent').setAttribute('aria-busy', 'false');
  }
  function footerIcons() {
    document.querySelectorAll('.kagie-shared-bottom-nav .bottom-nav-icon').forEach(node => node.innerHTML = icon(node.textContent.trim()));
    document.querySelectorAll('.kagie-shared-bottom-nav [aria-current]').forEach(node => {
      node.classList.remove('active');
      node.removeAttribute('aria-current');
    });
  }
  function cachedFeed(method) {
    return api[method]?.(user.id) || [];
  }
  async function refreshFeed(method) {
    // Calling through an async helper also isolates synchronous API failures.
    return api[method + 'Async'] ? api[method + 'Async'](user.id) : cachedFeed(method);
  }
  async function load() {
    if (loading) {
      return;
    }
    loading = true;
    const retryButtons = [...document.querySelectorAll('[data-retry]')];
    retryButtons.forEach(button => button.disabled = true);
    try {
      // Independent feeds refresh together, without waiting for one before starting another.
      const [applications, notifications] = await Promise.allSettled([refreshFeed('getApplicationUpdates'), refreshFeed('getNotifications')]);
      const base = cachedFeed('getUpdateFeed');
      loadIssues = applications.status === 'rejected' || notifications.status === 'rejected';
      merge(base, applications.status === 'fulfilled' ? applications.value : cachedFeed('getApplicationUpdates'), notifications.status === 'fulfilled' ? notifications.value : cachedFeed('getNotifications'));
      if (ready && ['feed', 'search', 'category'].includes(route.view) && $('updateList')) {
        // Update results in place so refresh cannot remount inputs or reset text selection.
        $('updateLoadStatus').innerHTML = statusBanner();
        listContent();
      } else if (!ready || route.view !== 'filters') {
        ready = true;
        render();
      }
    } catch {
      $('updatesContent').setAttribute('aria-busy', 'false');
      $('updatesContent').innerHTML = empty('Updates could not load', 'Please try again when your connection is ready.', '<button class="up-button" type="button" data-retry>Try Again</button>');
    } finally {
      loading = false;
      retryButtons.forEach(button => button.disabled = false);
    }
  }
  async function main() {
    footerIcons();
    api = window.KagieAPI;
    try {
      if (!api) {
        throw new Error('Updates API unavailable');
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
      // Paint cached guides and notices immediately while remote feeds refresh.
      merge(cachedFeed('getUpdateFeed'), cachedFeed('getApplicationUpdates'), cachedFeed('getNotifications'));
      ready = true;
      render();
      await load();
    } catch {
      $('updatesContent').setAttribute('aria-busy', 'false');
      $('updatesContent').innerHTML = empty('Updates could not start', 'Please reload to reconnect to Kagie.', '<button class="up-button" type="button" data-restart>Try Again</button>');
    }
  }
  $('updatesBack').addEventListener('click', event => {
    if (route.view !== 'feed') {
      event.preventDefault();
      back();
    }
  });
  document.addEventListener('click', event => {
    // Back/close have already handled this click; do not also route their hash links.
    if (event.defaultPrevented) {
      return;
    }
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault();
      navigate(readRoute(new URL(link.href).hash));
      return;
    }
    if (event.target.closest('[data-retry]')) {
      void load();
    }
    if (event.target.closest('[data-restart]')) {
      void main();
    }
    if (event.target.closest('[data-clear-filters]')) {
      navigate({
        view: 'feed',
        id: '',
        category: 'all',
        q: '',
        cats: [],
        from: '',
        to: ''
      });
    }
    if (event.target.closest('[data-share]')) {
      void share();
    }
    if (event.target.closest('[data-copy]')) {
      void share(true);
    }
    if (!event.target.closest('#headerAction')) {
      closeMenu();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('updateMenu') && !$('updateMenu').hidden) {
      closeMenu();
      $('updateMenuButton').focus();
    }
  });
  const restoreRoute = () => {
    if (lastHash === location.hash) {
      return;
    }
    route = readRoute();
    lastHash = location.hash;
    render();
    window.scrollTo(0, history.state?.upScroll || 0);
    $('updatesTitle').focus({
      preventScroll: true
    });
  };
  window.addEventListener('popstate', restoreRoute);
  window.addEventListener('hashchange', restoreRoute);
  // Broken publisher images should never obscure the text or trap the learner.
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('#updatesContent')) {
      event.target.hidden = true;
    }
  }, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main, {
      once: true
    });
  } else {
    void main();
  }
})();
