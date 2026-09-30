import { db } from "@/lib/db";
import { searchProducts } from "@/lib/search/engine";
import { getActiveDeal } from "@/lib/deals/pricing";
import { pairsFor } from "@/lib/affinity/recompute";
import { parseSpecs } from "@/lib/products/ratings";
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
  brand: string | null;
  category: string;
  /** Seller identity for user-initiated quick-add (absent = cart groups as "Your items"). */
  storeId?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
};

export type AiContext = { text: string; citations: AiCitation[] };

const clip = (s: string | null | undefined, n: number) =>
  (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Seller tag vocabulary, cached: tag matching must not cost a scan per chat. */
let cachedTags: { tags: string[]; at: number } | null = null;
const TAGS_TTL_MS = 60_000;

async function knownTags(): Promise<string[]> {
  const now = Date.now();
  if (cachedTags && now - cachedTags.at < TAGS_TTL_MS) return cachedTags.tags;
  try {
    const rows = await db.product.findMany({ where: { status: "ACTIVE" }, select: { tags: true }, take: 500 });
    const set = new Set<string>();
    for (const r of rows) for (const t of r.tags) if (t.trim()) set.add(t.trim().toLowerCase());
    cachedTags = { tags: [...set], at: now };
    return cachedTags.tags;
  } catch {
    return cachedTags?.tags ?? [];
  }
}

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

type CardProduct = {
  slug: string;
  title: string;
  price: unknown;
  compareAt: unknown;
  image: string;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  badge: string | null;
  freeShipping: boolean;
  brand?: string | null;
  category?: string;
};

/** One shoppable citation, deal-aware (deal price wins, base becomes was). */
export function toCitation(
  p: CardProduct,
  dealPrice?: number | null,
  store?: { id: string; name: string; slug: string } | null
): AiCitation {
  return {
    slug: p.slug,
    title: p.title,
    price: dealPrice ?? Number(p.price),
    image: safeImageSrc(p.image),
    ratingAvg: p.ratingAvg,
    compareAt: dealPrice != null ? Number(p.price) : p.compareAt == null ? null : Number(p.compareAt),
    soldCount: p.soldCount,
    ratingCount: p.ratingCount,
    badge: p.badge,
    freeShipping: p.freeShipping,
    brand: p.brand ?? null,
    category: p.category ?? "",
    ...(store ? { storeId: store.id, storeName: store.name, storeSlug: store.slug } : {}),
  };
}

/**
 * Every (slug) the answer mentions becomes a card — even products the
 * retrieval pass missed. ACTIVE only, deduped, capped. This is what makes
 * "compare these three" render three cards instead of one.
 */
export async function resolveMentionedProducts(
  reply: string,
  existing: AiCitation[],
  limit = 9
): Promise<AiCitation[]> {
  const seen = new Set(existing.map((c) => c.slug.toLowerCase()));
  const slugs = [...new Set([...reply.matchAll(/\(?([a-z0-9]+(?:-[a-z0-9]+)*-\d+)\)?/gi)].map((m) => m[1].toLowerCase()))].filter(
    (s) => !seen.has(s)
  );
  const out = [...existing];
  for (const slug of slugs) {
    if (out.length >= limit) break;
    const p = await db.product.findUnique({
      where: { slug },
      select: {
        slug: true, title: true, price: true, compareAt: true, image: true,
        ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
        freeShipping: true, status: true, id: true, brand: true, category: true,
        store: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!p || p.status !== "ACTIVE") continue;
    const deal = await getActiveDeal(p.id);
    out.push(toCitation(p, deal ? Number(deal.dealPrice) : null, p.store));
  }
  return out;
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
      include: {
        store: { select: { id: true, name: true, slug: true, shippingPolicy: true, returnPolicy: true } },
        variants: { select: { name: true, price: true, stock: true }, take: 8 },
      },
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
      const specs = parseSpecs(p.specs)
        .slice(0, 8)
        .map((s) => `${s.k}: ${s.v}`)
        .join("; ");
      const stockLine =
        p.variants.length > 0
          ? `options: ${p.variants.map((v) => `${v.name}${v.price != null ? ` $${Number(v.price)}` : ""} (${v.stock > 0 ? `${v.stock} in stock` : "out of stock"})`).join("; ")}`
          : p.trackStock
            ? `stock: ${p.stock > 0 ? `${p.stock} in stock` : "out of stock"}`
            : `stock: not tracked`;
      parts.push(
        `FOCUS PRODUCT: ${p.title} (${p.slug}) $${Number(p.price)}${p.compareAt ? ` was $${Number(p.compareAt)}` : ""}` +
          ` rating ${p.ratingAvg} (${p.ratingCount}) sold ${p.soldCount} store ${p.store.name}` +
          `${p.brand ? ` brand ${p.brand}` : ""} category ${p.category}` +
          `${deal ? ` DEAL $${Number(deal.dealPrice)} ends ${deal.endsAt.toISOString()}` : ""}` +
          `${history.length ? ` price-history ${history.map((h) => `$${Number(h.price)}`).join(">")}` : ""}` +
          ` ${stockLine}` +
          `${specs ? ` specs: ${clip(specs, 400)}` : ""}` +
          `${p.store.shippingPolicy ? ` ship-policy: ${clip(p.store.shippingPolicy, 160)}` : ""}` +
          `${p.store.returnPolicy ? ` return-policy: ${clip(p.store.returnPolicy, 160)}` : ""}` +
          ` desc: ${clip(p.description, 300)} || ${snip}`
      );
      citations.push(
        toCitation(p, deal ? Number(deal.dealPrice) : null, p.store)
      );
      // Frequently-bought-together (real baskets; same-store fallback cold).
      // Mentioned slugs resolve to cards downstream, so pairings surface
      // automatically whenever the answer names them.
      try {
        let pairs = await pairsFor(p.id, 4);
        if (pairs.length === 0) {
          const fallback = await db.product.findMany({
            where: { status: "ACTIVE", storeId: p.storeId, id: { not: p.id } },
            orderBy: { soldCount: "desc" },
            select: {
              id: true, slug: true, title: true, price: true, compareAt: true, image: true,
              ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
              freeShipping: true, brand: true, category: true,
              store: { select: { id: true, name: true, slug: true } },
            },
            take: 2,
          });
          pairs = fallback.map((product) => ({ product, count: 0 }));
        }
        if (pairs.length > 0) {
          parts.push(
            `PAIRS WELL WITH: ` +
              pairs.map(({ product: b, count }) => `${b.title} (${b.slug}) $${Number(b.price)}${count > 0 ? ` (together in ${count} orders)` : ""}`).join(" | ")
          );
          for (const { product: b } of pairs) {
            if (citations.length >= 9 || citations.some((c) => c.slug === b.slug)) continue;
            const bDeal = await getActiveDeal(b.id);
            citations.push(toCitation(b, bDeal ? Number(bDeal.dealPrice) : null, b.store));
          }
        }
      } catch {
        // Affinity must never break the assistant.
      }
    }
  }

  // Advisory search: run the real engine so recommendations are catalog-true.
  // Nine hits feed the grouped sections; only the top five cost model tokens.
  const q = (opts.searchQuery ?? "").trim() || opts.lastUserText.slice(0, 120);
  if (q.length >= 2) {
    try {
      const { hits } = await searchProducts(q, {}, 1, 9);
      if (hits.length > 0) {
        parts.push(
          `SEARCH "${clip(q, 80)}": ` +
            hits.slice(0, 5).map((h) => `${h.title} (${h.slug}) $${h.price} ★${h.ratingAvg} sold ${h.soldCount}`).join(" | ")
        );
        for (const h of hits) {
          if (!citations.some((c) => c.slug === h.slug)) {
            citations.push(toCitation(h));
          }
        }
      }
    } catch {
      // Search must never break the assistant.
    }
  }

  // Use-case tag overlap (FTS column is off-limits, so this runs separately):
  // "offgrid setup" matches tag offgrid even when no title contains it.
  try {
    const words = new Set(opts.lastUserText.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
    const matched = (await knownTags()).filter((t) => words.has(t));
    if (matched.length > 0) {
      const tagged = await db.product.findMany({
        where: { status: "ACTIVE", tags: { hasSome: matched } },
        select: {
          slug: true, title: true, price: true, compareAt: true, image: true,
          ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
          freeShipping: true, brand: true, category: true,
        },
        take: 5,
      });
      const fresh = tagged.filter((p) => !citations.some((c) => c.slug === p.slug));
      if (fresh.length > 0) {
        parts.push(
          `TAG MATCH (${matched.join(",")}): ` +
            fresh.map((p) => `${p.title} (${p.slug}) $${Number(p.price)}`).join(" | ")
        );
        for (const p of fresh) {
          if (citations.length >= 9) break;
          citations.push(toCitation(p));
        }
      }
    }
  } catch {
    // Tag lookup must never break the assistant.
  }

  // Personal signals (signed-in only route, so these are the buyer's own rows).
  // Non-sensitive only: first name, tenure, order counts and watchlist — used
  // for greeting and personalization, never payment data or addresses.
  const [profile, orderStats, orders, wishlist] = await Promise.all([
    db.user.findUnique({ where: { id: opts.userId }, select: { name: true, createdAt: true } }),
    db.order.aggregate({ where: { buyerId: opts.userId }, _count: true, _sum: { total: true } }),
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
  const firstName = profile?.name?.split(" ")[0]?.slice(0, 30) || null;
  const memberYear = profile ? new Date(profile.createdAt).getFullYear() : null;
  parts.push(
    `BUYER: ${firstName ? `first name ${firstName}` : "name unknown"}` +
      `${memberYear ? `, member since ${memberYear}` : ""}` +
      `, ${orderStats._count} orders${orderStats._sum.total != null ? ` totaling $${Number(orderStats._sum.total).toFixed(0)}` : ""}` +
      `. Greet by first name when known; never reveal order numbers, totals or addresses unprompted.`
  );
  if (orders.length > 0) {
    parts.push(`BUYER ORDERS: ${orders.map((o) => `${o.number} ${o.status} $${Number(o.total)}`).join(" | ")}`);
  }
  if (wishlist.length > 0) {
    parts.push(`WATCHLIST: ${wishlist.map((w) => `${w.product.title} (${w.product.slug}) $${Number(w.product.price)}`).join(" | ")}`);
  }

  const [liveDeals, coupons, shipments] = await Promise.all([
    db.deal.findMany({
      where: { status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      select: { product: { select: { slug: true, title: true } }, dealPrice: true, endsAt: true },
      take: 3,
    }),
    db.coupon.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
      },
      select: { code: true, type: true, pctOff: true, amountOff: true, minSubtotal: true },
      take: 6,
    }),
    db.shipment.findMany({
      where: { order: { buyerId: opts.userId } },
      orderBy: { updatedAt: "desc" },
      select: {
        status: true, carrier: true, trackingNumber: true, shippedAt: true, deliveredAt: true,
        store: { select: { name: true } },
        order: { select: { number: true } },
      },
      take: 4,
    }),
  ]);
  if (liveDeals.length > 0) {
    parts.push(`LIVE DEALS: ${liveDeals.map((d) => `${d.product.title} (${d.product.slug}) $${Number(d.dealPrice)}`).join(" | ")}`);
  }
  if (coupons.length > 0) {
    parts.push(
      `COUPONS (suggest the best fit, never invent codes): ` +
        coupons
          .map((c) => {
            const off = c.type === "PERCENT" ? `${c.pctOff}% off` : c.type === "FIXED" ? `$${Number(c.amountOff)} off` : "free shipping";
            return `${c.code}: ${off}${c.minSubtotal != null ? ` min $${Number(c.minSubtotal)}` : ""}`;
          })
          .join(" | ")
    );
  }
  if (shipments.length > 0) {
    parts.push(
      `SHIPMENTS (buyer's own parcels, newest first): ` +
        shipments
          .map((s) => {
            const track = s.trackingNumber ? ` ${s.carrier ?? "carrier"} ${s.trackingNumber}` : "";
            const when = s.deliveredAt ? ` delivered ${new Date(s.deliveredAt).toISOString().slice(0, 10)}` : s.shippedAt ? ` shipped ${new Date(s.shippedAt).toISOString().slice(0, 10)}` : "";
            return `order ${s.order.number} [${s.store.name}] ${s.status}${track}${when}`;
          })
          .join(" | ")
    );
  }

  return { text: parts.join("\n").slice(0, 4400), citations: citations.slice(0, 9) };
}
