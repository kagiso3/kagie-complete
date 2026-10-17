import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const landing = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exported = path.join(landing, "out");
const root = path.resolve(landing, "..");
const destination = path.join(root, "web-release");
if (!existsSync(path.join(exported, "index.html"))) throw new Error("Build the Next.js landing page first.");
if (!existsSync(path.join(destination, "login.html"))) throw new Error("Build the existing Kagie web release first.");
// Only install the homepage and its assets. Preserve existing application pages,
// including the site's 404 page and both admin interfaces.
for (const target of [root, destination]) {
  for (const entry of ["index.html", "_next", "images"]) {
    cpSync(path.join(exported, entry), path.join(target, entry), { recursive: true, force: true });
  }
}
cpSync(path.join(root, "sw.js"), path.join(destination, "sw.js"));
console.log("New Kagie homepage installed in the project root and web-release.");
