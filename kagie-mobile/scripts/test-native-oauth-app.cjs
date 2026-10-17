// Exercise the actual shell component with deterministic native adapters. These
// tests use no Google account, browser, network, or production session.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const nativeURL = require("./native-oauth-test-runtime.cjs");
const mobileRoot = path.resolve(__dirname, "..");
const compile = name => ts.transpileModule(fs.readFileSync(path.join(mobileRoot, name), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true }
}).outputText;
const helperContext = { exports: {}, URL, Date, Set, Object, JSON, require: name => {
  if (name === "react-native-url-polyfill") return nativeURL;
  throw new Error(`Unexpected helper dependency: ${name}`);
} };
vm.runInNewContext(compile("src/lib/native-oauth.ts"), helperContext);
const helpers = helperContext.exports;
const appCode = compile("App.tsx");
const state = "c".repeat(64);
function fixture(persist = false) {
  const intent = {
    provider: "google", persist, startedAt: Date.now(),
    redirectTo: `https://kagie.app/login.html?app=1&oauth=google&native_auth=1&native_state=${state}&next=upload.html`
  };
  const authorization = new URL(`${helpers.GOOGLE_AUTH_ORIGIN}/auth/v1/authorize`);
  authorization.searchParams.set("provider", "google");
  authorization.searchParams.set("redirect_to", intent.redirectTo);
  authorization.searchParams.set("code_challenge", "A".repeat(43));
  authorization.searchParams.set("code_challenge_method", "s256");
  return {
    intent,
    start: { type: "kagie:oauth:start", version: 1, ...intent, authorizationUrl: authorization.href },
    callback: `kagie://auth/google?native_state=${state}&code=single-use-code`
  };
}
function shell({ pending = null, initialUrl = null, browserFailure = false, browserPromise = null } = {}) {
  const slots = [];
  let cursor = 0, dirty = false, tree, effects = [];
  let linkListener;
  let appStateListener;
  let timerSequence = 0;
  const timers = new Map();
  const store = new Map(pending ? [[helpers.NATIVE_OAUTH_PENDING_KEY, JSON.stringify(pending)]] : []);
  const calls = { open: [], inject: [], alerts: [], writes: [], deletes: [] };
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((item, index) => item === b[index]);
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; dirty = true; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const old = slots[index];
      if (!old || !sameDeps(old.deps, deps)) effects.push(() => {
        old?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    }
  };
  const native = {
    Platform: { OS: "android" }, StyleSheet: { create: value => value, absoluteFillObject: {} },
    View: "View", Text: "Text", Pressable: "Pressable", SafeAreaView: "SafeAreaView", Image: "Image",
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    AppState: { addEventListener: (_type, listener) => { appStateListener = listener; return { remove() {} }; } },
    Alert: { alert: (...args) => calls.alerts.push(args) },
    Linking: {
      addEventListener: (_type, listener) => { linkListener = listener; return { remove() {} }; },
      getInitialURL: async () => initialUrl,
      openURL: async url => {
        assert.ok(store.has(helpers.NATIVE_OAUTH_PENDING_KEY), "metadata must be stored before browser opens");
        calls.open.push(url);
        if (browserFailure) throw new Error("No browser available");
        if (browserPromise) await browserPromise;
      }
    }
  };
  const secureStore = {
    getItemAsync: async key => store.get(key) || null,
    setItemAsync: async (key, value) => { calls.writes.push([key, value]); store.set(key, value); },
    deleteItemAsync: async key => { calls.deletes.push(key); store.delete(key); }
  };
  const adapters = {
    react: { __esModule: true, default: react, ...react }, "react-native": native,
    "expo-status-bar": { StatusBar: "StatusBar" }, "expo-secure-store": secureStore,
    "react-native-webview": { WebView: "WebView" }, "./src/lib/native-oauth": helpers
  };
  const appContext = { exports: {}, require: name => {
    if (!(name in adapters)) throw new Error(`Unexpected native module ${name}`);
    return adapters[name];
  }, process: { env: {} }, URL, Date, Set, Object, JSON,
    setTimeout: callback => { const id = ++timerSequence; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(appCode, appContext, { filename: "kagie-mobile/App.tsx" });
  const render = () => {
    cursor = 0; dirty = false; effects = [];
    tree = appContext.exports.default();
    // Wire the native WebView ref without evaluating unrelated child UI hooks.
    const view = find(tree, "WebView");
    if (view) view.props.ref.current = { injectJavaScript: script => calls.inject.push(script), goBack() {} };
    for (const effect of effects) effect();
  };
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    for (const child of node.props?.children || []) {
      const found = find(child, type); if (found) return found;
    }
    return null;
  }
  render();
  return {
    calls, store,
    async settle() {
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (dirty) render();
      }
    },
    view: () => find(tree, "WebView"),
    message(payload, url = "https://kagie.app/login.html") {
      this.view().props.onNavigationStateChange({ url, canGoBack: false });
      this.view().props.onMessage({ nativeEvent: { data: JSON.stringify(payload), url } });
    },
    returnLink(url) { linkListener({ url }); },
    foreground() { appStateListener("active"); },
    fireTimers() { const waiting = [...timers.values()]; timers.clear(); for (const callback of waiting) callback(); },
    loadEnd(url) { this.view().props.onLoadEnd({ nativeEvent: { url } }); }
  };
}
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
(async () => {
  await check("website startup does not open a browser or force a splash", async () => {
    const app = shell(); await app.settle();
    assert.equal(app.view().props.source.uri, "https://kagie.app");
    assert.equal(app.calls.open.length, 0);
  });
  await check("warm sign-in saves metadata then opens Google outside WebView", async () => {
    const flow = fixture(false), app = shell(); await app.settle();
    app.message(flow.start); await app.settle();
    assert.equal(app.calls.open.length, 1);
    assert.equal(app.calls.open[0], flow.start.authorizationUrl);
    const stored = JSON.parse(app.store.get(helpers.NATIVE_OAUTH_PENDING_KEY));
    assert.deepEqual(stored, flow.intent);
    assert.equal(stored.persist, false);
    app.returnLink(flow.callback); await app.settle();
    assert.ok(app.calls.inject.some(script => script.includes(helpers.googleResumeUrl(flow.intent))));
    assert.equal(app.store.has(helpers.NATIVE_OAUTH_PENDING_KEY), false);
    app.loadEnd(helpers.googleResumeUrl(flow.intent));
    assert.ok(app.calls.inject.some(script => script.includes("single-use-code") && script.includes("sessionStorage.setItem")));
    assert.equal(app.calls.open.length, 1);
  });
  await check("cold callback uses persisted intent while retaining its session-only choice", async () => {
    const flow = fixture(false), app = shell({ pending: flow.intent, initialUrl: flow.callback });
    await app.settle();
    assert.equal(app.view().props.source.uri, helpers.googleResumeUrl(flow.intent));
    app.loadEnd(app.view().props.source.uri);
    const resume = app.calls.inject.find(script => script.includes("single-use-code"));
    assert.match(resume, /sessionStorage\.setItem/);
    assert.ok(resume.includes('\\"persist\\":false'));
    assert.equal(app.calls.open.length, 0);
  });
  await check("duplicate callback notification cannot replay a consumed return", async () => {
    const flow = fixture(), app = shell({ pending: flow.intent, initialUrl: flow.callback });
    await app.settle();
    app.returnLink(flow.callback); app.returnLink(flow.callback); await app.settle();
    assert.equal(app.calls.deletes.filter(key => key === helpers.NATIVE_OAUTH_PENDING_KEY).length, 1);
  });
  await check("expired and unrequested app links do not navigate or restore credentials", async () => {
    const flow = fixture();
    for (const pending of [null, { ...flow.intent, startedAt: Date.now() - helpers.OAUTH_MAX_AGE_MS - 1 }]) {
      const app = shell({ pending, initialUrl: flow.callback }); await app.settle();
      assert.equal(app.view().props.source.uri, "https://kagie.app");
      assert.equal(app.calls.inject.some(script => script.includes("single-use-code")), false);
    }
  });
  await check("browser launch failure clears pending metadata and gives retry feedback", async () => {
    const flow = fixture(), app = shell({ browserFailure: true }); await app.settle();
    app.message(flow.start); await app.settle();
    assert.equal(app.store.has(helpers.NATIVE_OAUTH_PENDING_KEY), false);
    assert.match(app.calls.alerts[0][1], /could not open your browser/);
    assert.ok(app.calls.inject.some(script => script.includes("kagie:native-oauth-error")));
    app.returnLink(flow.callback); await app.settle();
    assert.equal(app.view().props.source.uri, "https://kagie.app");
  });
  await check("an immediate browser callback waits for launch bookkeeping then resumes", async () => {
    let resolveBrowser;
    const browserPromise = new Promise(resolve => { resolveBrowser = resolve; });
    const flow = fixture(), app = shell({ browserPromise }); await app.settle();
    app.message(flow.start); await app.settle();
    app.returnLink(flow.callback); await app.settle();
    assert.equal(app.view().props.source.uri, "https://kagie.app");
    resolveBrowser(); await app.settle();
    assert.ok(app.calls.inject.some(script => script.includes(helpers.googleResumeUrl(flow.intent))));
  });
  await check("a second sign-in in the same app reopens the resume page", async () => {
    const app = shell(); await app.settle();
    for (const nonce of ["d".repeat(64), "e".repeat(64)]) {
      const flow = fixture();
      flow.intent.redirectTo = flow.intent.redirectTo.replace(state, nonce);
      flow.start.redirectTo = flow.intent.redirectTo;
      const auth = new URL(flow.start.authorizationUrl);
      auth.searchParams.set("redirect_to", flow.intent.redirectTo);
      flow.start.authorizationUrl = auth.href;
      flow.callback = flow.callback.replace(state, nonce);
      app.message(flow.start); await app.settle();
      app.returnLink(flow.callback); await app.settle();
      app.loadEnd(helpers.googleResumeUrl(flow.intent));
      await app.settle();
    }
    assert.equal(app.calls.open.length, 2);
    assert.equal(app.calls.inject.filter(script => script.startsWith("window.location.replace(")).length, 2);
    assert.equal(app.calls.inject.filter(script => script.includes("sessionStorage.setItem")).length, 2);
  });
  await check("returning from a canceled browser enables retry while preserving pending flow", async () => {
    const flow = fixture(), app = shell(); await app.settle();
    app.message(flow.start); await app.settle();
    app.foreground(); app.fireTimers();
    assert.ok(app.calls.inject.some(script => script.includes("kagie:native-oauth-resume")));
    assert.deepEqual(JSON.parse(app.store.get(helpers.NATIVE_OAUTH_PENDING_KEY)), flow.intent);
  });
  await check("a real callback suppresses the canceled-browser resume event", async () => {
    const flow = fixture(), app = shell(); await app.settle();
    app.message(flow.start); await app.settle();
    app.foreground(); app.returnLink(flow.callback); await app.settle(); app.fireTimers();
    assert.equal(app.calls.inject.some(script => script.includes("kagie:native-oauth-resume")), false);
  });
  await check("Yoco hosted checkout stays inside the session WebView",async()=>{const app=shell();await app.settle();assert.equal(app.view().props.onShouldStartLoadWithRequest({url:'https://c.yoco.com/checkout/fixture'}),true);assert.equal(app.calls.open.length,0);});
  await check("HTTPS bank authentication can return to Kagie in the same WebView",async()=>{const app=shell();await app.settle();const navigate=url=>app.view().props.onShouldStartLoadWithRequest({url});assert.equal(navigate('https://c.yoco.com/checkout/fixture'),true);assert.equal(navigate('https://bank-auth.fixture.invalid/3ds'),true);assert.equal(navigate('https://kagie.app/payment.html?attempt=fixture'),true);assert.equal(navigate('https://unrelated.fixture.invalid/'),false);});
  await check("Checkout never permits insecure or script navigation inside WebView",async()=>{const app=shell();await app.settle();const navigate=url=>app.view().props.onShouldStartLoadWithRequest({url});navigate('https://c.yoco.com/checkout/fixture');assert.equal(navigate('http://bank.fixture.invalid/'),false);assert.equal(navigate('javascript:alert(1)'),false);});
  await check("Payment origins cannot invoke the native Google authentication bridge",async()=>{const app=shell();await app.settle();app.message(fixture().start,'https://c.yoco.com/checkout/fixture');await app.settle();assert.equal(app.calls.open.length,0);assert.equal(app.calls.writes.length,0);});
  await check("Kagie native marker is not injected into hosted checkout pages",async()=>{const app=shell();await app.settle();const count=app.calls.inject.length;app.loadEnd('https://c.yoco.com/checkout/fixture');assert.equal(app.calls.inject.length,count);});
  console.log(`${checks} native Google OAuth shell lifecycle checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
