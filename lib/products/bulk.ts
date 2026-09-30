import { isAllowedImageUrl, describeImagePolicy } from "@/lib/images";

/**
 * CSV parsing for bulk listing import.
 *
 * Hand-rolled rather than a dependency, because the edge cases that matter
 * here are exactly the ones generic parsers get wrong on seller data:
 *  - quoted fields containing commas, quotes and newlines
 *  - a BOM pasted from Excel/Sheets
 *  - CRLF line endings
 *  - a trailing comma producing a phantom empty column
 *
 * Kept in one file so the validation rules are auditable — this writes
 * directly into the catalogue.
 */

export type CsvRow = Record<string, string>;

/** Headers we understand. Unknown columns are ignored, not fatal. */
export const BULK_HEADERS = [
  "title",
  "price",
  "compare_at",
  "category",
  "stock",
  "sku",
  "image",
  "description",
  "badge",
  "free_shipping",
  "track_stock",
  "status",
] as const;

/** Split one CSV line, honouring quotes and escaped quotes ("") . */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // "" inside a quoted field is a literal quote.
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse a whole CSV document into header-keyed rows.
 * Handles quoted newlines inside fields, so a description can span lines.
 */
export function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  const text = input.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const cleaned = records
    .map((r) => r.map((c) => c.trim()))
    // Drop trailing all-empty rows (a trailing newline is common).
    .filter((r) => r.some((c) => c !== ""));

  if (cleaned.length === 0) return { headers: [], rows: [] };

  const headers = cleaned[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = cleaned.slice(1).map((cells) => {
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

export type ValidatedRow = {
  line: number;
  title: string;
  slug: string;
  price: number;
  compareAt: number | null;
  category: string;
  description: string | null;
  image: string;
  badge: string | null;
  freeShipping: boolean;
  trackStock: boolean;
  stock: number;
  sku: string | null;
  status: "DRAFT" | "ACTIVE";
};

export type RowError = { line: number; field: string; message: string };

export type BulkValidation = {
  valid: ValidatedRow[];
  errors: RowError[];
  total: number;
};

const TRUEY = new Set(["1", "true", "yes", "y"]);
const FALSEY = new Set(["0", "false", "no", "n"]);

function parseBool(v: string, fallback: boolean): boolean | null {
  const s = v.trim().toLowerCase();
  if (!s) return fallback;
  if (TRUEY.has(s)) return true;
  if (FALSEY.has(s)) return false;
  return null;
}

function parseMoney(v: string): number | null {
  const s = v.trim().replace(/[$£€,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate every row independently, so one bad row doesn't fail the import
 * and the seller sees exactly which line to fix.
 */
export function validateBulkRows(rows: CsvRow[], startLine = 2): BulkValidation {
  const errors: RowError[] = [];
  const valid: ValidatedRow[] = [];

  rows.forEach((row, idx) => {
    const line = startLine + idx;
    const rowErrors: RowError[] = [];

    const title = (row.title ?? "").trim();
    if (title.length < 2) rowErrors.push({ line, field: "title", message: "Title is required (2+ characters)." });
    else if (title.length > 140) rowErrors.push({ line, field: "title", message: "Title is too long (140 max)." });

    const price = parseMoney(row.price ?? "");
    if (price === null) rowErrors.push({ line, field: "price", message: "Price is required, e.g. 12.49." });
    else if (price <= 0) rowErrors.push({ line, field: "price", message: "Price must be greater than 0." });
    else if (price > 1000000) rowErrors.push({ line, field: "price", message: "Price is unrealistically high." });

    let compareAt: number | null = null;
    const rawCompare = (row.compare_at ?? "").trim();
    if (rawCompare) {
      compareAt = parseMoney(rawCompare);
      if (compareAt === null) rowErrors.push({ line, field: "compare_at", message: "Compare-at must be a number." });
      else if (price !== null && compareAt !== null && compareAt <= price) {
        // A strikethrough at or below the price shows a negative discount,
        // which reads as a bug to shoppers.
        rowErrors.push({ line, field: "compare_at", message: "Compare-at must be higher than the price." });
      }
    }

    const category = (row.category ?? "").trim().toLowerCase();
    if (!category) rowErrors.push({ line, field: "category", message: "Category is required (lowercase slug, e.g. electronics)." });
    else if (category.length > 60) rowErrors.push({ line, field: "category", message: "Category is too long (60 max)." });

    const image = (row.image ?? "").trim();
    if (!image) {
      rowErrors.push({ line, field: "image", message: "Image URL is required." });
    } else if (!isAllowedImageUrl(image)) {
      // Without this, an unconfigured host would throw during render and take
      // down every page showing the imported product.
      rowErrors.push({ line, field: "image", message: describeImagePolicy() });
    }

    let stock = 0;
    const rawStock = (row.stock ?? "").trim();
    if (rawStock) {
      const n = Number(rawStock);
      if (!Number.isInteger(n) || n < 0) {
        rowErrors.push({ line, field: "stock", message: "Stock must be a whole number of 0 or more." });
      } else {
        stock = n;
      }
    }

    const freeShipping = parseBool(row.free_shipping ?? "", true);
    if (freeShipping === null) {
      rowErrors.push({ line, field: "free_shipping", message: "Use true/false or yes/no." });
    }
    const trackStock = parseBool(row.track_stock ?? "", rawStock !== "");
    if (trackStock === null) {
      rowErrors.push({ line, field: "track_stock", message: "Use true/false or yes/no." });
    }

    const rawStatus = (row.status ?? "").trim().toUpperCase();
    if (rawStatus && rawStatus !== "DRAFT" && rawStatus !== "ACTIVE") {
      rowErrors.push({ line, field: "status", message: "Status must be DRAFT or ACTIVE." });
    }

    const description = (row.description ?? "").trim();
    if (description.length > 5000) {
      rowErrors.push({ line, field: "description", message: "Description is too long (5000 max)." });
    }

    const sku = (row.sku ?? "").trim() || null;
    if (sku && sku.length > 40) rowErrors.push({ line, field: "sku", message: "SKU is too long (40 max)." });

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    valid.push({
      line,
      title,
      slug: bulkSlug(title),
      price: price as number,
      compareAt,
      category,
      description: description || null,
      image,
      badge: (row.badge ?? "").trim() || null,
      freeShipping: freeShipping ?? true,
      trackStock: trackStock ?? false,
      stock,
      sku,
      status: (rawStatus || "DRAFT") as "DRAFT" | "ACTIVE",
    });
  });

  // Two rows with the same title produce the same clean slug. Resolve
  // deterministically (-2, -3) rather than failing at insert time with an
  // opaque unique violation the seller can't act on.
  const takenInFile = new Set<string>();
  const out: ValidatedRow[] = [];
  for (const r of valid) {
    const slug = uniqueSlug(r.slug, takenInFile);
    takenInFile.add(slug);
    out.push(slug === r.slug ? r : { ...r, slug });
  }

  return { valid: out, errors, total: rows.length };
}

/**
 * Deterministic slug for bulk imports.
 *
 * `slugify()` in the single-product path appends a random suffix
 * ("wireless-earbuds-x7f2q") to guarantee uniqueness. That is fine for one
 * product at a time but wrong for a catalogue: importers want clean, stable,
 * indexable URLs, and a random suffix makes them ugly and impossible to reason
 * about. Collisions are resolved deterministically instead — "-2", "-3" — by
 * `uniqueSlugs()` below, against both the file and the database.
 */
export function bulkSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents: "Café" -> "cafe"
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";
  return base;
}

/** Append -2, -3, … until the slug is free (used by the importer). */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
/** A downloadable template so sellers aren't guessing the column names. */
export const CSV_TEMPLATE = [
  BULK_HEADERS.join(","),
  [
    "Wireless Bluetooth Earbuds",
    "24.99",
    "39.99",
    "electronics",
    "50",
    "GH-EARB-001",
    "https://picsum.photos/seed/earbs/600/600",
    "Noise cancelling earbuds with a charging case.",
    "Choice",
    "true",
    "true",
    "ACTIVE",
  ].join(","),
  [
    "Stainless Steel Lint Remover",
    "12.49",
    "",
    "beauty",
    "25",
    "GH-LINT-002",
    "https://picsum.photos/seed/lint/600/600",
    "Rechargeable fabric shaver.",
    "",
    "true",
    "true",
    "ACTIVE",
  ].join(","),
].join("\n");

// ---------------------------------------------------------------------------
// Update mode
//
// Sellers maintain a price/stock feed and re-upload it. Rows are matched by
// SLUG (the stable public identifier) rather than title, so renaming a product
// never silently re-targets a price change.
// ---------------------------------------------------------------------------

export const BULK_UPDATE_HEADERS = ["slug", "price", "compare_at", "stock", "status"] as const;

export type ValidatedUpdate = {
  line: number;
  slug: string;
  // undefined = "leave alone". A price feed usually carries only what changed.
  price?: number;
  compareAt?: number | null;
  stock?: number;
  status?: "DRAFT" | "ACTIVE";
};

export function validateUpdateRows(rows: CsvRow[], startLine = 2): {
  valid: ValidatedUpdate[];
  errors: RowError[];
  total: number;
} {
  const errors: RowError[] = [];
  const valid: ValidatedUpdate[] = [];
  const seen = new Set<string>();

  rows.forEach((row, idx) => {
    const line = startLine + idx;
    const rowErrors: RowError[] = [];

    const slug = (row.slug ?? "").trim();
    if (!slug) {
      rowErrors.push({ line, field: "slug", message: "Slug is required — it's the product's URL, e.g. product-1." });
    } else if (slug.length > 120) {
      rowErrors.push({ line, field: "slug", message: "Slug is too long (120 max)." });
    }

    const out: ValidatedUpdate = { line, slug };

    const rawPrice = (row.price ?? "").trim();
    if (rawPrice) {
      const price = parseMoney(rawPrice);
      if (price === null) rowErrors.push({ line, field: "price", message: "Price must be a number." });
      else if (price <= 0) rowErrors.push({ line, field: "price", message: "Price must be greater than 0." });
      else out.price = price;
    }

    const rawStock = (row.stock ?? "").trim();
    if (rawStock) {
      const n = Number(rawStock);
      if (!Number.isInteger(n) || n < 0) {
        rowErrors.push({ line, field: "stock", message: "Stock must be a whole number of 0 or more." });
      } else {
        out.stock = n;
      }
    }

    const rawStatus = (row.status ?? "").trim().toUpperCase();
    if (rawStatus) {
      if (rawStatus !== "DRAFT" && rawStatus !== "ACTIVE") {
        rowErrors.push({ line, field: "status", message: "Status must be DRAFT or ACTIVE." });
      } else {
        out.status = rawStatus;
      }
    }

    const rawCompare = (row.compare_at ?? "").trim();
    if (rawCompare) {
      const c = parseMoney(rawCompare);
      if (c === null) rowErrors.push({ line, field: "compare_at", message: "Compare-at must be a number." });
      else if (out.price !== undefined && c <= out.price) {
        rowErrors.push({ line, field: "compare_at", message: "Compare-at must be higher than the price." });
      } else {
        out.compareAt = c;
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    // Duplicate slugs in one feed would apply twice; the second is a no-op at
    // best and confusing at worst.
    if (seen.has(slug)) {
      errors.push({ line, field: "slug", message: `"${slug}" appears more than once in this file.` });
      return;
    }
    seen.add(slug);
    valid.push(out);
  });

  return { valid, errors, total: rows.length };
}

/** Template for the update (price/stock feed) workflow. */
export const CSV_UPDATE_TEMPLATE = [
  BULK_UPDATE_HEADERS.join(","),
  "product-1,22.49,39.99,40,ACTIVE",
  "product-2,9.99,,120,ACTIVE",
  "product-3,,,15,DRAFT",
].join("\n");
