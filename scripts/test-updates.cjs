// Synthetic browser fixtures only. This script never contacts production services.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'reports/updates-design');
fs.mkdirSync(output,{recursive:true});
const learner={id:'updates-test-learner',role:'user',fullName:'Test Learner',email:'updates@test.invalid',profile:{}};
const feed=[
  {id:'test-pack',source:'catalog',category:'announcement',title:'Choose an application pack',message:'Select the intake period that matches how many institutions you want to apply to.',createdAt:'2026-01-02T08:00:00Z',ctaHref:'forms.html',ctaLabel:'Choose Application Pack',imageUrl:'images/updates-campus.webp',keyInformation:['Choose between undergraduate, bridge or transfer.','Check each intake opening and closing dates.','You can apply to multiple universities in one go.','Make sure your documents are updated.']},
  {id:'test-docs',source:'catalog',category:'announcement',title:'Upload your core documents',message:'Certified ID copy and latest results help your application reach more universities.',createdAt:'2026-01-02T07:00:00Z',ctaHref:'upload.html',ctaLabel:'Upload Documents'},
  {id:'test-opportunity',source:'catalog',category:'opportunity',title:'Kagie supports both universities and TVET colleges',message:'Apply to multiple South African tertiary pathways in one place.',createdAt:'2026-01-02T06:00:00Z',ctaHref:'forms.html'},
  {id:'test-maths',source:'catalog',category:'recommendation',title:'Strong Maths and Science learners should explore engineering',message:'Find engineering courses and requirements across top universities.',createdAt:'2026-01-01T08:00:00Z',ctaHref:'recommendation.html'},
  {id:'test-early',source:'catalog',category:'deadline',title:'Early deadline institutions open and close sooner',message:'Some universities have early closing dates. Make sure to check and apply early.',createdAt:'2025-12-28T12:00:00Z',ctaHref:'home.html'},
  {id:'test-support',source:'catalog',category:'news',title:'More Service support is ready inside Kagie',message:'Add change email, forgot PIN, forgot student number, and re-apply support directly to your cart.',createdAt:'2025-12-26T08:00:00Z',ctaHref:'more-service/index.html',imageUrl:'images/students.webp'}
];
const notices=[
  {id:'test-nsfas',source:'announcement',type:'deadline',title:'NSFAS 2026 application deadline',message:'Synthetic test notice. Confirm real dates with the official provider.',createdAt:'2025-12-15T23:59:59+02:00'},
  {id:'test-up',source:'announcement',type:'deadline',title:'University of Pretoria 2026 deadline',message:'Synthetic test notice. No real application deadline is represented.',createdAt:'2025-12-10T00:00:00+02:00'}
];
const application={id:'test-application',title:'Your application needs attention',message:'A synthetic private application update.',status:'pending',updateAt:'2026-01-03T08:00:00Z',actionUrl:'dashboard.html',actionLabel:'Open Dashboard',read:false};
const config=`window.KagieAPI.configureSupabase({enabled:false});
window.KagieAPI.resolveSessionUser=async()=>window.KagieAPI.currentUser();
window.KagieAPI.getUpdateFeed=()=>${JSON.stringify(feed)};
window.KagieAPI.getApplicationUpdates=()=>[];
window.KagieAPI.getNotifications=()=>[];
window.KagieAPI.getApplicationUpdatesAsync=async()=>[${JSON.stringify(application)}];
window.KagieAPI.getNotificationsAsync=async()=>${JSON.stringify(notices)};
window.testReadIds=[];
window.KagieAPI.markApplicationUpdateReadAsync=async id=>window.testReadIds.push(id);
window.KagieAPI.markNotificationReadAsync=async id=>window.testReadIds.push(id);`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file;try {file=path.resolve(root,'.'+decodeURIComponent(pathname));}catch {res.writeHead(400);res.end();return;}
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  if(process.argv.includes('--preview') && pathname==='/js/supabase-config.js') {res.end(config);return;}
  let body=fs.readFileSync(file);
  if(process.argv.includes('--preview') && pathname==='/updates.html') body=body.toString().replace('<head>',`<head><script>localStorage.setItem('kagie_users',JSON.stringify([${JSON.stringify(learner)}]));localStorage.setItem('kagie_current_user',JSON.stringify(${JSON.stringify(learner)}));</script>`);
  res.end(body);
});
let checks=0;
function pass(condition,label) {assert.ok(condition,label);checks++;}
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  if(process.argv.includes('--preview')) {console.log('Local synthetic Updates preview: '+base+'/updates.html');return;}
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],missing=[];
  async function open(hash='',scenario='',signedIn=true) {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',timezoneId:'Africa/Johannesburg'});
    if(signedIn) await context.addInitScript(user=>{localStorage.setItem('kagie_users',JSON.stringify([user]));localStorage.setItem('kagie_current_user',JSON.stringify(user));},learner);
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='127.0.0.1') return route.fulfill({status:200,body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if(url.pathname==='/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:config+scenario});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()===404 && response.url().startsWith(base))missing.push(response.url());});
    await page.goto(base+'/updates.html'+hash,{waitUntil:'domcontentloaded'});
    if(signedIn) await page.waitForFunction(()=>document.getElementById('updatesContent')?.getAttribute('aria-busy')==='false');
    return {page,context};
  }
  try {
    // Immediate smoke check after starting the local server.
    const smoke=await open();
    await smoke.page.locator('.up-card').nth(8).waitFor();
    pass(await smoke.page.locator('#updateList .up-card').count()===9,'Catalog, published notices and private application updates load together');
    await smoke.page.getByRole('link',{name:/Choose an application pack/}).click();
    await smoke.page.getByRole('heading',{name:'Key Information'}).waitFor();
    pass(await smoke.page.getByRole('heading',{name:'Update Details',exact:true}).count()===1,'Feed card opens full details');
    pass(await smoke.page.locator('.up-detail__photo').evaluate(image=>image.complete && image.naturalWidth>0),'Campus detail asset loads');
    await smoke.page.getByRole('link',{name:'Back to Updates',exact:true}).click();
    await smoke.page.getByRole('heading',{name:'Updates',exact:true}).waitFor();
    console.log('Smoke passed: feed, navigation, image loading and details.');
    await smoke.context.close();

    const responsive=await open();
    const views=['','#detail/catalog-test-pack','#filters','#search?q=deadline','#category/deadline','#category/announcement'];
    for(const hash of views) {
      await responsive.page.goto(base+'/updates.html'+hash,{waitUntil:'domcontentloaded'});
      await responsive.page.waitForFunction(()=>document.getElementById('updatesContent')?.getAttribute('aria-busy')==='false');
      if(!hash.includes('filters')) await responsive.page.waitForTimeout(80);
      for(const width of [320,390,768,1024,1440]) {
        await responsive.page.setViewportSize({width,height:width===390?1000:1100});
        const geometry=await responsive.page.evaluate(()=>({width:document.documentElement.scrollWidth,inputSizes:[...document.querySelectorAll('input:not([type=checkbox])')].map(input=>parseFloat(getComputedStyle(input).fontSize)),nav:[...document.querySelectorAll('.kagie-shared-bottom-nav a')].map(link=>link.getAttribute('href')),foot:document.querySelector('.bottom-nav').getBoundingClientRect().toJSON()}));
        pass(geometry.width<=width,hash+' fits '+width+'px');
        pass(geometry.inputSizes.every(size=>size>=16),'Fields avoid mobile zoom at '+width+'px');
        pass(JSON.stringify(geometry.nav)===JSON.stringify(['home.html','career-guidance.html','recommendation.html','more-service/accommodation-assist.html','more-service/transport-assist.html']),'Existing app footer destinations are preserved');
        pass(geometry.foot.x>=0 && geometry.foot.right<=width,'Footer fits '+width+'px');
        if([390,768,1440].includes(width)) await responsive.page.screenshot({path:path.join(output,(hash.split('?')[0].replace(/[#/]/g,'-')||'feed')+'-'+width+'.png'),fullPage:true});
      }
    }
    await responsive.context.close();

    const search=await open();
    await search.page.locator('.up-card').nth(8).waitFor();
    await search.page.getByRole('searchbox').fill('deadline');
    pass(await search.page.locator('#resultsCount').innerText()==='Results (3)','Search matches all three deadline notices');
    pass(await search.page.getByRole('searchbox').evaluate(input=>input===document.activeElement),'Search keeps focus while changing view');
    await search.page.getByRole('searchbox').fill('no match at all');
    pass(await search.page.getByRole('heading',{name:'No matching updates'}).count()===1,'Unmatched search has an empty state');
    await search.page.getByRole('searchbox').fill('');
    pass(await search.page.locator('.up-tabs').count()===1,'Clearing by typing restores category tabs');
    await search.page.getByRole('searchbox').fill('deadline');
    await search.page.getByRole('link',{name:/NSFAS 2026 application deadline/}).click();
    await search.page.evaluate(()=>{
      window.testBackWrites=[];
      const push=history.pushState;
      history.pushState=function(...args) {window.testBackWrites.push(args[2]);return push.apply(this,args);};
    });
    await search.page.getByRole('link',{name:'Back to Updates',exact:true}).click();
    pass(await search.page.getByRole('searchbox').inputValue()==='deadline','Back from details restores search');
    pass(await search.page.locator('#updateList .up-card').count()===3,'Back restores search results');
    pass((await search.page.evaluate(()=>window.testBackWrites)).length===0,'Back does not also push a redundant feed navigation');
    await search.page.reload();
    await search.page.getByRole('searchbox').waitFor();
    await search.page.getByRole('searchbox').fill('');
    pass(await search.page.getByRole('link',{name:'Back to Home',exact:true}).getAttribute('href')==='home.html','Clearing a restored search correctly restores the Home destination');
    await search.context.close();

    const stableSearch=await open();
    await stableSearch.page.locator('#updateList .up-card').nth(8).waitFor();
    await stableSearch.page.getByRole('searchbox').fill('deadline');
    await stableSearch.page.locator('#updateList .up-card').first().evaluate(link=>{window.testResultNode=link;});
    await stableSearch.page.getByRole('searchbox').fill('deadlin');
    pass(await stableSearch.page.locator('#updateList .up-card').first().evaluate(link=>link===window.testResultNode),'Search retains result rows when the matching updates are unchanged');
    const stableHref=await stableSearch.page.locator('#updateList .up-card').first().getAttribute('href');
    pass(new URLSearchParams(stableHref.split('?')[1]).get('q')==='deadlin','Reused detail links carry the latest query');
    await stableSearch.page.locator('#updateList .up-card').first().click();
    await stableSearch.page.getByRole('link',{name:'Back to Updates',exact:true}).click();
    pass(await stableSearch.page.getByRole('searchbox').inputValue()==='deadlin','Opening a reused row and going Back restores the latest search');
    await stableSearch.page.getByRole('link',{name:'Filter updates',exact:true}).click();
    await stableSearch.page.getByRole('checkbox',{name:'Deadlines',exact:true}).check();
    await stableSearch.page.getByRole('button',{name:'Apply Filters'}).click();
    pass(await stableSearch.page.getByRole('searchbox').inputValue()==='deadlin','Applying filters preserves the query entered after the search field mounted');
    pass(await stableSearch.page.locator('#updateList .up-card').count()===3,'Updated filter links preserve the matching search results');
    await stableSearch.context.close();

    const filter=await open('#filters');
    await filter.page.getByRole('checkbox',{name:'Deadlines',exact:true}).check();
    await filter.page.getByRole('checkbox',{name:'News',exact:true}).check();
    pass(!(await filter.page.getByRole('checkbox',{name:'All',exact:true}).isChecked()),'Choosing categories unchecks All');
    await filter.page.getByLabel('From',{exact:true}).fill('2025-12-15');
    await filter.page.getByLabel('To',{exact:true}).fill('2025-12-28');
    await filter.page.getByRole('button',{name:'Apply Filters'}).click();
    pass(await filter.page.locator('#updateList .up-card').count()===3,'Combined category and inclusive local date filters work');
    await filter.page.reload();
    await filter.page.locator('#updateList .up-card').nth(2).waitFor();
    pass(await filter.page.locator('#updateList .up-card').count()===3,'Applied filters survive refresh');
    await filter.page.getByRole('link',{name:'Filter updates',exact:true}).click();
    pass(await filter.page.getByRole('checkbox',{name:'Deadlines',exact:true}).isChecked(),'Saved categories are shown in filter editor');
    await filter.page.getByLabel('From',{exact:true}).fill('2026-01-02');
    await filter.page.getByLabel('To',{exact:true}).fill('2025-12-28');
    await filter.page.getByRole('button',{name:'Apply Filters'}).click();
    pass(await filter.page.locator('#filterError').innerText()==='The From date must be on or before the To date.','Reversed dates show a useful validation error');
    await filter.page.getByRole('button',{name:'Reset',exact:true}).click();
    pass(await filter.page.getByRole('checkbox',{name:'All',exact:true}).isChecked(),'Reset returns to All');
    pass(await filter.page.getByLabel('From',{exact:true}).inputValue()==='','Reset clears dates');
    await filter.page.getByRole('button',{name:'Apply Filters'}).click();
    pass(await filter.page.locator('#updateList .up-card').count()===9,'Reset restores full live feed');
    await filter.page.getByRole('link',{name:'Filter updates',exact:true}).click();
    await filter.page.getByRole('checkbox',{name:'News',exact:true}).check();
    await filter.page.getByRole('button',{name:'Apply Filters'}).click();
    pass(await filter.page.locator('#updateList .up-card').count()===1,'A single applied category restricts the feed');
    await filter.page.getByRole('link',{name:'Announcements',exact:true}).click();
    pass(await filter.page.locator('#updateList .up-card').count()===2,'A category tab replaces the prior multi-category restriction');
    await filter.page.getByRole('link',{name:'Back to Updates',exact:true}).click();
    await filter.page.getByRole('link',{name:'All',exact:true}).click();
    pass(await filter.page.locator('#updateList .up-card').count()===9,'The All tab clears category restrictions');
    await filter.context.close();

    const privateItem=await open('#detail/application-test-application');
    await privateItem.page.getByRole('link',{name:/Open Dashboard/}).first().waitFor();
    pass((await privateItem.page.getByRole('link',{name:/Open Dashboard/}).first().getAttribute('href')).endsWith('/Dashboard.html'),'Application actions use the correct case-sensitive dashboard route');
    pass(await privateItem.page.getByRole('button',{name:'Share update'}).count()===0,'Private application notices have no public sharing action');
    pass(JSON.stringify(await privateItem.page.evaluate(()=>window.testReadIds))==='["test-application"]','Only the opened private notice is marked read');
    await privateItem.page.reload();
    await privateItem.page.getByRole('heading',{name:'Your application needs attention'}).waitFor();
    pass(await privateItem.page.getByRole('heading',{name:'Your application needs attention'}).count()===1,'Private deep links resolve after refresh');
    await privateItem.context.close();

    const sharing=await open('#detail/catalog-test-pack?q=private-search');
    await sharing.page.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.testCopied=text;}},configurable:true});});
    await sharing.page.getByRole('button',{name:'Share update'}).click();
    pass((await sharing.page.evaluate(()=>window.testCopied)).endsWith('updates.html#detail/catalog-test-pack'),'Public sharing strips the private search/filter context');
    await sharing.page.getByRole('button',{name:'More update options'}).click();
    pass(await sharing.page.locator('#updateMenu').isVisible(),'Overflow menu opens');
    await sharing.page.keyboard.press('Escape');
    pass(!(await sharing.page.locator('#updateMenu').isVisible()),'Escape closes overflow menu');
    await sharing.context.close();

    const offline=await open('',`window.KagieAPI.getNotificationsAsync=async()=>{if(!window.testRecovered)throw new Error('Offline test');return ${JSON.stringify(notices)};};`);
    await offline.page.getByRole('button',{name:'Try Again',exact:true}).waitFor();
    pass(await offline.page.locator('#updateList .up-card').count()===7,'Partial failure keeps available cached guides and application notices');
    await offline.page.evaluate(()=>{window.testRecovered=true;});
    await offline.page.getByRole('button',{name:'Try Again',exact:true}).click();
    await offline.page.locator('#updateList .up-card').nth(8).waitFor();
    pass(await offline.page.locator('.up-status').count()===0,'Retry restores the feed and clears stale failure feedback');
    await offline.context.close();

    const slow=await open('#filters',`window.KagieAPI.getNotificationsAsync=()=>new Promise(resolve=>{window.testFinishRefresh=()=>resolve(${JSON.stringify(notices)});});`);
    await slow.page.getByRole('checkbox',{name:'News',exact:true}).check();
    await slow.page.getByLabel('From',{exact:true}).fill('2025-12-15');
    await slow.page.evaluate(()=>window.testFinishRefresh());
    await slow.page.waitForTimeout(150);
    pass(await slow.page.getByRole('checkbox',{name:'News',exact:true}).isChecked(),'Background refresh preserves in-progress category edits');
    pass(await slow.page.getByLabel('From',{exact:true}).inputValue()==='2025-12-15','Background refresh preserves in-progress dates');
    await slow.context.close();

    const slowSearch=await open('',`window.KagieAPI.getNotificationsAsync=()=>new Promise(resolve=>{window.testFinishRefresh=()=>resolve(${JSON.stringify(notices)});});`);
    await slowSearch.page.getByRole('searchbox').fill('deadline');
    await slowSearch.page.getByRole('searchbox').evaluate(input=>{window.testSearchNode=input;input.setSelectionRange(2,5,'backward');});
    await slowSearch.page.evaluate(()=>window.testFinishRefresh());
    await slowSearch.page.waitForFunction(()=>document.getElementById('resultsCount')?.textContent==='Results (3)');
    const searchSelection=await slowSearch.page.getByRole('searchbox').evaluate(input=>({same:input===window.testSearchNode,start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection,focused:input===document.activeElement}));
    pass(searchSelection.same,'Background refresh retains the mounted search input');
    pass(searchSelection.start===2 && searchSelection.end===5 && searchSelection.direction==='backward','Background refresh preserves the full text selection');
    pass(searchSelection.focused,'Background refresh keeps the search field focused');
    await slowSearch.context.close();

    const changedContent=await open('',`window.KagieAPI.getUpdateFeed=()=>[${JSON.stringify({...feed[1],message:'Cached document instructions.'})}];window.KagieAPI.getApplicationUpdatesAsync=async()=>[];window.KagieAPI.getNotificationsAsync=()=>new Promise(resolve=>{window.testFinishRefresh=()=>{window.KagieAPI.getUpdateFeed=()=>[${JSON.stringify({...feed[1],message:'Refreshed document instructions.'})}];resolve([]);};});`);
    await changedContent.page.getByRole('searchbox').fill('documents');
    await changedContent.page.evaluate(()=>window.testFinishRefresh());
    await changedContent.page.getByText('Refreshed document instructions.',{exact:true}).waitFor();
    pass(await changedContent.page.getByText('Cached document instructions.',{exact:true}).count()===0,'Refresh replaces changed content even when matching record IDs are unchanged');
    await changedContent.context.close();

    const syncFailure=await open('',`window.KagieAPI.getNotificationsAsync=()=>{throw new Error('Synchronous test failure');};`);
    await syncFailure.page.getByRole('button',{name:'Try Again',exact:true}).waitFor();
    pass(await syncFailure.page.locator('#updateList .up-card').count()===7,'A synchronous feed failure still retains guides and the other refreshed feed');
    await syncFailure.context.close();

    const related=await open('#detail/catalog-test-pack');
    pass(await related.page.locator('.up-related [data-update]').evaluateAll(links=>links.map(link=>link.dataset.update).join(','))==='catalog-test-docs,application-test-application','Related updates prefer the same category, then keep chronological order');
    await related.context.close();

    const concurrentRead=await open('#detail/application-test-application',`window.KagieAPI.getApplicationUpdates=()=>[${JSON.stringify(application)}];window.KagieAPI.getApplicationUpdatesAsync=()=>new Promise(resolve=>{window.testFinishApplications=()=>resolve([${JSON.stringify(application)}]);});window.testReadCalls=0;window.KagieAPI.markApplicationUpdateReadAsync=()=>{window.testReadCalls++;return new Promise(resolve=>{window.testFinishRead=()=>resolve(true);});};`);
    await concurrentRead.page.waitForFunction(()=>window.testReadCalls===1);
    await concurrentRead.page.evaluate(()=>window.testFinishApplications());
    await concurrentRead.page.waitForTimeout(150);
    pass(await concurrentRead.page.evaluate(()=>window.testReadCalls)===1,'Cached and refreshed details share one pending read-status request');
    await concurrentRead.page.evaluate(()=>window.testFinishRead());
    await concurrentRead.page.getByRole('link',{name:'Back to Updates',exact:true}).click();
    await concurrentRead.page.getByRole('link',{name:/Your application needs attention/}).click();
    pass(await concurrentRead.page.evaluate(()=>window.testReadCalls)===1,'Reopening a successfully read notice does not repeat the write');
    await concurrentRead.context.close();

    const invalidDates=await open('#?from=2025-02-30&to=2025-13-01');
    await invalidDates.page.locator('#updateList .up-card').nth(8).waitFor();
    pass(await invalidDates.page.locator('#updateList .up-card').count()===9,'Impossible date URL parameters do not silently hide the feed');
    await invalidDates.page.getByRole('link',{name:'Filter updates',exact:true}).click();
    pass(await invalidDates.page.getByLabel('From',{exact:true}).inputValue()==='' && await invalidDates.page.getByLabel('To',{exact:true}).inputValue()==='','Invalid date links leave date controls consistent with the displayed feed');
    await invalidDates.context.close();

    const malicious=await open('#detail/catalog-test-evil',`window.KagieAPI.getUpdateFeed=()=>[{id:'test-evil',source:'catalog',title:'<img src=x onerror=alert(1)>',message:'<script>window.testInjected=true</script>',category:'constructor',ctaHref:'javascript:alert(1)',imageUrl:'data:image/svg+xml,<svg onload=alert(1) />'}];window.KagieAPI.getApplicationUpdatesAsync=async()=>[];window.KagieAPI.getNotificationsAsync=async()=>[];`);
    pass(await malicious.page.locator('.up-detail__heading h2').innerText()==='<img src=x onerror=alert(1)>','Publisher titles are escaped');
    pass(await malicious.page.locator('.up-detail__photo,.up-detail__action').count()===0,'Unsafe image and action schemes are rejected');
    pass(!(await malicious.page.evaluate(()=>window.testInjected)),'Publisher text cannot inject executable markup');
    pass(await malicious.page.locator('.up-detail__article').evaluate(article=>article.classList.contains('up-tone-announcement')),'Unknown category names cannot resolve inherited object properties');
    await malicious.context.close();

    const duplicate=await open('',`window.KagieAPI.getUpdateFeed=()=>[${JSON.stringify({...notices[0],source:'notification',category:'deadline'})}];window.KagieAPI.getApplicationUpdatesAsync=async()=>[];`);
    await duplicate.page.locator('#updateList .up-card').nth(1).waitFor();
    pass(await duplicate.page.locator('#updateList .up-card').count()===2,'Notification records already in the base feed are deduplicated');
    await duplicate.context.close();

    const absent=await open('#detail/missing-record');
    pass(await absent.page.getByRole('heading',{name:'Update unavailable'}).count()===1,'Removed and inaccessible updates have a clear fallback');
    await absent.context.close();
    const signedOut=await open('','',false);
    await signedOut.page.waitForURL('**/login.html?app=1');
    pass(signedOut.page.url().includes('login.html'),'Signed-out learners are redirected after session resolution');
    await signedOut.context.close();
    pass(errors.length===0,'No uncaught browser errors: '+errors.join(', '));
    pass(missing.length===0,'No missing local assets: '+missing.join(', '));
    const summary={checks,widths:[320,390,768,1024,1440],views:views.length,browserErrors:errors,missingAssets:missing,fixtureDataOnly:true};
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(summary,null,2));
    console.log('PASS '+checks+' Updates checks across six views and five widths.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
