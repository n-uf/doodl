import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "doodl-react",
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.test.{ts,tsx}",
    ],
    // `__browser__` runs in real Chromium via vitest.browser.config.ts.
    exclude: ["node_modules", "dist", "coverage", "src/__browser__/**"],
    passWithNoTests: true,
  },
});
