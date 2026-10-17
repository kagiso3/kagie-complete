const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const checks = [];
const ids = { master: "master-fixture", assistant: "assistant-fixture", learner: "learner-fixture", other: "other-fixture" };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body });

function fixture(options = {}) {
  const role = options.role || "master_admin";
  const actor = { id: options.actorId || (role === "assistant_admin" ? ids.assistant : ids.master), email: "actor@test.invalid", app_metadata: { role: options.appRole || role }, user_metadata: { role: options.userRole || "user" } };
  if (options.bannedUntil) actor.banned_until = options.bannedUntil;
  if (options.deletedAt) actor.deleted_at = options.deletedAt;
  const ownProfile = options.noProfile ? null : { id: actor.id, role, full_name: "Fixture actor", is_active: true, ...options.profile };
  const profiles = [ownProfile, { id: ids.assistant, role: "assistant_admin", full_name: "Fixture assistant", is_active: true, ...options.assistantProfile }, { id: ids.learner, role: "user", full_name: "Assigned learner", email: "learner@test.invalid", is_active: true }, { id: ids.other, role: "user", full_name: "Other learner", email: "other@test.invalid", is_active: true }].filter(Boolean);
  const calls = [];
  const environment = { SUPABASE_URL: "https://auditfixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key", SUPABASE_ANON_KEY: "fixture-anon-key", NODE_ENV: "production", RESEND_API_KEY: "fixture-resend-key", MARKETING_FROM_EMAIL: "Kagie <no-reply@test.invalid>", ...options.env };
  async function fetch(urlArg, request = {}) {
    const url = new URL(urlArg);
    const method = request.method || "GET";
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    calls.push({ url: url.href, pathname: url.pathname, method, body, headers: request.headers });
    if (url.hostname === "api.resend.com") return json(200, { id: "fixture-email" });
    assert.equal(url.origin, "https://auditfixture.supabase.co", "No request may leave the isolated fixture");
    if (url.pathname === "/auth/v1/user") return json(options.authStatus || 200, options.authStatus ? { message: "Invalid session" } : actor);
    if (url.pathname === "/auth/v1/admin/users" && method === "POST") return options.duplicate ? json(422, { message: "User already registered" }) : json(201, { id: "new-fixture", created_at: "2026-10-15T00:00:00Z" });
    if (url.pathname === "/auth/v1/admin/users") return json(200, { users: profiles.map(p => ({ id: p.id, email: p.email, app_metadata: { role: p.role } })) });
    if (url.pathname.startsWith("/auth/v1/admin/users/")) { const id = url.pathname.split("/").pop(); if (method === "PUT" && options.deleteStatus) return json(options.deleteStatus, { message: "Fixture foreign key blocked deletion" }); return json(200, { id, app_metadata: { role: options.targetRole || (id === ids.learner ? "user" : "assistant_admin") } }); }
    if(url.pathname==="/rest/v1/profiles" && method==="PATCH" && options.profilePatchStatus)return json(options.profilePatchStatus,{message:"Fixture profile mirror failure"});
    if (url.pathname === "/rest/v1/profiles" && method === "GET") {
      if (options.profileStatus) return json(options.profileStatus, { message: "fixture-private-secret: profile lookup unavailable" });
      const lookup = url.searchParams.get("id")?.replace(/^eq\./, "") || url.searchParams.get("or")?.match(/id\.eq\.([^,)]+)/)?.[1];
      if (lookup) return json(200, profiles.filter(p => p.id === lookup));
      if (url.searchParams.has("is_active")) {
        const recipients = options.recipients || profiles.filter(p => p.role === "user");
        const offset = Number(url.searchParams.get("offset") || 0), limit = Number(url.searchParams.get("limit") || 1000);
        return json(200, recipients.slice(offset, offset + limit));
      }
      return json(200, profiles);
    }
    if (url.pathname === "/rest/v1/applications") return json(200, method === "GET" ? [{ id: "application-fixture", user_id: ids.learner, assistant_id: ids.assistant, application_type: "undergraduate", status: "Draft" }] : []);
    return json(200, []);
  }
  function handler(name) {
    const filename = path.join(root, "server/functions", name + ".js");
    const sandbox = { module: { exports: {} }, exports: {}, require: createRequire(filename), process: { env: environment }, fetch, Buffer, URL, URLSearchParams, console: { warn() {}, info() {}, error() {} } };
    sandbox.exports = sandbox.module.exports;
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
    return sandbox.module.exports.handler;
  }
  async function invoke(name, method = "GET", body, headers = { authorization: "Bearer fixture-token" }) {
    const result = await handler(name)({ httpMethod: method, headers, queryStringParameters: options.query || {}, body: typeof body === "string" ? body : JSON.stringify(body || {}) });
    return { ...result, data: JSON.parse(result.body || "{}") };
  }
  return { invoke, calls };
}

function writes(calls) { return calls.filter(call => ["POST", "PUT", "PATCH", "DELETE"].includes(call.method)); }
async function check(name, action) { await action(); checks.push(name); console.log("PASS " + name); }
const account = { fullName: "New fixture admin", email: "new@test.invalid", password: "fixture-password-123" };
const broadcast = { title: "Fixture news", message: "Fixture message", channels: { inApp: false, email: true } };

async function main() {
  await check("Anonymous bootstrap cannot inspect, reset, or create accounts", async () => {
    const f = fixture(); assert.equal((await f.invoke("admin-bootstrap-master", "POST", account, {})).statusCode, 401); assert.equal(f.calls.length, 0);
  });
  await check("Editable user metadata cannot authorize master provisioning", async () => {
    const f = fixture({ role: "user", appRole: "user", userRole: "master_admin" }); assert.equal((await f.invoke("admin-bootstrap-master", "POST", account)).statusCode, 403); assert.equal(writes(f.calls).length, 0);
  });
  await check("Active verified master can provision a new master with trusted metadata", async () => {
    const f = fixture(); const result = await f.invoke("admin-bootstrap-master", "POST", account); assert.equal(result.statusCode, 201);
    const created = f.calls.find(c => c.pathname === "/auth/v1/admin/users" && c.method === "POST"); assert.equal(created.body.app_metadata.role, "master_admin"); assert.equal(created.body.user_metadata.role, undefined);
    assert.equal(f.calls.filter(c => c.method === "PUT").length, 0); assert.match(result.headers["Cache-Control"], /no-store/);
  });
  await check("Duplicate master email never resets or deletes existing account", async () => {
    const f = fixture({ duplicate: true }); assert.equal((await f.invoke("admin-bootstrap-master", "POST", account)).statusCode, 409); assert.equal(f.calls.filter(c => ["PUT", "DELETE"].includes(c.method)).length, 0);
  });
  for (const name of ["admin-users", "admin-assistants", "admin-config-status", "admin-marketing-broadcast", "admin-bootstrap-master", "auth-role"]) {
    const method = ["admin-marketing-broadcast", "admin-bootstrap-master"].includes(name) ? "POST" : "GET";
    const body = name === "admin-marketing-broadcast" ? broadcast : account;
    await check(name + " rejects disabled staff before privileged operations", async () => {
      const f = fixture({ profile: { is_active: false } }); assert.equal((await f.invoke(name, method, body)).statusCode, 403); assert.equal(writes(f.calls).length, 0);
    });
    await check(name + " fails closed when profile authority is unavailable", async () => {
      const f = fixture({ profileStatus: 503 }); const response = await f.invoke(name, method, body); assert.equal(response.statusCode, 503); assert.ok(!response.body.includes("fixture-private-secret")); assert.equal(writes(f.calls).length, 0);
    });
    await check(name + " ignores a forged master role in the editable profile", async () => {
      const f = fixture({ role: "master_admin", appRole: "user", userRole: "master_admin" }); const result = await f.invoke(name, method, body);
      if (name === "auth-role") { assert.equal(result.statusCode, 200); assert.equal(result.data.data.role, "user"); assert.equal(result.data.data.profile.role, "user"); }
      else assert.equal(result.statusCode, 403);
      assert.equal(writes(f.calls).length, 0);
    });
  }
  await check("Status endpoint hides setup details without a token", async () => {
    const f = fixture(); const result = await f.invoke("admin-config-status", "GET", {}, {}); assert.equal(result.statusCode, 401); assert.equal(result.data.data, undefined); assert.equal(f.calls.length, 0);
  });
  await check("Role resolver ignores forged editable metadata", async () => {
    const f = fixture({ role: "user", appRole: "user", userRole: "master_admin" }); const result = await f.invoke("auth-role"); assert.equal(result.statusCode, 200); assert.equal(result.data.data.role, "user"); assert.equal(writes(f.calls).length, 0);
  });
  await check("Role resolver checks disabled profile with anon-only server configuration", async () => {
    const f = fixture({ profile: { account_status: "blocked" }, env: { SUPABASE_SERVICE_ROLE_KEY: "" } }); assert.equal((await f.invoke("auth-role")).statusCode, 403); const profileRead = f.calls.find(c => c.pathname === "/rest/v1/profiles"); assert.equal(profileRead.headers.Authorization, "Bearer fixture-token");
  });
  await check("Missing staff profile cannot bypass the account-status check", async () => {
    const f = fixture({ noProfile: true }); assert.equal((await f.invoke("auth-role")).statusCode, 403); assert.equal(writes(f.calls).length, 0);
  });
  await check("An active legacy status field cannot override a blocked account status", async () => {
    for (const status of ["blocked", "deleted"]) { const f = fixture({ profile: { account_status: "active", status } }); assert.equal((await f.invoke("admin-users")).statusCode, 403); }
  });
  await check("Admin directory rejects a banned authenticated actor", async () => {
    for (const options of [{ bannedUntil: "2099-01-01T00:00:00Z" }, { deletedAt: "2026-10-14T00:00:00Z" }]) { const f = fixture(options); assert.equal((await f.invoke("admin-users")).statusCode, 403); }
  });
  await check("Assistant directory scope excludes unassigned learner records", async () => {
    const f = fixture({ role: "assistant_admin" }); const result = await f.invoke("admin-users"); assert.equal(result.statusCode, 200); assert.deepEqual(result.data.data.map(row => row.id), [ids.learner]);
  });
  await check("Editable profile user_id cannot impersonate another assistant's assignment scope", async () => {
    const f = fixture({ role: "assistant_admin", profile: { user_id: "another-assistant-fixture" } }); const result = await f.invoke("admin-users"); assert.equal(result.statusCode, 200); assert.deepEqual(result.data.data.map(row => row.id), [ids.learner]);
  });
  await check("Assistant directory reads use caller JWT and never list Auth users",async()=>{const f=fixture({role:'assistant_admin'});assert.equal((await f.invoke('admin-users')).statusCode,200);const reads=f.calls.filter(c=>c.pathname.startsWith('/rest/v1/')&&c.method==='GET'&&!c.url.includes('profiles?id='));assert.ok(reads.length);assert.ok(reads.every(c=>c.headers.Authorization==='Bearer fixture-token'));assert.equal(f.calls.filter(c=>c.pathname==='/auth/v1/admin/users').length,0);});
  await check("Malformed assignment JSON returns validation error without writes", async () => {
    const f = fixture(); assert.equal((await f.invoke("admin-users", "POST", "{bad json")).statusCode, 400); assert.equal(writes(f.calls).length, 0);
  });
  await check("Staff account cannot be assigned as a learner", async () => {
    const f = fixture(); assert.equal((await f.invoke("admin-users", "POST", { userId: ids.assistant, assistantAdminId: ids.assistant })).statusCode, 400); assert.equal(writes(f.calls).length, 0);
  });
  await check("Disabled assistant cannot receive a learner assignment", async () => {
    const f = fixture({ assistantProfile: { is_active: false } }); assert.equal((await f.invoke("admin-users", "POST", { userId: ids.learner, assistantAdminId: ids.assistant })).statusCode, 403); assert.equal(writes(f.calls).length, 0);
  });
  await check("A forged assistant profile cannot authorize assignment to an ordinary Auth user", async () => {
    const f = fixture({ targetRole: "user" }); assert.equal((await f.invoke("admin-users", "POST", { userId: ids.learner, assistantAdminId: ids.assistant })).statusCode, 400); assert.equal(writes(f.calls).length, 0);
  });
  await check("Assistant provisioning synchronizes Auth and database roles", async () => {
    const f = fixture(); assert.equal((await f.invoke("admin-assistants", "POST", account)).statusCode, 201); const rows = f.calls.filter(c => c.pathname === "/rest/v1/profiles" && c.method === "POST"); assert.equal(rows.length, 1); assert.equal(rows[0].body.role, "assistant_admin");
  });
  await check("Assistant provisioning cannot convert an existing learner account", async () => {
    const f = fixture(); assert.equal((await f.invoke("admin-assistants", "POST", { ...account, email: "learner@test.invalid" })).statusCode, 409); assert.equal(writes(f.calls).length, 0);
  });
  await check("Assistant deletion rejects a master Auth account even if the profile role was altered", async () => {
    const f = fixture({ targetRole: "master_admin" }); assert.equal((await f.invoke("admin-assistants", "DELETE", { assistantId: ids.assistant })).statusCode, 400); assert.equal(writes(f.calls).length, 0);
  });
  await check('Failed assistant access revocation never erases or detaches data',async()=>{const f=fixture({deleteStatus:409});assert.equal((await f.invoke('admin-assistants','DELETE',{assistantId:ids.assistant})).statusCode,409);assert.equal(writes(f.calls).length,1);assert.equal(writes(f.calls)[0].method,'PUT');assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);});
  await check('Assistant removal revokes trusted role while preserving account and all related rows',async()=>{const f=fixture();const r=await f.invoke('admin-assistants','DELETE',{assistantId:ids.assistant});assert.equal(r.statusCode,200);assert.equal(r.data.data.accountPreserved,true);const auth=writes(f.calls).find(c=>c.pathname.startsWith('/auth/v1/admin/users/'));assert.equal(auth.method,'PUT');assert.equal(auth.body.app_metadata.role,'user');assert.equal(auth.body.password,undefined);assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);assert.ok(writes(f.calls).every(c=>c.pathname.startsWith('/auth/v1/admin/users/')||c.pathname==='/rest/v1/profiles'));});
  await check('Failed profile mirroring never restores revoked Auth authority',async()=>{const f=fixture({profilePatchStatus:503});const r=await f.invoke('admin-assistants','DELETE',{assistantId:ids.assistant});assert.equal(r.statusCode,200);assert.equal(r.data.data.profileSyncPending,true);assert.equal(writes(f.calls).find(c=>c.method==='PUT').body.app_metadata.role,'user');assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);});
  await check("Email output escapes message, title, CTA label and URL attributes", async () => {
    const f = fixture(); assert.equal((await f.invoke("admin-marketing-broadcast", "POST", { ...broadcast, title: '<img src=x onerror="x">', message: "Hello <b>world</b>\nNext", ctaLabel: "<unsafe>", ctaHref: "/updates?q=one&other=two" })).statusCode, 200);
    const email = f.calls.find(c => c.pathname === "/emails").body; assert.ok(email.html.includes("&lt;img")); assert.ok(!email.html.includes("<img")); assert.ok(email.html.includes("Hello &lt;b&gt;world&lt;/b&gt;<br>Next")); assert.ok(email.html.includes("&lt;unsafe&gt;")); assert.ok(email.html.includes("https://kagie.app/updates?q=one&amp;other=two"));
  });
  await check("Unsafe broadcast link protocols are rejected without delivery", async () => {
    for (const ctaHref of ["javascript:alert(1)", "data:text/html,hello", "//attacker.test.invalid", "https://user:password@attacker.test.invalid", "\\\\attacker.test.invalid"]) {
      const f = fixture(); assert.equal((await f.invoke("admin-marketing-broadcast", "POST", { ...broadcast, ctaHref })).statusCode, 400); assert.equal(f.calls.length, 0);
    }
  });
  await check("Relative broadcast link does not trust Origin or forwarded host", async () => {
    const f = fixture(); await f.invoke("admin-marketing-broadcast", "POST", { ...broadcast, ctaLabel: "Open", ctaHref: "/dashboard.html" }, { authorization: "Bearer fixture-token", origin: "https://attacker.test.invalid", "x-forwarded-host": "attacker.test.invalid" }); const email = f.calls.find(c => c.pathname === "/emails").body; assert.ok(email.html.includes("https://kagie.app/dashboard.html")); assert.ok(!email.html.includes("attacker.test.invalid"));
  });
  await check("Broadcast recipient paging includes records past the REST default limit", async () => {
    const recipients = Array.from({ length: 1001 }, (_, index) => ({ id: "recipient-" + index, role: "user", email: "recipient" + index + "@test.invalid" })); const f = fixture({ recipients }); const result = await f.invoke("admin-marketing-broadcast", "POST", { ...broadcast, channels: { inApp: true, email: false } }); assert.equal(result.statusCode, 200); assert.equal(result.data.data.totalRecipients, 1001); assert.equal(result.data.data.inAppDelivered, 1001);
  });
  for (const name of ["admin-assistants", "admin-marketing-broadcast", "admin-bootstrap-master"]) await check(name + " rejects JSON null with a validation response", async () => {
    const f = fixture(); assert.equal((await f.invoke(name, "POST", "null")).statusCode, 400); assert.equal(writes(f.calls).length, 0);
  });
  const report = { generatedAt: new Date().toISOString(), mode: "isolated VM fixtures, no network or live data", passed: checks.length, checks };
  fs.mkdirSync(path.join(root, "reports/backend-audit"), { recursive: true });
  fs.writeFileSync(path.join(root, "reports/backend-audit/auth-admin-checks.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: checks.length, externalRequests: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
