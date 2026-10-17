// Real browser SDK + repository SQL/RLS, using isolated synthetic Auth and records.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {start}=require('./admin-test-server.cjs');
async function main() {
  const harness=await start();
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  let checks=0;const errors=[];
  const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
  try {
    const own=(await harness.db.query("insert into application_updates(user_id,application_id,title,message,status,action_label,action_url,posted_by) values($1,$2,'Please confirm your course choices','Reply with your preferred three choices.','Application Updated','Open Dashboard','dashboard.html',$3) returning id",[harness.ids.learner,harness.app,harness.ids.master])).rows[0].id;
    const other=(await harness.db.query("insert into application_updates(user_id,application_id,title,message,status,posted_by) values($1,$2,'Private other learner update','Must remain unavailable.','Under Review',$3) returning id",[harness.ids.other,harness.otherApp,harness.ids.master])).rows[0].id;
    await harness.db.query("insert into notifications(user_id,title,message,notification_type) values($1,'Your document review is ready','Check the latest application feedback.','info')",[harness.ids.learner]);
    await harness.db.query("insert into notifications(user_id,title,message,notification_type) values($1,'Other learner notification','Must remain unavailable.','info')",[harness.ids.other]);
    await harness.db.query("insert into announcements(title,message,type,audience,status,created_by) values('Published learner announcement','A real isolated learner notice.','info','learners','active',$1),('Inactive announcement','Must remain unavailable.','info','learners','inactive',$1),('Assistant announcement','Must remain unavailable.','info','assistants','active',$1)",[harness.ids.master]);
    await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')}));
    await context.route('**/js/supabase-config.js*',r=>r.fulfill({contentType:'text/javascript',body:`const client=window.KagieAPI.configureSupabase({enabled:true,url:${JSON.stringify(harness.base)},anonKey:'test-anon'});window.KagieAPI.setLoginPersistence(true);const originalResolve=window.KagieAPI.resolveSessionUser;window.KagieAPI.resolveSessionUser=async function(...args){await client.auth.setSession({access_token:${JSON.stringify(harness.ids.learnerToken)},refresh_token:'local-test-refresh'});return originalResolve(...args);};`}));
    await context.route('https://fonts.googleapis.com/**',r=>r.abort());
    await context.route('https://fonts.gstatic.com/**',r=>r.abort());
    const page=await context.newPage();page.on('pageerror',err=>errors.push(err.message));
    await page.goto(harness.base+'/updates.html',{waitUntil:'domcontentloaded'});
    await page.getByRole('link',{name:/Please confirm your course choices/}).waitFor();
    check(await page.getByRole('heading',{name:'Updates',exact:true}).count()===1,'Restored learner session loads Updates without premature login redirect');
    check(await page.getByRole('link',{name:/Please confirm your course choices/}).count()===1,'Real application_updates records render once');
    check(await page.getByRole('link',{name:/Your document review is ready/}).count()===1,'Real notification records render once');
    check(await page.getByRole('link',{name:/Published learner announcement/}).count()===1,'Published learner announcements load through the existing API');
    check(await page.getByText('Inactive announcement',{exact:true}).count()===0 && await page.getByText('Assistant announcement',{exact:true}).count()===0,'Inactive and staff announcements stay outside the learner feed');
    check(await page.getByText('Private other learner update',{exact:true}).count()===0 && await page.getByText('Other learner notification',{exact:true}).count()===0,'SQL/RLS excludes another learner’s update and notification');
    check((await page.locator('.up-card').filter({hasText:'Kagie supports both universities and TVET colleges'}).innerText()).includes('Kagie guide'),'Undated catalog guides do not pretend to have a new publication date');
    await page.getByRole('link',{name:/Please confirm your course choices/}).click();
    await page.waitForFunction(async()=>await window.KagieAPI.getApplicationUpdatesAsync().then(rows=>rows.some(row=>row.read)));
    check((await harness.db.query('select is_read from application_updates where id=$1',[own])).rows[0].is_read,'Opening an application notice saves its read status through the actual SDK');
    check((await page.getByRole('link',{name:/Open Dashboard/}).first().getAttribute('href')).endsWith('/Dashboard.html'),'Real application CTA resolves to the shipped Dashboard page');
    await page.reload();
    await page.getByRole('heading',{name:'Please confirm your course choices'}).waitFor();
    check(await page.getByRole('heading',{name:'Please confirm your course choices'}).count()===1,'A real update deep link survives refresh');
    await page.goto(harness.base+'/updates.html#detail/application-'+other);
    await page.getByRole('heading',{name:'Update unavailable'}).waitFor();
    check(await page.getByRole('heading',{name:'Update unavailable'}).count()===1,'A manual deep link cannot reveal another learner’s private update');
    check(!(await harness.db.query('select is_read from application_updates where id=$1',[other])).rows[0].is_read,'Inaccessible notices are never marked read');
    check(errors.length===0,'No uncaught browser errors with the real SDK');
    fs.writeFileSync(path.join(__dirname,'../reports/updates-design/integration.json'),JSON.stringify({checks,errors,isolatedSqlAndAuth:true,productionContacted:false},null,2));
    console.log('PASS '+checks+' Updates SQL/SDK integration checks.');
  } finally {await context.close();await browser.close();await harness.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
