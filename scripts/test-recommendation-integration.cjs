// Real SDK and repository SQL/RLS; synthetic Auth only, never production.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {start} = require('./admin-test-server.cjs');
const marks = [{subject:'English Home Language',percent:72},{subject:'Mathematics',percent:64},{subject:'Life Sciences',percent:58},{subject:'Geography',percent:61},{subject:'Business Studies',percent:67},{subject:'Life Orientation',percent:80}];
async function main() {
  const harness = await start();
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
  const errors = [];
  let checks = 0;
  const check = (value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
  try {
    await context.route('**/*', route=>{
      const url=new URL(route.request().url());
      if(url.pathname.includes('/npm/@supabase/supabase-js@'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
      if(url.hostname!=='127.0.0.1')return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if(url.pathname==='/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:`const client=window.KagieAPI.configureSupabase({enabled:true,url:${JSON.stringify(harness.base)},anonKey:'test-anon'});window.KagieAPI.setLoginPersistence(true);const resolve=window.KagieAPI.resolveSessionUser;window.KagieAPI.resolveSessionUser=async function(...args){await client.auth.setSession({access_token:${JSON.stringify(harness.ids.learnerToken)},refresh_token:'local-test-refresh'});const user=await resolve(...args);if(user && !window.KagieAPI.getProfile(user.id).marks.length)window.KagieAPI.saveProfile(user.id,{marks:${JSON.stringify(marks)}});return user;};`});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    // Smoke immediately after harness startup.
    await page.goto(harness.base+'/recommendation.html',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:/Hi Lerato/}).waitFor();
    check(!page.url().includes('login.html'),'Restored real SDK session reaches the course dashboard');
    check((await page.locator('.rc-stat').first().innerText()).includes('25'),'Academic rollup reads the learner’s existing profile marks');
    await page.getByRole('link',{name:/View Recommendations/}).click();
    await page.getByRole('link',{name:/Bachelor of Education/}).click();
    await page.getByRole('heading',{name:'Course Details',exact:true}).waitFor();
    check(await page.locator('.rc-campus img').evaluate(image=>image.complete && image.naturalWidth>0),'Details and local illustration work with the real SDK');
    await page.getByRole('button',{name:'Save Bachelor of Education',exact:true}).first().click();
    await page.getByRole('button',{name:'Unsave Bachelor of Education',exact:true}).first().waitFor();
    check(await page.evaluate(()=>KagieAPI.getFavorites().some(item=>item.type==='course' && item.course==='Bachelor of Education')),'Saved course uses the real shared favorite API');
    await page.reload();
    await page.getByRole('heading',{name:'Course Details',exact:true}).waitFor();
    check(await page.getByRole('button',{name:'Unsave Bachelor of Education',exact:true}).first().count()===1,'Course URL and saved status survive SDK session restoration');
    await page.goto(harness.base+'/recommendation.html#marks');
    await page.getByLabel('Percentage for subject 1',{exact:true}).fill('88');
    await page.getByRole('button',{name:/Calculate & Recommend/}).click();
    await page.getByRole('heading',{name:'Preferred Fields',exact:true}).waitFor();
    check(await page.evaluate(()=>KagieAPI.getProfile(KagieAPI.currentUser().id).marks[0].percent)===88,'Mark editing uses the actual profile persistence contract');
    await page.reload();
    await page.getByRole('heading',{name:'Preferred Fields',exact:true}).waitFor();
    check(await page.evaluate(()=>KagieAPI.getProfile(KagieAPI.currentUser().id).marks[0].percent)===88,'Local academic marks survive remote profile refresh');
    const profile=(await harness.db.query('select full_name,role from profiles where id=$1',[harness.ids.learner])).rows[0];
    check(profile.full_name==='Lerato Learner' && profile.role==='user','Course edits preserve the remote learner identity and role');
    await page.goto(harness.base+'/recommendation.html#saved');
    await page.getByRole('heading',{name:'Saved Courses',exact:true}).waitFor();
    check(await page.locator('.rc-saved-course').count()===1,'Saved course remains available through the shared shortlist after refresh');
    check(errors.length===0,'No uncaught errors with the real SDK and SQL/RLS');
    fs.writeFileSync(path.join(__dirname,'../reports/recommendation-design/integration.json'),JSON.stringify({checks,errors,isolatedSqlAndAuth:true,productionContacted:false,marksPersistence:'Existing local profile contract',favoritesPersistence:'Existing local shared favorites contract'},null,2));
    console.log('PASS '+checks+' recommendation integration checks.');
  } finally {await context.close();await browser.close();await harness.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
