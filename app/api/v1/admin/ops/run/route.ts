import { ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { releaseDue, runPayouts } from "@/lib/escrow/escrow";
import { runPriceAlerts } from "@/lib/lifecycle/alerts";
import { runLifecycle } from "@/lib/lifecycle/lifecycle";

/**
 * Ops scheduler (wire to cron later): escrow release, auto-payouts,
 * price alerts and lifecycle emails. Idempotent — reruns are safe.
 */
export const POST = withAdmin(async (_req, actor) => {
  const [release, payouts, alerts, lifecycle, deals] = await Promise.all([
    releaseDue(),
    runPayouts(),
    runPriceAlerts().catch((e) => {
      console.error("[ops] price alerts failed", e);
      return { priceDrops: 0, restocks: 0 };
    }),
    runLifecycle(),
    import("@/lib/deals/scheduler").then((m) => m.runDeals()).catch((e) => {
      console.error("[ops] deals failed", e);
      return { started: 0, ended: 0, notified: 0 };
    }),
  ]);
  await audit(actor.id, "ops.run", "Ops", "scheduler", { release, payouts, alerts, lifecycle, deals });
  return ok({ release, payouts, alerts, lifecycle, deals });
}, "ops");