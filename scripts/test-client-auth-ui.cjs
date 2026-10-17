const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'kagie-web', 'dist');
const output = path.join(root, 'reports', 'auth-ui', 'react');
const results = { samples: [], checks: [], errors: [] };
function check(name, value) { assert(value, name); results.checks.push(name); }
function fixture() {
  const params = new URL(window.location.href).searchParams;
  if (params.has('fixture_native_version')) window.KagieNativeOAuth = { version: Number(params.get('fixture_native_version')) };
  window.authFixture = { resetCalls: [], registerCalls: [], loginCalls: [], providerCalls: [], providerSettled: 0, restoreCalls: 0, resetResult: {}, resetError: '', resetDelay: 200, loginDelay: 200, registerError: '', providerError: '', providerDelay: 200, session: { access_token: 'synthetic-token' }, source: 'local' };
  const callbackRole = params.get('fixture_role');
  const callbackUser = callbackRole ? { id: 'oauth-fixture-user', fullName: 'Google Fixture Learner', email: 'google@fixture.test', role: callbackRole, source: 'supabase' } : null;
  let user = null;
  window.KagieAPI = {
    currentUser: () => user,
    restoreSession: async () => {
      window.authFixture.restoreCalls += 1;
      if (params.has('fixture_restore_error')) throw new Error('Private provider callback diagnostics');
      if (callbackUser) user = callbackUser;
      return user;
    },
    requestPasswordReset: async (email) => {
      window.authFixture.resetCalls.push(email);
      await new Promise(resolve => setTimeout(resolve, window.authFixture.resetDelay));
      if (window.authFixture.resetError) throw new Error(window.authFixture.resetError);
      return window.authFixture.resetResult;
    },
    registerUser: async (input) => {
      window.authFixture.registerCalls.push(input);
      if (window.authFixture.registerError) throw new Error(window.authFixture.registerError);
      user = { id: 'auth-ui-learner', ...input, role: 'learner', source: window.authFixture.source, emailConfirmationRequired: Boolean(window.authFixture.confirmationRequired) };
      return user;
    },
    getSupabaseSession: () => window.authFixture.session,
    login: async (email, password, options) => {
      window.authFixture.loginCalls.push({ email, password, options });
      await new Promise(resolve => setTimeout(resolve, window.authFixture.loginDelay));
      throw new Error('Invalid login credentials');
    },
    signInWithGoogle: async (options) => {
      window.authFixture.providerCalls.push({ provider: 'google', options });
      await new Promise(resolve => setTimeout(resolve, window.authFixture.providerDelay));
      window.authFixture.providerSettled += 1;
      if (window.authFixture.providerError) throw new Error(window.authFixture.providerError);
      return { provider: 'google', url: 'https://google.invalid/synthetic-auth' };
    },
    signInWithApple: async () => { window.authFixture.providerCalls.push({ provider: 'apple' }); },
    getDashboardSummary: () => ({ applications: [], readiness: 0, unreadNotifications: 0 }),
    getFavorites: () => [],
    getCart: () => [],
    getCartTotal: () => 0,
    logout: async () => { user = null; }
  };
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (['/assistant/dashboard.html', '/master-admin/dashboard.html'].includes(url.pathname)) {
      res.setHeader('Content-Type', 'text/html');
      return res.end('<!doctype html><title>Synthetic staff dashboard</title><main>Staff route fixture</main>');
    }
    const target = path.resolve(dist, decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
    if (!target.startsWith(dist + path.sep)) { res.statusCode = 403; return res.end(); }
    if (!fs.existsSync(target)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(target)] || 'application/octet-stream');
    res.end(fs.readFileSync(target));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function open(width, route = 'login', search = '') {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(fixture);
    await context.route('**/*', request => request.request().url().startsWith(base) ? request.continue() : request.fulfill({ status: 200, body: '' }));
    const page = await context.newPage();
    page.on('pageerror', error => results.errors.push(error.message));
    await page.goto(base + '/' + search + '#/' + route);
    await page.locator('.kg-auth-card').waitFor();
    return { context, page };
  }
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      for (const screen of ['login', 'signup', 'reset']) {
        const { context, page } = await open(width, screen === 'signup' ? 'signup' : 'login');
        if (screen === 'reset') await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
        const sample = await page.evaluate(() => ({
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          primary: getComputedStyle(document.documentElement).getPropertyValue('--kg-red').trim(),
          blue: getComputedStyle(document.documentElement).getPropertyValue('--kg-sky').trim(),
          cardRadius: getComputedStyle(document.querySelector('.kg-auth-card')).borderRadius,
          unlabeled: [...document.querySelectorAll('input')].filter(input => !input.labels.length && !input.getAttribute('aria-label')).length,
          minimumInputFont: Math.min(...[...document.querySelectorAll('input')].map(input => parseFloat(getComputedStyle(input).fontSize)))
        }));
        results.samples.push({ screen, ...sample });
        check(screen + ' fits at ' + width, sample.documentWidth <= width + 1);
        check(screen + ' uses the requested red at ' + width, sample.primary === '#fd0505');
        check(screen + ' uses the requested blue at ' + width, sample.blue === '#2d9df9');
        check(screen + ' uses its designed card radius at ' + width, sample.cardRadius === (screen === 'signup' ? '16px' : width <= 390 ? '20px' : '23px'));
        check(screen + ' labels all inputs at ' + width, sample.unlabeled === 0);
        if (width <= 390) check(screen + ' has readable mobile fields at ' + width, sample.minimumInputFont >= 16);
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, screen + '-' + width + '.png'), fullPage: true });
        await context.close();
      }
    }
    const { context, page } = await open(390);
    await page.getByLabel('Email address', { exact: true }).fill('student@fixture.test');
    await page.getByLabel('Password', { exact: true }).fill('FixturePassword1!');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    check('Password visibility toggle exposes entered value', await page.getByLabel('Password', { exact: true }).getAttribute('type') === 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    check('Password visibility toggle hides entered value', await page.getByLabel('Password', { exact: true }).getAttribute('type') === 'password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'does not match' }).waitFor();
    check('Unchecked remember option keeps email sign-in temporary', await page.evaluate(() => window.authFixture.loginCalls[0].options.persist === false));
    check('Sign-in failure retains both fields', await page.getByLabel('Email address', { exact: true }).inputValue() === 'student@fixture.test' && await page.getByLabel('Password', { exact: true }).inputValue() === 'FixturePassword1!');
    check('Only the activated Google provider is offered', await page.getByRole('button', { name: 'Continue with Google', exact: true }).count() === 1 && await page.getByRole('button', { name: 'Continue with Apple', exact: true }).count() === 0);
    await page.evaluate(() => { window.authFixture.providerError = 'Private provider credentials are unavailable'; });
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    check('Google and email actions are disabled while OAuth starts', await page.getByRole('button', { name: 'Opening Google...', exact: true }).isDisabled() && await page.getByRole('button', { name: 'Log in', exact: true }).isDisabled());
    await page.getByRole('alert').filter({ hasText: 'could not start that sign-in method' }).waitFor();
    check('Google initiation failure unlocks sign-in and retains entered credentials', await page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled() && await page.getByLabel('Email address', { exact: true }).inputValue() === 'student@fixture.test' && await page.getByLabel('Password', { exact: true }).inputValue() === 'FixturePassword1!');
    check('Google initiation failure hides provider diagnostics', !(await page.getByRole('alert').innerText()).includes('credentials'));
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByRole('heading', { name: 'Reset your password', exact: true }).waitFor();
    check('Reset view preserves account email and removes password requirement', await page.getByLabel('Email address', { exact: true }).inputValue() === 'student@fixture.test' && await page.locator('input[type=password]').count() === 0);
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    check('Reset submit disables duplicate attempts while pending', await page.getByRole('button', { name: 'Sending reset link...', exact: true }).isDisabled());
    await page.getByRole('status').filter({ hasText: 'If an account uses this email' }).waitFor();
    check('Reset calls existing API once with account email', await page.evaluate(() => window.authFixture.resetCalls.length === 1 && window.authFixture.resetCalls[0] === 'student@fixture.test'));
    await page.evaluate(() => { window.authFixture.resetResult = { localOnly: true }; });
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'No email was sent' }).waitFor();
    check('Local-only reset does not claim email delivery', true);
    await page.evaluate(() => { window.authFixture.resetError = 'TypeError: Failed to fetch https://private-provider.invalid'; });
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Check your connection' }).waitFor();
    check('Reset errors retain email and hide provider diagnostics', await page.getByLabel('Email address', { exact: true }).inputValue() === 'student@fixture.test' && !(await page.getByRole('alert').innerText()).includes('private-provider'));
    await page.getByRole('button', { name: 'Back to sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    check('Back navigation restores sign-in form', await page.getByLabel('Password', { exact: true }).count() === 1);
    await context.close();

    const google = await open(390, 'login', '?next=apply');
    await google.page.getByRole('checkbox', { name: 'Keep me logged in', exact: false }).check();
    await google.page.locator('.kg-provider-button').evaluate(button => { button.click(); button.click(); });
    await google.page.getByRole('status').filter({ hasText: 'Google sign-in is starting' }).waitFor();
    const provider = await google.page.evaluate(() => window.authFixture.providerCalls);
    const callback = new URL(provider[0].options.redirectTo);
    check('Repeated Google clicks start a single OAuth request', provider.length === 1 && provider[0].provider === 'google');
    check('Google callback stays on this document without a route hash', callback.origin === base && callback.pathname === '/' && callback.hash === '' && callback.searchParams.get('oauth') === 'google');
    check('Google callback preserves a safe intended route and requested persistence', callback.searchParams.get('next') === 'apply' && provider[0].options.persist === true);
    check('Ordinary website OAuth does not opt into the native return bridge', !callback.searchParams.has('native_auth'));
    check('Successful initiation stays disabled until navigation', await google.page.getByRole('button', { name: 'Opening Google...', exact: true }).isDisabled());
    await google.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    check('Returning through browser back makes Google usable again', await google.page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled());
    await google.context.close();

    const unsafeGoogle = await open(390, 'login', '?next=https%3A%2F%2Fexternal.invalid%2Fsteal');
    await unsafeGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    await unsafeGoogle.page.getByRole('status').filter({ hasText: 'Google sign-in is starting' }).waitFor();
    check('External next input becomes the home route', await unsafeGoogle.page.evaluate(() => new URL(window.authFixture.providerCalls[0].options.redirectTo).searchParams.get('next')) === 'home');
    await unsafeGoogle.context.close();

    for (const version of [1, 2]) {
      const nativeGoogle = await open(390, 'login', '?next=apply&native_auth=1&fixture_native_version=' + version);
      await nativeGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
      await nativeGoogle.page.getByRole('status').filter({ hasText: 'Google sign-in is starting' }).waitFor();
      const nativeCallback = await nativeGoogle.page.evaluate(() => new URL(window.authFixture.providerCalls[0].options.redirectTo).searchParams.get('native_auth'));
      check('Native OAuth return is enabled only by supported injected marker version ' + version, nativeCallback === (version === 1 ? '1' : null));
      await nativeGoogle.context.close();
    }

    const recoveredGoogle = await open(390, 'login', '?fixture_native_version=1');
    const emitNative = (name, version = 1) => recoveredGoogle.page.evaluate(({ name, version }) => {
      window.dispatchEvent(new CustomEvent(name, { detail: { version, message: 'Private native failure diagnostics' } }));
    }, { name, version });
    await recoveredGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    await recoveredGoogle.page.getByRole('status').filter({ hasText: 'Google sign-in is starting' }).waitFor();
    await emitNative('kagie:native-oauth-error', 2);
    check('Unsupported native recovery events cannot unlock an active Google request', await recoveredGoogle.page.getByRole('button', { name: 'Opening Google...', exact: true }).isDisabled());
    await emitNative('kagie:native-oauth-resume');
    await recoveredGoogle.page.getByRole('status').filter({ hasText: 'Google sign-in was not completed' }).waitFor();
    check('Returning from a cancelled native Google flow unlocks Google and email sign-in', await recoveredGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled() && await recoveredGoogle.page.getByRole('button', { name: 'Log in', exact: true }).isEnabled());
    await recoveredGoogle.page.evaluate(() => { window.authFixture.providerDelay = 600; });
    await recoveredGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    await emitNative('kagie:native-oauth-error');
    await recoveredGoogle.page.getByRole('alert').filter({ hasText: 'could not open your browser' }).waitFor();
    check('Native browser launch failure unlocks retry without exposing diagnostics', await recoveredGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled() && !(await recoveredGoogle.page.getByRole('alert').innerText()).includes('diagnostics'));
    await recoveredGoogle.page.waitForFunction(() => window.authFixture.providerSettled === 2);
    check('A late provider promise cannot overwrite the native recovery notice', (await recoveredGoogle.page.getByRole('alert').innerText()).includes('could not open your browser'));

    await recoveredGoogle.page.getByLabel('Email address', { exact: true }).fill('student@fixture.test');
    await recoveredGoogle.page.getByLabel('Password', { exact: true }).fill('FixturePassword1!');
    await recoveredGoogle.page.evaluate(() => { window.authFixture.loginDelay = 600; });
    await recoveredGoogle.page.getByRole('button', { name: 'Log in', exact: true }).click();
    await emitNative('kagie:native-oauth-error');
    await emitNative('kagie:native-oauth-resume');
    check('Native recovery events do not interrupt email sign-in', await recoveredGoogle.page.locator('.kg-auth-form button[type="submit"]').isDisabled() && (await recoveredGoogle.page.locator('.kg-auth-form button[type="submit"]').innerText()).includes('Signing in'));
    await recoveredGoogle.page.getByRole('alert').filter({ hasText: 'does not match' }).waitFor();
    await recoveredGoogle.page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await recoveredGoogle.page.evaluate(() => { window.authFixture.resetDelay = 600; });
    await recoveredGoogle.page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await emitNative('kagie:native-oauth-error');
    await emitNative('kagie:native-oauth-resume');
    check('Native recovery events do not interrupt password reset', await recoveredGoogle.page.getByRole('button', { name: 'Sending reset link...', exact: true }).isDisabled());
    await recoveredGoogle.page.getByRole('status').filter({ hasText: 'If an account uses this email' }).waitFor();
    await recoveredGoogle.page.getByRole('button', { name: 'Back to sign in', exact: true }).click();
    await recoveredGoogle.page.evaluate(() => { window.authFixture.providerError = 'Google sign-in needs the updated Kagie app. Please update the app or sign in with your email.'; });
    await recoveredGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    await recoveredGoogle.page.getByRole('alert').filter({ hasText: 'Update the app or sign in with your email' }).waitFor();
    check('Older native bridges show update or email guidance with usable controls', await recoveredGoogle.page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled());
    await recoveredGoogle.context.close();

    async function callbackPage(search) {
      const callbackContext = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
      await callbackContext.addInitScript(fixture);
      await callbackContext.route('**/*', request => request.request().url().startsWith(base) ? request.continue() : request.fulfill({ status: 200, body: '' }));
      const callbackPage = await callbackContext.newPage();
      callbackPage.on('pageerror', error => results.errors.push(error.message));
      await callbackPage.goto(base + '/' + search);
      return { context: callbackContext, page: callbackPage };
    }

    const learnerCallback = await callbackPage('?oauth=google&next=apply&code=synthetic-pkce-code&fixture_role=learner');
    await learnerCallback.page.locator('.kg-app-shell').waitFor();
    await learnerCallback.page.waitForURL(url => url.hash === '#/apply');
    check('Authenticated Google callback restores the learner and intended application route', await learnerCallback.page.evaluate(() => window.authFixture.restoreCalls === 1) && learnerCallback.page.url().endsWith('#/apply'));
    check('Google callback removes the OAuth marker and code after session restoration', !new URL(learnerCallback.page.url()).searchParams.has('code') && !new URL(learnerCallback.page.url()).searchParams.has('oauth'));
    await learnerCallback.context.close();

    const unsafeCallback = await callbackPage('?oauth=google&next=%2Fmaster-admin%2Fdashboard.html&code=synthetic-pkce-code&fixture_role=learner');
    await unsafeCallback.page.locator('.kg-app-shell').waitFor();
    await unsafeCallback.page.waitForURL(url => url.hash === '#/home');
    check('Learner callback rejects privileged next paths', unsafeCallback.page.url().endsWith('#/home'));
    await unsafeCallback.context.close();

    for (const [role, destination] of [['assistant_admin', '/assistant/dashboard.html'], ['master_admin', '/master-admin/dashboard.html']]) {
      const staffCallback = await callbackPage('?oauth=google&next=apply&code=synthetic-pkce-code&fixture_role=' + role);
      await staffCallback.page.waitForURL(base + destination);
      check('Google callback preserves role routing for ' + role, new URL(staffCallback.page.url()).pathname === destination);
      await staffCallback.context.close();
    }

    for (const search of ['?oauth=google&next=apply&error=access_denied&error_description=Private-provider-diagnostics', '?oauth=google&next=apply&code=synthetic-invalid-code&fixture_restore_error=1']) {
      const failedCallback = await callbackPage(search);
      await failedCallback.page.getByRole('status').filter({ hasText: 'Google sign-in was not completed' }).waitFor();
      check('Cancelled or failed callback retains usable sign-in without diagnostics', await failedCallback.page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled() && !(await failedCallback.page.getByRole('status').innerText()).includes('diagnostics') && !new URL(failedCallback.page.url()).searchParams.has('code') && !new URL(failedCallback.page.url()).searchParams.has('error_description'));
      await failedCallback.context.close();
    }
    const signup = await open(390, 'signup');
    await signup.page.getByLabel('Full name', { exact: true }).fill('Kagie Student');
    await signup.page.getByLabel('Email', { exact: true }).fill('student@fixture.test');
    await signup.page.getByLabel('Password', { exact: true }).fill('FixturePassword1!');
    await signup.page.evaluate(() => { window.authFixture.source = 'supabase'; window.authFixture.session = null; });
    await signup.page.getByRole('button', { name: 'Create account', exact: true }).click();
    await signup.page.getByRole('heading', { name: 'Check your email', exact: true }).waitFor();
    check('Unconfirmed registration shows next step and retains signup route', signup.page.url().endsWith('#/signup') && (await signup.page.getByRole('status').innerText()).includes('student@fixture.test'));
    await signup.page.getByRole('button', { name: 'Back to sign in', exact: true }).click();
    await signup.page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
    check('Confirmation view offers working sign-in navigation', signup.page.url().endsWith('#/login'));
    await signup.context.close();
    const explicitConfirmation = await open(390, 'signup');
    await explicitConfirmation.page.getByLabel('Full name', { exact: true }).fill('New Synthetic Learner');
    await explicitConfirmation.page.getByLabel('Email', { exact: true }).fill('new@fixture.test');
    await explicitConfirmation.page.getByLabel('Password', { exact: true }).fill('FixturePassword1!');
    await explicitConfirmation.page.evaluate(() => {
      window.authFixture.source = 'supabase';
      window.authFixture.confirmationRequired = true;
      window.authFixture.session = { access_token: 'previous-synthetic-session' };
    });
    await explicitConfirmation.page.getByRole('button', { name: 'Create account', exact: true }).click();
    await explicitConfirmation.page.getByRole('heading', { name: 'Check your email', exact: true }).waitFor();
    check('An explicit confirmation requirement is preserved even when an older session exists', explicitConfirmation.page.url().endsWith('#/signup'));
    await explicitConfirmation.context.close();
    check('No account browser runtime errors', results.errors.length === 0);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(results, null, 2));
  }
  console.log('Account UI verified: ' + results.samples.length + ' viewport samples and ' + results.checks.length + ' checks. Isolated synthetic auth; no email sends or production writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
