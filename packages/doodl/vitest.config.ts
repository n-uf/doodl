import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "doodl",
    globals: true,
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", "coverage"],
    passWithNoTests: true,
  },
});
