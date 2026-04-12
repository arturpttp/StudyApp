import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ["./test-setup.ts"],
    environmentMatchGlobs: [
      ["**/__tests__/**/*.test.tsx", "jsdom"],
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
