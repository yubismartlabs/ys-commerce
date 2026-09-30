import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/db-url";

/**
 * Point this process — and the workers it forks — at the throwaway database.
 *
 * This has to happen here, before any app module is imported. `lib/db` builds
 * its Prisma client from `process.env.DATABASE_URL` at import time, so a spec
 * that imports a lib module (the rate limiter, for one) would otherwise read
 * and write the *developer's* database while asserting against the E2E one,
 * with the two silently disagreeing. `dotenv` does not overwrite an existing
 * value, so setting it after that import is what makes this stick.
 */
// Generate the per-run database name here, in the main process, and publish it
// so forked workers resolve the same one. `testDatabaseUrl()` is what sets
// E2E_DB_NAME; calling it first makes that explicit.
testDatabaseUrl();
process.env.DATABASE_URL = testDatabaseUrl();

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
  // Recreates the E2E database from migrations + seed before the run.
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
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
    // Sign in through the real form and save the sessions other specs reuse.
    { name: "setup-seller", testMatch: /auth\.seller\.setup\.ts/ },
    { name: "setup-buyer", testMatch: /auth\.buyer\.setup\.ts/ },
    { name: "setup-admin", testMatch: /auth\.admin\.setup\.ts/ },
    { name: "setup-seller2", testMatch: /auth\.seller2\.setup\.ts/ },
    {
      name: "seller",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/seller.json" },
      // Every session a seller-project spec might need, not just the seller's
      // own. A missing entry leaves a stale storageState on disk from a
      // previous run, whose user ids no longer exist in the recreated database.
      dependencies: ["setup-seller", "setup-seller2", "setup-buyer"],
      // Each project runs only the specs written for its session; without this
      // the seller-only inventory specs would also run as the buyer.
      testMatch: /\.seller\.spec\.ts$/,
    },
    {
      name: "buyer",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/buyer.json" },
      // The checkout spec provisions its listing with the seller session.
      dependencies: ["setup-seller", "setup-buyer"],
      testMatch: /\.buyer\.spec\.ts$/,
    },
    {
      // Cross-role lifecycle specs (buyer files, seller responds, support
      // refunds). They act as three different users, so they drive the API
      // through per-role contexts built from the saved sessions rather than
      // through a single page session.
      // Library-level specs (the rate limiter) that need the database and an
      // HTTP client but not a particular user session.
      name: "lib",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup-seller"],
      testMatch: /\.lib\.spec\.ts$/,
    },
    {
      name: "flow",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup-seller", "setup-seller2", "setup-buyer", "setup-admin"],
      testMatch: /\.flow\.spec\.ts$/,
    },
  ],
  // Skipped when E2E_BASE_URL points at an already-running server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: baseURL,
        // Never reuse a running server: globalSetup drops and recreates the
        // database, and a reused server keeps pooled connections to the dropped
        // one. That produced PrismaClientInitializationError on every request
        // and let the previous run's rows survive into the next.
        reuseExistingServer: false,
        timeout: 240_000,
        // The app under test always points at the throwaway E2E database, so a
        // run can never write to the developer's data.
        env: {
          AUTH_TRUST_HOST: "true",
          DATABASE_URL: testDatabaseUrl(),
        },
      },
});
