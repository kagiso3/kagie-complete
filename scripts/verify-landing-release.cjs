const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const exported = fs.readFileSync(path.join(root, "kagie-landing", "out", "index.html"), "utf8");
assert.equal(html, exported, "Root homepage must match the current Next.js export.");
assert.equal(fs.readFileSync(path.join(root, "web-release", "index.html"), "utf8"), exported, "Release homepage must match the current export.");

const assets = new Set();
for (const match of html.matchAll(/(?:src|href)="(\/(?:_next|images)\/[^"?]+)(?:\?[^"\s]*)?"/g)) assets.add(match[1]);
assert(assets.size > 0, "The homepage must reference its compiled assets.");
for (const asset of assets) {
  for (const directory of [root, path.join(root, "web-release")]) {
    assert(fs.existsSync(path.join(directory, asset.slice(1))), `Missing homepage asset: ${asset}`);
  }
}

for (const entry of ["login.html", "signup.html", "privacy.html", "terms.html", "personal-assistance.html", "assistant/dashboard.html", "master-admin/dashboard.html"]) {
  for (const directory of [root, path.join(root, "web-release")]) assert(fs.existsSync(path.join(directory, entry)), `Existing destination missing: ${entry}`);
}
console.log(`Landing release verified: matching homepages, ${assets.size} asset references, and existing account/admin destinations.`);
