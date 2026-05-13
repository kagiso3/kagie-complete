const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "website", "public", "downloads");
const outputFile = path.join(outputDir, "kagie-android.apk");

const candidates = [
  path.join(root, "kagie-mobile", "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
  path.join(root, "kagie-mobile", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  path.join(root, "kagie-mobile", "Kagie-Android-Release.apk"),
  path.join(root, "kagie-mobile", "Kagie-Android.apk"),
  path.join(root, "Kagie-Android-Release.apk"),
  path.join(root, "Kagie-Android.apk")
];

const source = candidates.find((candidate) => fs.existsSync(candidate));

if (!source) {
  console.error("No Android APK was found to copy.");
  console.error("Build one first, for example: npm run build:android:debug");
  console.error("Expected debug APK: kagie-mobile/android/app/build/outputs/apk/debug/app-debug.apk");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(source, outputFile);

const sizeMb = fs.statSync(outputFile).size / (1024 * 1024);
console.log(`Copied ${source}`);
console.log(`Vercel download APK ready at ${outputFile} (${sizeMb.toFixed(1)} MB)`);
