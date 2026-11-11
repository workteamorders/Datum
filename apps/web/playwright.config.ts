import { defineConfig, devices } from "@playwright/test";

// The tests run against the static export (./out) served with a mock RPC (e2e/serve.ts). No network is used.
// PW_CHROMIUM can point at an installed Chromium when `playwright install` has not been run.
const baseURL = `http://localhost:${process.env.PORT ?? 4173}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: "pnpm exec tsx e2e/serve.ts",
    url: `${baseURL}/api/rpc`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
