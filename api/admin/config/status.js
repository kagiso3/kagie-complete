const path = require("node:path");
const { createServerlessAdapter } = require("../../_lib/serverless-adapter");

// Share one hosting function while retaining each canonical handler's auth,
// method checks and responses. The action selector grants no privileges.
const provisionMaster = createServerlessAdapter(
  path.resolve(__dirname, "../../../server/functions/admin-bootstrap-master.js")
);
const configStatus = createServerlessAdapter(
  path.resolve(__dirname, "../../../server/functions/admin-config-status.js")
);

module.exports = function adminConfigHandler(req, res) {
  const url = new URL(req.url || "/", "https://kagie.local");
  return url.searchParams.get("__kagie_admin_action") === "bootstrap"
    ? provisionMaster(req, res)
    : configStatus(req, res);
};
