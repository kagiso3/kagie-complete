/* Real bundled Supabase SDK, synthetic local Auth/REST responses only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/google-oauth');
const checks = [], requests = [], errors = [];
const id = 'a087a2e0-0000-4000-8000-000000000091';
const user = {
  id, email: 'google-learner@test.invalid', role: 'authenticated', aud: 'authenticated',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { name: 'Google Test Learner', avatar_url: 'https://images.test.invalid/avatar.png', role: 'master_admin' }
};
const jwt = () => [
  { alg: 'HS256', typ: 'JWT' },
  { sub: id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' },
].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.c3ludGhldGlj';

async function main() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/oauth-fixture.html') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      return res.end('<!doctype html><meta charset="utf-8"><title>Isolated Google auth fixture</title><script src="/sdk.js"></script><script src="/js/backend.js"></script><main>Local auth test</main>');
    }
    const file = pathname === '/sdk.js' ? path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js') : pathname === '/js/backend.js' ? path.join(root, 'js/backend.js') : null;
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  async function check(name, work) { await work(); checks.push(name); console.log('PASS ' + name); }
  async function fixture({ authUser = user, profile = null, roleStatus = 200, role = null, tokenError = false } = {}) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    contexts.push(context);
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) return route.abort();
      const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname === '/api/auth/role') {
        requests.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
        if (url.pathname === '/auth/v1/token') return tokenError ? json(400, { error: 'invalid_grant', error_description: 'The authentication code has expired.' }) : json(200, { access_token: jwt(), refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_in: 3600, user: authUser });
        if (url.pathname === '/auth/v1/user') return json(200, authUser);
        if (url.pathname === '/auth/v1/logout') return json(200, {});
        if (url.pathname === '/rest/v1/profiles' && request.method() === 'GET') return json(200, profile ? [profile] : []);
        if (url.pathname === '/api/auth/role') return json(roleStatus, roleStatus === 200 ? { data: { id, supabaseUserId: id, role: role || 'user', profile } } : { message: 'Access refused.' });
        return json(503, { message: 'Unexpected fixture request blocked.' });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/oauth-fixture.html?app=1&next=upload.html#login', { waitUntil: 'load' });
    await page.evaluate(configuration => window.KagieAPI.configureSupabase(configuration), { enabled: true, url: base, anonKey: 'synthetic-auth-only', authRoleEndpoint: role === null && roleStatus === 200 ? '' : base + '/api/auth/role' });
    return { page, context };
  }
  async function start(page, persist = false) {
    return page.evaluate(persist => window.KagieAPI.signInWithGoogle({ persist, skipBrowserRedirect: true, queryParams: { prompt: 'consent' } }), persist);
  }
  async function callback(page, result, code = 'synthetic-google-code') {
    const url = new URL(result.url).searchParams.get('redirect_to');
    const callbackUrl = new URL(url); callbackUrl.searchParams.set('code', code);
    await page.goto(callbackUrl.toString(), { waitUntil: 'load' });
    // The runtime uses persisted public configuration, as on the deployed site.
    return page.evaluate(() => window.KagieAPI.restoreSession());
  }
  try {
    await check('Google request preserves app/next, forces account chooser, and uses PKCE', async () => {
      const { page } = await fixture();
      const result = await start(page);
      const authorize = new URL(result.url), target = new URL(authorize.searchParams.get('redirect_to'));
      assert.equal(authorize.searchParams.get('provider'), 'google');
      assert.equal(authorize.searchParams.get('prompt'), 'select_account');
      assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
      assert.ok(authorize.searchParams.get('code_challenge'));
      assert.equal(target.origin, base); assert.equal(target.pathname, '/oauth-fixture.html');
      assert.equal(target.searchParams.get('app'), '1'); assert.equal(target.searchParams.get('next'), 'upload.html');
      assert.equal(target.searchParams.get('oauth'), 'google'); assert.equal(target.hash, '');
    });
    await check('External, protocol, and credential callback URLs are refused', async () => {
      const { page } = await fixture();
      for (const redirectTo of ['https://evil.test.invalid/login.html', '//evil.test.invalid/login.html', 'javascript:alert(1)', base.replace('://', '://user:pass@') + '/login.html']) {
        const message = await page.evaluate(async redirectTo => { try { await window.KagieAPI.signInWithGoogle({ redirectTo, skipBrowserRedirect: true }); return ''; } catch (error) { return error.message; } }, redirectTo);
        assert.match(message, /return to a Kagie page/);
      }
      assert.equal(await page.evaluate(() => sessionStorage.getItem('kagie_oauth_intent')), null);
    });
    await check('OAuth start waits for runtime configuration', async () => {
      const { page } = await fixture();
      await page.evaluate(() => {
        window.KagieAPI.configureSupabase({ enabled: false });
        window.__kagieRuntimeConfigPromise = new Promise(resolve => { window.releaseConfig = resolve; });
        window.pendingGoogle = window.KagieAPI.signInWithGoogle({ skipBrowserRedirect: true });
        window.googleSettled = false; window.pendingGoogle.then(() => { window.googleSettled = true; });
      });
      assert.equal(await page.evaluate(() => window.googleSettled), false);
      const result = await page.evaluate(async configuration => {
        window.KagieAPI.configureSupabase(configuration); window.releaseConfig();
        return window.pendingGoogle;
      }, { enabled: true, url: base, anonKey: 'synthetic-auth-only' });
      assert.equal(new URL(result.url).searchParams.get('provider'), 'google');
    });
    await check('Native Google bridge posts only authorization URL and bound intent without browser navigation', async () => {
      const { page } = await fixture();
      await page.evaluate(() => {
        window.KAGIE_NATIVE_ANDROID = true; window.KagieNativeOAuth = { version: 1 };
        window.nativeMessages = []; window.ReactNativeWebView = { postMessage: value => window.nativeMessages.push(JSON.parse(value)) };
      });
      const originalUrl = page.url();
      const result = await page.evaluate(() => window.KagieAPI.signInWithGoogle({ persist: false }));
      const messages = await page.evaluate(() => window.nativeMessages);
      assert.equal(messages.length, 1); assert.equal(page.url(), originalUrl);
      const message = messages[0], target = new URL(message.redirectTo);
      assert.equal(message.type, 'kagie:oauth:start'); assert.equal(message.version, 1);
      assert.equal(message.provider, 'google'); assert.equal(message.persist, false);
      assert.equal(message.authorizationUrl, result.url); assert.ok(Number.isFinite(message.startedAt));
      assert.deepEqual(Object.keys(message).sort(), ['authorizationUrl', 'persist', 'provider', 'redirectTo', 'startedAt', 'type', 'version']);
      assert.equal(target.searchParams.get('native_auth'), '1'); assert.match(target.searchParams.get('native_state'), /^[a-f0-9]{64}$/);
      assert.equal(new URL(message.authorizationUrl).searchParams.get('redirect_to'), message.redirectTo);
      const intent = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kagie_oauth_intent')));
      assert.deepEqual(intent, { provider: message.provider, redirectTo: message.redirectTo, persist: message.persist, startedAt: message.startedAt });
    });
    await check('Outdated or incomplete native bridges refuse Google navigation', async () => {
      const { page } = await fixture();
      for (const version of [null, 1, 2]) {
        await page.evaluate(version => { window.KAGIE_NATIVE_ANDROID = true; window.KagieNativeOAuth = version === null ? undefined : { version }; window.ReactNativeWebView = undefined; }, version);
        const error = await page.evaluate(async () => { try { await window.KagieAPI.signInWithGoogle(); return ''; } catch (error) { return error.message; } });
        assert.match(error, /updated Kagie app/);
      }
      assert.equal(await page.evaluate(() => sessionStorage.getItem('kagie_oauth_intent')), null);
    });
    await check('Native metadata restores a cold callback using the original WebView PKCE storage', async () => {
      const { page, context } = await fixture();
      await page.evaluate(() => {
        window.KAGIE_NATIVE_ANDROID = true; window.KagieNativeOAuth = { version: 1 };
        window.ReactNativeWebView = { postMessage: value => { window.nativeIntent = JSON.parse(value); } };
      });
      await page.evaluate(() => window.KagieAPI.signInWithGoogle({ persist: false }));
      const message = await page.evaluate(() => window.nativeIntent);
      const intent = { provider: message.provider, redirectTo: message.redirectTo, persist: message.persist, startedAt: message.startedAt };
      const cold = await context.newPage();
      await cold.addInitScript(intent => sessionStorage.setItem('kagie_oauth_intent', JSON.stringify(intent)), intent);
      const target = new URL(message.redirectTo); target.searchParams.delete('native_auth'); target.searchParams.set('code', 'synthetic-native-code');
      await cold.goto(target.toString(), { waitUntil: 'load' });
      const restored = await cold.evaluate(() => window.KagieAPI.restoreSession());
      assert.equal(restored.supabaseUserId, id); assert.equal(restored.role, 'user');
      assert.equal(await cold.evaluate(() => JSON.parse(localStorage.getItem('kagie_current_user'))), null);
      assert.equal(await cold.evaluate(() => JSON.parse(sessionStorage.getItem('kagie_oauth_intent'))), null);
    });
    await check('New Google learner restores without remember, using safe role and profile metadata', async () => {
      const { page } = await fixture();
      const result = await start(page, false);
      const restored = await callback(page, result);
      assert.equal(restored.supabaseUserId, id); assert.equal(restored.role, 'user');
      assert.equal(restored.fullName, 'Google Test Learner'); assert.equal(restored.profileImage, user.user_metadata.avatar_url);
      const stored = await page.evaluate(() => ({ local: JSON.parse(localStorage.getItem('kagie_current_user')), tab: JSON.parse(sessionStorage.getItem('kagie_current_user')), intent: JSON.parse(sessionStorage.getItem('kagie_oauth_intent')), drafts: JSON.parse(localStorage.getItem('kagie_applications')), notices: JSON.parse(localStorage.getItem('kagie_notifications')) }));
      assert.equal(stored.local, null); assert.equal(stored.tab.id, restored.id); assert.equal(stored.intent, null);
      assert.equal(stored.drafts.filter(entry => entry.userId === restored.id).length, 1);
      assert.equal(stored.notices.filter(entry => entry.userId === restored.id && entry.title === 'Welcome to Kagie').length, 1);
      const second = await page.evaluate(() => window.KagieAPI.restoreSession());
      assert.equal(second.id, restored.id);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kagie_users')).filter(entry => entry.supabaseUserId === 'a087a2e0-0000-4000-8000-000000000091').length), 1);
    });
    await check('Remembered Google session restores in a new tab', async () => {
      const { page, context } = await fixture();
      const restored = await callback(page, await start(page, true));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kagie_current_user')).id), restored.id);
      const newTab = await context.newPage(); await newTab.goto(base + '/oauth-fixture.html');
      const again = await newTab.evaluate(() => window.KagieAPI.restoreSession()); assert.equal(again.id, restored.id);
    });
    await check('Nonremembered Google session does not silently sign a new tab in', async () => {
      const { page, context } = await fixture();
      await callback(page, await start(page, false));
      const newTab = await context.newPage(); await newTab.goto(base + '/oauth-fixture.html');
      assert.equal(await newTab.evaluate(() => window.KagieAPI.restoreSession()), null);
    });
    await check('Expired OAuth intent cannot bypass session persistence choice', async () => {
      const { page } = await fixture(); const result = await start(page, false);
      await page.evaluate(() => { const intent = JSON.parse(sessionStorage.getItem('kagie_oauth_intent')); intent.startedAt -= 1000 * 60 * 16; sessionStorage.setItem('kagie_oauth_intent', JSON.stringify(intent)); });
      assert.equal(await callback(page, result), null);
      assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kagie_oauth_intent'))), null);
    });
    await check('Editable profile staff role cannot grant Google staff access', async () => {
      const profile = { id, email: user.email, full_name: 'Trusted Staff', role: 'assistant_admin' };
      const { page } = await fixture({ profile });
      assert.equal((await callback(page, await start(page))).role, 'user');
    });
    await check('Trusted app metadata role is used when no profile is present', async () => {
      const { page } = await fixture({ authUser: { ...user, app_metadata: { ...user.app_metadata, role: 'master_admin' } } });
      assert.equal((await callback(page, await start(page))).role, 'master_admin');
    });
    await check('Google callback replaces a local staff session and ignores cached staff claims', async () => {
      const { page } = await fixture();
      await page.evaluate(email => {
        const cached = { id: 'legacy-google-learner', email, role: 'master_admin', source: 'local', password: 'never-persist-this-test-password', fullName: 'Cached Learner' };
        const users = JSON.parse(localStorage.getItem('kagie_users')) || [];
        users.push(cached); localStorage.setItem('kagie_users', JSON.stringify(users));
        sessionStorage.setItem('kagie_current_user', JSON.stringify(cached));
        sessionStorage.setItem('kagie_active_session', JSON.stringify({ active: true, updatedAt: Date.now() }));
      }, user.email);
      const restored = await callback(page, await start(page));
      assert.equal(restored.supabaseUserId, id); assert.equal(restored.role, 'user');
      assert.equal(restored.source, 'supabase');
      assert.equal(await page.evaluate(() => (JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).includes('never-persist-this-test-password')), false);
    });
    await check('Live role endpoint overrides metadata and rejects 403 even for generic messages', async () => {
      const trusted = await fixture({ role: 'assistant_admin' });
      assert.equal((await callback(trusted.page, await start(trusted.page))).role, 'assistant_admin');
      const denied = await fixture({ roleStatus: 403 });
      const result = await start(denied.page);
      await assert.rejects(() => callback(denied.page, result), /Access refused/);
      assert.equal(await denied.page.evaluate(() => window.KagieAPI.currentUser()), null);
      assert.equal(await denied.page.evaluate(() => JSON.parse(sessionStorage.getItem('kagie_oauth_intent'))), null);
    });
    await check('Failed PKCE exchange surfaces the error and clears pending intent', async () => {
      const { page } = await fixture({ tokenError: true });
      const result = await start(page);
      await assert.rejects(() => callback(page, result), /authentication code has expired/);
      assert.equal(await page.evaluate(() => window.KagieAPI.currentUser()), null);
      assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kagie_oauth_intent'))), null);
    });
    await check('Cancelled Google callback surfaces the provider error and clears intent', async () => {
      const { page } = await fixture(); const result = await start(page);
      const url = new URL(new URL(result.url).searchParams.get('redirect_to'));
      url.searchParams.set('error', 'access_denied'); url.searchParams.set('error_description', 'The user cancelled Google sign-in.');
      await page.goto(url.toString(), { waitUntil: 'load' });
      await assert.rejects(() => page.evaluate(() => window.KagieAPI.restoreSession()), /cancelled Google sign-in/);
      assert.equal(await page.evaluate(() => window.KagieAPI.currentUser()), null);
      assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kagie_oauth_intent'))), null);
    });
    assert.equal(errors.length, 0);
    assert.ok(requests.filter(request => request.path.startsWith('/rest/')).every(request => request.method === 'GET'));
  } finally {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'backend-checks.json'), JSON.stringify({ checks, errors, requests: requests.map(({ path, method }) => ({ path, method })), externalRequests: 'blocked', sdk: '@supabase/supabase-js bundled in workspace' }, null, 2) + '\n');
    await Promise.all(contexts.map(context => context.close())); await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
