import { ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { log } from "@/lib/logger";
import { releaseDue, runPayouts } from "@/lib/escrow/escrow";
import { runPriceAlerts } from "@/lib/lifecycle/alerts";
import { runLifecycle } from "@/lib/lifecycle/lifecycle";

/**
 * Ops scheduler (wire to cron later): escrow release, auto-payouts,
 * price alerts, lifecycle emails and affinity rebuild. Idempotent — reruns are safe.
 */
export const POST = withAdmin(async (_req, actor) => {
  const [release, payouts, alerts, lifecycle, deals, affinity] = await Promise.all([
    releaseDue(),
    runPayouts(),
    runPriceAlerts().catch((e) => {
      log.error("ops: price alerts failed", { err: e });
      return { priceDrops: 0, restocks: 0 };
    }),
    runLifecycle(),
    import("@/lib/deals/scheduler").then((m) => m.runDeals()).catch((e) => {
      log.error("ops: deals failed", { err: e });
      return { started: 0, ended: 0, notified: 0 };
    }),
    import("@/lib/affinity/recompute").then((m) => m.runAffinity()).catch((e) => {
      log.error("ops: affinity failed", { err: e });
      return { pairs: 0 };
    }),
  ]);
  await audit(actor.id, "ops.run", "Ops", "scheduler", { release, payouts, alerts, lifecycle, deals, affinity });
  return ok({ release, payouts, alerts, lifecycle, deals, affinity });
}, "ops");