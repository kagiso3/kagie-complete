// Generate the shared More Services page shells. Behavior lives in shared JS.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = [
  ['index.html','index','More Services','','../home.html'],
  ['funding-assist.html','funding','Funding Assist','','index.html'],
  ['available-bursaries.html','bursaries','Available Bursaries','','funding-assist.html'],
  ['bursary-details.html','detail','Bursary Details','reading','available-bursaries.html'],
  ['funding-checklist.html','checklist','Funding Checklist','reading','funding-assist.html'],
  ['funding-guide.html','guide','How to Apply','reading','funding-assist.html'],
  ['funding-requirements.html','requirements','Eligibility & Requirements','reading','funding-assist.html'],
  ['funding-support.html','funding-support','Funding Support','form','funding-assist.html'],
  ['change-email.html','change-email','Change Email','form','index.html'],
  ['re-apply.html','reapply','Re-Apply Help','form','index.html'],
  ['forgot-pin.html','forgot-pin','Forgot PIN','form','index.html'],
  ['forgot-student-number.html','forgot-student-number','Forgot Student Number','form','index.html'],
  ['help-support.html','help','Help & Support','form','index.html']
];
const escaped = text => text.replace(/&/g,'&amp;');
const sdkVersion = JSON.parse(fs.readFileSync(path.join(root,'node_modules/@supabase/supabase-js/package.json'),'utf8')).version;
for(const [file,name,title,size,back] of pages) {
  const target = path.join(root,'more-service',file);
  const backup = path.join(root,'reports/more-services-before',file);
  if(fs.existsSync(target) && !fs.existsSync(backup)) {
    fs.mkdirSync(path.dirname(backup),{recursive:true});
    fs.copyFileSync(target,backup);
  }
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#ffffff" />
  <title>Kagie | ${escaped(title)}</title>
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/images/logos/app-icon.png" />
  <link rel="stylesheet" href="../css/bottom-nav.css?v=20260819b" />
  <link rel="stylesheet" href="../css/more-services.css?v=20261005-design" />
  <script defer src="../js/data.js?v=20260408v"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${sdkVersion}"></script>
  <script defer src="../js/backend.js?v=20261005-admin"></script>
  <script defer src="../js/supabase-config.js?v=20261005-admin"></script>
  <script defer src="../js/more-services-icons.js?v=20261005-design"></script>
  <script defer src="../js/bottom-nav.js?v=20260819b"></script>
  <script defer src="../js/more-services-page.js?v=20261005-design"></script>
  <script defer src="../js/pwa-init.js?v=20260409a"></script>
</head>
<body class="more-services-page" data-service-page="${name}">
  <main class="ms-screen${size ? ' ms-screen--'+size : ''}">
    <header class="ms-header">
      <a class="ms-back" href="${back}" aria-label="${back==='../home.html'?'Back to Home':back==='index.html'?'Back to More Services':back==='available-bursaries.html'?'Back to Available Bursaries':'Back to Funding Assist'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg></a>
      <h1>${escaped(title)}</h1>
      <span aria-hidden="true"></span>
    </header>
    <section id="serviceContent"><p class="ms-copy" role="status">Loading Kagie services…</p></section>
    <noscript><p>Please enable JavaScript to use Kagie services.</p><a href="../home.html">Back to Home</a></noscript>
  </main>
</body>
</html>
`;
  fs.writeFileSync(target,html);
}
console.log(`Generated ${pages.length} More Services pages using the existing shared app footer.`);
