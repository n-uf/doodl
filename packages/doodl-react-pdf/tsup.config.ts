import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "index.ts",
    components: "src/components/index.ts",
    hooks: "src/hooks/index.ts",
    types: "src/types.ts",
  },
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
