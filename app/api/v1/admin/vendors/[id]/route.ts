import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { notifyVendorStatus } from "@/lib/notifications/notify";

const patchSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "REJECTED"]),
  note: z.string().max(500).optional(),
});

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const store = await db.store.findUnique({
      where: { id },
      include: { owner: { select: { email: true, name: true } }, _count: { select: { products: true } } },
    });
    if (!store) return fail("NOT_FOUND", "Vendor not found", 404);
    return ok(store);
  }
, "vendors");

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "status must be PENDING, APPROVED, SUSPENDED or REJECTED", 422);

    const store = await db.store.findUnique({ where: { id } });
    if (!store) return fail("NOT_FOUND", "Vendor not found", 404);

    const updated = await db.store.update({ where: { id }, data: { status: parsed.data.status } });
    await audit(actor.id, `vendor.${parsed.data.status.toLowerCase()}`, "Store", id, { note: parsed.data.note });

    // Notify store owner (in-app + email) of moderation outcome (skip silent PENDING resets).
    // Never blocks the mutation.
    if (parsed.data.status !== "PENDING") {
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
