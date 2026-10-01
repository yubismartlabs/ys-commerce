import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { filingEligibility, freezeForOrder } from "@/lib/escrow/escrow";
import { isSuspended } from "@/lib/api/identity";
import { clientKey, limit } from "@/lib/api/rate-limit";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";
import { evaluateMessage } from "@/lib/chat/safety";
import { getEmailConfig } from "@/lib/email/send";
import { disputeOpenedEmail } from "@/lib/email/templates";
import { notifyAdmins, notifyUser } from "@/lib/notifications/notify";

export const disputeCategory = z.enum([
  "NOT_RECEIVED",
  "DAMAGED",
  "WRONG_ITEM",
  "QUALITY",
  "NOT_AS_DESCRIBED",
  "OTHER",
]);

/** Buyer's own disputes. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { buyerId: userId };
  const [total, disputes] = await Promise.all([
    db.dispute.count({ where }),
    db.dispute.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { order: { select: { number: true, total: true, status: true } } },
    }),
  ]);
  return ok(disputes, { page, pageSize, total });
}

const fileSchema = z.object({
  orderNumber: z.string().min(1).max(32),
  category: disputeCategory.default("OTHER"),
  reason: z.string().min(10).max(1000),
});

/**
 * File a dispute: one open per order, within the protection window.
 * Freezes the order's escrow and alerts admins + sellers.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  // Filing freezes escrow, so a burst of these from one account is both a
  // support-queue problem and a way to hold a seller's funds hostage.
  const rl = await limit(clientKey(req, "disputes", userId), 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("RATE_LIMITED", "You've filed several dispute requests recently. Contact support.", 429, {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const parsed = fileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "orderNumber, category and reason (10+ chars) required", 422);

  // Dispute threads are plaintext — screen contact info / circumvention server-side.
  const screen = evaluateMessage(parsed.data.reason);
  if (screen.level === "block") return fail("PROTECTION", screen.message ?? "Content blocked", 422);

  const order = await db.order.findUnique({
    where: { number: parsed.data.orderNumber.trim().toUpperCase() },
    include: { items: { select: { storeId: true } } },
  });
  if (!order || order.buyerId !== userId) return fail("NOT_FOUND", "Order not found", 404);

  const eligible = await filingEligibility(order.id, userId);
  if (!eligible.ok) return fail("DISPUTE", eligible.error, 422);

  const dispute = await db.dispute.create({
    data: {
      orderId: order.id,
      buyerId: userId,
      category: parsed.data.category,
      reason: parsed.data.reason,
      messages: { create: { author: "buyer", authorId: userId, body: parsed.data.reason } },
    },
    include: { messages: true },
  });

  const frozen = await freezeForOrder(order.id);
  await audit(userId, "dispute.open", "Dispute", dispute.id, { orderId: order.id, frozen });

  const config = await getEmailConfig();
  const buyer = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const template = disputeOpenedEmail({
    orderNumber: order.number,
    buyerEmail: buyer?.email ?? "buyer",
    reason: parsed.data.reason,
    siteName: config.siteName,
  });
  await notifyAdmins({
    type: "dispute.opened",
    title: `New dispute on order ${order.number}`,
    body: `${parsed.data.category.replace(/_/g, " ")} — ${frozen} escrow hold(s) frozen.`,
    link: `/ys-admin/disputes/show/${dispute.id}`,
    meta: { entityId: dispute.id, orderNumber: order.number },
    email: { template, name: "dispute.opened", enabled: config.enabled && config.adminAlerts },
  });

  // Sellers with items on the order get an in-app alert to respond.
  const site = await getSettingGroup("site");
  const storeIds = [...new Set(order.items.map((i) => i.storeId))];
  const owners = await db.store.findMany({ where: { id: { in: storeIds } }, select: { ownerId: true, name: true } });
  for (const s of owners) {
    await notifyUser({
      userId: s.ownerId,
      type: "dispute.opened",
      title: `Dispute opened on order ${order.number}`,
      body: `A buyer disputed ${s.name} items. Respond under My YS → Disputes → Against my store.`,
      link: accountPath(`/disputes/${dispute.id}?view=selling`, site.accountSlug),
      meta: { entityId: dispute.id, orderNumber: order.number },
      email: { template, name: "dispute.opened.seller", enabled: config.enabled && config.adminAlerts },
    });
  }

  return ok(dispute, undefined, 201);
}
