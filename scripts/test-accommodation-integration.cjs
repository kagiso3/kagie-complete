// Real Supabase SDK and real local SQL/RLS; no production service is contacted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {start}=require('./admin-test-server.cjs');
async function main(){
  const h=await start(),browser=await chromium.launch({channel:'chrome',headless:true}),contexts=[],errors=[];
  let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
  try{
    const listing=(await h.db.query("insert into housing_listings(title,institution_name,location,address,price,room_type,availability_status,listing_state,amenities,available_from,images,created_by) values('Integration Campus Home','Local University','Hatfield','Hatfield, Pretoria',2800,'Single room','Available','published',$1,'2027-02-01',$2,$3) returning id",[['WiFi included','NSFAS-friendly','Kitchen'],JSON.stringify(['/images/accommodation/room-example.webp']),h.ids.master])).rows[0].id;
    await h.db.query("insert into housing_listings(title,listing_state,created_by) values('Hidden draft home','draft',$1)",[h.ids.master]);
    async function open(actor,hash){
      const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});contexts.push(context);
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.pathname.includes('/npm/@supabase/supabase-js@'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
        if(url.hostname!=='127.0.0.1')return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
        if(url.pathname==='/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:`const client=KagieAPI.configureSupabase({enabled:true,url:${JSON.stringify(h.base)},anonKey:'test-anon'});window.testClient=client;KagieAPI.setLoginPersistence(true);const resolve=KagieAPI.resolveSessionUser;KagieAPI.resolveSessionUser=async function(...args){await client.auth.setSession({access_token:${JSON.stringify(h.ids[actor+'Token'])},refresh_token:'local-test-refresh'});return resolve(...args);};`});
        return route.continue();
      });
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(h.base+'/more-service/accommodation-assist.html'+hash);await page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');return page;
    }
    // Verify immediately after starting the isolated harness.
    const learner=await open('learner','#listings');
    check(await learner.locator('.ha-card').count()===1,'Learner sees published remote home');
    check(await learner.getByText('Hidden draft home',{exact:true}).count()===0,'Draft home stays hidden');
    await learner.getByRole('link',{name:'Integration Campus Home',exact:true}).click();
    check(await learner.getByRole('heading',{name:'Integration Campus Home',exact:true}).count()===1,'Remote detail opens');
    check(await learner.getByText('NSFAS-friendly',{exact:true}).count()>0,'Recorded amenities reach frontend');
    check(await learner.getByText('01 Feb 2027',{exact:true}).count()===1 || (await learner.locator('.ha-facts').textContent()).includes('2027'),'Recorded availability date reaches frontend');
    await learner.getByRole('link',{name:'Request to reserve',exact:true}).click();
    await learner.getByLabel('Phone number',{exact:true}).fill('0711234567');await learner.getByLabel('Move-in date',{exact:true}).fill('2027-02-01');
    await learner.getByLabel('Funding plan',{exact:true}).selectOption('Self-funded');await learner.getByLabel('Document readiness',{exact:true}).selectOption('All ready');
    await learner.getByLabel('Notes for Kagie').fill('Integration reservation brief');await learner.getByRole('button',{name:/Send request to Kagie/}).click();
    await learner.getByRole('heading',{name:'Request submitted!',exact:true}).waitFor();check(true,'Remote save is confirmed online');
    let rows=(await h.db.query('select * from accommodation_requests where user_id=$1',[h.ids.learner])).rows;
    check(rows.length===1&&rows[0].listing_id===listing,'Request persisted to actual SQL');
    check(rows[0].note==='Integration reservation brief'&&new Date(rows[0].preferred_move_in_date).toISOString().startsWith('2027-02-01'),'Request fields persisted');
    await learner.reload();await learner.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');
    check(await learner.getByRole('heading',{name:'Request submitted!',exact:true}).count()===1,'Remote status survives reload');
    await learner.getByRole('link',{name:'Review or update request',exact:true}).click();await learner.getByLabel('Notes for Kagie').fill('Updated integration brief');await learner.getByRole('button',{name:/Update request/}).click();
    try {await learner.getByRole('heading',{name:'Request submitted!',exact:true}).waitFor({timeout:12000});}catch(error){throw new Error('Update did not confirm online: '+await learner.locator('#housingContent').innerText());}
    rows=(await h.db.query('select * from accommodation_requests where user_id=$1',[h.ids.learner])).rows;check(rows.length===1&&rows[0].note==='Updated integration brief','Update persists without duplicating');
    const secondDevice=await open('learner','#requests');check(await secondDevice.getByText('Saved online',{exact:true}).count()===1,'New device reloads online request');
    const other=await open('other','#requests');check(await other.getByRole('heading',{name:'No requests yet'}).count()===1,'Other learner cannot see the request');
    const protectedRows=await other.evaluate(async id=>{const result=await testClient.from('accommodation_requests').select('*').eq('user_id',id);return result.data;},h.ids.learner);check(protectedRows?.length===0,'Direct API read respects ownership RLS');
    // A local fallback after editing an online record must not claim it synced.
    const fallback=await learner.evaluate(async listingId=>{
      const current=KagieAPI.getAccommodationRequests(KagieAPI.currentUser().id)[0];
      return KagieAPI.submitAccommodationRequest({...current,listingId,note:'Offline edit'},KagieAPI.currentUser().id);
    },listing);check(fallback.source==='local','Offline edit of online record resets sync marker');
    check(errors.length===0,'No uncaught integration browser errors');
    fs.writeFileSync(path.join(__dirname,'../reports/accommodation-design/integration.json'),JSON.stringify({checks,errors,productionContacted:false,realSQL:true,realSDK:true},null,2));console.log('PASS '+checks+' accommodation integration checks.');
  }finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();await h.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
