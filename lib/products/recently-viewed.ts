import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Per-buyer browse history for My YS -> Activity -> Recently viewed.
 *
 * Two properties matter and both are enforced here rather than at the call
 * site:
 *  - ONE row per (buyer, product). Re-viewing bumps `viewedAt` instead of
 *    appending, so the list is a recency order and the table cannot grow with
 *    traffic. The unique index would reject the insert; the upsert is what
 *    makes it an update.
 *  - CAPPED at 50. Pruning runs in the same transaction as the write, with a
 *    little headroom so an everyday view does not pay for a DELETE every time.
 */

/** How many products a buyer keeps. */
export const MAX_RECENT = 50;

/** Prune only once the table drifts past this, so the common path is write-only. */
const PRUNE_SLACK = 10;

/**
 * Record a view. Never throws: a failed history write must not take down a
 * product page, so failures are logged and swallowed.
 *
 * Skips a seller viewing their own listing — it is never something they came
 * back to look at, and it would sit at the top of their own list.
 */
export async function recordProductView(userId: string, productId: string, ownerId?: string): Promise<void> {
  if (userId === ownerId) return;
  try {
    await db.$transaction(async (tx) => {
      await tx.productView.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId },
        update: { viewedAt: new Date() },
      });

      const count = await tx.productView.count({ where: { userId } });
      if (count <= MAX_RECENT + PRUNE_SLACK) return;

      // Keep the newest MAX_RECENT for this buyer. Cascading from both sides
      // means a deleted listing cannot keep a row alive on its own.
      await tx.productView.deleteMany({
        where: {
          userId,
          id: {
            notIn: (
              await tx.productView.findMany({
                where: { userId },
                orderBy: { viewedAt: "desc" },
                take: MAX_RECENT,
                select: { id: true },
              })
            ).map((r) => r.id),
          },
        },
      });
    });
  } catch (e) {
    log.error("recently-viewed write failed", { userId, productId, err: e });
  }
}

/** Newest first, with just enough product detail to render a card. */
export async function listRecentViews(userId: string) {
  return db.productView.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    take: MAX_RECENT,
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          image: true,
          price: true,
          status: true,
          store: { select: { name: true, slug: true } },
        },
      },
    },
  });
}