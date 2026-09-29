import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { notifyDisputeStatus } from "@/lib/notifications/notify";

const patchSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"]),
  message: z.string().max(1000).optional(),
});

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const dispute = await db.dispute.findUnique({
      where: { id },
      include: {
        order: { select: { number: true, total: true, status: true } },
        buyer: { select: { email: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!dispute) return fail("NOT_FOUND", "Dispute not found", 404);
    return ok(dispute);
  }
);

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Invalid status or message", 422);

    const dispute = await db.dispute.findUnique({ where: { id } });
    if (!dispute) return fail("NOT_FOUND", "Dispute not found", 404);

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.dispute.update({ where: { id }, data: { status: parsed.data.status } });
      if (parsed.data.message) {
        await tx.disputeMessage.create({
          data: { disputeId: id, author: "admin", body: parsed.data.message },
        });
      }
      return d;
    });
    await audit(actor.id, `dispute.${parsed.data.status.toLowerCase()}`, "Dispute", id, {});
    // Notify buyer (in-app + email) and all admins. Never blocks the mutation.
    const full = await db.dispute.findUnique({
      where: { id },
      include: { order: { select: { number: true } } },
    });
    if (full) {
      await notifyDisputeStatus({
        disputeId: id,
        orderNumber: full.order.number,
        buyerId: full.buyerId,
        status: parsed.data.status,
        message: parsed.data.message,
      });
    }
    return ok(updated);
  }
);
