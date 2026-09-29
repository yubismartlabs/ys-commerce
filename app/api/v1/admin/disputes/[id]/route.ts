import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { settleBuyerWin, settleSellerWin } from "@/lib/escrow/escrow";
import { notifyDisputeStatus, notifyUser } from "@/lib/notifications/notify";
import { transitionOrder, TransitionError } from "@/lib/orders/transitions";
import { open } from "@/lib/chat/server-crypto";

const patchSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"]),
  message: z.string().max(1000).optional(),
});

// Rulings move forward only; CLOSED is terminal.
const NEXT: Record<string, string[]> = {
  OPEN: ["UNDER_REVIEW", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"],
  UNDER_REVIEW: ["RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED"],
  RESOLVED_BUYER: ["CLOSED"],
  RESOLVED_SELLER: ["CLOSED"],
  CLOSED: [],
};

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const dispute = await db.dispute.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, number: true, total: true, status: true } },
        buyer: { select: { email: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!dispute) return fail("NOT_FOUND", "Dispute not found", 404);
    const holds = await db.escrowHold.findMany({
      where: { orderId: dispute.orderId },
      select: { id: true, storeId: true, gross: true, commission: true, net: true, status: true },
    });
    // Linked buyer↔seller chats, opened for mediation (platform-readable).
    const chats = await db.conversation.findMany({
      where: { orderId: dispute.orderId },
      select: { id: true, type: true, subject: true, buyerId: true, sellerId: true },
    });
    const transcripts = await Promise.all(
      chats.map(async (c) => {
        const rows = await db.chatMessage.findMany({
          where: { conversationId: c.id },
          orderBy: { createdAt: "asc" },
          take: 100,
        });
        return {
          id: c.id,
          type: c.type,
          subject: c.subject,
          messages: rows.map((m) => {
            let text = "⚠ Unreadable.";
            try {
              text = open({ ciphertext: m.ciphertext, nonce: m.nonce, keyId: m.keyId });
            } catch {
              // keep placeholder
            }
            return {
              senderId: m.senderId,
              text,
              imageUrl: m.imageUrl,
              flagged: m.flagged,
              createdAt: m.createdAt,
            };
          }),
        };
      })
    );
    return ok({ ...dispute, holds, chats: transcripts });
  }
, "disputes");

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Invalid status or message", 422);

    const dispute = await db.dispute.findUnique({
      where: { id },
      include: { order: { select: { id: true, number: true, items: { select: { storeId: true } } } } },
    });
    if (!dispute) return fail("NOT_FOUND", "Dispute not found", 404);
    if (!NEXT[dispute.status].includes(parsed.data.status)) {
      return fail("VALIDATION", `Cannot move dispute from ${dispute.status} to ${parsed.data.status}`, 422);
    }

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.dispute.update({
        where: { id },
        data: {
          status: parsed.data.status,
          ...(parsed.data.status === "RESOLVED_BUYER" || parsed.data.status === "RESOLVED_SELLER" || parsed.data.status === "CLOSED"
            ? { resolvedAt: new Date() }
            : {}),
        },
      });
      if (parsed.data.message) {
        await tx.disputeMessage.create({
          data: { disputeId: id, author: "admin", authorId: actor.id, body: parsed.data.message },
        });
      }
      return d;
    });

    // Auto-settle funds on rulings (never blocks the ruling itself).
    let settlement = "";
    if (parsed.data.status === "RESOLVED_BUYER") {
      try {
        await transitionOrder({ orderId: dispute.orderId, to: "REFUNDED", actorId: actor.id, note: `Dispute ${id} ruled for buyer.` });
        settlement = "order refunded; ";
      } catch (e) {
        settlement = e instanceof TransitionError ? `refund skipped (${e.message}); ` : "refund failed; ";
      }
      const n = await settleBuyerWin(dispute.orderId);
      settlement += `${n} escrow hold(s) refunded.`;
    } else if (parsed.data.status === "RESOLVED_SELLER") {
      const { released } = await settleSellerWin(dispute.orderId);
      settlement = `holds released to sellers (${released} due now).`;
    }

    await audit(actor.id, `dispute.${parsed.data.status.toLowerCase()}`, "Dispute", id, { settlement });
    await notifyDisputeStatus({
      disputeId: id,
      orderNumber: dispute.order.number,
      buyerId: dispute.buyerId,
      status: parsed.data.status,
      message: [parsed.data.message, settlement].filter(Boolean).join(" "),
    });

    // Sellers with items on the order learn the ruling in-app.
    const storeIds = [...new Set(dispute.order.items.map((i) => i.storeId))];
    const owners = await db.store.findMany({ where: { id: { in: storeIds } }, select: { ownerId: true } });
    for (const s of owners) {
      await notifyUser({
        userId: s.ownerId,
        type: "dispute.updated",
        title: `Dispute ruled on order ${dispute.order.number}: ${parsed.data.status.replace(/_/g, " ")}`,
        body: settlement || undefined,
        link: `/selling/disputes/${id}`,
        meta: { entityId: id },
      });
    }

    return ok({ ...updated, settlement });
  }
, "disputes");
