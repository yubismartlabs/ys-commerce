import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke suite for the seller inventory manager.
 *
 * Runs against a PRODUCTION build (`next build && next start`) rather than dev,
 * because the things most likely to break here — SSR/prerender, the client
 * component boundary, cache defaults — behave differently under dev.
 *
 * `workers: 1` is deliberate: the tests mutate seeded rows in a shared
 * database, so parallel workers would race each other.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs in through the real form and saves the session for every other spec.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/seller.json" },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  // Skipped when E2E_BASE_URL points at an already-running server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: { AUTH_TRUST_HOST: "true" },
      },
});
