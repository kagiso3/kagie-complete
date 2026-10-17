// Student UI -> real Supabase SDK -> isolated SQL/RLS and Storage. No production requests or transfers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { start } = require('./admin-test-server.cjs');
const root = path.resolve(__dirname, '..');
const proof = Buffer.from('%PDF-1.4\nSynthetic proof of payment for an isolated test only.\n%%EOF');

async function main() {
  const harness = await start({currentSchema:true});
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const contexts = [], errors = [], checks = [];
  const check = async (name, run) => {await run(); checks.push(name); console.log('PASS ' + name);};
  async function open(role, pathname) {
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
    contexts.push(context);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
      if (url.hostname!=='127.0.0.1') return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if (url.pathname==='/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:`
        const api=window.KagieAPI;
        const client=api.configureSupabase({enabled:true,url:${JSON.stringify(harness.base)},anonKey:'test-anon'});
        api.saveSettings({payments:{merchantName:'Kagie test fixture',bankName:'Test Bank',accountNumber:'0000000000',branchCode:'123456',accountType:'Test Account'}});
        api.setLoginPersistence(true);
        const originalRestore=api.restoreSession;
        const ready=client.auth.setSession({access_token:${JSON.stringify(harness.ids[role+'Token'])},refresh_token:'local-test-refresh'}).then(()=>originalRestore());
        api.restoreSession=async(...args)=>{await ready;return originalRestore(...args);};
        const originalResolve=api.resolveSessionUser;
        api.resolveSessionUser=async(...args)=>{await ready;return originalResolve(...args);};
        window.checkoutTest={cartReads:0,submissions:0,proofUploads:0};
        const getCart=api.getCartAsync;
        api.getCartAsync=async(...args)=>{checkoutTest.cartReads++;if(checkoutTest.cartDelay)await new Promise(r=>setTimeout(r,checkoutTest.cartDelay));return getCart(...args);};
        const submit=api.submitApplicationFromCartAsync;
        api.submitApplicationFromCartAsync=async(...args)=>{checkoutTest.submissions++;if(checkoutTest.failSubmit)throw new Error('Synthetic checkout outage');return submit(...args);};
        const upload=api.saveDocumentsAsync;
        api.saveDocumentsAsync=async(...args)=>{checkoutTest.proofUploads++;if(checkoutTest.failProof)throw new Error('Synthetic proof outage');return upload(...args);};
        const remove=api.removeCartItemAsync;
        api.removeCartItemAsync=async(...args)=>{if(checkoutTest.failRemove)throw new Error('Synthetic removal outage');return remove(...args);};
      `});
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(harness.base + pathname);
    return page;
  }
  async function selectPackage(page) {
    await page.goto(harness.base+'/forms.html?applicationType=undergraduate&step=pack');
    await page.locator('#packGrid [data-pack-id]').first().waitFor();
    await page.locator('#packGrid [data-pack-id]').first().click();
    await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('Package selected'));
    return page.evaluate(() => KagieAPI.getCart(KagieAPI.currentUser().id).find(item=>item.type==='application_pack'));
  }
  async function fillPayment(page, fileName='transfer-proof.pdf') {
    await page.locator('#continuePaymentBtn').click();
    await page.locator('#payerName').fill('Synthetic Test Payer');
    await page.locator('#payerPhone').fill('0712345678');
    await page.locator('#reference').fill('KAGIE-TEST-ORDER');
    await page.locator('#note').fill('Isolated functional verification');
    await page.locator('#proofFile').setInputFiles({name:fileName,mimeType:fileName.endsWith('.pdf')?'application/pdf':'text/plain',buffer:proof});
    await page.locator('#confirmCheck').check();
  }
  async function app(id) {return (await harness.db.query('select * from applications where id=$1',[id])).rows[0];}
  async function cartRows(userId) {return (await harness.db.query('select i.* from cart_items i join carts c on c.id=i.cart_id where c.user_id=$1',[userId])).rows;}

  try {
    const learner = await open('learner','/forms.html?applicationType=undergraduate&step=pack');
    let chosen = await selectPackage(learner);
    await check('Package selection saves a real application and cart item', async () => {
      assert.ok(chosen.applicationId);
      const rows = await cartRows(harness.ids.learner);
      assert.equal(rows.filter(row=>row.item_type==='application_pack').length,1);
      assert.equal(rows[0].metadata.applicationId,chosen.applicationId);
      assert.equal((await app(chosen.applicationId)).status,'Awaiting Payment');
    });
    await learner.goto(harness.base+'/cart.html');
    await learner.locator('#list [data-remove]').first().waitFor().catch(async error=>{console.log('Cart boot diagnostic',learner.url(),await learner.locator('#heroText').innerText(),await learner.locator('#list').innerText());throw error;});
    await learner.locator('#checkoutBtn:enabled').waitFor();
    await check('Cart presents the saved package and enables checkout', async () => {
      assert.equal(await learner.locator('#list [data-remove]').count(),1);
      assert.match(await learner.locator('#list .bag-price').first().innerText(),new RegExp(String(chosen.price)));
    });
    const beforeEdit = (await harness.db.query('select id from applications where user_id=$1',[harness.ids.learner])).rows;
    await check('Cart edit links preserve the application being purchased', async () => {
      for (const label of ['Change package','Edit institutions']) {
        const href = await learner.getByRole('link',{name:label,exact:true}).getAttribute('href');
        assert.equal(new URL(href,harness.base).searchParams.get('applicationId'),chosen.applicationId);
      }
    });
    await learner.getByRole('link',{name:'Change package',exact:true}).click();
    await learner.locator('#packGrid [data-pack-id]').nth(1).waitFor();
    await learner.locator('#packGrid [data-pack-id]').nth(1).click();
    await learner.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('Package selected'));
    await check('Changing a package updates the original application without creating another draft', async () => {
      const changed = await learner.evaluate(() => KagieAPI.getCart(KagieAPI.currentUser().id).find(item=>item.type==='application_pack'));
      assert.equal(changed.applicationId,chosen.applicationId);
      assert.notEqual(changed.packageId,chosen.packageId);
      const afterEdit = (await harness.db.query('select id from applications where user_id=$1',[harness.ids.learner])).rows;
      assert.deepEqual(afterEdit,beforeEdit);
      assert.equal((await cartRows(harness.ids.learner)).length,1);
      chosen=changed;
    });
    await learner.goto(harness.base+'/cart.html');
    await learner.locator('#checkoutBtn:enabled').waitFor();
    await learner.locator('#checkoutBtn').click();
    await learner.waitForURL('**/checkout.html');
    await learner.waitForFunction(()=>document.querySelector('#checkoutReviewHint')?.textContent.includes('verification'));
    await learner.locator('#continuePaymentBtn:enabled').waitFor();
    await fillPayment(learner);
    const locked = await learner.evaluate(() => {
      checkoutTest.cartDelay=250;
      const form=document.querySelector('#checkoutPaymentForm');
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      return document.querySelector('#confirmBtn').disabled;
    });
    await check('Checkout locks submission before its first asynchronous cart read', async () => assert.equal(locked,true));
    await learner.locator('#confirmationPanel').waitFor({state:'visible'}).catch(async error=>{console.log('Isolated transfer diagnostic:',await learner.locator('#paymentNotice').textContent());throw error;});
    await check('Double submit records one transfer submission and one proof upload', async () => {
      assert.equal(await learner.evaluate(()=>checkoutTest.submissions),1);
      assert.equal(await learner.evaluate(()=>checkoutTest.proofUploads),1);
    });
    await check('Payment details and the exact amount persist in SQL', async () => {
      const row = await app(chosen.applicationId);
      assert.equal(row.payment_status,'Pending Verification');
      assert.equal(row.status,'Awaiting Payment');
      assert.equal(row.payment_reference,'KAGIE-TEST-ORDER');
      assert.equal(Number(row.payment_amount),Number(chosen.price));
      assert.equal(row.payer_name,'Synthetic Test Payer');
    });
    await check('The uploaded proof belongs to the paid application and contains the actual file bytes', async () => {
      const rows = (await harness.db.query("select * from documents where application_id=$1 and document_type='proof_of_payment'",[chosen.applicationId])).rows;
      assert.equal(rows.length,1);
      assert.deepEqual(harness.files.get(rows[0].file_url).buffer,proof);
    });
    await check('Successful checkout clears the remote cart', async () => assert.equal((await cartRows(harness.ids.learner)).length,0));
    await learner.reload();
    await learner.locator('#confirmationPanel').waitFor({state:'visible'});
    await check('Reload restores payment confirmation without another submission', async () => {
      assert.equal(await learner.evaluate(()=>checkoutTest.submissions),0);
      assert.match(await learner.locator('#confirmationReceipt').innerText(),/KAGIE-TEST-ORDER/);
      assert.equal((await cartRows(harness.ids.learner)).length,0);
    });
    await learner.goto(harness.base+'/Dashboard.html');
    await learner.getByText('Pending Verification',{exact:true}).first().waitFor();
    await check('Dashboard shows the saved payment verification status', async () => assert.ok(await learner.getByText('Pending Verification',{exact:true}).count()));
    await learner.goto(harness.base+'/upload.html?category=proof_of_payment&applicationId='+chosen.applicationId);
    await learner.locator('#docs').getByText('transfer-proof.pdf',{exact:true}).first().waitFor();
    await check('Uploaded proof is visible in the learner document center', async () => assert.equal(await learner.locator('#docCategory').inputValue(),'proof_of_payment'));

    const other = await open('other','/forms.html?applicationType=undergraduate&step=pack');
    await selectPackage(other);
    await other.goto(harness.base+'/cart.html');
    await other.locator('#list [data-remove]').first().waitFor();
    await other.locator('#checkoutBtn:enabled').waitFor();
    await other.evaluate(()=>{checkoutTest.failRemove=true;});
    await other.locator('#list [data-remove]').first().click();
    await other.waitForFunction(()=>document.querySelector('#cartHint')?.textContent.includes('Synthetic removal outage'));
    await check('Failed cart actions show a recoverable error and release the button', async () => {
      assert.equal(await other.locator('#list [data-remove]').first().isEnabled(),true);
      assert.equal((await cartRows(harness.ids.other)).length,1);
    });
    await other.evaluate(()=>{checkoutTest.failRemove=false;});
    await other.locator('#list [data-remove]').first().click();
    await other.waitForFunction(()=>document.querySelector('#checkoutBtn')?.disabled && document.querySelector('#cartCountBadge')?.textContent==='0');
    await other.reload();
    await other.waitForFunction(()=>document.querySelector('#heroText')?.textContent.includes('empty'));
    await check('A deliberately removed package stays removed after reload', async () => assert.equal((await cartRows(harness.ids.other)).length,0));

    const retryOrder = await selectPackage(other);
    await other.goto(harness.base+'/checkout.html');
    await other.waitForFunction(()=>document.querySelector('#checkoutReviewHint')?.textContent.includes('verification'));
    await other.locator('#continuePaymentBtn:enabled').waitFor();
    await fillPayment(other,'unsupported-proof.txt');
    await other.locator('#confirmBtn').click();
    await other.waitForFunction(()=>document.querySelector('#paymentNotice')?.textContent.includes('PDF'));
    await check('Invalid proof files are rejected before submitting payment', async () => assert.equal(await other.evaluate(()=>checkoutTest.submissions),0));
    await other.locator('#proofFile').setInputFiles({name:'retry-proof.pdf',mimeType:'application/pdf',buffer:proof});
    await other.evaluate(()=>{checkoutTest.failSubmit=true;});
    await other.locator('#confirmBtn').click();
    await other.waitForFunction(()=>document.querySelector('#paymentNotice')?.textContent.includes('Synthetic checkout outage'));
    await check('A failed payment keeps the order, payer fields, reference and chosen proof available for retry', async () => {
      assert.equal(await other.locator('#payerName').inputValue(),'Synthetic Test Payer');
      assert.equal(await other.locator('#reference').inputValue(),'KAGIE-TEST-ORDER');
      assert.equal(await other.locator('#proofFile').evaluate(node=>node.files[0].name),'retry-proof.pdf');
      assert.equal(await other.locator('#confirmBtn').isEnabled(),true);
      assert.equal((await app(retryOrder.applicationId)).payment_status,'Payment Pending');
      assert.equal((await cartRows(harness.ids.other)).length,1);
    });
    await other.evaluate(()=>{checkoutTest.failSubmit=false;});
    await harness.db.query('update cart_items set price=price+25 where cart_id in (select id from carts where user_id=$1)',[harness.ids.other]);
    await other.locator('#confirmBtn').click();
    await other.waitForFunction(()=>document.querySelector('#checkoutReviewHint')?.textContent.includes('Your order changed'));
    await check('A changed cart returns to review before submitting a different amount', async () => {
      assert.equal(await other.evaluate(()=>checkoutTest.submissions),1);
      assert.equal(await other.locator('#paymentStepPanel').isVisible(),false);
    });
    await other.locator('#continuePaymentBtn').click();
    await other.evaluate(()=>{checkoutTest.failProof=true;});
    await other.locator('#confirmBtn').click();
    await other.locator('#confirmationPanel').waitFor({state:'visible'});
    await check('A proof-upload failure preserves the successful payment and offers the correct application link', async () => {
      assert.equal((await app(retryOrder.applicationId)).payment_status,'Pending Verification');
      assert.equal((await cartRows(harness.ids.other)).length,0);
      const href = await other.locator('#paymentNotice a').first().getAttribute('href');
      const url = new URL(href,harness.base);
      assert.equal(url.searchParams.get('category'),'proof_of_payment');
      assert.equal(url.searchParams.get('applicationId'),retryOrder.applicationId);
    });
    const newerDraft = (await harness.db.query("insert into applications (user_id,status,updated_at) values ($1,'Draft',now()+interval '1 hour') returning id",[harness.ids.other])).rows[0];
    const unrelatedProofPath=harness.ids.other+'/other-order-proof.pdf';
    await harness.db.query("insert into documents(user_id,application_id,document_type,file_name,file_size,file_url) values($1,$2,'proof_of_payment','recovered-proof.pdf',$3,$4)",[harness.ids.other,newerDraft.id,proof.length,unrelatedProofPath]);
    await harness.db.query("insert into storage.objects(bucket_id,name) values('kagie-documents',$1)",[unrelatedProofPath]);
    harness.files.set(unrelatedProofPath,{buffer:proof,type:'application/pdf'});
    await other.locator('#confirmationProofLink').click();
    await other.locator('#docCategory').waitFor();
    await other.locator('#docName').fill('recovered-proof.pdf');
    await other.locator('#docFile').setInputFiles({name:'recovered-proof.pdf',mimeType:'application/pdf',buffer:proof});
    await other.locator('#uploadBtn').click();
    await other.waitForFunction(()=>document.querySelector('#uploadStatus')?.textContent.includes('Saved successfully'));
    await check('Later proof targets the original application even with a newer draft and matching file on another order', async () => {
      const rows = (await harness.db.query("select * from documents where application_id=$1 and document_type='proof_of_payment'",[retryOrder.applicationId])).rows;
      assert.equal(rows.length,1);
      assert.deepEqual(harness.files.get(rows[0].file_url).buffer,proof);
      assert.equal((await harness.db.query('select id from documents where application_id=$1',[newerDraft.id])).rows.length,1);
    });
    await learner.goto(harness.base+'/upload.html?category=proof_of_payment&applicationId='+retryOrder.applicationId);
    await learner.locator('#uploadStatus').filter({hasText:'application is unavailable'}).waitFor();
    const deniedApplicationMessage=await learner.locator('#uploadStatus').innerText();
    await check('An upload link to another learner application is refused',async()=>{
      assert.match(deniedApplicationMessage,/application is unavailable/);
      assert.equal(await learner.locator('#uploadBtn').isDisabled(),true);
    });
    await check('No uncaught browser errors across the student journey', async () => assert.deepEqual(errors,[]));
    fs.writeFileSync(path.join(root,'reports/checkout-flow-checks.json'),JSON.stringify({runAt:new Date().toISOString(),environment:'Local Chrome, real Supabase SDK, isolated SQL/RLS and Storage, synthetic transfers only',checks},null,2));
    console.log(`${checks.length} checkout flow checks passed`);
  } finally {await browser.close(); await harness.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
