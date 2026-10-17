// Real student pages with delayed/offline synthetic services; no production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, startApplyBrowserHarness } = require('./lib/apply-browser-harness.cjs');

async function main() {
  const errors = [];
  const checks = [];
  const harness = await startApplyBrowserHarness(errors);
  async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
  async function connection(page, online) {
    await page.evaluate(value => {
      Object.defineProperty(navigator, 'onLine', {configurable:true, get:() => value});
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    }, online);
  }
  try {
    const remoteSupport = {needsBursary:'yes', needsResidence:'yes', hasDisability:'yes', disabilityDescription:'Remote support details'};
    const delayed = await harness.open('?applicationType=undergraduate&step=learner', {holdSupport:true, support:remoteSupport});
    const page = delayed.page;
    await check('Apply opens while learner support is still loading', async () => {
      assert.equal(await page.locator('#fullNames').isVisible(), true);
      assert.equal(await page.evaluate(() => applyTest.supportCompletedAt), undefined);
    });
    await page.locator('#fullNames').fill('Typing during loading');
    await page.locator('[data-choice-name="needsBursary"][data-choice-value="no"]').click();
    await page.locator('[data-choice-name="hasDisability"][data-choice-value="no"]').click();
    await page.locator('#fullNames').focus();
    await page.evaluate(() => {applyTest.fieldNode=document.querySelector('#fullNames'); applyTest.resolveSupport();});
    await page.waitForFunction(() => document.querySelector('[data-choice-name="needsResidence"][data-choice-value="yes"]')?.getAttribute('aria-pressed') === 'true');
    await check('Late support data preserves edits, focus and disability choices', async () => {
      assert.equal(await page.locator('#fullNames').inputValue(), 'Typing during loading');
      assert.equal(await page.evaluate(() => document.activeElement===applyTest.fieldNode && document.querySelector('#fullNames')===applyTest.fieldNode), true);
      assert.equal(await page.locator('[data-choice-name="needsBursary"][data-choice-value="no"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-choice-name="hasDisability"][data-choice-value="no"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#disabilityDescription').inputValue(), '');
    });
    await delayed.context.close();

    const waiting = await harness.open('?applicationType=undergraduate&step=learner', {holdSupport:true, support:remoteSupport});
    await waiting.page.locator('#fullNames').fill('Save after support');
    await waiting.page.locator('#nextBtn').click();
    await waiting.page.waitForTimeout(100);
    await check('Learner writes wait for pending support hydration', async () => assert.equal(await waiting.page.evaluate(() => applyTest.writes.length), 0));
    await waiting.page.evaluate(() => applyTest.resolveSupport());
    await waiting.page.waitForFunction(() => applyTest.writes.length && !applyTest.activeWrites);
    await check('First learner write contains the hydrated support data', async () => {
      const data = await waiting.page.evaluate(() => applyTest.writes[0].data);
      assert.equal(data.fullNames, 'Save after support');
      for (const [key,value] of Object.entries(remoteSupport)) assert.equal(data[key], value);
    });
    await waiting.context.close();

    const saved = await harness.open('?applicationType=undergraduate&step=learner', {holdSupport:true, support:remoteSupport, work:{current:'learner', applicationType:'undergraduate', learner:{needsResidence:'no'}}});
    await saved.page.evaluate(() => applyTest.resolveSupport());
    await saved.page.waitForFunction(() => applyTest.supportCompletedAt);
    await check('Restored support choices take precedence over a delayed server response', async () => assert.equal(await saved.page.locator('[data-choice-name="needsResidence"][data-choice-value="no"]').getAttribute('aria-pressed'), 'true'));
    await saved.context.close();

    const interruptedSupport = await harness.open('?applicationType=undergraduate&step=learner', {holdSupport:true, support:remoteSupport});
    await interruptedSupport.page.locator('#fullNames').fill('Reload while support loads');
    await interruptedSupport.page.locator('[data-choice-name="needsBursary"][data-choice-value="no"]').click();
    await interruptedSupport.page.waitForTimeout(400);
    await interruptedSupport.page.reload();
    await interruptedSupport.page.waitForFunction(() => window.applyTest?.resolvePacks && applyTest.resolveSupport);
    await interruptedSupport.page.evaluate(() => applyTest.resolveSupport());
    await interruptedSupport.page.waitForFunction(() => document.querySelector('[data-choice-name="needsResidence"][data-choice-value="yes"]')?.getAttribute('aria-pressed')==='true');
    await check('Reload during support loading hydrates untouched fields and preserves explicit choices', async () => {
      assert.equal(await interruptedSupport.page.locator('#fullNames').inputValue(), 'Reload while support loads');
      assert.equal(await interruptedSupport.page.locator('[data-choice-name="needsBursary"][data-choice-value="no"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await interruptedSupport.page.locator('#disabilityDescription').inputValue(), remoteSupport.disabilityDescription);
    });
    await interruptedSupport.context.close();

    const retry = await harness.open('?applicationType=undergraduate&step=learner');
    await retry.page.evaluate(() => {applyTest.failSaves=true;});
    await retry.page.locator('#fullNames').fill('Retry draft');
    await retry.page.waitForFunction(() => applyTest.writes.length>=3 && !applyTest.activeWrites, null, {timeout:15000});
    await check('Repeated save failures back off and keep writes serialized', async () => {
      const result = await retry.page.evaluate(() => ({writes:applyTest.writes, max:applyTest.maxWrites}));
      assert.ok(result.writes[1].at-result.writes[0].at>=2000);
      assert.ok(result.writes[2].at-result.writes[1].at>=4000);
      assert.equal(result.max, 1);
    });
    await connection(retry.page, false);
    await retry.page.locator('#fullNames').fill('Latest offline edit');
    const writesBefore = await retry.page.evaluate(() => applyTest.writes.length);
    await retry.page.waitForTimeout(1600);
    await check('Offline editing pauses automatic network retries and preserves the device copy', async () => {
      assert.equal(await retry.page.evaluate(() => applyTest.writes.length), writesBefore);
      assert.equal(await retry.page.evaluate(() => JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')).learner.fullNames), 'Latest offline edit');
    });
    await retry.page.evaluate(() => {applyTest.failSaves=false;});
    await connection(retry.page, true);
    await retry.page.waitForFunction(() => applyTest.writes.at(-1)?.data.fullNames==='Latest offline edit' && !applyTest.activeWrites);
    await check('Reconnecting saves the latest edit without another user action', async () => {
      assert.equal(await retry.page.evaluate(() => KagieAPI.ensureDraft('apply-test-user').forms.learner.fullNames), 'Latest offline edit');
      assert.match(await retry.page.locator('#notice').innerText(), /latest changes are saved/i);
    });
    await retry.context.close();

    const restore = await harness.open('?applicationType=undergraduate&step=learner');
    await restore.context.addInitScript(() => Object.defineProperty(navigator, 'onLine', {configurable:true, get:() => false}));
    await connection(restore.page, false);
    await restore.page.locator('#fullNames').fill('Offline draft after reload');
    await restore.page.waitForTimeout(400);
    await restore.page.reload();
    await restore.page.waitForFunction(() => window.applyTest?.resolvePacks);
    await check('Reload restores both offline edits and their pending sync state', async () => {
      assert.equal(await restore.page.locator('#fullNames').inputValue(), 'Offline draft after reload');
      assert.deepEqual(await restore.page.evaluate(() => JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')).pendingSyncSections), ['learner']);
      assert.equal(await restore.page.evaluate(() => applyTest.writes.length), 0);
    });
    await connection(restore.page, true);
    await restore.page.waitForFunction(() => applyTest.writes.at(-1)?.data.fullNames==='Offline draft after reload' && !applyTest.activeWrites);
    await restore.page.waitForFunction(() => JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')).pendingSyncSections.length===0);
    await check('Restored pending edits sync after reconnecting and clear their recovery marker', async () => assert.equal(await restore.page.evaluate(() => applyTest.maxWrites), 1));
    await restore.context.close();

    const marks = await harness.open('?applicationType=undergraduate&step=marks');
    await connection(marks.page, false);
    await marks.page.evaluate(() => {applyTest.failSaves=true;});
    await marks.page.locator('#subjectSelect').selectOption({index:1});
    await marks.page.locator('#subjectPercent').fill('75');
    await marks.page.locator('#addSubjectBtn').click();
    await marks.page.waitForFunction(() => applyTest.writes.length && !applyTest.activeWrites);
    await marks.page.evaluate(() => {applyTest.failSaves=false;});
    await connection(marks.page, true);
    await marks.page.waitForFunction(() => applyTest.writes.length>=2 && !applyTest.activeWrites);
    await check('Failed marks saves recover automatically after reconnecting', async () => assert.equal(await marks.page.evaluate(() => applyTest.writes.at(-1).data.subjects[0].percent), 75));
    await marks.context.close();

    const pack = await harness.open('?applicationType=undergraduate&step=pack');
    await pack.context.addInitScript(() => Object.defineProperty(navigator, 'onLine', {configurable:true, get:() => false}));
    await connection(pack.page, false);
    await pack.page.evaluate(() => {applyTest.failUpdates=true;});
    await pack.page.locator('#packGrid [data-pack-id]').nth(0).click();
    await pack.page.waitForTimeout(200);
    const selected = await pack.page.locator('#packGrid [data-pack-id]').nth(1).getAttribute('data-pack-id');
    await pack.page.locator('#packGrid [data-pack-id]').nth(1).click();
    await pack.page.waitForTimeout(200);
    await pack.page.waitForFunction(id => JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')).selectedPackId===id, selected);
    const packageApplicationId = await pack.page.evaluate(() => JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')).pendingSyncApplicationId);
    await pack.page.reload();
    await pack.page.waitForFunction(() => window.applyTest?.resolvePacks);
    await check('Reload keeps a pending package attached to its original application', async () => {
      assert.deepEqual(await pack.page.evaluate(() => JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')).pendingSyncSections), ['pack']);
      assert.equal(await pack.page.evaluate(() => KagieAPI.getApplicationsByUser('apply-test-user').length), 1);
    });
    await pack.page.evaluate(() => {applyTest.failUpdates=false;});
    await connection(pack.page, true);
    await pack.page.waitForFunction(id => applyTest.successfulUpdates?.at(-1)?.data.package?.id===id, selected);
    await check('Package recovery saves the latest selection and payment status', async () => {
      const update = await pack.page.evaluate(() => applyTest.updates.at(-1).data);
      assert.equal(update.package.id, selected);
      assert.equal(update.status, 'Awaiting Payment');
      assert.equal(await pack.page.evaluate(() => KagieAPI.getApplicationById(applyTest.successfulUpdates.at(-1).id).package.id), selected);
      assert.equal(await pack.page.evaluate(() => applyTest.successfulUpdates.at(-1).id), packageApplicationId);
    });
    await pack.context.close();

    const home = await harness.open();
    await home.context.addInitScript(() => {
      window.homeTest = {frames:0, pending:new Set(), hidden:false};
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => {
        if (callback.name!=='animateCarousel') return request(callback);
        const id = request(time => {homeTest.pending.delete(id); homeTest.frames++; callback(time);});
        homeTest.pending.add(id);
        return id;
      };
      window.cancelAnimationFrame = id => {homeTest.pending.delete(id); cancel(id);};
      Object.defineProperty(document, 'hidden', {configurable:true, get:() => homeTest.hidden});
    });
    await home.context.route('**/js/supabase-config.js*', route => route.fulfill({contentType:'text/javascript', body:`
      KagieAPI.configureSupabase({enabled:false});
      KagieAPI.resolveSessionUser=async()=>KagieAPI.currentUser();
      KagieAPI.getUserExperiencePreferences=()=>({reducedMotion:true,lowDataMode:false});
      KagieAPI.getDashboardSummaryAsync=()=>new Promise(resolve=>{homeTest.setPreferences=prefs=>resolve({preferences:prefs});});
    `}));
    await home.page.goto(harness.base+'/home.html');
    await home.page.waitForFunction(() => window.homeTest?.setPreferences && document.querySelectorAll('.carousel-item').length===10);
    await home.page.locator('#menuBtn').click();
    await check('Home menu opens before the dashboard summary finishes loading', async () => assert.equal(await home.page.locator('#menuSheet').evaluate(node => node.classList.contains('open')), true));
    await home.page.locator('#closeMenu').click();
    await home.page.waitForTimeout(200);
    await check('Home schedules no carousel frames with reduced motion enabled', async () => {
      assert.equal(await home.page.evaluate(() => homeTest.frames), 0);
      assert.equal(await home.page.evaluate(() => homeTest.pending.size), 0);
    });
    const restingTransform = await home.page.locator('.carousel-item').first().evaluate(node => node.style.transform);
    await home.page.locator('#carousel').dispatchEvent('mousedown', {clientX:100});
    await home.page.locator('#carousel').dispatchEvent('mousemove', {clientX:145});
    await home.page.locator('#carousel').dispatchEvent('mouseup');
    await check('Manual carousel dragging remains available with reduced motion', async () => {
      assert.equal(await home.page.locator('#carousel').evaluate(node => node.classList.contains('dragging')), false);
      assert.notEqual(await home.page.locator('.carousel-item').first().evaluate(node => node.style.transform), restingTransform);
      assert.equal(await home.page.evaluate(() => homeTest.pending.size), 0);
    });
    await home.page.evaluate(() => homeTest.setPreferences({reducedMotion:false, lowDataMode:false}));
    await home.page.waitForFunction(() => homeTest.frames>2);
    await home.page.evaluate(() => {homeTest.hidden=true; document.dispatchEvent(new Event('visibilitychange'));});
    const paused = await home.page.evaluate(() => homeTest.frames);
    await home.page.waitForTimeout(120);
    await check('Hiding Home cancels the carousel animation loop', async () => {
      assert.equal(await home.page.evaluate(() => homeTest.pending.size), 0);
      assert.equal(await home.page.evaluate(() => homeTest.frames), paused);
    });
    await home.page.evaluate(() => {homeTest.hidden=false; document.dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('visibilitychange'));});
    await home.page.waitForFunction(count => homeTest.frames>count+2, paused);
    await check('Returning to Home resumes exactly one animation loop', async () => assert.equal(await home.page.evaluate(() => homeTest.pending.size), 1));
    await home.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await check('Leaving Home cancels its animation frame', async () => assert.equal(await home.page.evaluate(() => homeTest.pending.size), 0));
    await home.page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await check('Restoring Home restarts exactly one animation loop', async () => assert.equal(await home.page.evaluate(() => homeTest.pending.size), 1));
    await home.context.close();

    await check('No uncaught student-page errors', async () => assert.deepEqual(errors, []));
    fs.writeFileSync(path.join(root,'reports/student-performance-checks.json'), JSON.stringify({runAt:new Date().toISOString(),environment:'Local Chrome, synthetic delayed/offline services, no production writes', checks}, null, 2));
    console.log(`${checks.length} student performance and recovery checks passed`);
  } finally { await harness.close(); }
}
main().catch(error => {console.error(error); process.exitCode=1;});
