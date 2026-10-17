// Real Supabase SDK + local SQL/RLS. All identities and data are synthetic.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { start } = require('./admin-test-server.cjs');
async function main() {
  const harness = await start();
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const errors=[];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error=>errors.push(error.message));
    // Block every external service before loading the runtime in a blank document.
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({body:''}));
    await page.goto(harness.base+'/local-apply-data-test.html');
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({path:path.join(__dirname,'../node_modules/@supabase/supabase-js/dist/umd/supabase.js')});
    await page.addScriptTag({path:path.join(__dirname,'../js/backend.js')});
    await page.addScriptTag({path:path.join(__dirname,'../js/data.js')});
    await page.evaluate(async ({base,token})=>{
      const client=KagieAPI.configureSupabase({enabled:true,url:base,anonKey:'test-anon'});
      KagieAPI.setLoginPersistence(true);
      await client.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'});
      const user=await KagieAPI.restoreSession();
      if(!user)throw new Error('Synthetic learner session was not established');
    },{base:harness.base,token:harness.ids.learnerToken});
    const requests=[];
    page.on('request',request=>{if(request.method()==='GET')requests.push(new URL(request.url()).pathname);});
    const profiles=await page.evaluate(async()=>{
      const id=KagieAPI.currentUser().id;
      return Promise.all([KagieAPI.getProfileAsync(id),KagieAPI.getProfileAsync(id)]);
    });
    assert.equal(profiles[0].fullName,'Lerato Learner');
    assert.deepEqual(profiles[0],profiles[1]);
    for(const table of ['user_profiles','guardian_profiles','school_profiles']) {
      assert.equal(requests.filter(url=>url==='/rest/v1/'+table).length,1,table+' read is shared');
    }
    console.log('PASS Concurrent profile reads share one request per detail table');
    await page.evaluate(()=>KagieAPI.getProfileAsync(KagieAPI.currentUser().id));
    assert.equal(requests.filter(url=>url==='/rest/v1/user_profiles').length,2);
    console.log('PASS Completed profile reads do not create a stale cache');

    await page.evaluate(async()=>{
      const id=KagieAPI.currentUser().id;
      await KagieAPI.saveProfileAsync(id,{fullName:'Saved Learner',surname:'Latest',guardianFullNames:'Saved Guardian',schoolName:'Test Secondary'});
      const profile=await KagieAPI.getProfileAsync(id);
      if(profile.fullName!=='Saved Learner'||profile.guardianFullNames!=='Saved Guardian')throw new Error('Saved values are stale');
    });
    const row=(await harness.db.query('select full_name from profiles where id=$1',[harness.ids.learner])).rows[0];
    assert.equal(row.full_name,'Saved Learner');
    console.log('PASS Profile writes and subsequent reads retain real database changes');

    const draft=await page.evaluate(async()=>{
      const id=KagieAPI.currentUser().id;
      const [profile,draft]=await Promise.all([KagieAPI.getProfileAsync(id),KagieAPI.ensureDraftAsync(id)]);
      if(profile.fullName!=='Saved Learner')throw new Error('Wrong learner profile');
      return draft;
    });
    assert.ok(draft.id);
    assert.ok((await harness.db.query('select id from applications where id=$1 and user_id=$2',[draft.id,harness.ids.learner])).rows.length);
    console.log('PASS Parallel profile and draft loading hydrates the correct learner application');

    await harness.db.query("insert into institutions(name,province,type,manual_status,year) values('Live Apply Test University','Gauteng','University','open',$1)",[String(new Date().getFullYear())]);
    const catalog=await page.evaluate(async()=>{
      await KagieAPI.getInstitutionCatalogAsync({includeInactive:false,canApplyOnly:true});
      KagieAPI.refreshCatalogCaches({preserveRemote:true});
      return KagieAPI.getInstitutionCatalog({includeInactive:false,canApplyOnly:true});
    });
    assert.ok(catalog.some(item=>item.name==='Live Apply Test University'));
    console.log('PASS Static catalog invalidation preserves live institution records');
    assert.deepEqual(errors,[]);
    console.log('PASS No uncaught backend browser errors');
  } finally { await browser.close(); await harness.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
