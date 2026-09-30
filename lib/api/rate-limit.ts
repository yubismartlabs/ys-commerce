import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import { log } from "@/lib/logger";

/**
 * Fixed-window rate limiting, backed by the database.
 *
 * The in-memory limiter that used to guard chat messaging is per-process, so
 * with two app instances each one enforced its own budget — a caller simply
 * got twice the allowance by being routed to a different instance, and a
 * rolling deploy silently resets everyone's quota. Counting in Postgres makes
 * the limit correct regardless of how many instances are running, at the cost
 * of one small read-modify-write per attempt.
 *
 * Fail-open by design: if the limiter itself errors, the request proceeds. A
 * rate limiter that takes the site down when its storage is unhealthy is worse
 * than one that briefly stops limiting.
 */

export type Limit = { ok: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Apply the operator-configured multiplier to a coded budget.
 *
 * Read through a short-lived cache: the limiter already costs a round trip per
 * call, and re-reading a setting on every request to decide how many requests
 * to allow would make the limiter the most expensive thing in the path.
 * A stale multiplier for a few seconds is harmless — the next window picks it
 * up, and the worst case is a slightly wrong ceiling briefly.
 */
let cachedMultiplier: { value: number; at: number } | null = null;
const MULTIPLIER_TTL_MS = 5_000;

async function rateLimitMultiplier(): Promise<number> {
  const now = Date.now();
  if (cachedMultiplier && now - cachedMultiplier.at < MULTIPLIER_TTL_MS) return cachedMultiplier.value;
  try {
    const security = await getSettingGroup("security");
    const value = security.rateLimitMultiplier;
    cachedMultiplier = { value, at: now };
    return value;
  } catch {
    // Never fail a request because a setting could not be read.
    return 1;
  }
}

/** Window buckets are keyed by (key, window start) so rows expire naturally. */
function windowStart(now: number, windowMs: number) {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

/**
 * Consume one unit of `key`'s budget. Returns whether the call is allowed and,
 * when it is not, how long to wait.
 *
 * The whole decision is one atomic statement. The obvious implementation —
 * SELECT the count, then INSERT or UPDATE — is check-then-act: concurrent
 * callers all read the pre-increment value before any of them writes, so a
 * budget of 10 admitted 30 simultaneous requests in testing. The conditional
 * `ON CONFLICT ... DO UPDATE ... WHERE count < budget` makes the read and the
 * write a single step, and returns no row when the budget is spent, which is
 * how a refusal is detected.
 */
export async function limit(key: string, max: number, windowMs: number): Promise<Limit> {
  const now = Date.now();
  const budget = Math.max(1, Math.ceil(max * (await rateLimitMultiplier())));
  const bucket = windowStart(now, windowMs);

  try {
    const rows = await db.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "updatedAt")
      VALUES (${key}, ${bucket}, 1, NOW())
      ON CONFLICT ("key", "windowStart") DO UPDATE
        SET "count" = "RateLimitBucket"."count" + 1, "updatedAt" = NOW()
        WHERE "RateLimitBucket"."count" < ${budget}
      RETURNING "count"
    `;

    const count = rows[0]?.count;
    if (count === undefined) {
      // The WHERE guard blocked the update, so the budget is spent.
      const retryAfterMs = bucket.getTime() + windowMs - now;
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }
    return { ok: true, remaining: Math.max(0, budget - count), retryAfterSeconds: 0 };
  } catch (e) {
    // Fail open. A limiter that takes the site down when its storage is
    // unhealthy is worse than one that briefly stops limiting.
    log.error("rate limiter failed open", { err: e, key });
    return { ok: true, remaining: budget, retryAfterSeconds: 0 };
  }
}

/** Best-effort cleanup of expired windows. Safe to call from a cron. */
export async function pruneRateLimits(olderThanMs = 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const { count } = await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return count;
}

/**
 * Identify the caller for rate-limiting purposes.
 *
 * Prefers the authenticated user, then falls back to the client address. The
 * address is read from a proxy header only when the deployment sets
 * TRUST_PROXY, because that header is attacker-controlled otherwise and would
 * make the limit trivially bypassable.
 */
export function clientKey(req: Request, prefix: string, userId?: string | null) {
  if (userId) return `${prefix}:u:${userId}`;
  if (process.env.TRUST_PROXY === "true") {
    const fwd = req.headers.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim();
    if (ip) return `${prefix}:ip:${ip}`;
  }
  return `${prefix}:anon`;
}
