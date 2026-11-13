import { defineConfig } from "vitest/config";

/**
 * Browser-mode checks (real Chromium via Playwright, headless).
 *
 * Run with `pnpm --filter @n-uf/doodl-react test:browser`. The default `test`
 * script stays on jsdom and never picks up `src/__browser__`.
 *
 * `@n-uf/doodl` resolves to its TypeScript source (the `@n-uf/source` export
 * condition) so these checks exercise the engine as it is in the working tree
 * and need no prior `build`.
 */
export default defineConfig({
  resolve: {
    conditions: ["@n-uf/source", "module", "browser", "development|production"],
  },
  optimizeDeps: {
    include: ["react", "react/jsx-dev-runtime", "react-dom", "react-dom/client"],
  },
  test: {
    name: "doodl-react-browser",
    include: ["src/__browser__/**/*.browser.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "coverage"],
    browser: {
      enabled: true,
      headless: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
      viewport: { width: 800, height: 900 },
      screenshotFailures: false,
    },
  },
});
