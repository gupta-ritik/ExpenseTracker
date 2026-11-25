import { defineConfig, devices } from "@playwright/test";
import { loadTestEnvironment } from "./scripts/test-environment";

loadTestEnvironment();
const baseURL = process.env.BETTER_AUTH_URL;
if (!baseURL) throw new Error("Set BETTER_AUTH_URL in .env.test.");
const url = new URL(baseURL);
if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("End-to-end checks must run against a local server.");
if (!url.port) throw new Error("Set a dedicated local test port in .env.test.");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 100000,
  expect: { timeout: 12000 },
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  use: { baseURL, acceptDownloads: true, actionTimeout: 10000, trace: "retain-on-failure" },
  webServer: {
    command: `npm run start -- --port ${url.port} --hostname ${url.hostname}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    stdout: "pipe",
    timeout: 65000,
  },
});
