const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'kagie-web', 'public', 'legacy', 'js');
fs.mkdirSync(target, { recursive: true });
for (const name of ['yoco-payment.js', 'data.js', 'backend.js', 'supabase-config.js', 'sa-catalog.js', 'native-auth-return.js']) {
  fs.copyFileSync(path.join(root, 'js', name), path.join(target, name));
}
console.log('Canonical Kagie runtime synced to the React client.');
