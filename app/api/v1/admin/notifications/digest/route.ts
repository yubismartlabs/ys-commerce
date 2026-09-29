import { ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { runDigest } from "@/lib/notifications/notify";

// Manual trigger for the ops digest scan (low stock, new disputes,
// new reviews, failed payouts). Idempotent — already-announced
// entities are skipped. Wire to a scheduler later for hands-free runs.
export const POST = withAdmin(async (_req, actor) => {
  const result = await runDigest();
  await audit(actor.id, "notifications.digest", "Notification", "digest", result.counts);
  return ok(result);
});
