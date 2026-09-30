import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { getAiConfig } from "@/lib/ai/config";
import { getActiveDeal } from "@/lib/deals/pricing";
import { toCitation } from "@/lib/ai/context";

/** Buy-again picks from the buyer's own order history (quota-free). */
export async function GET() {
  const session = await auth().catch(() => null);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to use the shopping assistant.", 401);

  const cfg = await getAiConfig();
  if (!cfg.enabled) return fail("DISABLED", "Shopping assistant is off.", 503);

  const items = await db.orderItem.findMany({
    where: { order: { buyerId: userId }, product: { status: "ACTIVE" } },
    orderBy: { order: { createdAt: "desc" } },
    select: {
      product: {
        select: {
          id: true, slug: true, title: true, price: true, compareAt: true, image: true,
          ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
          freeShipping: true, brand: true, category: true,
          store: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    take: 20,
  });
  const seen = new Set<string>();
  const picks: ReturnType<typeof toCitation>[] = [];
  for (const it of items) {
    const p = it.product;
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    if (picks.length >= 4) break;
    const deal = await getActiveDeal(p.id);
    picks.push(toCitation(p, deal ? Number(deal.dealPrice) : null, p.store));
  }
  return ok(picks);
}
