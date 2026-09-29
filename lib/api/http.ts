import { NextResponse } from "next/server";

export function ok<T>(data: T, pagination?: { page: number; pageSize: number; total: number }, status = 200) {
  return NextResponse.json(serialize({ data, ...(pagination ? { pagination } : {}) }), { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
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

// Prisma Decimals and Dates don't survive a naive object walk —
// normalize them for JSON so web + mobile get plain numbers/strings.
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (isDecimalLike(value)) return value.toNumber() as unknown as T;
  if (Array.isArray(value)) return value.map(serialize) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out as T;
  }
  return value;
}
