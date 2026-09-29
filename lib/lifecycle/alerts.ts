import { db } from "@/lib/db";
import { getEmailConfig } from "@/lib/email/send";
import { backInStockEmail, priceDropEmail } from "@/lib/email/templates";
import { sendAndLog } from "@/lib/notifications/notify";
import { currentPrice } from "@/lib/deals/pricing";
import { buyerPrefs } from "@/lib/lifecycle/prefs";

/**
 * Fire unsent price-drop + restock alerts. Idempotent (sentAt set only on
 * successful send) — safe to run on every scheduler tick.
 */
export async function runPriceAlerts(): Promise<{ priceDrops: number; restocks: number }> {
  const config = await getEmailConfig();
  if (!config.enabled) return { priceDrops: 0, restocks: 0 };
  const pending = await db.priceAlert.findMany({
    where: { sentAt: null },
    include: {
      product: {
        select: {
          id: true, slug: true, title: true, status: true, price: true,
          variants: { select: { stock: true } },
        },
      },
    },
    take: 200,
  });

  let priceDrops = 0;
  let restocks = 0;
  for (const alert of pending) {
    const prefs = await buyerPrefs(alert.userId);
    if (!prefs.priceAlerts) continue;
    const p = alert.product;
    if (p.status !== "ACTIVE") continue;

    if (alert.kind === "PRICE_DROP") {
      const base = Number(p.price);
      const { price: now } = await currentPrice(p.id, base);
      const target = alert.target === null ? null : Number(alert.target);
      if (now < base || (target !== null && now <= target)) {
        const user = await db.user.findUnique({ where: { id: alert.userId }, select: { email: true } });
        if (!user) continue;
        const result = await sendAndLog({
          to: user.email,
          template: priceDropEmail({
            productTitle: p.title,
            productSlug: p.slug,
            was: base,
            now,
            target: target ?? undefined,
            siteName: config.siteName,
          }),
          meta: { template: "price_drop", productId: p.id },
        });
        if (result.ok) {
          await db.priceAlert.update({ where: { id: alert.id }, data: { sentAt: new Date() } });
          priceDrops++;
        }
      }
    } else {
      const inStock = p.variants.length === 0 || p.variants.some((v) => v.stock > 0);
      if (!inStock) continue;
      const user = await db.user.findUnique({ where: { id: alert.userId }, select: { email: true } });
      if (!user) continue;
      const result = await sendAndLog({
        to: user.email,
        template: backInStockEmail({ productTitle: p.title, productSlug: p.slug, siteName: config.siteName }),
        meta: { template: "back_in_stock", productId: p.id },
      });
      if (result.ok) {
        await db.priceAlert.update({ where: { id: alert.id }, data: { sentAt: new Date() } });
        restocks++;
      }
    }
  }
  return { priceDrops, restocks };
}
