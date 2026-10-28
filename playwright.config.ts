import { defineConfig, devices } from "@playwright/test";

// Runs against a local server by default, never production: CI starts
// `next start -p 3458` itself, and a local run reuses (or starts) the dev
// server on 3458. PLAYWRIGHT_BASE_URL points it elsewhere on purpose.
// PLAYWRIGHT_CHANNEL=chrome uses the installed Chrome instead of the bundled
// Chromium. Tests tagged @flow create accounts and are left out of CI.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3458";
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) },
    },
  ],
  webServer:
    process.env.CI || process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : { command: "npx next dev -p 3458 --webpack", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
