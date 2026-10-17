(function () {
  'use strict';
  const D = window.KagieStaffData;
  const role = document.body.dataset.staffRole;
  const isMaster = role === 'master_admin';
  const $ = id => document.getElementById(id);
  const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const money = value => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(value || 0));
  const initials = value => String(value || 'Kagie').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const safeUrl = value => { if (!String(value || '').trim()) return ''; try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  const state = { actor: null, data: {}, errors: {}, page: '', ticket: null, query: '', filter: '', tablePage: 1, loading: false, conversationRequest: 0 };
  const serviceTypes = [
    ['applications', 'View application forms', 'Open assigned applications and review their documents', true],
    ['support', 'Support & messages', 'Reply to assigned learners and manage callbacks', true],
    ['updates', 'Post learner updates', 'Send progress updates to learner dashboards', true],
    ['institutions', 'Institution controls', 'Edit institution dates, fees, and visibility', false],
    ['accommodation', 'Accommodation service', 'Manage assigned requests and submit listing drafts', true],
    ['cv', 'CV Revamp service', 'Review CVs and deliver revised files', true],
    ['jobs', 'Jobs & opportunities', 'Create job and internship drafts', true],
    ['publish_jobs', 'Publish opportunities directly', 'Publish your own opportunities without Master approval', false]
  ];
  const pageServices = { applications: 'applications', assigned: 'applications', documents: 'applications', messages: 'support', callbacks: 'support', updates: 'updates', accommodation: 'accommodation', cv: 'cv', jobs: 'jobs', institutions: 'institutions' };
  serviceTypes.push(...[['housing_create','Create housing drafts'],['housing_edit','Edit own or assigned housing'],['housing_availability','Update housing availability'],['housing_requests','Handle housing requests'],['housing_publish','Publish housing'],['cv_edit','Edit assigned CVs'],['cv_message','Message CV learners'],['cv_upload','Upload final CVs'],['cv_review','Mark CV ready for review'],['cv_complete','Complete CV requests'],['jobs_create','Create job drafts'],['jobs_edit','Edit own job drafts'],['jobs_submit','Submit jobs for approval'],['jobs_unpublish','Unpublish own jobs']].map(([key,label])=>[key,label,'Requires the corresponding service grant',!['housing_publish','jobs_unpublish'].includes(key)]));
  // Local outline icons keep staff navigation independent of font downloads.
  const iconPaths = {
    '▦':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    '▣':'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 3h6v4H9zM8 12h8M8 16h6"/>',
    '♙':'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    'F':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/>',
    'R':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h3"/>',
    '▤':'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',
    '✉':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    '☎':'<path d="m7 3 3 4-2 3a14 14 0 0 0 6 6l3-2 4 3v3c-9 3-20-8-17-17z"/>',
    '⌂':'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
    '▧':'<path d="M6 3h8l4 4v14H6zM14 3v5h4"/><circle cx="12" cy="12" r="2"/><path d="M9 18c0-3 6-3 6 0"/>',
    '▰':'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
    '✦':'<path d="M4 5h16v12H4zM8 9h8M8 13h5M8 17v4l4-4"/>',
    '↻':'<path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/>',
    '♡':'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    '●':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6 19c0-7 12-7 12 0"/>',
    '◷':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const staffIcon = value => '<svg class="staff-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (iconPaths[value] || iconPaths['▤']) + '</svg>';
  const nav = isMaster ? [
    ['Operations', [['overview', 'Dashboard', '▦'], ['applications', 'All Applications', '▣'], ['learners', 'Learners', '♙'], ['assistants', 'Assistants & Access', 'F'], ['payments', 'Payments', 'R'], ['documents', 'Document Review', '▤'], ['messages', 'Support Inbox', '✉'], ['callbacks', 'Callback Requests', '☎']]],
    ['Services', [['accommodation', 'Accommodation', '⌂'], ['cv', 'CV Revamp', '▧'], ['jobs', 'Jobs & Opportunities', '▰']]],
    ['Content', [['institutions', 'Institutions', '✦'], ['career', 'Career Hub Resources', '▤'], ['papers', 'Question Papers', '▤'], ['announcements', 'Announcements', '✦'], ['updates', 'Learner Updates', '✦'], ['management', 'Service Content', '✦']]],
    ['Administration', [['users', 'Users & Roles', '♙'], ['audit', 'Activity & Audit', '↻'], ['health', 'System Health', '♡'], ['more', 'My Account', '●']]]
  ] : [
    ['Work', [['overview', 'Dashboard', '▦'], ['assigned', 'My Applications', '▣'], ['learners', 'My Learners', '♙'], ['documents', 'Document Review', '▤'], ['messages', 'Support Inbox', '✉'], ['callbacks', 'Callback Requests', '☎']]],
    ['Services', [['accommodation', 'Accommodation', '⌂'], ['cv', 'CV Revamp', '▧'], ['jobs', 'Jobs & Opportunities', '▰'], ['institutions', 'Institution Controls', '✦']]],
    ['Account', [['announcements', 'Announcements', '✦'], ['activity', 'My Activity', '↻'], ['forms', 'Form Access', 'F'], ['updates', 'Post Updates', '✦'], ['more', 'My Account', '●']]]
  ];
  const labels = Object.fromEntries(nav.flatMap(([, items]) => items.map(([id, label]) => [id, label])));
  const titles = { overview: isMaster ? 'Control center' : 'Assigned workspace', ...labels };
  titles.overview = isMaster ? 'Control center' : 'Assigned workspace';
  const queuePage = isMaster ? 'applications' : 'assigned';
  const rows = table => state.data[table] || [];
  const can = key => { if(isMaster)return true;if(state.errors.assistant_service_permissions)return false; const enabled=(rows('assistant_service_permissions').find(row=>row.assistant_admin_id===state.actor?.id&&row.service_key===key)?.enabled??serviceTypes.find(item=>item[0]===key)?.[3])===true;const parent=key==='publish_jobs'?'jobs':key.startsWith('housing_')?'accommodation':key.startsWith('cv_')?'cv':key.startsWith('jobs_')?'jobs':key;return enabled&&(parent===key||can(parent)); };
  const profile = id => rows('profiles').find(user => user.id === id) || {};
  const person = id => profile(id).full_name || 'Learner';
  const appName = app => person(app.user_id) || app.application_payload?.forms?.personal?.fullNames || 'Learner';
  const ref = app => app.application_reference || `APP-${String(app.id).slice(0, 8).toUpperCase()}`;
  const type = app => {const value=String(app.application_type||app.application_payload?.applicationType||'undergraduate').toLowerCase().replace(/[\s-]+/g,'_');return ({undergrad:'undergraduate',post_graduate:'postgraduate',post_grad:'postgraduate',late_application:'late'})[value]||value;};
  const typeLabel = value => ({ undergraduate: 'Undergraduate', undergrad: 'Undergraduate', bridging: 'Bridging', transfer: 'Transfer', postgraduate: 'Postgraduate', late: 'Late' }[value] || value);
  const working = app => !['Accepted', 'Rejected', 'Cancelled', 'Applied', 'Pending Feedback'].includes(app.status);
  const chip = (value, color) => `<span class="chip ${color || (/approved|verified|published|resolved|accepted|active/i.test(value) ? 'green' : /rejected|missing|closed/i.test(value) ? 'red' : 'amber')}">${e(value || 'Pending')}</span>`;
  const button = (label, action, id = '', css = 'row-btn') => `<button class="${css}" data-action="${action}" data-id="${e(id)}">${e(label)}</button>`;
  const goto = (label, page, css = 'btn secondary') => `<button class="${css}" data-page="${page}">${e(label)}</button>`;
  const empty = message => `<div class="empty-state"><span class="empty-icon">◇</span><p>${e(message)}</p></div>`;
  const head = (title, subtitle, actions = '') => `<div class="section-head"><div><h3>${e(title)}</h3><p>${e(subtitle)}</p></div><div class="toolbar-row">${actions}</div></div>`;
  const panel = (title, body, actions = '') => `<div class="panel"><div class="panel-head"><h4>${e(title)}</h4>${actions}</div><div class="panel-body">${body}</div></div>`;
  const errorBox = table => state.errors[table] ? `<div class="notice error-notice" role="alert"><strong>Could not load this section.</strong><p>${e(state.errors[table])}</p>${button('Try again', 'reload', '', 'btn secondary')}</div>` : '';
  const count = (table, predicate = () => true) => state.errors[table] ? '—' : rows(table).filter(predicate).length;
  const appLink = app => `/${isMaster ? 'master-admin/application-view.html' : 'assistant/applicant-view.html'}?id=${encodeURIComponent(app.id)}`;
  function toast(message, error = false) {
    $('toast').textContent = message;
    $('toast').classList.toggle('error', error);
    $('toast').classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $('toast').classList.remove('show'), error ? 7000 : 4000);
  }
  function navigation() {
    const items = nav.map(([group, pages]) => `<div class="nav-label">${group}</div><nav class="nav" aria-label="${group}">${pages.map(([id, label, icon]) => `<button class="nav-btn" data-page="${id}"><span class="nav-icon" aria-hidden="true">${staffIcon(icon)}</span>${label}<span class="count" data-count="${id}" hidden></span></button>`).join('')}</nav>`).join('');
    $('staffNavigation').innerHTML = items;
    $('mobilePages').innerHTML = nav.flatMap(([, pages]) => pages.map(([id, label, icon]) => `<button class="setting" data-page="${id}"><span class="nav-icon">${staffIcon(icon)}</span><strong>${label}</strong><span class="arrow">→</span></button>`)).join('');
    document.querySelectorAll('[data-role-label]').forEach(el => { el.textContent = isMaster ? 'Master Admin' : 'Assistant Admin'; });
  }
  function applyBadges() {
    const values = { assigned: count('applications'), applications: count('applications'), documents: count('documents', doc => doc.status === 'Pending Review'), messages: count('support_threads', ticket => ['open', 'in_progress'].includes(ticket.status)), callbacks: count('callback_requests', call => call.status === 'Pending'), payments: count('applications', app => ['Pending Verification', 'Payment Pending', 'Pending'].includes(app.payment_status)), cv: count('cv_requests', request => request.status !== 'Completed') };
    document.querySelectorAll('[data-count]').forEach(el => { const value = values[el.dataset.count]; el.textContent = value ?? ''; el.hidden = !value || value === '—'; });
  }
  async function loadAll() {
    if (state.loading) return;
    state.loading = true;
    $('refreshButton').disabled = true;
    $('connectionState').textContent = 'Loading live records…';
    const tables = ['profiles', 'applications', 'application_form_types', 'assistant_form_permissions', 'assistant_service_permissions', 'cv_requests', 'documents', 'support_threads', 'callback_requests', 'accommodation_requests', 'housing_listings', 'career_articles', 'application_updates', 'assistant_activity', 'announcements', 'notifications', 'institutions'];
    if (isMaster) tables.push('question_papers', 'admin_content');
    const results = await Promise.allSettled(tables.map(table => {
      const filters = table === 'notifications' ? { user_id: state.actor.id } : ['assistant_form_permissions', 'assistant_service_permissions'].includes(table) && !isMaster ? { assistant_admin_id: state.actor.id } : table === 'assistant_activity' && !isMaster ? { assistant_id: state.actor.id } : {};
      const order = table === 'application_form_types' ? 'display_order' : ['assistant_form_permissions', 'assistant_service_permissions'].includes(table) ? 'updated_at' : 'created_at';
      return D.list(table, filters, order, table === 'profiles' ? 'id,full_name,email,phone,role,profile_image,created_at' : '*');
    }));
    results.forEach((result, index) => {
      const table = tables[index];
      if (result.status === 'fulfilled') { state.data[table] = result.value; delete state.errors[table]; }
      else { state.data[table] = []; state.errors[table] = result.reason.message; }
    });
    if (!isMaster) {
      const access = new Map(rows('assistant_form_permissions').map(item => [item.form_type, item.enabled]));
      if (state.errors.assistant_form_permissions || state.errors.application_form_types) {
        state.data.applications = [];
        state.errors.applications = 'Your form access could not be confirmed. Refresh or ask Master Admin to check the permission setup.';
      } else {
        state.data.applications = rows('applications').filter(app => access.get(type(app) === 'undergrad' ? 'undergraduate' : type(app)) !== false);
      }
      const learners = new Set(rows('profiles').filter(user => user.role === 'user').map(user => user.id));
      const appIds = new Set(rows('applications').map(app => app.id));
      ['documents', 'support_threads', 'accommodation_requests', 'application_updates'].forEach(table => {
        state.data[table] = rows(table).filter(row => learners.has(row.user_id) && (!row.application_id || appIds.has(row.application_id) || /^cv/.test(row.document_type || '')));
      });
      state.data.career_articles = rows('career_articles').filter(row => row.status === 'published' || row.created_by === state.actor.id);
      state.data.housing_listings = rows('housing_listings').filter(row => row.listing_state === 'published' || row.created_by === state.actor.id || row.assigned_assistant_id === state.actor.id);
      state.data.announcements = rows('announcements').filter(row => row.status === 'active' && ['all', 'assistants'].includes(row.audience) && (!row.scheduled_for || Date.parse(row.scheduled_for) <= Date.now()));
      if (!can('applications')) state.data.applications = [];
      state.data.documents = rows('documents').filter(doc => can(/^cv/.test(doc.document_type) ? 'cv' : 'applications'));
      if (!can('support')) { state.data.support_threads = []; state.data.callback_requests = []; }
      if (!can('updates')) state.data.application_updates = [];
      if (!can('accommodation')) { state.data.accommodation_requests = []; state.data.housing_listings = []; }
      if (!can('jobs')) state.data.career_articles = rows('career_articles').filter(row => !['job', 'internship'].includes(row.content_type));
    }
    state.loading = false;
    $('refreshButton').disabled = false;
    const failed = Object.keys(state.errors).length;
    $('connectionState').textContent = failed ? `${failed} section${failed === 1 ? '' : 's'} need attention` : `Live records · refreshed ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
    applyBadges();
    document.querySelectorAll('[data-page="institutions"]').forEach(el => { el.hidden = !can('institutions'); });
    render();
  }
  function pageFromLocation() {
    const value = new URL(location.href).searchParams.get('page') || 'overview';
    const aliases = { queue: queuePage, assigned: queuePage, applications: queuePage, activity: isMaster ? 'audit' : 'activity' };
    return labels[aliases[value] || value] ? aliases[value] || value : 'overview';
  }
  function goPage(page, push = true) {
    if (!labels[page]) page = 'overview';
    state.page = page; state.query = ''; state.filter = ''; state.tablePage = 1; state.ticket = null;
    if (push) { const url = new URL(location.href); url.search=''; url.searchParams.set('page', page); history.pushState({}, '', url); }
    restoreViewState();
    closeMenu(); render(); window.scrollTo(0, 0);
  }
  function restoreViewState() {const p=new URL(location.href).searchParams;state.query=p.get('q')||'';state.filter=p.get('status')||'';state.tablePage=Math.max(1,Number(p.get('p'))||1);state.ticket=p.get('ticket');}
  function persistViewState(push=false) {const url=new URL(location.href);[['q',state.query],['status',state.filter],['p',state.tablePage>1?state.tablePage:''],['ticket',state.ticket]].forEach(([key,value])=>value?url.searchParams.set(key,value):url.searchParams.delete(key));history[push?'pushState':'replaceState']({},'',url);}
  function filtered(data, statusOf = row => row.status) {
    const search = state.query.toLowerCase();
    return data.filter(row => (!state.filter || statusOf(row) === state.filter) && (!search || [row.title, row.full_name, row.email, row.phone, row.file_name, row.subject, row.message, row.company, row.location, row.city, row.property_name, row.application_reference, row.institution_choice_1, row.programme_choice, person(row.user_id)].filter(Boolean).join(' ').toLowerCase().includes(search)));
  }
  function tools(placeholder, options = []) {
    return `<div class="table-tools"><input class="search" id="recordSearch" type="search" aria-label="${e(placeholder)}" placeholder="${e(placeholder)}" value="${e(state.query)}"><select class="select" id="recordFilter" aria-label="Filter records"><option value="">All statuses</option>${[...new Set(options.filter(Boolean))].map(value => `<option ${state.filter === value ? 'selected' : ''}>${e(value)}</option>`).join('')}</select></div>`;
  }
  function paginated(data, headers, renderRow) {
    const totalPages = Math.max(1, Math.ceil(data.length / 10));
    state.tablePage = Math.min(state.tablePage, totalPages);
    const selected = data.slice((state.tablePage - 1) * 10, state.tablePage * 10);
    return `<div class="table-row header">${headers.map(value => `<div>${e(value)}</div>`).join('')}</div>${selected.map(renderRow).join('') || empty('No records match this view.')}<div class="pagination"><span>${data.length} record${data.length === 1 ? '' : 's'} · Page ${state.tablePage} of ${totalPages}</span>${button('Previous', 'previous')}${button('Next', 'next')}</div>`;
  }
  function applicationRow(app) {
    return `<div class="table-row"><div class="cell-main"><strong>${e(appName(app))}</strong><small>${e(ref(app))} · ${e(typeLabel(type(app)))}</small></div><div class="cell-main"><strong>${e(app.institution_choice_1 || 'Institution pending')}</strong><small>${e(app.programme_choice || '')}</small></div><div>${chip(app.status)}<small class="mobile-summary">${e(app.institution_choice_1 || '')}</small></div><div>${isMaster ? e(profile(app.assistant_id).full_name || 'Unassigned') : date(app.updated_at)}</div><div class="row-actions"><a class="row-btn" href="${appLink(app)}">Open</a>${isMaster ? button('Assign', 'assign', app.id) : ''}</div></div>`;
  }
  function overview() {
    const stats = isMaster ? [[count('applications'), 'Total applications', 'red', '▣'], [count('applications', app => ['Pending Verification', 'Payment Pending', 'Pending'].includes(app.payment_status)), 'Payments to verify', 'amber', 'R'], [count('support_threads', ticket => ['open', 'in_progress'].includes(ticket.status)), 'Support requests', 'blue', '✉'], [count('profiles', user => user.role === 'assistant_admin'), 'Assistant admins', 'green', 'F']] : [[count('applications'), 'Assigned applications', 'red', '▣'], [count('applications', working), 'Applications in progress', 'amber', '◷'], [count('support_threads', ticket => ['open', 'in_progress'].includes(ticket.status)), 'Support requests', 'blue', '✉'], [state.errors.assistant_form_permissions ? '—' : formAccess(state.actor.id).filter(item => item.enabled).length, 'Form types enabled', 'green', 'F']];
    return `<div class="hero"><div class="hero-copy"><div class="eyebrow">${isMaster ? 'MASTER ADMIN WORKSPACE' : 'ASSISTANT WORKSPACE'}</div><h2>Welcome back, ${e(state.actor.full_name.split(' ')[0])}.</h2><p>${isMaster ? 'Manage applications, support learners, and keep your team moving.' : 'Your assigned learners, application forms, and support work in one place.'}</p></div><div class="hero-actions">${goto(isMaster ? 'Review applications' : 'Open my queue', queuePage, 'btn primary')}${goto('Messages', 'messages')}</div></div>${errorBox('applications')}${head(isMaster ? 'Platform overview' : 'My work today', 'Current records from Kagie')}<div class="stats">${stats.map(([value, label, color, icon]) => `<div class="stat"><div class="stat-top"><div class="stat-icon ${color}" aria-hidden="true">${staffIcon(icon)}</div>${chip(isMaster ? 'Platform' : 'Mine', color)}</div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>${head('Quick actions', 'Go straight to the work that needs you')}<div class="quick-grid">${[[queuePage, 'My queue', 'Review learner applications', 'red', '▣'], ['messages', 'Messages', 'Reply to learner support', 'blue', '✉'], [isMaster ? 'assistants' : 'forms', isMaster ? 'Assistant access' : 'Form access', 'Review form permissions', 'green', 'F'], [isMaster ? 'payments' : 'updates', isMaster ? 'Payments' : 'Post update', isMaster ? 'Verify pending payments' : 'Send a learner-visible update', 'purple', '✦']].map(([page, label, text, color, icon]) => `<button class="quick" data-page="${page}"><div class="quick-icon ${color}">${staffIcon(icon)}</div><div><strong>${label}</strong><span>${text}</span></div></button>`).join('')}</div>${head('Services', 'Accommodation, career support, and opportunities')}<div class="service-strip">${[['accommodation', '⌂', 'Accommodation', 'Help learners find a place to stay', count('accommodation_requests') + ' requests'], ['cv', '▧', 'CV Revamp', 'Review original CVs and deliver revised files', count('documents', doc => doc.document_type === 'cv') + ' CVs'], ['jobs', '▰', 'Jobs & Opportunities', 'Create drafts and review published opportunities', count('career_articles', row => ['job', 'internship'].includes(row.content_type)) + ' opportunities']].map(([page, icon, label, text, metric]) => `<button class="service-tile" data-page="${page}"><span class="service-icon red">${staffIcon(icon)}</span><h4>${label}</h4><p>${text}</p><div class="service-meta">${chip(metric, 'blue')}</div></button>`).join('')}</div>${head('Applications needing attention', 'Open the full learner workspace', goto('View all', queuePage, 'link-btn'))}<div class="grid-2">${panel('Application queue', rows('applications').filter(working).slice(0, 5).map(app => `<div class="row"><div class="mini-avatar">${e(initials(appName(app)))}</div><div class="row-main"><strong>${e(appName(app))}</strong><small>${e(ref(app))} · ${e(app.status)}</small></div><a class="row-btn" href="${appLink(app)}">Open</a></div>`).join('') || empty('No applications need attention.'))}${panel(isMaster ? 'Team & access' : 'Access summary', isMaster ? `<p class="body-copy">${count('profiles', user => user.role === 'assistant_admin')} assistant admins. Manage assignments and grant access to application forms.</p>${goto('Manage assistants', 'assistants', 'btn primary')}` : permissionCards(formAccess(state.actor.id), true))}</div>`;
  }
  function applications() {
    const data = filtered(rows('applications'));
    return head(labels[state.page], 'Open an application to view forms, documents, notes, and institution submissions.', button('Export CSV', 'export-apps', '', 'btn secondary')) + errorBox('applications') + `<div class="table-card">${tools('Search learner, reference, institution…', rows('applications').map(app => app.status))}${paginated(data, ['Learner / Form', 'Institution', 'Status', isMaster ? 'Assistant' : 'Updated', 'Actions'], applicationRow)}</div>`;
  }
  function learners(users = false) {
    const data = filtered(rows('profiles').filter(user => users || user.role === 'user'), row => row.role);
    return head(users ? 'Users & Roles' : labels.learners, users ? 'Account directory and staff responsibilities. Staff creation is managed through Assistants & Access.' : 'Each learner appears once, including learners with multiple applications.', users ? goto('Manage staff', 'assistants') : '') + errorBox('profiles') + `<div class="table-card">${tools('Search name, email, phone…', users ? ['user', 'assistant_admin', 'master_admin'] : [])}${paginated(data, ['Learner', 'Email', 'Phone', users ? 'Role' : 'Applications', 'Actions'], user => `<div class="table-row"><div class="cell-main"><strong>${e(user.full_name || 'Unnamed account')}</strong><small>${users ? e(user.role.replace(/_/g, ' ')) : rows('applications').filter(app => app.user_id === user.id).length + ' applications'}</small></div><div>${e(user.email)}</div><div>${e(user.phone || '—')}</div><div>${users ? chip(user.role.replace(/_/g, ' '), 'blue') : rows('applications').filter(app => app.user_id === user.id).length}</div><div>${button('Open', 'learner', user.id)}</div></div>`)}</div>`;
  }
  function formAccess(id) {
    const saved = new Map(rows('assistant_form_permissions').filter(item => item.assistant_admin_id === id).map(item => [item.form_type, item.enabled]));
    return rows('application_form_types').filter(item => item.is_active !== false).sort((a, b) => a.display_order - b.display_order).map(item => ({ ...item, enabled: saved.has(item.form_type) ? saved.get(item.form_type) : true }));
  }
  function permissionCards(items, readOnly = false) {
    return `<div class="permission-grid">${items.map(item => `<label class="permission"><div class="nav-icon">${staffIcon('F')}</div><div><strong>${e(item.label || typeLabel(item.form_type))}</strong><small>${item.enabled ? 'Enabled' : 'Locked by Master Admin'}</small></div>${readOnly ? chip(item.enabled ? 'Enabled' : 'Locked', item.enabled ? 'green' : 'red') : `<input type="checkbox" class="access-check" name="access-${e(item.form_type)}" ${item.enabled ? 'checked' : ''} aria-label="${e(item.label)}">`}</label>`).join('')}</div>`;
  }
  function assistants() {
    return head('Assistants & Access', 'Create assistant accounts, review their workloads, and grant form access.', button('Create assistant', 'create-assistant', '', 'btn primary')) + errorBox('profiles') + errorBox('assistant_form_permissions') + `<div class="cards-3">${rows('profiles').filter(user => user.role === 'assistant_admin').map(user => `<div class="module"><div class="module-top"><div class="module-icon red">${e(initials(user.full_name))}</div>${chip('Assistant', 'red')}</div><h4>${e(user.full_name)}</h4><p>${e(user.email)}<br>${e(user.phone || '')}</p><div class="module-footer"><span class="body-copy">${rows('applications').filter(app => app.assistant_id === user.id).length} assigned applications</span>${button('Form access', 'access', user.id) + button('Service access', 'service-access', user.id)}</div></div>`).join('') || empty('No assistant accounts were found.')}</div>`;
  }
  function payments() {
    const data = filtered(rows('applications').filter(app => app.payment_reference || app.payment_status !== 'Unpaid' && app.payment_status), row => row.payment_status);
    return head('Payment verification', 'Review proof, references, and amounts before confirming payment.') + errorBox('applications') + `<div class="table-card">${tools('Search learner or reference…', data.map(app => app.payment_status))}${paginated(data, ['Learner', 'Payment', 'Status', 'Amount', 'Actions'], app => `<div class="table-row"><div class="cell-main"><strong>${e(appName(app))}</strong><small>${e(ref(app))}</small></div><div class="cell-main"><strong>${e(app.payment_reference || 'No reference')}</strong><small>${e(app.payment_method || 'Payment method pending')}</small></div><div>${chip(app.payment_status)}</div><div>${money(app.payment_amount || app.final_total)}</div><div>${button('Review', 'payment', app.id)}</div></div>`)}</div>`;
  }
  function documents(cv = false) {
    const all = rows('documents').filter(doc => cv ? /^cv/.test(doc.document_type) : !/^cv/.test(doc.document_type));
    const data = filtered(all);
    return head(cv ? 'CV Revamp workspace' : 'Document review', cv ? 'Review uploaded CVs, save feedback, and return revised files to learners.' : 'Approve documents or explain what the learner needs to replace.') + errorBox('documents') + `<div class="table-card">${tools(cv ? 'Search learner or CV filename…' : 'Search learner or document…', all.map(doc => doc.status))}${paginated(data, ['Learner', 'Document', 'Status', 'Uploaded', 'Actions'], doc => `<div class="table-row"><div class="cell-main"><strong>${e(person(doc.user_id))}</strong><small>${e(doc.document_type)}</small></div><div class="cell-main"><strong>${e(doc.file_name)}</strong><small>${date(doc.created_at)}</small></div><div>${chip(doc.status)}</div><div>${date(doc.created_at)}</div><div>${button(cv ? 'Open CV' : 'Review', cv ? 'cv' : 'document', doc.id)}</div></div>`)}</div>${cv ? head('Career support requests', 'CV conversations from the learner Career Hub') + rows('support_threads').filter(ticket => /cv|career/i.test(ticket.subject + ' ' + ticket.category)).map(ticket => `<div class="row"><div class="row-main"><strong>${e(ticket.subject)}</strong><small>${e(person(ticket.user_id))} · ${e(ticket.status)}</small></div>${button('Open conversation', 'open-ticket', ticket.id)}</div>`).join('') : ''}`;
  }
  function callbacks() {
    const data = filtered(rows('callback_requests'));
    return head('Callback requests', 'Contact the learner, record your follow-up, then resolve the request.') + errorBox('callback_requests') + `<div class="table-card">${tools('Search learner, phone, or reason…', ['Pending', 'Contacted', 'Resolved'])}${paginated(data, ['Learner', 'Phone / Time', 'Reason', 'Status', 'Actions'], call => `<div class="table-row"><div class="cell-main"><strong>${e(person(call.user_id))}</strong><small>${date(call.created_at)}</small></div><div>${e(call.phone)}<small>${e(call.preferred_time)}</small></div><div>${e(call.note)}</div><div>${chip(call.status)}</div><div>${button('Manage', 'callback', call.id)}</div></div>`)}</div>`;
  }
  function messages() {
    const data = filtered(rows('support_threads'));
    const ticket = rows('support_threads').find(item => item.id === state.ticket);
    return head('Support inbox', 'Replies are delivered to the learner’s support conversation.') + errorBox('support_threads') + tools('Search learner or subject…', ['open', 'in_progress', 'awaiting_user', 'resolved', 'closed']) + `<div class="grid-2 inbox-layout"><div class="panel"><div class="panel-body list">${data.map(item => `<button class="row ticket-row ${item.id === state.ticket ? 'selected' : ''}" data-action="ticket" data-id="${e(item.id)}"><div class="mini-avatar">${e(initials(person(item.user_id)))}</div><div class="row-main"><strong>${e(item.subject || 'Support request')}</strong><small>${e(person(item.user_id))} · ${e(item.category || 'General')}</small></div>${chip(item.status)}</button>`).join('') || empty('No support requests match this view.')}</div></div><div class="panel chat" id="conversation">${ticket ? `<div class="panel-head"><div><h4>${e(ticket.subject)}</h4><p>${e(person(ticket.user_id))}</p></div>${button('Status', 'ticket-status', ticket.id)}</div><div class="messages" id="messageBox"><p class="body-copy">Loading conversation…</p></div><form class="chat-input" id="replyForm"><input id="chatInput" aria-label="Reply to learner" placeholder="Type a reply…" maxlength="5000" required><button class="btn primary" type="submit">Send</button></form>` : empty('Choose a support request to read the conversation.')}</div></div>`;
  }
  async function loadConversation(ticketId) {
    const request = ++state.conversationRequest;
    try {
      const messages = await D.list('support_messages', { thread_id: ticketId }, 'created_at');
      if (state.ticket !== ticketId || state.page !== 'messages' || request !== state.conversationRequest) return;
      $('messageBox').innerHTML = messages.reverse().map(message => `<div class="bubble ${message.sender_role === 'user' ? 'them' : 'me'}"><strong>${e(message.sender_role === 'user' ? person(rows('support_threads').find(ticket => ticket.id === ticketId)?.user_id) : 'Kagie Support')}</strong><p>${e(message.message)}</p><small>${date(message.created_at)}${message.is_internal ? ' · Internal note' : ''}</small></div>`).join('') || empty('There are no messages in this conversation yet.');
      $('messageBox').scrollTop = $('messageBox').scrollHeight;
    } catch (error) { if (state.ticket === ticketId && request === state.conversationRequest && $('messageBox')) $('messageBox').innerHTML = `<p role="alert">${e(error.message)}</p>`; }
  }
  function contentCards(table, subtype = '') {
    const housing=table==='housing_listings',statusOf=row=>housing?row.listing_state:row.approval_state==='submitted'&&row.status==='draft'?'submitted':row.status;
    const data=filtered(rows(table).filter(row=>!subtype||(subtype==='jobs'?['job','internship'].includes(row.content_type):['article','resource'].includes(row.content_type))),statusOf);
    return errorBox(table)+tools(housing?'Search property or location…':'Search title, company, or location…',housing?['draft','published','archived']:['draft','submitted','published','archived'])+'<div class="cards-3">'+data.map(row=>{
      const editable=isMaster||(housing?(row.created_by===state.actor.id||row.assigned_assistant_id===state.actor.id)&&can('housing_edit'):row.created_by===state.actor.id&&row.approval_state!=='submitted'&&(row.status==='draft'||can('publish_jobs'))&&can('jobs_edit'));
      return '<article class="job-card">'+((housing?row.images?.[0]:row.image_url)?'<img class="listing-image" data-storage-image="'+e(housing?row.images[0]:row.image_url)+'" alt="'+e(row.title)+'" loading="lazy">':'')+'<div class="job-card-content"><h4>'+e(row.title)+'</h4><p>'+e(housing?[row.city,row.province].filter(Boolean).join(', '):[row.company,row.location].filter(Boolean).join(' · '))+'</p>'+chip(statusOf(row)==='submitted'?'Submitted for approval':statusOf(row))+'<p class="body-copy">'+e(row.short_description||row.summary)+'</p><p>'+e(housing?money(row.price)+' / month':row.content_type)+'</p>'+(row.closing_date?'<p>Closes '+date(row.closing_date)+'</p>':'')+(row.expires_at?'<p>Expires '+date(row.expires_at)+'</p>':'')+'<div class="job-actions">'+button('Preview',housing?'preview-housing':'preview-career',row.id)+(editable?button('Edit',housing?'edit-housing':'edit-career',row.id):'')+(isMaster&&(row.status||row.listing_state)==='draft'?button('Review & publish',housing?'publish-housing':'publish-career',row.id):'')+(row.status==='published'&&(isMaster||row.created_by===state.actor.id&&can('jobs_unpublish'))?button('Unpublish','unpublish-career',row.id):'')+(isMaster&&(row.status||row.listing_state)!=='archived'?button('Archive',housing?'archive-housing':'archive-career',row.id):'')+'</div></div></article>';
    }).join('')+'</div>';
  }
  function accommodation() {
    const params=new URL(location.href).searchParams,view=params.get('view')||'overview';
    const views=[['overview','Overview'],['listings','Listings'],['review','Pending review'],['availability','Availability'],['providers','Providers & landlords'],['requests','Learner requests']];
    const tabs='<nav class="workspace-tabs" aria-label="Accommodation areas">'+views.map(([key,label])=>'<a class="'+(view===key?'active':'')+'" href="?page=accommodation&view='+key+'">'+label+'</a>').join('')+'</nav>';
    const requests=rows('accommodation_requests'),listings=rows('housing_listings');let body='';
    if(view==='overview')body=panel('Housing workload','<p>'+requests.length+' learner requests · '+listings.filter(r=>r.listing_state==='draft').length+' drafts awaiting review · '+listings.filter(r=>r.availability_status==='Available').length+' available properties</p>');
    if(['listings','review','overview'].includes(view))body+=contentCards('housing_listings');
    if(view==='availability')body=panel('Property availability',listings.map(r=>'<div class="row"><div class="row-main"><strong>'+e(r.title)+'</strong><small>'+e(r.city)+' · '+e(r.availability_status)+'</small></div>'+((isMaster||(r.created_by===state.actor.id||r.assigned_assistant_id===state.actor.id)&&can('housing_availability'))?button('Update','housing-availability',r.id):'')+'</div>').join('')||empty('No listings available.'));
    if(view==='providers'){const providers=[...new Map(listings.filter(r=>r.contact_email||r.contact_phone).map(r=>[(r.contact_email||r.contact_phone),r])).values()];body=panel('Provider contacts',providers.map(r=>'<div class="row"><div class="row-main"><strong>'+e(r.contact_email||r.contact_phone)+'</strong><small>'+e(r.contact_phone)+' · '+e(r.title)+'</small></div></div>').join('')||empty('No provider contacts saved.'))+'<p class="body-copy">Manage provider contact details by editing the related listing.</p>';}
    if(view==='requests')body=errorBox('accommodation_requests')+panel('Learner housing requests',requests.map(r=>'<div class="row"><div class="row-main"><strong>'+e(r.learner_name||person(r.user_id))+'</strong><small>'+e(r.property_name)+' · '+e(r.status)+'</small></div>'+(can('housing_requests')?button('Open request','housing-request',r.id):'')+'</div>').join('')||empty('No housing requests available.'));
    if(view==='review')body=panel('Pending listing review',listings.filter(r=>r.listing_state==='draft').map(r=>'<div class="row"><div class="row-main"><strong>'+e(r.title)+'</strong><small>'+e(profile(r.created_by).full_name||'Staff')+'</small></div>'+button(isMaster?'Review':'Edit draft',isMaster?'publish-housing':'edit-housing',r.id)+'</div>').join('')||empty('No drafts awaiting review.'));
    return head('Accommodation workspace','Listings, availability, providers and learner requests.',can('housing_create')?button('Add listing','new-housing','','btn primary'):'')+tabs+body;
  }
  function announcements() {
    return head('Announcements', isMaster ? 'Manage the notices learners and assistants see.' : 'Active notices for the assistant team.', isMaster ? button('New announcement', 'new-announcement', '', 'btn primary') : '') + errorBox('announcements') + `<div class="cards-3">${rows('announcements').map(row => `<div class="module"><div class="module-top">${chip(row.priority || 'normal', 'blue')}${chip(row.status)}</div><h4>${e(row.title)}</h4><p class="pre-wrap">${e(row.message)}</p><div class="module-footer"><small>${e(row.audience)} · ${date(row.scheduled_for || row.created_at)}</small>${isMaster ? button('Edit', 'edit-announcement', row.id) : ''}</div></div>`).join('') || empty('No announcements are available.')}</div>`;
  }
  function updates() {
    return head('Learner updates', 'Application progress messages appear on the learner’s dashboard.', button('Post update', 'new-update', '', 'btn primary')) + errorBox('application_updates') + `<div class="list">${rows('application_updates').map(row => `<div class="module"><div class="module-top"><h4>${e(row.title)}</h4>${chip(row.status, 'blue')}</div><p class="pre-wrap">${e(row.message)}</p><small>${e(person(row.user_id))} · ${date(row.created_at)}</small></div>`).join('') || empty('No learner updates have been posted.')}</div>`;
  }
  function audit() {
    return head(isMaster ? 'Activity & Audit' : 'My activity', 'Recorded staff actions, newest first.') + errorBox('assistant_activity') + `<div class="list">${rows('assistant_activity').map(row => `<div class="row"><div class="mini-avatar">↻</div><div class="row-main"><strong>${e(row.action.replace(/_/g, ' '))}</strong><small>${e(profile(row.assistant_id).full_name || 'Staff')} · ${date(row.created_at)}${row.application_id ? ' · APP-' + e(row.application_id.slice(0, 8)) : ''}</small></div>${row.application_id ? `<a class="row-btn" href="${appLink({ id: row.application_id })}">Open application</a>` : ''}</div>`).join('') || empty('No activity has been recorded.')}</div>`;
  }
  function management() {
    return head('Content management', 'Keep learner resources, institutions, and platform notices up to date.') + `<div class="cards-3">${[['Institutions', 'Application dates, fees, and visibility', 'content-institutions', 'institutions'], ['Career articles & resources', 'Articles and downloadable career resources', 'content-career', 'career_articles'], ['Question papers', 'Past papers, memos, and study guides', 'content-papers', 'question_papers'], ['Announcements', 'Audience, priority, scheduling, and active notices', 'content-announcements', 'announcements'], ['Service content', 'Career Hub and accommodation availability', 'content-settings', 'admin_content']].map(([label, text, action, table]) => `<div class="module"><div class="module-icon red">✦</div><h4>${label}</h4><p>${text}</p><div class="module-footer">${chip(count(table) + ' records', 'blue')}${button('Manage', action)}</div></div>`).join('')}</div><div id="contentManager"></div>`;
  }
  function health() {
    return head('System health', 'Live read results from this session. Refresh to check again.', button('Run checks', 'reload', '', 'btn primary')) + `<div class="cards-3">${Object.entries(state.data).map(([table, data]) => `<div class="module"><div class="module-top"><h4>${e(table.replace(/_/g, ' '))}</h4>${chip(state.errors[table] ? 'Needs attention' : 'Connected', state.errors[table] ? 'red' : 'green')}</div><p>${e(state.errors[table] || `${data.length} records accessible to your account`)}</p></div>`).join('')}</div><div class="notice">These checks verify database reads and staff access. They do not measure hosting uptime or payment provider availability.</div>`;
  }
  function account() {
    return head('My account', 'Your current staff identity and account controls.') + `<div class="person-card"><div class="person-head"><div class="person-avatar">${e(initials(state.actor.full_name))}</div><div><h3>${e(state.actor.full_name)}</h3><p>${e(state.actor.email)} · ${isMaster ? 'Master Admin' : 'Assistant Admin'}</p></div></div><div class="settings-list account-settings"><a class="setting" href="/changepassword.html"><span class="nav-icon">⌘</span><div><strong>Change password</strong><small>Update your account password securely</small></div><span class="arrow">→</span></a><a class="setting" href="/index.html"><span class="nav-icon">K</span><div><strong>Kagie homepage</strong><small>Open the public website</small></div><span class="arrow">→</span></a>${button('Sign out', 'logout', '', 'btn primary')}</div></div>`;
  }
  function render() {
    if (!state.actor) return;
    $('topTitle').textContent = titles[state.page] || titles.overview;
    $('topSub').textContent = isMaster ? 'Manage the Kagie platform and your team.' : 'Work with your assigned learners and enabled forms.';
    document.querySelectorAll('[data-page]').forEach(el => { const active = el.dataset.page === state.page; el.classList.toggle('active', active); active ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current'); });
    const mobileMore = !['overview', queuePage, 'messages'].includes(state.page);
    $('menuButton').classList.toggle('active', mobileMore);
    mobileMore ? $('menuButton').setAttribute('aria-current', 'location') : $('menuButton').removeAttribute('aria-current');
    if (pageServices[state.page] && !can(pageServices[state.page])) {
      $('pageContent').innerHTML = head(titles[state.page], 'This module requires access from Master Admin.') + (state.errors.assistant_service_permissions ? errorBox('assistant_service_permissions') : '<div class="notice"><strong>Service access is locked.</strong><p>Ask Master Admin to enable this service for your account.</p></div>');
      return;
    }
    const views = { overview, applications, assigned: applications, learners, users: () => learners(true), assistants, payments, documents, cv: () => window.KagieStaffCv.render(cvContext()), callbacks, messages, accommodation, jobs: () => head('Jobs & Opportunities', isMaster ? 'Review submitted drafts and publish opportunities.' : 'Save a private draft, then submit it for Master Admin approval.', can('jobs_create') ? button('New opportunity', 'new-career', '', 'btn primary') : '') + contentCards('career_articles', 'jobs'), announcements, updates, activity: audit, audit, forms: () => head('My form access', 'Master Admin controls which application types you can work on.') + errorBox('assistant_form_permissions') + errorBox('application_form_types') + panel('Application form permissions', permissionCards(formAccess(state.actor.id), true)), career:()=>head('Career Hub resources','Articles and educational resources',button('New resource','new-article','','btn primary'))+contentCards('career_articles','articles'), papers:()=>'<div id="contentManager"></div>', management:()=>'<div id="contentManager"></div>', health, more: account };
    $('pageContent').innerHTML = (views[state.page] || overview)();
    if (state.page === 'institutions') { $('pageContent').innerHTML = '<div id="contentManager"></div>'; contentManager('institutions'); }
    if(state.page==='papers')contentManager('papers');
    if(state.page==='management')contentManager('settings');
    if(state.page==='cv')window.KagieStaffCv.bind(cvContext());
    if(state.page==='health'){const node=document.createElement('section');node.className='notice';node.textContent='Checking deployed admin capabilities…';$('pageContent').append(node);D.rpc('staff_capabilities',{}).then(result=>{if(node.isConnected)node.textContent=`Database migration: ${result.migration} · Private document bucket: ${result.document_bucket?'confirmed':'missing'} · File policies: ${result.private_file_policies?'confirmed':'missing'}`;}).catch(error=>{if(node.isConnected){node.classList.add('error-notice');node.textContent='Required admin capability check failed: '+error.message;}});}
    if (state.page === 'messages' && state.ticket) loadConversation(state.ticket);
    hydrateImages();
  }
  function cvContext(){return {D,state,isMaster,e,date,person,profile,rows,can,head,panel,button,field,dialog,toast,loadAll,errorBox};}
  async function hydrateImages() {
    await Promise.all([...document.querySelectorAll('[data-storage-image]')].map(async element => {
      try {
        const url = safeUrl(await D.documentUrl(element.dataset.storageImage));
        if (url && element.isConnected) {element.onerror=()=>{element.hidden=true;const message=document.createElement('p');message.className='form-error';message.textContent='Picture could not load. Refresh to request a new link.';element.after(message);};element.src = url;}
      } catch (error) { if(element.isConnected){element.hidden=true;const message=document.createElement('p');message.className='form-error';message.textContent='Picture unavailable: '+error.message;element.after(message);} }
    }));
  }
  let dialogHandler, dialogOrigin;
  function field(name, label, value = '', options = {}) {
    const { select, textarea, type: inputType = 'text', required = false, min, max, accept } = options;
    const attrs = `name="${e(name)}" id="field-${e(name)}" class="field-input" ${required ? 'required' : ''}`;
    const input = select ? `<select ${attrs}>${select.map(item => { const [id, text] = Array.isArray(item) ? item : [item, item]; return `<option value="${e(id)}" ${String(value) === String(id) ? 'selected' : ''}>${e(text)}</option>`; }).join('')}</select>` : textarea ? `<textarea ${attrs} maxlength="15000">${e(value)}</textarea>` : `<input ${attrs} type="${inputType}" ${inputType !== 'file' ? `value="${e(value)}"` : ''} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${accept ? `accept="${accept}"` : ''} ${inputType === 'text' ? 'maxlength="2000"' : ''}>`;
    return `<div><label class="field-label" for="field-${e(name)}">${e(label)}</label>${input}</div>`;
  }
  function dialog(title, body, saveLabel, onSave) {
    dialogOrigin = document.activeElement;
    $('dialogTitle').textContent = title;
    $('dialogBody').innerHTML = `<div class="field-stack">${body}</div>`;
    $('dialogError').textContent = '';
    $('dialogSave').textContent = saveLabel || '';
    $('dialogSave').hidden = !onSave;
    dialogHandler = onSave;
    $('staffDialog').showModal();
  }
  async function saved(label, fn) {
    const result = await fn();
    $('staffDialog').close();
    toast(label);
    await loadAll();
    return result;
  }
  async function auditWrite(action, applicationId, details = {}) {
    try { await D.save('assistant_activity', { assistant_id: state.actor.id, application_id: applicationId || null, action, details }); } catch (error) { toast(`Change saved; activity log unavailable: ${error.message}`, true); }
  }
  async function notifyAfterSave(userId, title, message) {
    try { await D.notify(userId, title, message); return true; } catch (error) { toast(`Saved; learner notification failed: ${error.message}`, true); return false; }
  }
  function accessDialog(id) {
    const user = profile(id);
    if (state.errors.assistant_form_permissions || state.errors.application_form_types) throw new Error('Load the form permission records successfully before changing access.');
    const values = formAccess(id);
    dialog(`Form access · ${user.full_name}`, `<p class="body-copy">Assignments and enabled forms both control application access.</p>${permissionCards(values)}`, 'Save access', async form => {
      await saved('Form access saved.', () => D.permissions(id, values.map(item => ({ form_type: item.form_type, enabled: form.has('access-' + item.form_type) }))));
      await auditWrite('change_form_access', null, { assistantId: id });
    });
  }
  function serviceAccessDialog(id) {
    if (state.errors.assistant_service_permissions) throw new Error('Service access needs the 20261004_staff_service_drafts.sql migration. ' + state.errors.assistant_service_permissions);
    const values = new Map(rows('assistant_service_permissions').filter(row => row.assistant_admin_id === id).map(row => [row.service_key, row.enabled]));
    dialog(`Service access · ${profile(id).full_name}`, '<div class="notice">Service permissions work alongside learner assignments and form access. Institution controls and direct job publication are privileged grants.</div><div class="permission-grid">' + serviceTypes.map(([key, label, hint, fallback]) => `<label class="permission"><div><strong>${e(label)}</strong><small>${e(hint)}</small></div><input class="access-check" type="checkbox" name="service-${key}" ${values.has(key) ? values.get(key) ? 'checked' : '' : fallback ? 'checked' : ''} aria-label="${e(label)}"></label>`).join('') + '</div>', 'Save service access', async form => {
      const values = serviceTypes.map(([key]) => ({ service_key: key, enabled: form.has('service-' + key) }));
      if (values.find(row => row.service_key === 'publish_jobs').enabled && !values.find(row => row.service_key === 'jobs').enabled) throw new Error('Enable Jobs & opportunities before granting direct publication.');
      await saved('Service access saved.', () => D.servicePermissions(id, values));
      await auditWrite('change_service_access', null, { assistantId: id });
    });
  }
  function learnerDialog(id) {
    const user = profile(id);
    const apps = rows('applications').filter(app => app.user_id === id);
    dialog(user.full_name || 'Learner', `<div class="person-head"><div class="person-avatar">${e(initials(user.full_name))}</div><div><h3>${e(user.full_name)}</h3><p>${e(user.email)}<br>${e(user.phone || '')}</p></div></div>${head('Applications', 'Choose the record to open its complete workspace')}${apps.map(app => `<div class="row"><div class="row-main"><strong>${e(ref(app))} · ${e(typeLabel(type(app)))}</strong><small>${e(app.status)} · ${e(app.institution_choice_1 || 'Institution pending')}</small></div><a class="row-btn" href="${appLink(app)}">Open</a></div>`).join('') || empty('This learner has no accessible application records.')}`, null);
  }
  async function documentDialog(id, cv = false) {
    const doc = rows('documents').find(item => item.id === id);
    const reviews = await D.list('document_reviews', { document_id: id }, 'created_at');
    const current = reviews.find(review => review.assistant_id === state.actor.id) || {};
    let url = '';
    try { url = safeUrl(await D.documentUrl(doc.file_url)); } catch (error) { toast(error.message, true); }
    const source = url ? `<a class="btn secondary" href="${e(url)}" target="_blank" rel="noopener">Open ${cv ? 'source CV' : 'document'}</a>${/\.pdf$/i.test(doc.file_name) ? `<iframe class="document-preview" title="${e(doc.file_name)}" src="${e(url)}"></iframe>` : ''}` : '<div class="preview-box">This document could not be opened. Check the stored file and storage permissions.</div>';
    const body = `<div class="person-head"><div class="person-avatar">${e(initials(person(doc.user_id)))}</div><div><h3>${e(person(doc.user_id))}</h3><p>${e(doc.file_name)} · ${e(doc.document_type)}</p></div></div>${source}${field('status', 'Review status', doc.status, { select: ['Pending Review', 'Approved', 'Rejected'] })}${field('note', cv ? 'CV feedback for the learner' : 'Review comment / rejection reason', current.note || '', { textarea: true })}${cv ? field('revised', 'Revised CV (optional, PDF / DOC / DOCX, up to 8 MB)', '', { type: 'file', accept: '.pdf,.doc,.docx' }) : ''}<h4>Review history</h4>${reviews.map(r=>`<p>${e(r.status)} · ${e(r.note)}<br><small>${date(r.created_at)} · ${e(profile(r.assistant_id).full_name||'Staff')}</small></p>`).join('')||'<p>No reviews yet.</p>'}`;
    dialog(cv ? 'CV review & delivery' : 'Review document', body, 'Save review', async form => {
      const status = form.get('status'), note = String(form.get('note')).trim();
      if (status === 'Rejected' && !note) throw new Error('Explain what the learner needs to correct before rejecting.');
      let revised = null;
      const file = form.get('revised');
      if (file?.size) revised = await D.reviseCv(doc, file);
      // The existing API records review history and updates the document status.
      await D.rpc('staff_review_document', { document_id_arg:id,status_arg:status,note_arg:note });
      const confirmed = (await D.list('documents', { id }))[0];
      if (confirmed?.status !== status) throw new Error('The live server did not confirm this review.');
      let notified = true;
      if (revised) notified = await notifyAfterSave(doc.user_id, 'Your revised CV is ready', 'Your revised CV has been added to your documents. Open Documents to download it.');
      if (cv && note) notified = await notifyAfterSave(doc.user_id, 'CV review feedback', note) && notified;
      $('staffDialog').close(); toast(notified ? revised ? 'Review saved and revised CV delivered.' : 'Document review saved.' : 'Review saved. The learner notification could not be delivered.', !notified); await loadAll();
    });
  }
  function callbackDialog(id) {
    const call = rows('callback_requests').find(item => item.id === id);
    dialog('Manage callback', `<p class="body-copy"><strong>${e(person(call.user_id))}</strong><br><a href="tel:${e(String(call.phone || '').replace(/[^+\d]/g, ''))}">${e(call.phone)}</a><br>${e(call.note || '')}<br>Preferred time: ${e(call.preferred_time || 'Not specified')}</p>${field('status', 'Callback status', call.status, { select: ['Pending', 'Contacted', 'Resolved'] })}`, 'Save status', async form => {
      await saved('Callback status saved.', () => D.save('callback_requests', { status: form.get('status'), ...(!isMaster && !call.assigned_assistant_id ? { assigned_assistant_id: state.actor.id } : {}) }, id));
      await auditWrite('update_callback', null, { callbackId: id });
    });
  }
  function paymentDialog(id) {
    const app = rows('applications').find(item => item.id === id);
    const proofs = rows('documents').filter(doc => doc.user_id === app.user_id && ['proof_of_payment', 'payment'].includes(doc.document_type) && (!doc.application_id || doc.application_id === id));
    dialog('Review payment', `<div class="notice"><strong>${e(appName(app))} · ${e(ref(app))}</strong><br>${money(app.payment_amount || app.final_total)} · ${e(app.payment_reference || 'No reference')}<br>${e(app.payer_name || '')} · ${e(app.payment_method || '')}</div><div class="toolbar-row"><a class="btn secondary" href="${appLink(app)}">Full application & payment history</a>${proofs.map(doc => button('Open proof: ' + doc.file_name, 'open-file', doc.id)).join('') || '<p class="body-copy">No payment proof is attached to this application.</p>'}</div>${field('status', 'Verification decision', app.payment_status, { select: ['Pending Verification', 'Verified', 'Rejected'] })}${field('reason', 'Review note / rejection reason', '', { textarea: true })}`, 'Save decision', async form => {
      const status = form.get('status'), reason = String(form.get('reason')).trim();
      if (status === 'Rejected' && !reason) throw new Error('A rejection reason is required.');
      await saved('Payment decision saved.', () => D.rpc('staff_review_payment', {application_id_arg:id,status_arg:status,reason_arg:reason}));
    });
  }
  function assignDialog(id) {
    const app = rows('applications').find(item => item.id === id);
    dialog('Assign application', `<p class="body-copy">${e(appName(app))} · ${e(ref(app))}. Assign this application to an assistant with access to its form type.</p>${field('assistant', 'Assistant admin', app.assistant_id, { select: [['', 'Unassigned'], ...rows('profiles').filter(user => user.role === 'assistant_admin').map(user => [user.id, user.full_name])] })}`, 'Save assignment', async form => {
      const assistantId = form.get('assistant');
      if (formAccess(assistantId).find(item => item.form_type === type(app))?.enabled === false) throw new Error('Enable this form type for the assistant before assigning this application.');
      await saved(assistantId?'Application assigned.':'Application unassigned.', () => D.save('applications',{assistant_id:assistantId||null,assigned_by:state.actor.id,assigned_at:new Date().toISOString()},id));
    });
  }
  function createAssistant() {
    dialog('Create assistant account', field('name', 'Full name', '', { required: true }) + field('email', 'Email address', '', { type: 'email', required: true }) + field('phone', 'Phone number', '', { type: 'tel' }) + field('password', 'Temporary password (at least 8 characters)', '', { type: 'password', required: true }), 'Create account', async form => {
      if (String(form.get('password')).length < 8) throw new Error('Use a temporary password of at least 8 characters.');
      await window.KagieAPI.createAssistantAccount({ fullName: form.get('name'), email: form.get('email'), phone: form.get('phone'), password: form.get('password') });
      await loadAll();
      if (!rows('profiles').some(user => user.email?.toLowerCase() === String(form.get('email')).toLowerCase() && user.role === 'assistant_admin')) throw new Error('The live staff directory did not confirm the new account.');
      $('staffDialog').close(); toast('Assistant account created. Manage its form access next.');
    });
  }
  function housingRequest(id) {
    const request = rows('accommodation_requests').find(row => row.id === id);
    dialog('Learner housing request', `<div class="person-head"><div class="person-avatar">⌂</div><div><h3>${e(request.learner_name || person(request.user_id))}</h3><p>${e(request.learner_phone)} · ${e(request.learner_email)}</p></div></div><p class="body-copy">${e(request.property_name)} · ${e(request.location)}<br>${money(request.price)} · ${e(request.room_type)}<br>Institution: ${e(request.institution_name)}<br>Funding: ${e(request.funding_status)}<br>Move-in date: ${date(request.preferred_move_in_date)}<br>${e(request.note)}</p>${field('status', 'Request progress', request.status, { select: ['Support review requested', 'In progress', 'Contacted provider', 'Awaiting learner', 'Resolved', 'Cancelled'] })}${field('summary', 'Housing support summary', request.support_summary || '', { textarea: true })}`, 'Save progress', async form => {
      await saved('Housing request updated.', () => D.save('accommodation_requests', { status: form.get('status'), support_summary: form.get('summary') }, id));
      await auditWrite('update_housing_request', request.application_id, { requestId: id });
    });
  }
  function contentEditor(table, id, article = false) {
    const row = rows(table).find(item => item.id === id) || {};
    const housing = table === 'housing_listings';
    const title = housing ? 'Property listing' : article ? 'Career article / resource' : 'Job opportunity';
    const body = housing ? field('title', 'Property name', row.title, { required: true }) + field('province', 'Province', row.province, { select: ['Gauteng', 'Limpopo', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Free State', 'Mpumalanga', 'North West', 'Northern Cape'], required: true }) + `<div class="field-row">${field('city', 'City', row.city, { required: true })}${field('institution_name', 'Nearby institution', row.institution_name)}</div>` + field('address', 'Address', row.address) + `<div class="field-row">${field('price', 'Monthly rent (ZAR)', row.price || 0, { type: 'number', min: 0, required: true })}${field('room_type', 'Room type', row.room_type, { select: ['Single room', 'Shared room', 'Apartment', 'Residence'] })}</div>` + field('short_description', 'Short description', row.short_description, { textarea: true, required: true }) + field('description', 'Property details', row.description, { textarea: true }) + `<div class="field-row">${field('contact_phone', 'Provider phone', row.contact_phone, { type: 'tel' })}${field('contact_email', 'Provider email', row.contact_email, { type: 'email' })}</div>` + field('availability_status', 'Availability', row.availability_status, { select: ['Available', 'Limited availability', 'Full'] }) + field('image', 'Property picture (up to 8 MB)', '', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) : field('title', 'Title', row.title, { required: true }) + `<div class="field-row">${field('content_type', 'Content type', row.content_type || (article ? 'article' : 'job'), { select: article ? ['article', 'resource'] : ['job', 'internship'] })}${field('company', 'Company / organisation', row.company, { required: !article })}</div><div class="field-row">${field('location', 'Location', row.location)}${field('work_mode', 'Work setup', row.work_mode, { select: ['', 'On-site', 'Hybrid', 'Remote'] })}</div><div class="field-row">${field('employment_type', 'Employment type', row.employment_type)}${field('closing_date', 'Closing date', row.closing_date, { type: 'date' })}</div>${field('summary', 'Summary', row.summary, { textarea: true, required: true })}${field('body', 'Description / application instructions', row.body, { textarea: true })}${field('requirements', 'Requirements (one per line)', (row.requirements || []).join('\n'), { textarea: true })}${field('application_url', 'Application link', row.application_url, { type: 'url', required: !article })}${field('image', 'Opportunity picture (up to 8 MB)', '', { type: 'file', accept: 'image/png,image/jpeg,image/webp' })}${article ? field('resource', 'Resource attachment (PDF / DOC / DOCX, up to 8 MB)', '', { type: 'file', accept: '.pdf,.doc,.docx' }) : ''}`;
    const status = isMaster || housing && can('housing_publish') || !housing && can('publish_jobs') ? field(housing ? 'listing_state' : 'status', 'Visibility', row.listing_state || row.status || 'draft', { select: isMaster ? ['draft', 'published', 'archived'] : ['draft','published'] }) : '<div class="notice">Save a private draft, then submit it for Master Admin approval.</div>';
    dialog(title, body + status, 'Save changes', async form => {
      const payload = Object.fromEntries(form);
      delete payload.image; delete payload.resource; delete payload.remove_image;
      if('expires_at' in payload)payload.expires_at=payload.expires_at?new Date(payload.expires_at+'T23:59:59Z').toISOString():null;
      if (payload.application_url && !safeUrl(payload.application_url)) throw new Error('Use a valid HTTP or HTTPS application URL.');
      if (housing) { payload.price = Number(payload.price); payload.deposit=Number(payload.deposit||0);payload.rooms=Number(payload.rooms||0);payload.amenities=String(payload.amenities||'').split('\n').map(v=>v.trim()).filter(Boolean);payload.available_from ||=null;if('assigned_assistant_id' in payload)payload.assigned_assistant_id ||=null;payload.location = row.location || payload.city; payload.is_active = row.is_active !== false; }
      else { payload.requirements = String(payload.requirements).split('\n').map(value => value.trim()).filter(Boolean); if (payload.status === 'published') payload.published_at = row.published_at || new Date().toISOString(); }
      const file = form.get('image');
      if(form.get('remove_image')==='1'){if(housing)payload.images=[];else payload.image_url='';}
      if (file?.size) {
        const path = await D.upload(file, housing ? `housing/${state.actor.id}` : `career-hub/image/${state.actor.id}`, true);
        if (housing) payload.images = [path, ...(row.images || []).slice(1, 6)];
        else payload.image_url = path;
      }
      const resource = form.get('resource');
      if (resource?.size) payload.file_url = await D.upload(resource, `career-hub/resource/${state.actor.id}`);
      if(!housing&&payload.status==='published'&&isMaster)payload.approval_state='approved';
      await saved(payload.approval_state==='submitted' ? 'Opportunity submitted for approval.' : 'Content saved.', () => D.save(table, payload, id || undefined));
      await auditWrite('save_' + table, null, { recordId: id || 'new' });
    });
    if(!housing&&!article)$('dialogBody').querySelector('.field-stack').insertAdjacentHTML('beforeend',field('approval_state','Approval workflow',row.approval_state||'draft',{select:isMaster?['draft','submitted','approved','rejected']:['draft','submitted']})+field('category','Career category',row.category)+field('level','Qualification / target level',row.level)+field('duration','Duration (optional)',row.duration)+field('start_date','Start date (optional)',row.start_date,{type:'date'})+field('salary','Salary / stipend',row.salary)+field('expires_at','Expiry (optional)',row.expires_at?row.expires_at.slice(0,10):'',{type:'date'}));
    if(housing)$('dialogBody').querySelector('.field-stack').insertAdjacentHTML('beforeend',field('deposit','Deposit (ZAR)',row.deposit||0,{type:'number',min:0})+field('rooms','Rooms available',row.rooms||0,{type:'number',min:0})+field('amenities','Amenities (one per line)',(row.amenities||[]).join('\n'),{textarea:true})+field('available_from','Available from',row.available_from,{type:'date'})+(isMaster?field('assigned_assistant_id','Assigned assistant',row.assigned_assistant_id||'',{select:[['','Unassigned'],...rows('profiles').filter(p=>p.role==='assistant_admin').map(p=>[p.id,p.full_name])]}):''));
    window.KagieStaffImages.mount($('dialogBody'),housing?row.images?.[0]:row.image_url);
  }
  async function previewContent(table, id) {
    const row = rows(table).find(item => item.id === id);
    const paths = table === 'housing_listings' ? row.images || [] : row.image_url ? [row.image_url] : [];
    const urls = await Promise.all(paths.map(path => D.documentUrl(path).then(safeUrl).catch(() => '')));
    const applyUrl = safeUrl(row.application_url);
    dialog(row.title, `${urls.filter(Boolean).map(url => `<img class="content-image" src="${e(url)}" alt="${e(row.title)}">`).join('')}${chip(row.status || row.listing_state)}<p class="body-copy pre-wrap">${e(row.summary || row.short_description)}\n\n${e(row.body || row.description)}</p>${(row.requirements || []).length ? `<ul class="body-copy">${row.requirements.map(value => `<li>${e(value)}</li>`).join('')}</ul>` : ''}${table === 'housing_listings' ? `<p class="body-copy">${e(row.city)} · ${e(row.province)}<br>${money(row.price)} / month · ${e(row.room_type)}<br>${e(row.contact_phone)} · ${e(row.contact_email)}</p>` : ''}${applyUrl ? `<a class="btn primary" href="${e(applyUrl)}" target="_blank" rel="noopener">Open application link</a>` : ''}${row.file_url ? button('Open resource', 'resource-file', id) : ''}`, null);
  }
  function announcementEditor(id) {
    const row = rows('announcements').find(item => item.id === id) || {};
    dialog('Announcement', field('title', 'Title', row.title, { required: true }) + field('message', 'Message', row.message, { textarea: true, required: true }) + field('audience', 'Audience', row.audience || 'learners', { select: ['all', 'learners', 'assistants', 'institution'] }) + field('institution_name', 'Institution (required for institution audience)', row.institution_name) + field('priority', 'Priority', row.priority || 'normal', { select: ['normal', 'important', 'urgent'] }) + field('scheduled_for', 'Scheduled for (optional)', row.scheduled_for ? new Date(Date.parse(row.scheduled_for) - new Date(row.scheduled_for).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '', { type: 'datetime-local' }) + field('status', 'Visibility', row.status || 'inactive', { select: [['inactive', 'Draft / inactive'], ['active', 'Active']] }), 'Save announcement', async form => {
      const payload = Object.fromEntries(form);
      if (payload.audience === 'institution' && !payload.institution_name.trim()) throw new Error('Choose an institution for this audience.');
      payload.scheduled_for = payload.scheduled_for ? new Date(payload.scheduled_for).toISOString() : null;
      payload.updated_by = state.actor.id;
      if (!id) payload.created_by = state.actor.id;
      await saved('Announcement saved.', () => D.save('announcements', payload, id || undefined));
      await auditWrite('save_announcement', null, { recordId: id || 'new' });
    });
  }
  function newUpdate() {
    if (!rows('applications').length) throw new Error('An accessible application is required to post an update.');
    const statuses = ['Application Submitted', 'Application Received', 'Under Review', 'Documents Required', 'Application Updated', 'Institution Response Received', 'Provisionally Accepted', 'Accepted', 'Unsuccessful', 'Waitlisted', 'Registration Information Available'];
    dialog('Post learner update', field('application', 'Application', '', { select: rows('applications').map(app => [app.id, `${appName(app)} · ${ref(app)}`]), required: true }) + field('title', 'Update title', '', { required: true }) + field('status', 'Learner-visible progress', 'Application Updated', { select: statuses }) + field('message', 'Message for the learner', '', { textarea: true, required: true }), 'Post update', async form => {
      const app = rows('applications').find(item => item.id === form.get('application'));
      await saved('Update posted to the learner dashboard.', () => D.save('application_updates', { application_id: app.id, user_id: app.user_id, institution_name: app.institution_choice_1 || '', title: form.get('title'), message: form.get('message'), status: form.get('status'), posted_by: state.actor.id, posted_by_role: role }));
      await auditWrite('post_application_update', app.id);
    });
  }
  function contentManager(kind) {
    state.query = ''; state.filter = '';
    const box = $('contentManager');
    if (!box) return;
    if (kind === 'career') box.innerHTML = head('Career articles & resources', 'Publish content to the learner Career Hub.', button('New article / resource', 'new-article', '', 'btn primary')) + contentCards('career_articles', 'articles');
    else if (kind === 'announcements') box.innerHTML = announcements();
    else if (kind === 'settings') box.innerHTML = head('Service content & availability', 'Update the public service descriptions and whether new requests are open.') + errorBox('admin_content') + rows('admin_content').filter(row => ['career_hub', 'housing_hub'].includes(row.content_key)).map(row => `<div class="row"><div class="row-main"><strong>${e(row.title)}</strong><small>${e(row.content_key)} · ${e(row.status)}</small></div>${button('Edit', 'edit-settings', row.id)}</div>`).join('') + button('Configure service content', 'new-settings', '', 'btn primary');
    else {
      const table = kind === 'institutions' ? 'institutions' : 'question_papers';
      box.innerHTML = head(kind === 'institutions' ? 'Institution directory' : 'Question papers', 'Edit records and their learner visibility.', button('Add record', kind === 'institutions' ? 'new-institution' : 'new-paper', '', 'btn primary')) + errorBox(table) + `<div class="list">${rows(table).map(row => `<div class="row"><div class="row-main"><strong>${e(row.name || row.title)}</strong><small>${e(row.province || row.subject)} · ${e(row.manual_status || row.status || 'Automatic dates')}</small></div>${chip(kind === 'institutions' ? row.is_active ? 'Active' : 'Hidden' : row.status)}${button('Edit', kind === 'institutions' ? 'edit-institution' : 'edit-paper', row.id)}${kind !== 'institutions' && (row.remote_path || row.file_url) ? button('Open file', 'paper-file', row.id) : ''}</div>`).join('') || empty('No records are available.')}</div>`;
    }
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    hydrateImages();
  }
  function institutionEditor(id) {
    const row = rows('institutions').find(item => item.id === id) || {};
    dialog('Institution', field('name', 'Institution name', row.name, { required: true }) + field('short_name', 'Short name', row.short_name) + field('type', 'Institution type', row.type, { select: ['University', 'University of Technology', 'TVET College', 'College'] }) + field('province', 'Province', row.province, { required: true }) + field('city', 'City', row.city) + field('website', 'Website', row.website, { type: 'url' }) + field('application_fee', 'Application fee (ZAR)', row.application_fee || 0, { type: 'number', min: 0 }) + `<div class="field-row">${field('opening_date', 'Opening date', row.opening_date, { type: 'date' })}${field('closing_date', 'Closing date', row.closing_date, { type: 'date' })}</div>` + field('manual_status', 'Application status', row.manual_status, { select: [['', 'Use application dates'], ['open', 'Open'], ['closing_soon', 'Closing soon'], ['closed', 'Closed']] }) + field('is_active', 'Directory visibility', String(row.is_active !== false), { select: [['true', 'Visible'], ['false', 'Hidden']] }) + field('description', 'Description', row.description, { textarea: true }), 'Save institution', async form => {
      const payload = Object.fromEntries(form); payload.application_fee = Number(payload.application_fee); payload.is_active = payload.is_active === 'true';
      payload.opening_date ||= null; payload.closing_date ||= null;
      if (payload.opening_date && payload.closing_date && payload.closing_date < payload.opening_date) throw new Error('The closing date must be after the opening date.');
      await saved('Institution saved.', () => D.save('institutions', payload, id || undefined));
      await auditWrite('save_institution', null, { recordId: id || 'new' });
    });
  }
  function paperEditor(id) {
    const row = rows('question_papers').find(item => item.id === id) || {};
    dialog('Question paper / resource', field('title', 'Title', row.title, { required: true }) + field('grade', 'Grade', row.grade || '12', { select: ['8', '9', '10', '11', '12'] }) + field('subject', 'Subject', row.subject, { required: true }) + field('year', 'Year', row.year || new Date().getFullYear(), { type: 'number', min: 2010, max: new Date().getFullYear()+1, required: true }) + field('paper_type', 'Resource type', row.paper_type || 'Question Paper', { select: ['Question Paper', 'Memo', 'Study Guide'] }) + field('term', 'Term / exam period', row.term) + field('province', 'Province', row.province || 'National') + field('status', 'Visibility', row.status || 'Draft', { select: ['Draft', 'Published', 'Disabled'] }) + field('file', 'PDF / DOC / DOCX (up to 8 MB)', '', { type: 'file', accept: '.pdf,.doc,.docx', required: !id }), 'Save resource', async form => {
      const payload = Object.fromEntries(form); delete payload.file; payload.year = Number(payload.year);
      const file = form.get('file');
      if (file?.size) { payload.remote_path = await D.upload(file, `question-papers/${state.actor.id}`); payload.file_name = file.name; payload.file_url = ''; }
      payload.uploaded_by = state.actor.id;
      await saved('Question paper saved.', () => D.save('question_papers', payload, id || undefined));
      await auditWrite('save_question_paper', null, { recordId: id || 'new' });
    });
  }
  function settingsEditor(id) {
    const row = rows('admin_content').find(item => item.id === id) || {};
    dialog('Service content', field('content_key', 'Service', row.content_key || 'career_hub', { select: ['career_hub', 'housing_hub'] }) + field('title', 'Service title', row.title, { required: true }) + field('body', 'Service description', row.body, { textarea: true }) + field('status', 'Service section', row.status || 'active', { select: ['active', 'inactive'] }) + field('serviceStatus', 'Accepting new service requests', row.settings?.serviceStatus || 'open', { select: ['open', 'paused', 'closed'] }), 'Save service', async form => {
      const values = Object.fromEntries(form); const serviceStatus = values.serviceStatus; delete values.serviceStatus;
      const existing = rows('admin_content').find(item => item.content_key === values.content_key);
      if (id && existing?.id !== id) throw new Error('Edit the existing service record to change this key.');
      await saved('Service content saved.', () => D.save('admin_content', { ...values, settings: { ...(row.settings || existing?.settings || {}), serviceStatus }, updated_by: state.actor.id, ...(!id && !existing ? { created_by: state.actor.id } : {}) }, id || existing?.id));
    });
  }
  function exportApps() {
    const records = filtered(rows('applications'));
    const cell = value => '"' + String(value ?? '').replace(/^\s*[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    const text = [['Reference', 'Learner', 'Form', 'Institution', 'Status', 'Payment status'], ...records.map(app => [ref(app), appName(app), type(app), app.institution_choice_1, app.status, app.payment_status])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `kagie-applications-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function action(name, id) {
    const masterActions = ['access', 'service-access', 'create-assistant', 'payment', 'assign', 'new-paper', 'edit-paper', 'new-announcement', 'edit-announcement', 'new-settings', 'edit-settings', 'new-article'];
    if (!isMaster && (masterActions.includes(name) || /^(content-|publish-|archive-)/.test(name) && !(name === 'content-institutions' && can('institutions')))) throw new Error('This action requires Master Admin.');
    if (!isMaster && (name === 'new-institution' || name === 'edit-institution') && !can('institutions')) throw new Error('Institution controls have not been granted to your account.');
    if (pageServices[state.page] && !can(pageServices[state.page]) && name !== 'reload' && name !== 'notifications' && name !== 'logout') throw new Error('This service is locked by Master Admin.');
    if (name === 'reload') return loadAll();
    if (name === 'previous' || name === 'next') { state.tablePage = Math.max(1, state.tablePage + (name === 'next' ? 1 : -1)); persistViewState(true); render(); return; }
    if (name === 'learner') return learnerDialog(id);
    if (name === 'access') return accessDialog(id);
    if (name === 'service-access') return serviceAccessDialog(id);
    if (name === 'create-assistant') return createAssistant();
    if (name === 'assign') return assignDialog(id);
    if (name === 'payment') return paymentDialog(id);
    if (name === 'document' || name === 'cv') return documentDialog(id, name === 'cv');
    if (name === 'callback') return callbackDialog(id);
    if (name === 'new-update') return newUpdate();
    if (name === 'ticket' || name === 'open-ticket') { if (name === 'open-ticket') goPage('messages'); state.ticket = id; persistViewState(true); render(); return; }
    if (name === 'ticket-status') {
      const ticket = rows('support_threads').find(item => item.id === id);
      dialog('Support request status', field('status', 'Status', ticket.status, { select: ['open', 'in_progress', 'awaiting_user', 'resolved', 'closed'] }), 'Save status', form => saved('Support status updated.', () => D.save('support_threads', { status: form.get('status'), closed_at: ['resolved', 'closed'].includes(form.get('status')) ? new Date().toISOString() : null }, id)));
      return;
    }
    if (name === 'housing-request') return housingRequest(id);
    if(name==='housing-availability'){const row=rows('housing_listings').find(r=>r.id===id);return dialog('Property availability',field('availability_status','Availability',row.availability_status,{select:['Available','Limited availability','Full']}),'Save availability',form=>saved('Availability saved.',()=>D.save('housing_listings',{availability_status:form.get('availability_status')},id)));}
    if(name==='unpublish-career'){const row=rows('career_articles').find(r=>r.id===id);return dialog('Unpublish opportunity','<p>The opportunity will return to a private draft. Its history and stored image are retained.</p>','Unpublish',()=>saved('Opportunity unpublished.',()=>D.save('career_articles',{...row,status:'draft',approval_state:'draft'},id)));}
    if (['new-housing', 'edit-housing', 'publish-housing'].includes(name)) return contentEditor('housing_listings', id);
    if (['new-career', 'edit-career', 'publish-career', 'new-article'].includes(name)) return contentEditor('career_articles', id, name === 'new-article' || ['article', 'resource'].includes(rows('career_articles').find(row => row.id === id)?.content_type));
    if (name.startsWith('preview-')) return previewContent(name === 'preview-housing' ? 'housing_listings' : 'career_articles', id);
    if (name.startsWith('archive-')) { const table = name === 'archive-housing' ? 'housing_listings' : 'career_articles'; dialog('Archive content', '<p class="body-copy">This content will be removed from the published learner directory. You can restore it by editing its visibility.</p>', 'Archive', () => saved('Content archived.', () => D.archive(table, id))); return; }
    if (name === 'open-file' || name === 'paper-file' || name === 'resource-file') {
      const row = rows(name === 'open-file' ? 'documents' : name === 'paper-file' ? 'question_papers' : 'career_articles').find(item => item.id === id);
      const url = safeUrl(await D.documentUrl(row.remote_path || row.file_url));
      if (!url) throw new Error('This file URL is invalid.');
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click(); return;
    }
    if (name === 'new-announcement' || name === 'edit-announcement') return announcementEditor(id);
    if (name === 'new-institution' || name === 'edit-institution') return institutionEditor(id);
    if (name === 'new-paper' || name === 'edit-paper') return paperEditor(id);
    if (name === 'new-settings' || name === 'edit-settings') return settingsEditor(id);
    if (name.startsWith('content-')) return contentManager(name.slice(8));
    if (name === 'export-apps') return exportApps();
    if (name === 'logout') { await window.KagieAPI.logout(); location.replace('/login.html'); return; }
    if (name === 'notifications') {
      dialog('Your notifications', rows('notifications').map(row => `<div class="module"><h4>${e(row.title)}</h4><p class="pre-wrap">${e(row.message)}</p><small>${date(row.created_at)}</small></div>`).join('') || empty('You have no notifications.'), 'Mark all read', () => saved('Notifications marked as read.', async () => { for (const row of rows('notifications').filter(item => !item.is_read)) await D.save('notifications', { is_read: true }, row.id); }));
    }
  }
  function closeMenu() { $('mobileMenu').hidden = true; $('menuButton').setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', async event => {
    const page = event.target.closest('[data-page]');
    if (page && state.actor) return goPage(page.dataset.page);
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.disabled || !state.actor) return;
    trigger.disabled = true;
    try { await action(trigger.dataset.action, trigger.dataset.id); } catch (error) { toast(error.message, true); } finally { trigger.disabled = false; }
  });
  document.addEventListener('input', event => {
    if (event.target.id !== 'recordSearch') return;
    const input = event.target; state.query = input.value; state.tablePage = 1;
    persistViewState();
    if (state.page === 'management') { const cards = $('contentManager').querySelectorAll('.job-card,.property-card'); cards.forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(state.query.toLowerCase()); }); return; }
    const position = input.selectionStart; render(); $('recordSearch')?.focus(); if ($('recordSearch')) $('recordSearch').setSelectionRange(position, position);
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'recordFilter') { state.filter = event.target.value; state.tablePage = 1; if (state.page === 'management') { const cards = $('contentManager').querySelectorAll('.job-card,.property-card'); cards.forEach(card => { card.hidden = Boolean(state.filter && ![...card.querySelectorAll('.chip')].some(tag => tag.textContent === state.filter)); }); } else render(); }
    if(event.target.id==='recordFilter')persistViewState(true);
  });
  document.addEventListener('submit', async event => {
    if (event.target.id !== 'replyForm') return;
    event.preventDefault(); const form = event.target, input = $('chatInput'), text = input.value.trim();
    if (!text) return;
    const ticket = rows('support_threads').find(item => item.id === state.ticket); const submit = form.querySelector('button'); if (submit.disabled) return; submit.disabled = true;
    try { await D.reply(ticket, text); input.value = ''; ticket.status = 'awaiting_user'; await loadConversation(ticket.id); toast('Reply delivered.'); } catch (error) { toast(error.message, true); } finally { submit.disabled = false; }
  });
  $('dialogForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!dialogHandler || $('dialogSave').disabled) return;
    $('dialogSave').disabled = true; $('dialogSave').setAttribute('aria-busy', 'true'); $('dialogError').textContent = '';
    try { await dialogHandler(new FormData($('dialogForm'))); } catch (error) { $('dialogError').textContent = error.message; $('dialogError').focus(); } finally { $('dialogSave').disabled = false; $('dialogSave').removeAttribute('aria-busy'); }
  });
  $('dialogClose').addEventListener('click', () => $('staffDialog').close());
  $('dialogCancel').addEventListener('click', () => $('staffDialog').close());
  $('staffDialog').addEventListener('close', () => { $('dialogBody').innerHTML = ''; dialogHandler = null; dialogOrigin?.focus(); });
  $('menuButton').addEventListener('click', () => { const open = $('mobileMenu').hidden; $('mobileMenu').hidden = !open; $('menuButton').setAttribute('aria-expanded', String(open)); if (open) $('mobilePages').querySelector('button')?.focus(); });
  $('menuClose').addEventListener('click', () => { closeMenu(); $('menuButton').focus(); });
  document.addEventListener('keydown', event => {
    if ($('mobileMenu').hidden) return;
    if (event.key === 'Escape') { closeMenu(); $('menuButton').focus(); }
    if (event.key === 'Tab') {
      const items = [...$('mobileMenu').querySelectorAll('button')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('popstate', () => goPage(pageFromLocation(), false));
  navigation();
  (async () => {
    try {
      state.actor = await D.authenticate(role);
      document.querySelectorAll('[data-staff-name]').forEach(el => { el.textContent = state.actor.full_name; });
      document.querySelectorAll('[data-initials]').forEach(el => { el.textContent = initials(state.actor.full_name); });
      state.page = pageFromLocation();
      restoreViewState();
      await loadAll();
    } catch (error) {
      if (error.signIn) { location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.search)); return; }
      $('connectionState').textContent = 'Connection needs attention';
      $('pageContent').innerHTML = `<div class="notice error-notice" role="alert"><h2>Could not open your workspace</h2><p>${e(error.message)}</p><button class="btn primary" onclick="location.reload()">Try again</button><a class="btn secondary" href="/login.html">Sign in again</a></div>`;
    }
  })();
})();
