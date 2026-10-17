// Isolated local learner fixtures. No production services are contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const data = require('../js/recommendation-data.js');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'reports/recommendation-design');
fs.mkdirSync(output,{recursive:true});
const marks = [{subject:'English Home Language',percent:72},{subject:'Mathematics',percent:64},{subject:'Life Sciences',percent:58},{subject:'Geography',percent:61},{subject:'Business Studies',percent:67},{subject:'Life Orientation',percent:80}];
const learner = {id:'recommendation-test-learner',role:'user',fullName:'Sarah Learner',email:'sarah@test.invalid',profile:{marks}};
const favorites = ['c3','c6','c11'].map(id=>{
  const course=data.courses.find(course=>course.id===id);
  return {id:'test-favorite-'+id,userId:learner.id,type:'course',institutionName:course.institution,course:course.courseName,faculty:course.faculty,province:course.province,year:String(new Date().getFullYear())};
});
const config = `window.KagieAPI.configureSupabase({enabled:false});window.KagieAPI.resolveSessionUser=async()=>window.KagieAPI.currentUser();window.KagieAPI.getProfileAsync=async id=>window.KagieAPI.getProfile(id);`;
function seed(user) {
  if (!localStorage.getItem('kagie_current_user')) {
    localStorage.setItem('kagie_users',JSON.stringify([user]));
    localStorage.setItem('kagie_current_user',JSON.stringify(user));
  }
}
const preview = process.argv.includes('--preview');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file; try { file=path.resolve(root,'.'+decodeURIComponent(pathname)); } catch { res.writeHead(400);res.end();return; }
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404);res.end();return; }
  res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
  if (preview && pathname==='/js/supabase-config.js') { res.end(config);return; }
  let body=fs.readFileSync(file);
  if (preview && pathname==='/recommendation.html') body=body.toString().replace('<head>',`<head><script>(${seed})(${JSON.stringify(learner)});if(!localStorage.getItem('kagie_favorites'))localStorage.setItem('kagie_favorites',JSON.stringify(${JSON.stringify(favorites)}));if(!localStorage.getItem('kagie_recommendation_preferences:'+${JSON.stringify(learner.id)}))localStorage.setItem('kagie_recommendation_preferences:'+${JSON.stringify(learner.id)},JSON.stringify({interests:['Technology','Education'],comparison:['c3','c6']}));</script>`);
  res.end(body);
});
let checks=0;
const pass=(value,label)=>{assert.ok(value,label);checks++;};
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],missing=[];
  async function open(hash='',scenario='',signedIn=true,seedFavorites=true) {
    const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block',timezoneId:'Africa/Johannesburg'});
    if (signedIn) await context.addInitScript(({user,favorites,seedFavorites})=>{
      if (!localStorage.getItem('kagie_current_user')) {
        localStorage.setItem('kagie_users',JSON.stringify([user]));localStorage.setItem('kagie_current_user',JSON.stringify(user));
        if(seedFavorites)localStorage.setItem('kagie_favorites',JSON.stringify(favorites));
        localStorage.setItem('kagie_recommendation_preferences:'+user.id,JSON.stringify({interests:['Technology','Education'],comparison:seedFavorites?['c3','c6']:[]}));
      }
    },{user:learner,favorites,seedFavorites});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if (url.hostname!=='127.0.0.1') return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if (url.pathname==='/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:config+scenario});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()===404 && response.url().startsWith(base))missing.push(response.url());});
    await page.goto(base+'/recommendation.html'+hash,{waitUntil:'domcontentloaded'});
    if(signedIn)await page.waitForFunction(()=>document.getElementById('recommendationContent')?.getAttribute('aria-busy')==='false');
    return {page,context};
  }
  try {
    // Verify the server immediately, before any other work.
    const smoke=await open();
    pass(await smoke.page.getByRole('heading',{name:/Hi Sarah/}).count()===1,'Home shows the signed-in learner');
    await smoke.page.getByRole('link',{name:/View Recommendations/}).click();
    await smoke.page.locator('.rc-course').first().waitFor();
    await smoke.page.getByRole('link',{name:/Bachelor of Education/}).click();
    pass(await smoke.page.getByRole('heading',{name:'Course Details',exact:true}).count()===1,'Course list opens details');
    pass(await smoke.page.locator('.rc-campus img').evaluate(image=>image.complete && image.naturalWidth>0),'Campus illustration loads');
    await smoke.page.getByRole('link',{name:'Back',exact:true}).click();
    await smoke.page.getByRole('heading',{name:'Recommended Courses',exact:true}).waitFor();
    pass(errors.length===0,'Smoke has no uncaught errors');
    console.log('Smoke passed: home, matches, details, image, Back.');
    await smoke.context.close();
    if(preview){console.log('Local synthetic course preview: '+base+'/recommendation.html');return;}

    const responsive=await open();
    const views=['#home','#marks','#interests','#courses','#course/c3','#saved','#analytics','#compare','#institutions/c3','#course/c3?tab=requirements','#course/c3?tab=subjects','#course/c3?tab=career','#analytics?tab=strengths','#analytics?tab=insights','#saved?mode=compare'];
    for(const hash of views) {
      await responsive.page.goto(base+'/recommendation.html'+hash,{waitUntil:'domcontentloaded'});
      await responsive.page.waitForFunction(()=>document.getElementById('recommendationContent')?.getAttribute('aria-busy')==='false');
      for(const width of [320,390,768,1024,1440]) {
        await responsive.page.setViewportSize({width,height:1000});
        const geometry=await responsive.page.evaluate(()=>({width:document.documentElement.scrollWidth,inputSizes:[...document.querySelectorAll('input:not([type=checkbox]),select')].map(input=>parseFloat(getComputedStyle(input).fontSize)),nav:[...document.querySelectorAll('.kagie-shared-bottom-nav a')].map(link=>link.getAttribute('href')),active:document.querySelector('.kagie-shared-bottom-nav [aria-current=page]')?.getAttribute('href')}));
        pass(geometry.width<=width,hash+' fits '+width+' px');
        pass(geometry.inputSizes.every(size=>size>=16),'Inputs avoid mobile zoom');
        pass(JSON.stringify(geometry.nav)===JSON.stringify(['home.html','career-guidance.html','recommendation.html','more-service/accommodation-assist.html','more-service/transport-assist.html']),'Shared app footer destinations retained');
        pass(geometry.active==='recommendation.html','Course section is the active app destination');
        if([390,768,1440].includes(width))await responsive.page.screenshot({path:path.join(output,hash.replace(/[#/?=&]/g,'-')+'-'+width+'.png'),fullPage:true});
      }
    }
    await responsive.context.close();

    const journey=await open('#marks');
    await journey.page.getByLabel('Percentage for subject 1',{exact:true}).fill('101');
    await journey.page.getByRole('button',{name:/Calculate & Recommend/}).click();
    pass((await journey.page.locator('#marksError').innerText()).includes('0 to 100'),'Invalid marks have a clear error');
    await journey.page.getByLabel('Percentage for subject 1',{exact:true}).fill('73');
    await journey.page.getByLabel('Subject 2',{exact:true}).selectOption('English Home Language');
    await journey.page.getByRole('button',{name:/Calculate & Recommend/}).click();
    pass((await journey.page.locator('#marksError').innerText()).includes('only be added once'),'Duplicate subjects are rejected');
    await journey.page.getByLabel('Subject 2',{exact:true}).selectOption('Mathematics');
    await journey.page.getByRole('button',{name:/Calculate & Recommend/}).click();
    await journey.page.getByRole('heading',{name:'Preferred Fields',exact:true}).waitFor();
    pass(await journey.page.evaluate(()=>KagieAPI.getProfile(KagieAPI.currentUser().id).marks[0].percent)===73,'Edited marks save through the existing profile API');
    await journey.page.getByRole('button',{name:'Business',exact:true}).click();
    pass(await journey.page.getByRole('button',{name:'Business',exact:true}).getAttribute('aria-pressed')==='true','Interest selection is reflected accessibly');
    await journey.page.getByRole('button',{name:'Continue',exact:true}).click();
    await journey.page.getByRole('heading',{name:'Recommended Courses',exact:true}).waitFor();
    await journey.page.reload();
    await journey.page.getByRole('heading',{name:'Recommended Courses',exact:true}).waitFor();
    pass(await journey.page.evaluate(()=>KagieAPI.getProfile(KagieAPI.currentUser().id).marks[0].percent)===73,'Entered marks survive reload on this device');
    pass(await journey.page.evaluate(()=>JSON.parse(localStorage.getItem('kagie_recommendation_preferences:'+KagieAPI.currentUser().id)).interests.includes('Business')),'Interests survive reload for the learner');
    await journey.page.getByRole('button',{name:'Search courses',exact:true}).click();
    await journey.page.getByRole('searchbox').fill('education');
    pass(await journey.page.locator('.rc-course').count()===1,'Course search filters locally');
    pass(await journey.page.getByRole('searchbox').evaluate(input=>input===document.activeElement),'Search keeps focus');
    await journey.page.getByRole('link',{name:/Bachelor of Education/}).click();
    await journey.page.getByRole('link',{name:'Requirements',exact:true}).click();
    pass(await journey.page.getByRole('heading',{name:'Entry guidance'}).count()===1,'Detail tabs display course information');
    await journey.page.reload();
    pass(await journey.page.getByRole('heading',{name:'Entry guidance'}).count()===1,'Course and selected detail tab survive reload');
    await journey.page.getByRole('link',{name:'View Matched Institutions',exact:true}).click();
    pass(await journey.page.getByRole('heading',{name:'University of Zululand',exact:true}).count()===1,'Matched institution view works');
    pass(await journey.page.getByRole('link',{name:/Plan Application/}).getAttribute('href')==='forms.html','Application action reaches the real Apply flow');
    await journey.context.close();

    const saves=await open('#courses','',true,false);
    await saves.page.getByRole('button',{name:'Save Bachelor of Education',exact:true}).click();
    await saves.page.getByRole('button',{name:'Unsave Bachelor of Education',exact:true}).waitFor();
    await saves.page.reload();
    pass(await saves.page.getByRole('button',{name:'Unsave Bachelor of Education',exact:true}).count()===1,'Saved courses survive reload');
    pass(await saves.page.evaluate(()=>KagieAPI.getFavorites().filter(item=>item.course==='Bachelor of Education').length)===1,'Course save appears once in the shared shortlist');
    await saves.page.getByRole('button',{name:'Unsave Bachelor of Education',exact:true}).click();
    await saves.page.getByRole('button',{name:'Save Bachelor of Education',exact:true}).waitFor();
    pass(await saves.page.evaluate(()=>KagieAPI.getFavorites().length)===0,'Unsave removes the shared favorite');
    await saves.context.close();

    const compare=await open('#saved?mode=compare');
    await compare.page.getByLabel('Compare BSc Agriculture',{exact:true}).click();
    pass((await compare.page.locator('#compareError').innerText()).includes('two'),'Comparison is limited to two courses');
    await compare.page.getByRole('button',{name:/Compare Selected Courses/}).click();
    pass(await compare.page.locator('table tbody tr').count()===7,'Comparison shows all meaningful guidance fields');
    await compare.page.reload();
    pass(await compare.page.locator('.rc-compare-course').count()===2,'Comparison selection survives reload');
    await compare.page.getByRole('button',{name:/Remove Bachelor of Education from comparison/}).click();
    pass(await compare.page.getByRole('button',{name:/Compare Selected Courses/}).isDisabled(),'Removing a comparison course updates the selection');
    await compare.context.close();

    const blank=await open('#marks',`window.KagieAPI.getProfile=()=>({marks:[]});`);
    await blank.page.getByRole('button',{name:'Clear All',exact:true}).click();
    await blank.page.getByRole('button',{name:/Calculate & Recommend/}).click();
    pass((await blank.page.locator('#marksError').innerText()).includes('at least one'),'An empty mark form cannot produce fictional results');
    await blank.page.getByRole('button',{name:'Add Another Subject',exact:true}).click();
    pass(await blank.page.locator('.rc-mark-row').count()===1,'An empty profile can start adding subjects');
    await blank.context.close();

    const slow=await open('#marks',`window.KagieAPI.getProfileAsync=()=>new Promise(resolve=>{window.testFinishProfile=()=>resolve({marks:${JSON.stringify(marks)}});});`);
    await slow.page.getByLabel('Percentage for subject 1',{exact:true}).fill('88');
    await slow.page.evaluate(()=>window.testFinishProfile());
    await slow.page.waitForTimeout(100);
    pass(await slow.page.getByLabel('Percentage for subject 1',{exact:true}).inputValue()==='88','Background profile refresh preserves edited marks');
    await slow.context.close();

    const staleFavorites=await open('#courses',`window.KagieAPI.getFavoritesAsync=()=>new Promise(resolve=>{window.testFinishFavorites=()=>resolve([]);});`,true,false);
    await staleFavorites.page.getByRole('button',{name:'Save Bachelor of Education',exact:true}).click();
    await staleFavorites.page.getByRole('button',{name:'Unsave Bachelor of Education',exact:true}).waitFor();
    await staleFavorites.page.evaluate(()=>window.testFinishFavorites());
    await staleFavorites.page.getByRole('link',{name:'Saved Courses',exact:true}).click();
    pass(await staleFavorites.page.locator('.rc-saved-course').count()===1,'A stale background favorite read cannot overwrite a new save');
    await staleFavorites.context.close();

    const sharing=await open('#course/c3?q=private-search&filter=high');
    await sharing.page.evaluate(()=>{
      Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.testShared=text;}},configurable:true});
    });
    await sharing.page.getByRole('button',{name:'Share course',exact:true}).click();
    pass((await sharing.page.evaluate(()=>window.testShared)).endsWith('recommendation.html#course/c3'),'Shared course links omit private search and filter context');
    await sharing.context.close();

    const identity=await open('#saved');
    await identity.page.evaluate(()=>{
      const other={id:'other-test-learner',role:'user',fullName:'Other Learner',email:'other@test.invalid',profile:{marks:[]}};
      sessionStorage.removeItem('kagie_current_user');
      localStorage.setItem('kagie_users',JSON.stringify([other]));localStorage.setItem('kagie_current_user',JSON.stringify(other));
    });
    await identity.page.reload();
    await identity.page.getByRole('heading',{name:'No saved courses yet'}).waitFor();
    pass(await identity.page.locator('.rc-saved-course').count()===0,'Another learner cannot see the prior learner’s saved courses');
    await identity.context.close();

    const missingCourse=await open('#course/missing');
    pass(await missingCourse.page.getByRole('heading',{name:'Course unavailable'}).count()===1,'Unknown course links have a clear fallback');
    await missingCourse.context.close();
    const signedOut=await open('','',false);
    await signedOut.page.waitForURL('**/login.html?app=1');
    pass(signedOut.page.url().includes('login.html'),'Signed-out learners redirect only after session resolution');
    await signedOut.context.close();
    pass(errors.length===0,'No uncaught browser errors: '+errors.join(', '));
    pass(missing.length===0,'No missing local assets: '+missing.join(', '));
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({checks,widths:[320,390,768,1024,1440],views:views.length,errors,missing,syntheticDataOnly:true},null,2));
    console.log('PASS '+checks+' recommendation browser checks.');
  } finally {
    await browser.close();
    if(!preview)await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
