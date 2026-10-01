import { clientKey, limit } from "@/lib/api/rate-limit";

export type QuotaDecision = { ok: true } | { ok: false; message: string; retryAfterSeconds: number };

/**
 * Free-tier guards: per-minute burst + per-user daily + global daily.
 * Backed by the shared Postgres limiter so multi-instance stays correct.
 *
 * Hard ceilings: 5 model calls/minute and 30/day per user. A single user
 * looping requests can never drain the site's daily budget — the per-user
 * daily cap is clamped with Math.min so even a stored admin value above 30
 * cannot widen it. Quota-free paths (chitchat, alerts, mission packs) return
 * before this check and never consume budget.
 */
export async function checkAiQuota(req: Request, userId: string, cfg: { dailyLimitPerUser: number; globalDailyCap: number }): Promise<QuotaDecision> {
  const burst = await limit(clientKey(req, "ai", userId), 5, 60_000);
  if (!burst.ok) {
    return { ok: false, message: "Slow down — max 5 assistant messages per minute.", retryAfterSeconds: burst.retryAfterSeconds };
  }
  const perUser = await limit(`ai:daily:u:${userId}`, Math.min(cfg.dailyLimitPerUser, 30), 24 * 60 * 60 * 1000);
  if (!perUser.ok) {
    return { ok: false, message: "Daily assistant limit reached (max 30/day, free-tier protection). Try again tomorrow.", retryAfterSeconds: perUser.retryAfterSeconds };
  }
  const global = await limit("ai:daily:global", cfg.globalDailyCap, 24 * 60 * 60 * 1000);
  if (!global.ok) {
    return { ok: false, message: "Assistant is paused today — site-wide free-tier cap reached. Browsing still works.", retryAfterSeconds: global.retryAfterSeconds };
  }
  return { ok: true };
}
