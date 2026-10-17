// Local browser regression checks. No production data, emails or payments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'reports/more-services-design');
fs.mkdirSync(output,{recursive:true});
const learner = {id:'service-test-learner',role:'user',fullName:'Test Learner',email:'learner@test.invalid',phone:'0712345678',profile:{}};
const funding = [
  {id:'test-nsfas',status:'published',title:'NSFAS',company:'National Student Financial Aid Scheme',summary:'Synthetic funding record for UI verification.',category:'Government',tags:['NSFAS','All Universities'],body:'Test-only funding information.\n\nNo actual funding offer is represented.',requirements:['Test academic requirement','Test identity documents'],closingDate:'2029-01-12',applicationUrl:'https://example.com/test-funding'},
  {id:'test-funza',status:'published',title:'Funza Lushaka',company:'Test provider',summary:'Synthetic teaching bursary record.',category:'Government',tags:['Bursary','Education','Universities'],closingDate:'2029-01-10'},
  {id:'test-huawei',status:'published',title:'Huawei Bursary',company:'Test provider',summary:'Synthetic ICT and engineering record.',category:'Private',tags:['Selected Universities'],closingDate:'2029-02-15'},
  {id:'test-sasol',status:'published',title:'Sasol Bursary',company:'Test provider',summary:'Synthetic science and engineering record.',category:'Private',tags:['Selected Universities'],closingDate:'2029-02-28'},
  {id:'test-picknpay',status:'published',title:'Pick n Pay Bursary',company:'Test provider',summary:'Synthetic retail and business record.',category:'Private',tags:['Selected Universities'],closingDate:'2020-01-01'},
  {id:'test-draft',status:'draft',title:'Hidden draft funding',category:'Bursary',tags:[]},
  {id:'test-job',status:'published',title:'Test job',category:'Jobs',tags:[]}
];
const testConfig = `window.KagieAPI.configureSupabase({enabled:false});window.KagieAPI.resolveSessionUser=async()=>window.KagieAPI.currentUser();window.KagieAPI.getCareerArticlesAsync=async()=>${JSON.stringify(funding)};`;
const pages = ['index.html','funding-assist.html','available-bursaries.html','bursary-details.html?id=test-nsfas','funding-checklist.html','funding-guide.html','funding-requirements.html','funding-support.html','change-email.html','re-apply.html','re-apply.html?request=correction','forgot-pin.html','forgot-student-number.html','help-support.html'];
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
let checks = 0;
const pass = (condition,message) => {assert.ok(condition,message);checks++;};
const server = http.createServer((req,res) => {
  const pathname=new URL(req.url,'http://localhost').pathname;
  let file;
  try {file=path.resolve(root,'.'+decodeURIComponent(pathname));} catch {res.writeHead(400);res.end();return;}
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
  if(process.argv.includes('--preview') && pathname==='/js/supabase-config.js') {res.end(testConfig);return;}
  let body=fs.readFileSync(file);
  if(process.argv.includes('--preview') && pathname.startsWith('/more-service/') && pathname.endsWith('.html')) {
    body=body.toString().replace('<head>',`<head><script>localStorage.setItem('kagie_users',JSON.stringify([${JSON.stringify(learner)}]));localStorage.setItem('kagie_current_user',JSON.stringify(${JSON.stringify(learner)}));</script>`);
  }
  res.end(body);
});
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  if(process.argv.includes('--preview')) {console.log('Local synthetic preview: '+base+'/more-service/index.html');return;}
  const errors=[], local404=[];
  const browser=await chromium.launch({channel:'chrome',headless:true});
  async function open(route='index.html',signedIn=true,scenario='') {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true});
    if(signedIn) await context.addInitScript(user=>{localStorage.setItem('kagie_users',JSON.stringify([user]));localStorage.setItem('kagie_current_user',JSON.stringify(user));},{...learner});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='127.0.0.1') return route.fulfill({status:200,body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if(url.pathname==='/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:testConfig+scenario});
      return route.continue();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()===404 && response.url().startsWith(base))local404.push(response.url().replace(base,''));});
    await page.goto(base+'/more-service/'+route,{waitUntil:'domcontentloaded'});
    if(signedIn) await page.waitForFunction(()=>!document.getElementById('serviceContent')?.innerText.includes('Loading Kagie services'));
    return {page,context};
  }
  try {
    // Verify meaningful content and navigation immediately after starting the server.
    const home=await open();
    pass(await home.page.locator('.ms-list--services .ms-row').count()===6,'More Services shows the six reference cards');
    await home.page.getByRole('link',{name:/Funding Assist/}).click();
    await home.page.getByRole('link',{name:/Available Bursaries/}).waitFor();
    pass(await home.page.locator('h1').innerText()==='Funding Assist','Funding navigation works');
    await home.context.close();
    console.log('Smoke verification passed: content, navigation and no blank service screens.');

    const responsive=await open();
    for(const route of pages) {
      await responsive.page.goto(base+'/more-service/'+route,{waitUntil:'domcontentloaded'});
      await responsive.page.waitForFunction(()=>!document.getElementById('serviceContent')?.innerText.includes('Loading Kagie services'));
      if(route.startsWith('available-bursaries')) await responsive.page.locator('#bursaryResults .ms-row').first().waitFor();
      if(route.startsWith('bursary-details')) await responsive.page.locator('.ms-detail-card').first().waitFor();
      for(const width of [320,390,768,1024,1440]) {
        await responsive.page.setViewportSize({width,height:width===390?844:1000});
        const geometry=await responsive.page.evaluate(()=>({width:innerWidth,pageWidth:document.documentElement.scrollWidth,inputSizes:[...document.querySelectorAll('input:not([type=checkbox]),select,textarea')].map(input=>parseFloat(getComputedStyle(input).fontSize)),nav:[...document.querySelectorAll('.kagie-shared-bottom-nav a')].map(link=>link.getAttribute('href'))}));
        pass(geometry.pageWidth<=width,route+' fits '+width+'px');
        pass(geometry.inputSizes.every(size=>size>=16),route+' mobile-safe field text at '+width+'px');
        pass(JSON.stringify(geometry.nav)===JSON.stringify(['../home.html','../career-guidance.html','../recommendation.html','accommodation-assist.html','transport-assist.html']),route+' reuses the existing app destinations');
        if([390,768,1440].includes(width)) await responsive.page.screenshot({path:path.join(output,route.split('?')[0].replace('.html','')+(route.includes('correction')?'-correction':'')+'-'+width+'.png'),fullPage:true});
      }
    }
    await responsive.context.close();

    const checklist=await open('funding-checklist.html');
    await checklist.page.getByRole('checkbox',{name:'Certified ID copy completed'}).check();
    await checklist.page.getByRole('checkbox',{name:'Proof of income completed'}).check();
    pass(await checklist.page.locator('#checklistCount').innerText()==='2 of 6 completed','Checklist progress updates');
    await checklist.page.reload();
    await checklist.page.waitForFunction(()=>document.getElementById('checklistCount')?.innerText==='2 of 6 completed');
    pass(await checklist.page.getByRole('checkbox',{name:'Certified ID copy completed'}).isChecked(),'Checklist survives refresh');
    const downloadEvent=checklist.page.waitForEvent('download');
    await checklist.page.getByRole('button',{name:'Download Checklist (PDF)'}).click();
    const download=await downloadEvent;
    const pdfPath=path.join(output,'Kagie-Funding-Checklist-test.pdf');
    await download.saveAs(pdfPath);
    const pdf=fs.readFileSync(pdfPath,'utf8');
    pass(pdf.startsWith('%PDF-1.4') && pdf.includes('2 of 6 completed') && pdf.includes('[x] Certified ID copy'),'PDF contains the current checklist');
    const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);
    pass(pdf.slice(xref,xref+4)==='xref','PDF cross-reference offset is valid');
    await checklist.context.close();

    const bursaries=await open('available-bursaries.html');
    await bursaries.page.locator('#bursaryResults .ms-row').first().waitFor();
    pass(await bursaries.page.locator('#bursaryResults .ms-row').count()===5,'Only published funding records appear');
    await bursaries.page.getByRole('button',{name:'Private',exact:true}).click();
    pass(await bursaries.page.locator('#bursaryResults .ms-row').count()===3,'Bursary category filter works');
    await bursaries.page.getByRole('searchbox').fill('Sasol');
    pass(await bursaries.page.locator('#bursaryResults .ms-row').count()===1,'Bursary search works');
    await bursaries.page.getByRole('searchbox').fill('No such provider');
    pass(await bursaries.page.getByRole('heading',{name:'No matching bursaries'}).count()===1,'Search has a clear empty state');
    await bursaries.context.close();
    const offline=await open('available-bursaries.html',true,`window.KagieAPI.getCareerArticlesAsync=async()=>{if(!window.testBackOnline)throw new Error('Synthetic offline');return ${JSON.stringify(funding)};};`);
    await offline.page.getByRole('heading',{name:'Bursaries could not load'}).waitFor();
    pass(await offline.page.getByRole('button',{name:'Try Again',exact:true}).count()===1,'Funding fetch failure offers retry');
    await offline.page.evaluate(()=>{window.testBackOnline=true;});
    await offline.page.getByRole('button',{name:'Try Again',exact:true}).click();
    await offline.page.locator('#bursaryResults .ms-row').first().waitFor();
    pass(await offline.page.locator('#bursaryResults .ms-row').count()===5,'Funding retry loads published records');
    await offline.context.close();
    const empty=await open('available-bursaries.html',true,'window.KagieAPI.getCareerArticlesAsync=async()=>[];');
    await empty.page.getByRole('heading',{name:'No bursaries published yet'}).waitFor();
    pass(await empty.page.locator('#bursaryResults .ms-row').count()===0,'No synthetic awards are shown when no content is published');
    await empty.context.close();

    const detail=await open('bursary-details.html?id=test-nsfas');
    await detail.page.getByRole('link',{name:/Continue to Official Website/}).waitFor();
    pass((await detail.page.getByRole('link',{name:/Continue to Official Website/}).getAttribute('rel')).includes('noopener'),'External application link is isolated');
    await detail.page.goto(base+'/more-service/bursary-details.html?id=test-picknpay');
    await detail.page.getByText('Closed',{exact:true}).waitFor();
    pass(await detail.page.getByRole('link',{name:/Continue to Official Website/}).count()===0,'Closed bursary has no active external apply action');
    await detail.context.close();

    async function cartFlow(route, fill, expected) {
      const entry=await open(route);
      await fill(entry.page);
      await entry.page.getByRole('button',{name:/Add.*(Request|request).*Cart/}).click();
      await entry.page.waitForURL('**/cart.html');
      const items=await entry.page.evaluate(()=>window.KagieAPI.getCart(window.KagieAPI.currentUser().id));
      pass(items.length===1,route+' produces one cart request');
      pass(items[0].serviceCode===expected,route+' preserves the service code');
      pass(items[0].type==='service' && Number(items[0].price)>0,route+' preserves paid checkout behavior');
      await entry.context.close();
    }
    await cartFlow('funding-support.html',async page=>{await page.locator('#fundingType').selectOption('NSFAS guidance');await page.locator('#fieldOfStudy').fill('Test Engineering');},'funding_assist');
    await cartFlow('change-email.html',async page=>{
      await page.locator('#newEmail').fill('new@test.invalid');await page.locator('#confirmEmail').fill('wrong@test.invalid');await page.getByRole('button',{name:'Continue',exact:true}).click();
      pass(await page.locator('#message').innerText()==='Your new email addresses do not match.','Email mismatch is blocked');
      await page.locator('#confirmEmail').fill('new@test.invalid');await page.getByRole('button',{name:'Continue',exact:true}).click();
      pass(await page.locator('#requestDetails').isVisible(),'Email flow collects institution details before creating a request');
      await page.locator('#institution').fill('Test University');await page.locator('#studentNo').fill('TEST123');await page.locator('#idNumber').fill('9901011234088');
    },'change_email');
    await cartFlow('forgot-pin.html',async page=>{await page.locator('#idNumber').fill('9901011234088');await page.getByRole('button',{name:'Request PIN Help'}).click();await page.locator('#institution').fill('Test University');await page.locator('#studentNo').fill('TEST123');await page.locator('#phone').fill('0712345678');},'forgot_pin');
    await cartFlow('forgot-student-number.html',async page=>{await page.locator('#idNumber').fill('9901011234088');await page.locator('#dob').fill('1999-01-01');await page.getByRole('button',{name:'Find Student Number'}).click();await page.locator('#institution').fill('Test University');await page.locator('#fullName').fill('Test Learner');await page.locator('#phone').fill('0712345678');},'forgot_student_number');
    await cartFlow('re-apply.html?request=correction',async page=>{await page.locator('#institution').fill('Test University');await page.locator('#studentNo').fill('TEST123');await page.locator('#intake').fill('2027');pass(await page.locator('#password').getAttribute('type')==='password','Portal password is masked');},'re_apply');

    const failure=await open('funding-support.html');
    await failure.page.locator('#fundingType').selectOption('Bursary finder support');await failure.page.locator('#fieldOfStudy').fill('Test Medicine');
    await failure.page.evaluate(()=>{window.testSaveCalls=0;window.originalServiceSave=window.KagieAPI.addCartItemAsync;window.KagieAPI.addCartItemAsync=async()=>{window.testSaveCalls++;await new Promise(resolve=>setTimeout(resolve,200));throw new Error('Synthetic save outage');};document.getElementById('serviceForm').requestSubmit();document.getElementById('serviceForm').requestSubmit();});
    await failure.page.getByText('Synthetic save outage',{exact:true}).waitFor();
    pass(await failure.page.evaluate(()=>window.testSaveCalls)===1,'Duplicate submissions are prevented');
    pass(await failure.page.locator('#fieldOfStudy').inputValue()==='Test Medicine','Failed request preserves entered fields');
    pass(await failure.page.locator('#submitButton').isEnabled(),'Failed request can be retried');
    await failure.context.close();
    const unauthorized=await open('index.html',false);
    await unauthorized.page.waitForURL('**/login.html?app=1');
    pass(unauthorized.page.url().includes('login.html'),'Unauthenticated visitor is sent to app login');
    await unauthorized.context.close();

    pass(errors.length===0,'No uncaught browser errors: '+errors.join('; '));
    pass(local404.length===0,'No missing local assets: '+local404.join('; '));
    const result={checkedAt:new Date().toISOString(),checks,screenStates:pages.length,widths:[320,390,768,1024,1440],errors,local404,environment:'Chrome; isolated local users and synthetic funding fixtures; no production writes'};
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
