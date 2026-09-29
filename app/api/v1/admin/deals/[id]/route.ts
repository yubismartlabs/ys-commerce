import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deal = await db.deal.findUnique({
      where: { id },
      include: { product: { select: { slug: true, title: true, image: true, price: true, status: true } } },
    });
    if (!deal) return fail("NOT_FOUND", "Deal not found", 404);
    return ok(deal);
  }
, "deals");

const patchSchema = z.object({
  dealPrice: z.number().min(0.01).max(1000000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  stockCap: z.number().int().min(1).max(1000000).nullable().optional(),
  status: z.enum(["SCHEDULED", "ENDED"]).optional(),
});

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid deal", 422);

    const deal = await db.deal.findUnique({
      where: { id },
      include: { product: { select: { price: true } } },
    });
    if (!deal) return fail("NOT_FOUND", "Deal not found", 404);
    if (deal.status === "ENDED") return fail("CONFLICT", "Ended deals are immutable — create a new one", 409);
    if (parsed.data.dealPrice !== undefined && parsed.data.dealPrice >= Number(deal.product.price)) {
      return fail("VALIDATION", "Deal price must beat the list price", 422);
    }

    const updated = await db.deal.update({
      where: { id },
      data: {
        ...(parsed.data.dealPrice !== undefined ? { dealPrice: parsed.data.dealPrice } : {}),
        ...(parsed.data.startsAt ? { startsAt: new Date(parsed.data.startsAt) } : {}),
        ...(parsed.data.endsAt ? { endsAt: new Date(parsed.data.endsAt) } : {}),
        ...(parsed.data.stockCap !== undefined ? { stockCap: parsed.data.stockCap } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
    });
    await audit(actor.id, "deal.update", "Deal", id, parsed.data);
    return ok(updated);
  }
, "deals");

export const DELETE = withAdmin(
  async (_req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deal = await db.deal.findUnique({ where: { id } });
    if (!deal) return fail("NOT_FOUND", "Deal not found", 404);
    if (deal.status === "ACTIVE") return fail("CONFLICT", "End the deal before deleting", 409);
    await db.deal.delete({ where: { id } });
    await audit(actor.id, "deal.delete", "Deal", id, {});
    return ok({ deleted: true });
  }
, "deals");
