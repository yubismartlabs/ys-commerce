/**
 * Backfill User.username for pre-username accounts.
 * Run once after deploy: npx tsx scripts/backfill-usernames.ts
 * Idempotent — skips users that already have a handle.
 */
import { db } from "../lib/db";
import { baseUsernameFromName, isUsernameReserved, normalizeUsername } from "../lib/usernames";
import { defaultSettings } from "../lib/settings";

async function main() {
  const rows = await db.user.findMany({
    where: { username: null },
    select: { id: true, name: true, email: true },
  });
  if (rows.length === 0) {
    console.log("backfill-usernames: nothing to do");
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
  for (const u of rows) {
    const base = normalizeUsername(baseUsernameFromName(u.name, u.email)).slice(0, 24) || "shopper";
    let candidate = base;
    // Ensure format minimums (base can be short for one-letter names).
    if (candidate.length < 3) candidate = `${candidate}user`.slice(0, 24);
    let n = 0;
    for (;;) {
      const tryName = n === 0 ? candidate : `${candidate.slice(0, 24 - String(n).length)}${n}`;
      if (!isUsernameReserved(tryName, settingsReserved)) {
        const taken = await db.user.findUnique({ where: { username: tryName }, select: { id: true } });
        if (!taken) {
          await db.user.update({ where: { id: u.id }, data: { username: tryName } });
          done++;
          break;
        }
      }
      n++;
      if (n > 500) throw new Error(`could not find a handle for user ${u.id}`);
    }
  }
  console.log(`backfill-usernames: assigned ${done}/${rows.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
