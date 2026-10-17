/* Fresh React startup with canonical runtime, bundled Supabase SDK, and isolated auth configuration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'kagie-web', 'dist');
const out = path.join(root, 'reports', 'google-oauth');
const results = { checks: [], requests: [], errors: [], blocked: [] };
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function check(name, value) { assert(value, name); results.checks.push(name); console.log('PASS ' + name); }

async function main() {
  fs.mkdirSync(out, { recursive: true });
  for (const name of ['data.js', 'backend.js', 'supabase-config.js', 'sa-catalog.js', 'native-auth-return.js']) {
    const canonical = digest(path.join(root, 'js', name));
    check('React public and built runtime use canonical ' + name,
      digest(path.join(root, 'kagie-web', 'public', 'legacy', 'js', name)) === canonical &&
      digest(path.join(dist, 'legacy', 'js', name)) === canonical);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const relative = url.pathname === '/react/index.html' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dist, relative);
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  let configurationRequests = 0;
  try {
    // Observation only: do not inject, replace, or seed window.KagieAPI.
    await context.addInitScript(() => {
      window.freshRuntimeBeforeScripts = { apiExists: Boolean(window.KagieAPI), storedKeys: Object.keys(localStorage) };
    });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) {
        return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8') });
      }
      if (url.origin !== base) {
        results.blocked.push(url.origin + url.pathname);
        return route.abort();
      }
      if (url.pathname === '/api/runtime-config') {
        configurationRequests += 1;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { appName: 'Kagie', apiBaseUrl: base, supabase: { enabled: true, url: base, anonKey: 'synthetic-auth-only' } } }) });
      }
      if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/v1/')) {
        const body = request.postDataJSON();
        results.requests.push({ path: url.pathname, method: request.method(), hasVerifier: Boolean(body?.code_verifier) });
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Synthetic authentication code rejected.' }) });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => results.errors.push(error.message));
    await page.goto(base + '/react/index.html?next=apply#/login');
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).waitFor();
    await page.evaluate(() => window.__kagieRuntimeConfigPromise);
    const state = await page.evaluate(() => ({
      before: window.freshRuntimeBeforeScripts,
      supabase: { enabled: window.KagieAPI.getSettings().supabase.enabled, url: window.KagieAPI.getSettings().supabase.url },
      user: window.KagieAPI.currentUser(),
      sdk: typeof window.supabase?.createClient,
      runtimeScripts: [...document.querySelectorAll('script[data-kagie-runtime]')].map(script => script.dataset.kagieRuntime)
    }));
    check('Fresh React startup begins without KagieAPI or a cached account', !state.before.apiExists && state.before.storedKeys.length === 0);
    check('Real runtime config executes and enables the synthetic Supabase service', configurationRequests === 1 && state.supabase.enabled && state.supabase.url === base);
    check('Fresh runtime stays signed out until authentication', state.user === null);
    check('Real bundled Supabase SDK initializes', state.sdk === 'function');
    check('Runtime initializes backend before applying Supabase configuration', state.runtimeScripts.indexOf('/legacy/js/backend.js') < state.runtimeScripts.indexOf('/legacy/js/supabase-config.js'));

    const result = await page.evaluate(async () => {
      const callback = new URL(window.location.pathname, window.location.origin);
      callback.searchParams.set('oauth', 'google');
      callback.searchParams.set('next', 'apply');
      return window.KagieAPI.signInWithGoogle({ persist: false, redirectTo: callback.toString(), skipBrowserRedirect: true });
    });
    const authorize = new URL(result.url), callback = new URL(authorize.searchParams.get('redirect_to'));
    check('Fresh runtime constructs a Google authorization URL at the synthetic auth origin', authorize.origin === base && authorize.pathname === '/auth/v1/authorize' && authorize.searchParams.get('provider') === 'google');
    check('Google authorization uses PKCE and the account chooser', authorize.searchParams.get('code_challenge_method') === 's256' && Boolean(authorize.searchParams.get('code_challenge')) && authorize.searchParams.get('prompt') === 'select_account');
    check('Google callback uses the current React document and safe route without a hash', callback.origin === base && callback.pathname === '/react/index.html' && callback.searchParams.get('oauth') === 'google' && callback.searchParams.get('next') === 'apply' && callback.hash === '');
    check('The API probe does not navigate or authenticate a real user', page.url().endsWith('?next=apply#/login') && results.requests.length === 0);
    check('Fresh React runtime has no browser errors', results.errors.length === 0);
    await page.screenshot({ path: path.join(out, 'react-fresh-runtime-390.png'), fullPage: true });

    for (const search of ['code=synthetic-native-code&code_verifier=never-forward-this-verifier', 'error=access_denied&error_description=cancelled', 'code=synthetic-native-code&access_token=never-forward-this-token&refresh_token=never-forward-this-refresh']) {
      const externalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      let externalConfigurationRequests = 0;
      await externalContext.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8') });
        if (url.origin !== base) return route.abort();
        if (url.pathname === '/api/runtime-config' || url.pathname.startsWith('/auth/v1/')) {
          externalConfigurationRequests += 1;
          return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        }
        return route.continue();
      });
      const externalPage = await externalContext.newPage();
      externalPage.on('pageerror', error => results.errors.push(error.message));
      await externalPage.goto(base + '/react/index.html?oauth=google&native_auth=1&native_state=' + 'a'.repeat(64) + '&' + search, { waitUntil: 'commit' });
      const returnLink = externalPage.locator('a[href^="kagie://auth/google"]');
      const tokenCallback = search.includes('access_token');
      if (tokenCallback) await externalPage.getByRole('heading', { name: 'Sign-in could not return to Kagie' }).waitFor();
      else await returnLink.waitFor();
      check('External native OAuth return offers the app handoff without initializing React auth', await externalPage.evaluate(() => window.KagieNativeOAuthReturning === true && !window.KagieAPI && document.querySelectorAll('script[data-kagie-runtime]').length === 0) && externalConfigurationRequests === 0);
      if (tokenCallback) {
        check('Token-bearing native callback is refused and removed from browser history', await returnLink.count() === 0 && !new URL(externalPage.url()).searchParams.has('access_token') && !new URL(externalPage.url()).searchParams.has('refresh_token'));
      } else {
        const nativeReturn = new URL(await returnLink.getAttribute('href'));
        check('Native handoff forwards code or error and return state, without tokens or PKCE verifier', nativeReturn.protocol === 'kagie:' && nativeReturn.searchParams.get('native_state') === 'a'.repeat(64) && !nativeReturn.searchParams.has('access_token') && !nativeReturn.searchParams.has('refresh_token') && !nativeReturn.searchParams.has('code_verifier') && (search.startsWith('code=') ? nativeReturn.searchParams.get('code') === 'synthetic-native-code' : nativeReturn.searchParams.get('error') === 'access_denied'));
        if (search.startsWith('code=')) await externalPage.screenshot({ path: path.join(out, 'react-native-return-390.png'), fullPage: true });
      }
      await externalContext.close();
    }

    await context.addInitScript(() => {
      window.KagieNativeOAuth = { version: 1 };
      window.ReactNativeWebView = { postMessage() {} };
    });
    await page.goto(base + '/react/index.html?oauth=google&native_auth=1&native_state=' + 'a'.repeat(64) + '&next=apply&code=synthetic-return-code');
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).waitFor();
    check('The injected WebView marker keeps its HTTPS callback inside the React app', await page.evaluate(() => window.KagieNativeOAuth?.version === 1 && !window.KagieNativeOAuthReturning && Boolean(window.KagieAPI)));
    check('WebView callback exchanges its code using the verifier retained in the same browser storage', results.requests.some(request => request.path === '/auth/v1/token' && request.method === 'POST' && request.hasVerifier));
    check('The handled WebView callback clears native return parameters', !new URL(page.url()).searchParams.has('native_auth') && !new URL(page.url()).searchParams.has('code'));
    check('Native return boundaries have no browser runtime errors', results.errors.length === 0);
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(out, 'react-fresh-runtime.json'), JSON.stringify(results, null, 2));
  }
  console.log('Fresh React runtime verified: ' + results.checks.length + ' checks. Real SDK and runtime files; no Google account sign-in or production writes.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
