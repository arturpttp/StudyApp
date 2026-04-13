import { config } from "dotenv";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

config({ path: ".env.local" });

// Automatically clean up the DOM after each test that uses @testing-library/react
afterEach(() => {
  cleanup();
});
