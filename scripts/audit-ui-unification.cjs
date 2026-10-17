// Read-only frontend review. All identities and backend data are local fixtures.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { start } = require('./admin-test-server.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/ui-unification/browser');
const viewportNames = {
  phone: {width:390,height:844},
  tablet: {width:768,height:1024},
  desktop: {width:1440,height:1000}
};
const pageCases = [
  ['Landing','/index.html','public'],
  ['Login','/login.html?app=1','public'],
  ['Signup','/signup.html','public'],
  ['Password recovery','/forgot-password.html','public'],
  ['About','/about.html','public'],
  ['Privacy','/privacy.html','public'],
  ['Terms','/terms.html','public'],
  ['Android download','/android-app.html','public'],
  ['Home','/home.html','learner'],
  ['Dashboard','/Dashboard.html','learner'],
  ['Apply','/forms.html','learner'],
  ['Cart','/cart.html','learner'],
  ['Checkout','/checkout.html','learner'],
  ['Profile','/profile.html','learner'],
  ['Documents','/documents.html','learner'],
  ['Upload','/upload.html','learner'],
  ['Notifications','/notifications.html','learner'],
  ['Career hub','/career-guidance.html','learner'],
  ['Question papers','/question-papers.html','learner'],
  ['Institutions','/institutions.html','learner'],
  ['Course matching','/recommendation.html','learner'],
  ['Prospectus','/prospectus.html','learner'],
  ['Personal assistance','/personal-assistance.html','learner'],
  ['Services','/more-service/index.html','learner'],
  ['Housing','/more-service/accommodation-assist.html','learner'],
  ['Transport','/more-service/transport-assist.html','learner'],
  ['Funding','/more-service/funding-assist.html','learner'],
  ['Re-application','/more-service/re-apply.html','learner'],
  ['Change email','/more-service/change-email.html','learner'],
  ['Forgot PIN','/more-service/forgot-pin.html','learner'],
  ['Forgot student number','/more-service/forgot-student-number.html','learner'],
  ['Master dashboard','/master-admin/dashboard.html','master'],
  ['Assistant dashboard','/assistant/dashboard.html?page=assigned','assistant'],
  ['Master applications','/master-admin/dashboard.html?page=applications','master'],
  ['Assistant applicant','/assistant/applicant-view.html','assistant'],
  ['Master documents','/master-admin/dashboard.html?page=documents','master'],
  ['Master payments','/master-admin/dashboard.html?page=payments','master'],
  ['Master support','/master-admin/dashboard.html?page=support','master'],
  ['Cart populated','/cart.html','learner'],
  ['Checkout populated','/checkout.html','learner'],
  ['Institution administration','/institutions.html','master'],
  ['Paper administration','/question-papers.html','master'],
  ['Assistant access','/master-admin/dashboard.html?page=assistants','master'],
  ['Not found','/404.html','public'],
  ['Account deletion information','/account-deletion.html','public'],
  ['Change password','/changepassword.html','learner'],
  ['Language preference','/language.html','learner'],
  ['Updates','/updates.html','learner'],
  ['Bursaries','/more-service/available-bursaries.html','learner'],
  ['Funding checklist','/more-service/funding-checklist.html','learner'],
  ['Funding guide','/more-service/funding-guide.html','learner'],
  ['Funding requirements','/more-service/funding-requirements.html','learner'],
  ['Funding support','/more-service/funding-support.html','learner'],
  ['Help support','/more-service/help-support.html','learner'],
  ['Assistant document review','/assistant/documents-review.html','assistant'],
  ['Master application workspace','/master-admin/application-view.html','master'],
  ['User administration','/admin/users/index.html','master']
];
function walk(folder, extensions) {
  const result = [];
  for(const item of fs.readdirSync(path.join(root, folder),{withFileTypes:true})) {
    const relative = path.posix.join(folder, item.name);
    if(item.isFile() && extensions.includes(path.extname(item.name))) result.push(relative);
    else if(item.isDirectory()) result.push(...walk(relative, extensions));
  }
  return result;
}
function inventory() {
  const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html')).concat(...['assistant','master-admin','more-service','admin'].map(folder=>walk(folder,['.html'])));
  const styles = walk('css',['.css']);
  const screens = walk('kagie-web/src',['.tsx']).concat(walk('kagie-mobile/src',['.tsx']),walk('kagie-landing/src',['.tsx']));
  const matchAll = (source, regex, group=1) => [...source.matchAll(regex)].map(match=>match[group]);
  const pages = htmlFiles.map(file => {
    const html = fs.readFileSync(path.join(root,file),'utf8');
    const inlineStyles = matchAll(html, /<style[^>]*>([\s\S]*?)<\/style>/gi);
    return {file,title:html.match(/<title>([^<]*)<\/title>/i)?.[1],bytes:Buffer.byteLength(html),inlineStyleBytes:inlineStyles.reduce((sum,css)=>sum+Buffer.byteLength(css),0),
      styles:matchAll(html, /<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi),scripts:matchAll(html, /<script[^>]+src=["']([^"']+)["']/gi),
      headings:matchAll(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi).map(value=>value.replace(/<[^>]*>/g,'').trim()).filter(Boolean).slice(0,16),
      links:[...new Set(matchAll(html, /href=["']([^"']+\.html[^"']*)["']/gi))],
      fixedShells:matchAll(inlineStyles.join('\n'), /(?:width|max-width)\s*:\s*(?:min\()?\s*(\d+)px/gi).filter(value=>Number(value)<=540),
      fontFamilies:[...new Set(matchAll(inlineStyles.join('\n'), /font-family\s*:\s*([^;}]+)/gi))],
      inlineStyleAttributes:matchAll(html, /\bstyle=["']([^"']*)["']/gi).length,
      mediaQueries:matchAll(inlineStyles.join('\n'), /@media\s*([^\{]+)\{/gi).map(value=>value.trim())};
  });
  const result = {createdAt:new Date().toISOString(),pages,styles,screens};
  fs.writeFileSync(path.join(out,'source-inventory.json'),JSON.stringify(result,null,2));
  console.log('Inventory: '+pages.length+' HTML routes, '+styles.length+' stylesheets, '+screens.length+' component files');
}
async function main() {
  fs.mkdirSync(out,{recursive:true});
  inventory();
  if(process.argv.includes('--inventory-only')) return;
  const harness = await start();
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const additional = process.argv.includes('--additional');
  const remaining = process.argv.includes('--remaining');
  const layoutCheck = process.argv.includes('--layout-check');
  const prior = path.join(out,'browser-review.json');
  const rows = (additional || remaining || process.argv.includes('--core-only')) && fs.existsSync(prior) ? JSON.parse(fs.readFileSync(prior,'utf8')).pages : [];
  const finalFocused = process.argv.includes('--core-only');
  const cases = finalFocused ? pageCases.filter(([name])=>['Home','Dashboard','Apply','Cart','Checkout','Profile','Personal assistance','Notifications','Landing','Master dashboard','Assistant dashboard'].includes(name)) : layoutCheck ? pageCases.filter(([name]) => ['About','Terms','Checkout populated'].includes(name)) : remaining ? pageCases.slice(-8) : additional ? pageCases.slice(-13,-8) : pageCases;
  if(finalFocused) for(let i=rows.length-1;i>=0;i--) if(cases.some(([name])=>name===rows[i].name)) rows.splice(i,1);
  try {
    for(const [name, originalRoute, role] of cases) {
      for(const [viewportName,viewport] of Object.entries(viewportNames)) {
        if(layoutCheck && viewportName==='desktop') continue;
        const context = await browser.newContext({viewport,serviceWorkers:'block'});
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if(url.hostname === '127.0.0.1') return route.continue();
          if(url.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
          return route.fulfill({status:200,body:'',contentType:'text/css'});
        });
        await context.route('**/js/supabase-config.js*', route => {
          if(role === 'public') return route.fulfill({contentType:'text/javascript',body:'window.KagieAPI.configureSupabase({enabled:false});'});
          return route.fulfill({contentType:'text/javascript',body:`const client=window.KagieAPI.configureSupabase({enabled:true,url:${JSON.stringify(harness.base)},anonKey:'test-anon'});window.KagieAPI.setLoginPersistence(true);const establishTestIdentity=()=>client.auth.setSession({access_token:${JSON.stringify(harness.ids[role+'Token'])},refresh_token:'local-test-refresh'});const originalRestore=window.KagieAPI.restoreSession;window.KagieAPI.restoreSession=async function(){await establishTestIdentity();return originalRestore();};const originalResolve=window.KagieAPI.resolveSessionUser;window.KagieAPI.resolveSessionUser=async function(...args){await establishTestIdentity();return originalResolve(...args);};`});
        });
        if(role !== 'public') await context.addInitScript(({id,role,applicationId,populated}) => {
          const user = {id,role:role==='learner'?'user':role==='master'?'master_admin':'assistant_admin',fullName:'Review Learner',name:'Review Learner',email:role+'@test.invalid',phone:'0711234567',profile:{}};
          localStorage.setItem('kagie_users',JSON.stringify([user]));
          localStorage.setItem('kagie_current_user',JSON.stringify(user));
          if(populated) localStorage.setItem('kagie_cart_'+id,JSON.stringify([{id:'review-package',clientKey:'review-package',type:'application_pack',name:'Starter application package',packName:'Starter application package',price:250,packPrice:250,institutionLimit:10,quantity:1,applicationId,applicationType:'undergraduate',applicationTypeLabel:'Undergraduate Applications',syncState:'local',createdAt:new Date().toISOString()}]));
        },{id:harness.ids[role],role,applicationId:harness.app,populated:name.includes('populated')});
        const page = await context.newPage();
        const errors = [], failedLocal = [];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('response',res=>{if(res.status()>=400 && res.url().includes(harness.base))failedLocal.push({url:res.url().replace(harness.base,''),status:res.status()});});
        let route = originalRoute;
        if(['Assistant applicant','Master application workspace'].includes(name)) route += '?id='+harness.app+'&tab=profile';
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+viewportName;
        try {
          await page.goto(harness.base+route,{waitUntil:'domcontentloaded',timeout:20000});
          if(role !== 'public') await page.waitForFunction(()=>window.KagieAPI?.currentUser?.()?.id,null,{timeout:7000}).catch(()=>{});
          await page.waitForTimeout(1200);
          const findings = await page.evaluate(() => {
            const visible = node => {const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0&&getComputedStyle(node).visibility!=='hidden';};
            const label = node => (node.getAttribute('aria-label') || node.innerText || node.value || node.id || node.tagName).trim().replace(/\s+/g,' ').slice(0,100);
            const controls = [...document.querySelectorAll('button,a,input,select,textarea')].filter(visible);
            const shells = [...document.querySelectorAll('.app,.app-shell,.shell,.main,.container,.checkout-shell,.checkout-layout')].filter(visible).map(node=>({selector:node.className,width:Math.round(node.getBoundingClientRect().width)}));
            return {title:document.title,path:location.pathname,heading:[...document.querySelectorAll('h1,h2')].filter(visible).map(node=>node.innerText).slice(0,8),bodyText:document.body.innerText.slice(0,11000),viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,
              shells,bodyFont:getComputedStyle(document.body).fontFamily,designTokens:{primary:getComputedStyle(document.body).getPropertyValue('--kagie-primary').trim(),background:getComputedStyle(document.body).backgroundColor,ink:getComputedStyle(document.body).color,cardRadius:getComputedStyle(document.body).getPropertyValue('--kagie-radius').trim(),controlRadius:getComputedStyle(document.body).getPropertyValue('--kagie-control-radius').trim()},
              componentStyles:controls.filter(node=>node.matches('.btn,.mini,.service-button,.staff-btn,.button,.app-action,.primary-button')).slice(0,8).map(node=>({label:label(node),background:getComputedStyle(node).backgroundColor,radius:getComputedStyle(node).borderRadius,font:getComputedStyle(node).fontFamily,height:Math.round(node.getBoundingClientRect().height)})),
              smallInputs:controls.filter(node=>node.matches('input:not([type="checkbox"]):not([type="radio"]),select,textarea')&&parseFloat(getComputedStyle(node).fontSize)<16).map(label).slice(0,20),
              shortControls:controls.filter(node=>node.getBoundingClientRect().height<44).map(label).slice(0,20),
              unnamedControls:controls.filter(node=>node.matches('button,a')&&!node.innerText.trim()&&!node.getAttribute('aria-label')&&!node.getAttribute('title')).map(node=>node.id||node.className).slice(0,12),
              imagesWithoutAlt:[...document.images].filter(node=>visible(node)&&!node.hasAttribute('alt')).map(node=>node.src.split('/').pop()).slice(0,10),
              brokenImages:[...document.images].filter(node=>visible(node)&&node.complete&&!node.naturalWidth).map(node=>node.src.split('/').pop()).slice(0,10),
              nav:[...document.querySelectorAll('.bottom-nav a,.nav-btn,.nav-link')].filter(visible).map(label).slice(0,24),domNodes:document.querySelectorAll('*').length};
          });
          if(layoutCheck) {
            // Isolate structural layout defects from missing external icon fonts.
            // This style is applied only in the test browser, never to product files.
            await page.addStyleTag({content:'.material-icons,.material-icons-outlined,.material-symbols-rounded,.material-symbols-outlined {display:inline-block!important;width:24px!important;min-width:24px!important;font-size:0!important;line-height:24px!important;}'});
            const geometry = await page.evaluate(() => ({pageWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.right>innerWidth+1&&getComputedStyle(node).visibility!=='hidden';}).map(node=>({tag:node.tagName,selector:node.id || node.className,right:Math.round(node.getBoundingClientRect().right),width:Math.round(node.getBoundingClientRect().width)})).slice(0,20)}));
            rows.push({name,viewport:viewport.width,beforeIconNormalization:findings.pageWidth,afterIconNormalization:geometry.pageWidth,overflow:geometry.overflow});
            await context.close();
            continue;
          }
          // Capture the actual local render; absent Google fonts are recorded as a limitation.
          await page.screenshot({path:path.join(out,slug+'.png'),fullPage:false});
          rows.push({name,route,role,viewportName,screenshot:slug+'.png',...findings,errors,failedLocal});
          if(name.includes('populated')) await page.screenshot({path:path.join(out,slug+'-full.png'),fullPage:true});
        } catch(error) {rows.push({name,route,role,viewport:viewportName,reviewFailure:error.message,errors,failedLocal});}
        await context.close();
      }
      console.log('Reviewed '+name+' at phone, tablet and desktop sizes');
      fs.writeFileSync(path.join(out,layoutCheck?'layout-diagnostics.json':'browser-review.json'),JSON.stringify({reviewedAt:new Date().toISOString(),environment:'Local Chrome, isolated synthetic identities and SQL fixtures; external network content unavailable; no submitted forms or production writes',pages:rows},null,2));
    }
  } finally {await browser.close();await harness.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
