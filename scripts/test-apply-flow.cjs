// Local browser regressions with the real form/backend and synthetic delayed services.
// No production accounts, databases, uploads, or payments are touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, startApplyBrowserHarness } = require('./lib/apply-browser-harness.cjs');
const baseline = process.argv.includes('--baseline');
const checks = [];
const errors = [];
const metrics = {};

async function main() {
  const harness = await startApplyBrowserHarness(errors);
  const { base, open } = harness;
  async function check(name, action) { await action(); checks.push(name); console.log('PASS ' + name); }
  try {
    const initial = await open();
    const page = initial.page;
    metrics.startupMs = Math.round(await page.evaluate(() => applyTest.readyAt));
    metrics.domNodes = await page.locator('*').count();
    metrics.initialCalls = await page.evaluate(() => applyTest.calls);
    await page.waitForTimeout(450);
    metrics.catalogRequestedOnType = initial.requests.some(url => url.includes('/js/sa-catalog.js'));
    if(baseline) { console.log(JSON.stringify(metrics,null,2)); return; }

    await check('Startup loads profile and draft concurrently and renders before favorites', async () => {
      const calls = metrics.initialCalls;
      assert.ok(Math.abs(calls.find(c=>c.name==='getProfileAsync').at - calls.find(c=>c.name==='ensureDraftAsync').at)<100);
      assert.ok(calls.find(c=>c.name==='getFavoritesAsync').at > calls.find(c=>c.name==='ensureDraftAsync').at + 240);
    });
    await check('Type screen avoids the national catalog and hidden form work', async () => {
      assert.equal(metrics.catalogRequestedOnType,false);
      assert.equal(await page.locator('#learnerFields input').count(),0);
      assert.equal(await page.locator('#lateApplicationFlow > *').count(),0);
    });
    await page.locator('[data-application-type="undergraduate"]').click();
    await page.locator('#fullNames').waitFor({state:'visible'});
    await page.locator('#fullNames').fill('New Learner');
    await page.locator('#fullNames').focus();
    await page.evaluate(() => { applyTest.fieldNode=document.querySelector('#fullNames'); applyTest.resolvePacks(); });
    await page.waitForTimeout(200);
    await check('Background catalog refresh preserves the active input and focus', async () => {
      assert.equal(await page.evaluate(()=>applyTest.fieldNode===document.querySelector('#fullNames') && document.activeElement===applyTest.fieldNode),true);
      assert.equal(await page.locator('#fullNames').inputValue(),'New Learner');
    });
    await page.locator('[data-choice-name="hasDisability"][data-choice-value="yes"]').click();
    await page.locator('#disabilityDescription').fill('Needs accessible facilities');
    await page.locator('[data-choice-name="hasDisability"][data-choice-value="no"]').click();
    await check('Disability fields update without rebuilding personal inputs',async()=>{
      assert.equal(await page.evaluate(()=>applyTest.fieldNode===document.querySelector('#fullNames')),true);
      assert.equal(await page.locator('#disabilityDescription').isVisible(),false);
      assert.equal(await page.locator('#disabilityDescription').inputValue(),'');
    });
    await page.locator('#fullNames').fill('Autosave Start');
    await page.waitForFunction(()=>applyTest.activeWrites>0);
    await page.locator('#fullNames').fill('Latest Learner');
    await page.locator('#nextBtn').click();
    await page.waitForFunction(()=>applyTest.writes.filter(w=>w.key==='learner').length>=2 && applyTest.activeWrites===0);
    await check('Autosave and navigation saves never overlap and retain the latest edit',async()=>{
      assert.equal(await page.evaluate(()=>applyTest.maxWrites),1);
      assert.equal(await page.evaluate(()=>KagieAPI.ensureDraft('apply-test-user').forms.learner.fullNames),'Latest Learner');
    });
    await page.locator('#guardianFullNames').waitFor({state:'visible'});
    await page.locator('#guardianFullNames').fill('Test Guardian');
    await page.locator('#prevBtn').click();
    await check('Forward and Back keep edited form values',async()=>assert.equal(await page.locator('#fullNames').inputValue(),'Latest Learner'));
    await page.locator('#stepList [data-step="marks"]').click();
    await page.locator('#subjectSelect').waitFor({state:'visible'});
    const subject = await page.locator('#subjectSelect option').nth(1).getAttribute('value');
    await page.locator('#subjectSelect').selectOption(subject);
    await page.locator('#addSubjectBtn').click();
    await check('Empty marks are rejected instead of silently becoming zero',async()=>{
      assert.equal(await page.locator('#marksList .item').count(),0);
      assert.match(await page.locator('#notice').innerText(),/enter the percent/i);
    });
    await page.locator('#subjectPercent').fill('75');
    await page.locator('#addSubjectBtn').click();
    await check('Marks and APS update correctly',async()=>{
      await page.locator('#marksList').getByText(subject,{exact:true}).waitFor();
      assert.ok((await page.locator('#apsPill').innerText()).includes('APS'));
    });
    await check('Mobile form has no horizontal overflow',async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)));
    await check('Navigation icons stay visible and fit when remote icon fonts are unavailable',async()=>{
      const icons=await page.locator('.bottom-nav .material-icons-outlined').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,visibility:getComputedStyle(node).visibility,svg:!!node.querySelector('svg'),text:node.textContent.trim()})));
      assert.ok(icons.length);
      assert.ok(icons.every(icon=>icon.width<=32 && icon.visibility==='visible' && icon.svg && !icon.text));
    });
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.reload();
    await page.waitForFunction(()=>window.applyTest?.resolvePacks);
    await page.locator('#stepList [data-step="learner"]').click();
    await check('Reload restores locally saved learner and guardian details',async()=>{
      assert.equal(await page.locator('#fullNames').inputValue(),'Latest Learner');
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user')));
      assert.equal(saved.parent.guardianFullNames,'Test Guardian');
    });
    fs.mkdirSync(path.join(root,'reports'),{recursive:true});
    await page.screenshot({path:path.join(root,'reports/apply-form-mobile.png'),fullPage:true});
    await page.locator('#stepList [data-step="pack"]').click();
    await page.locator('#packGrid [data-pack-id]').first().click();
    await page.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('Package selected'));
    await page.locator('#packSummaryCard [data-pack-checkout]').click();
    await page.waitForURL('**/cart.html');
    await check('Selected package reaches cart once with its price and application',async()=>{
      const cart=await page.evaluate(()=>KagieAPI.getCart('apply-test-user').filter(item=>item.type==='application_pack'));
      assert.equal(cart.length,1);
      assert.ok(Number(cart[0].price)>0);
      assert.ok(cart[0].applicationId);
    });

    const retryOptions={failCatalog:true};
    const retry=await open('?applicationType=undergraduate&step=school',retryOptions);
    await retry.page.locator('#schoolName').waitFor({state:'visible'});
    await retry.page.waitForTimeout(350);
    await retry.page.locator('#stepList [data-step="learner"]').click();
    await retry.page.locator('#stepList [data-step="school"]').click();
    await check('Failed catalog download can be retried and loads only once after recovery',async()=>{
      await retry.page.waitForFunction(()=>window.KagieData?.highSchools?.length>0);
      assert.equal(retryOptions.catalogAttempts,2);
      const refreshes=await retry.page.evaluate(()=>applyTest.refreshes);
      await retry.page.locator('#stepList [data-step="learner"]').click();
      await retry.page.locator('#stepList [data-step="school"]').click();
      await retry.page.waitForTimeout(200);
      assert.equal(await retry.page.evaluate(()=>applyTest.refreshes),refreshes);
    });
    const storage=await open('?applicationType=undergraduate&step=learner',{blockStorage:true});
    await storage.page.locator('#fullNames').fill('Storage Recovery');
    await storage.page.waitForTimeout(500);
    await check('Unavailable local storage leaves the form usable and reports the problem',async()=>{
      assert.equal(await storage.page.locator('#fullNames').inputValue(),'Storage Recovery');
      assert.match(await storage.page.locator('#notice').innerText(),/storage|device|browser/i);
    });
    const late=await open('?applicationType=late&step=late');
    await check('Late application renders only its active flow',async()=>{
      assert.ok(await late.page.locator('#lateApplicationFlow > *').count());
      assert.equal(await late.page.locator('#learnerFields input').count(),0);
    });
    const dynamic=await open('?applicationType=transfer&step=dynamic');
    await check('Transfer application renders its active flow',async()=>assert.ok(await dynamic.page.locator('#dynamicApplicationFlow > *').count()));
    const transferWork={current:'dynamic',applicationType:'transfer',dynamicApplication:{type:'transfer',currentStep:4,selectedPackage:'TRANSFER_BASIC',values:{currentInstitution:'Test College',currentProgramme:'Computer Science',currentYearLevel:'First year',academicStanding:'Good standing',targetInstitution:'Test University',targetProgramme:'Information Technology',creditsCompleted:'8 modules',transferReason:'Continue my studies',transcriptFile:'transcript.pdf',registrationProofFile:'registration.pdf',documentsConfirmed:true}}};
    const lateWork={current:'late',applicationType:'late',lateApplication:{currentStep:7,selectedPackage:'quick',selectedInstitutions:['uj'],selectedCourses:['uj-bed'],reviewConfirmed:true,details:{appliedBefore:'No',institutionType:'University',province:'Gauteng',institution:'University of Johannesburg',course:'Bachelor of Education',educationLevel:'Matric',resultsFile:'results.pdf',phone:'0712345678',email:'learner@test.invalid',agreedSpace:true},personal:{fullName:'Test Learner',surname:'Learner',idNumber:'0001011234081',dob:'2000-01-01',gender:'Female',phone:'0712345678',email:'learner@test.invalid',province:'Gauteng',town:'Johannesburg',address:'Test address',schoolName:'Test Secondary',examYear:'2018',educationLevel:'Matric',confirmed:true},documents:{statuses:{id:'uploaded',results:'uploaded',residence:'uploaded'},confirmed:true}}};
    for(const scenario of [
      {type:'transfer',step:'dynamic',work:transferWork,field:'dynamicApplication',button:'[data-dynamic-action="next"]',record:'kagie_application_submissions_apply-test-user'},
      {type:'late',step:'late',work:lateWork,field:'lateApplication',button:'[data-late-action="next"]',record:'kagie_late_applications_apply-test-user'}
    ]) {
      const submission=await open('?applicationType='+scenario.type+'&step='+scenario.step,{work:scenario.work});
      await submission.page.evaluate(()=>{applyTest.failUpdates=true;applyTest.updateCalls=0;});
      await submission.page.evaluate(selector=>{const button=document.querySelector(selector);button.click();button.click();},scenario.button);
      await submission.page.waitForFunction(()=>document.querySelector('#notice')?.textContent.includes('Please retry'));
      await check(scenario.type+' submission failure retains the draft and blocks duplicate clicks',async()=>{
        const result=await submission.page.evaluate(({field,record})=>({submitted:JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user'))[field].submitted,record:localStorage.getItem(record),calls:applyTest.updateCalls}),scenario);
        assert.equal(Boolean(result.submitted),false);
        assert.equal(result.record,null);
        assert.equal(result.calls,1);
      });
      await submission.page.evaluate(()=>applyTest.failUpdates=false);
      await submission.page.locator(scenario.button).click();
      await submission.page.waitForFunction(field=>JSON.parse(localStorage.getItem('kagie_forms_work_apply-test-user'))[field].submitted,scenario.field);
      await check(scenario.type+' submission succeeds after recovery and records one submission',async()=>{
        assert.equal(await submission.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).length,scenario.record),1);
      });
    }
    const redirect=await initial.context.newPage();
    const redirectRequests=[];
    redirect.on('request',req=>{if(req.url().includes('/js/backend.js'))redirectRequests.push(req.url());});
    await redirect.goto(base+'/apply.html?applicationType=undergraduate&step=learner#resume');
    await redirect.waitForURL('**/forms.html?applicationType=undergraduate&step=learner#resume');
    await redirect.waitForFunction(()=>window.applyTest?.resolvePacks);
    await check('Apply redirect preserves parameters and avoids an extra backend download',async()=>assert.equal(redirectRequests.length,1));
    await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
    fs.writeFileSync(path.join(root,'reports/apply-browser-checks.json'),JSON.stringify({runAt:new Date().toISOString(),environment:'Local mobile Chrome with real form/backend, synthetic delayed services and no production writes',checks,metrics},null,2));
    console.log(JSON.stringify({checks:checks.length,metrics},null,2));
  } finally {
    await harness.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
