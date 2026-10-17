const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'reports/student-journey-deployment-checks.json');
const expectedSupabaseHost = fs.readFileSync(path.join(root, 'js/supabase-config.js'), 'utf8')
  .match(/https:\/\/([a-z0-9-]+\.supabase\.co)/i)?.[1] || '';
const pages = [
  ['forms.html', 'forms-page.js', '20261007-journey'],
  ['cart.html', 'cart-page.js', '20261007-journey'],
  ['checkout.html', 'checkout-page.js', '20261007-journey'],
  ['upload.html', 'upload-page.js', '20261007-journey'],
  ['home.html', 'home-page.js', '20261007-performance'],
  ['Dashboard.html']
];

function publicUrl(value) {
  const url = new URL(value);
  return url.origin + url.pathname;
}

async function request(url) {
  let target = new URL(url);
  let redirects = 0;
  try {
    while (true) {
      // Node fetch transparently decodes gzip, Brotli and deflate responses.
      const response = await fetch(target, {
        redirect: 'manual',
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(20000)
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects >= 8) return { error: 'Invalid or excessive redirects', redirects };
        const next = new URL(location, target);
        if (next.protocol !== 'https:' || next.username || next.password) {
          return { error: 'Redirect must use HTTPS without credentials', redirects };
        }
        target = next;
        redirects += 1;
        continue;
      }
      return {
        status: response.status,
        finalUrl: publicUrl(target),
        redirects,
        contentType: response.headers.get('content-type') || '',
        bytes: Buffer.from(await response.arrayBuffer())
      };
    }
  } catch (error) {
    return { error: error.name === 'TimeoutError' ? 'Request timed out' : 'Network request failed', redirects };
  }
}

function publicResponse(response) {
  const { status, finalUrl, redirects, contentType, error } = response;
  return { status, finalUrl, redirects, contentType, ...(error ? { error } : {}) };
}

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function publicConfigChecks(payload) {
  const config = payload?.data?.supabase || payload?.supabase;
  let secureUrl = false;
  let projectRef = '';
  let expectedProjectMatches = false;
  try {
    const url = new URL(config?.url);
    secureUrl = url.protocol === 'https:' && !url.username && !url.password && Boolean(url.hostname);
    if (url.hostname.endsWith('.supabase.co')) projectRef = url.hostname.split('.')[0];
    expectedProjectMatches = Boolean(expectedSupabaseHost) && url.hostname === expectedSupabaseHost;
  } catch (_) {}
  const key = typeof config?.anonKey === 'string' ? config.anonKey.trim() : '';
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
  let publicKeyType = publicKey ? 'publishable' : 'invalid';
  if (!publicKey && key.split('.').length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      publicKey = claims.role === 'anon' && claims.iss === 'supabase'
        && (!projectRef || claims.ref === projectRef)
        && (!claims.exp || Number(claims.exp) > Date.now() / 1000);
      if (publicKey) publicKeyType = 'anonymous JWT';
    } catch (_) {}
  }
  // Never return, print or persist the key, its claims, or the response body.
  return { enabled: config?.enabled === true, secureUrl, publicKey, publicKeyType, expectedProjectMatches };
}

async function main() {
  let base;
  try {
    if (process.argv.length !== 3) throw new Error();
    base = new URL(process.argv[2]);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash
      || base.pathname !== '/') throw new Error();
  } catch (_) {
    console.error('Usage: node scripts/verify-student-journey-deployment.cjs https://deployment-host');
    process.exitCode = 2;
    return;
  }

  const checks = [];
  const pageResponses = await Promise.all(pages.map(([file]) => request(new URL(file, base))));
  pages.forEach(([file, script, version], index) => {
    const response = pageResponses[index];
    const available = response.status === 200 && /text\/html/i.test(response.contentType || '');
    checks.push({ name: `${file} is available as HTML`, passed: available, ...publicResponse(response) });
    if (!script) return;
    const html = response.bytes?.toString('utf8') || '';
    const references = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)];
    const matches = references.some((match) => {
      try {
        const url = new URL(match[1].replace(/&amp;/g, '&'), response.finalUrl || base);
        return url.origin === new URL(response.finalUrl || base).origin
          && url.pathname === `/js/${script}` && url.searchParams.get('v') === version;
      } catch (_) { return false; }
    });
    checks.push({ name: `${file} references the expected script version`, passed: available && matches,
      script: `/js/${script}`, expectedVersion: version });
  });

  const assets = pages.filter(([, script]) => script).map(([, script, version]) => ({
    file: `js/${script}`, requestPath: `js/${script}?v=${version}`
  }));
  assets.push({ file: 'sw.js', requestPath: 'sw.js' });
  const assetResponses = await Promise.all(assets.map(({ requestPath }) => request(new URL(requestPath, base))));
  assets.forEach(({ file }, index) => {
    const response = assetResponses[index];
    const localPath = path.join(root, 'web-release', file);
    const localExists = fs.existsSync(localPath);
    const expectedHash = localExists ? hash(fs.readFileSync(localPath)) : null;
    const actualHash = response.bytes ? hash(response.bytes) : null;
    checks.push({ name: `${file} matches the verified release bytes`,
      passed: localExists && response.status === 200 && expectedHash === actualHash,
      expectedHash, actualHash, ...publicResponse(response) });
  });

  const runtime = await request(new URL('api/runtime-config', base));
  let config = { enabled: false, secureUrl: false, publicKey: false, publicKeyType: 'invalid' };
  if (runtime.status === 200 && /application\/json/i.test(runtime.contentType || '')) {
    try { config = publicConfigChecks(JSON.parse(runtime.bytes.toString('utf8'))); } catch (_) {}
  }
  checks.push({ name: 'Runtime endpoint provides usable public Supabase configuration',
    passed: runtime.status === 200 && config.enabled && config.secureUrl && config.publicKey && config.expectedProjectMatches,
    ...publicResponse(runtime), ...config });

  const passed = checks.filter((check) => check.passed).length;
  const report = { runAt: new Date().toISOString(), baseUrl: base.origin,
    scope: 'Read-only public HTTPS requests; no sign-in, Supabase requests, or payment writes',
    passed, total: checks.length, checks };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  for (const check of checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}`);
  console.log(`${passed}/${checks.length} deployment checks passed. Public results: reports/student-journey-deployment-checks.json`);
  if (passed !== checks.length) process.exitCode = 1;
}

main().catch(() => {
  console.error('Deployment verification could not complete; no response bodies or keys were logged.');
  process.exitCode = 1;
});
