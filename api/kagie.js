const path = require("node:path");

let app = null;

function getApp() {
  if (!app) {
    const { createApp } = require(path.resolve(__dirname, "../kagie-api/dist/app"));
    app = createApp();
  }
  return app;
}

module.exports = function kagieApiHandler(req, res) {
  const url = new URL(req.url || "/", "https://kagie.local");
  const rewrittenPath = url.searchParams.get("path");

  if (rewrittenPath) {
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    req.url = rewrittenPath.startsWith("/") ? rewrittenPath : `/${rewrittenPath}`;
    if (query) req.url += `?${query}`;
  } else {
    req.url = String(req.url || "/").replace(/^\/api\/kagie(?=\/|$)/, "") || "/";
  }

  return getApp()(req, res);
};
