const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const androidDir = path.resolve(__dirname, "..", "android");
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradlewPath = path.join(androidDir, gradlew);

if (!fs.existsSync(gradlewPath)) {
  console.error(`Gradle wrapper was not found at ${gradlewPath}`);
  process.exit(1);
}

const result = spawnSync(gradlew, [":app:assembleDebug"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const apkPath = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
if (!fs.existsSync(apkPath)) {
  console.error(`Gradle finished, but no debug APK was found at ${apkPath}`);
  process.exit(1);
}

console.log(`Kagie debug APK generated at ${apkPath}`);
