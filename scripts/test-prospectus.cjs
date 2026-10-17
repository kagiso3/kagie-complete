// Local fixtures only. No production service is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..'), output = path.join(root,'reports/prospectus-design');
fs.mkdirSync(output,{recursive:true});
const user = {id:'prospectus-test-learner',fullName:'Thandi Mokoena',role:'user',email:'thandi@test.invalid'};
function pdf() {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 600] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream='BT /F1 18 Tf 40 540 Td (Kagie local preview - sample PDF) Tj ET';
  objects[3]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let result='%PDF-1.4\n', offsets=[0];
  objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(result));result+=`${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(result);
  result+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
const samplePdf = pdf();
const docs = ['boland-tvet','cput','unisa'].map((institutionId,index)=>({id:'sample-'+index,institutionId,title:['Boland TVET College · Preview PDF','CPUT · Preview PDF','UNISA · Preview PDF'][index],fileName:'kagie-preview.pdf',fileUrl:'/__test/prospectus.pdf',fileSize:samplePdf.length,mimeType:'application/pdf',createdAt:'2026-01-02T09:00:00Z',updatedAt:'2026-01-02T09:00:00Z',source:'local'}));
const config = `KagieAPI.configureSupabase({enabled:false});KagieAPI.resolveSessionUser=async()=>KagieAPI.currentUser();KagieAPI.getInstitutionCatalogAsync=async filters=>KagieAPI.getInstitutionCatalog(filters);`;
const preview = process.argv.includes('--preview');
function seed({user,docs}) {
  if (!localStorage.getItem('kagie_current_user')) {localStorage.setItem('kagie_current_user',JSON.stringify(user));localStorage.setItem('kagie_users',JSON.stringify([user]));}
  if (!localStorage.getItem('kagie_prospectus_library_catalog')) localStorage.setItem('kagie_prospectus_library_catalog',JSON.stringify(docs));
}
const server=http.createServer((req,res)=>{
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/__test/prospectus.pdf') {res.setHeader('Content-Type','application/pdf');res.end(samplePdf);return;}
  if(pathname==='/') pathname='/index.html';
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(pathname));}catch{res.writeHead(400);res.end();return;}
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
  if(preview && pathname==='/js/supabase-config.js'){res.end(config);return;}
  let body=fs.readFileSync(file);
  if(preview && pathname==='/prospectus.html') body=body.toString().replace('<head>',`<head><script>(${seed})(${JSON.stringify({user,docs})});</script>`);
  res.end(body);
});
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true}), errors=[],missing=[];
  async function open(hash='',scenario='',actor=user) {
    const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block',acceptDownloads:true});
    if(actor) await context.addInitScript(seed,{user:actor,docs});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='127.0.0.1') return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if(url.pathname==='/js/supabase-config.js') return route.fulfill({contentType:'text/javascript',body:config+scenario});
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()===404 && response.url().startsWith(base))missing.push(response.url());});
    await page.goto(base+'/prospectus.html'+hash,{waitUntil:'domcontentloaded'});
    if(actor) await page.waitForFunction(()=>document.getElementById('prospectusContent')?.getAttribute('aria-busy')==='false');
    return {page,context};
  }
  try {
    // Verify the server immediately after startup.
    const smoke=await open();
    check(await smoke.page.getByRole('heading',{name:/Your future/}).count()===1,'Hero is visible');
    check(await smoke.page.locator('.pr-hero-art').evaluate(image=>image.complete&&image.naturalWidth>0),'Hero image loads');
    await smoke.page.getByRole('link',{name:'Institutions',exact:true}).click();
    await smoke.page.getByRole('link',{name:'Boland TVET College',exact:true}).click();
    check(await smoke.page.getByRole('heading',{name:'Boland TVET College',exact:true}).count()===1,'Library opens institution details');
    check(errors.length===0,'No uncaught smoke errors');
    console.log('Smoke passed: home, image, library and institution details.');
    await smoke.context.close();
    if(preview){console.log('Local synthetic prospectus preview: '+base+'/prospectus.html');return;}

    const layout=await open();
    const views=['#home','#library','#filters','#institution/boland-tvet','#institution/boland-tvet?tab=prospectus','#institution/boland-tvet?tab=applications','#institution/boland-tvet?tab=dates','#missing/buffalo-city-tvet','#guide/boland-tvet','#downloads','#downloads?tab=recent'];
    for(const hash of views) {
      await layout.page.goto(base+'/prospectus.html'+hash,{waitUntil:'domcontentloaded'});
      await layout.page.waitForFunction(()=>document.getElementById('prospectusContent')?.getAttribute('aria-busy')==='false');
      for(const width of [320,390,768,1024,1440]) {
        await layout.page.setViewportSize({width,height:1000});
        const geometry=await layout.page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,svgs:[...document.querySelectorAll('.pr-screen svg')].map(svg=>svg.getBoundingClientRect().width),nav:[...document.querySelectorAll('.bottom-nav a')].map(a=>a.getAttribute('href')),font:getComputedStyle(document.querySelector('.pr-screen')).fontFamily,sharedFont:getComputedStyle(document.body).fontFamily}));
        check(geometry.scroll<=geometry.width+1,hash+' fits '+width);
        check(geometry.svgs.every(width=>width<=45),hash+' icons fit '+width);
        check(geometry.nav.join('|')==='home.html|career-guidance.html|recommendation.html|more-service/accommodation-assist.html|more-service/transport-assist.html',hash+' retains app footer '+width);
        check(geometry.font.includes('Inter') && geometry.font === geometry.sharedFont,hash+' shared Kagie typography '+width);
        if([390,768,1440].includes(width)) await layout.page.screenshot({path:path.join(output,hash.replace(/[^a-z0-9]/gi,'-')+'-'+width+'.png'),fullPage:true});
      }
    }
    await layout.context.close();

    const flow=await open('#library');const page=flow.page;
    check(await page.locator('.pr-institution').count()===24,'Initial list mounts only 24 rows');
    await page.getByRole('button',{name:/Show more institutions/}).click();
    check(await page.locator('.pr-institution').count()===48,'Show more reveals the next institutions');
    await page.getByLabel('Search institutions or programmes').fill('Boland');
    check(await page.locator('.pr-institution').count()===1,'Search filters institution names');
    check(await page.getByLabel('Search institutions or programmes').evaluate(input=>document.activeElement===input),'Search keeps keyboard focus');
    await page.evaluate(()=>{window.testList=document.getElementById('prospectusList').firstElementChild;});
    await page.getByLabel('Search institutions or programmes').fill('boland ');
    check(await page.evaluate(()=>window.testList===document.getElementById('prospectusList').firstElementChild),'Same-match search keeps existing rows');
    check((await page.getByRole('link',{name:'Boland TVET College',exact:true}).getAttribute('href')).includes('q=boland'),'Reused result links carry the latest search context');
    await page.getByRole('link',{name:'Search and filters',exact:true}).click();
    await page.getByLabel('Search institutions or programmes').fill('');
    await page.getByLabel('TVET Colleges',{exact:true}).check();
    await page.getByLabel('Province',{exact:true}).selectOption('Western Cape');
    await page.getByLabel('With PDF',{exact:true}).check();
    await page.getByRole('button',{name:/Show Results/}).click();
    check(await page.locator('.pr-institution').count()===1,'Combined type, province and PDF filters work');
    await page.reload();await page.locator('.pr-institution').first().waitFor();
    check((await page.url()).includes('province=Western+Cape') && await page.locator('.pr-institution').count()===1,'Filters survive reload');
    await page.getByRole('link',{name:'Boland TVET College',exact:true}).click();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download Prospectus',exact:true}).click();
    const download=await downloadPromise;const target=path.join(output,'Kagie-preview.pdf');await download.saveAs(target);
    check(fs.readFileSync(target).equals(samplePdf),'Download contains the actual PDF bytes');
    await page.getByRole('link',{name:'Saved & Downloads',exact:true}).click();
    check(await page.locator('.pr-history-row').count()===1,'Successful download appears in history');
    await page.reload();await page.locator('.pr-history-row').first().waitFor();
    check(await page.locator('.pr-history-row').count()===1,'Download history persists');
    await page.getByRole('link',{name:/Recently Viewed/}).click();
    check(await page.locator('.pr-history-row').count()===1,'Recently viewed deduplicates institutions');
    await page.getByRole('button',{name:/Remove Boland/}).click();
    check(await page.getByRole('heading',{name:'No recently viewed institutions',exact:true}).count()===1,'Remove history removes only local history');
    await page.goto(base+'/prospectus.html#missing/buffalo-city-tvet');
    await page.getByRole('heading',{name:'No PDF uploaded yet',exact:true}).waitFor();
    await page.getByRole('link',{name:'Open Kagie Guide',exact:true}).click();
    check(await page.getByRole('heading',{name:'Study areas & programmes',exact:true}).count()===1,'Missing PDF leads to the actual Kagie guide');
    const guidePromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download Kagie Guide (TXT)',exact:true}).click();
    const guide=await guidePromise;await guide.saveAs(path.join(output,'Kagie-guide.txt'));
    check(fs.readFileSync(path.join(output,'Kagie-guide.txt'),'utf8').includes('Buffalo City'),'Guide download names the selected institution');
    await page.goto(base+'/prospectus.html?institution=boland-tvet');
    await page.getByRole('heading',{name:'Boland TVET College',exact:true}).waitFor();
    check(page.url().includes('#institution/boland-tvet'),'Legacy institution links open detail screens');
    await page.getByRole('link',{name:'Applications',exact:true}).click();
    check(await page.getByRole('link',{name:'Start a Kagie Application',exact:true}).getAttribute('href')==='forms.html','Application action reaches the learner form');
    await page.getByRole('link',{name:'Important Dates',exact:true}).click();await page.reload();
    check(await page.getByRole('heading',{name:'Important dates',exact:true}).count()===1,'Institution tab deep links survive reload');
    await flow.context.close();

    const failure=await open('#institution/boland-tvet',`KagieAPI.getProspectusDocuments=()=>[{id:'bad',institutionId:'boland-tvet',title:'Broken PDF',fileUrl:'data:application/pdf;base64,bm90IHBkZg=='}];KagieAPI.getProspectusDocumentsAsync=async()=>KagieAPI.getProspectusDocuments();`);
    await failure.page.getByRole('button',{name:'Download Prospectus',exact:true}).click();
    await failure.page.getByRole('status').filter({hasText:/not a valid PDF/}).waitFor();
    check(await failure.page.evaluate(()=>!localStorage.getItem('kagie_prospectus_history:prospectus-test-learner')?.includes('downloadedAt')),'Failed download is absent from download history');
    await failure.context.close();
    const expired=await open('#institution/boland-tvet',`KagieAPI.getProspectusDocuments=()=>[{id:'expired',institutionId:'boland-tvet',title:'Protected PDF',fileName:'protected.pdf',remotePath:'prospectus/boland-tvet/protected.pdf',fileUrl:'/__test/expired.pdf',source:'remote'}];KagieAPI.getProspectusDocumentsAsync=async()=>{window.pdfReads=(window.pdfReads||0)+1;return KagieAPI.getProspectusDocuments().map(doc=>({...doc,fileUrl:window.expiredTried?'/__test/prospectus.pdf':doc.fileUrl}));};const originalFetch=window.fetch.bind(window);window.fetch=(request,options)=>{if(String(request).includes('/__test/expired.pdf')){window.expiredTried=true;return Promise.resolve(new Response('Expired',{status:403}));}return originalFetch(request,options);};`);
    const refreshedDownload=expired.page.waitForEvent('download');await expired.page.getByRole('button',{name:'Download Prospectus',exact:true}).click();await refreshedDownload;
    check(await expired.page.evaluate(()=>window.pdfReads>=2),'Expired signed link is refreshed and downloaded once');
    await expired.context.close();
    const empty=await open('#manage');check(await empty.page.getByRole('heading',{name:'Staff access required',exact:true}).count()===1,'Learners cannot access staff upload');await empty.context.close();
    const signedOut=await open('', '',null);await signedOut.page.waitForURL('**/login.html?app=1');check(signedOut.page.url().includes('login.html'),'Signed-out visitors are redirected');await signedOut.context.close();
    const missingId=await open('#institution/does-not-exist');check(await missingId.page.getByRole('heading',{name:'Institution not found',exact:true}).count()===1,'Unknown institution has a recovery action');await missingId.context.close();
    const other=await open('#downloads','',{...user,id:'other-learner'});check(await other.page.getByRole('heading',{name:'No downloads yet',exact:true}).count()===1,'Download history is account scoped');await other.context.close();
    const staff=await open('#manage','',{...user,id:'prospectus-test-staff',role:'assistant_admin'});
    for(const width of [320,390,768,1024,1440]) {
      await staff.page.setViewportSize({width,height:1000});
      check(await staff.page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Staff upload fits '+width);
    }
    await staff.page.getByLabel('Institution',{exact:true}).selectOption('boland-tvet');
    await staff.page.getByLabel('Title',{exact:true}).fill('New local PDF');
    await staff.page.getByLabel('Prospectus PDF',{exact:true}).setInputFiles({name:'new-prospectus.pdf',mimeType:'application/pdf',buffer:samplePdf});
    await staff.page.getByRole('button',{name:'Upload PDF',exact:true}).click();
    await staff.page.getByRole('status').filter({hasText:/saved to this device/}).waitFor();
    check(await staff.page.evaluate(()=>KagieAPI.getProspectusDocuments().length)===4,'Uploading a local PDF preserves the existing library files');
    await staff.page.goto(base+'/prospectus.html#institution/boland-tvet?tab=prospectus');
    await staff.page.getByRole('heading',{name:'Boland TVET College',exact:true}).waitFor();
    check(await staff.page.getByRole('button',{name:'Download Prospectus',exact:true}).count()===2,'Both PDFs remain after a page reload');
    await staff.page.getByRole('button',{name:'Remove PDF from library',exact:true}).first().click();
    await staff.page.getByRole('status').filter({hasText:/removed from the library/}).waitFor();
    check(await staff.page.evaluate(()=>KagieAPI.getProspectusDocuments().length)===3,'Removing one local PDF preserves all other library files');
    await staff.page.goto(base+'/prospectus.html#manage');
    await staff.page.getByLabel('Title',{exact:true}).fill('Invalid PDF');
    await staff.page.getByLabel('Prospectus PDF',{exact:true}).setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('Not a PDF')});
    await staff.page.getByRole('button',{name:'Upload PDF',exact:true}).click();
    await staff.page.getByRole('status').filter({hasText:/valid PDF prospectus file/}).waitFor();
    check(await staff.page.evaluate(()=>KagieAPI.getProspectusDocuments().length)===3,'Invalid upload cannot change the library');
    await staff.context.close();
    const quota=await open('#manage',`KagieAPI.saveProspectusDocumentByStaffAsync=async payload=>({id:'not-saved',institutionId:payload.institutionId,title:payload.title,source:'local'});`,{...user,id:'prospectus-quota-staff',role:'master_admin'});
    await quota.page.getByLabel('Title',{exact:true}).fill('Quota test');
    await quota.page.getByLabel('Prospectus PDF',{exact:true}).setInputFiles({name:'quota.pdf',mimeType:'application/pdf',buffer:samplePdf});
    await quota.page.getByRole('button',{name:'Upload PDF',exact:true}).click();
    await quota.page.getByRole('status').filter({hasText:/device could not save/}).waitFor();
    check(await quota.page.evaluate(()=>KagieAPI.getProspectusDocuments().length)===3,'Unsaved local upload shows failure without claiming success');
    await quota.context.close();
    const race=await open('#manage',`KagieAPI.getProspectusDocumentsAsync=()=>new Promise(resolve=>window.testResolveDocuments=()=>resolve([]));`,{...user,id:'prospectus-race-staff',role:'master_admin'});
    await race.page.getByLabel('Institution',{exact:true}).selectOption('boland-tvet');
    await race.page.getByLabel('Title',{exact:true}).fill('Race-safe PDF');
    await race.page.getByLabel('Prospectus PDF',{exact:true}).setInputFiles({name:'race.pdf',mimeType:'application/pdf',buffer:samplePdf});
    await race.page.getByRole('button',{name:'Upload PDF',exact:true}).click();
    await race.page.getByRole('status').filter({hasText:/saved to this device/}).waitFor();
    await race.page.evaluate(()=>window.testResolveDocuments());
    await race.page.getByRole('link',{name:'Institutions',exact:true}).click();
    await race.page.getByRole('link',{name:'Boland TVET College',exact:true}).click();
    check(await race.page.getByRole('button',{name:'Download Prospectus',exact:true}).count()===2,'Stale PDF refresh cannot erase a newly uploaded document');
    await race.context.close();
    check(errors.length===0,'No uncaught browser errors');check(missing.length===0,'No missing local assets');
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({checks,views,widths:[320,390,768,1024,1440],errors,missing,productionContacted:false},null,2));
    console.log('PASS '+checks+' prospectus browser checks.');
  } finally {await browser.close();if(!preview)server.close();}
}
if(require.main===module) main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
module.exports={pdf,docs,user};
