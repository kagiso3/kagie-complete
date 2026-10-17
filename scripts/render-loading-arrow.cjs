// Export the code-native arrow artwork for React Native's Image component.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
    await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:400px;height:400px}</style>' + fs.readFileSync(path.join(root, 'images/logos/kagie-loading-arrow.svg'), 'utf8'));
    await page.locator('svg').screenshot({ path: path.join(root, 'kagie-mobile/assets/loading-arrow.png'), omitBackground: true });
    console.log('Native loading arrow exported from the shared SVG.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
