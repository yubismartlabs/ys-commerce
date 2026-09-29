import { db } from "@/lib/db";
import { getEmailConfig } from "@/lib/email/send";
import { dealStartedEmail } from "@/lib/email/templates";
import { notifyUser, sendAndLog } from "@/lib/notifications/notify";
import { buyerPrefs } from "@/lib/lifecycle/prefs";

/**
 * Deal lifecycle for the ops scheduler: start due deals (notifying
 * wishlisters + followers), end expired/capped ones. Idempotent.
 */
export async function runDeals(): Promise<{ started: number; ended: number; notified: number }> {
  const now = new Date();
  const config = await getEmailConfig();

  const due = await db.deal.findMany({
    where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } },
    include: { product: { select: { id: true, slug: true, title: true, price: true, storeId: true } } },
  });
  let started = 0;
  let notified = 0;
  for (const deal of due) {
    await db.deal.update({ where: { id: deal.id }, data: { status: "ACTIVE" } });
    started++;

    // Wishlisters + followers get first dibs (gated by their prefs).
    const [wishers, followers] = await Promise.all([
      db.wishlistItem.findMany({ where: { productId: deal.productId }, select: { userId: true } }),
      db.storeFollow.findMany({ where: { storeId: deal.product.storeId }, select: { userId: true } }),
    ]);
    const targets = new Map<string, "wisher" | "follower">();
    for (const w of wishers) targets.set(w.userId, "wisher");
    for (const f of followers) if (!targets.has(f.userId)) targets.set(f.userId, "follower");

    const base = Number(deal.product.price);
    const template = () =>
      dealStartedEmail({
        siteName: config.siteName,
        productTitle: deal.product.title,
        productSlug: deal.product.slug,
        dealPrice: Number(deal.dealPrice),
        was: base,
        endsAt: deal.endsAt.toLocaleDateString(),
      });
    for (const [userId, kind] of targets) {
      const prefs = await buyerPrefs(userId);
      const allowed = kind === "wisher" ? prefs.priceAlerts : prefs.lifecycle;
      if (!allowed) continue;
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user) continue;
      await notifyUser({
        userId,
        type: "deal.started",
        title: `Flash deal: ${deal.product.title} — $${Number(deal.dealPrice).toFixed(2)}`,
        link: `/product/${deal.product.slug}`,
        meta: { entityId: deal.id },
      });
      if (config.enabled) {
        const result = await sendAndLog({
          to: user.email,
          template: template(),
          meta: { template: "deal_started", dealId: deal.id },
        });
        if (result.ok) notified++;
      }
    }
  }

  // End expired or capped deals (single pass, idempotent).
  const ending = await db.deal.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, endsAt: true, stockCap: true, soldCount: true },
  });
  const ids = ending
    .filter((d) => d.endsAt <= now || (d.stockCap !== null && d.soldCount >= d.stockCap))
    .map((d) => d.id);
  if (ids.length > 0) {
    await db.deal.updateMany({ where: { id: { in: ids } }, data: { status: "ENDED" } });
  }
  return { started, ended: ids.length, notified };
}
