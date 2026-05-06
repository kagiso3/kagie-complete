const path = require("node:path");
const { createServerlessAdapter } = require("../_lib/serverless-adapter");

module.exports = createServerlessAdapter(
  path.resolve(__dirname, "../../server/functions/admin-users.js")
);
