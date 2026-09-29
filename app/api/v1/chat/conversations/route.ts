import { z } from "zod";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";

async function me() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw e;
  }
}

/** My conversations: counterpart, context, unread count, my key envelope. No message content (E2EE). */
export async function GET(req: Request) {
  let actor;
  try {
    actor = await me();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { OR: [{ buyerId: actor.id }, { sellerId: actor.id }] };
  const [total, convos] = await Promise.all([
    db.conversation.count({ where }),
    db.conversation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { lastMessageAt: "desc" },
      include: {
        reads: { where: { userId: actor.id } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  const otherIds = [...new Set(convos.map((c) => (c.buyerId === actor.id ? c.sellerId : c.buyerId)))];
  const users = await db.user.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const orderIds = [...new Set(convos.map((c) => c.orderId).filter((x): x is string => !!x))];
  const productIds = [...new Set(convos.map((c) => c.productId).filter((x): x is string => !!x))];
  const [orders, products, stores] = await Promise.all([
    orderIds.length ? db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true, status: true } }) : [],
    productIds.length
      ? db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, slug: true, image: true } })
      : [],
    db.store.findMany({
      where: { id: { in: [...new Set(convos.map((c) => c.storeId))] } },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const rows = await Promise.all(
    convos.map(async (c) => {
      const lastRead = c.reads[0]?.lastReadAt ?? new Date(0);
      const unread = await db.chatMessage.count({
        where: { conversationId: c.id, createdAt: { gt: lastRead }, senderId: { not: actor.id } },
      });
      const otherId = c.buyerId === actor.id ? c.sellerId : c.buyerId;
      return {
        id: c.id,
        type: c.type,
        subject: c.subject,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        messageCount: c._count.messages,
        unread,
        blocked: !!c.blockedById,
        blockedByMe: c.blockedById === actor.id,
        iAmBuyer: c.buyerId === actor.id,
        other: byId.get(otherId) ?? null,
        store: storeById.get(c.storeId) ?? null,
        order: c.orderId ? (orderById.get(c.orderId) ?? null) : null,
        product: c.productId ? (productById.get(c.productId) ?? null) : null,
      };
    })
  );
  return ok(rows, { page, pageSize, total });
}

const createSchema = z.union([
  z.object({ orderId: z.string().min(1), storeId: z.string().min(1) }),
  // Sellers open from their order view without naming the store — the
  // first owned store on the order is used.
  z.object({ orderId: z.string().min(1) }),
  z.object({ productId: z.string().min(1), subject: z.string().max(140).optional() }),
  z.object({ storeId: z.string().min(1), subject: z.string().max(140).optional() }),
]);

/**
 * Open a conversation (idempotent for order+store).
 */
export async function POST(req: Request) {
  let actor;
  try {
    actor = await me();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Provide {orderId, storeId} or {productId} or {storeId}", 422);
  const body = parsed.data;

  // Anti-spam: cap new conversations per user per day (order chats are idempotent anyway).
  const openedToday = await db.conversation.count({
    where: {
      OR: [{ buyerId: actor.id }, { sellerId: actor.id }],
      createdAt: { gt: new Date(Date.now() - 24 * 3600000) },
    },
  });
  if (openedToday >= 10) return fail("RATE_LIMITED", "Too many new conversations — try again tomorrow", 429);

  if ("orderId" in body) {
    const order = await db.order.findUnique({
      where: { id: body.orderId },
      include: { items: { select: { storeId: true } } },
    });
    if (!order) return fail("NOT_FOUND", "Order not found", 404);
    // Sellers may omit storeId — first owned store on the order is used.
    let storeId: string | null = "storeId" in body && body.storeId ? body.storeId : null;
    if (!storeId) {
      const mine = await db.store.findMany({ where: { ownerId: actor.id }, select: { id: true } });
      const hit = order.items.find((i) => mine.some((s) => s.id === i.storeId));
      if (!hit) return fail("FORBIDDEN", "Not your order", 403);
      storeId = hit.storeId;
    }
    const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, ownerId: true } });
    if (!store || !order.items.some((i) => i.storeId === store.id)) {
      return fail("VALIDATION", "Store is not on this order", 422);
    }
    const isBuyer = order.buyerId === actor.id;
    const isSeller = store.ownerId === actor.id;
    if (!isBuyer && !isSeller) return fail("FORBIDDEN", "Not your order", 403);
    const existing = await db.conversation.findUnique({
      where: { orderId_storeId: { orderId: order.id, storeId: store.id } },
    });
    if (existing) return ok(existing);
    const convo = await db.conversation.create({
      data: {
        type: "ORDER",
        orderId: order.id,
        storeId: store.id,
        buyerId: order.buyerId,
        sellerId: store.ownerId,
      },
    });
    return ok(convo, undefined, 201);
  }

  // Inquiry: buyer asks about a product or store. Sellers can't inquire with themselves.
  const product = "productId" in body ? await db.product.findUnique({ where: { id: body.productId } }) : null;
  if ("productId" in body && !product) return fail("NOT_FOUND", "Product not found", 404);
  const storeId = product ? product.storeId : (body as { storeId: string }).storeId;
  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, ownerId: true } });
  if (!store) return fail("NOT_FOUND", "Store not found", 404);
  if (store.ownerId === actor.id) return fail("VALIDATION", "You can't message your own store", 422);
  const convo = await db.conversation.create({
    data: {
      type: "INQUIRY",
      productId: product?.id,
      storeId: store.id,
      buyerId: actor.id,
      sellerId: store.ownerId,
      subject: body.subject ?? product?.title.slice(0, 140),
    },
  });
  return ok(convo, undefined, 201);
}
