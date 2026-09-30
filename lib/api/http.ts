import { NextResponse } from "next/server";
import { isAllowedImageUrl, safeImageList, safeImageSrc } from "@/lib/images";

export function ok<T>(data: T, pagination?: { page: number; pageSize: number; total: number }, status = 200, meta?: Record<string, unknown>) {
  return NextResponse.json(serialize({ data, ...(pagination ? { pagination } : {}), ...(meta ? { meta } : {}) }), { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function getPagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function isDecimalLike(v: unknown): v is { toNumber: () => number } {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Record<string, unknown>).toNumber === "function" &&
    ("d" in (v as Record<string, unknown>) || "e" in (v as Record<string, unknown>))
  );
}

// Fields whose value is a single seller-supplied image URL.
const IMAGE_FIELDS = new Set(["image", "logo", "banner", "faviconUrl", "avatar", "imageUrl"]);
// Fields whose value is a list of seller-supplied image URLs.
const IMAGE_LIST_FIELDS = new Set(["images"]);

function isRemote(v: string): boolean {
  return v.startsWith("http://") || v.startsWith("https://");
}

/**
 * Rewrite seller-supplied image URLs that point at hosts outside the allowlist
 * to the local placeholder. `next/image` throws at render for an unconfigured
 * host, which would otherwise take down every page showing that image. Empty
 * strings are left alone — "no logo" is a meaningful state, not a broken image.
 */
function sanitizeImages(key: string, value: unknown): unknown {
  if (IMAGE_LIST_FIELDS.has(key)) {
    if (!Array.isArray(value)) return value;
    return safeImageList(value as string[]);
  }
  if (IMAGE_FIELDS.has(key) && typeof value === "string" && isRemote(value)) {
    return isAllowedImageUrl(value) ? value : safeImageSrc(value);
  }
  return value;
}

// Prisma Decimals and Dates don't survive a naive object walk —
// normalize them for JSON so web + mobile get plain numbers/strings.
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (isDecimalLike(value)) return value.toNumber() as unknown as T;
  if (Array.isArray(value)) return value.map(serialize) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(sanitizeImages(k, v));
    return out as T;
  }
  return value;
}
