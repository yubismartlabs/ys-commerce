import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

/**
 * Moderation queue: conversation METADATA only (participants, volume,
 * reports). Bodies are end-to-end encrypted — admins cannot read them.
 */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const reported = url.searchParams.get("reported");
  const { page, pageSize, skip } = getPagination(url);
  const where = reported === "1" ? { reportedAt: { not: null } } : {};

  const [total, convos] = await Promise.all([
    db.conversation.count({ where }),
    db.conversation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ reportedAt: "desc" }, { lastMessageAt: "desc" }],
      include: { _count: { select: { messages: true } } },
    }),
  ]);
  const userIds = [...new Set(convos.flatMap((c) => [c.buyerId, c.sellerId]))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, role: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const orderIds = [...new Set(convos.map((c) => c.orderId).filter((x): x is string => !!x))];
  const orders = orderIds.length
    ? await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  return ok(
    convos.map((c) => ({
      id: c.id,
      type: c.type,
      subject: c.subject,
      messageCount: c._count.messages,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      blocked: !!c.blockedById,
      reportedAt: c.reportedAt,
      reportReason: c.reportReason,
      buyer: byId.get(c.buyerId) ?? null,
      seller: byId.get(c.sellerId) ?? null,
      order: c.orderId ? (orderById.get(c.orderId) ?? null) : null,
    })),
    { page, pageSize, total }
  );
}, "chat");
