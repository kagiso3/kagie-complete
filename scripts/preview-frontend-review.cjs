// Local, read-only preview of the frontend review artifacts.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../reports');
const contentTypes = {'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'FRONTEND_UI_UX_REVIEW.html';
    const file = path.resolve(root, relative);
    if(!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); response.end('Not found'); return;
    }
    response.writeHead(200, {'Content-Type':contentTypes[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(response);
  } catch {response.writeHead(400);response.end('Bad request');}
});
server.listen(0, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  console.log('Frontend review preview: ' + url);
  if(!process.argv.includes('--check')) return;
  const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  let browser;
  try {
    browser = await chromium.launch({channel:'chrome',headless:true});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, {waitUntil:'domcontentloaded'});
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      const geometry = await page.evaluate(() => ({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth}));
      if(geometry.pageWidth>width) throw new Error('Report overflows at '+width+'px: '+JSON.stringify(geometry));
    }
    await page.locator('#screenshot').scrollIntoViewIfNeeded();
    const names = await page.locator('#screen option').evaluateAll(options => options.map(option=>option.value));
    let imageChecks = 0;
    for(const name of names) {
      await page.locator('#screen').selectOption(name);
      for(const width of [390,768,1440]) {
        await page.locator('[data-width="'+width+'"]').click();
        await page.waitForFunction(() => {const img=document.getElementById('screenshot');return img.complete && img.naturalWidth>0;});
        imageChecks++;
      }
    }
    await page.locator('#role').selectOption('staff');
    const staffNames = await page.locator('#screen option').evaluateAll(options=>options.map(option=>option.value));
    if(staffNames.includes('Home') || !staffNames.includes('Master dashboard')) throw new Error('Audience filtering failed');
    await page.locator('#role').selectOption('learner');
    await page.locator('#screen').selectOption('Apply');
    if(await page.locator('#screen-title').innerText() !== 'Apply') throw new Error('Gallery selection failed');
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(root,'frontend-audit/review-overview-desktop.png')});
    await page.locator('.sketch').screenshot({path:path.join(root,'frontend-audit/proposed-layout-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.sketch').screenshot({path:path.join(root,'frontend-audit/proposed-layout-phone.png')});
    if(errors.length) throw new Error('Report JavaScript errors: '+errors.join('; '));
    const result = {checkedAt:new Date().toISOString(),responsiveWidths:[320,390,768,1440],galleryImages:imageChecks,audienceFilters:'passed',javascriptErrors:errors};
    fs.writeFileSync(path.join(root,'frontend-audit/review-verification.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } catch(error) {console.error(error);process.exitCode=1;}
  finally {if(browser) await browser.close();server.close();}
});
