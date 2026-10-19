import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "@n-uf/doodl"],
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
  async onSuccess() {
    const destDir = join(root, "dist");
    mkdirSync(destDir, { recursive: true });
    copyFileSync(
      join(root, "src/styles/text-layer.css"),
      join(destDir, "text-layer.css")
    );
  },
});
