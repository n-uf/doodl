import { defineConfig } from "vitest/config";

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
        // @n-uf/doodl (core): plain node
        test: {
          name: "core",
          globals: true,
          include,
          exclude: [...exclude, "src/react/**", "src/react-pdf/**", "src/go/**"],
        },
      },
      {
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
