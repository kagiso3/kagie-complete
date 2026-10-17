const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'kagie-web', 'dist');
const output = path.join(root, 'reports', 'client-design');
const originalPrimary = fs.readFileSync(path.join(root, 'reports/design-unity-before/kagie-web/src/styles.css'), 'utf8').match(/--kg-red:\s*([^;]+);/)[1].trim();
const types = ['undergraduate', 'late', 'transfer', 'bridging', 'postgraduate'];
const routes = ['home', 'dashboard', 'cart', 'checkout', 'accommodation', 'transport', 'apply', 'login', 'signup'];
const results = { samples: [], checks: [], errors: [] };
function fixture({ role = 'learner', guest = false, type = '', offline = false }) {
  let user = guest ? null : { id: 'design-learner', fullName: 'Kagie Student', email: 'student@fixture.test', phone: '0712345678', role };
  const draft = { id: 'design-app', userId: 'design-learner', status: 'Draft', paymentStatus: 'Payment Pending', forms: {}, institutions: [], marks: [] };
  const summary = { latestApplication: draft, applications: [draft], readiness: 35, unreadNotifications: 2, favorites: [], reminders: [], documents: [], recommendations: { safeAlternatives: [], warnings: [] }, packageUsage: { packageName: 'Standard', usedSlots: 1, institutionLimit: 3, remainingSlots: 2 } };
  const packs = [{ id: 'basic', name: 'Basic', price: 120, institutionLimit: 1 }, { id: 'standard', name: 'Standard', price: 250, institutionLimit: 3 }, { id: 'premium', name: 'Premium', price: 420, institutionLimit: 'unlimited' }];
  if (type) localStorage.setItem('kagie_application_type_design-learner', type);
  window.KagieData = { highSchools: [{ name: 'Kagie Secondary School' }] };
  window.KagieAPI = {
    currentUser: () => user, restoreSession: async () => user,
    login: async (email) => { user = { id: 'design-learner', fullName: 'Kagie Student', email, role: email.startsWith('master') ? 'master_admin' : email.startsWith('assistant') ? 'assistant_admin' : 'learner' }; return user; },
    registerUser: async (input) => { user = { id: 'design-learner', ...input, role: 'learner' }; return user; }, logout: async () => { user = null; },
    getDashboardSummary: () => summary, getDashboardSummaryAsync: async () => summary,
    getPackCatalog: () => packs, getSettings: () => ({ appName: 'Kagie', payments: { bankName: 'Fixture bank', accountNumber: '0000000000', referencePrefix: 'KAG' } }),
    getCart: () => [], getCartTotal: () => 0,
    getFavorites: () => [], getProfile: () => ({}), ensureDraft: () => draft,
    ensureApplicationDraft: () => draft, updateApplication: (_, patch) => ({ ...draft, ...patch }),
    getInstitutionCatalog: () => [], getInstitutionYears: () => ['2027'], getSubjectCatalog: () => ['English', 'Mathematics'], getHighSchoolCatalog: () => [],
    calculateAps: () => ({ total: 0 }), getApplicationRecommendations: () => ({ safeAlternatives: [], warnings: [] }),
    getAccommodationListings: () => [{ id: 'housing-1', propertyName: 'Campus Residence', location: 'Pretoria', price: 3200, distanceFromCampus: '1 km', roomType: 'Shared room', availabilityStatus: 'Available' }],
    getTransportOptions: () => [{ id: 'route-1', company: 'Kagie Travel', departureCity: 'Johannesburg', destinationCity: 'Pretoria', supportFee: 30 }]
  };
  if (offline) {
    const unavailable = async () => { throw new Error('Synthetic offline fixture'); };
    Object.assign(window.KagieAPI, { getDashboardSummaryAsync: unavailable, getAccommodationListingsAsync: unavailable, getTransportOptionsAsync: unavailable, getCartAsync: unavailable, getCartTotalAsync: unavailable });
  }
}
function check(name, value) { assert(value, name); results.checks.push(name); }
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (/\/(master-admin|assistant)\/dashboard.html$/.test(url.pathname)) { res.setHeader('Content-Type', 'text/html'); return res.end('<h1>Existing staff destination</h1>'); }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(dist, rel);
    if (!target.startsWith(dist + path.sep) && target !== path.join(dist, 'index.html')) { res.statusCode = 403; return res.end(); }
    if (!fs.existsSync(target)) { res.statusCode = 404; return res.end(); }
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(target)] || 'application/octet-stream';
    res.setHeader('Content-Type', mime); res.end(fs.readFileSync(target));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      for (const name of [...routes, ...types.map(type => 'form-' + type)]) {
        const guest = name === 'login' || name === 'signup';
        const type = name.startsWith('form-') ? name.slice(5) : '';
        const route = type ? 'application-form' : name;
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await context.route('**/*', async request => request.request().url().startsWith(base) ? request.continue() : request.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await context.addInitScript(fixture, { guest, type });
        const page = await context.newPage();
        page.on('pageerror', error => results.errors.push(name + ' ' + width + ': ' + error.message));
        await page.goto(base + '/#/' + route);
        await page.locator(guest ? '.kg-auth-card' : '.kg-main').waitFor();
        await page.waitForTimeout(150);
        const sample = await page.evaluate(() => ({
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          background: getComputedStyle(document.body).backgroundColor,
          cardRadius: getComputedStyle(document.querySelector('.kg-card, .kg-auth-card')).borderRadius,
          primary: getComputedStyle(document.documentElement).getPropertyValue('--kg-red').trim(),
          overflowing: [...document.querySelectorAll("body *")].filter(element => { const r = element.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !element.closest(".kg-nav-list, .kg-journey-steps"); }).slice(0, 12).map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })),
          currentCount: document.querySelectorAll('[aria-current="page"]').length
        }));
        results.samples.push({ name, ...sample });
        check(name + ' at ' + width + ' fits viewport', sample.documentWidth <= width + 1 && sample.bodyWidth <= width + 1);
        check(name + ' at ' + width + ' uses unified card radius', sample.cardRadius === '16px');
        check(name + ' at ' + width + ' preserves original Kagie red', sample.primary === originalPrimary);
        if (!guest) check(name + ' at ' + width + ' marks current navigation', sample.currentCount === 1);
        if ([390, 1440].includes(width) && ['home', 'apply', 'form-bridging', 'login'].includes(name)) await page.screenshot({ path: path.join(output, name + '-' + width + '.png'), fullPage: true });
        await context.close();
      }
    }
    for (const route of ['home', 'dashboard', 'cart', 'checkout', 'accommodation', 'transport']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript(fixture, { offline: true });
      await context.route('**/*', request => request.request().url().startsWith(base) ? request.continue() : request.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      const page = await context.newPage(); page.on('pageerror', error => results.errors.push('offline ' + route + ': ' + error.message));
      await page.goto(base + '/#/' + route); await page.locator('.kg-inline-message').filter({ hasText: /saved/ }).waitFor();
      check(route + ' explains failed refresh and saved data', true); await context.close();
    }
    for (const [role, target] of [['master_admin', '/master-admin/dashboard.html'], ['assistant_admin', '/assistant/dashboard.html'], ['support-staff', '/assistant/dashboard.html'], ['owner', '/master-admin/dashboard.html']]) {
      const context = await browser.newContext(); await context.addInitScript(fixture, { role });
      await context.route('**/*', request => request.request().url().startsWith(base) ? request.continue() : request.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      const page = await context.newPage(); await page.goto(base); await page.waitForURL(base + target); check(role + ' opens correct dashboard', page.url() === base + target); await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); await context.addInitScript(fixture, { guest: true });
    await context.route('**/*', request => request.request().url().startsWith(base) ? request.continue() : request.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    const page = await context.newPage(); await page.goto(base + '/#/login'); await page.getByLabel('Email', { exact: true }).fill('student@fixture.test'); await page.getByLabel('Password', { exact: true }).fill('FixturePassword1!'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.locator('.kg-main').waitFor(); check('Student sign-in opens home', page.url().endsWith('#/home'));
    await page.getByRole('button', { name: 'Cart', exact: true }).click(); await page.waitForURL('**/#/cart'); check('Cart navigation preserves route', true);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByRole('heading', { name: 'Welcome back' }).waitFor(); check('Sign-out returns to login', true);
    await context.close(); check('No browser runtime errors', results.errors.length === 0);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(results, null, 2)); }
  console.log('React UI verified: ' + results.samples.length + ' route/width samples and ' + results.checks.length + ' layout/navigation checks. Local browser fixtures; no production writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
