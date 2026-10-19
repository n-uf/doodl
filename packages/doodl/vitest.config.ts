import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Parts import each other through the package's own subpaths ("@n-uf/doodl",
// "@n-uf/doodl/react", ...). Vite has no package self-reference, so alias every
// export to its "@n-uf/source" file, taken from package.json (one source of truth).
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { name: string; exports: Record<string, Record<string, string>> };
const alias = Object.entries(pkg.exports).flatMap(([subpath, target]) => {
  const source = target["@n-uf/source"];
  if (!source) return [];
  const name = pkg.name + subpath.slice(1);
  return [
    {
      find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
      replacement: fileURLToPath(new URL(source, import.meta.url)),
    },
  ];
});

const include = [
  "src/**/*.test.{ts,tsx}",
  "src/**/__tests__/**/*.test.{ts,tsx}",
];
const exclude = ["node_modules", "dist", "coverage"];

// One project per former package, so each suite keeps its own environment.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        // @n-uf/doodl (core): plain node
        test: {
          name: "core",
          globals: true,
          include,
          exclude: [...exclude, "src/react/**", "src/react-pdf/**", "src/go/**"],
        },
      },
      {
        resolve: { alias },
        // @n-uf/doodl/react: jsdom + localStorage mock setup
        test: {
          name: "react",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./test-setup.ts"],
          include: [
            "src/react/**/*.test.{ts,tsx}",
            "src/react/**/__tests__/**/*.test.{ts,tsx}",
          ],
          exclude,
        },
      },
      {
        resolve: { alias },
        // @n-uf/doodl/react-pdf and /go: node, pure-logic tests
        test: {
          name: "react-pdf-go",
          globals: true,
          include: [
            "src/react-pdf/**/*.test.{ts,tsx}",
            "src/go/**/*.test.{ts,tsx}",
          ],
          exclude,
        },
      },
    ],
  },
});
