/**
 * E2E-only: widen the rate-limit ceilings for the throwaway test database.
 *
 * Run by tests/global-setup.ts after seeding, never by the application. Kept as
 * its own script so it is impossible to run by accident against a real
 * database — it refuses unless the connection string points at the test one.
 */
import { PrismaClient } from "@prisma/client";

const TEST_DB_PREFIX = "ys_commerce_e2e";

async function main() {
  const db = new PrismaClient();
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const name = url.pathname.replace(/^\//, "");
    if (!name.startsWith(TEST_DB_PREFIX)) {
      throw new Error(`Refusing to run: DATABASE_URL is "${name}", not a ${TEST_DB_PREFIX}* database.`);
    }
    const row = await db.setting.findUnique({ where: { key: "security" } });
    const value = (row?.value ?? {}) as Record<string, unknown>;
    await db.setting.upsert({
      where: { key: "security" },
      update: { value: { ...value, rateLimitMultiplier: 1000 } },
      create: { key: "security", value: { rateLimitMultiplier: 1000 } },
    });
    console.log(`Relaxed rate limits for ${name}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
