const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { createPreviewServer } = require('./preview-login-reference.cjs');
const output = path.resolve(__dirname, '../reports/login-reference');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const results = { layouts: [], checks: [], errors: [], blockedOrigins: [] };
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      results.blockedOrigins.push(url.origin);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => results.errors.push(error.message));
    for (const width of [320, 390, 768, 820, 960, 1024, 1280, 1478]) {
      await page.setViewportSize({ width, height: width === 1478 ? 1064 : 844 });
      await page.goto(base + '/login.html', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor();
      assert.equal(await page.locator('#email').inputValue(), '', 'No account email is embedded in the design');
      assert.equal(await page.locator('#password').inputValue(), '', 'No password is embedded in the design');
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, story: rect('.auth-story'), card: rect('.auth-card'), heading: rect('#authTitle'), google: rect('#googleLoginBtn'), email: rect('#email'), password: rect('#password'), remember: rect('.remember-row'), submit: rect('#loginBtn'), image: getComputedStyle(document.querySelector('.auth-story')).backgroundImage };
      });
      assert.ok(layout.documentWidth <= width + 1, 'No horizontal overflow at ' + width);
      assert.ok(layout.email.height >= 56 && layout.password.height >= 56 && layout.submit.height >= 56, 'Comfortable form controls at ' + width);
      assert.equal(layout.story.width > 0, width >= 960, 'Story panel collapses on smaller screens');
      if (width === 1478) {
        assert.ok(Math.abs(layout.card.x - 760) < 8 && Math.abs(layout.card.y - 90) < 4, 'Reference two-panel placement');
        assert.ok(Math.abs(layout.story.width - 690) < 8, 'Reference story proportions');
        assert.match(layout.image, /login-graduation-scene-v1\.png/, 'Graduation illustration is used');
      }
      results.layouts.push(layout);
      if ([390, 820, 1478].includes(width)) await page.screenshot({ path: path.join(output, `login-${width}.png`), fullPage: true });
    }
    results.checks.push('Reference proportions and accessible responsive form at eight widths', 'Blank credential fields; no screenshot account data copied');
    await page.getByLabel('Show password', { exact: true }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.getByLabel('Hide password', { exact: true }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'password');
    results.checks.push('Password visibility controls still work');
    assert.equal(await page.locator('.auth-story-row').count(), 3);
    assert.deepEqual(await page.locator('.auth-story-row').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), ['/institutions.html', '/apply.html', '/home.html']);
    const artwork = await page.request.get(base + '/images/login-graduation-scene-v1.png');
    assert.equal(artwork.status(), 200);
    results.checks.push('Feature cards link to existing destinations and artwork loads');
    for (const file of ['login.html', 'css/login-reference.css', 'images/login-graduation-scene-v1.png', 'sw.js']) {
      const root = path.resolve(__dirname, '..');
      assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(root, 'kagie-landing/public', file))), 'Landing copy matches ' + file);
    }
    results.checks.push('Landing public login, styling, artwork and cache version match canonical files');
    assert.deepEqual(results.errors, [], 'No browser script errors');
    console.log(`PASS ${results.checks.length} login reference checks; ${results.layouts.length} screen widths; no production authentication requests`);
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
