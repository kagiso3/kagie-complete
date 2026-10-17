const { cents, cartItemHash } = require('./_payment-checkout');

function assertPaymentAmount(payment, amount, currency, minorUnits = false) {
  const expected = cents(payment.amount);
  const received = minorUnits ? Number(amount) : cents(amount);
  if (amount === null || amount === undefined || String(amount).trim() === '' || !Number.isSafeInteger(expected) || expected <= 0 || !Number.isSafeInteger(received) || received !== expected || String(currency || '').toUpperCase() !== 'ZAR') {
    const error = new Error('Payment amount or currency does not match this checkout.');
    error.status = 409;
    throw error;
  }
}

async function clearPaidCart(meta, userId, read, write) {
  let ids = Array.isArray(meta.checkoutCartItemIds) ? meta.checkoutCartItemIds.filter(id => /^[a-z0-9_-]{1,100}$/i.test(id)) : [];
  if (!meta.checkoutCartId || !ids.length) return;
  // A delayed payment must not delete items added for the next application.
  const carts = await read(`/rest/v1/carts?id=eq.${encodeURIComponent(meta.checkoutCartId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`);
  if (!Array.isArray(carts) || !carts[0]) return;
  if (Array.isArray(meta.purchasedProducts) && meta.purchasedProducts.some(p=>p.sourceHash)) {
    const rows = await read(`/rest/v1/cart_items?cart_id=eq.${encodeURIComponent(meta.checkoutCartId)}&select=*`);
    ids = ids.filter(id=>{ const pinned=meta.purchasedProducts.find(p=>p.id===id),current=(rows||[]).find(row=>row.id===id);return !pinned || !pinned.sourceHash || current && pinned.sourceHash===cartItemHash(current); });
    if (!ids.length) return;
  }
  const filter = `cart_id=eq.${encodeURIComponent(meta.checkoutCartId)}&id=in.(${ids.map(encodeURIComponent).join(',')})`;
  await write(`/rest/v1/cart_items?${filter}`, 'DELETE');
  const remaining = await read(`/rest/v1/cart_items?cart_id=eq.${encodeURIComponent(meta.checkoutCartId)}&select=price,quantity`);
  const total = (Array.isArray(remaining) ? remaining : []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  await write(`/rest/v1/carts?id=eq.${encodeURIComponent(meta.checkoutCartId)}`, 'PATCH', { total_amount: Number.isFinite(total) ? Math.round(total * 100) / 100 : 0 });
}

async function settlePayment(read, payment, { provider, checkoutId, paymentId, gatewayStatus, success, amount, currency, note, failureReason = '' }) {
  // Settlement is one database transaction. A missing migration must fail closed.
  const result = await read('/rest/v1/rpc/settle_gateway_payment', {
    p_payment_id: payment.id,
    p_provider: provider,
    p_checkout_id: checkoutId,
    p_gateway_payment_id: paymentId,
    p_gateway_status: gatewayStatus,
    p_success: success,
    p_amount: amount,
    p_currency: currency,
    p_note: note,
    p_failure_reason: failureReason
  });
  if (!result || typeof result.applied !== 'boolean' || typeof result.duplicate !== 'boolean') {
    throw new Error('Payment settlement returned no confirmation.');
  }
  return result;
}

module.exports = { assertPaymentAmount, clearPaidCart, settlePayment };
