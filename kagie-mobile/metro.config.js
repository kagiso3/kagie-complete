const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Keep Metro rooted in the Android app workspace so release builds bundle the
// real mobile entry instead of drifting to the repo root package.
config.watchFolders = [workspaceRoot];
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules")
  ]
};
config.server = {
  ...(config.server || {}),
  unstable_serverRoot: projectRoot
};

module.exports = config;
