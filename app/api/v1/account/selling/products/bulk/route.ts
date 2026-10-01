import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { parseCsv, type CsvRow, validateBulkRows, validateUpdateRows, uniqueSlug } from "@/lib/products/bulk";
import { getSettingGroup } from "@/lib/server-settings";

/**
 * Bulk listing import.
 *
 * Validation is per-row so one bad line doesn't fail the whole file, and the
 * response reports exactly what was created and what was rejected with a line
 * number. Import is capped and transactional per chunk so a 5,000-row file
 * can't hold a connection open indefinitely.
 */

const MAX_ROWS = 500;
const MAX_BYTES = 2 * 1024 * 1024;

const bodySchema = z.object({
  /** "create" adds products; "update" edits existing ones by slug. */
  mode: z.enum(["create", "update"]).default("create"),
  csv: z.string().min(1, "Paste or upload a CSV."),
  /** Anything not in this list is rejected — a seller can't bulk-edit into another store. */
  storeId: z.string().min(1),
  /** Create-only: mark new listings ACTIVE immediately instead of DRAFT. */
  publish: z.boolean().optional(),
});

/**
 * Turn a Prisma write error into something a seller can act on.
 * Leaking "Unique constraint failed on the fields: (`sku`)" is technically
 * accurate and practically useless in an import report.
 */
function describeWriteFailure(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  const message = e instanceof Error ? e.message : "";

  if (code === "P2002") {
    const field = /fields:\s*\(([^)]+)\)/.exec(message)?.[1] ?? "value";
    if (field.toLowerCase().includes("sku")) {
      return "That SKU is already used by another product. SKUs must be unique — change it and re-import these rows.";
    }
    return `Duplicate value for ${field}. Adjust the row and re-import it.`;
  }
  if (code === "P2003") return "Related record not found — is the store still active?";
  if (code === "P2025") return "This row no longer matches a product; re-run the import.";
  console.error("[bulk-import] write failed:", e);
  return "Could not save these rows. Check for duplicate SKUs or values, then re-import.";
}

/**
 * Bulk update: a price/stock feed matched by slug.
 *
 * Only columns present in the file are touched — a seller who uploads just
 * `slug,price` must not accidentally blank every stock count.
 */
async function updateExisting(
  rows: CsvRow[],
  storeId: string,
  userId: string
): Promise<Response> {
  const validation = validateUpdateRows(rows);
  if (validation.valid.length === 0) {
    return fail("VALIDATION", "No rows could be applied.", 422, {
      errors: validation.errors,
      total: validation.total,
    });
  }

  const slugs = [...new Set(validation.valid.map((r) => r.slug))];
  const existing = await db.product.findMany({
    where: { slug: { in: slugs }, storeId },
    select: { id: true, slug: true, title: true, price: true, compareAt: true, stock: true, trackStock: true, status: true },
  });
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  const updated: Array<{ slug: string; title: string; changes: string[] }> = [];
  const failed: Array<{ line: number; slug: string; reason: string }> = [];
  const errors = [...validation.errors];

  // Slugs that exist elsewhere (another seller's, or a typo) are reported
  // distinctly — "not found" and "not yours" are different problems.
  for (const r of validation.valid) {
    if (!bySlug.has(r.slug)) {
      const existsElsewhere = await db.product.findUnique({ where: { slug: r.slug }, select: { id: true } });
      errors.push({
        line: r.line,
        field: "slug",
        message: existsElsewhere
          ? `"${r.slug}" belongs to another store.`
          : `No product in this store has the slug "${r.slug}".`,
      });
    }
  }

  const CHUNK = 50;
  const applicable = validation.valid.filter((r) => bySlug.has(r.slug));

  for (let i = 0; i < applicable.length; i += CHUNK) {
    const chunk = applicable.slice(i, i + CHUNK);
    for (const r of chunk) {
      const current = bySlug.get(r.slug)!;
      const changes: string[] = [];
      const data: Record<string, unknown> = {};

      if (r.price !== undefined && r.price !== Number(current.price)) {
        data.price = r.price;
        changes.push(`price ${current.price} → ${r.price}`);
      }
      if (r.compareAt !== undefined) {
        const nextCompare = r.compareAt;
        const nextPrice = r.price ?? Number(current.price);
        if (nextCompare !== null && nextCompare <= nextPrice) {
          failed.push({ line: r.line, slug: r.slug, reason: "Compare-at must be higher than the price." });
          continue;
        }
        if (Number(current.compareAt ?? 0) !== Number(nextCompare ?? 0)) {
          data.compareAt = nextCompare;
          changes.push("compare-at updated");
        }
      }
      if (r.stock !== undefined && !current.trackStock) {
        // Writing stock on a listing that doesn't track it would imply a
        // quantity the storefront never enforces — misleading.
        failed.push({
          line: r.line,
          slug: r.slug,
          reason: "This listing doesn't track stock. Turn on stock tracking first.",
        });
        continue;
      }
      if (r.stock !== undefined && r.stock !== current.stock) {
        data.stock = r.stock;
        changes.push(`stock ${current.stock} → ${r.stock}`);
      }
      if (r.status !== undefined && r.status !== current.status) {
        if (current.status === "TAKEDOWN") {
          failed.push({
            line: r.line,
            slug: r.slug,
            reason: "This listing was taken down by support and can't be republished here.",
          });
          continue;
        }
        data.status = r.status;
        changes.push(`status → ${r.status}`);
      }

      if (Object.keys(data).length === 0) {
        updated.push({ slug: r.slug, title: current.title, changes: [] });
        continue;
      }

      try {
        await db.$transaction(async (tx) => {
          await tx.product.update({ where: { id: current.id }, data: data as never });
          if (data.price !== undefined || data.compareAt !== undefined) {
            await tx.priceSnapshot.create({
              data: {
                productId: current.id,
                price: Number(data.price ?? current.price),
                compareAt:
                  data.compareAt === undefined
                    ? current.compareAt
                    : data.compareAt === null
                      ? null
                      : Number(data.compareAt),
                source: "bulk_update",
              },
            });
          }
          // Keep variant stock aligned with the listing when it tracks stock
          // and has no options of its own.
          if (data.stock !== undefined) {
            await tx.productVariant.updateMany({
              where: { productId: current.id, name: "Default" },
              data: { stock: Number(data.stock) },
            });
          }
        });
        updated.push({ slug: r.slug, title: current.title, changes });
      } catch (e) {
        failed.push({ line: r.line, slug: r.slug, reason: describeWriteFailure(e) });
      }
    }
  }

  const changed = updated.filter((u) => u.changes.length > 0).length;
  if (changed > 0) {
    await audit(userId, "product.bulk_update", "Product", storeId, {
      storeId,
      rows: validation.total,
      changed,
      failed: failed.length,
    });
  }

  return ok({
    updated,
    changedCount: changed,
    unchangedCount: updated.length - changed,
    rejectedCount: errors.length + failed.length,
    total: validation.total,
    errors,
    failed,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return fail("VALIDATION", "CSV is too large (2MB max). Split it into smaller files.", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request", 422);
  }

  const store = await db.store.findFirst({ where: { id: parsed.data.storeId, ownerId: userId } });
  if (!store) return fail("FORBIDDEN", "You don't own that store.", 403);

  const { rows, headers } = parseCsv(parsed.data.csv);
  if (rows.length === 0) return fail("VALIDATION", "No data rows found. Check the header line.", 422);
  if (rows.length > MAX_ROWS) {
    return fail("VALIDATION", `Too many rows (${rows.length}). Import ${MAX_ROWS} at a time.`, 422);
  }

  if (parsed.data.mode === "update") {
    if (!headers.includes("slug")) {
      return fail("VALIDATION", "An update CSV must have a `slug` column.", 422);
    }
    return updateExisting(rows, store.id, userId);
  }

  if (!headers.includes("title") || !headers.includes("price")) {
    return fail("VALIDATION", "The CSV must have at least `title` and `price` columns.", 422);
  }

  const validation = validateBulkRows(rows);
  // Nothing importable — return the errors alone rather than a confusing
  // "created 0 products" success.
  if (validation.valid.length === 0) {
    return fail("VALIDATION", "No rows could be imported.", 422, { errors: validation.errors, total: validation.total });
  }

  const commerce = await getSettingGroup("commerce").catch(() => null);

  // Reserve slugs that are already taken in the catalogue, so the importer
  // produces "-2" rather than colliding with an existing product.
  const bases = validation.valid.map((r) => r.slug);
  const existing = await db.product.findMany({
    where: { slug: { in: bases } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((e) => e.slug));

  const created: Array<{ id: string; slug: string; title: string }> = [];
  const failed: Array<{ line: number; title: string; reason: string }> = [];

  // Chunked so no single transaction grows unbounded with the file size.
  const CHUNK = 50;
  for (let i = 0; i < validation.valid.length; i += CHUNK) {
    const chunk = validation.valid.slice(i, i + CHUNK);
    try {
      const rowsOut = await db.$transaction(async (tx) => {
        const out: Array<{ id: string; slug: string; title: string }> = [];
        for (const row of chunk) {
          const slug = uniqueSlug(row.slug, taken);
          taken.add(slug);
          const product = await tx.product.create({
            data: {
              slug,
              title: row.title,
              description: row.description,
              image: row.image,
              price: row.price,
              compareAt: row.compareAt,
              category: row.category,
              badge: row.badge,
              freeShipping: row.freeShipping,
              trackStock: row.trackStock,
              stock: row.stock,
              status: parsed.data.publish ? "ACTIVE" : row.status,
              storeId: store.id,
              variants: row.sku
                ? {
                    // A single default option, so the SKU is searchable and
                    // stock is tracked somewhere sensible.
                    create: [{ name: "Default", sku: row.sku, stock: row.trackStock ? row.stock : 0 }],
                  }
                : undefined,
              // Give the price history chart a baseline like every other
              // product, so the sparkline isn't blank on day one.
              priceHistory: { create: { price: row.price, compareAt: row.compareAt, source: "import" } },
            },
            select: { id: true, slug: true, title: true },
          });
          out.push(product);
        }
        return out;
      });
      created.push(...rowsOut);
    } catch (e) {
      // A chunk-level failure (unique violation, FK, DB error) fails the whole
      // chunk; report it against every row in it so nothing silently vanishes.
      const reason = describeWriteFailure(e);
      for (const row of chunk) {
        failed.push({ line: row.line, title: row.title, reason });
      }
    }
  }

  if (created.length > 0) {
    await audit(userId, "product.bulk_import", "Product", store.id, {
      storeId: store.id,
      created: created.length,
      rejected: validation.errors.length + failed.length,
      commissionDefault: commerce?.commissionDefault,
    });
  }

  return ok({
    created,
    createdCount: created.length,
    rejectedCount: validation.errors.length + failed.length,
    total: validation.total,
    /** Row-level problems from validation (bad cells). */
    errors: validation.errors,
    /** Row-level problems from the database write (e.g. SKU clash). */
    failed,
  });
}

/** Dry run: parse and validate without writing anything. */
export const PUT = async (req: Request) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const parsed = z.object({ csv: z.string().min(1) }).safeParse(json);
  if (!parsed.success) return fail("VALIDATION", "csv is required", 422);

  const { rows, headers } = parseCsv(parsed.data.csv);
  if (rows.length === 0) return fail("VALIDATION", "No data rows found.", 422);

  const validation = validateBulkRows(rows);
  const slugs = validation.valid.map((r) => ({ line: r.line, title: r.title, slug: r.slug }));
  const existing = await db.product.findMany({
    where: { slug: { in: slugs.map((s) => s.slug) } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((e) => e.slug));

  return ok({
    total: validation.total,
    importable: validation.valid.length,
    errors: validation.errors,
    headers,
    preview: slugs.slice(0, 50).map((s) => ({ ...s, slugTaken: taken.has(s.slug) })),
    hasClashes: slugs.some((s) => taken.has(s.slug)),
  });
};
