import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { notifyVendorStatus } from "@/lib/notifications/notify";

const patchSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "REJECTED"]).optional(),
  commissionRate: z.number().min(0).max(0.5).optional(),
  note: z.string().max(500).optional(),
});

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const store = await db.store.findUnique({
      where: { id },
      include: { owner: { select: { id: true, email: true, name: true } }, _count: { select: { products: true } } },
    });
    if (!store) return fail("NOT_FOUND", "Vendor not found", 404);
    const itemWhere = { storeId: id };
    const [orders, holds, lines] = await Promise.all([
      db.order.count({ where: { items: { some: itemWhere } } }),
      db.escrowHold.groupBy({ by: ["status"], where: { storeId: id }, _sum: { net: true } }),
      db.orderItem.findMany({
        where: { ...itemWhere, order: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } } },
        select: { price: true, qty: true },
      }),
    ]);
    const revenue = Math.round(lines.reduce((a, l) => a + Number(l.price) * l.qty, 0) * 100) / 100;
    const escrow = Object.fromEntries(
      holds.map((h) => [h.status, Math.round(Number(h._sum.net ?? 0) * 100) / 100])
    );
    return ok({ ...store, analytics: { orders, revenue, escrow } });
  }
, "vendors");

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "status must be PENDING, APPROVED, SUSPENDED or REJECTED", 422);
    if (!parsed.data.status && parsed.data.commissionRate === undefined) {
      return fail("VALIDATION", "Provide status and/or commissionRate", 422);
    }

    const store = await db.store.findUnique({ where: { id } });
    if (!store) return fail("NOT_FOUND", "Vendor not found", 404);

    const updated = await db.store.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.commissionRate !== undefined ? { commissionRate: parsed.data.commissionRate } : {}),
      },
    });
    await audit(actor.id, `vendor.${parsed.data.status ? parsed.data.status.toLowerCase() : "update"}`, "Store", id, {
      note: parsed.data.note,
      commissionRate: parsed.data.commissionRate,
    });

    // Notify store owner (in-app + email) of moderation outcome (skip silent PENDING resets).
    // Never blocks the mutation.
    if (parsed.data.status && parsed.data.status !== "PENDING") {
      const full = await db.store.findUnique({
        where: { id },
        select: { name: true, ownerId: true },
      });
      if (full) {
        await notifyVendorStatus({
          storeId: id,
          storeName: full.name,
          ownerId: full.ownerId,
          status: parsed.data.status,
          note: parsed.data.note,
        });
      }
    }

    return ok(updated);
  }
, "vendors");
