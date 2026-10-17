/* Requested palette, checked in local synthetic learner and staff sessions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { start } = require('./admin-test-server.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/palette');
const RED = 'rgb(253, 5, 5)', YELLOW = 'rgb(255, 181, 0)', BLUE = 'rgb(45, 157, 249)';
const cases = [
  ['/home.html', 'learner', [['.hero-header', RED], ['.t-red', RED], ['.t-orange', RED], ['.t-yellow', YELLOW], ['.t-blue', BLUE]], ['--red', '--orange', '--yellow', '--blue']],
  ['/upload.html', 'learner', [['.top', RED], ['#uploadBtn', RED]], ['--red', '--orange', '--yellow', '--blue']],
  ['/cart.html', 'learner', [['.zar-badge', YELLOW], ['.continue-btn', RED]], ['--red', '--orange', '--yellow', '--blue']],
  ['/Dashboard.html', 'learner', [], ['--red', '--orange', '--yellow', '--blue']],
  ['/profile.html', 'learner', [], ['--red', '--kagie-orange', '--yellow', '--blue']],
  ['/personal-assistance.html', 'learner', [], ['--red', '--orange', '--yellow', '--blue']],
  ['/notifications.html', 'learner', [], ['--red', '--orange', '--yellow', '--blue']],
  ['/login.html?app=1', null, [['#loginBtn', RED], ['.auth-story-icon.blue', BLUE]], ['--red1', '--red2']],
  ['/signup.html?app=1', null, [['#signupBtn', RED]], ['--red1', '--red2']],
  ['/master-admin/dashboard.html', 'master', [['.btn.primary', RED]], ['--blue']],
  ['/assistant/dashboard.html?page=assigned', 'assistant', [['.btn.primary', RED]], []],
  ['/index.html', null, [['.button-primary', RED], ['.text-gold', YELLOW], ['.text-blue', BLUE]], []]
];
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const harness = await start();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = { checkedAt: new Date().toISOString(), checks: [], failures: [], samples: [], errors: [] };
  function check(name, condition, actual) { if (!condition) results.failures.push({ name, actual }); else results.checks.push(name); }
  try {
    for (const [url, role, accents, tokens] of cases) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8') });
        if (u.origin !== harness.base) return route.fulfill({ body: '' });
        if (u.pathname === '/js/supabase-config.js') {
          const config = role ? 'const c=KagieAPI.configureSupabase({enabled:true,url:' + JSON.stringify(harness.base) + ',anonKey:"local"});KagieAPI.setLoginPersistence(true);const ready=c.auth.setSession({access_token:' + JSON.stringify(harness.ids[role + 'Token']) + ',refresh_token:"local"});const restore=KagieAPI.restoreSession;KagieAPI.restoreSession=async(...a)=>{await ready;return restore(...a)};const resolve=KagieAPI.resolveSessionUser;KagieAPI.resolveSessionUser=async(...a)=>{await ready;return resolve(...a)};' : 'KagieAPI.configureSupabase({enabled:false});';
          return route.fulfill({ contentType: 'text/javascript', body: config });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => results.errors.push({ url, message: error.message }));
      await page.goto(harness.base + url, { waitUntil: 'domcontentloaded' });
      if (accents.length) await page.locator(accents[0][0]).first().waitFor({ state: 'attached' });
      await page.waitForTimeout(900);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        const sample = await page.evaluate(names => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, tokens: Object.fromEntries(names.map(name => [name, getComputedStyle(document.body).getPropertyValue(name).trim()])) }), tokens);
        results.samples.push({ url, ...sample });
        for (const [token, value] of Object.entries(sample.tokens)) check(url + ' ' + token + ' at ' + width, value === (token.includes('blue') ? '#2d9df9' : token.includes('yellow') ? '#ffb500' : '#fd0505'));
        for (const [selector, expected] of accents) {
          if (!await page.locator(selector).count()) { check(url + ' ' + selector + ' exists', false, 'Missing selector'); continue; }
          const actual = await page.locator(selector).first().evaluate(node => { const s = getComputedStyle(node); return [s.backgroundColor, s.backgroundImage, s.color].join(' '); });
          check(url + ' ' + selector + ' at ' + width, actual.includes(expected), actual);
        }
        if (['/home.html', '/upload.html', '/index.html'].includes(url)) await page.screenshot({ path: path.join(out, url.slice(1).replace('.html', '') + '-' + width + '.png'), fullPage: false });
      }
      console.log('Verified requested colors: ' + url);
      await context.close();
    }
    check('No page script errors', results.errors.length === 0);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 2));
    assert.deepEqual(results.failures, [], 'Requested palette checks must pass');
    console.log(results.checks.length + ' requested palette checks passed.');
  } finally { await browser.close(); await harness.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
