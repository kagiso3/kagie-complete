const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'js/supabase-config.js'), 'utf8');
const url = config.match(/url:\s*"(https:\/\/[^"\s]+\.supabase\.co)"/)[1];
const key = config.match(/anonKey:\s*"([^"\s]+)"/)[1];
(async () => {
  const response = await fetch(url + '/auth/v1/settings', { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  const summary = { checkedAt: new Date().toISOString(), project: new URL(url).hostname.split('.')[0], status: response.status, googleEnabled: data.external?.google === true, appleEnabled: data.external?.apple === true, checkedWithoutSigningIn: true };
  fs.mkdirSync(path.join(root, 'reports/google-login'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports/google-login/provider-settings.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  if (!response.ok) throw new Error('Could not read the public Auth provider settings.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
