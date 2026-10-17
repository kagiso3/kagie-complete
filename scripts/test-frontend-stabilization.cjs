// Frontend finishing checks against isolated SQL and synthetic accounts only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { start } = require('./admin-test-server.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/frontend-stabilization');
const widths = [320,360,375,390,414,430,600,768,820,1024,1280,1366,1440,1920];
const cases = [
  ['/home.html','learner'], ['/Dashboard.html','learner'], ['/cart.html','learner'],
  ['/checkout.html','learner'], ['/profile.html','learner'], ['/personal-assistance.html','learner'],
  ['/more-service/index.html','learner'], ['/notifications.html','learner'],
  ['/login.html?app=1','public'], ['/signup.html','public'], ['/about.html','public'], ['/terms.html','public']
];
async function main() {
  fs.mkdirSync(out, {recursive:true});
  const harness = await start();
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const errors = [], checks = [], layouts = [], failures = [];
  const contexts = [];
  async function check(name, fn) { await fn(); checks.push(name); console.log('PASS '+name); }
  async function contextFor(role) {
    const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    contexts.push(context);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if(url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
      if(url.hostname!=='127.0.0.1') return route.fulfill({body:'',contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript'});
      if(url.pathname==='/js/supabase-config.js') {
        if(role==='public') return route.fulfill({contentType:'text/javascript',body:'window.KagieAPI.configureSupabase({enabled:false});'});
        return route.fulfill({contentType:'text/javascript',body:`
          const api=window.KagieAPI;
          const client=api.configureSupabase({enabled:true,url:${JSON.stringify(harness.base)},anonKey:'test-anon'});
          api.setLoginPersistence(true);
          const restore=api.restoreSession;
          const ready=client.auth.setSession({access_token:${JSON.stringify(harness.ids[role+'Token'])},refresh_token:'local-test-refresh'}).then(()=>restore());
          api.restoreSession=async(...args)=>{await ready;return restore(...args);};
          const resolve=api.resolveSessionUser;
          api.resolveSessionUser=async(...args)=>{await ready;return resolve(...args);};
        `});
      }
      return route.continue();
    });
    return context;
  }
  try {
    const learner = await contextFor('learner'), visitor = await contextFor('public');
    const layoutCases = process.argv.includes('--interactions-only') ? [] : cases;
    for(const [route,role] of layoutCases) {
      const page = await (role==='public'?visitor:learner).newPage();
      page.on('pageerror',error=>errors.push({route,message:error.message}));
      for(const width of widths) {
        await page.setViewportSize({width,height:width<768?844:1000});
        await page.goto(harness.base+route,{waitUntil:'domcontentloaded'});
        await page.waitForTimeout(450);
        const result = await page.evaluate(() => {
          const visible = node => !!node.getClientRects().length && getComputedStyle(node).visibility!=='hidden';
          return {
            width:innerWidth,pageWidth:document.documentElement.scrollWidth,
            overflow:[...document.querySelectorAll('body *')].filter(node=>{
              const rect=node.getBoundingClientRect();
              // Descendants of purposeful carousels and clipped artwork do not
              // enlarge the document and are assessed separately in screenshots.
              return visible(node) && rect.right>innerWidth+1 && !node.closest('.carousel,.dashboard-bar,.menu-sheet,.kagie-skip-link');
            }).slice(0,6).map(node=>({tag:node.tagName,className:node.className})),
            shell:document.querySelector('.app,.app-shell,.shell')?.getBoundingClientRect().width,
            icons:[...document.querySelectorAll('.bottom-nav-icon')].filter(visible).every(node=>!!node.querySelector('svg')),
            smallInputs:[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')].filter(visible).filter(node=>parseFloat(getComputedStyle(node).fontSize)<16).map(node=>node.id)
          };
        });
        layouts.push({route,...result});
        if(result.pageWidth>width+1)failures.push({route,width,reason:'Document overflow',result});
        if(width<768&&result.smallInputs.length)failures.push({route,width,reason:'Mobile input text below 16px',fields:result.smallInputs});
        if(!result.icons)failures.push({route,width,reason:'Navigation icon missing'});
        if(width>=768&&['/home.html','/Dashboard.html','/cart.html'].includes(route)&&result.shell<Math.min(width-48,960)-1)failures.push({route,width,reason:'Phone-width shell on wide viewport'});
        if([390,820,1440].includes(width)&&['/home.html','/Dashboard.html','/checkout.html','/profile.html'].includes(route))await page.screenshot({path:path.join(out,route.slice(1).replace('.html','')+'-'+width+'.png'),fullPage:true});
      }
      await page.close();
      console.log('CHECKED '+route+' at '+widths.length+' widths');
    }
    if(layoutCases.length)await check('Core layouts fit all 14 requested widths and mobile inputs stay readable',async()=>assert.deepEqual(failures,[]));
    const page = await learner.newPage();
    page.on('pageerror',error=>errors.push({route:page.url(),message:error.message}));
    await page.goto(harness.base+'/home.html');
    await page.locator('#menuBtn').click();
    await check('Menu focuses its close action, locks background and exposes expanded state',async()=>{
      assert.equal(await page.locator('#menuBtn').getAttribute('aria-expanded'),'true');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'closeMenu');
      assert.equal(await page.locator('.app').evaluate(node=>node.inert),true);
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    });
    await page.keyboard.press('Shift+Tab');
    await check('Menu traps backward keyboard navigation',async()=>assert.equal(await page.evaluate(()=>document.activeElement.id),'logoutBtn'));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'closeMenu');
    await page.keyboard.press('Escape');
    await check('Escape restores focus and scrolling',async()=>{
      assert.equal(await page.evaluate(()=>document.activeElement.id),'menuBtn');
      assert.equal(await page.locator('.app').evaluate(node=>node.inert),false);
      assert.equal(await page.locator('#menuSheet').getAttribute('aria-hidden'),'true');
      assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
    });
    await page.goto(harness.base+'/Dashboard.html');
    await check('Unmapped pages do not falsely mark Home as current',async()=>assert.equal(await page.locator('.bottom-nav [aria-current]').count(),0));
    await page.goto(harness.base+'/checkout.html');
    await page.waitForFunction(() => document.querySelector('.checkout-bank')?.hidden === true && document.querySelector('#summary')?.innerText.includes('empty'), null, {timeout:10000});
    await check('Empty checkout hides transfer instructions and offers a working application link',async()=>{
      assert.equal(await page.locator('.checkout-bank').isVisible(),false);
      assert.equal(await page.locator('.checkout-followup').isVisible(),false);
      assert.equal(await page.locator('#summary a').getAttribute('href'),'forms.html');
    });
    await page.goto(harness.base+'/notifications.html');
    await page.waitForTimeout(600);
    await page.evaluate(()=>{
      window.notificationTest={calls:0};
      const items=[{id:'isolated-notice',title:'Payment updated',message:'Your application payment is being reviewed.',type:'info',read:false,createdAt:new Date().toISOString()}];
      KagieAPI.getNotificationsAsync=async()=>items;
      KagieAPI.getNotifications=()=>items;
      KagieAPI.markNotificationReadAsync=async()=>{notificationTest.calls++;await new Promise(r=>setTimeout(r,250));throw new Error('Synthetic notification outage');};
    });
    await page.locator('[data-filter=unread]').click();
    await page.locator('[data-read]').click();
    await page.evaluate(()=>document.querySelector('[data-read]').click());
    await page.getByRole('status').filter({hasText:'Could not update your notifications'}).waitFor();
    await check('Notification failures preserve the inbox and allow retry without duplicate requests',async()=>{
      assert.equal(await page.evaluate(()=>notificationTest.calls),1);
      assert.equal(await page.locator('[data-read]').isEnabled(),true);
      assert.equal(await page.locator('#list .unread').count(),1);
      assert.equal(await page.locator('#list a').getAttribute('href'),'Dashboard.html');
    });
    await page.evaluate(()=>{KagieAPI.getNotificationsAsync=async()=>{throw new Error('Synthetic offline read');};});
    await page.locator('[data-filter=all]').click();
    await check('Notification fallback identifies cached information',async()=>assert.match(await page.locator('#heroText').innerText(),/Showing saved notifications/));
    const login = await visitor.newPage();
    login.on('pageerror',error=>errors.push({route:'/login.html',message:error.message}));
    await login.goto(harness.base+'/login.html?app=1');
    await check('Login fields have persistent associated labels',async()=>{
      assert.equal(await login.getByLabel('Email address',{exact:true}).count(),1);
      assert.equal(await login.getByLabel('Password',{exact:true}).count(),1);
    });
    await login.getByLabel('Email address',{exact:true}).fill('invalid-address');
    await login.getByLabel('Password',{exact:true}).fill('synthetic-password');
    await login.locator('#loginBtn').click();
    await check('Invalid email is caught before a login request',async()=>assert.match(await login.locator('#message').innerText(),/valid email/));
    await login.locator('#togglePassword').click();
    await check('Password visibility reports its current action and state',async()=>{
      assert.equal(await login.locator('#togglePassword').getAttribute('aria-label'),'Hide password');
      assert.equal(await login.locator('#togglePassword').getAttribute('aria-pressed'),'true');
    });
    await login.evaluate(()=>{KagieAPI.login=async()=>{throw new Error('SQL Supabase configuration rejected internal details');};});
    await login.locator('#email').fill('student@test.invalid');
    await login.locator('#loginBtn').click();
    await login.locator('#loginBtn:enabled').waitFor();
    await check('Auth failures use a helpful message and restore the form',async()=>assert.doesNotMatch(await login.locator('#message').innerText(),/SQL|Supabase|configuration|internal/));
    // Exercise the complete UI journey in the existing local-auth mode.
    // Production email confirmation and OAuth are outside this isolated fixture.
    const signupContext=await contextFor('public');
    const signup=await signupContext.newPage();
    signup.on('pageerror',error=>errors.push({route:signup.url(),message:error.message}));
    await signup.goto(harness.base+'/signup.html?next=Dashboard.html');
    await signup.getByLabel('Full name',{exact:true}).fill('Synthetic New Learner');
    await signup.getByLabel('Email address',{exact:true}).fill('new-learner@test.invalid');
    await signup.getByLabel('Create a password',{exact:true}).fill('synthetic-password');
    await signup.getByLabel('High school',{exact:true}).fill('Synthetic Test School');
    await signup.evaluate(()=>{
      const register=KagieAPI.registerUser;
      window.signupCalls=0;
      KagieAPI.registerUser=async(...args)=>{signupCalls++;return register(...args);};
      document.getElementById('dob').value='01 / 01 / 2099';
      document.getElementById('dob').dataset.isoValue='2099-01-01';
    });
    await signup.locator('#signupBtn').click();
    await signup.locator('#signupBtn:enabled').waitFor();
    await check('Signup rejects a future birth date before registering an account',async()=>{
      assert.match(await signup.locator('#message').innerText(),/future/);
      assert.equal(await signup.evaluate(()=>signupCalls),0);
    });
    // Validation focuses the current wheel picker; close its dialog before editing the fixture date.
    await signup.getByRole('button',{name:'Close date picker',exact:true}).click();
    await signup.evaluate(()=>{
      document.getElementById('dob').value='01 / 01 / 2006';
      document.getElementById('dob').dataset.isoValue='2006-01-01';
    });
    await signup.locator('#signupBtn').click();
    await signup.waitForURL('**/Dashboard.html');
    await check('Local-fixture registration reaches the learner dashboard with the saved profile',async()=>{
      const user=await signup.evaluate(()=>KagieAPI.currentUser());
      assert.equal(user.fullName,'Synthetic New Learner');
      assert.equal(await signup.evaluate(()=>KagieAPI.getProfile(KagieAPI.currentUser().id).dob),'2006-01-01');
    });
    await signup.evaluate(()=>KagieAPI.logout());
    await signup.goto(harness.base+'/login.html?app=1&next=Dashboard.html');
    await signup.getByLabel('Email address',{exact:true}).fill('new-learner@test.invalid');
    await signup.getByLabel('Password',{exact:true}).fill('synthetic-password');
    await signup.locator('#loginBtn').click();
    await signup.waitForURL('**/Dashboard.html');
    await check('A registered local-fixture learner can sign out, log in and reopen the dashboard',async()=>assert.equal(await signup.evaluate(()=>KagieAPI.currentUser().fullName),'Synthetic New Learner'));
    const support = await learner.newPage();
    if (process.argv.includes('--diagnose')) support.on('console',message=>{
      if (['warning','error'].includes(message.type())) console.log('Support diagnostic: '+message.text());
    });
    support.on('pageerror',error=>errors.push({route:'/personal-assistance.html',message:error.message}));
    await support.goto(harness.base+'/personal-assistance.html');
    await support.locator('#ticketMeta').filter({hasText:/support ticket/}).waitFor();
    await support.locator('#newTicketBtn:enabled').waitFor();
    await support.evaluate(()=>{
      const read=KagieAPI.getSupportTicketsAsync;
      window.holdSupportRead=true;
      KagieAPI.getSupportTicketsAsync=async(...args)=>{
        const hold=window.holdSupportRead;
        window.holdSupportRead=false;
        const rows=await read(...args);
        if(hold)await new Promise(resolve=>{window.releaseStaleSupportRead=resolve;});
        return rows;
      };
    });
    await support.locator('#newTicketBtn').click();
    await support.waitForFunction(()=>!!window.releaseStaleSupportRead);
    await support.locator('#ticketSubject').fill('Synthetic frontend support check');
    await support.locator('#messageInput').fill('Please help with this isolated test application.');
    await support.locator('#sendBtn').click();
    await support.locator('#messages').getByText('Please help with this isolated test application.',{exact:false}).waitFor();
    await check('Support creates a ticket and message through the real SDK and owned SQL records',async()=>{
      const rows=(await harness.db.query('select t.user_id,m.message from support_threads t join support_messages m on m.thread_id=t.id where t.subject=$1',['Synthetic frontend support check'])).rows;
      assert.equal(rows.length,1);
      assert.equal(rows[0].user_id,harness.ids.learner);
      assert.equal(rows[0].message,'Please help with this isolated test application.');
    });
    await support.evaluate(()=>window.releaseStaleSupportRead());
    await support.waitForTimeout(160);
    await check('A stale support refresh cannot replace the newly created ticket or its messages',async()=>{
      assert.match(await support.locator('#messages').innerText(),/isolated test application/);
      assert.match(await support.locator('#tickets .active').innerText(),/Synthetic frontend support check/);
    });
    await support.reload();
    await support.locator('#tickets').getByRole('button').filter({hasText:'Synthetic frontend support check'}).click();
    await support.locator('#messages').getByText('Please help with this isolated test application.',{exact:false}).waitFor();
    await check('Support conversation survives session restoration and a reload',async()=>assert.match(await support.locator('#messages').innerText(),/isolated test application/));
    await support.locator('#callbackPhone').fill('0712345678');
    await support.locator('#callbackReason').fill('Synthetic frontend callback check');
    await support.locator('#callbackBtn').click();
    await support.locator('#callbacks').filter({hasText:'Synthetic frontend callback check'}).waitFor();
    await check('Support callback is persisted through the real SDK to the owned SQL record',async()=>{
      const rows=(await harness.db.query('select user_id,phone from callback_requests where note=$1',['Synthetic frontend callback check'])).rows;
      assert.equal(rows.length,1);
      assert.equal(rows[0].user_id,harness.ids.learner);
      assert.equal(rows[0].phone,'0712345678');
    });
    await support.evaluate(()=>{KagieAPI.replySupportTicketAsync=async()=>{throw new Error('SQL internal support message rejection');};});
    await support.locator('#messageInput').fill('Keep this unsent message.');
    await support.locator('#sendBtn').click();
    await support.locator('#heroText').filter({hasText:'Your text is still here'}).waitFor();
    await check('Failed support send retains the message, restores controls and hides technical details',async()=>{
      assert.equal(await support.locator('#messageInput').inputValue(),'Keep this unsent message.');
      assert.equal(await support.locator('#sendBtn').isEnabled(),true);
      assert.doesNotMatch(await support.locator('#heroText').innerText(),/SQL|internal|rejection/);
    });
    await support.evaluate(()=>{KagieAPI.requestCallbackAsync=async()=>{throw new Error('SQL internal callback rejection');};});
    await support.locator('#callbackPhone').fill('0712345678');
    await support.locator('#callbackReason').fill('Keep this callback request.');
    await support.locator('#callbackBtn').click();
    await support.locator('#heroText').filter({hasText:'Your details are still here'}).waitFor();
    await check('Failed callback retains the request, restores controls and hides technical details',async()=>{
      assert.equal(await support.locator('#callbackReason').inputValue(),'Keep this callback request.');
      assert.equal(await support.locator('#callbackBtn').isEnabled(),true);
      assert.doesNotMatch(await support.locator('#heroText').innerText(),/SQL|internal|rejection/);
    });
    await support.evaluate(()=>{KagieAPI.replySupportTicketAsync=async(...args)=>KagieAPI.replySupportTicket(...args);});
    await support.locator('#messageInput').fill('Device-only reply for recovery.');
    await support.locator('#sendBtn').click();
    await support.locator('#heroText').filter({hasText:'saved on this device only'}).waitFor();
    await check('A device-only support reply is identified and its text remains available for retry',async()=>{
      assert.match(await support.locator('#heroText').innerText(),/has not reached Kagie support/);
      assert.equal(await support.locator('#messageInput').inputValue(),'Device-only reply for recovery.');
    });
    await support.evaluate(()=>{KagieAPI.requestCallbackAsync=async(payload)=>KagieAPI.requestCallback(payload);});
    await support.locator('#callbackReason').fill('Device-only callback for recovery.');
    await support.locator('#callbackBtn').click();
    await support.locator('#heroText').filter({hasText:'callback request was saved on this device only'}).waitFor();
    await check('A device-only callback retains its details and never announces successful delivery',async()=>{
      assert.equal(await support.locator('#callbackReason').inputValue(),'Device-only callback for recovery.');
      const notice=await support.evaluate(()=>KagieAPI.getNotifications().find(item=>item.title==='Callback saved on this device'));
      assert.ok(notice);
      assert.match(notice.message,/has not reached Kagie support/);
    });
    await support.evaluate(()=>{KagieAPI.getSupportTicketsAsync=async()=>{throw new Error('SQL internal refresh rejection');};});
    await support.locator('#refreshBtn').click();
    await support.locator('#refreshBtn:not([aria-busy=true])').waitFor();
    await check('Support refresh failures preserve the cached conversation without uncaught errors',async()=>{
      assert.match(await support.locator('#messages').innerText(),/isolated test application/);
      assert.doesNotMatch(await support.locator('#heroText').innerText(),/SQL|internal|rejection/);
    });
    await support.locator('#newTicketBtn').click();
    await support.evaluate(()=>{KagieAPI.createSupportTicketAsync=async(payload)=>KagieAPI.createSupportTicket(payload);});
    await support.locator('#ticketSubject').fill('Device-only ticket for recovery');
    await support.locator('#messageInput').fill('Keep the first message for retry.');
    await support.locator('#sendBtn').click();
    await support.locator('#heroText').filter({hasText:'has not reached Kagie support'}).waitFor();
    await check('A device-only new ticket keeps its subject and first message ready for a connected retry',async()=>{
      assert.equal(await support.locator('#ticketSubject').inputValue(),'Device-only ticket for recovery');
      assert.equal(await support.locator('#messageInput').inputValue(),'Keep the first message for retry.');
    });
    const partialSupport=await learner.newPage();
    partialSupport.on('pageerror',error=>errors.push({route:'/personal-assistance.html',message:error.message}));
    await partialSupport.goto(harness.base+'/personal-assistance.html');
    await partialSupport.locator('#ticketMeta').filter({hasText:/support ticket/}).waitFor();
    await partialSupport.locator('#newTicketBtn').click();
    await partialSupport.route('**/rest/v1/support_messages*',route=>route.request().method()==='POST'
      ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic first-message outage'})})
      : route.continue());
    await partialSupport.locator('#ticketSubject').fill('Partial support save for recovery');
    await partialSupport.locator('#messageInput').fill('Keep the initial message after a partial save.');
    await partialSupport.locator('#sendBtn').click();
    await partialSupport.locator('#heroText').filter({hasText:'its message has not been sent'}).waitFor();
    await check('A partial support save retains the initial message and identifies the existing ticket',async()=>{
      assert.equal(await partialSupport.locator('#messageInput').inputValue(),'Keep the initial message after a partial save.');
      const rows=(await harness.db.query('select t.id,m.id as message_id from support_threads t left join support_messages m on m.thread_id=t.id where t.subject=$1',['Partial support save for recovery'])).rows;
      assert.equal(rows.length,1);
      assert.equal(rows[0].message_id,null);
    });
    await partialSupport.unroute('**/rest/v1/support_messages*');
    await partialSupport.locator('#sendBtn').click();
    await partialSupport.locator('#messages').filter({hasText:'Keep the initial message after a partial save.'}).waitFor();
    await check('Retrying a partial support save sends the first message without duplicating its ticket',async()=>{
      const rows=(await harness.db.query('select t.id,m.message from support_threads t left join support_messages m on m.thread_id=t.id where t.subject=$1',['Partial support save for recovery'])).rows;
      assert.equal(rows.length,1);
      assert.equal(rows[0].message,'Keep the initial message after a partial save.');
      assert.equal(await partialSupport.locator('#messageInput').inputValue(),'');
    });
    const freshProfileContext = await contextFor('learner');
    const profilePage = await freshProfileContext.newPage();
    profilePage.on('pageerror',error=>errors.push({route:'/profile.html',message:error.message}));
    await profilePage.goto(harness.base+'/profile.html');
    await profilePage.locator('#saveBtn:enabled').waitFor();
    await check('Profile restores a live session and loads documents and applications on a fresh device',async()=>{
      assert.equal(await profilePage.locator('#fullName').inputValue(),'Lerato Learner');
      assert.equal(await profilePage.locator('#docCount').innerText(),'02');
      assert.equal(await profilePage.locator('#appCount').innerText(),'01');
    });
    await profilePage.locator('#fullName').fill('Lerato Profile Test');
    await profilePage.locator('#address').fill('Synthetic profile address');
    await profilePage.locator('#saveBtn').click();
    await profilePage.getByRole('status').filter({hasText:'Profile updated successfully'}).waitFor();
    await check('Profile save persists through the Supabase SDK to the owned SQL records',async()=>{
      const name=(await harness.db.query('select full_name from profiles where id=$1',[harness.ids.learner])).rows[0].full_name;
      const address=(await harness.db.query('select address from user_profiles where user_id=$1',[harness.ids.learner])).rows[0].address;
      assert.equal(name,'Lerato Profile Test');
      assert.equal(address,'Synthetic profile address');
    });
    await profilePage.reload();
    await profilePage.locator('#saveBtn:enabled').waitFor();
    await check('Profile reload restores the saved remote fields',async()=>assert.equal(await profilePage.locator('#address').inputValue(),'Synthetic profile address'));
    await profilePage.evaluate(()=>{KagieAPI.saveProfileAsync=async()=>{throw new Error('Synthetic profile outage');};});
    await profilePage.locator('#fullName').fill('Unsaved profile edit');
    await profilePage.locator('#saveBtn').click();
    await profilePage.getByRole('status').filter({hasText:'Your changes are still here'}).waitFor();
    await check('Profile errors retain edits and restore the save action',async()=>{
      assert.equal(await profilePage.locator('#fullName').inputValue(),'Unsaved profile edit');
      assert.equal(await profilePage.locator('#saveBtn').isEnabled(),true);
    });
    await harness.db.query('update documents set file_name=$1 where id=$2',['<img src=x onerror=alert(1)>',harness.doc]);
    await profilePage.reload();
    await profilePage.locator('#saveBtn:enabled').waitFor();
    await check('Document filenames render as text instead of executable HTML',async()=>assert.equal(await profilePage.locator('#docs img').count(),0));
    await check('Browser checks have no uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
  } finally {
    const recordName=process.argv.includes('--interactions-only')?'checks-interactions.json':'checks.json';
    fs.writeFileSync(path.join(out,recordName),JSON.stringify({createdAt:new Date().toISOString(),widths,checks,layouts,failures,errors},null,2));
    await browser.close();
    await harness.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
