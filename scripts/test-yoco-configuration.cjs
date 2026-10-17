// Real configuration/runtime handlers and aborted RPCs; synthetic credentials only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../server/functions/_yoco');
const runtime = require('../api/runtime-config');
const checkout = require('../server/functions/yoco-create-checkout').handler;
const { completeCheckout, reserveCheckout } = require('../server/functions/_payment-reservation');
const originalEnv = { ...process.env }, originalFetch = global.fetch, originalTimeout = AbortSignal.timeout;
const names = ['YOCO_SECRET_KEY','YOCO_WEBHOOK_SECRET','YOCO_MODE','YOCO_ENV','YOCO_API_BASE_URL','KAGIE_YOCO_ENABLED'];
const signingSecret = 'whsec_' + Buffer.from('synthetic signing configuration fixture').toString('base64');
const valid = { YOCO_SECRET_KEY: 'sk_test_fixture_only', YOCO_WEBHOOK_SECRET: signingSecret, YOCO_MODE: 'test', KAGIE_YOCO_ENABLED: 'true' };
const checks = [];
async function check(name, action) { await action(); checks.push({ name, passed: true }); console.log('PASS ' + name); }
function setEnv(env) { for (const name of names) delete process.env[name]; Object.assign(process.env, env); }
async function publicConfig() {
  let payload;
  await runtime({ method: 'GET' }, { setHeader() {}, end(value) { payload = JSON.parse(value); } });
  assert.ok(!JSON.stringify(payload).includes(signingSecret));
  assert.ok(!JSON.stringify(payload).includes(valid.YOCO_SECRET_KEY));
  return payload.data.payments.yocoEnabled;
}
async function main() {
  try {
    let requests = 0; global.fetch = async () => { requests++; throw Error('No external request is allowed in configuration tests'); };
    const invalid = {
      'missing checkout key': { YOCO_SECRET_KEY: '' },
      'unclassified checkout key': { YOCO_SECRET_KEY: 'unclassified-fixture' },
      'public checkout key': { YOCO_SECRET_KEY: 'pk_test_fixture' },
      'empty checkout key suffix': { YOCO_SECRET_KEY: 'sk_test_' },
      'live key in test mode': { YOCO_SECRET_KEY: 'sk_live_fixture_only' },
      'test key in live mode': { YOCO_MODE: 'live' },
      'missing explicit mode': { YOCO_MODE: '' },
      'disabled release flag': { KAGIE_YOCO_ENABLED: 'false' },
      'ambiguous release flag': { KAGIE_YOCO_ENABLED: 'yes' },
      'missing signing secret': { YOCO_WEBHOOK_SECRET: '' },
      'invalid signing encoding': { YOCO_WEBHOOK_SECRET: 'whsec_!!!' },
      'short signing secret': { YOCO_WEBHOOK_SECRET: 'whsec_YQ==' },
      'untrusted provider origin': { YOCO_API_BASE_URL: 'https://untrusted.fixture.invalid' }
    };
    for (const [name, change] of Object.entries(invalid)) await check(name + ' disables both advertised and actual checkout', async () => {
      const env = { ...valid, ...change }; setEnv(env);
      assert.throws(() => config(env), error => error.status === 503);
      assert.equal(await publicConfig(), false);
      const result = await checkout({ httpMethod: 'POST', headers: {}, body: '{}' });
      assert.equal(result.statusCode, 503); assert.equal(requests, 0);
      for (const value of [env.YOCO_SECRET_KEY, env.YOCO_WEBHOOK_SECRET].filter(Boolean)) assert.ok(!result.body.includes(value));
    });
    for (const base of ['', 'https://payments.yoco.com', 'https://payments.yoco.com/api', 'https://payments.yoco.com/api/checkouts']) await check('Official endpoint normalization retains valid TEST configuration: ' + (base || 'default'), async () => {
      setEnv({ ...valid, YOCO_API_BASE_URL: base });
      assert.equal(config().endpoint, 'https://payments.yoco.com/api/checkouts'); assert.equal(await publicConfig(), true);
    });
    await check('Explicit matching live configuration remains supported without contacting the provider', async () => {
      setEnv({ ...valid, YOCO_MODE: 'live', YOCO_SECRET_KEY: 'sk_live_fixture_only' });
      assert.equal(config().mode, 'live'); assert.equal(await publicConfig(), true); assert.equal(requests, 0);
    });
    for (const operation of ['reserve', 'complete']) await check('An unresponsive ' + operation + ' RPC aborts; the same attempt can be retried', async () => {
      const attempt = '10000000-0000-4000-8000-000000000001'; let timeoutRequests = 0, calls = [], aborted = false;
      AbortSignal.timeout = ms => { assert.equal(ms, 10000); timeoutRequests++; return originalTimeout(10); };
      global.fetch = async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        if (calls.length > 1) return new Response(JSON.stringify({ payment_id: attempt, redirectUrl: 'https://c.yoco.com/checkout/fixture' }));
        return new Promise((resolve, reject) => {
          const fallback = setTimeout(() => reject(Error('RPC did not abort')), 200);
          assert.ok(options.signal);
          options.signal.addEventListener('abort', () => { clearTimeout(fallback); aborted = true; reject(options.signal.reason); }, { once: true });
        });
      };
      const invoke = operation === 'complete'
        ? () => completeCheckout('https://database.fixture.invalid', 'fixture', attempt, 'ch_fixture', '', { paymentId: attempt })
        : () => reserveCheckout('https://database.fixture.invalid', 'fixture', { applicationId: attempt, userId: attempt, provider: 'yoco', items: [], cartId: attempt, payerName: 'Fixture', phone: '000000', reference: 'FIXTURE', amount: 10, urls: {}, mode: 'test' });
      await assert.rejects(invoke(), error => error.name === 'TimeoutError'); assert.equal(aborted, true);
      assert.equal((await invoke()).payment_id, attempt); assert.deepEqual(calls[0], calls[1]); assert.equal(timeoutRequests, 2);
      AbortSignal.timeout = originalTimeout;
    });
    fs.mkdirSync(path.join(__dirname, '../reports/yoco-preview-20261017'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../reports/yoco-preview-20261017/configuration-checks.json'), JSON.stringify({ runAt: new Date().toISOString(), scope: 'Synthetic configuration and timeout fixtures; no provider transaction', checks }, null, 2));
    console.log(checks.length + ' Yoco configuration and timeout regression checks passed.');
  } finally {
    global.fetch = originalFetch; AbortSignal.timeout = originalTimeout;
    for (const name of Object.keys(process.env)) if (!(name in originalEnv)) delete process.env[name]; Object.assign(process.env, originalEnv);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
