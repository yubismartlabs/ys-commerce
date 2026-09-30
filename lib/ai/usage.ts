import { clientKey, limit } from "@/lib/api/rate-limit";

export type QuotaDecision = { ok: true } | { ok: false; message: string; retryAfterSeconds: number };

/**
 * HF free-tier guards: per-minute burst + per-user daily + global daily.
 * Backed by the shared Postgres limiter so multi-instance stays correct.
 */
export async function checkAiQuota(req: Request, userId: string, cfg: { dailyLimitPerUser: number; globalDailyCap: number }): Promise<QuotaDecision> {
  const burst = await limit(clientKey(req, "ai", userId), 10, 60_000);
  if (!burst.ok) {
    return { ok: false, message: "Slow down — too many assistant messages this minute.", retryAfterSeconds: burst.retryAfterSeconds };
  }
  const perUser = await limit(`ai:daily:u:${userId}`, cfg.dailyLimitPerUser, 24 * 60 * 60 * 1000);
  if (!perUser.ok) {
    return { ok: false, message: "Daily assistant limit reached (free-tier protection). Try again tomorrow.", retryAfterSeconds: perUser.retryAfterSeconds };
  }
  const global = await limit("ai:daily:global", cfg.globalDailyCap, 24 * 60 * 60 * 1000);
  if (!global.ok) {
    return { ok: false, message: "Assistant is paused today — site-wide free-tier cap reached. Browsing still works.", retryAfterSeconds: global.retryAfterSeconds };
  }
  return { ok: true };
}
