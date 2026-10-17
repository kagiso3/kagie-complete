/* Local browser fixtures only; no real sign-ins or external requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/splash');
const results = { checks: [], errors: [], hydrationErrors: [], samples: [] };
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function check(name, condition) { assert.ok(condition, name); results.checks.push(name); console.log('PASS ' + name); }

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = route.replace(/^\/+/, '') || 'index.html';
    const directory = route.startsWith('/react/') || route.startsWith('/assets/') ? path.join(root, 'kagie-web/dist') : root;
    const file = path.resolve(directory, route.startsWith('/react/') ? relative.slice(6) : relative);
    if (!file.startsWith(directory + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, body) => {
      res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(error ? 'Fixture unavailable' : body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  async function open({ reducedMotion = 'no-preference', javaScriptEnabled = true, react = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion, javaScriptEnabled });
    contexts.push(context);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.fulfill({ status: 200, body: '' });
      if (url.pathname === '/js/supabase-config.js') return route.fulfill({ contentType: 'text/javascript', body: 'KagieAPI.configureSupabase({enabled:false});' });
      if (/^\/(?:home|checkout)\.html$|^\/(?:assistant|master-admin)\/dashboard\.html$/.test(url.pathname)) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic destination</title><main>Signed-in destination</main>' });
      return route.continue();
    });
    if (react) await context.addInitScript(() => {
      window.KagieAPI = {
        currentUser: () => null,
        restoreSession: async () => window.holdAppStartup ? new Promise(resolve => { window.releaseAppLoading = resolve; }) : null,
        login: async () => {
          window.signInCalls = (window.signInCalls || 0) + 1;
          await new Promise(resolve => { window.releaseSignIn = resolve; });
          if (window.signInFailure) throw new Error('Invalid login credentials');
          return { id: 'synthetic-staff', fullName: 'Synthetic Staff', email: 'staff@test.invalid', role: 'assistant_admin' };
        }
      };
    });
    const page = await context.newPage();
    page.on('pageerror', error => results.errors.push({ url: page.url(), message: error.message }));
    page.on('console', message => {
      if (message.type() === 'error' && /hydration|hydrated|did not match|didn't match/i.test(message.text())) results.hydrationErrors.push(message.text());
    });
    return { page, context };
  }
  try {
    const { page } = await open();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      check('Landing opens without a splash at ' + width, await page.locator('.kagie-splash-overlay').count() === 0);
      const sample = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      results.samples.push(sample);
      check('Landing fits immediately at ' + width, sample.document <= width);
      await page.screenshot({ path: path.join(out, 'landing-' + width + '.png'), fullPage: false });
      check('Landing is immediately usable at ' + width, !(await page.locator('.page-frame').evaluate(node => node.inert)) && await page.locator('main').isVisible());
    }
    const reduced = await open({ reducedMotion: 'reduce' });
    await reduced.page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await reduced.page.locator('.kagie-splash-overlay').waitFor({ state: 'detached', timeout: 3000 });
    check('Reduced-motion landing has no splash', await reduced.page.locator('.kagie-splash-overlay').count() === 0);
    const noScript = await open({ javaScriptEnabled: false });
    await noScript.page.goto(base + '/');
    check('Landing remains accessible without JavaScript', !(await noScript.page.locator('.kagie-splash-overlay').isVisible()) && await noScript.page.locator('main').isVisible());

    const signIn = (await open()).page;
    await signIn.goto(base + '/login.html?app=1&next=checkout.html');
    await signIn.evaluate(() => {
      window.signInCalls = 0;
      KagieAPI.login = async () => {
        signInCalls++;
        await new Promise(resolve => { window.releaseSignIn = resolve; });
        if (window.signInFailure) throw new Error('Invalid login credentials');
        return { id: 'synthetic-learner', role: 'user' };
      };
    });
    await signIn.locator('#email').fill('learner@test.invalid');
    await signIn.locator('#password').fill('synthetic-password');
    await signIn.locator('#loginBtn').click();
    await signIn.locator('.kagie-splash-overlay').waitFor();
    check('Sign-in displays the supplied splash while authentication is pending', await signIn.locator('.kagie-splash-overlay').isVisible());
    const art = signIn.frameLocator('.kagie-splash-overlay iframe');
    await art.locator('.wordmark img').waitFor();
    await art.locator('body').evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    check('Loading arrow uses the requested blue', await art.locator('.mark img').evaluate(async img => { const svg = await fetch(img.src).then(response => response.text()); return svg.includes('stroke="#2d9df9"') && !svg.includes('#2ec7e6'); }));
    const first = await art.locator('.mark').evaluate(node => getComputedStyle(node).transform);
    const wordmarkPosition = await art.locator('.wordmark').evaluate(node => ({ x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y }));
    await signIn.waitForTimeout(180);
    const second = await art.locator('.mark').evaluate(node => getComputedStyle(node).transform);
    const afterPosition = await art.locator('.wordmark').evaluate(node => ({ x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y }));
    check('The blue arrow rotates while the supplied wordmark stays still', first !== second && JSON.stringify(wordmarkPosition) === JSON.stringify(afterPosition));
    await signIn.screenshot({ path: path.join(out, 'signin-logo-390.png'), fullPage: false });
    await signIn.evaluate(() => {
      window.postMessage({ type: 'kagie:splash:complete' }, location.origin);
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await signIn.waitForTimeout(50);
    check('Unrelated window messages cannot dismiss the splash or duplicate sign-in', await signIn.locator('.kagie-splash-overlay').isVisible() && await signIn.evaluate(() => signInCalls === 1));
    await signIn.evaluate(() => { window.signInFailure = true; releaseSignIn(); });
    await signIn.locator('.kagie-splash-overlay').waitFor({ state: 'detached' });
    await signIn.locator('#loginBtn:enabled').waitFor();
    check('A failed sign-in cancels the splash and restores the filled form', await signIn.locator('#email').inputValue() === 'learner@test.invalid' && await signIn.locator('#password').inputValue() === 'synthetic-password' && !(await signIn.locator('.auth-page-shell').evaluate(node => node.inert)));
    await signIn.evaluate(() => { window.signInFailure = false; });
    await signIn.locator('#loginBtn').click();
    await signIn.locator('.kagie-splash-overlay').waitFor();
    await signIn.evaluate(() => releaseSignIn());
    check('Successful sign-in waits for the splash before routing', new URL(signIn.url()).pathname === '/login.html');
    await signIn.waitForURL(base + '/checkout.html', { timeout: 6000 });
    check('Splash completion preserves the safe learner destination', true);

    const client = (await open({ reducedMotion: 'reduce', react: true })).page;
    await client.goto(base + '/react/index.html#/login');
    await client.locator('.kagie-splash-overlay').waitFor({ state: 'detached' });
    check('React app entry has no launch splash', await client.locator('.kagie-splash-overlay').count() === 0);
    await client.getByLabel('Email address', { exact: true }).fill('staff@test.invalid');
    await client.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await client.getByRole('button', { name: 'Log in', exact: true }).click();
    await client.locator('.kagie-splash-overlay').waitFor();
    check('React sign-in uses the same splash lifecycle', await client.locator('.kagie-splash-overlay').isVisible());
    await client.evaluate(() => { window.signInFailure = true; releaseSignIn(); });
    await client.locator('.kagie-splash-overlay').waitFor({ state: 'detached' });
    await client.getByRole('alert').waitFor();
    check('React sign-in failure removes the splash and restores retry', await client.getByRole('button', { name: 'Log in', exact: true }).isEnabled());
    await client.evaluate(() => { window.signInFailure = false; });
    await client.getByRole('button', { name: 'Log in', exact: true }).click();
    await client.locator('.kagie-splash-overlay').waitFor();
    const reducedArrow = client.frameLocator('.kagie-splash-overlay iframe').locator('.mark');
    await reducedArrow.waitFor();
    check('Reduced-motion sign-in shows a static blue arrow', await reducedArrow.evaluate(node => getComputedStyle(node).animationName === 'none'));
    await client.evaluate(() => releaseSignIn());
    await client.waitForURL(base + '/assistant/dashboard.html', { timeout: 6000 });
    check('React splash completion preserves existing staff routing', true);
    const loadingClient = (await open({ react: true })).page;
    await loadingClient.addInitScript(() => {
      window.holdAppStartup = true;
    });
    await loadingClient.goto(base + '/react/index.html#/login');
    await loadingClient.locator('.kg-loading-logo').waitFor();
    await loadingClient.locator('.kg-loading-wordmark img').evaluate(img => img.decode());
    const loadingArrow = loadingClient.locator('.kg-loading-brand-arrow');
    const initialRotation = await loadingArrow.evaluate(node => getComputedStyle(node).transform);
    await loadingClient.waitForTimeout(180);
    check('App loading uses the logo and a rotating blue arrow', initialRotation !== await loadingArrow.evaluate(node => getComputedStyle(node).transform));
    await loadingClient.screenshot({ path: path.join(out, 'app-logo-390.png'), fullPage: false });
    await loadingClient.evaluate(() => releaseAppLoading(null));
    await loadingClient.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    check('The app logo loader clears when the actual startup operation finishes', await loadingClient.locator('.kg-loading-logo').count() === 0);
    check('Splash flows have no uncaught browser errors', results.errors.length === 0);
    check('Landing launch does not cause hydration errors', results.hydrationErrors.length === 0);
  } catch (error) {
    results.failure = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 2));
    for (const context of contexts) await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log('Splash verified: ' + results.checks.length + ' checks, zero real sign-ins.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
