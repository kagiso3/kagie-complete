// Responsive verification of every Apply step, with isolated local services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, startApplyBrowserHarness } = require('./lib/apply-browser-harness.cjs');
const viewports = [
  {name:'small-phone', width:320, height:640},
  {name:'phone', width:390, height:844},
  {name:'phone-landscape', width:844, height:390},
  {name:'tablet', width:768, height:1024},
  {name:'tablet-landscape', width:1024, height:768},
  {name:'desktop', width:1440, height:900}
];
const longText = 'A very long institution, programme or learner name for responsive checks';
const longFile = 'CertifiedAcademicTranscript_' + 'LongFilename'.repeat(15) + '.pdf';
const checks = [];
const errors = [];
const screenshots = path.join(root, 'reports/apply-responsive');

async function verifyLayout(page, name) {
  const result = await page.evaluate(() => {
    const visible = node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    };
    const describe = node => node.id || node.className || node.tagName;
    const controls = [...document.querySelectorAll('.shell button, .shell a, .shell input, .shell select, .shell textarea, .shell summary, .shell .choice-option, .bottom-nav a')].filter(visible);
    const outside = [...document.querySelectorAll('.shell *, .bottom-nav')].filter(visible).filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    }).map(describe);
    const undersized = controls.filter(node => node.getBoundingClientRect().height < 43.5).map(describe);
    const smallInputs = controls.filter(node => node.matches('input, select, textarea') && parseFloat(getComputedStyle(node).fontSize) < 16).map(describe);
    const labels = [...document.querySelectorAll('.section.active .label')].filter(visible).length;
    const footer = document.querySelector('.section.active .late-actions') || document.querySelector('.footer');
    const nav = document.querySelector('.bottom-nav');
    const footerRect = footer?.getBoundingClientRect();
    const navRect = nav?.getBoundingClientRect();
    const active = document.querySelector('.section.active');
    return {
      pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
      outside, undersized, smallInputs, labels,
      activeContent: active?.innerText.trim().length || 0,
      footerClear: !footerRect?.height || !navRect?.height || footerRect.bottom <= navRect.top + 1,
      fieldColumns: getComputedStyle(active?.querySelector('.grid3, .late-grid') || active).gridTemplateColumns.split(' ').length
    };
  });
  assert.ok(result.activeContent > 0, name + ': active step is blank');
  assert.ok(result.pageWidth <= result.viewportWidth + 1, name + ': page overflow ' + JSON.stringify(result));
  assert.deepEqual(result.outside, [], name + ': content outside viewport');
  assert.deepEqual(result.undersized, [], name + ': touch controls under 44px');
  assert.deepEqual(result.smallInputs, [], name + ': input focus could zoom on mobile');
  // Test the lowest action at the bottom of the page, where fixed navigation could cover it.
  await page.evaluate(() => scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
  await page.waitForFunction(() => {
    const footer = document.querySelector(".section.active .late-actions") || document.querySelector(".footer");
    const nav = document.querySelector(".bottom-nav");
    if (!footer?.getBoundingClientRect().height || !nav?.getBoundingClientRect().height) return true;
    if (footer.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1) return true;
    scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"});
    return false;
  }, null, {timeout:3000});
  const footerClear = await page.evaluate(() => {
    const footer = document.querySelector('.section.active .late-actions') || document.querySelector('.footer');
    const nav = document.querySelector('.bottom-nav');
    return !footer?.getBoundingClientRect().height || !nav?.getBoundingClientRect().height || footer.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1;
  });
  assert.ok(footerClear, name + ': navigation covers the last action');
  await page.evaluate(() => scrollTo(0, 0));
  checks.push({name, fieldColumns:result.fieldColumns});
}

async function main() {
  fs.mkdirSync(screenshots, {recursive:true});
  const harness = await startApplyBrowserHarness(errors);
  const openFixture = harness.open;
  harness.open = (query, options = {}) => openFixture(query, {...options, reducedMotion:"reduce"});
  try {
    for (const viewport of viewports) {
      const undergraduate = await harness.open('?applicationType=undergraduate&step=apply', {
        viewport, work:{current:'apply',applicationType:'undergraduate',learner:{fullNames:longText},apply:{choice1Faculty:longText,choice1:longText},institutions:[]}
      });
      const page = undergraduate.page;
      await page.evaluate(() => applyTest.resolvePacks());
      await page.waitForFunction(() => window.KagieData?.highSchools?.length > 0);
      for (const step of ['apply','pack','marks','school','parent','learner']) {
        await page.locator('#stepList [data-step="' + step + '"]').click();
        await page.locator('.section.active[data-step="' + step + '"]').waitFor();
        await verifyLayout(page, viewport.name + ': undergraduate ' + step);
        if(step === 'learner') {
          assert.ok(await page.locator('.section.active .label').first().isVisible());
          const columns = await page.locator('#learnerFields').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
          assert.equal(columns, viewport.width >= 1000 ? 3 : viewport.width >= 600 ? 2 : 1);
          await page.screenshot({path:path.join(screenshots, viewport.name + '-learner.png'),fullPage:true});
          await page.locator('#dob').click();
          const dialog = page.locator('.kdob-sheet');
          await dialog.waitFor({state:'visible'});
          const box = await dialog.boundingBox();
          assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, viewport.name + ': date picker outside screen');
          // A queued scroll update must not run against a closed picker or a later selection.
          await page.evaluate(() => {
            const month = document.querySelector('.kdob-wheel[data-wheel="month"]');
            month.scrollTop = 44;
            month.dispatchEvent(new Event('scroll'));
            KagieDobWheel.close();
          });
          await page.waitForTimeout(160);
          assert.ok(!(await dialog.isVisible()), viewport.name + ': date picker did not close');
          await page.locator('#dob').click();
          await page.locator('.kdob-wheel[data-wheel="day"] [data-wheel-value="1"]').click();
          await page.locator('.kdob-action.confirm').click();
          assert.match(await page.locator('#dob').inputValue(), /^01 \/ \d{2} \/ \d{4}$/);
          assert.match(await page.locator('#dob').getAttribute('data-iso-value'), /-01$/);
          checks.push({name:viewport.name + ': date picker closes during pending updates and saves after reopening'});
          checks.push({name:viewport.name + ': date picker fits'});
        }
        if(step === 'apply') {
          const institution = await page.locator('#institutionName').evaluate(node => [...node.options].find(option => option.value && !option.disabled)?.value);
          assert.ok(institution, 'Institution picker has no available choices');
          await page.locator('#institutionName').selectOption(institution);
          await page.locator('#choice1Trigger').click();
          await page.locator('[data-choice-faculty-search="choice1"], [data-choice-manual-faculty="choice1"]').fill(longText);
          await page.waitForFunction(text => document.querySelector('#choice1Faculty')?.value === text, longText);
          await page.locator('[data-choice-course-search="choice1"], [data-choice-manual-course="choice1"]').fill(longText);
          await page.waitForFunction(text => document.querySelector('#choice1Summary')?.textContent.includes(text), longText);
          await verifyLayout(page, viewport.name + ': undergraduate course picker');
          await page.locator('#choice1Trigger').click();
          await verifyLayout(page, viewport.name + ': long course summary');
          await page.screenshot({path:path.join(screenshots, viewport.name + '-courses.png'),fullPage:true});
        }
      }
      await undergraduate.context.close();

      const type = await harness.open('', {viewport});
      await verifyLayout(type.page, viewport.name + ': type selection');
      await type.page.screenshot({path:path.join(screenshots, viewport.name + '-types.png'),fullPage:true});
      await type.context.close();

      const late = await harness.open('?applicationType=late&step=late', {viewport, work:{
        current:'late',applicationType:'late',lateApplication:{currentStep:7,selectedPackage:'quick',selectedInstitutions:['uj'],selectedCourses:['uj-bed'],
          details:{resultsFile:longFile},personal:{fullName:longText,address:longText},documents:{fileNames:{id:longFile},statuses:{id:'uploaded'}}}
      }});
      await late.page.evaluate(() => applyTest.resolvePacks());
      for (let step = 7; step >= 1; step--) {
        await late.page.locator('[data-late-step="' + step + '"]').click();
        await verifyLayout(late.page, viewport.name + ': late step ' + step);
        if(step === 6) {
          assert.ok(await late.page.locator('.late-doc-row').count());
          await late.page.screenshot({path:path.join(screenshots, viewport.name + '-documents.png'),fullPage:true});
        }
        if(step === 5) assert.ok(await late.page.locator('.late-course-row').count());
      }
      await late.context.close();

      for (const type of ['transfer','bridging','postgraduate']) {
        const dynamic = await harness.open('?applicationType=' + type + '&step=dynamic', {viewport, work:{
          current:'dynamic',applicationType:type,dynamicApplication:{type,currentStep:4,values:{
            currentInstitution:longText,targetInstitution:longText,programme:longText,institution:longText,previousInstitution:longText,
            transferReason:longText,supportNeeded:longText,transcriptFile:longFile,latestResultsFile:longFile,idFile:longFile,qualificationFile:longFile
          }}
        }});
        await dynamic.page.evaluate(() => applyTest.resolvePacks());
        for (let step = 4; step >= 1; step--) {
          await dynamic.page.locator('[data-dynamic-step="' + step + '"]').click();
          await verifyLayout(dynamic.page, viewport.name + ': ' + type + ' step ' + step);
          if(step === 1) assert.ok(await dynamic.page.locator('[data-dynamic-package]').count());
        }
        await dynamic.context.close();
      }
      console.log('PASS ' + viewport.name + ' (' + viewport.width + 'x' + viewport.height + '): all application types and steps');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, 'reports/apply-responsive-checks.json'), JSON.stringify({runAt:new Date().toISOString(),environment:'Local Chrome, synthetic services, external fonts unavailable, no production writes',checks,errors},null,2));
    console.log('PASS ' + checks.length + ' responsive checks; no uncaught browser errors');
  } finally { await harness.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
