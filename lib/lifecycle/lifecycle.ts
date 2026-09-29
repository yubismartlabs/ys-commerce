import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getEmailConfig } from "@/lib/email/send";
import { cartRecoveryEmail, reviewRequestEmail, winbackEmail } from "@/lib/email/templates";
import { notifyUser, sendAndLog } from "@/lib/notifications/notify";
import { buyerPrefs } from "@/lib/lifecycle/prefs";

const round = (n: number) => Math.round(n * 100) / 100;

type SnapshotLine = { slug: string; title: string; image: string; price: number; qty: number };

function parseLines(value: unknown): SnapshotLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is SnapshotLine => !!l && typeof l === "object" && typeof (l as SnapshotLine).slug === "string")
    .slice(0, 50);
}

async function emailedRecently(to: string, template: string, sinceHours: number): Promise<boolean> {
  const hit = await db.emailLog.findFirst({
    where: { to, template, createdAt: { gt: new Date(Date.now() - sinceHours * 3600000) } },
    select: { id: true },
  });
  return !!hit;
}

// ---------------------------------------------------------------------------
// Abandoned carts: snapshot 24h–7d old, buyer placed no order since.
// ---------------------------------------------------------------------------
async function runCartRecovery(): Promise<number> {
  const config = await getEmailConfig();
  if (!config.enabled) return 0;
  const now = Date.now();
  const snaps = await db.cartSnapshot.findMany({
    where: { updatedAt: { lt: new Date(now - 24 * 3600000), gt: new Date(now - 7 * 24 * 3600000) } },
    take: 200,
  });
  let sent = 0;
  for (const snap of snaps) {
    const prefs = await buyerPrefs(snap.userId);
    if (!prefs.lifecycle) continue;
    const user = await db.user.findUnique({ where: { id: snap.userId }, select: { email: true } });
    if (!user) continue;
    const ordered = await db.order.findFirst({
      where: { buyerId: snap.userId, createdAt: { gt: snap.updatedAt } },
      select: { id: true },
    });
    if (ordered) {
      await db.cartSnapshot.delete({ where: { userId: snap.userId } });
      continue;
    }
    if (await emailedRecently(user.email, "cart_recovery", 7 * 24)) continue;
    const lines = parseLines(snap.items);
    if (lines.length === 0) {
      await db.cartSnapshot.delete({ where: { userId: snap.userId } });
      continue;
    }
    const total = round(lines.reduce((a, l) => a + l.price * l.qty, 0));
    const result = await sendAndLog({
      to: user.email,
      template: cartRecoveryEmail({ siteName: config.siteName, lines, total }),
      meta: { template: "cart_recovery" },
    });
    if (result.ok) {
      sent++;
      await notifyUser({
        userId: snap.userId,
        type: "cart.recovery",
        title: "Your cart misses you",
        body: `${lines.length} item(s) waiting — ${total.toFixed(2)} estimated.`,
        link: "/cart",
      });
      await db.cartSnapshot.delete({ where: { userId: snap.userId } });
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Review requests: delivered 3+ days ago with unreviewed lines, asked monthly.
// ---------------------------------------------------------------------------
async function runReviewRequests(): Promise<number> {
  const config = await getEmailConfig();
  if (!config.enabled) return 0;
  const orders = await db.order.findMany({
    where: { status: "DELIVERED", deliveredAt: { lte: new Date(Date.now() - 3 * 24 * 3600000) } },
    include: { items: { select: { productId: true, title: true, product: { select: { slug: true } } } } },
    take: 200,
    orderBy: { deliveredAt: "desc" },
  });
  let sent = 0;
  for (const order of orders) {
    const prefs = await buyerPrefs(order.buyerId);
    if (!prefs.lifecycle) continue;
    const reviewed = await db.review.findMany({
      where: { authorId: order.buyerId, productId: { in: order.items.map((i) => i.productId) } },
      select: { productId: true },
    });
    const reviewedIds = new Set(reviewed.map((r) => r.productId));
    const pending = order.items.filter((i) => !reviewedIds.has(i.productId));
    if (pending.length === 0) continue;
    const user = await db.user.findUnique({ where: { id: order.buyerId }, select: { email: true } });
    if (!user) continue;
    const asked = await db.emailLog.findFirst({
      where: {
        to: user.email,
        template: "review_request",
        meta: { path: ["orderId"], equals: order.id },
        createdAt: { gt: new Date(Date.now() - 30 * 24 * 3600000) },
      },
      select: { id: true },
    });
    if (asked) continue;
    const result = await sendAndLog({
      to: user.email,
      template: reviewRequestEmail({
        siteName: config.siteName,
        items: pending.map((i) => ({ title: i.title, slug: i.product.slug })),
      }),
      meta: { template: "review_request", orderId: order.id },
    });
    if (result.ok) {
      sent++;
      await notifyUser({
        userId: order.buyerId,
        type: "review.requested",
        title: "How was your order?",
        body: `${pending.length} item(s) waiting for a review.`,
        link: `/account/orders/${order.number}`,
      });
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Win-back: 30d+ dormant buyers get a single-use $5 coupon (once ever).
// ---------------------------------------------------------------------------
async function runWinback(): Promise<number> {
  const config = await getEmailConfig();
  if (!config.enabled) return 0;
  const cutoff = new Date(Date.now() - 30 * 24 * 3600000);
  const buyers = await db.order.groupBy({
    by: ["buyerId"],
    _max: { createdAt: true },
  });
  let sent = 0;
  for (const b of buyers.slice(0, 200)) {
    if (!b._max.createdAt || b._max.createdAt > cutoff) continue;
    const prefs = await buyerPrefs(b.buyerId);
    if (!prefs.lifecycle) continue;
    const used = await db.couponRedemption.findFirst({
      where: { userId: b.buyerId, coupon: { code: { startsWith: "WINBACK" } } },
      select: { id: true },
    });
    if (used) continue;
    const user = await db.user.findUnique({ where: { id: b.buyerId }, select: { email: true } });
    if (!user) continue;
    if (await emailedRecently(user.email, "winback", 90 * 24)) continue;

    const code = `WINBACK-${randomBytes(3).toString("hex").toUpperCase()}`;
    await db.coupon.create({
      data: {
        code,
        type: "FIXED",
        amountOff: 5,
        minSubtotal: 20,
        perUserLimit: 1,
        endsAt: new Date(Date.now() + 30 * 24 * 3600000),
      },
    });
    const result = await sendAndLog({
      to: user.email,
      template: winbackEmail({ siteName: config.siteName, code, amount: 5 }),
      meta: { template: "winback", code },
    });
    if (result.ok) {
      sent++;
      await notifyUser({
        userId: b.buyerId,
        type: "coupon.winback",
        title: "$5 off — welcome back",
        body: `Code ${code}, single use.`,
        link: "/account",
      });
    } else {
      await db.coupon.delete({ where: { code } }).catch(() => {});
    }
  }
  return sent;
}

export type LifecycleResult = {
  cartRecovery: number;
  reviewRequests: number;
  winback: number;
};

/** Full lifecycle pass for the ops scheduler. Idempotent per channel. */
export async function runLifecycle(): Promise<LifecycleResult> {
  const [cartRecovery, reviewRequests, winback] = await Promise.all([
    runCartRecovery().catch((e) => {
      console.error("[lifecycle] cart recovery failed", e);
      return 0;
    }),
    runReviewRequests().catch((e) => {
      console.error("[lifecycle] review requests failed", e);
      return 0;
    }),
    runWinback().catch((e) => {
      console.error("[lifecycle] winback failed", e);
      return 0;
    }),
  ]);
  return { cartRecovery, reviewRequests, winback };
}
