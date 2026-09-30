/**
 * Test-catalog import runner. See README.md first.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/import-catalog/run.ts --dry --limit 20
 *   npx tsx --tsconfig tsconfig.json scripts/import-catalog/run.ts --import --limit 100
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { db } from "@/lib/db";
import { normalize } from "./normalize";
import { TARGETS } from "./targets";
import type { NormalizedListing, RawListing } from "./types";
import * as amazon from "./sites/amazon";
import * as ebay from "./sites/ebay";
import * as aliexpress from "./sites/aliexpress";
import { JADEALS_TARGETS, listUrls as jadealsList } from "./sites/jadeals";

const ADAPTERS = { amazon, ebay, aliexpress };

/** House store per category — imports never impersonate real sellers. */
const STORE_BY_CATEGORY: Record<string, string> = {
  electronics: "techchoice-store",
  phones: "techchoice-store",
  fashion: "fashionforward",
  beauty: "fashionforward",
  home: "homeessentials",
  toys: "homeessentials",
  sports: "gadgethub",
  automotive: "gadgethub",
};

const PER_TARGET = 8;
/** Extra breathing room between search pages — rapid searches trip defenses. */
const SEARCH_GAP_MS = 15000;

async function collect(limit: number): Promise<{ raw: RawListing[]; stats: Record<string, number> }> {
  const raw: RawListing[] = [];
  const seen = new Set<string>();
  const stats: Record<string, number> = { searchOk: 0, searchBlocked: 0, productOk: 0, productMiss: 0, dupes: 0 };
  // Store-API targets first: structured JSON, one request per target.
  for (const t of JADEALS_TARGETS) {
    if (raw.length >= limit) break;
    try {
      const listings = await jadealsList(t, PER_TARGET);
      stats.searchOk++;
      console.log(`[jadeals ok] ${t.kind === "category" ? `cat ${t.id}` : `"${t.query}"`} -> ${listings.length} listings`);
      for (const l of listings) {
        if (raw.length >= limit) break;
        if (seen.has(l.externalId)) {
          stats.dupes++;
          continue;
        }
        seen.add(l.externalId);
        raw.push(l);
        stats.productOk++;
      }
    } catch (e) {
      stats.searchBlocked++;
      console.log(`[jadeals BLOCKED] ${t.kind === "category" ? t.id : t.query}: ${(e as Error).message}`);
    }
  }
  for (const t of TARGETS) {
    if (raw.length >= limit) break;
    const adapter = ADAPTERS[t.site];
    let urls: string[] = [];
    try {
      urls = await adapter.searchUrls(t.query, PER_TARGET);
      stats.searchOk++;
      console.log(`[search ok] ${t.site} "${t.query}" -> ${urls.length} urls`);
      await new Promise((r) => setTimeout(r, SEARCH_GAP_MS));
    } catch (e) {
      stats.searchBlocked++;
      console.log(`[search BLOCKED] ${t.site} "${t.query}": ${(e as Error).message}`);
      continue;
    }
    for (const url of urls) {
      if (raw.length >= limit) break;
      const listing = await adapter.fetchProduct(url);
      if (!listing) {
        stats.productMiss++;
        console.log(`[product miss] ${url.slice(0, 90)}`);
        continue;
      }
      if (seen.has(listing.externalId)) {
        stats.dupes++;
        continue;
      }
      seen.add(listing.externalId);
      raw.push(listing);
      stats.productOk++;
    }
  }
  return { raw, stats };
}

async function importRows(rows: NormalizedListing[]) {
  const stores = await db.store.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(stores.map((s) => [s.slug, s.id]));
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const storeId = bySlug.get(STORE_BY_CATEGORY[r.category] ?? "techchoice-store");
    if (!storeId) {
      console.log(`[skip] no store for ${r.category}: ${r.title.slice(0, 50)}`);
      continue;
    }
    // Partial unique index (WHERE NOT NULL) isn't a Prisma unique input — findFirst.
    const existing = await db.product.findFirst({ where: { externalId: r.externalId } }).catch(() => null);
    const data = {
      title: r.title,
      description: r.description,
      image: r.image,
      images: r.images,
      specs: r.specs as object,
      price: r.price,
      compareAt: r.compareAt,
      category: r.category,
      brand: r.brand,
      tags: r.tags,
      freeShipping: r.freeShipping,
      status: "ACTIVE" as const,
      storeId,
      source: r.source,
      sourceUrl: r.sourceUrl,
    };
    if (existing) {
      await db.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      // Slug space is shared with seller listings — retry with a suffix.
      let slug = r.slug;
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await db.product.findUnique({ where: { slug } }).catch(() => null);
        if (!clash) break;
        slug = `${r.slug}-${attempt + 2}`;
      }
      await db.product.create({
        data: {
          ...data,
          slug,
          externalId: r.externalId,
          variants:
            rawVariants(r).length > 0
              ? { create: rawVariants(r).map((v) => ({ name: v.name, price: v.price ?? null, stock: 0 })) }
              : undefined,
        },
      });
      created++;
    }
  }
  return { created, updated };
}

// Raw variants ride alongside normalized rows via a sidecar map.
const variantSidecar = new Map<string, Array<{ name: string; price?: number }>>();

function rawVariants(r: NormalizedListing): Array<{ name: string; price?: number }> {
  return variantSidecar.get(r.externalId) ?? [];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const limitArg = args.find((a) => a.startsWith("--limit"))?.split("=")[1] ?? args[args.indexOf("--limit") + 1];
  const limit = Math.min(200, Math.max(1, Number(limitArg) || 100));

  // Resume from a checkpoint without re-fetching (e.g. after a block).
  if (args.includes("--resume") && existsSync("scripts/import-catalog/last-run.json")) {
    const raw = JSON.parse(readFileSync("scripts/import-catalog/last-run.json", "utf8")) as RawListing[];
    console.log(`resuming with ${raw.length} checkpointed listings`);
    return finish(raw, dry);
  }

  console.log(`collecting (limit ${limit}, dry=${dry})...`);
  const { raw, stats } = await collect(limit);
  console.log("fetch stats:", JSON.stringify(stats));
  // Checkpoint: a block mid-run never loses fetched pages.
  try {
    writeFileSync("scripts/import-catalog/last-run.json", JSON.stringify(raw));
  } catch {
    // best effort
  }
  return finish(raw, dry);
}

async function finish(raw: RawListing[], dry: boolean) {

  let usable = 0;
  const normalized: NormalizedListing[] = [];
  for (const r of raw) {
    const n = normalize(r);
    if (!n) continue;
    usable++;
    variantSidecar.set(n.externalId, r.variants.slice(0, 8));
    normalized.push(n);
  }
  console.log(`usable: ${usable}/${raw.length}`);
  const byCategory: Record<string, number> = {};
  for (const n of normalized) byCategory[n.category] = (byCategory[n.category] ?? 0) + 1;
  console.log("by category:", JSON.stringify(byCategory));
  const noImage = normalized.filter((n) => n.images.length === 0).length;
  console.log(`image coverage: ${normalized.length - noImage}/${normalized.length} with images`);

  if (dry) {
    for (const n of normalized.slice(0, 10)) {
      console.log(`- [${n.source}] ${n.title.slice(0, 60)} $${n.price} ${n.category} brand=${n.brand ?? "-"} specs=${n.specs.length} imgs=${n.images.length}`);
    }
    await db.$disconnect();
    return;
  }

  const { created, updated } = await importRows(normalized);
  console.log(`imported: ${created} created, ${updated} updated`);
  await db.$disconnect();
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
