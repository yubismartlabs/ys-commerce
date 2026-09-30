import { db } from "@/lib/db";
import { normalizeCategory } from "@/lib/categories";

/**
 * Full-text + typo-tolerant product search (Postgres tsvector + pg_trgm).
 *
 * Ranking: ts_rank_cd over weighted vectors (title A, category B,
 * description C), blended with trigram similarity so typos ("blutooth")
 * still match. Synonym expansion widens recall (sneakers ↔ shoes).
 */

// Bidirectional-ish synonym map (lowercase, single tokens).
const SYNONYMS: Record<string, string[]> = {
  sneakers: ["shoes", "trainers"],
  shoes: ["sneakers"],
  earbuds: ["earphones", "headphones"],
  headphones: ["earphones", "earbuds"],
  watch: ["smartwatch"],
  smartwatch: ["watch"],
  lamp: ["lights", "lighting"],
  dress: ["gown", "frock"],
  sofa: ["couch"],
  tv: ["television"],
  phone: ["smartphone", "mobile"],
  laptop: ["notebook"],
  keyboard: ["keypad"],
  backpack: ["rucksack", "bag"],
  serum: ["skincare"],
};

const STOP = new Set(["the", "a", "an", "for", "with", "and", "or", "of", "in", "on", "to"]);

export function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .slice(0, 10);
}

/** Build a tsquery string: (tok | syn…) & (…) — AND across terms, OR within. */
export function buildTsQuery(q: string): string | null {
  const tokens = tokenize(q);
  if (tokens.length === 0) return null;
  return tokens
    .map((t) => {
      const alts = [t, ...(SYNONYMS[t] ?? [])].map((w) => `'${w}'`).join(" | ");
      return `(${alts})`;
    })
    .join(" & ");
}

export type SearchFilters = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  minRating?: number;
  badge?: string;
  deals?: boolean;
  sort?: "relevance" | "newest" | "price_asc" | "price_desc" | "rating" | "sold";
};

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  compareAt: number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  badge: string | null;
  freeShipping: boolean;
  category: string;
  brand: string | null;
  rank: number;
};

const CARD_SELECT = `
  p."id", p."slug", p."title", p."image", p."price", p."compareAt",
  p."ratingAvg", p."ratingCount", p."soldCount", p."badge", p."freeShipping", p."category", p."brand"
`;

function filterClauses(f: SearchFilters, params: unknown[]): string {
  const clauses = [`p."status" = 'ACTIVE'`];
  const category = normalizeCategory(f.category);
  if (category) {
    // Case-insensitive: Product.category is free text and sellers type it
    // inconsistently ("Home", "home & garden"). Match on the normalized slug.
    params.push(category);
    clauses.push(`LOWER(REPLACE(REPLACE(p."category", ' & ', '-'), ' ', '-')) = $${params.length}`);
  }
  if (f.minPrice !== undefined) {
    params.push(f.minPrice);
    clauses.push(`p."price" >= $${params.length}`);
  }
  if (f.maxPrice !== undefined) {
    params.push(f.maxPrice);
    clauses.push(`p."price" <= $${params.length}`);
  }
  if (f.freeShipping) clauses.push(`p."freeShipping" = true`);
  if (f.minRating) {
    params.push(f.minRating);
    clauses.push(`p."ratingAvg" >= $${params.length}`);
  }
  if (f.badge) {
    params.push(f.badge);
    clauses.push(`p."badge" = $${params.length}`);
  }
  if (f.deals) {
    clauses.push(`EXISTS (SELECT 1 FROM "Deal" d WHERE d."productId" = p."id" AND d."status" = 'ACTIVE' AND d."startsAt" <= NOW() AND d."endsAt" > NOW())`);
  }
  return clauses.join(" AND ");
}
const SORT_SQL: Record<string, string> = {
  newest: `p."createdAt" DESC`,
  price_asc: `p."price" ASC`,
  price_desc: `p."price" DESC`,
  rating: `p."ratingAvg" DESC, p."ratingCount" DESC`,
  sold: `p."soldCount" DESC`,
};

function mapHit(r: Record<string, unknown>): SearchHit {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    image: String(r.image),
    price: Number(r.price),
    compareAt: r.compareAt === null ? null : Number(r.compareAt),
    ratingAvg: Number(r.ratingAvg),
    ratingCount: Number(r.ratingCount),
    soldCount: Number(r.soldCount),
    badge: (r.badge as string | null) ?? null,
    freeShipping: Boolean(r.freeShipping),
    category: String(r.category ?? ""),
    brand: (r.brand as string | null) ?? null,
    rank: Number(r.rank ?? 0),
  };
}

/**
 * Ranked search. Returns hits + total + (on zero hits) closest titles for
 * did-you-mean. Relevance blends ts_rank_cd with word-level trigram
 * similarity, so typos ("blutooth") match the right word ("bluetooth")
 * without long titles diluting the score.
 */
export async function searchProducts(
  q: string,
  f: SearchFilters,
  page: number,
  pageSize: number
): Promise<{ hits: SearchHit[]; total: number; suggestion: string[] }> {
  const tsq = buildTsQuery(q);
  const params: unknown[] = [];
  const where = filterClauses(f, params);
  const skip = (page - 1) * pageSize;
  const lowered = q.toLowerCase().trim().slice(0, 120);
  const words = tokenize(q).join(" ");

  if (!tsq) {
    // No usable terms — fall back to filtered browse.
    const order = SORT_SQL[f.sort ?? "newest"] ?? SORT_SQL.newest;
    const count = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "Product" p WHERE ${where}`,
      ...params
    )) as Array<{ c: number }>;
    const rows = (await db.$queryRawUnsafe(
      `SELECT ${CARD_SELECT}, 0 AS rank FROM "Product" p WHERE ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${skip}`,
      ...params
    )) as Array<Record<string, unknown>>;
    return { hits: rows.map(mapHit), total: count[0]?.c ?? 0, suggestion: [] };
  }

  params.push(tsq, lowered, words);
  const tsIdx = params.length - 2;
  const rawIdx = params.length - 1;
  const wordsIdx = params.length;
  const sim = `similarity(lower(p."title"), $${rawIdx})`;
  const wsim = `word_similarity(lower(p."title"), $${rawIdx})`;
  // Word-level typo match: any query word ≈ any title word (len ≥ 4).
  const wordMatch = `EXISTS (SELECT 1 FROM regexp_split_to_table(lower(p."title"), '[^a-z0-9]+') AS tw CROSS JOIN regexp_split_to_table($${wordsIdx}, ' ') AS qw WHERE char_length(tw) >= 4 AND char_length(qw) >= 4 AND similarity(tw, qw) > 0.4)`;
  const wordMax = `COALESCE((SELECT MAX(similarity(tw, qw)) FROM regexp_split_to_table(lower(p."title"), '[^a-z0-9]+') AS tw CROSS JOIN regexp_split_to_table($${wordsIdx}, ' ') AS qw WHERE char_length(tw) >= 4 AND char_length(qw) >= 4), 0)`;
  const match = `(p."search" @@ to_tsquery('english', $${tsIdx}) OR ${sim} > 0.15 OR ${wsim} > 0.35 OR ${wordMatch})`;
  const rank = `(0.65 * ts_rank_cd(p."search", to_tsquery('english', $${tsIdx})) + 0.2 * ${wsim} + 0.05 * ${sim} + 0.1 * ${wordMax})`;
  const order = f.sort && f.sort !== "relevance" ? `${SORT_SQL[f.sort]}, rank DESC` : `rank DESC`;

  const count = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "Product" p WHERE ${where} AND ${match}`,
    ...params
  )) as Array<{ c: number }>;
  const total = count[0]?.c ?? 0;

  let suggestion: string[] = [];
  if (total === 0) {
    // Did-you-mean: closest titles by word similarity (filters ignored).
    const near = (await db.$queryRawUnsafe(
      `SELECT p."title" FROM "Product" p WHERE p."status" = 'ACTIVE' ORDER BY word_similarity(lower(p."title"), $${rawIdx}) DESC LIMIT 3`,
      ...params
    )) as Array<{ title: string }>;
    suggestion = near.filter((n) => n.title.toLowerCase() !== lowered).map((n) => n.title);
  }

  const rows = (await db.$queryRawUnsafe(
    `SELECT ${CARD_SELECT}, ${rank} AS rank FROM "Product" p WHERE ${where} AND ${match} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${skip}`,
    ...params
  )) as Array<Record<string, unknown>>;
  return { hits: rows.map(mapHit), total, suggestion };
}

/** Facets for the current query (categories + price bounds). */
export async function searchFacets(q: string): Promise<{
  categories: Array<{ category: string; count: number }>;
  priceMin: number | null;
  priceMax: number | null;
}> {
  const tsq = buildTsQuery(q);
  const lowered = q.toLowerCase().trim().slice(0, 120);
  const words = tokenize(q).join(" ");
  const params: unknown[] = [];
  // Facets respect the query but not the faceted filters themselves.
  let where = `p."status" = 'ACTIVE'`;
  if (tsq) {
    params.push(tsq, lowered, words);
    const t = params.length - 2;
    const r = params.length - 1;
    const w = params.length;
    where += ` AND (p."search" @@ to_tsquery('english', $${t}) OR similarity(lower(p."title"), $${r}) > 0.15 OR word_similarity(lower(p."title"), $${r}) > 0.35 OR EXISTS (SELECT 1 FROM regexp_split_to_table(lower(p."title"), '[^a-z0-9]+') AS tw CROSS JOIN regexp_split_to_table($${w}, ' ') AS qw WHERE char_length(tw) >= 4 AND char_length(qw) >= 4 AND similarity(tw, qw) > 0.4))`;
  }
  const cats = (await db.$queryRawUnsafe(
    `SELECT p."category" AS category, COUNT(*)::int AS count FROM "Product" p WHERE ${where} GROUP BY p."category" ORDER BY count DESC`,
    ...params
  )) as Array<{ category: string; count: number }>;
  const bounds = (await db.$queryRawUnsafe(
    `SELECT MIN(p."price") AS lo, MAX(p."price") AS hi FROM "Product" p WHERE ${where}`,
    ...params
  )) as Array<{ lo: unknown; hi: unknown }>;
  return {
    categories: cats,
    priceMin: bounds[0]?.lo === null ? null : Number(bounds[0]?.lo ?? null),
    priceMax: bounds[0]?.hi === null ? null : Number(bounds[0]?.hi ?? null),
  };
}

export type Suggestion = { type: "product" | "category" | "query"; text: string; meta?: string };

/** Autocomplete: matching products + categories + popular past queries. */
export async function suggest(prefix: string): Promise<Suggestion[]> {
  const p = prefix.trim().toLowerCase().slice(0, 60);
  if (p.length < 2) return [];
  const out: Suggestion[] = [];
  const products = await db.product.findMany({
    where: { status: "ACTIVE", title: { contains: p, mode: "insensitive" } },
    select: { title: true },
    take: 5,
  });
  for (const pr of products) out.push({ type: "product", text: pr.title });
  const cats = (await db.$queryRawUnsafe(
    `SELECT DISTINCT p."category" AS c FROM "Product" p WHERE p."status" = 'ACTIVE' AND p."category" ILIKE $1 LIMIT 3`,
    `%${p}%`
  )) as Array<{ c: string }>;
  for (const c of cats) out.push({ type: "category", text: c.c });
  const popular = await db.searchLog.groupBy({
    by: ["query"],
    where: { query: { startsWith: p, mode: "insensitive" }, createdAt: { gt: new Date(Date.now() - 30 * 86400000) } },
    _count: true,
    orderBy: { _count: { query: "desc" } },
    take: 4,
  });
  for (const s of popular) {
    if (!out.some((o) => o.text.toLowerCase() === s.query.toLowerCase())) {
      out.push({ type: "query", text: s.query, meta: `${s._count} searches` });
    }
  }
  return out.slice(0, 10);
}

/** Fire-and-forget search logging (never slows results). */
export function logSearch(query: string, results: number, userId?: string): void {
  const q = query.trim().slice(0, 120);
  if (!q) return;
  void db.searchLog
    .create({ data: { query: q, results, userId } })
    .catch(() => {});
}
