const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '..');
const routes = require('../vercel.json').rewrites;
const handler = require('../api/admin/config/status');
const checks = [];
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? entry.name.startsWith('_') ? [] : walk(path.join(directory, entry.name)) : entry.name.endsWith('.js') ? [path.join(directory, entry.name)] : []);
async function invoke(source, method) {
  const rule = routes.find(item => item.source === source);
  const req = Readable.from(method === 'POST' ? ['{}'] : []);
  req.method = method; req.url = rule?.destination || source; req.headers = {};
  const result = { status: 200, headers: {}, body: '' };
  const res = { statusCode: 200, setHeader(key, value) { result.headers[key.toLowerCase()] = value; }, end(body) { result.status = this.statusCode; result.body = body; } };
  await handler(req, res);
  return result;
}
async function main() {
  const functions = walk(path.join(root, 'api'));
  assert.equal(functions.length, 12); checks.push('Deployment stays within the observed 12-function hosting limit');
  assert.ok(!fs.existsSync(path.join(root, 'api/auth/admin/master-admin/bootstrap.js'))); checks.push('Provisioning has no additional standalone hosting function');
  for (const alias of ['/v1/auth/admin/master-admin/bootstrap', '/api/auth/admin/master-admin/bootstrap']) {
    assert.equal(routes.find(item => item.source === alias)?.destination, '/api/admin/config/status?__kagie_admin_action=bootstrap');
    const response = await invoke(alias, 'POST');
    assert.equal(response.status, 401); assert.match(response.body, /active Kagie master admin/);
    assert.equal((await invoke(alias, 'GET')).status, 405);
    const options = await invoke(alias, 'OPTIONS');
    assert.equal(options.status, 200); assert.equal(options.headers['access-control-allow-methods'], 'POST, OPTIONS');
    checks.push(alias + ' retains authentication, methods and provisioning preflight');
  }
  assert.equal((await invoke('/v1/admin/config/status', 'GET')).status, 401);
  assert.equal((await invoke('/api/admin/config/status', 'POST')).status, 405);
  assert.equal((await invoke('/api/admin/config/status', 'OPTIONS')).headers['access-control-allow-methods'], 'GET, OPTIONS');
  checks.push('Configuration status retains its independent method and auth boundary');
  assert.equal((await invoke('/api/admin/config/status?__kagie_admin_action=bootstrap', 'POST')).status, 401);
  checks.push('A client-supplied action selector cannot bypass master authentication');
  console.log(`PASS ${checks.length} Vercel routing checks; no external requests or account changes`);
  fs.mkdirSync(path.join(root, 'reports/deployment-20261017'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports/deployment-20261017/routing-checks.json'), JSON.stringify({ checks, functions: functions.map(file => path.relative(root, file)), externalRequests: 0 }, null, 2));
}
const before = global.fetch; let calls = 0;
global.fetch = async () => { calls++; throw new Error('External requests are forbidden in this routing fixture'); };
main().then(() => assert.equal(calls, 0)).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = before; });
