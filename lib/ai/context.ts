import { db } from "@/lib/db";
import { searchProducts } from "@/lib/search/engine";
import { getActiveDeal } from "@/lib/deals/pricing";
import { safeImageSrc } from "@/lib/images";

export type AiCitation = {
  slug: string;
  title: string;
  price: number;
  image: string;
  ratingAvg: number;
  compareAt: number | null;
  soldCount: number;
  ratingCount: number;
  badge: string | null;
  freeShipping: boolean;
};

export type AiContext = { text: string; citations: AiCitation[] };

const clip = (s: string | null | undefined, n: number) =>
  (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Truncated Q&A + review snippets for one product. */
async function productSnippets(productId: string): Promise<string> {
  const [reviews, qa] = await Promise.all([
    db.review.findMany({
      where: { productId },
      orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
      select: { rating: true, title: true, body: true },
      take: 5,
    }),
    db.productQuestion.findMany({
      where: { productId, hidden: false },
      orderBy: { createdAt: "desc" },
      select: { body: true, answers: { select: { body: true, fromSeller: true }, take: 2, orderBy: { createdAt: "asc" } } },
      take: 3,
    }),
  ]);
  const r = reviews.map((v) => `[${v.rating}★] ${clip(v.title, 60)}: ${clip(v.body, 160)}`).join(" | ");
  const q = qa
    .map((t) => `Q: ${clip(t.body, 120)} A: ${t.answers.map((a) => clip(a.body, 140)).join(" / ") || "—"}`)
    .join(" | ");
  return `reviews: ${r || "none"} || q&a: ${q || "none"}`;
}

/**
 * Retrieve-then-stuff context for the model. Deliberately small: top hits,
 * one focused product, recent user signals. Keeps free-tier tokens low.
 */
export async function buildAiContext(opts: {
  userId: string;
  productSlug?: string;
  searchQuery?: string;
  lastUserText: string;
}): Promise<AiContext> {
  const citations: AiCitation[] = [];
  const parts: string[] = [];

  // Focused product (from drawer context or slug mentioned in the question).
  const slugMatch = opts.productSlug ?? opts.lastUserText.match(/\(?([a-z0-9]+-[0-9]+)\)?/i)?.[1];
  if (slugMatch) {
    const p = await db.product.findUnique({
      where: { slug: slugMatch },
      include: { store: { select: { name: true } }, variants: { select: { name: true, price: true, stock: true }, take: 5 } },
    });
    if (p && p.status === "ACTIVE") {
      const deal = await getActiveDeal(p.id);
      const history = await db.priceSnapshot.findMany({
        where: { productId: p.id },
        orderBy: { createdAt: "desc" },
        select: { price: true, createdAt: true },
        take: 5,
      });
      const snip = await productSnippets(p.id);
      parts.push(
        `FOCUS PRODUCT: ${p.title} (${p.slug}) $${Number(p.price)}${p.compareAt ? ` was $${Number(p.compareAt)}` : ""}` +
          ` rating ${p.ratingAvg} (${p.ratingCount}) sold ${p.soldCount} store ${p.store.name}` +
          `${deal ? ` DEAL $${Number(deal.dealPrice)} ends ${deal.endsAt.toISOString()}` : ""}` +
          `${history.length ? ` price-history ${history.map((h) => `$${Number(h.price)}`).join(">")}` : ""}` +
          ` desc: ${clip(p.description, 300)} || ${snip}`
      );
      citations.push({
        slug: p.slug,
        title: p.title,
        price: deal ? Number(deal.dealPrice) : Number(p.price),
        image: safeImageSrc(p.image),
        ratingAvg: p.ratingAvg,
        compareAt: deal ? Number(p.price) : p.compareAt === null ? null : Number(p.compareAt),
        soldCount: p.soldCount,
        ratingCount: p.ratingCount,
        badge: p.badge,
        freeShipping: p.freeShipping,
      });
    }
  }

  // Advisory search: run the real engine so recommendations are catalog-true.
  const q = (opts.searchQuery ?? "").trim() || opts.lastUserText.slice(0, 120);
  if (q.length >= 2) {
    try {
      const { hits } = await searchProducts(q, {}, 1, 5);
      if (hits.length > 0) {
        parts.push(
          `SEARCH "${clip(q, 80)}": ` +
            hits.map((h) => `${h.title} (${h.slug}) $${h.price} ★${h.ratingAvg} sold ${h.soldCount}`).join(" | ")
        );
        for (const h of hits.slice(0, 3)) {
          if (!citations.some((c) => c.slug === h.slug)) {
            citations.push({
              slug: h.slug,
              title: h.title,
              price: h.price,
              image: safeImageSrc(h.image),
              ratingAvg: h.ratingAvg,
              compareAt: h.compareAt,
              soldCount: h.soldCount,
              ratingCount: h.ratingCount,
              badge: h.badge,
              freeShipping: h.freeShipping,
            });
          }
        }
      }
    } catch {
      // Search must never break the assistant.
    }
  }

  // Personal signals (signed-in only route, so these are the buyer's own rows).
  const [orders, wishlist] = await Promise.all([
    db.order.findMany({
      where: { buyerId: opts.userId },
      orderBy: { createdAt: "desc" },
      select: { number: true, status: true, total: true, createdAt: true },
      take: 3,
    }),
    db.wishlistItem.findMany({
      where: { userId: opts.userId },
      orderBy: { createdAt: "desc" },
      select: { product: { select: { slug: true, title: true, price: true } } },
      take: 5,
    }),
  ]);
  if (orders.length > 0) {
    parts.push(`BUYER ORDERS: ${orders.map((o) => `${o.number} ${o.status} $${Number(o.total)}`).join(" | ")}`);
  }
  if (wishlist.length > 0) {
    parts.push(`WATCHLIST: ${wishlist.map((w) => `${w.product.title} (${w.product.slug}) $${Number(w.product.price)}`).join(" | ")}`);
  }

  const liveDeals = await db.deal.findMany({
    where: { status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
    select: { product: { select: { slug: true, title: true } }, dealPrice: true, endsAt: true },
    take: 3,
  });
  if (liveDeals.length > 0) {
    parts.push(`LIVE DEALS: ${liveDeals.map((d) => `${d.product.title} (${d.product.slug}) $${Number(d.dealPrice)}`).join(" | ")}`);
  }

  return { text: parts.join("\n").slice(0, 4000), citations: citations.slice(0, 6) };
}
