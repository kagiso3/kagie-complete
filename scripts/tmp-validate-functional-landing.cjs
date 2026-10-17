// Focused checks for the public app-style landing page.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const at = (...parts) => path.join(root, ...parts);
const read = (...parts) => fs.readFileSync(at(...parts), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const syncedFiles = [
  ["index.html"],
  ["css", "landing-page.css"],
  ["js", "landing-page.js"],
  ["images", "kagie-social-card.png"],
  ["login.html"],
  ["signup.html"],
  ["terms.html"]
];

for (const parts of syncedFiles) {
  const source = at(...parts);
  const release = at("web-release", ...parts);
  assert(fs.existsSync(source), "Missing source file: " + parts.join("/"));
  assert(fs.existsSync(release), "Missing release file: " + parts.join("/"));
  assert(fs.readFileSync(source).equals(fs.readFileSync(release)), "Source/release mismatch: " + parts.join("/"));
}

const html = read("index.html");
const css = read("css", "landing-page.css");
const script = read("js", "landing-page.js");
const login = read("login.html");
const signup = read("signup.html");
const terms = read("terms.html");
const offThemeAccent = /#(?:45c7f1|23a9dc|2aaee8|147ba9|1688c4|d9ff43|b8e21f|efffba)\b/i;

[
  [!html.includes('href="#"'), "Placeholder link remains"],
  [!html.includes("onclick="), "Inline click handler remains"],
  [html.includes('class="skip-link" href="#main-content"'), "Skip link is missing"],
  [html.includes('<main id="main-content" tabindex="-1">'), "Main landmark is missing"],
  [html.includes('class="menu-toggle"') && html.includes('aria-controls="mobile-navigation"'), "Mobile menu toggle is incomplete"],
  [html.includes('id="mobile-navigation"') && html.includes('aria-label="Mobile navigation"'), "Mobile navigation is missing"],
  [html.includes("Kagie is an independent student support platform."), "Independent-platform notice is missing"],
  [html.includes('href="mailto:support@kagie.app"'), "Support contact is missing"],
  [html.includes('location.replace("login.html" + location.search + location.hash)'), "Auth callback forwarding is missing"],
  [html.includes('property="og:image" content="https://kagie.app/images/kagie-social-card.png"'), "Open Graph image is missing"],
  [html.includes('name="twitter:card" content="summary_large_image"'), "Social card metadata is incomplete"],
  [html.includes('name="theme-color" content="#e3181e"'), "Landing theme color is missing"],
  [html.includes("One app. Every application. Less stress."), "Primary landing hero is missing"],
  [html.includes('class="phone-frame"') && html.includes("Preview of the Kagie app"), "App preview is missing"],
  [(html.match(/class="tool-card"/g) || []).length === 4, "Landing page must keep four app tools"],
  [(html.match(/<section\b/g) || []).length === 5, "Landing page must contain five primary sections"],
  [html.includes('href="android-app.html"') && html.includes('href="login.html?app=1"'), "Web or Android app destination is missing"],
  [html.includes("next=forms.html%3Fstep%3Dtype%26fresh%3D1"), "Application route is incorrect"],
  [html.includes("next=Dashboard.html"), "Dashboard route is incorrect"],
  [!html.includes("cdn.jsdelivr.net/npm/@supabase"), "Landing page still loads Supabase"],
  [!/(?:24\/7|500\+|100K\+|100,000|testimonial)/i.test(html), "Unsupported public claim remains"],
  [!html.includes("University of Bophuthatswana"), "Obsolete institution remains"],
  [!html.includes('href="institutions.html"'), "Learner link targets the admin institution console"],
  [css.includes("--ink: #121212") && css.includes("--red: #e3181e") && css.includes("--paper: #ffffff"), "Kagie red/white/black palette is incomplete"],
  [!offThemeAccent.test(html) && !offThemeAccent.test(css), "Off-theme landing accent remains"],
  [script.includes("Escape") && script.includes("mobile-navigation"), "Mobile menu behavior is incomplete"],
  [!/(?:supabase|\/v1\/public\/stats|\/api\/runtime-config)/i.test(script), "Landing script still contains live-data coupling"],
  [script.split(/\r?\n/).length < 70, "Landing JavaScript is no longer minimal"],
  [css.includes("@media (prefers-reduced-motion: reduce)"), "Reduced-motion support is missing"],
  [css.includes("@media (max-width: 980px)"), "Mobile navigation breakpoint is missing"],
  [css.includes("@media (max-width: 680px)"), "Phone breakpoint is missing"],
  [login.includes("allowedLearnerRoutes") && login.includes('window.location.href = nextLearnerRoute || "home.html"'), "Login destination handling is incomplete"],
  [signup.includes("loginDestination"), "Signup destination handling is incomplete"],
  [terms.includes('<a href="index.html">Back to Kagie</a>'), "Terms page return route is incorrect"]
].forEach(([condition, message]) => assert(condition, message));

const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
const missingTargets = [];

for (const href of hrefs) {
  if (href.startsWith("#")) {
    if (href.length > 1 && !ids.has(href.slice(1))) missingTargets.push(href);
    continue;
  }
  if (/^(?:https?:|mailto:|tel:|sms:)/.test(href)) continue;
  const clean = href.split(/[?#]/)[0];
  if (!clean) continue;
  const target = clean.startsWith("/") ? at(clean.slice(1)) : at(clean);
  if (!fs.existsSync(target)) missingTargets.push(href);
}

assert(missingTargets.length === 0, "Missing landing targets: " + missingTargets.join(", "));

const requiredFiles = [
  "forms.html",
  "prospectus.html",
  "recommendation.html",
  "Dashboard.html",
  "about.html",
  "privacy.html",
  "terms.html",
  "android-app.html",
  "manifest.webmanifest",
  "js/pwa-init.js"
];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(at(file)));
assert(missingFiles.length === 0, "Missing required files: " + missingFiles.join(", "));

console.log(JSON.stringify({
  checkedLinks: hrefs.length,
  checkedReleasePairs: syncedFiles.length,
  checkedRequiredFiles: requiredFiles.length,
  status: "app-style landing verified"
}, null, 2));
