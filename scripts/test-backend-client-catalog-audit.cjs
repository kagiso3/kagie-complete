const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js/backend.js"), "utf8");
const start = source.indexOf("  function normalizeInstitutionLifecycleStatus(");
const end = source.indexOf("  function getAccommodationListingsForAdmin(", start);
assert.ok(start >= 0 && end > start, "Find the real catalog source function region");
const code = `let institutionCatalogCache = null; let remoteInstitutionCatalogCache = null;
const institutionQueryCache = new Map();
${source.slice(start, end)}
globalThis.catalog = { normalizeRemoteInstitutionRow, normalizeInstitutionRemotePayload, getInstitutionCatalog, getInstitutionCatalogAsync, getInstitutionsForAdminAsync, addInstitutionByAdminAsync, updateInstitutionByAdminAsync, deleteInstitutionByAdminAsync };`;
const id = "11111111-1111-4111-8111-111111111111";
const newId = "22222222-2222-4222-8222-222222222222";
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const baseRow = () => ({ id, name: "Database institution", province: "Gauteng", institution_type: "University", website: "https://institution.test.invalid", notes: "Database notes", opening_date: "2026-01-15", closing_date: "2100-12-31", application_status: "open", is_visible: true, catalog_metadata: { shortName: "DBI", year: "2027", city: "Pretoria", contactEmail: "info@test.invalid", description: "Extended description", logo: "logo-fixture.svg", applicationFee: 75, applicationFeeLabel: "R75", applicationFeeNote: "Fixture fee", faculties: [{ name: "Science", courses: ["Computing", "Physics"] }], courseEntryMode: "guided", futureField: { retained: true } } });

function fixture(options = {}) {
  const state = { rows: clone(options.rows ?? [baseRow()]), overrides: clone(options.overrides || []), calls: [], localWrites: 0, reloadError: false };
  const staticRows = clone(options.staticRows || [{ id, name: "Old static seed", province: "Gauteng", type: "University", year: "2026" }]);
  const client = { from(table) {
    assert.equal(table, "institutions"); let operation = "read", payload, selectedId, single = false;
    const query = {
      select() { return query; }, order() { return query; },
      insert(value) { operation = "insert"; payload = clone(value); return query; },
      update(value) { operation = "update"; payload = clone(value); return query; },
      delete() { operation = "delete"; return query; },
      eq(key, value) { assert.equal(key, "id"); selectedId = value; return query; },
      single() { single = true; return execute(); },
      then(resolve, reject) { return execute().then(resolve, reject); }
    };
    async function execute() {
      state.calls.push({ operation, payload, id: selectedId });
      if (operation === "read") return { data: state.reloadError ? null : clone(state.rows), error: state.reloadError ? { message: "Fixture refresh unavailable" } : null };
      if (options.writeError === operation) return { data: null, error: { message: "Fixture " + operation + " rejected" } };
      let result;
      if (operation === "insert") { result = { id: newId, ...payload }; state.rows.push(result); }
      if (operation === "update") { const index = state.rows.findIndex(row => row.id === selectedId); if (index >= 0) { state.rows[index] = { ...state.rows[index], ...payload }; result = state.rows[index]; } }
      if (operation === "delete") { const found = state.rows.some(row => row.id === selectedId); state.rows = state.rows.filter(row => row.id !== selectedId); result = found ? { id: selectedId } : null; }
      if (options.failRefreshAfterWrite) state.reloadError = true;
      return { data: single ? clone(result || null) : result ? [clone(result)] : [], error: null };
    }
    return query;
  } };
  const sandbox = {
    console: { warn() {} }, Date, Map, Set, structuredClone,
    ROLES: { MASTER: "master_admin", ASSISTANT: "assistant_admin", USER: "user" }, KEYS: { institutions: "fixture-institutions" },
    clone, safeArray: value => Array.isArray(value) ? value : [],
    read: () => clone(state.overrides), write: (_key, value) => { state.overrides = clone(value); state.localWrites += 1; },
    getKagieData: () => ({ institutions: clone(staticRows) }),
    requireRole: () => ({ id: "fixture-master", role: "master_admin" }),
    isSupabaseEnabled: () => options.remote !== false,
    initSupabaseClient: () => options.noClient ? null : client,
    nowISO: () => "2026-10-15T00:00:00.000Z", uid: () => "local-institution-fixture",
    roundMoney: value => Math.round(Number(value || 0) * 100) / 100,
    formatMoneyLabel: value => "R" + Number(value || 0),
    isUuid: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")),
    mergeDeep: (a, b) => ({ ...a, ...b })
  };
  vm.runInNewContext(code, sandbox, { filename: "js/backend.js#institution-catalog" });
  return { api: sandbox.catalog, state };
}
const results = [];
async function check(name, action) {
  try { await action(); results.push({ name, passed: true }); console.log("PASS " + name); }
  catch (error) { results.push({ name, passed: false, message: error.message }); console.log("FAIL " + name + ": " + error.message); }
}
async function main() {
  await check("Actual institution schema maps legacy columns, visibility, status and extended metadata", async () => {
    const f = fixture(); const row = f.api.normalizeRemoteInstitutionRow({ ...baseRow(), institution_type: "TVET", application_status: "closed", is_visible: false });
    assert.equal(row.type, "TVET"); assert.equal(row.isActive, false); assert.equal(row.canApply, false); assert.equal(row.status, "closed"); assert.equal(row.shortName, "DBI"); assert.equal(row.year, "2027"); assert.equal(row.city, "Pretoria"); assert.equal(row.contactEmail, "info@test.invalid"); assert.equal(row.applicationFee, 75); assert.equal(row.faculties[0].courses[0], "Computing");
  });
  await check("Explicit status update persists through actual application_status column", async () => {
    const f = fixture(); await f.api.updateInstitutionByAdminAsync(id, { status: "closed" }); assert.equal(f.state.rows[0].application_status, "closed"); assert.equal(f.api.getInstitutionCatalog()[0].status, "closed");
  });
  await check("Auto status clears the prior override and derives status from deadline", async () => {
    const f = fixture(); await f.api.updateInstitutionByAdminAsync(id, { status: "auto", closingDate: "2000-01-01" }); assert.equal(f.state.rows[0].application_status, "auto"); assert.equal(f.api.getInstitutionCatalog()[0].status, "closed");
  });
  await check("Loaded shared catalog overrides old static seeds, local records and tombstones", async () => {
    const f = fixture({ overrides: [{ id, name: "Old local override", _deleted: true }, { id: "local-only", name: "Local ghost", province: "Gauteng", type: "University" }], staticRows: [{ id, name: "Old static seed" }, { id: "seed-only", name: "Static ghost" }] }); const rows = await f.api.getInstitutionCatalogAsync(); assert.equal(rows.length, 1); assert.equal(rows[0].name, "Database institution"); assert.equal(f.api.getInstitutionCatalog()[0].name, "Database institution");
  });
  await check("An empty shared catalog stays empty despite old seed and local catalogs", async () => {
    const f = fixture({ rows: [], overrides: [{ id: "ghost", name: "Local ghost" }] }); assert.equal((await f.api.getInstitutionCatalogAsync()).length, 0); assert.equal(f.api.getInstitutionCatalog().length, 0);
  });
  await check("Publish failures reject and never report a successful local-only write", async () => {
    const f = fixture({ writeError: "insert" }); await assert.rejects(() => f.api.addInstitutionByAdminAsync({ name: "New institution", province: "Limpopo", type: "TVET", year: "2027" }), /insert rejected/); assert.equal(f.state.localWrites, 0); assert.equal(f.state.rows.length, 1);
  });
  await check("Update failures reject and preserve shared row without local overrides", async () => {
    const f = fixture({ writeError: "update" }); await assert.rejects(() => f.api.updateInstitutionByAdminAsync(id, { name: "Rejected name" }), /update rejected/); assert.equal(f.state.localWrites, 0); assert.equal(f.state.rows[0].name, "Database institution"); assert.equal(f.api.getInstitutionCatalog()[0].name, "Database institution");
  });
  await check("Delete failures reject and never hide a database row through a local tombstone", async () => {
    const f = fixture({ writeError: "delete" }); await assert.rejects(() => f.api.deleteInstitutionByAdminAsync(id), /delete rejected/); assert.equal(f.state.localWrites, 0); assert.equal(f.state.rows.length, 1); assert.equal(f.api.getInstitutionCatalog()[0].id, id);
  });
  await check("Successful publish writes actual schema fields and refreshes the shared catalog", async () => {
    const f = fixture(); const result = await f.api.addInstitutionByAdminAsync({ name: "Published institution", province: "Limpopo", type: "TVET", shortName: "PI", year: "2027", isActive: false, manualStatus: "closed", faculties: [{ name: "Engineering", courses: ["Electrical"] }] }); const saved = f.state.rows.find(row => row.id === newId); assert.ok(saved); assert.equal(saved.institution_type, "TVET"); assert.equal(saved.application_status, "closed"); assert.equal(saved.is_visible, false); assert.equal(saved.catalog_metadata.shortName, "PI"); assert.equal(saved.catalog_metadata.year, "2027"); assert.equal(saved.catalog_metadata.faculties[0].courses[0], "Electrical"); assert.ok(!Object.hasOwn(saved, "type")); assert.ok(!Object.hasOwn(saved, "year")); assert.equal(result.id, newId); assert.equal(f.api.getInstitutionCatalog().length, 2); assert.equal(f.state.localWrites, 0);
  });
  await check("Partial successful updates retain unknown metadata while persisting and refreshing visible fields", async () => {
    const f = fixture(); const result = await f.api.updateInstitutionByAdminAsync(id, { name: "Updated institution", city: "Polokwane", applicationFee: 0 }); assert.equal(f.state.rows[0].name, "Updated institution"); assert.equal(f.state.rows[0].catalog_metadata.city, "Polokwane"); assert.equal(f.state.rows[0].catalog_metadata.applicationFee, 0); assert.equal(f.state.rows[0].catalog_metadata.futureField?.retained, true); assert.equal(result.name, "Updated institution"); assert.equal(f.api.getInstitutionCatalog()[0].city, "Polokwane"); assert.equal(f.state.localWrites, 0);
  });
  await check("Successful deletion persists, refreshes and cannot resurrect matching static seed", async () => {
    const f = fixture({ overrides: [{ id, name: "Old local override" }] }); assert.equal(await f.api.deleteInstitutionByAdminAsync(id), true); assert.equal(f.state.rows.length, 0); assert.equal(f.api.getInstitutionCatalog().length, 0); assert.equal(f.state.overrides.length, 0);
  });
  await check("Committed publish, update and delete remain successful and visible if subsequent refresh fails", async () => {
    for (const operation of ["insert", "update", "delete"]) {
      const f = fixture({ failRefreshAfterWrite: true, overrides: [{ id, name: "Old local override" }] }); await f.api.getInstitutionCatalogAsync();
      if (operation === "insert") { const result = await f.api.addInstitutionByAdminAsync({ name: "Committed database publish", province: "Limpopo", type: "TVET", year: "2027" }); assert.equal(result.id, newId); assert.ok(f.api.getInstitutionCatalog().some(row => row.id === newId)); }
      if (operation === "update") { const result = await f.api.updateInstitutionByAdminAsync(id, { name: "Committed database update" }); assert.equal(result.name, "Committed database update"); assert.equal(f.state.rows[0].name, "Committed database update"); assert.equal(f.api.getInstitutionCatalog()[0].name, "Committed database update"); }
      if (operation === "delete") { assert.equal(await f.api.deleteInstitutionByAdminAsync(id), true); assert.equal(f.state.rows.length, 0); assert.equal(f.api.getInstitutionCatalog().length, 0); }
      const names = f.api.getInstitutionCatalog().map(row => row.name); assert.ok(!names.includes("Old static seed"), "Static seed resurfaced after a live catalog had loaded"); assert.ok(!names.includes("Old local override"), "Old local override resurfaced after a live catalog had loaded");
      if (operation !== "delete") assert.equal(f.state.localWrites, 0);
    }
  });
  const report = { generatedAt: new Date().toISOString(), mode: "actual canonical source functions, isolated catalog DB/local-storage boundaries; no external requests", passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length, checks: results };
  fs.mkdirSync(path.join(root, "reports/backend-audit"), { recursive: true }); fs.writeFileSync(path.join(root, "reports/backend-audit/client-catalog-checks.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, externalRequests: 0 })); if (report.failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
