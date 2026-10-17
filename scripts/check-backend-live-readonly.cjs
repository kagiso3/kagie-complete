// Public, unauthenticated GET requests only. No accounts, records or payments changed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const routes = ['/v1/health', '/v1/public/stats', '/v1/auth/role', '/v1/admin/users', '/v1/admin/config/status'];
(async () => {
  const results = [];
  for (const route of routes) {
    try {
      const response = await fetch('https://kagie.app' + route, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(12000) });
      const body = await response.json().catch(() => null);
      // Record schema/status only: never persist response values or user data.
      results.push({ route, method: 'GET', status: response.status, contentType: response.headers.get('content-type'), topLevelKeys: body && typeof body === 'object' ? Object.keys(body) : [], dataKeys: body?.data && typeof body.data === 'object' ? Object.keys(body.data) : [] });
    } catch (error) { results.push({ route, method: 'GET', error: error.name || 'NetworkError' }); }
  }
  const report = { checkedAt: new Date().toISOString(), scope: 'Unauthenticated GET only, response keys/statuses only, no production mutations', results };
  fs.writeFileSync(path.join(root, 'reports/backend-audit/live-readonly-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.name); process.exitCode = 1; });
