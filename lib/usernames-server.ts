import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import {
  baseUsernameFromName,
  isUsernameReserved,
  normalizeUsername,
} from "@/lib/usernames";

/** Operator-managed blocklist merged over the built-ins (lowercased). */
export async function getReservedUsernames(): Promise<string[]> {
  try {
    const g = await getSettingGroup("usernames");
    const extra = Array.isArray(g?.reserved) ? g.reserved : [];
    return extra.map((s) => normalizeUsername(s)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Lifetime cap on store-username renames (admin-tunable, default 2). */
export async function getStoreUsernameMaxChanges(): Promise<number> {
  try {
    const g = await getSettingGroup("usernames");
    const v = (g as { storeUsernameMaxChanges?: unknown } | null)?.storeUsernameMaxChanges;
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10 ? v : 2;
  } catch {
    return 2;
  }
}

export type HandleOwner =
  | { type: "user"; id: string }
  | { type: "store"; id: string };

/**
 * Shared-namespace lookup: a handle is taken when ANY user OR store owns it.
 * Pass exclusions so a rename-to-self (or the paired user/store row) never
 * self-collides.
 */
export async function findHandleOwner(
  username: string,
  exclude?: { userId?: string; storeId?: string }
): Promise<HandleOwner | null> {
  const value = normalizeUsername(username);
  if (!value) return null;
  const [user, store] = await Promise.all([
    db.user.findUnique({ where: { username: value }, select: { id: true } }),
    db.store.findUnique({ where: { username: value }, select: { id: true } }),
  ]);
  if (user && user.id !== exclude?.userId) return { type: "user", id: user.id };
  if (store && store.id !== exclude?.storeId) return { type: "store", id: store.id };
  return null;
}

/**
 * Find a free handle based on `base` ("ada.lovelace" → "ada.lovelace2"…).
 * Returns the base itself when it is free, valid and not reserved.
 * Checks the shared user+store namespace so a minted handle can never
 * collide with a store @handle (or vice versa).
 */
export async function ensureUniqueUsername(
  baseRaw: string,
  reserved: string[] = [],
  exclude?: { userId?: string; storeId?: string }
): Promise<string> {
  let base = normalizeUsername(baseRaw).slice(0, 24) || "shopper";
  if (base.length < 3) base = `${base}user`.slice(0, 24);
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? base : `${base.slice(0, 24 - String(n).length)}${n}`;
    if (isUsernameReserved(candidate, reserved)) continue;
    const taken = await findHandleOwner(candidate, exclude);
    if (!taken) return candidate;
  }
  // Extremely unlikely — fall back to a random suffix so signup never 500s.
  for (;;) {
    const candidate = `shopper${Math.random().toString(36).slice(2, 8)}`;
    if (isUsernameReserved(candidate, reserved)) continue;
    const taken = await findHandleOwner(candidate, exclude);
    if (!taken) return candidate;
  }
}

/** Auto-handle for a new account (name → email local part → "shopper"). */
export async function generateUsernameForNewUser(
  name: string | null | undefined,
  email: string
): Promise<string> {
  const reserved = await getReservedUsernames();
  return ensureUniqueUsername(baseUsernameFromName(name, email), reserved);
}

/**
 * Backfill-on-read: older rows predate the username column. Returns the
 * existing handle or mints + persists one (best-effort — returns null when
 * the DB write fails so callers can still render).
 */
export async function ensureUserUsername(userId: string): Promise<string | null> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, name: true, email: true } });
  if (!row) return null;
  if (row.username) return row.username;
  try {
    const reserved = await getReservedUsernames();
    const fresh = await ensureUniqueUsername(baseUsernameFromName(row.name, row.email), reserved);
    await db.user.update({ where: { id: userId }, data: { username: fresh } });
    return fresh;
  } catch (e) {
    console.error("[usernames] backfill failed:", e);
    return null;
  }
}
