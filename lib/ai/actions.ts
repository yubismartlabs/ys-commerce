import { db } from "@/lib/db";
import { getActiveDeal } from "@/lib/deals/pricing";
import { toCitation, type AiCitation } from "@/lib/ai/context";

export type AlertOutcome = {
  reply: string;
  citations: AiCitation[];
  /** True when the reply asks a follow-up (also quota-free). */
  asked?: boolean;
};

const SLUG_RE = /\(?\b([a-z0-9]+(?:-[a-z0-9]+)*-\d+)\b\)?/i;
const PRICE_RE = /\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks|usd)/i;
const BARE_PRICE_RE = /^\$?\s*(\d+(?:\.\d{1,2})?)\s*$/;

const ALERT_WORDS = /(alert|notify|notifi|tell me|let me know|watch|track|heads.?up)/i;
const PRICE_WORDS = /(price|drop|below|under|cost|deal|sale|cheaper)/i;
const RESTOCK_WORDS = /(restock|back in stock|available again|in stock)/i;

/** Resolve which product the buyer means: explicit slug > focus > sole citation. */
function pickSlug(text: string, focusSlug: string | undefined, citations: AiCitation[]): string | null {
  const mention = text.match(SLUG_RE)?.[1]?.toLowerCase();
  if (mention) return mention;
  if (focusSlug) return focusSlug.toLowerCase();
  if (citations.length === 1) return citations[0].slug.toLowerCase();
  return null;
}

function priceOf(text: string): number | null {
  const m = text.match(PRICE_RE);
  if (!m) return null;
  const v = Number(m[1] ?? m[2]);
  return Number.isFinite(v) && v > 0 && v <= 1000000 ? Math.round(v * 100) / 100 : null;
}

async function loadProduct(slug: string) {
  const p = await db.product.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, price: true, compareAt: true, image: true,
      ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
      freeShipping: true, status: true, trackStock: true, stock: true,
      variants: { select: { stock: true } },
      store: { select: { id: true, name: true, slug: true } },
    },
  });
  return p && p.status === "ACTIVE" ? p : null;
}

/**
 * Agentic price/restock alerts without spending model credits. Returns null
 * when the message isn't an alert request (caller falls through to the LLM).
 */
export async function tryAlertAction(opts: {
  userId: string;
  text: string;
  focusSlug?: string;
  citations: AiCitation[];
  lastAssistantText?: string | null;
}): Promise<AlertOutcome | null> {
  const { userId, text } = opts;
  const wantsAlert = ALERT_WORDS.test(text) && (PRICE_WORDS.test(text) || RESTOCK_WORDS.test(text));

  // Bare "$18" completing a pending "below what price?" question.
  const bare = text.match(BARE_PRICE_RE)?.[1];
  if (bare && !wantsAlert && opts.lastAssistantText && /below what price/i.test(opts.lastAssistantText)) {
    const slug = opts.lastAssistantText.match(SLUG_RE)?.[1]?.toLowerCase();
    const target = Number(bare);
    if (slug && Number.isFinite(target) && target > 0) {
      return armPriceDrop(userId, slug, target);
    }
  }

  if (!wantsAlert) return null;

  const slug = pickSlug(text, opts.focusSlug, opts.citations);
  if (!slug) {
    const names = opts.citations.slice(0, 3).map((c) => `**${c.title}** (${c.slug})`);
    return {
      reply:
        names.length > 0
          ? `Which product should I watch? ${names.join(", ")} — reply with the name, or say "alert me when it drops below $X".`
          : `Which product should I watch for a price drop? Open it first, or tell me its name.`,
      citations: opts.citations,
      asked: true,
    };
  }

  if (RESTOCK_WORDS.test(text) && !PRICE_WORDS.test(text)) {
    return armRestock(userId, slug);
  }

  const target = priceOf(text);
  if (target == null) {
    const p = await loadProduct(slug);
    if (!p) return null;
    const deal = await getActiveDeal(p.id);
    const now = deal ? Number(deal.dealPrice) : Number(p.price);
    return {
      reply: `Below what price should I watch **${p.title}** (${p.slug})? It's $${now.toFixed(2)} right now — reply with a number like $${Math.max(1, Math.round(now * 0.9))}.`,
      citations: [toCitation(p, deal ? Number(deal.dealPrice) : null, p.store)],
      asked: true,
    };
  }
  return armPriceDrop(userId, slug, target);
}

async function armPriceDrop(userId: string, slug: string, target: number): Promise<AlertOutcome | null> {
  const p = await loadProduct(slug);
  if (!p) return null;
  const deal = await getActiveDeal(p.id);
  const now = deal ? Number(deal.dealPrice) : Number(p.price);
  const citation = toCitation(p, deal ? Number(deal.dealPrice) : null, p.store);
  if (target >= now) {
    return {
      reply: `Good news — **${p.title}** (${p.slug}) is already $${now.toFixed(2)}, below your $${target.toFixed(2)} target. No alert needed.`,
      citations: [citation],
    };
  }
  const existing = await db.priceAlert.findFirst({
    where: { userId, productId: p.id, kind: "PRICE_DROP" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await db.priceAlert.update({ where: { id: existing.id }, data: { target, sentAt: null } });
  } else {
    await db.priceAlert.create({ data: { userId, productId: p.id, kind: "PRICE_DROP", target } });
  }
  return {
    reply: `Done — I'll email you when **${p.title}** (${p.slug}) drops below $${target.toFixed(2)}. It's $${now.toFixed(2)} today. You can change it anytime from your watchlist.`,
    citations: [citation],
  };
}

async function armRestock(userId: string, slug: string): Promise<AlertOutcome | null> {
  const p = await loadProduct(slug);
  if (!p) return null;
  const citation = toCitation(p, null, p.store);
  const outOfStock =
    (p.variants.length > 0 && p.variants.every((v) => v.stock <= 0)) ||
    (p.variants.length === 0 && p.trackStock && p.stock <= 0);
  if (!outOfStock) {
    return {
      reply: `Good news — **${p.title}** (${p.slug}) is in stock right now, so no alert needed.`,
      citations: [citation],
    };
  }
  const existing = await db.priceAlert.findFirst({
    where: { userId, productId: p.id, kind: "RESTOCK", sentAt: null },
  });
  if (!existing) {
    await db.priceAlert.create({ data: { userId, productId: p.id, kind: "RESTOCK" } });
  }
  return {
    reply: `Done — I'll email you the moment **${p.title}** (${p.slug}) is back in stock.`,
    citations: [citation],
  };
}
