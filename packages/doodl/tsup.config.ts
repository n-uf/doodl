import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const root = dirname(fileURLToPath(import.meta.url));

/**
 * One entry per public subpath (see `exports` in package.json). The output
 * names are flat: `@n-uf/doodl/react-pdf/hooks` -> `dist/react-pdf-hooks.*`.
 */
const entry = {
  index: "index.ts",
  react: "src/react/index.ts",
  "react-pdf": "src/react-pdf/index.ts",
  "react-pdf-components": "src/react-pdf/components/index.ts",
  "react-pdf-hooks": "src/react-pdf/hooks/index.ts",
  "react-pdf-types": "src/react-pdf/types.ts",
  go: "src/go/index.ts",
};

/** Entries that render React / use browser-only APIs: they get "use client". */
const clientEntries = Object.keys(entry).filter((name) => name !== "index");

export default defineConfig({
  entry,
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  // Parts import each other through the package's public subpaths
  // (self-reference, e.g. "@n-uf/doodl" or "@n-uf/doodl/react"), which stay
  // external: there is exactly one copy of the core (and its shape
  // registration, flagged in `sideEffects`) in dist/index.*, and other parts
  // never inline it.
  // tsup's default splitting (ESM only) is kept on purpose. Entries of the same
  // part (react-pdf, react-pdf/components, ...) share chunks, as the old
  // @n-uf/doodl-react-pdf package did. That keeps FindBar and the chrome tokens
  // in a chunk without react-pdf/pdfjs, so `@n-uf/doodl/go` (which imports
  // them) can be server-rendered without evaluating pdfjs (needs DOMMatrix).
  external: [
    "react",
    "react-dom",
    "react-pdf",
    "pdfjs-dist",
    /^@n-uf\/doodl(\/.*)?$/,
  ],
  outExtension: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
  }),
  async onSuccess() {
    const destDir = join(root, "dist");
    mkdirSync(destDir, { recursive: true });
    copyFileSync(
      join(root, "src/react/styles/text-layer.css"),
      join(destDir, "text-layer.css")
    );

    // "use client" on the React/browser entries only. The vanilla core entry
    // stays free of it. Prepending a line shifts the
    // generated code down by one, so shift the source map by one line too.
    for (const name of clientEntries) {
      for (const ext of ["mjs", "cjs"]) {
        const file = join(destDir, `${name}.${ext}`);
        if (!existsSync(file)) continue;
        const code = readFileSync(file, "utf8");
        if (code.startsWith('"use client"')) continue;
        writeFileSync(file, `"use client";\n${code}`);
        const mapFile = `${file}.map`;
        if (existsSync(mapFile)) {
          const map = JSON.parse(readFileSync(mapFile, "utf8"));
          map.mappings = `;${map.mappings}`;
          writeFileSync(mapFile, JSON.stringify(map));
        }
      }
    }
  },
});
