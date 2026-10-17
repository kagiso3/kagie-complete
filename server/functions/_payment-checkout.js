const crypto = require('node:crypto');

// Seed defaults retained for compatibility checks. Runtime service pricing comes
// exclusively from payment_service_prices; these constants do not authorize charges.
const SERVICE_PRICES = Object.freeze({
  accommodation_assist: 0,
  transport_assist: 0,
  funding_assist: 220,
  change_email: 50,
  re_apply: 50,
  forgot_pin: 10,
  forgot_student_number: 10
});
const SERVICE_NAMES = Object.freeze({ accommodation_assist: 'Accommodation Assist', transport_assist: 'Transport Assist', funding_assist: 'Funding Assist', change_email: 'Change Email', re_apply: 'Re-Apply Help', forgot_pin: 'Forgot PIN', forgot_student_number: 'Forgot Student Number' });
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLowerCase();
function cartItemHash(row) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  return crypto.createHash('sha256').update(JSON.stringify(canonical({type:row.item_type,ref:row.ref_id||'',name:row.name,price:Number(row.price),quantity:Number(row.quantity),metadata:row.metadata||{}}))).digest('hex');
}
function reject(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 99999999) return NaN;
  return Math.round(number * 100);
}

async function priceCart(items, { read, userId }) {
  if (!Array.isArray(items) || !items.length || items.length > 100) reject('Your cart is empty or too large. Please review it before paying.');
  const promos = items.filter(item => item.isPromoDiscount || clean(item.promoCode));
  if (promos.length > 1) reject('Use one promo code per checkout.');
  const purchases = items.filter(item => !promos.includes(item));
  if (!purchases.length) reject('Add a package or service before paying.');
  const packRows = purchases.some(item => item.type === 'application_pack')
    ? await read('/rest/v1/application_packs?select=*&limit=1000') : [];
  const serviceRows = purchases.some(item => ['service', 'service_request'].includes(item.type))
    ? await read('/rest/v1/payment_service_prices?select=*&limit=1000') : [];
  let packageCount = 0;
  let subtotalCents = 0;
  const priced = [];
  for (let item of purchases) {
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) reject('A cart item has an invalid quantity. Please remove it and add it again.');
    let unitPriceCents;
    let catalogId = '';
    if (item.type === 'application_pack') {
      if (++packageCount > 1 || quantity !== 1) reject('Checkout supports one application package at a time.');
      const ref = clean(item.refId || item.remoteId);
      const code = key(item.code || item.packId || item.package?.code || item.selectedPackage?.code);
      const name = key(item.packName || item.name);
      const matches = (Array.isArray(packRows) ? packRows : []).filter(row => ref ? clean(row.id) === ref : (code ? key(row.code) === code : key(row.name) === name));
      const pack = matches.length === 1 ? matches[0] : null;
      if (!pack || pack.is_active === false) reject('This application package is no longer available. Please choose it again.', 409);
      unitPriceCents = cents(pack.price);
      catalogId = clean(pack.id);
      item = { ...item, canonicalPackageName: clean(pack.name) };
      const institutions = Array.isArray(item.institutions) && item.institutions.length ? item.institutions : purchases.filter(entry => entry.type === 'institution');
      if (!pack.is_unlimited && Number.isFinite(Number(pack.institution_limit)) && institutions.length > Number(pack.institution_limit)) reject('The selected institutions exceed this package limit.');
      const applicationType = value => {
        const normalized = key(value).replace(/[^a-z]/g, '');
        if (['postgrad', 'postgraduate'].includes(normalized)) return 'postgraduate';
        if (['undergrad', 'undergraduate'].includes(normalized)) return 'undergraduate';
        return normalized;
      };
      const requestedType = item.applicationType || item.application_type;
      if (pack.application_type && requestedType && applicationType(pack.application_type) !== applicationType(requestedType)) reject('This package does not match the selected application type. Please choose it again.', 409);
    } else if (item.type === 'service' || item.type === 'service_request') {
      const code = key(item.serviceCode || item.code || item.service?.id || item.id);
      const service = (Array.isArray(serviceRows) ? serviceRows : []).find(row => row.code === code);
      if (!service || !service.enabled || service.currency !== 'ZAR') reject('This service needs a confirmed Kagie price before online payment.', 409);
      if (service.requires_quote) reject('This booking needs a confirmed Kagie quote before online payment.', 409);
      unitPriceCents = Number(service.amount_cents);
      item = { ...item, canonicalServiceName: clean(service.name), serviceCode: code };
    } else if (item.type === 'institution') {
      // Institution fees are paid directly to the institution, outside Kagie.
      unitPriceCents = 0;
    } else {
      reject('This cart item has no confirmed Kagie price. Please remove it before paying.', 409);
    }
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) reject('A catalog price is unavailable. Please contact Kagie.', 503);
    if (cents(item.price) !== unitPriceCents) reject('A price in your cart has changed. Remove the item and add it again before paying.', 409);
    subtotalCents += unitPriceCents * quantity;
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 99999999) reject('This cart total is too large.');
    priced.push({ ...item, price: unitPriceCents / 100, quantity, ...(catalogId ? { refId: catalogId, remoteId: catalogId } : {}) });
  }
  let discountCents = 0;
  if (promos.length) {
    const code = clean(promos[0].promoCode).toUpperCase();
    if (!/^[A-Z0-9]{9}$/.test(code)) reject('That promo code is not valid.');
    const rows = await read(`/rest/v1/promo_campaigns?code=eq.${encodeURIComponent(code)}&select=*&limit=1`);
    const promo = Array.isArray(rows) ? rows[0] : null;
    const redeemed = Array.isArray(promo?.redeemed_user_ids) ? promo.redeemed_user_ids : [];
    if (!promo || promo.is_active === false || redeemed.includes(userId) || (Number(promo.max_uses) > 0 && Number(promo.used_count) >= Number(promo.max_uses))) reject('That promo code is inactive, already used, or has reached its limit.', 409);
    const value = Number(promo.discount_value);
    if (!Number.isFinite(value) || value < 0) reject('That promo code is not available.', 409);
    if (promo.discount_kind === 'free_application_pack') discountCents = cents(priced.find(item => item.type === 'application_pack')?.price || 0);
    else if (promo.discount_kind === 'amount') discountCents = cents(value);
    else if (promo.discount_kind === 'percent' && value <= 100) discountCents = Math.round(subtotalCents * value / 100);
    else reject('That promo code is not available.', 409);
    discountCents = Math.min(subtotalCents, Math.max(0, discountCents));
    if (!discountCents || Number(promos[0].quantity) !== 1 || cents(promos[0].price) !== -discountCents) reject('Your promo discount has changed. Apply the code again before paying.', 409);
    priced.push({ ...promos[0], quantity: 1, price: -discountCents / 100, promoCode: code, promoTitle: clean(promo.title), offerNote: clean(promo.offer_note) });
  }
  return { items: priced, amount: (subtotalCents - discountCents) / 100, subtotal: subtotalCents / 100, discount: discountCents / 100 };
}

function snapshot(items, cartId) {
  return { checkoutCartId: clean(cartId), checkoutCartItemIds: items.map(item => clean(item.id)).filter(Boolean) };
}
function orderSnapshot(items, cartId) {
  const fields = ['fullName', 'idNumber', 'dob', 'phone', 'email', 'currentEmail', 'newEmail', 'institution', 'studentNumber', 'intake', 'pin', 'password', 'note', 'fundingType', 'fieldOfStudy', 'deadline'];
  const services = items.filter(item => ['service', 'service_request'].includes(item.type)).map(item => {
    const code = key(item.serviceCode || item.code || item.service?.id);
    const details = Object.fromEntries(fields.filter(name => typeof item[name] === 'string').map(name => [name, clean(item[name]).slice(0, name === 'note' ? 2000 : 500)]));
    return { ...details, id: clean(item.id), type: 'service', serviceCode: code, serviceName: item.canonicalServiceName || SERVICE_NAMES[code], name: item.canonicalServiceName || SERVICE_NAMES[code], price: item.price, servicePrice: item.price, quantity: item.quantity, createdAt: clean(item.createdAt) };
  });
  return { cartId: clean(cartId), itemIds: items.map(item => clean(item.id)).filter(Boolean), services,
    containsApplicationPack: items.some(item => item.type === 'application_pack'),
    products: items.filter(item => !item.isPromoDiscount && !item.promoCode).map(item => ({ id: clean(item.id), catalogId: clean(item.refId), type: item.type, name: item.canonicalServiceName || item.canonicalPackageName || clean(item.name), amountCents: cents(item.price), quantity: item.quantity, sourceHash:item.sourceHash || '' })) };
}
function checkoutKey(applicationId, reference, items) {
  const digest = crypto.createHash('sha256').update(JSON.stringify([applicationId, reference, items.map(item => [item.id, item.refId, item.price, item.quantity, item.promoCode, item.institutions || []]), orderSnapshot(items, '').services])).digest('hex');
  return `kagie-${digest}`;
}
function safeReturnUrl(value, origin, { publicOnly = false } = {}) {
  try {
    const url = new URL(value);
    const site = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== site.origin || url.username || url.password) return false;
    if (publicOnly && (url.protocol !== 'https:' || /^(localhost|127\.|0\.|\[?::1\]?$)/i.test(url.hostname) || url.hostname.endsWith('.local'))) return false;
    return true;
  } catch { return false; }
}
module.exports = { SERVICE_PRICES, priceCart, snapshot, orderSnapshot, checkoutKey, cents, safeReturnUrl, cartItemHash };
