// Real SDK, existing SQL/RLS and synthetic local Auth/Storage responses.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {start} = require('./admin-test-server.cjs');
const {pdf} = require('./test-prospectus.cjs');
async function main() {
  const harness = await start({currentSchema:true});
  await harness.db.query("insert into institutions(id,name,institution_type,province,is_visible) values('60000000-0000-4000-8000-000000000005','Boland TVET College','TVET College','Western Cape',true)");
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const contexts = [], errors = [];
  let checks = 0;
  const check = (value,label) => {assert.ok(value,label);checks++;console.log('PASS '+label);};
  const filePath = 'prospectus/60000000-0000-4000-8000-000000000005/2026__main-prospectus.pdf';
  const privatePath = harness.ids.other+'/private-prospectus-test.pdf';
  try {
    for(const filename of [filePath,privatePath]) {
      await harness.db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['kagie-documents',filename]);
      harness.files.set(filename,{buffer:pdf(),type:'application/pdf'});
    }
    async function open(actor,hash) {
      const context = await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block',acceptDownloads:true});contexts.push(context);
      await context.route('**/*',async route => {
        const url=new URL(route.request().url());
        if(url.pathname.includes('/npm/@supabase/supabase-js@')) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
        if(url.hostname!=='127.0.0.1') return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
        if(url.pathname==='/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:`const client=KagieAPI.configureSupabase({enabled:true,url:${JSON.stringify(harness.base)},anonKey:'test-anon'});KagieAPI.setLoginPersistence(true);const resolve=KagieAPI.resolveSessionUser;KagieAPI.resolveSessionUser=async function(...args){await client.auth.setSession({access_token:${JSON.stringify(harness.ids[actor+'Token'])},refresh_token:'local-test-refresh'});return resolve(...args);};if (${JSON.stringify(actor === 'master' && hash === '#manage')}) {const loadCatalog=KagieAPI.getInstitutionCatalogAsync;KagieAPI.getInstitutionCatalogAsync=async(...args)=>{await new Promise(resolve=>{window.releaseInstitutionFixture=resolve;});return loadCatalog(...args);};}`});
        if(url.pathname==='/storage/v1/object/list/kagie-documents') {
          const prefix = route.request().postDataJSON().prefix || '';
          const files = await harness.db.transaction(async tx => {
            await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[harness.ids[actor]]);
            await tx.exec('set local role authenticated');
            return (await tx.query('select id,name from storage.objects where bucket_id=$1 and name like $2',['kagie-documents',prefix+'/%'])).rows;
          });
          const items = new Map();
          for(const file of files) {
            const remainder = file.name.slice(prefix.length+1), name = remainder.split('/')[0];
            if(!items.has(name)) items.set(name,{id:remainder.includes('/') ? null : file.id,name,created_at:'2026-01-02T09:00:00Z',updated_at:'2026-01-02T09:00:00Z',metadata:{size:harness.files.get(file.name)?.buffer.length || 0}});
          }
          return route.fulfill({contentType:'application/json',body:JSON.stringify([...items.values()])});
        }
        return route.continue();
      });
      const page = await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(harness.base+'/prospectus.html'+hash,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.getElementById('prospectusContent')?.getAttribute('aria-busy')==='false');
      return page;
    }
    // Smoke immediately after starting the isolated API harness.
    const learner = await open('learner','#institution/60000000-0000-4000-8000-000000000005?tab=prospectus');
    await learner.getByRole('heading',{name:'Boland TVET College',exact:true}).waitFor();
    check(await learner.getByRole('heading',{name:'Boland TVET College',exact:true}).count()===1,'Real SDK restores learner session and renders details');
    await learner.getByRole('button',{name:'Download Prospectus',exact:true}).waitFor();
    check(await learner.getByRole('link',{name:'Open PDF',exact:true}).getAttribute('href')!==null,'Storage listing provides an actual signed PDF link');
    const downloading = learner.waitForEvent('download');
    await learner.getByRole('button',{name:'Download Prospectus',exact:true}).click();
    const download=await downloading, destination=path.join(__dirname,'../reports/prospectus-design/SDK-prospectus.pdf');
    await download.saveAs(destination);
    check(fs.readFileSync(destination).equals(pdf()),'Browser downloads the signed Storage PDF bytes');
    await learner.reload();await learner.getByRole('button',{name:'Download Prospectus',exact:true}).waitFor();
    await learner.getByRole('link',{name:'Your downloads',exact:true}).click();
    check(await learner.locator('.pr-history-row').count()===1,'Download history survives real SDK session restoration');
    const denied = await learner.evaluate(async filename => {const result=await client.storage.from('kagie-documents').createSignedUrl(filename,60);return Boolean(result.error);},privatePath);
    check(denied,'Existing Storage RLS denies another learner’s private PDF');
    const forbidden = await learner.evaluate(async () => {try {await KagieAPI.saveProspectusDocumentByStaffAsync({institutionId:'60000000-0000-4000-8000-000000000005',title:'Forbidden',dataUrl:'data:application/pdf;base64,JVBERi0=',fileName:'forbidden.pdf'});return false;} catch {return true;}});
    check(forbidden,'Real API rejects learner prospectus uploads');
    const assistant = await open('assistant','#manage');
    await assistant.getByLabel('Institution',{exact:true}).selectOption('60000000-0000-4000-8000-000000000005');
    await assistant.getByLabel('Title',{exact:true}).fill('Assistant Device PDF');
    await assistant.getByLabel('Prospectus PDF',{exact:true}).setInputFiles({name:'assistant-local.pdf',mimeType:'application/pdf',buffer:pdf()});
    await assistant.getByRole('button',{name:'Upload PDF',exact:true}).click();
    await assistant.getByRole('status').filter({hasText:/saved to this device/}).waitFor();
    check(await assistant.locator('#prospectusUploadMessage').innerText().then(text=>text.includes('not been uploaded to shared storage')),'Assistant sees an accurate device-only upload result under existing RLS');
    check((await harness.db.query('select name from storage.objects where name like $1',['prospectus/%assistant-device-pdf%'])).rows.length===0,'Assistant fallback does not bypass shared Storage permissions');
    const staff = await open('master','#manage');
    await staff.getByLabel('Title',{exact:true}).fill('SDK Shared Prospectus');
    await staff.getByLabel('Prospectus PDF',{exact:true}).setInputFiles({name:'shared.pdf',mimeType:'application/pdf',buffer:pdf()});
    await staff.waitForFunction(()=>typeof window.releaseInstitutionFixture==='function');
    await staff.evaluate(()=>window.releaseInstitutionFixture());
    await staff.getByLabel('Institution',{exact:true}).selectOption('60000000-0000-4000-8000-000000000005');
    check(await staff.getByLabel('Title',{exact:true}).inputValue()==='SDK Shared Prospectus' && await staff.getByLabel('Prospectus PDF',{exact:true}).evaluate(input=>input.files[0]?.name==='shared.pdf'),'Authoritative institution refresh preserves the typed title and selected PDF');
    await staff.getByRole('button',{name:'Upload PDF',exact:true}).click();
    await staff.getByRole('status').filter({hasText:/uploaded to the shared Kagie library/}).waitFor();
    const uploaded = (await harness.db.query('select name from storage.objects where bucket_id=$1 and name like $2',['kagie-documents','prospectus/60000000-0000-4000-8000-000000000005/%sdk-shared-prospectus%'])).rows[0];
    check(Boolean(uploaded),'Staff upload writes through the real SDK and existing Storage RLS');
    check(harness.files.get(uploaded.name).buffer.equals(pdf()),'Storage preserves uploaded PDF bytes');
    await learner.goto(harness.base+'/prospectus.html#institution/60000000-0000-4000-8000-000000000005?tab=prospectus');
    // Same-document hash navigation preserves the current cache; reload fetches
    // the newly shared library from this independent learner session.
    await learner.reload();
    await learner.waitForFunction(()=>document.querySelectorAll('[data-download]').length===2);
    check(await learner.getByRole('button',{name:'Download Prospectus',exact:true}).count()===2,'A separate learner session sees the new shared prospectus');
    const nextDownload=learner.waitForEvent('download');await learner.getByRole('button',{name:'Download Prospectus',exact:true}).last().click();await nextDownload;
    check(await learner.evaluate(()=>JSON.parse(localStorage.getItem('kagie_prospectus_history:'+KagieAPI.currentUser().id)).downloads.length)===2,'Shared download adds a second history record');
    await staff.context().route('**/storage/v1/object/kagie-documents',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({statusCode:'403',message:'Simulated storage rejection',error:'Forbidden'})}));
    const rejected = await staff.evaluate(async key=>{const before=KagieAPI.getProspectusDocuments().length;try{await KagieAPI.deleteProspectusDocumentByStaffAsync(key);return false;}catch{return KagieAPI.getProspectusDocuments().length===before;}},uploaded.name);
    check(rejected,'A rejected shared deletion preserves the cached PDF instead of reporting success');
    check((await harness.db.query('select role from profiles where id=$1',[harness.ids.assistant])).rows[0].role==='assistant_admin' && (await harness.db.query('select role from profiles where id=$1',[harness.ids.master])).rows[0].role==='master_admin','UI operations preserve staff roles');
    check(errors.length===0,'No uncaught errors with real SDK and SQL/RLS');
    fs.writeFileSync(path.join(__dirname,'../reports/prospectus-design/integration.json'),JSON.stringify({checks,errors,productionContacted:false,realSdk:true,existingSqlAndRls:true,storageList:'Synthetic endpoint querying actual RLS-visible objects',downloadHistory:'Device-local per-account history'},null,2));
    console.log('PASS '+checks+' prospectus integration checks.');
  } finally {for(const context of contexts)await context.close();await browser.close();await harness.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
