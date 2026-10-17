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
    || path.extname(name).toLowerCase() === ".xml"
    || path.extname(name).toLowerCase() === ".webmanifest"
    || name === "robots.txt"
    || name === "sw.js"
    || /^Kagie-Android(?:-Release)?\.apk$/i.test(name)
  ));

function ensureEmptyDir(dirPath) {
  if (path.resolve(dirPath) !== path.join(root, "web-release")) {
    throw new Error("Release cleanup must remain inside the project's web-release directory.");
  }
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

function copyWebsitePublic() {
  const sourcePath = path.join(root, "website", "public");
  if (!fs.existsSync(sourcePath)) return;
  fs.cpSync(sourcePath, target, {
    recursive: true,
    force: true
  });
}

function copyAndroidReleaseArtifact() {
  const downloadDir = path.join(target, "downloads");
  const targetApk = path.join(downloadDir, "kagie-android.apk");
  if (fs.existsSync(targetApk)) return;

  const candidates = [
    path.join(root, "website", "public", "downloads", "kagie-android.apk"),
    path.join(root, "Kagie-Android-Release.apk"),
    path.join(root, "Kagie-Android.apk"),
    path.join(root, "kagie-mobile", "Kagie-Android-Release.apk"),
    path.join(root, "kagie-mobile", "Kagie-Android.apk"),
    path.join(root, "kagie-mobile", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
  ];

  const sourceApk = candidates.find((candidate) => fs.existsSync(candidate));
  if (!sourceApk) {
    console.warn("No Android APK found. Direct download will show an unavailable state until website/public/downloads/kagie-android.apk is uploaded.");
    return;
  }

  fs.mkdirSync(downloadDir, { recursive: true });
  fs.copyFileSync(sourceApk, targetApk);
  console.log(`Android APK copied to ${targetApk}`);
}

ensureEmptyDir(target);
folders.forEach(copyDir);
topLevelFiles.forEach(copyFile);
copyWebsitePublic();
copyAndroidReleaseArtifact();

console.log(`Kagie Vercel release synced to ${target}`);
