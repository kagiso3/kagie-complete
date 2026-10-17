const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const root = path.resolve(__dirname, "..");

// This script intentionally loads the built Express app with a fixture SDK.
// It never reads .env, starts a live Supabase client, or contacts an external host.
Object.assign(process.env, { NODE_ENV: "production", SUPABASE_URL: "https://api-audit-fixture.supabase.co", SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", WEB_APP_URL: "https://kagie.app", KAGIE_ALLOWED_ORIGINS: "https://kagie-controlled-preview.vercel.app" });
const ids = { user: "11111111-1111-4111-8111-111111111111", app: "22222222-2222-4222-8222-222222222222", created: "33333333-3333-4333-8333-333333333333", other: "44444444-4444-4444-8444-444444444444" };
let state;
function reset(options = {}) {
  const user = { id: ids.user, email: "fixture@test.invalid", user_metadata: { full_name: "Fixture User", phone: "0712345678", role: options.userRole || "user" }, app_metadata: { role: options.role || "user" }, ...(options.user || {}) };
  state = { options, user, profile: { id: ids.user, full_name: "Fixture User", email: "fixture@test.invalid", phone: "0712345678", role: options.profileRole || options.role || "user", is_active: true, ...(options.profile || {}) }, calls: [], created: null };
}
const session = { access_token: "fixture-access-token-for-local-testing", refresh_token: "fixture-refresh-token-for-local-testing" };
function record(action, details = {}) { state.calls.push({ action, ...details }); }
function builder(table) {
  let action = "select", payload, filters = [];
  const query = {
    select() { return query; },
    eq(key, value) { filters.push([key, value]); return query; },
    in() { return query; }, neq() { return query; }, is() { return query; }, or() { return query; },
    order() { return query; }, limit() { return query; }, range() { return query; },
    insert(value) { action = "insert"; payload = value; return query; },
    upsert(value) { action = "upsert"; payload = value; return query; },
    update(value) { action = "update"; payload = value; return query; },
    delete() { action = "delete"; return query; },
    single() { return execute(true); }, maybeSingle() { return execute(true); },
    then(resolve, reject) { return execute(false).then(resolve, reject); }
  };
  async function execute(single) {
    record("db", { table, operation: action, payload, filters });
    if (state.options.throwTable === table) throw new Error("fixture-private-secret: SQL internals must not be returned");
    if (table === "profiles") {
      if (state.options.profileError) return { data: null, error: { message: "fixture-private-secret: profile authority unavailable" } };
      if (action === "select") return { data: state.options.missingProfile ? null : state.profile, error: null };
      const value = Array.isArray(payload) ? payload[0] : payload;
      state.profile = { ...state.profile, ...value }; return { data: state.profile, error: null };
    }
    if (table === "applications") {
      const application = { id: ids.app, user_id: state.options.applicationOwner || ids.user, status: "Draft", payment_status: state.options.paymentStatus || "Payment Pending", application_type: "undergraduate" };
      const match = filters.every(([key, value]) => application[key] === undefined || application[key] === value);
      return { data: single ? (match ? application : null) : (match ? [application] : []), error: null };
    }
    if (table === "documents" && action === "insert") {
      if (state.options.documentInsertError) return { data: null, error: { message: "fixture-private-secret: document record failed" } };
      return { data: { id: "fixture-document", ...payload, created_at: "2026-10-15T00:00:00Z" }, error: null };
    }
    if (table === "documents" && state.options.documentReadError) return { data: null, error: { message: "fixture-private-secret: document query failed" } };
    if (table === "notifications" && action === "insert") return { data: { id: "fixture-notification", ...payload, created_at: "2026-10-15T00:00:00Z" }, error: null };
    return { data: single ? null : [], error: null, count: 0 };
  }
  return query;
}
const sdk = { createClient(url, key) {
  assert.equal(url, "https://api-audit-fixture.supabase.co");
  assert.ok(["fixture-anon", "fixture-service"].includes(key));
  return {
    from: builder,
    async rpc(name,payload){record('db.rpc',{name,payload});return state.options.rpcError?{data:null,error:{message:'fixture-private-secret: atomic write failed'}}:{data:payload.p_marks.length,error:null};},
    auth: {
      async getUser(token) { record("auth.getUser", { token }); return state.options.authError ? { data: { user: null }, error: { message: "fixture-private-secret: rejected token" } } : { data: { user: state.user }, error: null }; },
      async signUp(payload) { record("auth.signUp", { payload }); return { data: { user: { ...state.user, id: state.options.signupUserId || ids.user }, session: state.options.noSignupSession ? null : session }, error: null }; },
      async signInWithPassword(payload) { record("auth.signInWithPassword", { payload }); return { data: { user: state.created || state.user, session }, error: null }; },
      async refreshSession() { record("auth.refreshSession"); return { data: { user: state.user, session }, error: null }; },
      async signOut() { record("auth.signOut"); return { error: null }; },
      admin: {
        async createUser(payload) { record("auth.admin.createUser", { payload }); if (state.options.createError) return { data: { user: null }, error: { message: state.options.createError } }; state.created = { id: ids.created, email: payload.email, user_metadata: payload.user_metadata, app_metadata: payload.app_metadata }; return { data: { user: state.created }, error: null }; },
        async deleteUser(id) { record("auth.admin.deleteUser", { id }); return { data: {}, error: null }; }
      }
    },
    storage: { from(bucket) { return {
      async upload(objectPath, buffer, settings) { record("storage.upload", { bucket, objectPath, bytes: buffer.length, settings }); return { data: { path: objectPath }, error: state.options.storageError ? { message: "fixture storage failed" } : null }; },
      async remove(paths) { record("storage.remove", { bucket, paths }); return { data: [], error: null }; },
      async createSignedUrl() { return { data: { signedUrl: "https://signed.test.invalid/fixture" }, error: null }; }
    }; } }
  };
} };
const originalLoad = Module._load;
Module._load = function(request, ...arguments_) { return request === "@supabase/supabase-js" ? sdk : originalLoad.call(this, request, ...arguments_); };
const { createApp } = require(path.join(root, "kagie-api/dist/app.js"));
Module._load = originalLoad;

const checks = [];
const account = { fullName: "New Fixture", phone: "0712345678", email: "new@test.invalid", password: "fixture-password-123" };
const authHeaders = { authorization: "Bearer fixture-access-token-for-local-testing" };
const writes = () => state.calls.filter(c => (c.action === "db" && c.operation !== "select") || c.action.startsWith("auth.admin") || c.action.startsWith("storage."));
async function main() {
  const server = await new Promise(resolve => { const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance)); });
  const origin = "http://127.0.0.1:" + server.address().port;
  const actualFetch = global.fetch;
  global.fetch = (url, init) => { assert.equal(new URL(url).origin, origin, "HTTP requests must stay on the local Express fixture"); return actualFetch(url, init); };
  async function request(route, method = "GET", body, headers = {}) {
    const response = await fetch(origin + route, { method, headers: { ...(Buffer.isBuffer(body) ? {} : { "content-type": "application/json" }), ...headers }, ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function check(name, action) { reset(); await action(); checks.push(name); console.log("PASS " + name); }
  try {
    await check("Anonymous API master bootstrap is rejected before any Supabase access", async () => {
      const response = await request("/v1/auth/admin/master-admin/bootstrap", "POST", account); assert.equal(response.status, 401); assert.equal(state.calls.length, 0);
    });
    await check("Editable user metadata cannot authorize API master provisioning", async () => {
      reset({ userRole: "master_admin", profileRole: "master_admin" }); const response = await request("/v1/auth/admin/master-admin/bootstrap", "POST", account, authHeaders); assert.equal(response.status, 403); assert.equal(writes().length, 0);
    });
    await check("Trusted master can read the protected API role catalog", async () => {
      reset({ role: "master_admin", profileRole: "user" }); const response = await request("/v1/auth/admin/roles", "GET", undefined, authHeaders); assert.equal(response.status, 200); assert.ok(response.body.data.includes("master_admin"));
    });
    await check("Active verified API master can create a new master", async () => {
      reset({ role: "master_admin" }); const response = await request("/v1/auth/admin/master-admin/bootstrap", "POST", account, authHeaders); assert.equal(response.status, 201); const created = state.calls.find(c => c.action === "auth.admin.createUser"); assert.equal(created.payload.app_metadata.role, "master_admin"); assert.equal(response.body.data.user.role, "master_admin");
    });
    await check("Disabled master is blocked before protected API writes", async () => {
      reset({ role: "master_admin", profile: { is_active: false } }); const response = await request("/v1/auth/admin/master-admin/bootstrap", "POST", account, authHeaders); assert.equal(response.status, 403); assert.equal(writes().length, 0);
    });
    await check("Disabled learner is blocked from authenticated API routes", async () => {
      reset({ profile: { account_status: "suspended" } }); assert.equal((await request("/v1/auth/me", "GET", undefined, authHeaders)).status, 403);
    });
    await check("Blocked or deleted legacy status cannot be masked by an active account status", async () => {
      for (const status of ["blocked", "deleted"]) { reset({ profile: { account_status: "active", status } }); assert.equal((await request("/v1/auth/me", "GET", undefined, authHeaders)).status, 403); }
    });
    await check("API admin authorization errors redact upstream profile database details", async () => {
      reset({ role: "master_admin", profileError: true }); const response = await request("/v1/auth/admin/master-admin/bootstrap", "POST", account, authHeaders); assert.equal(response.status, 500); assert.ok(!JSON.stringify(response.body).includes("fixture-private-secret"));
    });
    await check("Invalid API registration returns 400 without Auth or scaffold writes", async () => {
      const response = await request("/v1/auth/register", "POST", { email: "not-email", password: "short" }); assert.equal(response.status, 400); assert.equal(state.calls.length, 0); assert.ok(!JSON.stringify(response.body).includes("ZodError"));
    });
    await check("API assistant creation enforces the privileged eight-character password minimum", async () => {
      reset({ role: "master_admin" }); const response = await request("/v1/admin/assistants", "POST", { ...account, password: "short-7" }, authHeaders); assert.equal(response.status, 400); assert.equal(writes().length, 0);
    });
    await check("Unconfirmed API signup without a session performs no admin scaffold writes", async () => {
      reset({ noSignupSession: true, signupUserId: ids.other }); const response = await request("/v1/auth/register", "POST", account); assert.equal(response.status, 400); assert.match(response.body.message, /confirm/i); assert.equal(state.calls.filter(c => c.action === "auth.signUp").length, 1); assert.equal(writes().length, 0);
    });
    await check("API login preserves trusted assistant role and ignores edited user role", async () => {
      reset({ role: "assistant_admin", userRole: "master_admin" }); const response = await request("/v1/auth/login", "POST", { email: "fixture@test.invalid", password: "fixture-password-123" }); assert.equal(response.status, 200); assert.equal(response.body.data.user.role, "assistant_admin"); assert.equal(writes().length, 0);
    });
    await check("API login corrects forged profile role to trusted ordinary user", async () => {
      reset({ profileRole: "master_admin", userRole: "master_admin" }); const response = await request("/v1/auth/login", "POST", { email: "fixture@test.invalid", password: "fixture-password-123" }); assert.equal(response.status, 200); assert.equal(response.body.data.user.role, "user"); const profileWrite = state.calls.find(c => c.action === "db" && c.table === "profiles" && c.operation === "upsert"); assert.equal(profileWrite.payload.role, "user");
    });
    await check("API server errors redact upstream SQL and private values", async () => {
      reset({ documentReadError: true }); const response = await request("/v1/applications/me/documents", "GET", undefined, authHeaders); assert.equal(response.status, 500); assert.ok(!JSON.stringify(response.body).includes("fixture-private-secret")); assert.match(response.body.message, /try again/i);
    });
    await check('Unverified API applications cannot enter submitted fulfillment',async()=>{reset();const response=await request('/v1/applications/me/'+ids.app+'/submit','POST',{},authHeaders);assert.equal(response.status,403);assert.equal(writes().length,0);});
    await check('API marks save uses one atomic RPC with the authenticated owner',async()=>{reset();const response=await request('/v1/applications/me/'+ids.app+'/forms/marks','PUT',{subjects:[{subject:'Mathematics',percent:80,level:7}]},authHeaders);assert.equal(response.status,200);const call=state.calls.find(c=>c.action==='db.rpc');assert.equal(call.name,'replace_application_marks');assert.equal(call.payload.p_owner_id,ids.user);assert.equal(state.calls.filter(c=>c.table==='application_marks'&&c.operation==='delete').length,0);});
    await check('Failed atomic marks save returns a redacted error without deleting marks',async()=>{reset({rpcError:true});const response=await request('/v1/applications/me/'+ids.app+'/forms/marks','PUT',{subjects:[{subject:'Mathematics',percent:80,level:7}]},authHeaders);assert.equal(response.status,500);assert.ok(!JSON.stringify(response.body).includes('fixture-private-secret'));assert.equal(state.calls.filter(c=>c.table==='application_marks'&&c.operation==='delete').length,0);});
    await check("Document record failure cleans up the exact uploaded storage object", async () => {
      reset({ documentInsertError: true }); const response = await request("/v1/applications/me/" + ids.app + "/documents", "POST", Buffer.from("%PDF-1.4 fixture"), { ...authHeaders, "content-type": "application/pdf", "x-kagie-file-name": "fixture.pdf", "x-kagie-document-type": "id_copy" }); assert.equal(response.status, 500); const uploaded = state.calls.find(c => c.action === "storage.upload"), removed = state.calls.find(c => c.action === "storage.remove"); assert.ok(uploaded); assert.ok(removed); assert.deepEqual(removed.paths, [uploaded.objectPath]); assert.ok(uploaded.objectPath.startsWith(ids.user + "/" + ids.app + "/")); assert.ok(!JSON.stringify(response.body).includes("fixture-private-secret"));
    });
    await check("Document upload cannot access another learner's application", async () => {
      reset({ applicationOwner: ids.other }); const response = await request("/v1/applications/me/" + ids.app + "/documents", "POST", Buffer.from("%PDF-1.4 fixture"), { ...authHeaders, "content-type": "application/pdf", "x-kagie-file-name": "fixture.pdf", "x-kagie-document-type": "id_copy" }); assert.equal(response.status, 404); assert.equal(writes().length, 0);
    });
    await check("Malformed encoded document headers return validation error before storage writes", async () => {
      const response = await request("/v1/applications/me/" + ids.app + "/documents", "POST", Buffer.from("%PDF-1.4 fixture"), { ...authHeaders, "content-type": "application/pdf", "x-kagie-file-name": "%E0%A4%A", "x-kagie-document-type": "id_copy" }); assert.equal(response.status, 400); assert.equal(writes().length, 0);
    });
    await check("API document upload accepts advertised Word document MIME types", async () => {
      for (const [extension, mime] of [["doc", "application/msword"], ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]) { reset(); const response = await request("/v1/applications/me/" + ids.app + "/documents", "POST", Buffer.from("fixture Word document"), { ...authHeaders, "content-type": mime, "x-kagie-file-name": "fixture." + extension, "x-kagie-document-type": "supporting_document" }); assert.equal(response.status, 201); assert.equal(state.calls.find(c => c.action === "storage.upload").settings.contentType, mime); }
    });
    await check("API rejects documents over the advertised eight-MiB limit before storage writes", async () => {
      const response = await request("/v1/applications/me/" + ids.app + "/documents", "POST", Buffer.alloc(8 * 1024 * 1024 + 1), { ...authHeaders, "content-type": "application/pdf", "x-kagie-file-name": "fixture.pdf", "x-kagie-document-type": "id_copy" }); assert.equal(response.status, 413); assert.equal(writes().length, 0);
    });
    await check("Production API accepts its configured Kagie origin", async () => {
      const response = await request("/v1/health", "GET", undefined, { origin: "https://kagie.app" }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "https://kagie.app");
    });
    await check("Production API rejects arbitrary Vercel preview origins", async () => {
      const response = await request("/v1/health", "GET", undefined, { origin: "https://attacker-controlled-preview.vercel.app" }); assert.equal(response.status, 403); assert.equal(response.headers.get("access-control-allow-origin"), null);
    });
    await check("Production API accepts an explicitly configured preview origin", async () => {
      const response = await request("/v1/health", "GET", undefined, { origin: "https://kagie-controlled-preview.vercel.app" }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "https://kagie-controlled-preview.vercel.app");
    });
    const report = { generatedAt: new Date().toISOString(), mode: "actual built Express app and local HTTP server with in-memory Supabase SDK stub", passed: checks.length, checks, liveExternalRequests: 0 };
    fs.mkdirSync(path.join(root, "reports/backend-audit"), { recursive: true }); fs.writeFileSync(path.join(root, "reports/backend-audit/api-checks.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ passed: checks.length, liveExternalRequests: 0 }));
  } finally { global.fetch = actualFetch; await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
