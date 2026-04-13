import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const clientDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * External-site E2E — does not start the local Vite/API stack.
 * Run: npm run test:e2e:competitor
 */
export default defineConfig({
  testDir: path.join(clientDir, "e2e"),
  testMatch: "**/competitor*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 180_000,
  use: {
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
