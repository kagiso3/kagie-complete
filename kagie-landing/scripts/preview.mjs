import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exported = path.join(project, "out");
const existingApp = path.resolve(project, "..");
const port = Number(process.env.PORT || 3010);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

if (!existsSync(path.join(exported, "index.html"))) throw new Error("Run npm run build before starting the production preview.");

function findFile(root, relative) {
  const candidate = path.resolve(root, relative || "index.html");
  if (!candidate.startsWith(root + path.sep) || !existsSync(candidate)) return null;
  if (statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, "index.html");
  return existsSync(index) ? index : null;
}

createServer((request, response) => {
  let relative;
  try { relative = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname).replace(/^\/+/, ""); }
  catch { response.writeHead(400); response.end("Invalid request"); return; }
  // Only expose public assets and pages from the existing application.
  const appAllowed = /^(?:[\w-]+\.html|(?:images|css|js|more-service|assistant|master-admin|admin)\/[^.][\w./ -]+|manifest\.webmanifest|sw\.js|robots\.txt|sitemap\.xml)$/i.test(relative) && !relative.split("/").includes("..");
  const file = findFile(exported, relative) || (appAllowed ? findFile(existingApp, relative) : null);
  if (!file) { response.writeHead(404, { "Content-Type": "text/plain" }); response.end("Page not found"); return; }
  const extension = path.extname(file).toLowerCase();
  response.writeHead(200, { "Content-Type": mime[extension] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
  if (request.method === "HEAD") { response.end(); return; }
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Kagie production preview: http://127.0.0.1:${port}`));
