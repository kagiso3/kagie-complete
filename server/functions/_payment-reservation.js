const { checkoutKey, orderSnapshot } = require('./_payment-checkout');

async function rpc(url, key, name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(response.status === 400 && data?.code === 'P0001'
      ? data.message : 'Payment preparation is unavailable. Your existing checkout is preserved; contact support if this continues.');
    error.status = data?.code === 'P0001' ? 409 : 503;
    throw error;
  }
  return data;
}

async function reserveCheckout(url, key, { applicationId, userId, provider, items, cartId, payerName, phone, reference, amount, urls, mode }) {
  const snapshot = orderSnapshot(items, cartId);
  snapshot.promoCode = items.find(item => item.isPromoDiscount || item.promoCode)?.promoCode || '';
  if (provider === 'yoco') snapshot.gatewayMode = mode;
  const result = await rpc(url, key, provider === 'yoco' ? 'reserve_yoco_checkout' : 'reserve_payment_checkout', {
    p_application_id: applicationId, p_user_id: userId, p_provider: provider,
    p_fingerprint: checkoutKey(applicationId, JSON.stringify([reference, payerName, phone, urls, ...(provider === 'yoco' ? [mode] : [])]), items),
    p_order_key: checkoutKey(userId, '', items),
    p_payment: { payer_name: payerName, phone, reference, amount, currency: 'ZAR', checkout_snapshot: snapshot }
  });
  if (!result?.payment_id) throw Object.assign(new Error('Payment reservation did not persist.'), { status: 503 });
  return result;
}

async function completeCheckout(url, key, paymentId, checkoutId, note, response) {
  return rpc(url, key, 'complete_payment_checkout', {
    p_payment_id: paymentId, p_checkout_id: checkoutId, p_note: note, p_response: response
  });
}
module.exports = { reserveCheckout, completeCheckout };
