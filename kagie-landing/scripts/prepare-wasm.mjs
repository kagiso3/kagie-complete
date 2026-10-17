import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Install the supported WebAssembly fallback where Next also searches for it.
// This keeps Windows builds independent of runtime compiler downloads.
const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve("@next/swc-wasm-nodejs/package.json"));
const target = path.join(path.dirname(require.resolve("next/package.json")), "wasm", "@next", "swc-wasm-nodejs");
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
