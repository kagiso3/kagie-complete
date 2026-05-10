const fs = require("fs");
const path = require("path");

const candidates = [
  path.resolve(__dirname, "../../node_modules/@react-native/gradle-plugin/settings.gradle.kts"),
  path.resolve(__dirname, "../node_modules/@react-native/gradle-plugin/settings.gradle.kts")
];

const target = candidates.find((candidate) => fs.existsSync(candidate));

if (!target) {
  console.log("fix-foojay-plugin: target file not found, skipping.");
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");
const legacy = 'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0") }';
const modern = 'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0") }';

if (source.includes(modern)) {
  console.log("fix-foojay-plugin: already on 1.0.0.");
  process.exit(0);
}

if (!source.includes(legacy)) {
  console.log("fix-foojay-plugin: legacy version not found, skipping.");
  process.exit(0);
}

fs.writeFileSync(target, source.replace(legacy, modern), "utf8");
console.log(`fix-foojay-plugin: upgraded foojay resolver plugin in ${target}`);
