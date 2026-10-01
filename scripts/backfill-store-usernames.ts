/**
 * Backfill Store.username for pre-handle stores.
 * Run once after deploy: npx tsx scripts/backfill-store-usernames.ts
 * Idempotent — skips stores that already have a handle.
 *
 * Handles are derived from the store name and claimed in the shared
 * user+store namespace, so a backfilled @handle can never collide with
 * an existing user handle (or another store).
 */
import { db } from "../lib/db";
import { isUsernameReserved, normalizeUsername } from "../lib/usernames";
import { findHandleOwner } from "../lib/usernames-server";
import { defaultSettings } from "../lib/settings";

function baseFromName(name: string): string {
  const base =
    normalizeUsername(name)
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.{2,}/g, ".")
      .slice(0, 24)
      .replace(/^\.+|\.+$/g, "") || "store";
  return base.length < 3 ? `${base}store`.slice(0, 24) : base;
}

async function main() {
  const rows = await db.store.findMany({
    where: { username: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    console.log("backfill-store-usernames: nothing to do");
    return;
  }
  let settingsReserved: string[] = [];
  try {
    const row = await db.setting.findUnique({ where: { key: "usernames" } });
    const v = row?.value as { reserved?: unknown } | null;
    if (Array.isArray(v?.reserved)) settingsReserved = v.reserved.filter((s): s is string => typeof s === "string");
  } catch {
    settingsReserved = defaultSettings().usernames.reserved;
  }

  let done = 0;
  for (const s of rows) {
    const base = baseFromName(s.name);
    let n = 0;
    for (;;) {
      const tryName = n === 0 ? base : `${base.slice(0, 24 - String(n).length)}${n}`;
      if (!isUsernameReserved(tryName, settingsReserved)) {
        const taken = await findHandleOwner(tryName);
        if (!taken) {
          await db.store.update({ where: { id: s.id }, data: { username: tryName } });
          done++;
          break;
        }
      }
      n++;
      if (n > 500) throw new Error(`could not find a handle for store ${s.id}`);
    }
  }
  console.log(`backfill-store-usernames: assigned ${done}/${rows.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
