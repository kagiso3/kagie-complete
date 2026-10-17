// Real student pages with local accounts; no production writes or payments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, startApplyBrowserHarness } = require('./lib/apply-browser-harness.cjs');

async function main() {
  const checks = [], errors = [];
  const harness = await startApplyBrowserHarness(errors);
  const check = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name); };
  try {
    for (const type of ['late','transfer','bridging','postgraduate']) {
      const step = type==='late' ? 'late' : 'dynamic';
      const packageSelector = type==='late' ? '[data-late-package]' : '[data-dynamic-package]';
      const targetSelector = ({late:'[data-late-institution]',transfer:'#dynamic-targetInstitution',bridging:'#dynamic-targetInstitution',postgraduate:'#dynamic-institution'})[type];
      const {page, context} = await harness.open(`?applicationType=${type}&step=${step}&section=package`);
      await page.locator(packageSelector).first().waitFor();
      await page.locator(packageSelector).first().click();
      await page.waitForFunction(() => /package (selected|added)/i.test(document.querySelector('#notice')?.textContent||''));
      const item = await page.evaluate(() => KagieAPI.getCart(KagieAPI.currentUser().id).find(item=>item.type==='application_pack'));
      assert.ok(item?.applicationId);
      await page.goto(harness.base+'/cart.html');
      await page.getByRole('link',{name:'Change package',exact:true}).waitFor();
      const packageHref = await page.getByRole('link',{name:'Change package',exact:true}).getAttribute('href');
      const institutionHref = await page.getByRole('link',{name:'Edit institutions',exact:true}).getAttribute('href');
      await check(`${type}: cart links keep the application type, ID and correct editor section`, async () => {
        for (const [href, section] of [[packageHref,'package'],[institutionHref,'institutions']]) {
          const url=new URL(href,harness.base);
          assert.equal(url.searchParams.get('applicationType'),type);
          assert.equal(url.searchParams.get('applicationId'),item.applicationId);
          assert.equal(url.searchParams.get('section'),section);
        }
      });
      await page.goto(new URL(packageHref,harness.base).href);
      await page.locator(packageSelector).first().waitFor();
      await check(`${type}: changing a package opens its package editor`, async () => assert.equal(await page.locator(packageSelector).first().isVisible(),true));
      await page.goto(new URL(institutionHref,harness.base).href);
      await page.locator(targetSelector).first().waitFor();
      await check(`${type}: editing institutions opens the target institution fields`, async () => assert.equal(await page.locator(targetSelector).first().isVisible(),true));
      await page.evaluate(id => KagieAPI.updateApplication(id,{status:'Pending Details',paymentStatus:'Pending Verification'}),item.applicationId);
      await page.goto(new URL(packageHref,harness.base).href);
      await page.waitForFunction(() => window.applyTest?.resolvePacks);
      await check(`${type}: paid applications resume their details instead of selecting another billable package`, async () => assert.equal(await page.locator(packageSelector).count(),0));
      await context.close();
    }
    await check('Application edit routes have no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
    fs.writeFileSync(path.join(root,'reports/application-edit-checks.json'),JSON.stringify({runAt:new Date().toISOString(),environment:'Local Chrome and isolated accounts, synthetic delayed services',checks},null,2));
    console.log(`${checks.length} application edit checks passed`);
  } finally {await harness.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
