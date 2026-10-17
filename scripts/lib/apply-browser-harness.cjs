// Real Apply UI with isolated local accounts and synthetic services.
// No production database, uploads, or payments are used by these checks.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const user = { id: 'apply-test-user', role: 'user', fullName: 'Test Learner', email: 'learner@test.invalid', phone: '0712345678', profile: {} };

const testConfig = `
window.KagieAPI.configureSupabase({enabled:false});
const api = window.KagieAPI;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
window.applyTest = { calls: [], writes: [], activeWrites: 0, maxWrites: 0, refreshes: 0 };
for (const [asyncName, syncName] of [['getProfileAsync','getProfile'],['ensureDraftAsync','ensureDraft'],['getFavoritesAsync','getFavorites']]) {
  api[asyncName] = async (...args) => {
    applyTest.calls.push({name:asyncName, at:performance.now()});
    await delay(250);
    return api[syncName](...args);
  };
}
api.getApplicationLearnerSupportAsync = async (...args) => {
  applyTest.calls.push({name:'getApplicationLearnerSupportAsync', at:performance.now()});
  if (window.applyTestOptions?.holdSupport) await new Promise(resolve => { applyTest.resolveSupport=resolve; });
  else await delay(250);
  applyTest.supportCompletedAt=performance.now();
  return window.applyTestOptions?.support || api.getApplicationLearnerSupport(...args);
};
api.getPackCatalogAsync = () => new Promise(resolve => { applyTest.readyAt=performance.now(); applyTest.resolvePacks = () => resolve(api.getPackCatalog()); });
api.getInstitutionCatalogAsync = async filters => { await delay(180); return api.getInstitutionCatalog(filters); };
const originalRefresh = api.refreshCatalogCaches;
api.refreshCatalogCaches = (...args) => { applyTest.refreshes++; return originalRefresh(...args); };
api.saveFormSectionAsync = async (key, data, id) => {
  applyTest.activeWrites++;
  applyTest.maxWrites = Math.max(applyTest.maxWrites, applyTest.activeWrites);
  applyTest.writes.push({key, data:structuredClone(data), at:performance.now()});
  try { await delay(250); if(applyTest.failSaves) throw new Error('Synthetic offline save'); return api.saveFormSection(key,data,id); }
  finally { applyTest.activeWrites--; }
};
api.saveApplicationLearnerSupportAsync = async (...args) => api.saveApplicationLearnerSupport(...args);
api.updateApplicationAsync = async (...args) => {
  applyTest.updateCalls=(applyTest.updateCalls||0)+1;
  const record={id:args[0], data:structuredClone(args[1]), at:performance.now()};
  applyTest.updates=(applyTest.updates||[]).concat([record]);
  await delay(100);
  if(applyTest.failUpdates)throw new Error('Synthetic submission outage');
  const result=api.updateApplication(...args);
  applyTest.successfulUpdates=(applyTest.successfulUpdates||[]).concat([record]);
  return result;
};
`;

async function startApplyBrowserHarness(errors = []) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await chromium.launch({channel:'chrome', headless:true}); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }

  async function open(query = '', options = {}) {
    const context = await browser.newContext({viewport:options.viewport || {width:390,height:844}, reducedMotion:options.reducedMotion || 'no-preference', serviceWorkers:'block'});
    await context.addInitScript(({user, work, blockStorage, holdSupport, support}) => {
      window.applyTestOptions = {holdSupport, support};
      localStorage.setItem('kagie_users', JSON.stringify([user]));
      localStorage.setItem('kagie_current_user', JSON.stringify(user));
      if(work) localStorage.setItem('kagie_forms_work_' + user.id, JSON.stringify(work));
      if(blockStorage) Storage.prototype.setItem = function(){ throw new DOMException('Storage full', 'QuotaExceededError'); };
    }, {user, work:options.work, blockStorage:options.blockStorage, holdSupport:options.holdSupport, support:options.support});
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if(url.hostname !== '127.0.0.1') return route.fulfill({status:200,body:'',contentType:'text/javascript'});
      if(url.pathname === '/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:testConfig});
      if(url.pathname === '/js/sa-catalog.js' && options.failCatalog) {
        options.catalogAttempts = (options.catalogAttempts || 0) + 1;
        if(options.catalogAttempts === 1) return route.abort('failed');
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    page.on('request', req => requests.push(req.url()));
    await page.goto(base + '/forms.html' + query);
    await page.waitForFunction(() => window.applyTest?.resolvePacks, null, {timeout:10000});
    return {page, context, requests};
  }
  return {base, open, async close() {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }};
}

module.exports = { root, user, startApplyBrowserHarness };
