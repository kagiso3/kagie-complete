const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "reports/backend-audit");
const checks = [];
const slash = value => value.replace(/\\/g, "/");
const relative = file => slash(path.relative(root, file));

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (["node_modules", ".git", ".next", "build", ".gradle", ".gradle-home"].includes(entry.name)) return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}
function check(name, action) { const result = action(); checks.push(name); console.log("PASS " + name); return result; }
async function asyncCheck(name, action) { const result = await action(); checks.push(name); console.log("PASS " + name); return result; }
function payloadRole(token) {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))?.role || "unknown"; } catch { return "malformed"; }
}
function fixtureJwt(role) { return [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ role })).toString("base64url"), "synthetic-signature-for-test-only"].join("."); }

async function invokeConfig(env = {}, method = "GET") {
  const filename = path.join(root, "api/runtime-config.js");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module, exports: module.exports, process: { env }, Buffer }, { filename });
  const result = { statusCode: 200, headers: {}, body: null, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); } };
  await module.exports({ method }, result);
  return result;
}

async function main() {
  const validAnon = fixtureJwt("anon"), privateService = fixtureJwt("service_role"), userToken = fixtureJwt("authenticated");
  const publishable = "sb_publishable_fixture_public_key_123456789";
  const secret = "sb_secret_fixture_private_key_never_printed";
  for (const [label, value] of [["service-role JWT", privateService], ["secret key", secret], ["authenticated user JWT", userToken], ["malformed key", "not-a-public-key"], ["malformed JWT", "header.invalid.signature"]]) {
    await asyncCheck("Runtime config rejects " + label + " without echoing the input", async () => {
      const result = await invokeConfig({ SUPABASE_ANON_KEY: value });
      assert.ok(result.body.data.supabase.anonKey === "", "Rejected credentials must not be returned");
      assert.ok(result.body.data.supabase.enabled === false, "Rejected credentials must disable browser auth config");
      assert.ok(!JSON.stringify(result.body).includes(value), "Rejected credentials must not appear anywhere in the payload");
      assert.equal(result.statusCode, 200);
    });
  }
  await asyncCheck("Runtime config rejects a private key under its public fallback variable too", async () => {
    const result = await invokeConfig({ KAGIE_PUBLIC_SUPABASE_ANON_KEY: privateService }); assert.ok(result.body.data.supabase.anonKey === ""); assert.ok(!JSON.stringify(result.body).includes(privateService));
  });
  for (const [label, value] of [["anon JWT", validAnon], ["publishable key", publishable]]) await asyncCheck("Runtime config retains a valid public " + label, async () => {
    const result = await invokeConfig({ SUPABASE_ANON_KEY: value }); assert.ok(result.body.data.supabase.anonKey === value); assert.ok(result.body.data.supabase.enabled === true); assert.match(result.headers["cache-control"], /no-store/);
  });
  await asyncCheck("Public runtime payload never includes configured private provider/server keys", async () => {
    const env = Object.fromEntries(["SUPABASE_SERVICE_ROLE_KEY", "YOCO_SECRET_KEY", "YOCO_WEBHOOK_SECRET", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "JWT_ACCESS_SECRET"].map(name => [name, "synthetic-private-" + name]));
    const result = await invokeConfig(env); for (const [name, value] of Object.entries(env)) { assert.ok(!JSON.stringify(result.body).includes(value), name + " must remain server-only"); assert.ok(!Object.keys(result.body.data).includes(name)); }
  });
  await asyncCheck("Runtime config GET and OPTIONS responses explicitly disable caching", async () => {
    for (const method of ["GET", "OPTIONS"]) { const result = await invokeConfig({}, method); assert.equal(result.statusCode, 200); assert.match(result.headers["cache-control"], /no-store/); }
  });
  await asyncCheck("Runtime config does not return configuration for mutation methods", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) { const result = await invokeConfig({}, method); assert.equal(result.statusCode, 405); assert.ok(!result.body.data); }
  });

  const sourceRoots = ["api", "server/functions", "js", "kagie-api/src", "kagie-web/src", "kagie-web/public", "website/public", "kagie-landing/public"];
  const sourceFiles = [...new Set(sourceRoots.flatMap(folder => walk(path.join(root, folder))).concat(fs.readdirSync(root).filter(name => /\.(html|js|json|cjs|mjs)$/.test(name)).map(name => path.join(root, name))))]
    .filter(filename => /\.(js|ts|tsx|json|html|cjs|mjs)$/.test(filename) && !path.basename(filename).startsWith(".env"));
  const credentialFindings = [], jwtRoles = [], environmentReferences = new Map();
  for (const filename of sourceFiles) {
    const text = fs.readFileSync(filename, "utf8");
    for (const match of text.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]+)|\[["']([A-Z][A-Z0-9_]+)["']\])/g)) {
      const name = match[1] || match[2]; if (!environmentReferences.has(name)) environmentReferences.set(name, new Set()); environmentReferences.get(name).add(relative(filename));
    }
    const add = (kind, index) => credentialFindings.push({ file: relative(filename), line: text.slice(0, index).split("\n").length, kind });
    for (const match of text.matchAll(/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/g)) {
      const role = payloadRole(match[0]); if (["anon", "service_role", "authenticated"].includes(role)) jwtRoles.push({ file: relative(filename), line: text.slice(0, match.index).split("\n").length, role });
      if (["service_role", "authenticated"].includes(role)) add("embedded " + role + " JWT", match.index);
    }
    for (const match of text.matchAll(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g)) add("private key material", match.index);
    for (const match of text.matchAll(/\bsb_secret_[A-Za-z0-9_-]{20,}\b/g)) add("Supabase secret key literal", match.index);
    for (const match of text.matchAll(/\b(?:sk_live_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|re_[A-Za-z0-9]{28,})\b/g)) add("provider secret/access key literal", match.index);
  }
  check("No service-role/user-session JWT or recognized private/provider key literal appears in audited canonical/public source", () => assert.equal(credentialFindings.length, 0, "Inspect redacted credential finding metadata before release"));

  const envPaths = [".env", ".env.local", ".env.production", ".env.production.local", "kagie-api/.env", "kagie-api/.env.example", "kagie-mobile/.env", "kagie-mobile/.env.example", "kagie-mobile/.env.production.example"];
  // Extract variable names only; never parse, print, compare or validate values.
  const localEnv = envPaths.map(name => {
    const filename = path.join(root, name); if (!fs.existsSync(filename)) return { file: name, exists: false, keyNames: [] };
    const names = Array.from(fs.readFileSync(filename, "utf8").matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm), match => match[1]);
    return { file: name, exists: true, keyNames: [...new Set(names)].sort() };
  });
  const presentNames = new Set(localEnv.filter(item => !item.file.includes("example")).flatMap(item => item.keyNames));
  const envInventory = Array.from(environmentReferences).sort(([a], [b]) => a.localeCompare(b)).map(([name, files]) => ({ name, declaredInLocalFile: presentNames.has(name), presentInAuditProcess: Object.prototype.hasOwnProperty.call(process.env, name), referencedBy: [...files].sort() }));
  const privateEnvPaths = localEnv.filter(item => item.exists && !item.file.includes("example")).map(item => item.file);
  const trackedEnvFiles = execFileSync("git", ["ls-files", "--", ...privateEnvPaths], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  const ignoredEnvFiles = execFileSync("git", ["check-ignore", "--", ...privateEnvPaths], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  check("Private local env files are untracked and excluded by Git ignore rules", () => assert.ok(!trackedEnvFiles.length && privateEnvPaths.every(file => ignoredEnvFiles.includes(file))));

  const apiFiles = walk(path.join(root, "api")).filter(filename => filename.endsWith(".js") && !relative(filename).includes("/_lib/"));
  const wrappers = [];
  for (const filename of apiFiles) {
    const source = fs.readFileSync(filename, "utf8");
    if (!source.includes("createServerlessAdapter")) continue;
    const module = { exports: {} }; let captured;
    vm.runInNewContext(source, { module, exports: module.exports, __dirname: path.dirname(filename), require(name) {
      if (name === "node:path") return path;
      if (name.includes("serverless-adapter")) return { createServerlessAdapter(handlerPath, options) { captured = { handler: relative(handlerPath), rawBodyRequired: options?.requireRawBody === true }; return () => {}; } };
      throw new Error("Unexpected API wrapper dependency");
    } }, { filename });
    assert.ok(captured, "Wrapper should declare its target handler");
    wrappers.push({ routeFile: relative(filename), ...captured, exists: fs.existsSync(path.join(root, captured.handler)), bodyParserDisabled: module.exports.config?.api?.bodyParser === false });
  }
  check("Every serverless API wrapper resolves to an existing canonical handler", () => assert.ok(wrappers.length >= 10 && wrappers.every(item => item.exists)));
  check("Signed PayFast and Yoco callbacks preserve raw request bodies", () => assert.ok(wrappers.filter(item => /itn|webhook/.test(item.routeFile)).every(item => item.rawBodyRequired && item.bodyParserDisabled)));
  check("Compiled Express entrypoint exists for the Vercel catch-all wrapper", () => assert.ok(fs.existsSync(path.join(root, "kagie-api/dist/app.js"))));
  const requireRoot = createRequire(path.join(root, "package.json"));
  const { nodeFileTrace } = requireRoot("./kagie-landing/node_modules/next/dist/compiled/@vercel/nft/index.js");
  const trace = await nodeFileTrace(apiFiles.map(relative), { base: root, processCwd: root });
  const traced = new Set(Array.from(trace.fileList, slash));
  const expectedHelpers = ["server/functions/_admin-auth.js", "server/functions/_supabase-url.js", "server/functions/_payment-checkout.js", "server/functions/_payment-reservation.js", "api/_lib/serverless-adapter.js", "kagie-api/dist/app.js"];
  check("Node File Trace includes canonical auth/payment helpers and compiled API", () => assert.ok(expectedHelpers.every(file => traced.has(file))));
  check("Node File Trace includes every canonical route target", () => assert.ok(wrappers.every(item => traced.has(item.handler))));
  check("No local environment files are traced into function runtime bundles", () => assert.ok(!Array.from(traced).some(file => /(?:^|\/)\.env(?:\.|$)/.test(file))));
  check("Private recovery directory is excluded from Vercel uploads and function bundles",()=>{
    assert.match(fs.readFileSync(path.join(root,'.vercelignore'),'utf8'),/^\.backend-repair\s*$/m);
    assert.ok(!Array.from(traced).some(file=>file.startsWith('.backend-repair/')));
    assert.ok(!fs.existsSync(path.join(root,'web-release/.backend-repair')));
  });

  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rewrites = vercel.rewrites.filter(item => String(item.source).startsWith("/v1/"));
  const sourceRoutes = walk(path.join(root, "kagie-api/src/modules")).filter(file => file.endsWith(".routes.ts")).map(filename => ({ file: relative(filename), count: Array.from(fs.readFileSync(filename, "utf8").matchAll(/router\.(get|post|put|patch|delete)\s*\(/g)).length }));
  const report = {
    generatedAt: new Date().toISOString(), passed: checks.length, checks,
    mode: "local source scan, synthetic public-config VM fixtures, wrapper resolution and Node File Trace; no cloud/network writes",
    sourceScan: { fileCount: sourceFiles.length, credentialFindings, embeddedJwtRoles: jwtRoles, scopeRoots: sourceRoots },
    localEnvironment: { valueInspectionPerformed: false, files: localEnv, trackedEnvFiles, ignoredEnvFiles, referencedVariables: envInventory, requiredBackendNames: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map(name => ({ name, declaredInLocalFile: presentNames.has(name), presentInAuditProcess: Object.prototype.hasOwnProperty.call(process.env, name) })) },
    packaging: { apiFiles: apiFiles.map(relative), wrappers, compiledApiExists: true, traceFileCount: traced.size, expectedHelpers: expectedHelpers.map(file => ({ file, traced: traced.has(file) })), warnings: Array.from(trace.warnings, warning => String(warning.message).split("\n")[0]), tracedEnvFiles: [], rewrites, sourceRoutes, outputDirectory: vercel.outputDirectory },
    limits: ["Local key-name presence does not validate secret values or production environment settings.", "Local Node File Trace is not a completed Vercel deployment or build-output inspection.", "Vercel Functions cap HTTP request/response payloads at 4.5 MB; the 8 MiB Express raw upload route cannot transfer its advertised maximum through that hosting path. Direct browser-to-Supabase Storage upload avoids that function body limit."]
  };
  fs.mkdirSync(reportDir, { recursive: true }); fs.writeFileSync(path.join(reportDir, "config-packaging.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: checks.length, scannedFiles: sourceFiles.length, credentialFindings: credentialFindings.length, tracedFiles: traced.size, traceWarnings: trace.warnings.size, externalRequests: 0 }));
}
main().catch(error => { console.error(error?.message || "Config audit failed"); process.exitCode = 1; });
