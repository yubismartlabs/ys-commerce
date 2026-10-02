import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { productInput, slugify } from "@/lib/products/schema";

/**
 * The three seller-side views the My YS sidebar links to. They are filters
 * over the same table rather than separate pages:
 *   scheduled — drafted but not published yet
 *   sold      — live or historical listings that have sold at least one unit
 *   unsold    — published listings that have never sold
 */
const VIEWS = ["scheduled", "sold", "unsold"] as const;

/** Seller's own listings across their stores. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return ok([], { page: 1, pageSize: 20, total: 0 }, 200, { stores });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const rawView = url.searchParams.get("view");
  const view = VIEWS.includes(rawView as (typeof VIEWS)[number]) ? (rawView as (typeof VIEWS)[number]) : null;
  const { page, pageSize, skip } = getPagination(url);
  const where = {
    storeId: { in: storeIds },
    ...(status ? { status: status as "DRAFT" | "ACTIVE" | "TAKEDOWN" } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    // A view is a claim about publication and sales together, so it overrides
    // a bare ?status= rather than intersecting with it — "?status=DRAFT" would
    // otherwise make "Sold" quietly empty instead of reporting a conflict.
    ...(view === "scheduled" ? { status: "DRAFT" as const } : {}),
    ...(view === "sold" ? { soldCount: { gt: 0 } } : {}),
    ...(view === "unsold" ? { soldCount: 0, status: "ACTIVE" as const } : {}),
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
      include: {
        // `id` is required: the listings table derives the store scope for
        // bulk actions from each row, so omitting it left the action bar
        // permanently disabled.
        store: { select: { id: true, name: true } },
        variants: true,
        _count: { select: { reviews: true } },
      },
    }),
  ]);
  return ok(products, { page, pageSize, total }, 200, { stores, view });
}

/** Create a listing (starts as DRAFT; seller publishes via PATCH). */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const parsed = productInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid product", 422);

  const store = await db.store.findUnique({ where: { id: parsed.data.storeId } });
  if (!store || store.ownerId !== userId) return fail("FORBIDDEN", "Store not found", 403);
  if (store.status !== "APPROVED") return fail("CONFLICT", "Only approved stores can list products", 409);

  const { storeId, variants, specs, ...rest } = parsed.data;
  const slug = slugify(rest.title);
  const product = await db.product.create({
    data: {
      ...rest,
      slug,
      status: "DRAFT",
      storeId,
      specs: specs as object,
      variants: { create: variants.map((v) => ({ ...v, sku: v.sku || null })) },
    },
    include: { variants: true },
  });
  await audit(userId, "product.create", "Product", product.id, { storeId, slug });
  return ok(product, undefined, 201);
}
