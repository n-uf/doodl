import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    "react",
    "react-dom",
    "react-pdf",
    "pdfjs-dist",
    "@n-uf/doodl",
    "@n-uf/doodl-react",
    "@n-uf/doodl-react-pdf",
    "@n-uf/doodl-react-pdf/components",
  ],
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
