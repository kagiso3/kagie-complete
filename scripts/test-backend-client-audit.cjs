// Execute the real document persistence function against isolated storage/DB boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/backend.js'), 'utf8');
const start = source.indexOf('  async function saveDocumentsAsync(');
const end = source.indexOf('  function getDocumentsByUser(', start);
assert.ok(start >= 0 && end > start);
const code = source.slice(start, end) + '\nglobalThis.upload = saveDocumentsAsync;';
const checks = [];
async function fixture({ insertError = null, insertData = { id: 'doc' }, uploadError = null, remote = true, fileName = 'Identity.pdf', fileType = 'application/pdf', size = 20 } = {}) {
  const calls = { uploads: [], removes: [], inserts: [], mirrored: [], localSaves: 0 };
  const bucket = {
    upload: async (...args) => { calls.uploads.push(args); return { error: uploadError }; },
    remove: async paths => { calls.removes.push(paths); return { error: null }; }
  };
  const client = {
    storage: { from: name => { assert.equal(name, 'kagie-documents'); return bucket; } },
    from: name => { assert.equal(name, 'documents'); return {
      insert: row => { calls.inserts.push(row); return { select: () => ({ single: async () => ({ data: insertData, error: insertError }) }) }; }
    }; }
  };
  const sandbox = {
    console, Date, ROLES: { USER: 'user', ASSISTANT: 'assistant_admin', MASTER: 'master_admin' },
    STATUS: { doc: { PENDING: 'Pending Review' } },
    requireRole: () => ({ id: 'actor', role: 'master_admin' }),
    resolveSupabaseContext: async () => remote ? { client, targetRemoteId: 'owner-id', targetLocalUser: { id: 'owner' } } : null,
    getLatestApplicationAsync: async () => ({ id: 'application' }),
    saveDocuments: () => { calls.localSaves++; return [{ id: 'local-doc' }]; },
    extensionFromMime: () => 'pdf', sanitizePathPart: value => value,
    dataUrlToBlob: () => null,
    normalizeRemoteDocumentRow: row => ({ ...row, category: 'id_copy' }),
    mirrorRemoteDocuments: rows => calls.mirrored.push(rows)
  };
  vm.runInNewContext(code, sandbox, { filename: 'js/backend.js#saveDocumentsAsync' });
  const file = { name: fileName, size, type: fileType, file: { size, type: fileType } };
  return { calls, run: () => sandbox.upload([file], 'owner') };
}
async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
(async () => {
  await check('Successful upload persists its private object path and record before mirroring', async () => {
    const f = await fixture(); const result = await f.run();
    assert.equal(result[0].id, 'doc'); assert.equal(f.calls.uploads.length, 1);
    assert.equal(f.calls.inserts[0].file_url, f.calls.uploads[0][0]);
    assert.equal(f.calls.inserts[0].user_id, 'owner-id');
    assert.equal(f.calls.mirrored.length, 1); assert.equal(f.calls.removes.length, 0);
  });
  await check('Schema failure removes the uploaded object and does not pretend a local save succeeded', async () => {
    const f = await fixture({ insertError: { message: 'file_size missing from schema cache' } });
    await assert.rejects(f.run, /file_size/);
    assert.equal(f.calls.removes.length, 1); assert.equal(f.calls.removes[0][0], f.calls.uploads[0][0]);
    assert.equal(f.calls.localSaves, 0); assert.equal(f.calls.mirrored.length, 0);
  });
  await check('An empty document insert result also rolls back its storage object', async () => {
    const f = await fixture({ insertData: null }); await assert.rejects(f.run, /save document record/);
    assert.equal(f.calls.removes.length, 1); assert.equal(f.calls.localSaves, 0);
  });
  await check('Storage failures do not insert records, mirror success or delete uncreated objects', async () => {
    const f = await fixture({ uploadError: { message: 'storage unavailable' } });
    await assert.rejects(f.run, /storage unavailable/);
    assert.equal(f.calls.inserts.length, 0); assert.equal(f.calls.removes.length, 0);
    assert.equal(f.calls.localSaves, 0); assert.equal(f.calls.mirrored.length, 0);
  });
  await check('Explicit local-only mode retains the existing local upload behavior', async () => {
    const f = await fixture({ remote: false }); assert.equal((await f.run())[0].id, 'local-doc');
    assert.equal(f.calls.localSaves, 1); assert.equal(f.calls.uploads.length, 0);
  });
  await check('Browser Word files with generic MIME are uploaded with the canonical DOCX type', async () => {
    const f = await fixture({ fileName: 'Application.docx', fileType: 'application/octet-stream' }); await f.run();
    assert.equal(f.calls.uploads[0][2].contentType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(f.calls.inserts[0].mime_type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
  await check('Documents above 8 MiB are rejected before storage or DB writes', async () => {
    const f = await fixture({ size: 8 * 1024 * 1024 + 1 }); await assert.rejects(f.run, /8 MB/);
    assert.equal(f.calls.uploads.length, 0); assert.equal(f.calls.inserts.length, 0);
  });
  await check('Unsupported document types are rejected before storage or DB writes', async () => {
    const f = await fixture({ fileName: 'Page.html', fileType: 'text/html' }); await assert.rejects(f.run, /PDF, DOC/);
    assert.equal(f.calls.uploads.length, 0); assert.equal(f.calls.inserts.length, 0);
  });
  const out = path.join(root, 'reports/backend-audit/client-checks.json');
  fs.writeFileSync(out, JSON.stringify({ runAt: new Date().toISOString(), environment: 'Actual source function, isolated storage and database fixtures; no external requests', checks }, null, 2) + '\n');
  console.log(`${checks.length} client persistence checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
