const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const client of ['kagie-landing', 'kagie-web']) {
  for (const file of ['splash.html', 'css/kagie-splash.css', 'js/kagie-splash.js', 'images/logos/app-logo.jpg', 'images/logos/kagie-loading-arrow.svg']) {
    const target = path.join(root, client, 'public', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file), target);
  }
}
console.log('Kagie splash assets synced to landing and web clients.');
