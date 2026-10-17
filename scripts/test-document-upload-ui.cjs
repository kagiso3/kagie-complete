/* Exercises the real document UI with local API fixtures. No accounts, uploads, or external requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'reports/document-upload');
const visualOutput = path.join(root, 'reports/documents-ui');
const report = { checks: [], samples: [], errors: [], externalRequests: [] };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
function check(name, condition) { assert.ok(condition, name); report.checks.push(name); console.log('PASS ' + name); }
const doc = (overrides = {}) => ({ id: 'fixture-document', userId: 'fixture-user', name: 'Certified ID', category: 'id_copy', type: 'application/pdf', size: 1024, status: 'Pending Review', createdAt: '2026-10-14T08:00:00Z', fileUrl: 'fixture-user/private.pdf', ...overrides });

async function main() {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(visualOutput, { recursive: true });
  const server = http.createServer((req, res) => {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, route.replace(/^\/+/, '') || 'upload.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, body) => {
      res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(error ? 'Fixture unavailable' : body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  async function open(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
    contexts.push(context);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) {
        report.externalRequests.push(url.origin + url.pathname);
        return route.fulfill({ status: 200, body: '' });
      }
      // Exercise the actual page and shared navigation/accessibility scripts; isolate API/network side effects.
      if (url.pathname.endsWith('.js') && !['/js/upload-page.js', '/js/bottom-nav.js', '/js/app-foundation.js'].includes(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
      if (url.pathname === '/login.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture login</title><h1>Sign in</h1>' });
      return route.continue();
    });
    await context.addInitScript(config => {
      window.fixture = { docs: config.docs || [], latest: config.latest || null, user: config.signedOut ? null : { id: 'fixture-user', fullName: 'Fixture Learner', role: config.role || 'user' }, saveCalls: [], signedCalls: [], saveFailure: '', holdSave: false, failDocuments: config.failDocuments || false, holdDocuments: config.holdDocuments || false, popupCalls: 0 };
      window.open = () => {
        fixture.popupCalls += 1;
        return { opener: window, location: { replace: value => { fixture.openedURL = value; } }, close: () => { fixture.popupClosed = true; } };
      };
      window.KagieAPI = {
        STATUS: { doc: { PENDING: 'Pending Review', APPROVED: 'Approved', REJECTED: 'Rejected' } },
        resolveSessionUser: async () => fixture.user,
        currentUser: () => fixture.user,
        requireRole: () => fixture.user,
        getDocumentsByUserAsync: async () => {
          if (fixture.holdDocuments) await new Promise(resolve => { fixture.releaseDocuments = resolve; });
          if (fixture.failDocuments) throw new Error('Fixture document list is unavailable.');
          return fixture.docs;
        },
        getLatestApplicationAsync: async () => fixture.latest,
        getApplicationByIdAsync: async (id, userId) => { fixture.applicationLookup = { id, userId }; return fixture.latest; },
        saveDocumentsAsync: async (payload, userId) => {
          fixture.saveCalls.push({ name: payload.name, category: payload.category, applicationId: payload.applicationId, size: payload.size, type: payload.type, filename: payload.file.name, userId });
          if (fixture.holdSave) await new Promise(resolve => { fixture.releaseSave = resolve; });
          if (fixture.saveFailure) throw new Error(fixture.saveFailure);
          const saved = { id: 'saved-' + fixture.saveCalls.length, userId, name: payload.name, category: payload.category, applicationId: payload.applicationId, size: payload.size, type: payload.type, createdAt: '2026-10-14T08:00:00Z', status: 'Pending Review', fileUrl: 'fixture-user/' + payload.file.name };
          fixture.docs = [...fixture.docs, saved];
          return [saved];
        },
        initSupabaseClient: () => ({ storage: { from: bucket => ({ createSignedUrl: async (objectPath, seconds) => {
          fixture.signedCalls.push({ bucket, objectPath, seconds });
          if (fixture.failSigned) return { error: { message: 'Fixture private download failed.' } };
          return { data: { signedUrl: 'https://files.test.invalid/signed-document.pdf' }, error: null };
        } }) } })
      };
    }, options);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
    await page.goto(base + '/upload.html' + (options.query || ''), { waitUntil: 'domcontentloaded' });
    if (!options.signedOut && (!options.role || options.role === 'user') && !options.failDocuments && !options.holdDocuments && !options.invalidApplication) await page.locator('#uploadBtn:enabled').waitFor();
    return page;
  }
  const file = (name = 'support.pdf', mimeType = 'application/pdf', bytes = 2048) => ({ name, mimeType, buffer: Buffer.alloc(bytes, 1) });
  async function drop(page, files) {
    await page.evaluate(values => {
      const transfer = new DataTransfer();
      for (const value of values) transfer.items.add(new File([new Uint8Array(value.size || 2048)], value.name, { type: value.type || 'application/pdf' }));
      document.getElementById('uploadDropZone').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, files);
  }
  async function submit(page) {
    await page.locator('#uploadForm').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }
  try {
    const empty = await open();
    check('Empty list uses the document illustration and guidance', await empty.locator('.upload-empty-art').count() === 1 && await empty.getByRole('heading', { name: 'No documents uploaded yet.' }).isVisible());
    check('Only the static accepted-file help block is rendered', await empty.locator('#uploadFileMeta').count() === 1 && /Max 8 MB/.test(await empty.locator('#uploadFileMeta').innerText()));
    check('Save Document button retains its upload icon', await empty.locator('#uploadBtn .upload-save-icon').count() === 1 && await empty.locator('#uploadBtn').innerText() === 'Save Document');
    await empty.setViewportSize({ width: 1352, height: 1163 });
    await empty.screenshot({ path: path.join(visualOutput, 'empty-1352.png'), fullPage: false });
    for (const width of [320, 390, 768, 1440]) {
      await empty.setViewportSize({ width, height: width < 768 ? 844 : 1100 });
      const sample = await empty.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('.shell').getBoundingClientRect().width }));
      report.samples.push({ state: 'empty', ...sample });
      check('Empty document workspace fits at ' + width, sample.document <= width);
      await empty.screenshot({ path: path.join(output, 'empty-' + width + '.png'), fullPage: true });
      if (width === 390) await empty.screenshot({ path: path.join(visualOutput, 'empty-390.png'), fullPage: true });
    }
    await empty.locator('#docCategory').evaluate(select => { select.value = ''; });
    await empty.locator('#uploadBtn').click();
    check('Missing category, label and file show inline required errors', await empty.locator('#docCategoryError').isVisible() && await empty.locator('#docNameError').isVisible() && await empty.locator('#docFileError').isVisible() && await empty.evaluate(() => fixture.saveCalls.length === 0));
    check('Validation focuses the first incomplete field', await empty.locator('#docCategory').evaluate(input => input === document.activeElement));
    await empty.locator('#docCategory').selectOption('id_copy');
    await empty.locator('#docName').fill('Certified ID');
    const chooser = await Promise.all([empty.waitForEvent('filechooser'), empty.locator('#chooseFileBtn').click()]).then(values => values[0]);
    await chooser.setFiles(file());
    check('Choose File opens the native chooser and shows the selected filename and size', /support.pdf.*2 KB/.test(await empty.locator('#selectedFileName').innerText()) && await empty.locator('#removeFileBtn').isVisible());
    check('File selection preserves the accepted-file help', /Accepted: PDF, DOC, DOCX, JPG, JPEG, PNG. Max 8 MB./.test(await empty.locator('#uploadFileMeta').innerText()));
    await empty.locator('#removeFileBtn').click();
    check('Clear file removes the selection and returns focus to the chooser', await empty.locator('#selectedFileName').innerText() === 'No file chosen' && !(await empty.locator('#removeFileBtn').isVisible()) && await empty.locator('#docFile').evaluate(input => input.files.length === 0) && await empty.locator('#chooseFileBtn').evaluate(button => button === document.activeElement));
    await empty.locator('#uploadDropZone').focus();
    const keyboardChooser = await Promise.all([empty.waitForEvent('filechooser'), empty.keyboard.press('Enter')]).then(values => values[0]);
    await keyboardChooser.setFiles(file('keyboard.pdf'));
    check('The upload drop area supports keyboard file browsing', /keyboard.pdf/.test(await empty.locator('#selectedFileName').innerText()));
    await drop(empty, [{ name: 'dropped.pdf', type: 'application/pdf' }]);
    check('Dropping one file selects it for upload', /dropped.pdf/.test(await empty.locator('#selectedFileName').innerText()) && await empty.locator('#uploadDropZone').evaluate(node => node.classList.contains('has-file')));
    await drop(empty, [{ name: 'first.pdf' }, { name: 'second.pdf' }]);
    check('Dropping multiple files explains the limit and retains the prior selection', /one document at a time/.test(await empty.locator('#docFileError').innerText()) && /dropped.pdf/.test(await empty.locator('#selectedFileName').innerText()));
    await empty.locator('#docFile').setInputFiles(file('bad.exe', 'application/octet-stream'));
    await empty.locator('#uploadBtn').click();
    check('Unsupported file types are rejected before upload', /Use PDF/.test(await empty.locator('#docFileError').innerText()) && await empty.evaluate(() => fixture.saveCalls.length === 0));
    await empty.locator('#docFile').setInputFiles(file('too-large.pdf', 'application/pdf', 8 * 1024 * 1024 + 1));
    await empty.locator('#uploadBtn').click();
    check('Files larger than 8 MB are rejected', /8 MB or less/.test(await empty.locator('#docFileError').innerText()) && await empty.evaluate(() => fixture.saveCalls.length === 0));
    await empty.locator('#docFile').setInputFiles(file('exact-limit.pdf', 'application/pdf', 8 * 1024 * 1024));
    check('The exact 8 MB boundary is accepted', !(await empty.locator('#docFileError').isVisible()));
    await empty.locator('#docFile').setInputFiles(file('retry.pdf'));
    await empty.evaluate(() => { fixture.holdSave = true; fixture.saveFailure = 'Fixture upload failed. Try again.'; });
    await empty.locator('#uploadBtn').click();
    await empty.waitForFunction(() => fixture.saveCalls.length === 1);
    await submit(empty);
    check('Pending save locks the controls, retains the icon and prevents duplicate submits', await empty.locator('#uploadBtn').isDisabled() && await empty.locator('#docName').isDisabled() && await empty.locator('#chooseFileBtn').isDisabled() && await empty.locator('#uploadBtn .upload-save-icon').count() === 1 && await empty.evaluate(() => fixture.saveCalls.length === 1));
    await drop(empty, [{ name: 'replacement.pdf' }]);
    check('Dropping while saving cannot replace the pending file', /retry.pdf/.test(await empty.locator('#selectedFileName').innerText()));
    await empty.evaluate(() => fixture.releaseSave());
    await empty.locator('#uploadBtn:enabled').waitFor();
    check('A failed save retains the label and selected file for retry', await empty.locator('#docName').inputValue() === 'Certified ID' && /retry.pdf/.test(await empty.locator('#selectedFileName').innerText()) && await empty.locator('#uploadBtn .upload-save-icon').count() === 1 && /Fixture upload failed/.test(await empty.locator('#uploadStatus').innerText()));
    await empty.evaluate(() => { fixture.holdSave = false; fixture.saveFailure = ''; });
    await empty.locator('#uploadBtn').click();
    await empty.locator('#uploadBtn:enabled').waitFor();
    check('Retry succeeds once and renders the saved document', await empty.evaluate(() => fixture.saveCalls.length === 2 && fixture.docs.length === 1) && await empty.locator('.upload-document-card').count() === 1 && /Saved successfully/.test(await empty.locator('#uploadStatus').innerText()));
    check('Success clears the label and file but retains the button icon', await empty.locator('#docName').inputValue() === '' && await empty.locator('#selectedFileName').innerText() === 'No file chosen' && await empty.locator('#uploadBtn .upload-save-icon').count() === 1);
    await empty.locator('#docName').fill('Certified ID');
    await empty.locator('#docFile').setInputFiles(file('duplicate.pdf'));
    await empty.locator('#uploadBtn').click();
    check('An already saved name, category and file size cannot be uploaded twice', /already saved/.test(await empty.locator('#uploadStatus').innerText()) && await empty.evaluate(() => fixture.saveCalls.length === 2));

    const populated = await open({ docs: [doc({ name: 'A long document label that must wrap without causing horizontal overflow ' + 'supporting-file-'.repeat(8), status: 'Rejected', reviewReason: 'The scan is too blurry.' }), doc({ id: 'approved-document', name: 'Results', category: 'results', status: 'Approved' })], latest: { id: 'fixture-application', userId: 'fixture-user', paymentStatus: 'Rejected', payment: { reference: 'FIXTURE123', rejectionReason: 'Use a clearer proof.' } } });
    check('Populated cards use readable categories, review notes and status badges', await populated.locator('.upload-document-card').count() === 3 && /Certified ID Copy/.test(await populated.locator('#docs').innerText()) && /The scan is too blurry/.test(await populated.locator('#docs').innerText()) && await populated.locator('.status.success').count() === 1 && await populated.locator('.status.review').count() === 2);
    check('Payment verification retains its reason and reference', /Use a clearer proof/.test(await populated.locator('.upload-payment-card').innerText()) && /FIXTURE123/.test(await populated.locator('.upload-payment-card').innerText()));
    for (const width of [320, 390, 768, 1440]) {
      await populated.setViewportSize({ width, height: width < 768 ? 844 : 1100 });
      const sample = await populated.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      report.samples.push({ state: 'populated', ...sample });
      check('Populated document workspace fits at ' + width, sample.document <= width);
      await populated.screenshot({ path: path.join(output, 'populated-' + width + '.png'), fullPage: true });
      if (width === 390) await populated.screenshot({ path: path.join(visualOutput, 'populated-390.png'), fullPage: true });
    }
    await populated.locator('[data-document-open]').first().click();
    await populated.waitForFunction(() => fixture.openedURL);
    check('Private download obtains the existing 600-second signed storage URL', await populated.evaluate(() => fixture.signedCalls.length === 1 && fixture.signedCalls[0].bucket === 'kagie-documents' && fixture.signedCalls[0].objectPath === 'fixture-user/private.pdf' && fixture.signedCalls[0].seconds === 600 && fixture.openedURL === 'https://files.test.invalid/signed-document.pdf'));
    await populated.evaluate(() => { fixture.failSigned = true; fixture.openedURL = ''; });
    await populated.locator('[data-document-open]').first().click();
    await populated.waitForFunction(() => fixture.popupClosed);
    check('Failed private downloads close the blank tab and restore retry', await populated.locator('[data-document-open]').first().isEnabled() && /private download failed/.test(await populated.locator('#uploadStatus').innerText()));

    const linked = await open({ query: '?applicationId=fixture-application&category=proof_of_payment', latest: { id: 'fixture-application', userId: 'fixture-user' } });
    check('Application and requested category links still preselect the form', await linked.locator('#docCategory').inputValue() === 'proof_of_payment' && await linked.evaluate(() => fixture.applicationLookup.id === 'fixture-application' && fixture.applicationLookup.userId === 'fixture-user'));
    await linked.locator('#docName').fill('Payment proof');
    await drop(linked, [{ name: 'payment.pdf' }]);
    await linked.locator('#uploadBtn').click();
    await linked.locator('#uploadBtn:enabled').waitFor();
    check('Saving passes the file, user, category and application to the unchanged API', await linked.evaluate(() => fixture.saveCalls.length === 1 && fixture.saveCalls[0].applicationId === 'fixture-application' && fixture.saveCalls[0].category === 'proof_of_payment' && fixture.saveCalls[0].filename === 'payment.pdf' && fixture.saveCalls[0].userId === 'fixture-user') && /Linked to payment verification/.test(await linked.locator('#docs').innerText()));
    const unavailable = await open({ query: '?applicationId=another-user-application', invalidApplication: true, latest: { id: 'another-user-application', userId: 'other-user' } });
    await unavailable.getByText('This application is unavailable.', { exact: false }).waitFor();
    check('An application owned by another learner cannot receive an upload', await unavailable.locator('#uploadBtn').isDisabled() && await unavailable.evaluate(() => fixture.saveCalls.length === 0));
    const recovering = await open({ failDocuments: true });
    await recovering.locator('[data-document-retry]').waitFor();
    check('Failed initial document loads expose a retry while saving is disabled', await recovering.locator('#uploadBtn').isDisabled() && /unavailable/.test(await recovering.locator('#uploadStatus').innerText()));
    await recovering.evaluate(() => { fixture.failDocuments = false; });
    await recovering.locator('[data-document-retry]').click();
    await recovering.locator('#uploadBtn:enabled').waitFor();
    check('Document-list retry restores the form and empty illustration', await recovering.locator('.upload-empty-art').count() === 1);
    const refreshFailure = await open();
    await refreshFailure.locator('#docName').fill('Saved before refresh failure');
    await refreshFailure.locator('#docFile').setInputFiles(file());
    await refreshFailure.evaluate(() => { fixture.failDocuments = true; });
    await refreshFailure.locator('#uploadBtn').click();
    await refreshFailure.locator('#uploadBtn:enabled').waitFor();
    check('A list refresh failure after save reports success and offers refresh retry', /Your document was saved/.test(await refreshFailure.locator('#uploadStatus').innerText()) && await refreshFailure.locator('[data-document-retry]').isVisible() && await refreshFailure.evaluate(() => fixture.docs.length === 1 && fixture.saveCalls.length === 1));
    const signedOut = await open({ signedOut: true });
    await signedOut.waitForURL(base + '/login.html');
    check('Signed-out learners are routed to sign in', true);
    const staff = await open({ role: 'assistant_admin' });
    await staff.waitForURL(base + '/login.html');
    check('The learner document page retains its role gate', true);
    check('The document UI raised no uncaught page errors', report.errors.length === 0);
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('Completed ' + report.checks.length + ' document UI checks.');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
