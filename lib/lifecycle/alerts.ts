import { db } from "@/lib/db";
import { getEmailConfig } from "@/lib/email/send";
import { backInStockEmail, priceDropEmail } from "@/lib/email/templates";
import { sendAndLog } from "@/lib/notifications/notify";
import { currentPrice } from "@/lib/deals/pricing";
import { buyerPrefs } from "@/lib/lifecycle/prefs";

/**
 * Fire unsent price-drop + restock alerts.
 *
 * Two rules make this correct:
 *  - Trigger compares the CURRENT price against what the buyer actually saw
 *    (`compareAt`, the struck-through price) or their explicit target. The old
 *    code compared the current price to the price read at scan time, so it was
 *    always equal and never fired — except during a flash deal, where it fired
 *    once on the first tick and then stayed stamped forever.
 *  - Alerts re-arm. `sentAt` is a high-water mark, not a tombstone: once the
 *    price climbs back over the threshold the alert is re-armed so a genuine
 *    later drop can notify again. Same for restock.
 */
export async function runPriceAlerts(): Promise<{ priceDrops: number; restocks: number }> {
  const config = await getEmailConfig();
  if (!config.enabled) return { priceDrops: 0, restocks: 0 };
  const pending = await db.priceAlert.findMany({
    where: { sentAt: null },
    include: {
      product: {
        select: {
          id: true, slug: true, title: true, status: true, price: true, compareAt: true,
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
      const listPrice = Number(p.price);
      const was = p.compareAt === null ? listPrice : Number(p.compareAt);
      const { price: now } = await currentPrice(p.id, listPrice);
      const target = alert.target === null ? null : Number(alert.target);
      const threshold = target ?? was;
      // Below the line the buyer set (or below the price they were shown).
      if (now <= threshold) {
        const user = await db.user.findUnique({ where: { id: alert.userId }, select: { email: true } });
        if (!user) continue;
        const result = await sendAndLog({
          to: user.email,
          template: priceDropEmail({
            productTitle: p.title,
            productSlug: p.slug,
            was,
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
  await rearmAlerts();
  return { priceDrops, restocks };
}

/**
 * Re-arm already-fired alerts whose condition no longer holds, so a later real
 * price drop (or a second restock) can notify again. Runs on every tick and is
 * a no-op when nothing qualifies.
 */
async function rearmAlerts(): Promise<void> {
  try {
    const spent = await db.priceAlert.findMany({
      where: { sentAt: { not: null } },
      include: { product: { select: { price: true, compareAt: true, status: true, variants: { select: { stock: true } } } } },      take: 500,
    });
    for (const alert of spent) {
      const p = alert.product;
      if (p.status !== "ACTIVE") continue;
      if (alert.kind === "PRICE_DROP") {
        const listPrice = Number(p.price);
        const { price: now } = await currentPrice(alert.productId, listPrice);
        const threshold = alert.target === null ? (p.compareAt === null ? listPrice : Number(p.compareAt)) : Number(alert.target);
        if (now > threshold) {
          await db.priceAlert.update({ where: { id: alert.id }, data: { sentAt: null } });
        }
      } else {
        const inStock = p.variants.length === 0 || p.variants.some((v) => v.stock > 0);
        if (!inStock) {
          await db.priceAlert.update({ where: { id: alert.id }, data: { sentAt: null } });
        }
      }
    }
  } catch (e) {
    console.error("[alerts] re-arm failed:", e);
  }
}
