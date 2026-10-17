const crypto = require('node:crypto');
const ENDPOINT = 'https://payments.yoco.com/api/checkouts';
function config() {
  const mode = String(process.env.YOCO_MODE || process.env.YOCO_ENV || '').trim();
  const key = String(process.env.YOCO_SECRET_KEY || '').trim();
  const webhookSecret = String(process.env.YOCO_WEBHOOK_SECRET || '').trim();
  const encoded = webhookSecret.slice(6);
  const decoded = Buffer.from(encoded, 'base64');
  const signingConfigured = /^whsec_[A-Za-z0-9+/]+={0,2}$/.test(webhookSecret) && decoded.length >= 16 && decoded.toString('base64').replace(/=+$/, '') === encoded.replace(/=+$/, '');
  const base = String(process.env.YOCO_API_BASE_URL || 'https://payments.yoco.com').trim().replace(/\/+$/, '').replace(/\/api\/checkouts$/i, '').replace(/\/api$/i, '');
  if (String(process.env.KAGIE_YOCO_ENABLED || '').trim() !== 'true' || !signingConfigured || !['test', 'live'].includes(mode) || !key || base !== 'https://payments.yoco.com' ||
      (/^sk_(test|live)_/.test(key) && !key.startsWith(`sk_${mode}_`))) {
    throw Object.assign(new Error('Yoco configuration is unavailable. Contact Kagie support.'), { status: 503, diagnosticCode: 'YOCO_CONFIGURATION' });
  }
  return { mode, key, endpoint: ENDPOINT };
}
function hostedUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'c.yoco.com' && !url.username && !url.password && !url.port; } catch { return false; }
}
function diagnostic(stage, error, extra = {}) {
  // Deliberately exclude exception messages, request bodies, headers and provider responses.
  console.error(JSON.stringify({ component: 'yoco', stage, code: error?.diagnosticCode || 'YOCO_DEPENDENCY', status: error?.status || 503, ...( /^[A-Z0-9_]{1,20}$/.test(error?.payload?.code || '') ? {databaseCode:error.payload.code} : {}), ...extra }));
}
function bodyHash(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
module.exports = { config, hostedUrl, diagnostic, bodyHash };
