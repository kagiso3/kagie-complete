const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Test with the pinned package's actual URL implementation, rather than Node's
// complete global URL that would hide React Native's broken scheme/query parser.
const source = fs.readFileSync(require.resolve("react-native-url-polyfill/js/URL"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const context = {
  exports: {}, require: name => {
    if (name === "react-native") return { NativeModules: {} };
    throw new Error(`Unexpected URL polyfill dependency: ${name}`);
  }
};
vm.runInNewContext(output, context, { filename: "react-native-url-polyfill/js/URL.js" });
module.exports = context.exports;
