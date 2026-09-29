import { ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { releaseDue, runPayouts } from "@/lib/escrow/escrow";

/**
 * Ops scheduler (wire to cron later): releases due escrow into PENDING
 * payouts, then auto-pays eligible payouts per the payout minimum.
 * Idempotent — already-settled entities are skipped.
 */
export const POST = withAdmin(async (_req, actor) => {
  const release = await releaseDue();
  const payouts = await runPayouts();
  await audit(actor.id, "ops.run", "Ops", "scheduler", { release, payouts });
  return ok({ release, payouts });
}, "ops");
