// Synthetic local fixtures only; this suite never contacts production services.
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'), output=path.join(root,'reports/accommodation-design');
fs.mkdirSync(output,{recursive:true});
const user={id:'housing-test-learner',fullName:'Thandi Mokoena',email:'thandi@test.invalid',role:'user',phone:'0712345678'};
const fixtures=[
  {id:'preview-campus',propertyName:'Campus View Residence',price:2800,roomType:'Single room',location:'Hatfield, Pretoria',address:'Hatfield, Pretoria',distanceFromCampus:'0.8 km from campus',amenities:['NSFAS-friendly','WiFi included','Female-only','Kitchen','Laundry','Study area','24/7 Security'],availableFrom:'2027-02-01',images:['/images/accommodation/room-example.webp','/images/accommodation/room-example.webp?second'],contactPhone:'0712345678',contactEmail:'host@test.invalid'},
  {id:'preview-junction',propertyName:'The Junction Living',price:3500,roomType:'Single room',location:'Pretoria',distanceFromCampus:'1.2 km from campus',amenities:['WiFi included','24/7 Security'],images:[]},
  {id:'preview-maple',propertyName:'Maple Student House',price:2400,roomType:'Shared room',location:'Pretoria',distanceFromCampus:'2.1 km from campus',amenities:['NSFAS-friendly','WiFi included'],images:[]}
].map(item=>({...item,institutionName:'Preview University',description:'Synthetic local preview listing. The room image is an illustration, not a property photograph.',availabilityStatus:'Available',listingState:'published',isActive:true,updatedAt:'2026-10-06T10:00:00Z'}));
const config=`KagieAPI.configureSupabase({enabled:false});KagieAPI.resolveSessionUser=async()=>KagieAPI.currentUser();KagieAPI.getAccommodationListings=()=>${JSON.stringify(fixtures)};KagieAPI.getAccommodationListingsAsync=async()=>KagieAPI.getAccommodationListings();`;
function seed(user) {if(!localStorage.getItem('kagie_current_user')){localStorage.setItem('kagie_current_user',JSON.stringify(user));localStorage.setItem('kagie_users',JSON.stringify([user]));}}
const preview=process.argv.includes('--preview');
const server=http.createServer((req,res)=>{
  let pathname=new URL(req.url,'http://localhost').pathname,file;
  if(pathname==='/')pathname='/more-service/accommodation-assist.html';
  try{file=path.resolve(root,'.'+decodeURIComponent(pathname));}catch{res.writeHead(400);res.end();return;}
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
  if(preview&&pathname==='/js/supabase-config.js'){res.end(config);return;}
  let body=fs.readFileSync(file);
  if(preview&&pathname==='/more-service/accommodation-assist.html')body=body.toString().replace('<head>',`<head><script>(${seed})(${JSON.stringify(user)});</script>`);
  res.end(body);
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
  let checks=0;const errors=[], missing=[];const check=(value,label)=>{assert.ok(value,label);checks++;};
  async function open(hash='',extra='',actor=user){
    const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
    if(actor)await context.addInitScript(seed,actor);
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='127.0.0.1')return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if(url.pathname==='/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:config+extra});
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()===404&&response.url().startsWith(base))missing.push(response.url());});
    await page.goto(base+'/more-service/accommodation-assist.html'+hash,{waitUntil:'domcontentloaded'});
    if(actor)await page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');
    return {page,context};
  }
  try{
    const smoke=await open();
    check(await smoke.page.getByRole('button',{name:'Search housing',exact:true}).count()===1,'Search appears');
    await smoke.page.getByRole('button',{name:'Search housing',exact:true}).click();
    await smoke.page.getByRole('heading',{name:'Housing near campus',exact:true}).waitFor();
    check(await smoke.page.locator('.ha-card').count()===3,'Listings appear');
    await smoke.page.getByRole('link',{name:'Campus View Residence',exact:true}).click();
    await smoke.page.getByRole('heading',{name:'Campus View Residence',exact:true}).waitFor();
    check(await smoke.page.getByRole('heading',{name:'Campus View Residence',exact:true}).count()===1,'Details open');
    check(await smoke.page.locator('.ha-main-photo').evaluate(img=>img.complete&&img.naturalWidth>0),'Main image loads');
    check(errors.length===0,'Smoke has no uncaught errors');
    console.log('Smoke passed: search, listings, details and image.');
    await smoke.context.close();
    if(preview){console.log('Local synthetic accommodation preview: '+base+'/more-service/accommodation-assist.html');return;}
    const layout=await open();
    const views=['#home','#listings','#filters','#detail/preview-campus','#request/preview-campus','#saved','#recent','#requests','#safety/preview-campus','#map','#detail/missing'];
    for(const hash of views){
      await layout.page.goto(base+'/more-service/accommodation-assist.html'+hash);await layout.page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');
      for(const width of [320,390,768,1024,1440]){
        await layout.page.setViewportSize({width,height:1000});
        const geometry=await layout.page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,nav:[...document.querySelectorAll('.bottom-nav a')].map(node=>node.getAttribute('href')),icons:[...document.querySelectorAll('.ha-icon')].map(node=>node.getBoundingClientRect().width)}));
        check(geometry.scroll<=geometry.width+1,hash+' fits '+width);
        check(geometry.nav.join('|')==='../home.html|../career-guidance.html|../recommendation.html|accommodation-assist.html|transport-assist.html',hash+' keeps app navigation '+width);
        check(geometry.icons.every(width=>width<=65),hash+' bounded icons '+width);
        if([390,768,1440].includes(width)&&['#home','#listings','#filters','#detail/preview-campus','#safety/preview-campus'].includes(hash))await layout.page.screenshot({path:path.join(output,hash.replace(/[^a-z0-9]/gi,'-')+'-'+width+'.png'),fullPage:true});
      }
    }
    await layout.context.close();
    const flow=await open('#listings');const page=flow.page;
    await page.getByRole('button',{name:'Save Campus View Residence',exact:true}).click();
    await page.getByRole('link',{name:'Saved',exact:true}).click();await page.getByRole('heading',{name:'Saved places',exact:true}).waitFor();check(await page.locator('.ha-card').count()===1,'Saved list works');
    await page.reload();await page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');check(await page.locator('.ha-card').count()===1,'Saved survives reload');
    await page.getByRole('button',{name:'Unsave Campus View Residence',exact:true}).click();check(await page.getByRole('heading',{name:'No saved places yet'}).count()===1,'Unsave updates view');
    await page.goto(base+'/more-service/accommodation-assist.html#listings');await page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');
    await page.getByLabel('Search listings').fill('Campus');check(await page.locator('.ha-card').count()===1,'Search filters');
    check(await page.getByLabel('Search listings').evaluate(input=>document.activeElement===input),'Search keeps focus');
    await page.evaluate(()=>window.testRow=document.querySelector('.ha-card'));await page.getByLabel('Search listings').fill('campus ');check(await page.evaluate(()=>window.testRow===document.querySelector('.ha-card')),'Same match reuses row');
    await page.getByLabel('Search listings').fill('');await page.getByRole('link',{name:'Filter housing',exact:true}).click();
    await page.getByLabel('Within 1km',{exact:true}).check();await page.getByLabel('Female-only',{exact:true}).check();await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#housingList .ha-card').length===1);check(await page.locator('.ha-card').count()===1,'Combined filters work');
    await page.reload();await page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');check(await page.locator('.ha-card').count()===1,'Filters persist');
    await page.getByRole('button',{name:'All',exact:true}).click();await page.getByRole('button',{name:'Under R3 000',exact:true}).click();check(await page.locator('.ha-card').count()===2,'Budget preset works');
    await page.getByRole('link',{name:'Campus View Residence',exact:true}).click();
    await page.getByRole('button',{name:'View photo 2',exact:true}).click();check(await page.locator('#housingPhotoCount').textContent()==='2/2','Gallery counts actual images');
    await page.getByRole('button',{name:'See all',exact:true}).click();check(await page.getByRole('dialog').getByText('Kitchen',{exact:true}).count()===1,'Amenities dialog works');await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Contact host',exact:true}).click();check((await page.getByRole('link',{name:/Call 071/}).getAttribute('href'))==='tel:0712345678','Contact uses real supplied number');await page.keyboard.press('Escape');
    check(await page.getByRole('link',{name:'Request to reserve',exact:true}).evaluate(node=>{const rect=node.getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();return rect.top>=0&&rect.bottom<nav.top&&rect.right<=innerWidth;}),'Mobile reserve action stays above app footer');
    await page.getByRole('link',{name:'Request to reserve',exact:true}).click();await page.getByLabel('Phone number',{exact:true}).fill('0712345678');
    await page.getByLabel('Move-in date',{exact:true}).fill('2027-02-01');await page.getByLabel('Funding plan',{exact:true}).selectOption('Self-funded');await page.getByLabel('Document readiness',{exact:true}).selectOption('All ready');
    await page.getByLabel('Notes for Kagie').fill('Local test request.');await page.getByRole('button',{name:/Send request to Kagie/}).click();
    await page.getByRole('heading',{name:'Request saved on this device',exact:true}).waitFor();check(true,'Local request has honest status');
    await page.screenshot({path:path.join(output,'status-390.png'),fullPage:true});
    await page.reload();await page.waitForFunction(()=>document.getElementById('housingContent')?.dataset.ready==='true');check(await page.getByRole('heading',{name:'Request saved on this device',exact:true}).count()===1,'Request survives reload');
    await page.getByRole('link',{name:'Review or update request',exact:true}).click();check(await page.getByLabel('Notes for Kagie').inputValue()==='Local test request.','Request edit preserves details');
    await page.getByLabel('Notes for Kagie').fill('Updated local request.');await page.getByRole('button',{name:/Update request/}).click();await page.getByRole('heading',{name:'Request saved on this device',exact:true}).waitFor();
    check(await page.evaluate(()=>KagieAPI.getAccommodationRequests(KagieAPI.currentUser().id).length)===1,'Update does not create duplicate');
    await flow.context.close();
    const failure=await open('#request/preview-campus',"KagieAPI.submitAccommodationRequestAsync=async()=>{throw new Error('Test save failure');};");
    await failure.page.getByLabel('Phone number',{exact:true}).fill('0712345678');await failure.page.getByLabel('Move-in date',{exact:true}).fill('2027-02-01');await failure.page.getByLabel('Funding plan',{exact:true}).selectOption('Self-funded');await failure.page.getByLabel('Document readiness',{exact:true}).selectOption('All ready');await failure.page.getByRole('button',{name:/Send request to Kagie/}).click();await failure.page.getByRole('alert').filter({hasText:'Test save failure'}).waitFor();
    check(await failure.page.getByRole('button',{name:/Send request to Kagie/}).isEnabled(),'Failure restores submit');check(await failure.page.getByLabel('Phone number',{exact:true}).inputValue()==='0712345678','Failure preserves form');await failure.context.close();
    const paused=await open('#request/preview-campus',"KagieAPI.getAdminContentAsync=async()=>({settings:{serviceStatus:'paused'}});");check(await paused.page.getByRole('heading',{name:'Housing requests are paused'}).count()===1,'Admin pause blocks requests');await paused.context.close();
    const unsafe=await open('#listings',`KagieAPI.getAccommodationListings=()=>[{id:'unsafe',propertyName:'<img src=x onerror=window.attacked=true>',price:2800,images:['javascript:alert(1)'],listingState:'published'}];KagieAPI.getAccommodationListingsAsync=async()=>KagieAPI.getAccommodationListings();`);
    check(await unsafe.page.evaluate(()=>!window.attacked),'Listing text does not execute markup');check(await unsafe.page.locator('.ha-card h3').innerText()==='<img src=x onerror=window.attacked=true>','Listing text is escaped');await unsafe.context.close();
    const delayed=await open('#request/preview-campus',`KagieAPI.getAccommodationListingsAsync=()=>new Promise(resolve=>setTimeout(()=>resolve(KagieAPI.getAccommodationListings()),500));`);
    await delayed.page.getByLabel('Notes for Kagie').fill('Keep this typed note');await delayed.page.evaluate(()=>window.dispatchEvent(new Event('storage')));check(await delayed.page.getByLabel('Notes for Kagie').inputValue()==='Keep this typed note','Unrelated storage events preserve form');await delayed.context.close();
    const isolated=await open('#saved','',{...user,id:'different-learner'});check(await isolated.page.locator('.ha-card').count()===0,'Saved places are scoped to account');await isolated.context.close();
    const guest=await open('', '', null);await guest.page.waitForURL('**/login.html?app=1');check(true,'Guests go to login');await guest.context.close();
    check(errors.length===0,'No uncaught browser errors');check(missing.length===0,'No missing local assets');
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({checks,views,widths:[320,390,768,1024,1440],errors,missing,productionContacted:false},null,2));console.log('PASS '+checks+' accommodation browser checks.');
  }finally{await browser.close();if(!preview)server.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
module.exports={fixtures,user};
