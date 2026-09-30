import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { testDatabaseUrl, maintenanceDatabaseUrl, TEST_DB_NAME, repoRoot } from "./db-url";

/**
 * Recreates the E2E database from migrations + seed before any test runs.
 *
 * Dropping and recreating (rather than truncating) means a schema change in a
 * migration is picked up without anyone having to remember to re-migrate, and
 * a previous run's leftovers cannot influence this one.
 */
async function main() {
  const maintenance = new Client({ connectionString: maintenanceDatabaseUrl() });
  await maintenance.connect();
  try {
    // A pool can still be holding connections from the previous run.
    await maintenance.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME]
    );
    await maintenance.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await maintenance.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await maintenance.end();
  }

  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url };
  const prisma = (args: string[]) =>
    execFileSync("npx", ["prisma", ...args], { cwd: repoRoot, env, stdio: "inherit" });

  prisma(["migrate", "deploy"]);
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { cwd: repoRoot, env, stdio: "inherit" });
}

export default async function globalSetup() {
  await main();
}
