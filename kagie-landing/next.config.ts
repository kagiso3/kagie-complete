import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  outputFileTracingRoot: path.resolve(process.cwd()),
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default config;
