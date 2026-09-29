import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { notifyAdmins } from "@/lib/notifications/notify";

/** Buyer reads their own dispute thread. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;

  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      order: { select: { number: true, total: true, status: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!dispute || dispute.buyerId !== userId) return fail("NOT_FOUND", "Dispute not found", 404);
  return ok(dispute);
}

const replySchema = z.object({ message: z.string().min(1).max(2000) });

/** Buyer replies on their own open/under-review dispute. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;

  const parsed = replySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "message required", 422);

  const dispute = await db.dispute.findUnique({ where: { id }, include: { order: { select: { number: true } } } });
  if (!dispute || dispute.buyerId !== userId) return fail("NOT_FOUND", "Dispute not found", 404);
  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) {
    return fail("DISPUTE", "This dispute is closed to new messages", 422);
  }

  const message = await db.disputeMessage.create({
    data: { disputeId: id, author: "buyer", authorId: userId, body: parsed.data.message },
  });
  await audit(userId, "dispute.reply", "Dispute", id, { by: "buyer" });
  await notifyAdmins({
    type: "dispute.message",
    title: `Buyer replied on order ${dispute.order.number}`,
    link: `/ys-admin/disputes/show/${id}`,
    meta: { entityId: id },
  });
  return ok(message, undefined, 201);
}
