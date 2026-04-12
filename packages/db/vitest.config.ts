import { defineConfig } from "vitest/config";
import "dotenv/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
});
