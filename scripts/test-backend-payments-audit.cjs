// Calls the real four handlers and deployed adapters. Every HTTP dependency is an
// isolated fixture; no payment gateway, production database, or account is used.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '..');
const { SERVICE_PRICES } = require('../server/functions/_payment-checkout');
const liveMetadata = JSON.parse(fs.readFileSync(path.join(root, 'reports/backend-audit/data-storage-metadata.json'), 'utf8'));
const liveColumns = new Map();
for (const column of liveMetadata.columns || []) {
  if (!liveColumns.has(column.table)) liveColumns.set(column.table, new Set());
  liveColumns.get(column.table).add(column.column);
}
const handlers = Object.fromEntries(['yoco-create-checkout', 'yoco-webhook', 'payfast-create-checkout', 'payfast-itn'].map(name => [name, require(`../server/functions/${name}`).handler]));
const ids = { user: '11111111-1111-4111-8111-111111111111', app: '22222222-2222-4222-8222-222222222222', cart: '33333333-3333-4333-8333-333333333333', pack: '44444444-4444-4444-8444-444444444444', item: '55555555-5555-4555-8555-555555555555', payment: '66666666-6666-4666-8666-666666666666' };
const envBefore = { ...process.env };
const fetchBefore = global.fetch;
Object.assign(process.env, { SUPABASE_URL: 'https://database.fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key', YOCO_SECRET_KEY: 'fixture-yoco-key', YOCO_WEBHOOK_SECRET: 'whsec_' + Buffer.from('isolated-webhook-secret').toString('base64'), YOCO_MODE: 'test', KAGIE_YOCO_ENABLED:'true', PAYFAST_MERCHANT_ID: '10000100', PAYFAST_MERCHANT_KEY: 'fixture-merchant-key', PAYFAST_PASSPHRASE: "fixture's salt!", PAYFAST_VALIDATE_URL: 'https://sandbox.payfast.co.za/eng/query/validate' });
const checks = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
let state;
function reset() {
  state = {
    calls: [], providerBodies: [], notifications: [], settlementCalls: [], remoteValidationBodies: [],
    actor: { id: ids.user, email: 'fixture@example.invalid', app_metadata: { role: 'user' } },
    profiles: [{ id: ids.user, role: 'user', is_active: true, email: 'fixture@example.invalid' }],
    carts: [{ id: ids.cart, user_id: ids.user, total_amount: 250 }],
    cart_items: [{ id: ids.item, cart_id: ids.cart, item_type: 'application_pack', ref_id: ids.pack, name: 'Starter Pack', price: 250, quantity: 1, metadata: { code: 'launch', applicationId: ids.app, applicationType: 'undergraduate', institutions: [] } }],
    application_packs: [{ id: ids.pack, code: 'launch', name: 'Starter Pack', price: 250, is_active: true, institution_limit: 10, application_type: 'UNDERGRADUATE' }],
    applications: [{ id: ids.app, user_id: ids.user, status: 'Draft', payment_status: 'Payment Pending', application_type: 'UNDERGRADUATE' }],
    application_institutions: [], institutions: [], promo_campaigns: [], payments: [], payment_service_prices: Object.entries(SERVICE_PRICES).map(([code,price])=>({code,amount_cents:price*100,currency:'ZAR',enabled:true,requires_quote:['transport_assist','accommodation_assist'].includes(code),name:({forgot_pin:'Forgot PIN'})[code]||code}))
  };
}
function matches(row, query) {
  return [...query.entries()].filter(([key]) => !['select', 'limit', 'order'].includes(key)).every(([key, value]) => {
    if (value.startsWith('eq.')) return String(row[key] ?? '') === value.slice(3);
    if (value.startsWith('not.in.(')) return !value.slice(8, -1).split(',').includes(String(row[key]));
    if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
    throw new Error('Unimplemented fixture filter: ' + key);
  });
}
global.fetch = async (input, options = {}) => {
  const url = new URL(String(input)); const method = options.method || 'GET';
  const body = options.body ? String(options.body) : '';
  state.calls.push({ path: url.pathname, query: url.search, method });
  if (url.hostname === 'payments.yoco.com') {
    if(state.providerOffline)throw new Error('Fixture provider outage');
    assert.equal(url.pathname, '/api/checkouts');
    state.providerBodies.push(JSON.parse(body));
    return json({ id: 'ch_fixture', status: 'created', redirectUrl: 'https://c.yoco.com/checkout/fixture' });
  }
  if (url.hostname === 'sandbox.payfast.co.za') {
    state.remoteValidationBodies.push(body);
    if (state.remoteOffline) throw new Error('Fixture validation outage');
    return new Response(state.remoteInvalid ? 'INVALID' : 'VALID', { status: state.remoteStatus || 200 });
  }
  assert.equal(url.hostname, 'database.fixture.invalid', 'No unmocked external request is allowed');
  if (url.pathname === '/auth/v1/user') {
    if (state.badToken) return json({ message: 'Invalid JWT' }, 401);
    return json(state.actor);
  }
  if (['/rest/v1/rpc/reserve_payment_checkout','/rest/v1/rpc/reserve_yoco_checkout'].includes(url.pathname)) {
    const data=JSON.parse(body), app=state.applications.find(r=>r.id===data.p_application_id);
    if(state.reservationUnavailable) return json({message:'missing RPC'},404);
    if(state.concurrentPaid){state.concurrentPaid=false;app.payment_status='Verified';}
    if(app.payment_status==='Verified')return json({code:'P0001',message:'Application is unavailable or paid'},400);
    if(state.lease){
      if(state.lease.provider!==data.p_provider||state.lease.fingerprint!==data.p_fingerprint)return json({code:'P0001',message:'An active checkout already exists'},400);
      return json({payment_id:state.lease.payment_id,reference:state.payments.find(p=>p.id===state.lease.payment_id)?.reference,response:state.lease.response,reused:true});
    }
    const id=crypto.randomUUID();
    state.payments.push({id,application_id:app.id,user_id:state.actor.id,...data.p_payment,provider:data.p_provider,method:data.p_provider==='yoco'?'Yoco Checkout':'PayFast Checkout',status:'Payment Pending',gateway_checkout_id:data.p_provider==='payfast'?id:null,gateway_mode:data.p_payment.checkout_snapshot.gatewayMode,note:''});
    state.lease={payment_id:id,provider:data.p_provider,fingerprint:data.p_fingerprint,response:null};
    if(data.p_provider==='yoco')state.payments[state.payments.length-1].reference='KAG-YOCO-'+id.replaceAll('-','').toUpperCase();
    return json({payment_id:id,reference:state.payments[state.payments.length-1].reference,response:null,reused:false});
  }
  if(url.pathname==='/rest/v1/rpc/replace_checkout_institutions'){const data=JSON.parse(body);state.application_institutions=data.p_rows;return json(data.p_rows.length);}
  if (url.pathname === '/rest/v1/rpc/complete_payment_checkout') {
    const data=JSON.parse(body),p=state.payments.find(r=>r.id===data.p_payment_id);
    if(state.completionUnavailable)return json({message:'Fixture completion outage'},500);
    p.gateway_checkout_id=data.p_checkout_id;p.note=data.p_note;
    state.lease.response=data.p_response;return json(data.p_response);
  }
  if (url.pathname === '/rest/v1/rpc/process_yoco_refund_event') { if(state.refundUnavailable)return json({message:'Fixture database outage'},500);state.refundEvents=state.refundEvents||[];state.refundEvents.push(JSON.parse(body));return json(true); }
  if (['/rest/v1/rpc/settle_gateway_payment','/rest/v1/rpc/process_yoco_payment_event'].includes(url.pathname)) {
    const data = JSON.parse(body); if(data.p_amount_cents!==undefined)data.p_amount=data.p_amount_cents/100; state.settlementCalls.push(data);
    if (state.missingRpc) return json({ message: 'Function is missing' }, 404);
    if (state.rpcFailure) return json({ message: 'Fixture transaction rolled back' }, 500);
    const payment = state.payments.find(row => row.id === data.p_payment_id);
    assert.ok(payment, 'RPC must receive the exact stored payment ID');
    assert.equal(data.p_amount, Number(payment.amount));
    assert.equal(data.p_checkout_id, payment.gateway_checkout_id);
    const duplicate = payment.status === 'Verified' || (!data.p_success && payment.status === 'Failed');
    if (!duplicate) {
      payment.status = data.p_success ? 'Verified' : 'Failed';
      const app = state.applications.find(row => row.id === payment.application_id);
      if (app.payment_status !== 'Verified') app.payment_status = payment.status;
    }
    return json({ applied: !duplicate, duplicate, application_already_paid: Boolean(state.additionalPayment) });
  }
  const table = url.pathname.replace('/rest/v1/', '');
  if (table === 'notifications') { state.notifications.push(JSON.parse(body)); return json([]); }
  if (table === 'payment_webhook_events') return json([]);
  if (!Object.prototype.hasOwnProperty.call(state, table)) throw new Error('Unimplemented fixture table: ' + table);
  let rows = state[table];
  const selection = url.searchParams.get('select');
  if (selection && selection !== '*' && liveColumns.has(table)) {
    for (const column of selection.split(',')) assert.ok(liveColumns.get(table).has(column), `Selected ${table}.${column} must exist in the live-schema snapshot`);
  }
  if (table === 'profiles' && url.searchParams.get('role')) return json([]);
  if (method === 'GET') return json(rows.filter(row => matches(row, url.searchParams)));
  if (method === 'POST') {
    const payload = JSON.parse(body); const inserted = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: row.id || crypto.randomUUID(), ...row }));
    rows.push(...inserted); return json(inserted, 201);
  }
  if (state.failCartPatch && table === 'carts' && method === 'PATCH') { state.failCartPatch = false; return json({ message: 'Fixture cart write outage' }, 500); }
  if (method === 'PATCH') { const payload = JSON.parse(body); if (state.concurrentPaid && table === 'applications') { state.concurrentPaid = false; rows[0].payment_status = 'Verified'; } const changed = rows.filter(row => matches(row, url.searchParams)); changed.forEach(row => Object.assign(row, payload)); return json(String(options.headers?.Prefer || '').includes('return=representation') ? changed : []); }
  if (method === 'DELETE') { state[table] = rows.filter(row => !matches(row, url.searchParams)); return json([]); }
  throw new Error('Unimplemented fixture method: ' + method);
};
function checkoutEvent(overrides = {}) {
  return { httpMethod: 'POST', headers: { origin: 'https://kagie.app', authorization: 'Bearer fixture-token' }, body: JSON.stringify({ payerName: "O'Brian Fixture!", phone: '0712345678', reference: 'FIXTURE-ORDER', note: 'Local fixture only', successUrl: 'https://kagie.app/payment.html?result=success', cancelUrl: 'https://kagie.app/payment.html?result=cancel', failureUrl: 'https://kagie.app/payment.html?result=failure', ...overrides }) };
}
function paymentFixture(provider = 'yoco') {
  const checkoutId = provider === 'yoco' ? 'ch_fixture' : ids.payment;
  const meta = { gatewayProvider: provider, gatewayCheckoutId: checkoutId, checkoutCartId: ids.cart, checkoutCartItemIds: [ids.item], customerNote: 'Fixture' };
  state.payments = [{ id: ids.payment, application_id: ids.app, amount: 250, status: 'Payment Pending', provider, gateway_mode:'test', currency: 'ZAR', gateway_checkout_id: checkoutId, method: provider === 'yoco' ? 'Yoco Checkout' : 'PayFast Checkout', reference: 'FIXTURE-ORDER', note: '__KAGIE_PAYMENT_META__' + JSON.stringify(meta) }];
}
function yocoEvent(overrides = {}, options = {}) {
  const payload = { amount: 25000, currency: 'ZAR', id: 'pay_fixture', mode: 'test', status: 'succeeded', metadata: { checkoutId: 'ch_fixture' }, ...overrides };
  const raw = JSON.stringify({ id: 'evt_fixture', type: options.type || 'payment.succeeded', payload }, null, 2);
  const timestamp = String(Math.floor(Date.now() / 1000) + (options.age || 0));
  const signature = crypto.createHmac('sha256', Buffer.from('isolated-webhook-secret')).update(`msg_fixture.${timestamp}.${raw}`).digest('base64');
  return { httpMethod: 'POST', headers: { 'Webhook-Id': 'msg_fixture', 'Webhook-Timestamp': timestamp, 'Webhook-Signature': `v1,${signature}` }, body: options.base64 ? Buffer.from(raw).toString('base64') : raw, isBase64Encoded: Boolean(options.base64) };
}
function pfEncode(value) { return new URLSearchParams([['v', String(value)]]).toString().slice(2).replace(/\*/g, '%2A'); }
function payfastEvent(overrides = {}) {
  const fields = { m_payment_id: ids.payment, pf_payment_id: 'pf_fixture', payment_status: 'COMPLETE', item_name: "O'Brian Fixture!*~", item_description: '', amount_gross: '250.00', amount_fee: '-5.00', amount_net: '245.00', custom_str1: ids.user, custom_str2: 'FIXTURE-ORDER', custom_str3: '', custom_int1: '', merchant_id: process.env.PAYFAST_MERCHANT_ID, ...overrides };
  const unsigned = Object.entries(fields).map(([key, value]) => `${key}=${pfEncode(value)}`).join('&');
  const signature = crypto.createHash('md5').update(unsigned + '&passphrase=' + pfEncode(process.env.PAYFAST_PASSPHRASE)).digest('hex');
  return { httpMethod: 'POST', headers: {}, body: unsigned + '&signature=' + signature };
}
async function check(name, run) { reset(); await run(); checks.push(name); console.log('PASS ' + name); }
async function adapterCall(adapter, event, bodyOverride) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
  const req = bodyOverride ? { method: 'POST', headers: event.headers, url: '/fixture', readable: false, body: bodyOverride } : Object.assign(Readable.from([raw.subarray(0, 17), raw.subarray(17)]), { method: 'POST', headers: event.headers, url: '/fixture' });
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
  await adapter(req, res); return res;
}
async function main() {
  await check('Server service prices match the public catalog exactly', () => { const context = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), context); assert.deepEqual(Object.fromEntries(context.window.KagieData.extraServices.map(item => [item.id, item.price])), SERVICE_PRICES); });
  await check('Checkout reservation failure prevents provider calls',async()=>{state.reservationUnavailable=true;assert.equal((await handlers['yoco-create-checkout'](checkoutEvent())).statusCode,503);assert.equal(state.providerBodies.length,0);assert.equal(state.payments.length,0);});
  await check('Provider outage retains durable attempt for recovery',async()=>{state.providerOffline=true;assert.equal((await handlers['yoco-create-checkout'](checkoutEvent())).statusCode,503);assert.equal(state.payments.length,1);assert.equal(state.payments[0].gateway_checkout_id,null);state.providerOffline=false;assert.equal((await handlers['yoco-create-checkout'](checkoutEvent())).statusCode,200);assert.equal(state.payments.length,1);});
  await check('PayFast retries reuse the same payable reference',async()=>{const a=await handlers['payfast-create-checkout'](checkoutEvent()),b=await handlers['payfast-create-checkout'](checkoutEvent());assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.equal(JSON.parse(a.body).data.fields.m_payment_id,JSON.parse(b.body).data.fields.m_payment_id);assert.equal(state.payments.length,1);});
  await check('An active checkout blocks switching payment providers',async()=>{assert.equal((await handlers['yoco-create-checkout'](checkoutEvent())).statusCode,200);assert.equal((await handlers['payfast-create-checkout'](checkoutEvent())).statusCode,409);assert.equal(state.payments.length,1);});
  await check('Changed checkout details cannot overwrite a payable attempt',async()=>{assert.equal((await handlers['yoco-create-checkout'](checkoutEvent())).statusCode,200);assert.equal((await handlers['yoco-create-checkout'](checkoutEvent({reference:'DIFFERENT'}))).statusCode,409);assert.equal(state.payments.length,1);});
  for (const provider of ['yoco', 'payfast']) {
    const handler = handlers[provider + '-create-checkout'];
    await check(provider + ': unauthenticated checkout makes no database or gateway call', async () => { const event = checkoutEvent(); event.headers.authorization = ''; assert.equal((await handler(event)).statusCode, 401); assert.equal(state.calls.length, 0); });
    await check(provider + ': real session required', async () => { state.badToken = true; assert.equal((await handler(checkoutEvent())).statusCode, 401); assert.equal(state.payments.length, 0); });
    await check(provider + ': inactive learners cannot create checkout', async () => { state.profiles[0].is_active = false; assert.equal((await handler(checkoutEvent())).statusCode, 403); assert.equal(state.providerBodies.length, 0); });
    await check(provider + ': forged cheaper package cannot reach provider', async () => { state.cart_items[0].price = 2; assert.equal((await handler(checkoutEvent())).statusCode, 409); assert.equal(state.payments.length, 0); assert.equal(state.providerBodies.length, 0); });
    await check(provider + ': zero and negative quantities cannot bypass price', async () => { for (const quantity of [0, -1, 0.1, 101]) { state.cart_items[0].quantity = quantity; assert.equal((await handler(checkoutEvent())).statusCode, 400); } assert.equal(state.payments.length, 0); });
    await check(provider + ': forged discount is recalculated from trusted campaign', async () => { state.promo_campaigns = [{ code: 'FIXTURE01', title: 'Fixture', discount_kind: 'percent', discount_value: 10, is_active: true, used_count: 0, max_uses: 10 }]; state.cart_items.push({ id: 'promo-fixture', cart_id: ids.cart, item_type: 'custom', name: 'Forged discount', price: -248, quantity: 1, metadata: { isPromoDiscount: true, promoCode: 'FIXTURE01' } }); assert.equal((await handler(checkoutEvent())).statusCode, 409); assert.equal(state.payments.length, 0); });
    await check(provider + ': legitimate campaign discount succeeds', async () => { state.promo_campaigns = [{ code: 'FIXTURE01', title: 'Fixture', discount_kind: 'percent', discount_value: 10, is_active: true, used_count: 0, max_uses: 10 }]; state.cart_items.push({ id: 'promo-fixture', cart_id: ids.cart, item_type: 'custom', name: 'Discount', price: -25, quantity: 1, metadata: { isPromoDiscount: true, promoCode: 'FIXTURE01' } }); assert.equal((await handler(checkoutEvent())).statusCode, 200); assert.equal(state.payments[0].amount, 225); });
    await check(provider + ': another learner application ID is rejected', async () => { state.cart_items[0].metadata.applicationId = '77777777-7777-4777-8777-777777777777'; assert.equal((await handler(checkoutEvent())).statusCode, 403); assert.equal(state.payments.length, 0); });
    await check(provider + ': paid application cannot be reset to pending', async () => { state.applications[0].payment_status = 'Verified'; assert.equal((await handler(checkoutEvent())).statusCode, 409); assert.equal(state.applications[0].payment_status, 'Verified'); assert.equal(state.payments.length, 0); });
    await check(provider + ': concurrent successful payment cannot be overwritten by checkout preparation', async () => { state.concurrentPaid = true; assert.equal((await handler(checkoutEvent())).statusCode, 409); assert.equal(state.applications[0].payment_status, 'Verified'); assert.equal(state.payments.length, 0); });
    await check(provider + ': purchased service details have a durable trusted snapshot', async () => { state.cart_items.push({ id: 'service-fixture', cart_id: ids.cart, item_type: 'service', name: 'Recovery help', price: 10, quantity: 1, metadata: { serviceCode: 'forgot_pin', serviceName: 'Forged title', institution: 'Fixture College', studentNumber: 'FIXTURE123', phone: '0712345678', status: 'Completed', paymentStatus: 'Verified', note: 'Please help' } }); const result = await handler(checkoutEvent()); assert.equal(result.statusCode, 200, result.body); const service = state.payments[0].checkout_snapshot.services[0]; assert.equal(service.serviceCode, 'forgot_pin'); assert.equal(service.serviceName, 'Forgot PIN'); assert.equal(service.price, 10); assert.equal(service.institution, 'Fixture College'); assert.equal(service.status, undefined); assert.equal(service.paymentStatus, undefined); });
    await check(provider + ': unconfirmed booking prices are refused before any charge', async () => { state.cart_items.push({ id: 'transport-fixture', cart_id: ids.cart, item_type: 'service', name: 'Transport', price: 10, quantity: 1, metadata: { serviceCode: 'transport_assist' } }); assert.equal((await handler(checkoutEvent())).statusCode, 409); assert.equal(state.payments.length, 0); });
    await check(provider + ': unavailable institutions are refused before application payment changes', async () => { state.cart_items[0].metadata.institutions = [{ institutionName: 'Fixture Closed College' }]; state.institutions = [{ name: 'Fixture Closed College', is_active: true, manual_status: 'closed' }]; assert.equal((await handler(checkoutEvent())).statusCode, 409); assert.equal(state.applications[0].status, 'Draft'); assert.equal(state.payments.length, 0); });
    await check(provider + ': package institution limits apply to separate cart institution rows', async () => { state.application_packs[0].institution_limit = 1; for (let i = 0; i < 2; i++) state.cart_items.push({ id: 'institution-' + i, cart_id: ids.cart, item_type: 'institution', name: 'Fixture College ' + i, price: 0, quantity: 1 }); assert.equal((await handler(checkoutEvent())).statusCode, 400); assert.equal(state.payments.length, 0); });
    await check(provider + ': external return address is refused', async () => { assert.equal((await handler(checkoutEvent({ successUrl: 'https://example.invalid/steal' }))).statusCode, 400); assert.equal(state.calls.length, 0); });
    await check(provider + ': checkout saves a separate provider attempt with cart snapshot', async () => { const result = await handler(checkoutEvent()); assert.equal(result.statusCode, 200, result.body); assert.equal(state.payments.length, 1); const payment = state.payments[0]; assert.equal(payment.amount, 250); assert.equal(payment.provider, provider); assert.equal(payment.currency, 'ZAR'); const meta = JSON.parse(payment.note.slice('__KAGIE_PAYMENT_META__'.length)); assert.deepEqual(meta.checkoutCartItemIds, [ids.item]); if (provider === 'payfast') { const fields = JSON.parse(result.body).data.fields; assert.equal(fields.m_payment_id, payment.id); assert.equal(payment.gateway_checkout_id, payment.id); assert.equal(fields.notify_url, 'https://kagie.app/v1/payments/payfast/itn'); const expected = crypto.createHash('md5').update(Object.entries(fields).filter(([key]) => key !== 'signature').map(([key, value]) => `${key}=${pfEncode(value)}`).join('&') + '&passphrase=' + pfEncode(process.env.PAYFAST_PASSPHRASE)).digest('hex'); assert.equal(fields.signature, expected); } else assert.equal(state.providerBodies[0].amount, 25000); });
  }
  for (const provider of ['yoco', 'payfast']) {
    const handler = handlers[provider === 'yoco' ? 'yoco-webhook' : 'payfast-itn'];
    const event = provider === 'yoco' ? yocoEvent : payfastEvent;
    await check(provider + ': correctly signed documented callback settles without client confirmation', async () => { paymentFixture(provider); const result = await handler(event()); assert.equal(result.statusCode, 200, result.body); assert.equal(state.settlementCalls.length, 1); assert.equal(state.payments[0].status, 'Verified'); if (provider === 'payfast') { assert.ok(!state.remoteValidationBodies[0].includes('_notify-validate')); assert.ok(!state.remoteValidationBodies[0].includes('signature=')); assert.ok(!state.remoteValidationBodies[0].includes('merchant_key=')); } });
    await check(provider + ': wrong paid amount cannot settle', async () => { paymentFixture(provider); const result = await handler(event(provider === 'yoco' ? { amount: 200 } : { amount_gross: '2.00' })); assert.equal(result.statusCode, 409); assert.equal(state.settlementCalls.length, 0); assert.equal(state.payments[0].status, 'Payment Pending'); });
    await check(provider + ': another provider payment record cannot settle', async () => { paymentFixture(provider); state.payments[0].provider = 'other'; assert.equal((await handler(event())).statusCode, 409); assert.equal(state.settlementCalls.length, 0); });
    await check(provider + ': absent checkout requests retry rather than acknowledging loss', async () => { assert.equal((await handler(event())).statusCode, 503); assert.equal(state.settlementCalls.length, 0); });
    await check(provider + ': unavailable settlement RPC fails closed without partial updates', async () => { paymentFixture(provider); state.missingRpc = true; assert.equal((await handler(event())).statusCode, 503); assert.equal(state.payments[0].status, 'Payment Pending'); assert.equal(state.applications[0].payment_status, 'Payment Pending'); assert.equal(state.cart_items.length, 1); });
    await check(provider + ': duplicate success sends one notification and preserves newly added cart items', async () => { paymentFixture(provider); state.cart_items.push({ id: 'new-after-checkout', cart_id: ids.cart, price: 10, quantity: 1 }); assert.equal((await handler(event())).statusCode, 200); assert.equal((await handler(event())).statusCode, 200); assert.equal(state.notifications.length, 1); assert.equal(state.cart_items.length, 1); assert.equal(state.cart_items[0].id, 'new-after-checkout'); assert.equal(state.carts[0].total_amount, 10); });
    await check(provider + ': retry repairs cart cleanup after committed settlement', async () => { paymentFixture(provider); state.failCartPatch = true; assert.equal((await handler(event())).statusCode, 503); assert.equal(state.payments[0].status, 'Verified'); assert.equal((await handler(event())).statusCode, 200); assert.equal(state.carts[0].total_amount, 0); });
    await check(provider + ': callback cannot downgrade a verified payment', async () => { paymentFixture(provider); await handler(event()); const failure = provider === 'yoco' ? yocoEvent({ status: 'failed' }, { type: 'payment.failed' }) : payfastEvent({ payment_status: 'FAILED' }); assert.equal((await handler(failure)).statusCode, 200); assert.equal(state.payments[0].status, 'Verified'); assert.equal(state.applications[0].payment_status, 'Verified'); });
    await check(provider + ': additional payment flags staff review and retains unfulfilled cart across retries', async () => { paymentFixture(provider); state.additionalPayment = true; state.applications[0].payment_status = 'Verified'; for (let i = 0; i < 2; i++) { const result = await handler(event()); assert.equal(result.statusCode, 200); assert.equal(JSON.parse(result.body).needsReview, true); } assert.equal(state.cart_items.length, 1); assert.equal(state.notifications.length, 1); assert.equal(state.notifications[0][0].title, 'Payment received for review'); });
  }
  await check('Yoco: signed partial refunds persist reconciliation without changing fulfillment',async()=>{paymentFixture();state.payments[0].status='Verified';const event=yocoEvent({id:'refund_fixture',amount:5000,status:'succeeded'},{type:'refund.succeeded'});const result=await handlers['yoco-webhook'](event);assert.equal(result.statusCode,200,result.body);assert.equal(state.refundEvents.length,1);assert.equal(state.payments[0].status,'Verified');assert.equal(state.settlementCalls.length,0);});
  await check('Yoco: refund recording outage requests provider retry',async()=>{paymentFixture();state.refundUnavailable=true;assert.equal((await handlers['yoco-webhook'](yocoEvent({id:'refund_fixture',amount:5000,status:'succeeded'},{type:'refund.succeeded'}))).statusCode,503);});
  await check('Yoco: signature covers exact raw bytes and rejects body tampering', async () => { paymentFixture(); const event = yocoEvent(); event.body = event.body.replace('25000', '25001'); assert.equal((await handlers['yoco-webhook'](event)).statusCode, 403); assert.equal(state.calls.length, 0); });
  await check('Yoco: retrying a checkout reuses its immutable pending payment record', async () => { for (let i = 0; i < 2; i++) assert.equal((await handlers['yoco-create-checkout'](checkoutEvent())).statusCode, 200); assert.equal(state.payments.length, 1); });
  await check('Yoco: old and future webhook timestamps are rejected', async () => { for (const age of [-181, 181]) assert.equal((await handlers['yoco-webhook'](yocoEvent({}, { age }))).statusCode, 403); assert.equal(state.calls.length, 0); });
  await check('Yoco: malformed configured secret cannot become a public empty HMAC key', async () => { const original = process.env.YOCO_WEBHOOK_SECRET; try { process.env.YOCO_WEBHOOK_SECRET = 'incorrect-secret'; const event = yocoEvent(); event.headers['Webhook-Signature'] = 'v1,' + crypto.createHmac('sha256', Buffer.alloc(0)).update(`msg_fixture.${event.headers['Webhook-Timestamp']}.${event.body}`).digest('base64'); assert.equal((await handlers['yoco-webhook'](event)).statusCode, 403); assert.equal(state.calls.length, 0); } finally { process.env.YOCO_WEBHOOK_SECRET = original; } });
  await check('Yoco: rotated signatures, case-insensitive headers and base64 body are accepted', async () => { paymentFixture(); const event = yocoEvent({}, { base64: true }); event.headers['Webhook-Signature'] = 'v1,invalid ' + event.headers['Webhook-Signature']; assert.equal((await handlers['yoco-webhook'](event)).statusCode, 200); });
  await check('Yoco: correct signature still requires ZAR currency and mode', async () => { paymentFixture(); for (const fields of [{ currency: 'USD' }, { mode: 'live' }]) assert.equal((await handlers['yoco-webhook'](yocoEvent(fields))).statusCode, 409); assert.equal(state.settlementCalls.length, 0); });
  await check('PayFast: documented ITN omits merchant key and authenticates by signature plus remote validation', async () => { paymentFixture('payfast'); const event = payfastEvent(); assert.ok(!event.body.includes('merchant_key')); assert.equal((await handlers['payfast-itn'](event)).statusCode, 200); });
  await check('PayFast: ITN signature includes empty optional fields and exact spaces', async () => { paymentFixture('payfast'); const event = payfastEvent({ item_description: '  Exact text & spacing  ' }); assert.ok(event.body.includes('custom_str3=&custom_int1=')); assert.equal((await handlers['payfast-itn'](event)).statusCode, 200); assert.ok(state.remoteValidationBodies[0].includes('custom_str3=&custom_int1=')); });
  await check('PayFast: duplicate form fields and malformed signature are rejected before validation', async () => { paymentFixture('payfast'); const event = payfastEvent(); event.body += '&amount_gross=1'; assert.equal((await handlers['payfast-itn'](event)).statusCode, 400); assert.equal(state.remoteValidationBodies.length, 0); });
  await check('PayFast: invalid remote verification cannot settle and temporary outage is retryable', async () => { paymentFixture('payfast'); state.remoteInvalid = true; assert.equal((await handlers['payfast-itn'](payfastEvent())).statusCode, 403); state.remoteInvalid = false; state.remoteOffline = true; assert.equal((await handlers['payfast-itn'](payfastEvent())).statusCode, 503); assert.equal(state.settlementCalls.length, 0); });
  await check('PayFast: payment reference and learner must match exact checkout attempt', async () => { paymentFixture('payfast'); for (const fields of [{ custom_str2: 'OTHER' }, { custom_str1: 'other-user' }]) assert.equal((await handlers['payfast-itn'](payfastEvent(fields))).statusCode, 409); assert.equal(state.settlementCalls.length, 0); });
  await check('Deployed webhook adapter preserves whitespace in signed raw JSON', async () => { paymentFixture(); const result = await adapterCall(require('../api/payments/yoco/webhook'), yocoEvent()); assert.equal(result.statusCode, 200); assert.equal(state.settlementCalls.length, 1); });
  await check('Deployed signature adapters reject pre-parsed objects', async () => { const result = await adapterCall(require('../api/payments/yoco/webhook'), yocoEvent(), { reconstructed: true }); assert.equal(result.statusCode, 400); assert.equal(state.calls.length, 0); });
  await check('Serverless adapter limits streamed request size', async () => { const { createServerlessAdapter } = require('../api/_lib/serverless-adapter'); const adapter = createServerlessAdapter(path.join(root, 'server/functions/yoco-webhook.js'), { maxBodyBytes: 8 }); const result = await adapterCall(adapter, yocoEvent()); assert.equal(result.statusCode, 413); assert.equal(state.calls.length, 0); });
  const report = { generatedAt: new Date().toISOString(), scope: 'Offline real-handler/provider-contract fixtures; actual atomic database transaction verified separately by SQL audit.', passed: checks.length, checks, productionMutations: 0, livePayments: 0 };
  fs.mkdirSync(path.join(root, 'reports/backend-audit'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports/backend-audit/payments-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${checks.length} payment audit checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = fetchBefore; for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key]; Object.assign(process.env, envBefore); });
