const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const retiredHostPattern = /(?:kagie\.co\.za)/i;
const localHostPattern = /(?:^https?:\/\/)?(?:10\.0\.2\.2|127\.0\.0\.1|localhost|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i;
const forbiddenPublicSecretPattern = /EXPO_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PRIVATE|TOKEN|YOCO_SECRET|SUPABASE_SERVICE_ROLE)/i;

function readEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((env, line) => {
      const index = line.indexOf("=");
      if (index === -1) return env;
      env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      return env;
    }, {});
}

function fail(message) {
  console.error(`Kagie Android release config failed: ${message}`);
  process.exit(1);
}

const envFromFile = readEnvFile(".env");
const env = {
  ...envFromFile,
  ...process.env
};

const apiBaseUrl = String(env.EXPO_PUBLIC_KAGIE_API_BASE_URL || env.EXPO_PUBLIC_API_BASE_URL || "").trim();

if (!apiBaseUrl) {
  fail("Set EXPO_PUBLIC_KAGIE_API_BASE_URL to the stable production Kagie /v1 API URL.");
}

let parsedUrl;
try {
  parsedUrl = new URL(apiBaseUrl);
} catch {
  fail(`EXPO_PUBLIC_KAGIE_API_BASE_URL is not a valid URL: ${apiBaseUrl}`);
}

if (!/^https:$/.test(parsedUrl.protocol)) {
  fail("The Play Store release API URL must use HTTPS.");
}

if (localHostPattern.test(apiBaseUrl)) {
  fail("The Play Store release cannot point at localhost, emulator, or LAN API URLs.");
}

if (retiredHostPattern.test(apiBaseUrl)) {
  fail("The Play Store release cannot point at kagie.co.za. Use your live Vercel API/backend URL.");
}

if (!parsedUrl.pathname.replace(/\/+$/, "").endsWith("/v1")) {
  fail("The mobile app expects the Kagie API base URL to end with /v1.");
}

for (const key of Object.keys(env)) {
  if (forbiddenPublicSecretPattern.test(key)) {
    fail(`Do not expose secrets through public Expo env vars: ${key}`);
  }
}

const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "app.json"), "utf8"));
if (appJson.expo?.android?.package !== "com.kagie.app") {
  fail("app.json must keep android.package as com.kagie.app.");
}

console.log(`Kagie Android release config ok: ${apiBaseUrl}`);
