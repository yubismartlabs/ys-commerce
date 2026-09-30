import { Client } from "pg";
import { maintenanceDatabaseUrl, TEST_DB_NAME } from "./db-url";

/**
 * Drops the E2E database when the run is clean. On failure it is left in place
 * so the state can be inspected.
 *
 * Set E2E_KEEP_DB=1 to keep it regardless.
 */
export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DB === "1") {
    console.log(`[e2e] keeping ${TEST_DB_NAME} (E2E_KEEP_DB=1)`);
    return;
  }
  const maintenance = new Client({ connectionString: maintenanceDatabaseUrl() });
  await maintenance.connect();
  try {
    await maintenance.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME]
    );
    await maintenance.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  } finally {
    await maintenance.end();
  }
}
