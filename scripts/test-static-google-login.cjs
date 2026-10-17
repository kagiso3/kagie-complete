/* Real static login UI and bundled SDK; only provider/restore are synthetic. No real sign-ins. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/google-login');
const report = { checks: [], samples: [], errors: [], blocked: [], nativeReturns: [] };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function check(name, condition) { assert.ok(condition, name); report.checks.push(name); console.log('PASS ' + name); }
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, pathname.replace(/^\/+/, '') || 'login.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, body) => {
      res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(error ? 'Fixture unavailable' : body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  async function open({ route = '/login.html?app=1', restored = null, restoreError = '', holdGoogle = true, providerError = '', width = 390, nativeVersion = null, browserReturn = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    contexts.push(context);
    const requests = [];
    if (nativeVersion !== null) await context.addInitScript(version => { window.KagieNativeOAuth = { version }; }, nativeVersion);
    await context.route('kagie://**', requestRoute => requestRoute.abort());
    await context.route('**/*', requestRoute => {
      const request = requestRoute.request(), url = new URL(request.url());
      requests.push(url.origin + url.pathname);
      if (url.protocol === 'kagie:') return requestRoute.abort();
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) return requestRoute.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8') });
      if (url.origin !== base) {
        report.blocked.push(url.origin + url.pathname);
        return requestRoute.fulfill({ body: '', contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'text/javascript' });
      }
      if (url.pathname === '/js/supabase-config.js') return requestRoute.fulfill({ contentType: 'text/javascript', body: `
        KagieAPI.configureSupabase({enabled:false});
        window.googleFixture = {calls:[],releases:[],restoreCalls:0,restored:${JSON.stringify(restored)},restoreError:${JSON.stringify(restoreError)},holdGoogle:${holdGoogle},providerError:${JSON.stringify(providerError)}};
        KagieAPI.restoreSession = async () => { googleFixture.restoreCalls++; if(googleFixture.restoreError) throw new Error(googleFixture.restoreError); return googleFixture.restored; };
        KagieAPI.signInWithGoogle = async options => { const index=googleFixture.calls.length; googleFixture.calls.push(options); if(googleFixture.holdGoogle) await new Promise(resolve=>{googleFixture.releaseGoogle=resolve;googleFixture.releases[index]=resolve;}); if(googleFixture.providerError) throw new Error(googleFixture.providerError); return {provider:'google'}; };
      ` });
      if (/^\/(?:home|upload|checkout|Dashboard)\.html$|^\/(?:assistant|master-admin)\/dashboard\.html$/.test(url.pathname)) return requestRoute.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated sign-in destination</title><main>Account routing destination</main>' });
      if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/api/')) return requestRoute.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unexpected fixture request blocked."}' });
      return requestRoute.continue();
    });
    const page = await context.newPage();
    page.fixtureRequests = requests;
    page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
    await page.goto(base + route, { waitUntil: browserReturn ? 'commit' : 'load' });
    if (browserReturn) await page.locator('.kagie-native-return').waitFor();
    else await page.waitForFunction(() => window.googleFixture?.restoreCalls >= 1);
    return page;
  }
  async function providerCall(page, count = 1) {
    await page.waitForFunction(count => googleFixture.calls.length === count, count);
    return page.evaluate(() => googleFixture.calls.at(-1));
  }
  const learner = { id: 'fixture-learner', fullName: 'Fixture Learner', role: 'user' };
  try {
    const normal = await open();
    check('Real backend and bundled Supabase SDK load for the static login fixture', await normal.evaluate(() => typeof KagieAPI.login === 'function' && typeof KagieUX.setFormLoading === 'function' && typeof supabase.createClient === 'function'));
    check('Google button is visible and Apple sign-in is absent', await normal.getByRole('button', { name: 'Continue with Google', exact: true }).isVisible() && await normal.getByRole('button', { name: /apple/i }).count() === 0);
    check('The Google brand SVG is included', await normal.locator('#googleLoginBtn svg').count() === 1 && await normal.locator('#googleLoginBtn svg path[fill]').count() === 4);
    for (const width of [320, 390, 768, 1440]) {
      await normal.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      const sample = await normal.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, googleHeight: document.getElementById('googleLoginBtn').getBoundingClientRect().height }));
      report.samples.push(sample);
      check('Google login fits and has a usable button at ' + width, sample.documentWidth <= width + 1 && sample.googleHeight >= 44);
      if ([390, 1440].includes(width)) await normal.screenshot({ path: path.join(out, 'login-' + width + '.png'), fullPage: true });
    }
    await normal.locator('#googleLoginBtn').click();
    const unchecked = await providerCall(normal);
    check('Google sign-in bypasses missing email and password validation', await normal.locator('#email').inputValue() === '' && await normal.locator('#password').inputValue() === '' && !(await normal.locator('#emailError').isVisible()) && !(await normal.locator('#passwordError').isVisible()));
    const uncheckedCallback = new URL(unchecked.redirectTo);
    check('Unchecked remember sends persist false and the marked same-origin callback', unchecked.persist === false && uncheckedCallback.origin === base && uncheckedCallback.pathname === '/login.html' && uncheckedCallback.searchParams.get('oauth') === 'google' && uncheckedCallback.searchParams.get('app') === '1' && !uncheckedCallback.searchParams.has('next'));
    check('Provider pending locks Google, password and editable controls', await normal.locator('#googleLoginBtn').isDisabled() && await normal.locator('#loginBtn').isDisabled() && await normal.locator('#email').isDisabled() && await normal.locator('#password').isDisabled() && await normal.locator('#rememberSession').isDisabled() && await normal.locator('#togglePassword').isDisabled() && await normal.locator('#loginForm').getAttribute('aria-busy') === 'true');
    check('Only the provider button gets the Opening Google label', /Opening Google/.test(await normal.locator('#googleLoginBtn').innerText()) && await normal.locator('#loginBtn .auth-button-label').innerText() === 'Log in');
    await normal.evaluate(() => {
      document.getElementById('email').value = 'edited-learner@test.invalid';
      document.getElementById('password').value = 'fixture-password';
      document.getElementById('googleLoginBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await normal.waitForTimeout(80);
    check('Pending provider sign-in blocks duplicate Google and password submits', await normal.evaluate(() => googleFixture.calls.length === 1) && await normal.locator('#loginBtn').isDisabled() && await normal.locator('#message').innerText() === '');
    await normal.evaluate(() => { googleFixture.providerError = 'Invalid api key with private diagnostic detail'; googleFixture.releaseGoogle(); });
    await normal.locator('#googleLoginBtn:enabled').waitFor();
    check('Provider failure restores controls, edited fields and the Google SVG', await normal.locator('#email').inputValue() === 'edited-learner@test.invalid' && await normal.locator('#password').inputValue() === 'fixture-password' && await normal.locator('#googleLoginBtn svg path[fill]').count() === 4 && await normal.locator('#googleLoginBtn').innerText() === 'Continue with Google' && await normal.locator('#loginBtn').isEnabled());
    check('Provider failure displays a friendly message without raw diagnostics', /temporarily unavailable/.test(await normal.locator('#message').innerText()) && !/api key|private diagnostic/i.test(await normal.locator('#message').innerText()));
    await normal.locator('#rememberSession').check();
    await normal.evaluate(() => { googleFixture.providerError = ''; });
    await normal.locator('#googleLoginBtn').click();
    const checked = await providerCall(normal, 2);
    check('Checked remember sends persist true on retry', checked.persist === true);
    await normal.evaluate(() => googleFixture.releaseGoogle());
    await normal.getByText('Opening Google to choose your account...', { exact: true }).waitFor();
    check('Successful provider start stays locked while the external handoff is pending', await normal.locator('#googleLoginBtn').isDisabled() && await normal.locator('#loginBtn').isDisabled());
    await normal.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    check('Browser-back pageshow unlocks retry and restores both button labels', await normal.locator('#googleLoginBtn').isEnabled() && await normal.locator('#loginBtn').isEnabled() && await normal.locator('#googleLoginBtn').innerText() === 'Continue with Google' && await normal.locator('#loginBtn .auth-button-label').innerText() === 'Log in' && await normal.locator('#googleLoginBtn svg path[fill]').count() === 4);
    const emailRetryLabels = await normal.evaluate(() => {
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      window.dispatchEvent(new CustomEvent('kagie:native-oauth-error', { detail: { version: 1, message: 'private native diagnostics' } }));
      window.dispatchEvent(new CustomEvent('kagie:native-oauth-resume', { detail: { version: 1 } }));
      // Capture the synchronous pending UI before the real disabled-fixture backend rejects login.
      return { google: document.getElementById('googleLoginBtn').innerText, password: document.getElementById('loginBtn').innerText, locked: document.getElementById('loginBtn').disabled && document.getElementById('email').disabled };
    });
    check('Email retry after Google uses the password spinner and preserves the Google label', emailRetryLabels.google === 'Continue with Google' && /Logging in/.test(emailRetryLabels.password));
    check('Unrelated native OAuth events cannot unlock a pending password sign-in', emailRetryLabels.locked);
    await normal.locator('#loginBtn:enabled').waitFor();

    const safeNext = 'checkout.html?applicationId=fixture-order#payment';
    const nextPage = await open({ route: '/login.html?next=' + encodeURIComponent(safeNext) });
    await nextPage.locator('#googleLoginBtn').click();
    const linked = new URL((await providerCall(nextPage)).redirectTo);
    check('The Google callback retains a safe learner destination including its query and hash', linked.searchParams.get('next') === safeNext && linked.searchParams.get('oauth') === 'google');
    for (const next of ['https://outside.test.invalid/account', '//outside.test.invalid/account', 'javascript:alert(1)', 'http://[bad', 'assistant/dashboard.html']) {
      const denied = await open({ route: '/login.html?next=' + encodeURIComponent(next) });
      await denied.locator('#googleLoginBtn').click();
      const callback = new URL((await providerCall(denied)).redirectTo);
      check('Unsafe or invalid next is dropped: ' + next, callback.origin === base && !callback.searchParams.has('next'));
    }

    for (const item of [
      { name: 'query cancellation', route: '/login.html?app=1&oauth=google&next=upload.html&error=access_denied&error_description=private-provider-detail&code=secret-code', message: /was canceled/ },
      { name: 'hash cancellation', route: '/login.html?app=1#' + new URLSearchParams({ error: 'user_cancelled', error_description: 'private-provider-detail' }), message: /was canceled/ },
      { name: 'query failure', route: '/login.html?oauth=google&error=server_error&error_description=private-provider-detail', message: /could not be completed/ },
      { name: 'hash failure', route: '/login.html?app=1#' + new URLSearchParams({ error_code: 'unexpected_failure', error_description: 'private-provider-detail', access_token: 'private-token' }), message: /could not be completed/ }
    ]) {
      const errorPage = await open({ route: item.route });
      await errorPage.locator('#message.error').waitFor();
      const message = await errorPage.locator('#message').innerText();
      check(item.name + ' is friendly, removes callback secrets and allows retry', item.message.test(message) && !/private-provider-detail|private-token|server_error|unexpected_failure/.test(message) && !/error|code|oauth|private/.test(new URL(errorPage.url()).search) && new URL(errorPage.url()).hash === '' && await errorPage.locator('#googleLoginBtn').isEnabled());
    }
    const learnerReturn = await open({ route: '/login.html?app=1&oauth=google&code=fixture-code&next=' + encodeURIComponent(safeNext), restored: learner });
    await learnerReturn.waitForURL(base + '/' + safeNext);
    check('A successful Google callback routes a learner to the safe requested destination', true);
    const defaultReturn = await open({ route: '/login.html?oauth=google&code=fixture-code&next=' + encodeURIComponent('https://outside.test.invalid/'), restored: learner });
    await defaultReturn.waitForURL(base + '/home.html');
    check('A callback with an external next routes the learner home', true);
    for (const role of ['assistant_admin', 'master_admin']) {
      const staff = await open({ route: '/login.html?oauth=google&code=fixture-code&next=upload.html', restored: { ...learner, role } });
      await staff.waitForURL(base + '/' + (role === 'assistant_admin' ? 'assistant' : 'master-admin') + '/dashboard.html');
      check('Google callback prioritizes the ' + role + ' workspace over a learner next', true);
    }
    const missing = await open({ route: '/login.html?app=1&oauth=google&code=fixture-code&next=upload.html' });
    await missing.locator('#message.error').waitFor();
    check('A callback without a session clears its code and offers Google/email retry', /did not finish/.test(await missing.locator('#message').innerText()) && !new URL(missing.url()).searchParams.has('code') && !new URL(missing.url()).searchParams.has('oauth') && new URL(missing.url()).searchParams.get('next') === 'upload.html' && await missing.locator('#googleLoginBtn').isEnabled() && await missing.locator('#loginBtn').isEnabled());
    const broken = await open({ route: '/login.html?oauth=google&code=fixture-code', restoreError: 'private callback token diagnostic' });
    await broken.locator('#message.error').waitFor();
    check('Failed callback session restore offers friendly retry without technical details', /could not be completed/.test(await broken.locator('#message').innerText()) && !/private|token|diagnostic/.test(await broken.locator('#message').innerText()) && new URL(broken.url()).search === '' && await broken.locator('#googleLoginBtn').isEnabled());
    const idle = await open({ restoreError: 'private normal session diagnostic' });
    check('A missing ordinary session leaves Google and email sign-in available', await idle.locator('#googleLoginBtn').isEnabled() && await idle.locator('#loginBtn').isEnabled() && await idle.locator('#message').innerText() === '');

    const native = await open({ nativeVersion: 1, route: '/login.html?app=1&next=upload.html' });
    await native.locator('#googleLoginBtn').click();
    const nativeCallback = new URL((await providerCall(native)).redirectTo);
    check('Version 1 native marker adds native_auth to the safe Google callback', nativeCallback.origin === base && nativeCallback.searchParams.get('native_auth') === '1' && nativeCallback.searchParams.get('oauth') === 'google' && nativeCallback.searchParams.get('next') === 'upload.html');
    await native.evaluate(() => window.dispatchEvent(new CustomEvent('kagie:native-oauth-error', { detail: { version: 2 } })));
    check('Unrelated bridge versions cannot unlock a pending Google sign-in', await native.locator('#googleLoginBtn').isDisabled());
    await native.evaluate(() => window.dispatchEvent(new CustomEvent('kagie:native-oauth-error', { detail: { version: 1, message: 'private native browser diagnostic' } })));
    check('Native browser-opening errors unlock retry with a friendly message', await native.locator('#googleLoginBtn').isEnabled() && await native.locator('#loginBtn').isEnabled() && /could not open your browser/.test(await native.locator('#message').innerText()) && !/private|diagnostic/.test(await native.locator('#message').innerText()) && await native.locator('#googleLoginBtn svg path[fill]').count() === 4);
    await native.locator('#googleLoginBtn').click();
    await providerCall(native, 2);
    await native.evaluate(() => window.dispatchEvent(new CustomEvent('kagie:native-oauth-resume', { detail: { version: 1 } })));
    check('Native browser resume unlocks Google and email for retry', await native.locator('#googleLoginBtn').isEnabled() && await native.locator('#loginBtn').isEnabled() && /try Google again/.test(await native.locator('#message').innerText()));
    await native.locator('#email').fill('native-retry@test.invalid');
    await native.locator('#password').fill('fixture-password');
    await native.locator('#loginBtn').click();
    await native.locator('#loginBtn:enabled').waitFor();
    const passwordRetryMessage = await native.locator('#message').innerText();
    await native.evaluate(() => { googleFixture.providerError = 'Late provider network diagnostic'; googleFixture.releases[1](); });
    await native.waitForTimeout(50);
    check('A late native Google rejection cannot overwrite the newer email retry result', await native.locator('#message').innerText() === passwordRetryMessage && await native.locator('#googleLoginBtn').isEnabled() && await native.locator('#loginBtn .auth-button-label').innerText() === 'Log in');
    await native.evaluate(() => { googleFixture.providerError = ''; });
    await native.locator('#googleLoginBtn').click();
    await providerCall(native, 3);
    await native.evaluate(() => { googleFixture.providerError = 'Old provider network diagnostic'; googleFixture.releases[0](); });
    await native.waitForTimeout(50);
    check('An older rejected Google attempt cannot unlock or change a newer Google retry', await native.locator('#googleLoginBtn').isDisabled() && await native.locator('#loginBtn').isDisabled() && /Opening Google/.test(await native.locator('#googleLoginBtn').innerText()) && await native.locator('#message').innerText() === '');
    await native.evaluate(() => { googleFixture.providerError = ''; googleFixture.releases[2](); });
    await native.getByText('Opening Google to choose your account...', { exact: true }).waitFor();
    check('The current Google retry still completes its external-browser handoff', await native.locator('#googleLoginBtn').isDisabled() && await native.locator('#loginBtn').isDisabled());
    const lateSuccess = await open();
    await lateSuccess.locator('#googleLoginBtn').click();
    await providerCall(lateSuccess);
    await lateSuccess.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await lateSuccess.locator('#googleLoginBtn').click();
    await providerCall(lateSuccess, 2);
    await lateSuccess.evaluate(() => googleFixture.releases[0]());
    await lateSuccess.waitForTimeout(50);
    check('A stale successful provider result after browser-back cannot replace a newer retry message', await lateSuccess.locator('#message').innerText() === '' && await lateSuccess.locator('#googleLoginBtn').isDisabled());
    const state = 'a1'.repeat(32);
    const bridgeRoute = '/login.html?app=1&oauth=google&native_auth=1&native_state=' + state;
    const returned = await open({ route: bridgeRoute + '&code=fixture-native-code&next=upload.html', browserReturn: true });
    const returnedURL = new URL(await returned.locator('#nativeOAuthReturn').getAttribute('href'));
    check('External native callback offers only the code and state to the app link', returnedURL.protocol === 'kagie:' && returnedURL.hostname === 'auth' && returnedURL.pathname === '/google' && returnedURL.searchParams.get('code') === 'fixture-native-code' && returnedURL.searchParams.get('native_state') === state && [...returnedURL.searchParams.keys()].sort().join(',') === 'code,native_state');
    check('The native browser return loads no backend, Supabase SDK or runtime configuration', await returned.evaluate(() => !window.KagieAPI && !window.supabase && window.KagieNativeOAuthReturning === true) && !returned.fixtureRequests.some(url => /supabase-js|\/js\/(backend|supabase-config)\.js|\/api\//.test(url)));
    check('The native return removes the OAuth code and state from the browser address', !new URL(returned.url()).searchParams.has('code') && !new URL(returned.url()).searchParams.has('native_state'));
    report.nativeReturns.push({ kind: 'code', requests: returned.fixtureRequests, cleanedURL: returned.url() });
    await returned.screenshot({ path: path.join(out, 'native-browser-return-390.png'), fullPage: true });
    const marked = await open({ nativeVersion: 1, route: bridgeRoute + '&code=fixture-native-code' });
    check('A marked WebView exchanges its callback through the normal login instead of trampolining', await marked.locator('#googleLoginBtn').isVisible() && await marked.locator('#nativeOAuthReturn').count() === 0 && await marked.evaluate(() => !window.KagieNativeOAuthReturning && typeof KagieAPI.restoreSession === 'function' && typeof supabase.createClient === 'function'));
    for (const item of [
      { name: 'query cancellation', suffix: '&error=access_denied&error_description=private-provider-detail', error: 'access_denied' },
      { name: 'hash cancellation', suffix: '#error=access_denied&error_description=private-provider-detail', error: 'access_denied' },
      { name: 'hash provider failure', suffix: '#error_code=unexpected_failure&error_description=private-provider-detail', error: 'unexpected_failure' }
    ]) {
      const canceled = await open({ route: bridgeRoute + item.suffix, browserReturn: true });
      const link = new URL(await canceled.locator('#nativeOAuthReturn').getAttribute('href'));
      check('Native ' + item.name + ' sends a safe error without raw provider details', link.searchParams.get('error') === item.error && link.searchParams.get('native_state') === state && !link.searchParams.has('code') && !link.searchParams.has('error_description') && !/private-provider-detail|private-token/.test(link.toString()) && !/private-provider-detail|private-token/.test(await canceled.locator('body').innerText()));
      check('Native ' + item.name + ' cleans callback secrets and avoids SDK/runtime loading', !/error|private|native_state/.test(new URL(canceled.url()).search + new URL(canceled.url()).hash) && await canceled.evaluate(() => !window.KagieAPI && !window.supabase) && !canceled.fixtureRequests.some(url => /supabase-js|\/js\/(backend|supabase-config)\.js|\/api\//.test(url)));
      report.nativeReturns.push({ kind: item.name, requests: canceled.fixtureRequests, cleanedURL: canceled.url() });
    }
    const invalidState = await open({ route: '/login.html?oauth=google&native_auth=1&code=fixture-native-code&native_state=invalid', browserReturn: true });
    check('An invalid native state exposes no app link and no callback secrets', await invalidState.locator('#nativeOAuthReturn').count() === 0 && /Sign-in could not return/.test(await invalidState.locator('h1').innerText()) && !new URL(invalidState.url()).searchParams.has('code') && !new URL(invalidState.url()).searchParams.has('native_state'));
    const rejectedTokens = await open({ route: bridgeRoute + '#access_token=private-token&refresh_token=private-refresh', browserReturn: true });
    check('Implicit tokens are never forwarded, stay out of the UI and are erased without loading the SDK', await rejectedTokens.locator('#nativeOAuthReturn').count() === 0 && !/private-token|private-refresh/.test(await rejectedTokens.locator('body').innerText()) && new URL(rejectedTokens.url()).hash === '' && await rejectedTokens.evaluate(() => !window.KagieAPI && !window.supabase) && !rejectedTokens.fixtureRequests.some(url => /supabase-js|\/js\/(backend|supabase-config)\.js|\/api\//.test(url)));
    check('Static Google login raised no uncaught page errors', report.errors.length === 0);
    console.log('Completed ' + report.checks.length + ' static Google login checks.');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
