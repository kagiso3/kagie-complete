/* Account UI verification with synthetic browser storage and intercepted Auth.
 * Every external request is blocked. Recovery requests never send real email.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'reports/auth-experience');
const widths = [320, 390, 600, 768, 820, 1024, 1440];
const pages = [
  { route: '/login.html?app=1', key: 'login', heading: 'Welcome back', action: 'Log in' },
  { route: '/signup.html', key: 'signup', heading: 'Create your account', action: 'Create account' },
  { route: '/forgot-password.html', key: 'forgot-password', heading: 'Reset your password', action: 'Send reset link' },
  { route: '/changepassword.html', key: 'changepassword', heading: 'Choose a new password', action: 'Save password' }
];
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
async function startServer() {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, body) => {
      response.writeHead(error ? 404 : 200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
      response.end(error ? 'Fixture file unavailable.' : body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {base:'http://127.0.0.1:' + server.address().port, close:() => new Promise(resolve=>server.close(resolve))};
}
async function main() {
  fs.mkdirSync(out, {recursive:true});
  const server = await startServer();
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const contexts = [], checks = [], layouts = [], errors = [], recoveryRequests = [], blocked = [];
  let failure;
  async function check(name, action) {
    await action(); checks.push(name); console.log('PASS ' + name);
  }
  async function createContext({remoteReset = false, destinations = false} = {}) {
    const context = await browser.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'});
    contexts.push(context);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js@')) {
        return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),'utf8')});
      }
      if (url.hostname !== '127.0.0.1') {
        blocked.push(url.origin + url.pathname);
        return route.fulfill({body:'',contentType:request.resourceType()==='stylesheet'?'text/css':'text/javascript'});
      }
      if (url.pathname === '/js/supabase-config.js') {
        const configuration = remoteReset ? {enabled:true,url:server.base,anonKey:'synthetic-auth-only'} : {enabled:false};
        return route.fulfill({contentType:'text/javascript',body:`window.KagieAPI.configureSupabase(${JSON.stringify(configuration)});`});
      }
      if (destinations && /\/(?:home|Dashboard|apply|checkout)\.html$|\/(?:master-admin|assistant)\/dashboard\.html$/.test(url.pathname)) {
        return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated destination</title><main>Account routing destination</main>'});
      }
      if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic auth service unavailable.'})});
      return route.continue();
    });
    context.on('page', page => page.on('pageerror', error => errors.push({url:page.url(),message:error.message})));
    return context;
  }
  const messageMatches = async (page, pattern) => {
    await page.waitForFunction(source => new RegExp(source,'i').test(document.getElementById('message')?.textContent || ''), pattern.source);
  };
  const submitTwice = page => page.evaluate(() => {
    const form=document.querySelector('form');
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  });
  const setDob = (page, iso) => page.evaluate(value => {
    window.KagieDobWheel?.close();
    const field=document.getElementById('dob');
    field.value=value;field.dataset.isoValue=value;
    field.dispatchEvent(new Event('input',{bubbles:true}));
  }, iso);
  async function fillSignup(page) {
    await page.locator('#fullName').fill('Synthetic Kagie Learner');
    await page.locator('#email').fill('new-learner@test.invalid');
    await page.locator('#password').fill('synthetic-password');
    await page.locator('#schoolAttended').fill('Synthetic Test High School');
    await setDob(page, '2006-01-01');
  }
  try {
    const visitor = await createContext();
    for (const item of pages) {
      const page=await visitor.newPage();
      for (const width of widths) {
        await page.setViewportSize({width,height:width<768?844:1000});
        await page.goto(server.base+item.route,{waitUntil:'domcontentloaded'});
        await page.getByRole('heading',{level:1,name:item.heading,exact:true}).waitFor();
        const result=await page.evaluate(() => {
          const visible=node=>!!node.getClientRects().length && getComputedStyle(node).visibility!=='hidden';
          const card=document.querySelector('.auth-card,.card');
          const submit=document.querySelector('button[type=submit]');
          const controls=[...document.querySelectorAll('form input:not([type=checkbox]),form button')].filter(visible);
          const inputs=[...document.querySelectorAll('input:not([type=checkbox]):not([type=hidden])')].filter(visible);
          return {
            width:innerWidth,documentWidth:document.documentElement.scrollWidth,
            cardWidth:card.getBoundingClientRect().width,cardRadius:getComputedStyle(card).borderRadius,
            font:getComputedStyle(document.body).fontFamily,inputRadius:inputs.map(node=>getComputedStyle(node).borderRadius),
            smallInputs:inputs.filter(node=>parseFloat(getComputedStyle(node).fontSize)<16).map(node=>node.id),
            smallTargets:controls.filter(node=>node.getBoundingClientRect().height<43).map(node=>node.id),
            unlabelled:inputs.filter(node=>!document.querySelector(`label[for="${node.id}"]`)).map(node=>node.id),
            buttonBackground:getComputedStyle(submit).backgroundImage,
            bodyBackground:getComputedStyle(document.body).backgroundImage,
            red1:getComputedStyle(document.body).getPropertyValue('--red1').trim(),
            red2:getComputedStyle(document.body).getPropertyValue('--red2').trim()
          };
        });
        layouts.push({page:item.key,...result});
        assert.ok(result.documentWidth<=width+1,item.key+' document overflows at '+width);
        assert.deepEqual(result.smallInputs,[],item.key+' unreadable inputs at '+width);
        assert.deepEqual(result.smallTargets,[],item.key+' small targets at '+width);
        assert.deepEqual(result.unlabelled,[],item.key+' unlabelled fields');
        if(item.key==='changepassword') assert.match(result.buttonBackground,/rgb\(253, 5, 5\).*rgb\(253, 5, 5\)/);
        else {
          assert.equal(result.red1,'#fd0505');assert.equal(result.red2,'#fd0505');
          assert.match(result.buttonBackground,/rgb\(253, 5, 5\).*rgb\(253, 5, 5\)/);
        }
        await page.getByRole('button',{name:item.action,exact:true}).waitFor();
        if ([390,820,1440].includes(width)) await page.screenshot({path:path.join(out,item.key+'-'+width+'.png'),fullPage:true});
      }
      await page.close();
      await check(item.key+' fits seven phone, tablet and desktop widths with the requested button colors',async()=>{});
    }
    await check('Account typography remains consistent; login uses the supplied reference radii',async()=>{
      assert.equal(new Set(layouts.map(row=>row.font)).size,1);
      assert.equal(new Set(layouts.filter(row=>row.page!=='login').flatMap(row=>row.inputRadius)).size,1);
      assert.ok(layouts.filter(row=>row.page==='login').every(row=>row.inputRadius.every(radius=>radius==='14px')));
      assert.equal(new Set(layouts.filter(row=>row.page!=='login').map(row=>row.cardRadius)).size,1);
      assert.ok(layouts.filter(row=>row.page==='login').every(row=>row.cardRadius===(row.width<=479?'20px':'23px')));
    });
    const pickerPage=await visitor.newPage();
    await pickerPage.goto(server.base+'/signup.html');
    await setDob(pickerPage,'2006-01-01');
    for (const width of [320,390,820,1440]) {
      await pickerPage.setViewportSize({width,height:width<768?844:1000});
      await pickerPage.locator('#dob').click();
      await pickerPage.getByRole('dialog',{name:'Choose date of birth'}).waitFor();
      assert.ok(await pickerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok(await pickerPage.locator('.kdob-sheet').evaluate(node=>node.getBoundingClientRect().right<=innerWidth+1));
      if([390,1440].includes(width))await pickerPage.screenshot({path:path.join(out,'signup-date-picker-'+width+'.png'),fullPage:true});
      await pickerPage.getByRole('button',{name:'Use date',exact:true}).click();
      assert.equal(await pickerPage.getByRole('dialog',{name:'Choose date of birth'}).isVisible(),false);
      assert.equal(await pickerPage.locator('#dob').getAttribute('data-iso-value'),'2006-01-01');
    }
    await check('Birth-date picker opens, fits and confirms consistently on phones and desktop',async()=>{});
    const login=await visitor.newPage();
    await login.goto(server.base+'/login.html');
    await check('Direct login link opens the account screen',async()=>await login.getByRole('heading',{name:'Welcome back',exact:true}).waitFor());
    await login.locator('#loginBtn').click();
    await check('Missing login details focus the first invalid field',async()=>{
      await messageMatches(login,/email/);
      assert.equal(await login.evaluate(()=>document.activeElement.id),'email');
      assert.equal(await login.locator('#email').getAttribute('aria-invalid'),'true');
    });
    await login.locator('#email').fill('not-an-email');
    await login.locator('#password').fill('synthetic-password');
    await login.evaluate(()=>{window.loginCalls=0;KagieAPI.login=async()=>{loginCalls++;throw new Error('Synthetic unreachable call');};});
    await login.locator('#loginBtn').click();
    await check('Invalid login email is rejected before calling the API',async()=>{
      await messageMatches(login,/valid email/);assert.equal(await login.evaluate(()=>loginCalls),0);
    });
    await login.locator('#togglePassword').click();
    await check('Password reveal exposes an accurate accessible action',async()=>{
      assert.equal(await login.locator('#password').getAttribute('type'),'text');
      assert.equal(await login.locator('#togglePassword').getAttribute('aria-label'),'Hide password');
      assert.equal(await login.locator('#togglePassword').getAttribute('aria-pressed'),'true');
    });
    await login.locator('#email').fill('learner@test.invalid');
    await login.evaluate(()=>{KagieAPI.login=async()=>{loginCalls++;await new Promise(resolve=>window.releaseLogin=resolve);throw new Error('Failed to fetch synthetic internal JWT configuration');};});
    await submitTwice(login);
    await login.waitForFunction(()=>!!window.releaseLogin);
    await check('Login prevents duplicate requests and disables all account controls while pending',async()=>{
      assert.equal(await login.evaluate(()=>loginCalls),1);
      for (const id of ['email','password','togglePassword','rememberSession','loginBtn']) assert.equal(await login.locator('#'+id).isDisabled(),true,id);
      assert.equal(await login.locator('#loginForm').getAttribute('aria-busy'),'true');
    });
    await login.evaluate(()=>releaseLogin());
    await login.locator('#loginBtn:enabled').waitFor();
    await check('Failed login retains edits, offers retry and hides technical details',async()=>{
      assert.equal(await login.locator('#email').inputValue(),'learner@test.invalid');
      assert.equal(await login.locator('#password').inputValue(),'synthetic-password');
      assert.match(await login.locator('#message').innerText(),/connection|connect|internet/i);
      assert.doesNotMatch(await login.locator('#message').innerText(),/JWT|configuration|internal/);
      assert.equal(await login.locator('#loginBtn').innerText(),'Log in');
    });
    const signupContext=await createContext({destinations:true});
    const signup=await signupContext.newPage();
    await signup.goto(server.base+'/signup.html?next=apply.html%3Ftype%3Dtransfer');
    await signup.locator('#signupBtn').click();
    await check('Empty registration focuses and identifies the first required field',async()=>{
      assert.equal(await signup.evaluate(()=>document.activeElement.id),'fullName');
      assert.equal(await signup.locator('#fullName').getAttribute('aria-invalid'),'true');
    });
    await fillSignup(signup);
    await signup.locator('#password').fill('short');
    await signup.evaluate(()=>{window.signupCalls=0;const original=KagieAPI.registerUser;window.actualRegister=original;KagieAPI.registerUser=async(...args)=>{signupCalls++;return original(...args);};});
    await signup.locator('#signupBtn').click();
    await check('Registration requires six password characters before API calls',async()=>{
      await messageMatches(signup,/6|six/);assert.equal(await signup.evaluate(()=>signupCalls),0);
      assert.equal(await signup.evaluate(()=>document.activeElement.id),'password');
    });
    await signup.locator('#password').fill('synthetic-password');
    await signup.locator('#email').fill('invalid-address');
    await signup.locator('#signupBtn').click();
    await check('Registration rejects invalid email and identifies the email field',async()=>{
      await messageMatches(signup,/valid email/);assert.equal(await signup.evaluate(()=>signupCalls),0);
      assert.equal(await signup.evaluate(()=>document.activeElement.id),'email');
      assert.equal(await signup.locator('#email').getAttribute('aria-invalid'),'true');
    });
    await signup.locator('#email').fill('new-learner@test.invalid');
    await signup.locator('#schoolAttended').fill('');
    await signup.locator('#signupBtn').click();
    await check('Registration keeps school details required before creating the learner profile',async()=>{
      await messageMatches(signup,/school/);assert.equal(await signup.evaluate(()=>signupCalls),0);
      assert.equal(await signup.evaluate(()=>document.activeElement.id),'schoolAttended');
    });
    await signup.locator('#schoolAttended').fill('Synthetic Test High School');
    for (const [value,pattern] of [['2099-01-01',/future/],['2020-01-01',/13/],['2006-02-31',/valid|date/]]) {
      await setDob(signup,value);await signup.locator('#signupBtn').click();
      await messageMatches(signup,pattern);
      assert.equal(await signup.evaluate(()=>signupCalls),0);
      assert.equal(await signup.locator('#dob').getAttribute('aria-invalid'),'true');
    }
    await check('Invalid, future and under-age birth dates cannot create an account',async()=>{});
    await setDob(signup,'2006-01-01');
    await signup.evaluate(()=>{KagieAPI.registerUser=async()=>{signupCalls++;await new Promise(resolve=>window.releaseSignup=resolve);throw new Error('Failed to fetch synthetic configuration');};});
    await submitTwice(signup);await signup.waitForFunction(()=>!!window.releaseSignup);
    await check('Registration locks the form and ignores repeated submit events',async()=>{
      assert.equal(await signup.evaluate(()=>signupCalls),1);
      assert.equal(await signup.locator('#signupForm').getAttribute('aria-busy'),'true');
      assert.equal(await signup.locator('#dob').isDisabled(),true);
    });
    await signup.evaluate(()=>releaseSignup());await signup.locator('#signupBtn:enabled').waitFor();
    await check('Registration failure keeps all entered data available for retry',async()=>{
      assert.equal(await signup.locator('#fullName').inputValue(),'Synthetic Kagie Learner');
      assert.equal(await signup.locator('#email').inputValue(),'new-learner@test.invalid');
      assert.equal(await signup.locator('#schoolAttended').inputValue(),'Synthetic Test High School');
      assert.equal(await signup.locator('#dob').getAttribute('data-iso-value'),'2006-01-01');
      assert.equal(await signup.locator('#signupBtn').innerText(),'Create account');
      assert.doesNotMatch(await signup.locator('#message').innerText(),/configuration|internal|Supabase/);
    });
    const verificationContext=await createContext();
    const verification=await verificationContext.newPage();
    await verification.goto(server.base+'/signup.html?next=checkout.html');
    await fillSignup(verification);
    await verification.evaluate(()=>{
      KagieAPI.registerUser=async()=>({id:'synthetic-unconfirmed-learner',source:'supabase',role:'user'});
      KagieAPI.getSupabaseSession=async()=>null;
    });
    await verification.locator('#signupBtn').click();
    await verification.locator('#signupSuccess').waitFor();
    await check('Unconfirmed registration shows an email next step and explicit login action',async()=>{
      assert.equal(new URL(verification.url()).pathname,'/signup.html');
      assert.match(await verification.locator('#signupSuccess').innerText(),/email/i);
      const loginTarget=new URL(await verification.locator('#signupLoginButton').getAttribute('href'),server.base);
      assert.equal(loginTarget.pathname,'/login.html');assert.equal(loginTarget.searchParams.get('next'),'checkout.html');
    });
    await verification.screenshot({path:path.join(out,'signup-verification-390.png'),fullPage:true});
    const remoteSignupContext = await createContext({remoteReset:true});
    let remoteSignupCalls = 0;
    await remoteSignupContext.route('**/auth/v1/signup*', async route => {
      remoteSignupCalls++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        user:{id:'a087a2e0-0000-4000-8000-000000000001',email:'new-learner@test.invalid',aud:'authenticated',role:'authenticated',user_metadata:{full_name:'Synthetic Kagie Learner'},identities:[]},session:null
      })});
    });
    const remoteSignup = await remoteSignupContext.newPage();
    await remoteSignup.goto(server.base+'/signup.html?next=checkout.html');
    await fillSignup(remoteSignup);
    await remoteSignup.locator('#signupBtn').click();
    await remoteSignup.locator('#signupSuccess').waitFor();
    await check('Actual SDK registration without an email-confirmed session never activates a learner session', async () => {
      assert.equal(remoteSignupCalls,1);
      assert.equal(await remoteSignup.evaluate(() => KagieAPI.currentUser()),null);
      assert.equal(await remoteSignup.evaluate(() => KagieAPI.restoreSession()),null);
      await remoteSignup.goto(server.base+'/login.html?app=1&next=checkout.html');
      await remoteSignup.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
      assert.equal(new URL(remoteSignup.url()).pathname,'/login.html');
    });
    await signup.evaluate(()=>{KagieAPI.registerUser=actualRegister;});
    await signup.locator('#signupBtn').click();
    await signup.waitForURL('**/apply.html?type=transfer',{timeout:10000});
    await check('Real local registration preserves a safe application return destination',async()=>{
      // Sign out and reuse the actual stored credentials to confirm the
      // registration record survives the account-screen transition.
      await signup.goto(server.base+'/login.html?app=1&switch=1&next=apply.html%3Ftype%3Dtransfer');
      await signup.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
      await signup.locator('#email').fill('new-learner@test.invalid');
      await signup.locator('#password').fill('synthetic-password');
      await signup.locator('#loginBtn').click();
      await signup.waitForURL('**/apply.html?type=transfer');
    });
    const routingContext=await createContext({destinations:true});
    const routing=await routingContext.newPage();
    for (const [role,expected,next] of [
      ['master_admin','/master-admin/dashboard.html','Dashboard.html'],
      ['assistant_admin','/assistant/dashboard.html','Dashboard.html'],
      ['user','/home.html','https://outside.test.invalid/'],
      ['user','/home.html','master-admin/dashboard.html'],
      ['user','/checkout.html','checkout.html']
    ]) {
      await routing.goto(server.base+'/login.html?app=1&next='+encodeURIComponent(next));
      await routing.evaluate(value=>{KagieAPI.login=async()=>({id:'synthetic-route-user',fullName:'Routing Test',role:value});},role);
      await routing.locator('#email').fill('route@test.invalid');await routing.locator('#password').fill('synthetic-password');
      await routing.locator('#loginBtn').click();await routing.waitForURL(server.base+expected);
    }
    await check('Role routing keeps master, assistant and learner destinations separate and rejects unsafe return URLs',async()=>{});
    const recoveryContext=await createContext({remoteReset:true});
    let recoveryMode='pending', releaseRecovery;
    await recoveryContext.route('**/auth/v1/recover*',async route=>{
      recoveryRequests.push({url:route.request().url(),body:route.request().postDataJSON()});
      if(recoveryMode==='pending')await new Promise(resolve=>releaseRecovery=resolve);
      if(recoveryMode==='failure')return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Invalid API key synthetic Supabase configuration',error_code:'bad_jwt'})});
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });
    const recovery=await recoveryContext.newPage();
    await recovery.goto(server.base+'/forgot-password.html?next=checkout.html');
    await recovery.locator('#email').fill('invalid-address');await recovery.locator('#resetBtn').click();
    await check('Recovery validates email before requesting a reset link',async()=>{
      await messageMatches(recovery,/valid email/);assert.equal(recoveryRequests.length,0);
      assert.equal(await recovery.evaluate(()=>document.activeElement.id),'email');
    });
    await recovery.locator('#email').fill('  Learner@Test.Invalid  ');
    await submitTwice(recovery);
    const recoveryDeadline=Date.now()+5000;
    while(!releaseRecovery&&Date.now()<recoveryDeadline)await recovery.waitForTimeout(25);
    assert.equal(typeof releaseRecovery,'function','Recovery request did not reach the local Auth fixture');
    await check('Recovery sends one real SDK request while displaying a disabled pending form',async()=>{
      assert.equal(recoveryRequests.length,1);
      assert.equal(recoveryRequests[0].body.email,'learner@test.invalid');
      const redirectTo=new URL(new URL(recoveryRequests[0].url).searchParams.get('redirect_to'));
      assert.equal(redirectTo.origin,server.base);
      assert.equal(redirectTo.pathname,'/changepassword.html');
      assert.equal(redirectTo.searchParams.get('next'),'checkout.html');
      assert.equal(await recovery.locator('#email').isDisabled(),true);
      assert.equal(await recovery.locator('#resetBtn').isDisabled(),true);
      assert.equal(await recovery.locator('#resetForm').getAttribute('aria-busy'),'true');
    });
    recoveryMode='failure';releaseRecovery();await recovery.locator('#resetBtn:enabled').waitFor();
    await check('Recovery service failure retains the address and offers a friendly retry',async()=>{
      assert.equal((await recovery.locator('#email').inputValue()).trim().toLowerCase(),'learner@test.invalid');
      assert.doesNotMatch(await recovery.locator('#message').innerText(),/Supabase|API key|JWT|configuration/);
      assert.equal(await recovery.locator('#resetBtn').innerText(),'Send reset link');
    });
    recoveryMode='success';await recovery.locator('#resetBtn').click();
    await recovery.locator('#resetSuccess').waitFor();
    await check('Recovery success gives an account-neutral confirmation and preserves the address',async()=>{
      assert.equal(recoveryRequests.length,2);
      assert.equal((await recovery.locator('#email').inputValue()).trim().toLowerCase(),'learner@test.invalid');
      assert.match(await recovery.locator('#resetSuccess').innerText(),/if/i);
      assert.equal(await recovery.locator('#resetForm').isVisible(),false);
      assert.equal(await recovery.locator('#resetEmail').innerText(),'learner@test.invalid');
    });
    await recovery.screenshot({path:path.join(out,'forgot-password-success-390.png'),fullPage:true});
    await recovery.locator('#tryAnotherEmail').click();
    await check('Try another email restores the recovery form and focuses the retained address', async () => {
      assert.equal(await recovery.locator('#resetSuccess').isVisible(),false);
      assert.equal(await recovery.locator('#resetForm').isVisible(),true);
      assert.equal(await recovery.evaluate(() => document.activeElement.id),'email');
      assert.equal((await recovery.locator('#email').inputValue()).trim().toLowerCase(),'learner@test.invalid');
    });
    await check('Recovery links keep the safe return destination across login and signup',async()=>{
      const links=await recovery.locator('a[href*="login.html"],a[href*="signup.html"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
      assert.ok(links.length>=2);
      for (const link of links) assert.equal(new URL(link,server.base).searchParams.get('next'),'checkout.html');
    });
    const localRecovery=await visitor.newPage();await localRecovery.goto(server.base+'/forgot-password.html');
    await localRecovery.evaluate(()=>{KagieAPI.requestPasswordReset=async()=>({email:'local@test.invalid',localOnly:true});});
    await localRecovery.locator('#email').fill('local@test.invalid');await localRecovery.locator('#resetBtn').click();
    await check('Device-only recovery never claims a reset email was sent',async()=>{
      await localRecovery.locator('#resetBtn:enabled').waitFor();
      assert.doesNotMatch(await localRecovery.locator('#message').innerText(),/^Reset link sent|^Link sent/i);
      assert.match(await localRecovery.locator('#message').innerText(),/unavailable|could not|not sent|not.*send|only.*device|only.*browser/i);
      assert.equal(await localRecovery.locator('#email').inputValue(),'local@test.invalid');
    });
    const changeContext=await createContext({destinations:true});
    const change=await changeContext.newPage();
    const changeNavigations=[];
    change.on('request',request=>{if(request.isNavigationRequest()&&new URL(request.url()).pathname==='/login.html')changeNavigations.push(request.url());});
    await change.goto(server.base+'/changepassword.html?next=checkout.html');
    await change.evaluate(()=>{window.changeCalls=0;KagieAPI.updateAuthenticatedPassword=async()=>{changeCalls++;throw new Error('Synthetic unreachable call');};});
    await change.locator('#newPassword').fill('short');await change.locator('#confirmPassword').fill('short');
    await change.locator('#saveBtn').click();
    await check('New-password form uses the same six-character minimum as signup',async()=>{
      await messageMatches(change,/6|six/);assert.equal(await change.evaluate(()=>changeCalls),0);
      assert.equal(await change.evaluate(()=>document.activeElement.id),'newPassword');
    });
    await change.locator('#newPassword').fill('synthetic-new-password');await change.locator('#confirmPassword').fill('another-password');
    await change.locator('#saveBtn').click();
    await check('Password mismatch is explained before updating the account',async()=>{
      await messageMatches(change,/match/);assert.equal(await change.evaluate(()=>changeCalls),0);
      assert.equal(await change.evaluate(()=>document.activeElement.id),'confirmPassword');
    });
    await change.locator('#confirmPassword').fill('synthetic-new-password');
    await change.evaluate(()=>{KagieAPI.updateAuthenticatedPassword=async()=>{changeCalls++;await new Promise(resolve=>window.releaseChange=resolve);throw new Error('Auth session missing! Synthetic expired Supabase JWT');};});
    await submitTwice(change);await change.waitForFunction(()=>!!window.releaseChange);
    await check('Password update prevents duplicate submissions and disables fields while pending',async()=>{
      assert.equal(await change.evaluate(()=>changeCalls),1);
      for (const id of ['newPassword','confirmPassword','saveBtn']) assert.equal(await change.locator('#'+id).isDisabled(),true,id);
      assert.equal(await change.locator('#changePasswordForm').getAttribute('aria-busy'),'true');
    });
    await change.evaluate(()=>releaseChange());await change.locator('#saveBtn:enabled').waitFor();
    await check('Expired recovery sessions give a useful message and retain the new passwords',async()=>{
      assert.match(await change.locator('#message').innerText(),/reset|recovery|expired|new link/i);
      assert.doesNotMatch(await change.locator('#message').innerText(),/Supabase|JWT|Auth session missing/);
      assert.equal(await change.locator('#newPassword').inputValue(),'synthetic-new-password');
      assert.equal(await change.locator('#confirmPassword').inputValue(),'synthetic-new-password');
      assert.equal(await change.locator('#saveBtn').innerText(),'Save password');
    });
    await change.evaluate(()=>{KagieAPI.updateAuthenticatedPassword=async()=>({id:'synthetic-recovered-learner',role:'user'});});
    await change.locator('#saveBtn').click();
    await change.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
    await check('Successful password update returns to login and preserves the safe application destination',async()=>{
      const target=new URL(changeNavigations[changeNavigations.length-1]);
      assert.equal(target.searchParams.get('switch'),'1');
      assert.equal(target.searchParams.get('app'),'1');assert.equal(target.searchParams.get('next'),'checkout.html');
    });
    await check('Account interactions produce no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
  } catch(error) {
    failure={message:error.message,stack:error.stack};console.error(error);
  } finally {
    fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({generatedAt:new Date().toISOString(),story:'Student account entry → actual Kagie validation/loading APIs → synthetic browser storage or intercepted real Supabase SDK recovery → role-safe route or friendly result',checks,layouts,errors,recoveryRequests,externalRequestsBlocked:blocked.length,failure,limitations:['No production Supabase writes or real reset emails. Recovery delivery and provider redirect allowlist require deployed configuration.','Role routing tests use synthetic role responses; underlying permissions were verified by existing admin integration tests.']},null,2));
    const screenGroups=pages.map(item=>({title:item.heading,screens:[390,820,1440].map(width=>({file:item.key+'-'+width+'.png',label:width+' px'}))}));
    screenGroups.push({title:'Account next steps',screens:[{file:'signup-verification-390.png',label:'Email confirmation'},{file:'forgot-password-success-390.png',label:'Reset requested'},{file:'signup-date-picker-390.png',label:'Birth date picker'}]});
    const galleries=screenGroups.map(group=>`<section><h2>${group.title}</h2><div class="screens">${group.screens.filter(screen=>fs.existsSync(path.join(out,screen.file))).map(screen=>`<figure><figcaption>${screen.label}</figcaption><a href="${screen.file}"><img src="${screen.file}" loading="lazy" alt="${group.title}, ${screen.label}"></a></figure>`).join('')}</div></section>`).join('');
    fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kagie account experience review</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f8fc;color:#10233d;font:16px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:32px 20px}header{border-bottom:1px solid #d8e4f0;padding-bottom:24px}h1{font-size:32px;letter-spacing:-.03em;margin:0 0 8px}h2{font-size:22px;margin:32px 0 16px}p{max-width:800px;color:#52657c;margin:8px 0}.result{display:inline-block;border-radius:10px;padding:8px 14px;background:#fff;color:${failure?'#fd0505':'#18734a'};border:1px solid #d8e4f0}a{color:#fd0505}.screens{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start}figure{margin:0;background:#fff;border:1px solid #d8e4f0;border-radius:16px;overflow:hidden}figcaption{font-size:14px;font-weight:600;padding:12px 16px;border-bottom:1px solid #d8e4f0}img{display:block;width:100%;height:auto}footer{margin-top:32px;border-top:1px solid #d8e4f0;padding-top:16px}@media(max-width:760px){.screens{grid-template-columns:1fr}main{padding:24px 16px}h1{font-size:27px}}</style><main><header><h1>Kagie account experience</h1><p>Login, signup and password recovery use one responsive layout while using Kagie's requested colors.</p><span class="result">${checks.length} checks passed · ${layouts.length} responsive samples${failure?' · Verification stopped at a failure':''}</span><p><a href="checks.json">Read the isolated verification evidence</a></p></header>${galleries}<footer><p>Verified using synthetic accounts and intercepted Auth requests. No real password-reset emails were sent. Built locally; provider delivery requires deployed configuration.</p></footer></main></html>`);
    for(const context of contexts)await context.close();
    await browser.close();await server.close();
  }
  if(failure)process.exitCode=1;
  else console.log(JSON.stringify({checks:checks.length,layouts:layouts.length,browserErrors:errors.length,recoveryRequests:recoveryRequests.length},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
