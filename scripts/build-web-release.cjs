const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const target = path.join(root, "web-release");

const folders = [
  "admin",
  "assistant",
  "css",
  "images",
  "js",
  "master-admin",
  "more-service"
];

const topLevelFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => (
    path.extname(name).toLowerCase() === ".html"
    || path.extname(name).toLowerCase() === ".webmanifest"
    || name === "sw.js"
    || /^Kagie-Android(?:-Release)?\.apk$/i.test(name)
  ));

function ensureEmptyDir(dirPath) {
  fs.rmSync(dirPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 150
  });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDir(name) {
  const sourcePath = path.join(root, name);
  if (!fs.existsSync(sourcePath)) return;
  fs.cpSync(sourcePath, path.join(target, name), {
    recursive: true,
    force: true
  });
}

function copyFile(name) {
  const sourcePath = path.join(root, name);
  if (!fs.existsSync(sourcePath)) return;
  fs.copyFileSync(sourcePath, path.join(target, name));
}

ensureEmptyDir(target);
folders.forEach(copyDir);
topLevelFiles.forEach(copyFile);

console.log(`Kagie Vercel release synced to ${target}`);
