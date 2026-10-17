const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const nativeURL = require("./native-oauth-test-runtime.cjs");

const helperPath = path.resolve(__dirname, "../src/lib/native-oauth.ts");
const source = fs.readFileSync(helperPath, "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const moduleContext = { exports: {}, URL, Date, Set, Object, JSON, require: name => {
  if (name === "react-native-url-polyfill") return nativeURL;
  throw new Error(`Unexpected helper dependency: ${name}`);
} };
vm.runInNewContext(output, moduleContext, { filename: helperPath });
const h = moduleContext.exports;
let checks = 0;
function check(name, test) { test(); checks++; console.log(`PASS ${name}`); }
const now = 1760000000000;
const state = "a".repeat(64);
const redirectTo = `https://kagie.app/login.html?app=1&oauth=google&native_auth=1&native_state=${state}&next=upload.html`;
const intent = { provider: "google", redirectTo, persist: false, startedAt: now - 1000 };
const authorization = new URL(`${h.GOOGLE_AUTH_ORIGIN}/auth/v1/authorize`);
authorization.searchParams.set("provider", "google");
authorization.searchParams.set("redirect_to", redirectTo);
authorization.searchParams.set("code_challenge", "A".repeat(43));
authorization.searchParams.set("code_challenge_method", "s256");
const message = { type: "kagie:oauth:start", version: 1, ...intent, authorizationUrl: authorization.href };
const deepLink = `kagie://auth/google?native_state=${state}&code=one-use_auth-code`;

check("pinned native URL implementation parses app schemes and replaces query values", () => {
  const deep = new nativeURL.URL(deepLink);
  assert.equal(deep.hostname, "auth");
  assert.equal(deep.pathname, "/google");
  const callback = new nativeURL.URL(redirectTo);
  callback.searchParams.delete("native_auth");
  callback.searchParams.set("code", "new-code");
  assert.equal(new URL(callback.href).searchParams.getAll("native_state").length, 1);
  assert.equal(new URL(callback.href).searchParams.has("native_auth"), false);
});

check("valid browser request preserves the original remember-me choice", () => {
  const start = h.readGoogleOAuthStart(message, "https://kagie.app/login.html", now);
  assert.equal(start.persist, false);
  assert.equal(start.redirectTo, redirectTo);
});
check("authorization for another Supabase project is rejected", () => {
  assert.equal(h.readGoogleOAuthStart({ ...message, authorizationUrl: authorization.href.replace("ztfcxnowjtvonltevrqe", "otherproject") }, "https://kagie.app/login.html", now), null);
});
check("external page cannot start an app sign-in", () => {
  assert.equal(h.readGoogleOAuthStart(message, "https://evil.example/login.html", now), null);
});
check("callback stays on the initiating origin", () => {
  assert.equal(h.readGoogleOAuthStart(message, "https://www.kagie.app/login.html", now), null);
});
check("arbitrary same-origin callbacks are rejected", () => {
  assert.equal(h.readGoogleOAuthIntent({ ...intent, redirectTo: redirectTo.replace("login.html", "upload.html") }, now), null);
});
check("HTTP, userinfo, and host suffix attacks are rejected", () => {
  for (const bad of ["http://kagie.app/login.html", "https://kagie.app.evil.example/login.html", "https://evil@kagie.app/login.html"]) {
    assert.equal(h.isTrustedKagieUrl(bad), false);
  }
});
check("wrong provider, redirect, and missing PKCE are rejected", () => {
  for (const mutate of [u => u.searchParams.set("provider", "apple"), u => u.searchParams.set("redirect_to", "https://evil.example"), u => u.searchParams.delete("code_challenge"), u => u.searchParams.set("code_challenge_method", "plain")]) {
    const u = new URL(authorization); mutate(u);
    assert.equal(h.readGoogleOAuthStart({ ...message, authorizationUrl: u.href }, "https://kagie.app/login.html", now), null);
  }
});
check("callback code returns to the saved HTTPS target", () => {
  const target = new URL(h.googleCallbackFromDeepLink(deepLink, intent, now));
  assert.equal(target.origin, "https://kagie.app");
  assert.equal(target.pathname, "/login.html");
  assert.equal(target.searchParams.get("code"), "one-use_auth-code");
  assert.equal(target.searchParams.get("next"), "upload.html");
  assert.equal(target.searchParams.has("native_auth"), false);
});
check("Google cancellation returns an error without session tokens", () => {
  const target = new URL(h.googleCallbackFromDeepLink(`kagie://auth/google?native_state=${state}&error=access_denied&error_description=User%20canceled`, intent, now));
  assert.equal(target.searchParams.get("error"), "access_denied");
  assert.equal(target.searchParams.has("code"), false);
});
check("unrequested, consumed, and expired returns are rejected", () => {
  assert.equal(h.googleCallbackFromDeepLink(deepLink, null, now), null);
  assert.equal(h.googleCallbackFromDeepLink(deepLink, { ...intent, startedAt: now - h.OAUTH_MAX_AGE_MS - 1 }, now), null);
  assert.equal(h.googleCallbackFromDeepLink(deepLink, { ...intent, startedAt: now + 1 }, now), null);
});
check("flow nonce binds the callback to the pending request", () => {
  assert.equal(h.googleCallbackFromDeepLink(deepLink.replace(state, "b".repeat(64)), intent, now), null);
  assert.equal(h.googleCallbackFromDeepLink("kagie://auth/google?code=some-code", intent, now), null);
});
check("exact registered scheme, host, and route are required", () => {
  for (const bad of [deepLink.replace("kagie:", "other:"), deepLink.replace("auth/google", "auth/other"), deepLink.replace("auth/google", "evil/google"), deepLink.replace("//auth", "//user@auth"), `${deepLink}#tokens`]) {
    assert.equal(h.googleCallbackFromDeepLink(bad, intent, now), null);
  }
});
check("duplicate parameters, tokens, and callback-supplied destinations are rejected", () => {
  for (const extra of ["&code=another", "&access_token=secret", "&refresh_token=secret", "&redirectTo=https%3A%2F%2Fevil.example", "&persist=true", "&error=access_denied"]) {
    assert.equal(h.googleCallbackFromDeepLink(deepLink + extra, intent, now), null);
  }
});
check("oversized or control-character callback values are rejected", () => {
  assert.equal(h.googleCallbackFromDeepLink(`kagie://auth/google?native_state=${state}&code=${"a".repeat(2049)}`, intent, now), null);
  assert.equal(h.googleCallbackFromDeepLink(`kagie://auth/google?native_state=${state}&error=bad%0Avalue`, intent, now), null);
});
check("cold resume restores metadata before navigating to SDK callback", () => {
  const target = h.googleCallbackFromDeepLink(deepLink, intent, now);
  const storage = new Map();
  let nextUrl = "";
  const location = { origin: "https://kagie.app", pathname: "/splash.html", search: "?native_oauth_resume=1", replace: value => { nextUrl = value; } };
  vm.runInNewContext(h.googleResumeScript(intent, target), {
    window: { location }, sessionStorage: { setItem: (key, value) => storage.set(key, value) }, JSON
  });
  const restored = JSON.parse(storage.get(h.OAUTH_INTENT_KEY));
  assert.deepEqual(restored, intent);
  assert.equal(nextUrl, target);
  assert.equal(restored.persist, false);
  assert.deepEqual(Object.keys(restored).sort(), ["persist", "provider", "redirectTo", "startedAt"]);
});
check("restoration cannot write on another origin", () => {
  let written = false;
  vm.runInNewContext(h.googleResumeScript(intent, h.googleCallbackFromDeepLink(deepLink, intent, now)), {
    window: { location: { origin: "https://evil.example", pathname: "/splash.html", search: "?native_oauth_resume=1" } },
    sessionStorage: { setItem: () => { written = true; } }, JSON
  });
  assert.equal(written, false);
});
check("registered Android scheme is available for warm and cold links", () => {
  const manifest = fs.readFileSync(path.resolve(__dirname, "../android/app/src/main/AndroidManifest.xml"), "utf8");
  assert.match(manifest, /android:scheme="kagie"/);
  assert.match(manifest, /android:launchMode="singleTask"/);
  const appConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../app.json"), "utf8"));
  assert.equal(appConfig.expo.scheme, "kagie");
});
console.log(`${checks} native Google OAuth protocol checks passed.`);
