import { z } from "zod";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";

const dealSchema = z.object({
  productSlug: z.string().min(1).max(120),
  dealPrice: z.number().min(0.01).max(1000000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  stockCap: z.number().int().min(1).max(1000000).nullable().optional(),
}).refine((v) => new Date(v.startsAt) < new Date(v.endsAt), { message: "endsAt must be after startsAt" });

/** Admin-curated flash deals (one live row per product). */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { page, pageSize, skip } = getPagination(url);
  const where = status ? { status: status as "SCHEDULED" | "ACTIVE" | "ENDED" } : {};
  const [total, deals] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startsAt: "desc" },
      include: { product: { select: { slug: true, title: true, image: true, price: true, status: true } } },
    }),
  ]);
  return ok(deals, { page, pageSize, total });
}, "deals");

export const POST = withAdmin(async (req, actor) => {
  const parsed = dealSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid deal", 422);

  const product = await db.product.findUnique({ where: { slug: parsed.data.productSlug } });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Active product not found", 404);
  if (parsed.data.dealPrice >= Number(product.price)) {
    return fail("VALIDATION", "Deal price must beat the list price", 422);
  }
  const clash = await db.deal.findUnique({ where: { productId: product.id } });
  if (clash && clash.status !== "ENDED") {
    return fail("CONFLICT", "This product already has a live deal — end it first", 409);
  }
  if (clash) await db.deal.delete({ where: { id: clash.id } });

  const deal = await db.deal.create({
    data: {
      productId: product.id,
      dealPrice: parsed.data.dealPrice,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      stockCap: parsed.data.stockCap ?? null,
      // The scheduler flips SCHEDULED → ACTIVE at startsAt (and notifies).
      status: "SCHEDULED",
    },
  });
  await audit(actor.id, "deal.create", "Deal", deal.id, { productId: product.id, dealPrice: parsed.data.dealPrice });
  return ok(deal, undefined, 201);
}, "deals");
