import path from "node:path";
// The Playwright process doesn't inherit the app's env the way `next start`
// does, so load .env here (the same thing prisma.config.ts does).
import "dotenv/config";

/**
 * The E2E suite runs against its own throwaway database, never the developer's.
 *
 * The suite writes rows (listings, orders) and a listing that has been ordered
 * cannot be deleted through the API, so running against the dev database would
 * leave unrecoverable debris behind on every run. A dedicated database is
 * dropped and recreated for each run, which also makes runs repeatable.
 *
 * The URL is computed synchronously here (rather than in globalSetup) because
 * Playwright reads `webServer.env` while loading this config, before any setup
 * hook runs.
 */
export const TEST_DB_NAME = "ys_commerce_e2e";

export function baseDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; the E2E suite needs it to derive a test database.");
  return url;
}

/** Same server/credentials, different database. */
export function testDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

/** Connection to the maintenance database, used to CREATE/DROP the test one. */
export function maintenanceDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  url.pathname = "/postgres";
  return url.toString();
}

export const repoRoot = path.resolve(__dirname, "..");
