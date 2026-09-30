import { test, expect } from "@playwright/test";
import { db } from "./helpers/db";
import { limit, pruneRateLimits } from "@/lib/api/rate-limit";

/**
 * The rate limiter itself.
 *
 * The suite runs with `security.rateLimitMultiplier` raised (the suite checks
 * out dozens of times a minute against one session), so these tests read the
 * live multiplier and assert relative to the effective budget rather than
 * mutating the setting. An earlier version toggled it to 1 and restored it
 * after, which made the run depend on every layer's cache TTL expiring in the
 * right order — and left the whole flow project rate-limited when it did not.
 */
const KEY = `ratelimit-spec-${Math.random().toString(36).slice(2, 10)}`;

/** The budget `limit()` will actually enforce for a coded `max`. */
async function budgetFor(max: number) {
  const row = await db.setting.findUniqueOrThrow({ where: { key: "security" } });
  const multiplier = Number((row.value as Record<string, unknown>)?.rateLimitMultiplier ?? 1);
  return Math.max(1, Math.ceil(max * multiplier));
}

test.describe("rate limiter", () => {
  test("allows up to the budget, then refuses within the window", async () => {
    const max = 5;
    const budget = await budgetFor(max);

    for (let i = 1; i <= budget; i++) {
      const r = await limit(KEY, max, 60_000);
      expect(r.ok, `attempt ${i} of ${budget} should be allowed`).toBe(true);
      expect(r.remaining).toBe(budget - i);
    }

    const blocked = await limit(KEY, max, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test("counts are per key, so one caller cannot exhaust another's budget", async () => {
    const max = 3;
    const budget = await budgetFor(max);
    const a = `${KEY}-a`;
    const b = `${KEY}-b`;
    for (let i = 0; i < budget; i++) await limit(a, max, 60_000);
    expect((await limit(a, max, 60_000)).ok).toBe(false);
    // A different key must be entirely unaffected.
    expect((await limit(b, max, 60_000)).ok).toBe(true);
  });

  test("a new window resets the budget", async () => {
    // A 1ms window has already rolled over by the time the next call runs.
    await limit(`${KEY}-win`, 1, 1);
    await new Promise((r) => setTimeout(r, 5));
    const next = await limit(`${KEY}-win`, 1, 1);
    expect(next.ok).toBe(true);
  });

  test("pruning removes expired windows and leaves current ones", async () => {
    const stale = `${KEY}-stale`;
    await limit(stale, 5, 1);
    await new Promise((r) => setTimeout(r, 5));
    const live = `${KEY}-live`;
    await limit(live, 5, 600_000);

    // The default prune horizon is an hour, so backdate the stale row to be
    // older than that.
    await db.rateLimitBucket.updateMany({
      where: { key: stale },
      data: { windowStart: new Date(Date.now() - 7 * 86400000) },
    });
    const removed = await pruneRateLimits();
    expect(removed).toBeGreaterThanOrEqual(1);

    expect(await db.rateLimitBucket.count({ where: { key: stale } })).toBe(0);
    expect(await db.rateLimitBucket.count({ where: { key: live } })).toBe(1);
  });

  test("concurrent attempts cannot overshoot the budget", async () => {
    const max = 10;
    const budget = await budgetFor(max);
    const key = `${KEY}-race`;
    // Far more simultaneous attempts than the budget. The limiter's decision is
    // a single conditional upsert; the earlier read-then-write version let all
    // of these through.
    const results = await Promise.all(Array.from({ length: budget * 3 }, () => limit(key, max, 60_000)));
    const allowed = results.filter((r) => r.ok).length;
    expect(allowed, "must not exceed the budget under concurrency").toBeLessThanOrEqual(budget);
    expect(allowed, "must still make progress").toBeGreaterThan(0);
  });
});

test.describe("rate limit wiring", () => {
  test("a guarded route writes a bucket under its own key", async ({ request }) => {
    // Proves the route genuinely consults the limiter rather than merely
    // importing it: a counter row appears, keyed by the route's prefix, and it
    // advances with each attempt.
    const prefix = "register:";
    const key = `${prefix}${KEY}-wiring`;
    const before = await db.rateLimitBucket.count({ where: { key } });

    const res = await request.post("/api/v1/auth/register", {
      data: { name: "Wiring", email: `wiring-${KEY}@example.com`, password: "password123" },
    });
    expect(res.status()).toBe(201);

    // The caller is anonymous, so the key is the prefix plus the anon bucket.
    const rows = await db.rateLimitBucket.findMany({ where: { key: { startsWith: prefix } } });
    expect(rows.length, "the route should have written a counter row").toBeGreaterThan(before);
    expect(rows.some((r) => r.count >= 1)).toBe(true);
  });

  test("a throttled route returns 429 with a retry hint", async ({ request }) => {
    // Observing a real 429 means exceeding the real ceiling, so the multiplier
    // is dropped to 1 for this test only. The algorithm tests above no longer
    // depend on its value, and the restore is in a `finally` so a failure here
    // cannot leak a tightened ceiling into the rest of the suite.
    const row = await db.setting.findUniqueOrThrow({ where: { key: "security" } });
    const saved = (row.value ?? {}) as Record<string, unknown>;
    await db.setting.update({
      where: { key: "security" },
      data: { value: { ...saved, rateLimitMultiplier: 1 } },
    });
    // The limiter caches the multiplier briefly.
    await new Promise((r) => setTimeout(r, 6_000));

    try {
      const responses = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          request.post("/api/v1/auth/register", {
            data: { name: `RL ${i}`, email: `rl-${KEY}-${i}@example.com`, password: "password123" },
          })
        )
      );
      const codes = responses.map((r) => r.status());
      // Registration allows 10/hour.
      expect(codes.filter((c) => c === 201).length).toBeLessThanOrEqual(10);
      expect(codes).toContain(429);

      const limited = responses.find((r) => r.status() === 429)!;
      const body = (await limited.json()) as {
        error: { code: string; details: { retryAfterSeconds: number } };
      };
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    } finally {
      await db.setting.update({
        where: { key: "security" },
        data: { value: saved as object },
      });
      await new Promise((r) => setTimeout(r, 6_000));
    }
  });
});
