import { db } from "@/lib/db";
import { getEmailConfig, sendEmail } from "@/lib/email/send";
import {
  digestEmail,
  disputeStatusEmail,
  orderCancelledEmail,
  orderDeliveredEmail,
  orderRefundedEmail,
  orderShippedEmail,
  productStatusEmail,
  sellerRequestEmail,
  vendorStatusEmail,
  type DigestSection,
  type DisputeStatusKey,
  type EmailTemplate,
  type ProductStatusKey,
  type VendorStatusKey,
} from "@/lib/email/templates";

// ---------------------------------------------------------------------------
// Low-level: send one email and audit it to EmailLog. Never throws.
// ---------------------------------------------------------------------------

export async function sendAndLog(opts: {
  to: string | string[];
  template: EmailTemplate;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string }> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (recipients.length === 0) {
    await db.emailLog.create({
      data: { to: "", template: String(opts.meta?.template ?? "unknown"), subject: opts.template.subject, status: "SKIPPED", error: "no recipient" },
    });
    return { ok: false };
  }
  const result = await sendEmail({ to: recipients, template: opts.template });
  await db.emailLog.create({
    data: {
      to: recipients.join(", "),
      template: String(opts.meta?.template ?? "unknown"),
      subject: opts.template.subject,
      status: result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED",
      resendId: result.ok && "id" in result ? result.id : undefined,
      error: !result.ok && "error" in result ? result.error : undefined,
      meta: (opts.meta as object) ?? undefined,
    },
  });
  return result.ok ? { ok: true, id: "id" in result ? result.id : undefined } : { ok: false };
}

// ---------------------------------------------------------------------------
// In-app fan-out. Never throws (callers must not fail their mutation).
// ---------------------------------------------------------------------------

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  meta?: Record<string, unknown>;
  email?: { template: EmailTemplate; name: string; to?: string; enabled: boolean };
};

export async function notifyUser(input: NotifyInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        meta: (input.meta as object) ?? undefined,
      },
    });
    if (input.email?.enabled) {
      const to =
        input.email.to ??
        (await db.user.findUnique({ where: { id: input.userId }, select: { email: true } }))?.email;
      if (to) {
        await sendAndLog({
          to,
          template: input.email.template,
          meta: { template: input.email.name, notificationType: input.type },
        });
      }
    }
  } catch (e) {
    console.error("[notify] notifyUser failed", e);
  }
}

export async function notifyAdmins(input: Omit<NotifyInput, "userId">): Promise<void> {
  try {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: input.type,
          title: input.title,
          body: input.body,
          link: input.link,
          meta: (input.meta as object) ?? undefined,
        })),
      });
    }
    if (input.email?.enabled) {
      const config = await getEmailConfig();
      if (config.adminAlertEmail) {
        await sendAndLog({
          to: config.adminAlertEmail,
          template: input.email.template,
          meta: { template: input.email.name, notificationType: input.type },
        });
      }
    }
  } catch (e) {
    console.error("[notify] notifyAdmins failed", e);
  }
}

// ---------------------------------------------------------------------------
// Domain events (called from API routes after the write + audit succeed).
// ---------------------------------------------------------------------------

export async function notifyOrderStatus(opts: {
  orderId: string;
  orderNumber: string;
  buyerId: string;
  status: "CANCELLED" | "REFUNDED" | "SHIPPED" | "DELIVERED" | "PAID";
  note?: string;
  trackingNumber?: string;
  carrier?: string;
}): Promise<void> {
  const config = await getEmailConfig();
  const template =
    opts.status === "REFUNDED"
      ? orderRefundedEmail({ orderNumber: opts.orderNumber, siteName: config.siteName, note: opts.note })
      : opts.status === "SHIPPED"
        ? orderShippedEmail({
            orderNumber: opts.orderNumber,
            siteName: config.siteName,
            trackingNumber: opts.trackingNumber,
            carrier: opts.carrier,
            note: opts.note,
          })
        : opts.status === "DELIVERED"
          ? orderDeliveredEmail({ orderNumber: opts.orderNumber, siteName: config.siteName, note: opts.note })
          : orderCancelledEmail({ orderNumber: opts.orderNumber, siteName: config.siteName, note: opts.note });
  const past =
    opts.status === "REFUNDED"
      ? "refunded"
      : opts.status === "SHIPPED"
        ? "shipped"
        : opts.status === "DELIVERED"
          ? "delivered"
          : opts.status === "PAID"
            ? "confirmed"
            : "cancelled";
  // PAID confirmations only notify on explicit request (checkout is silent;
  // the receipt comes from payment). Ship/deliver/cancel/refund always fan out.
  const emailName = `order.${opts.status.toLowerCase()}`;
  await notifyUser({
    userId: opts.buyerId,
    type: emailName,
    title: `Order ${opts.orderNumber} ${past}`,
    body:
      opts.status === "SHIPPED" && opts.trackingNumber
        ? `Tracking: ${opts.trackingNumber}${opts.carrier ? ` via ${opts.carrier}` : ""}`
        : (opts.note ?? undefined),
    link: undefined, // buyers read the timeline on their order page; email carries detail
    meta: { entityId: opts.orderId, orderNumber: opts.orderNumber },
    email: { template, name: emailName, enabled: config.enabled && config.orderEmails },
  });
  // Admin copy (in-app for every admin, one email to the alert inbox).
  await notifyAdmins({
    type: emailName,
    title: `Order ${opts.orderNumber} ${past}`,
    link: `/ys-admin/orders/show/${opts.orderId}`,
    meta: { entityId: opts.orderId, orderNumber: opts.orderNumber },
    email: { template, name: `${emailName}.admin`, enabled: config.enabled && config.orderEmails },
  });
}

export async function notifyDisputeStatus(opts: {
  disputeId: string;
  orderNumber: string;
  buyerId: string;
  status: DisputeStatusKey;
  message?: string;
}): Promise<void> {
  const config = await getEmailConfig();
  const template = disputeStatusEmail({
    status: opts.status,
    orderNumber: opts.orderNumber,
    siteName: config.siteName,
    message: opts.message,
  });
  const label =
    opts.status === "UNDER_REVIEW"
      ? "under review"
      : opts.status === "RESOLVED_BUYER"
        ? "resolved in your favor"
        : opts.status === "RESOLVED_SELLER"
          ? "resolved in the seller's favor"
          : "closed";
  await notifyUser({
    userId: opts.buyerId,
    type: "dispute.updated",
    title: `Dispute for order ${opts.orderNumber} ${label}`,
    body: opts.message ?? undefined,
    meta: { entityId: opts.disputeId, orderNumber: opts.orderNumber, status: opts.status },
    email: { template, name: "dispute.updated", enabled: config.enabled && config.disputeEmails },
  });
  await notifyAdmins({
    type: "dispute.updated",
    title: `Dispute for order ${opts.orderNumber} → ${opts.status}`,
    link: `/ys-admin/disputes/show/${opts.disputeId}`,
    meta: { entityId: opts.disputeId, orderNumber: opts.orderNumber, status: opts.status },
    email: { template, name: "dispute.updated.admin", enabled: config.enabled && config.disputeEmails },
  });
}

export async function notifyVendorStatus(opts: {
  storeId: string;
  storeName: string;
  ownerId: string;
  status: VendorStatusKey;
  note?: string;
}): Promise<void> {
  const config = await getEmailConfig();
  const template = vendorStatusEmail({
    status: opts.status,
    storeName: opts.storeName,
    siteName: config.siteName,
    note: opts.note,
  });
  await notifyUser({
    userId: opts.ownerId,
    type: `vendor.${opts.status.toLowerCase()}`,
    title: `${opts.storeName}: ${opts.status === "APPROVED" ? "approved" : opts.status === "SUSPENDED" ? "suspended" : "rejected"}`,
    body: opts.note ?? undefined,
    meta: { entityId: opts.storeId, storeName: opts.storeName },
    email: { template, name: `vendor.${opts.status.toLowerCase()}`, enabled: config.enabled && config.vendorEmails },
  });
  await notifyAdmins({
    type: `vendor.${opts.status.toLowerCase()}`,
    title: `${opts.storeName} ${opts.status.toLowerCase()}`,
    link: `/ys-admin/vendors/show/${opts.storeId}`,
    meta: { entityId: opts.storeId, storeName: opts.storeName },
  });
}

export async function notifyProductStatus(opts: {
  productId: string;
  productTitle: string;
  storeId: string;
  storeName: string;
  ownerId: string;
  status: ProductStatusKey;
  note?: string;
}): Promise<void> {
  const config = await getEmailConfig();
  const template = productStatusEmail({
    status: opts.status,
    productTitle: opts.productTitle,
    storeName: opts.storeName,
    siteName: config.siteName,
    note: opts.note,
  });
  await notifyUser({
    userId: opts.ownerId,
    type: `product.${opts.status.toLowerCase()}`,
    title: `Product ${opts.status === "TAKEDOWN" ? "taken down" : opts.status === "ACTIVE" ? "activated" : "moved to draft"}: ${opts.productTitle}`,
    body: opts.note ?? undefined,
    meta: { entityId: opts.productId, storeId: opts.storeId },
    email: { template, name: `product.${opts.status.toLowerCase()}`, enabled: config.enabled && config.productEmails },
  });
  if (opts.status === "TAKEDOWN") {
    await notifyAdmins({
      type: "product.takedown",
      title: `Takedown: ${opts.productTitle} (${opts.storeName})`,
      link: `/ys-admin/products/show/${opts.productId}`,
      meta: { entityId: opts.productId },
    });
  }
}

export async function notifySellerRequest(opts: {
  storeId: string;
  storeName: string;
  ownerId: string;
  ownerEmail: string;
}): Promise<void> {
  const config = await getEmailConfig();
  const template = sellerRequestEmail({
    storeName: opts.storeName,
    ownerEmail: opts.ownerEmail,
    siteName: config.siteName,
  });
  await notifyAdmins({
    type: "seller.request",
    title: `New seller request: ${opts.storeName}`,
    body: `${opts.ownerEmail} applied for a seller account.`,
    link: `/ys-admin/vendors/show/${opts.storeId}`,
    meta: { entityId: opts.storeId, storeName: opts.storeName, ownerId: opts.ownerId },
    email: { template, name: "seller.request", enabled: config.enabled && config.adminAlerts },
  });
}

// ---------------------------------------------------------------------------
// Digest scanner: low stock, newly opened disputes, new reviews, failed
// payouts. Idempotent — skips entities already announced.
// ---------------------------------------------------------------------------

export type DigestResult = {
  created: number;
  emailed: boolean;
  counts: { lowStock: number; disputes: number; reviews: number; payouts: number };
};

export async function runDigest(): Promise<DigestResult> {
  const config = await getEmailConfig();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const counts = { lowStock: 0, disputes: 0, reviews: 0, payouts: 0 };
  const sections: DigestSection[] = [];
  const items: Array<Omit<NotifyInput, "userId">> = [];

  const announced = await db.notification.findMany({
    where: { type: { in: ["stock.low", "dispute.opened", "review.new", "payout.failed"] } },
    select: { type: true, meta: true, createdAt: true },
  });
  const seenEver = new Set(announced.map((n) => `${n.type}:${(n.meta as { entityId?: string } | null)?.entityId}`));
  const seenDay = new Set(
    announced.filter((n) => n.createdAt > dayAgo).map((n) => `${n.type}:${(n.meta as { entityId?: string } | null)?.entityId}`),
  );

  // 1. Low stock on active products (re-alert at most once per day).
  // Covers BOTH variant options and listing-level stock — variantless listings
  // were previously invisible to this digest.
  const [low, lowListings] = await Promise.all([
    db.productVariant.findMany({
      where: { stock: { lte: config.lowStockThreshold }, product: { status: "ACTIVE" } },
      include: { product: { select: { id: true, title: true, store: { select: { name: true } } } } },
      orderBy: { stock: "asc" },
      take: 50,
    }),
    db.product.findMany({
      where: {
        status: "ACTIVE",
        trackStock: true,
        variants: { none: {} },
        stock: { lte: config.lowStockThreshold },
      },
      select: { id: true, title: true, stock: true, store: { select: { name: true } } },
      orderBy: { stock: "asc" },
      take: 50,
    }),
  ]);
  for (const p of lowListings.filter((x) => !seenDay.has(`stock.low:${x.id}`))) {
    items.push({
      type: "stock.low",
      title: `${p.title} is running low`,
      body: `${p.store.name} — ${p.stock} left.`,
      link: `/ys-admin/products/show/${p.id}`,
      meta: { entityId: p.id, stock: p.stock, scope: "product" },
    });
  }
  const freshLow = low.filter((v) => !seenDay.has(`stock.low:${v.id}`));
  for (const v of freshLow) {
    items.push({
      type: "stock.low",
      title: `Low stock: ${v.product.title} (${v.name}) — ${v.stock} left`,
      body: `${v.product.store.name} · SKU ${v.sku ?? "—"}`,
      link: `/ys-admin/products/show/${v.product.id}`,
      meta: { entityId: v.id, stock: v.stock },
    });
  }
  if (freshLow.length > 0) {
    counts.lowStock = freshLow.length + lowListings.length;
    sections.push({
      title: `Low stock (${freshLow.length})`,
      lines: freshLow.map((v) => `${v.product.title} (${v.name}) — ${v.stock} left · ${v.product.store.name}`),
    });
  }

  // 2. Newly opened disputes (announced once ever).
  const disputes = await db.dispute.findMany({
    where: { status: "OPEN" },
    include: { order: { select: { number: true } }, buyer: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const freshDisputes = disputes.filter((d) => !seenEver.has(`dispute.opened:${d.id}`));
  for (const d of freshDisputes) {
    items.push({
      type: "dispute.opened",
      title: `New dispute on order ${d.order.number}`,
      body: `${d.buyer.email}: ${d.reason}`,
      link: `/ys-admin/disputes/show/${d.id}`,
      meta: { entityId: d.id, orderNumber: d.order.number },
    });
  }
  if (freshDisputes.length > 0) {
    counts.disputes = freshDisputes.length;
    sections.push({
      title: `New disputes (${freshDisputes.length})`,
      lines: freshDisputes.map((d) => `Order ${d.order.number} — ${d.buyer.email}: ${d.reason}`),
    });
  }

  // 3. New reviews (announced once ever).
  const reviews = await db.review.findMany({
    include: { product: { select: { title: true } }, store: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const freshReviews = reviews.filter((r) => !seenEver.has(`review.new:${r.id}`));
  for (const r of freshReviews) {
    items.push({
      type: "review.new",
      title: `New ${r.rating}★ review: ${r.product.title}`,
      body: `${r.title ?? "No title"} — ${r.store.name}`,
      link: `/ys-admin/products/show/${r.productId}`,
      meta: { entityId: r.id, rating: r.rating },
    });
  }
  if (freshReviews.length > 0) {
    counts.reviews = freshReviews.length;
    sections.push({
      title: `New reviews (${freshReviews.length})`,
      lines: freshReviews.map((r) => `${r.rating}★ on ${r.product.title} (${r.store.name})`),
    });
  }

  // 4. Failed payouts (announced once ever).
  const payouts = await db.payout.findMany({
    where: { status: "FAILED" },
    include: { store: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const freshPayouts = payouts.filter((p) => !seenEver.has(`payout.failed:${p.id}`));
  for (const p of freshPayouts) {
    items.push({
      type: "payout.failed",
      title: `Payout failed: ${p.store.name} — ${p.amount} ${p.currency}`,
      link: `/ys-admin/vendors/show/${p.storeId}`,
      meta: { entityId: p.id, amount: Number(p.amount) },
    });
  }
  if (freshPayouts.length > 0) {
    counts.payouts = freshPayouts.length;
    sections.push({
      title: `Failed payouts (${freshPayouts.length})`,
      lines: freshPayouts.map((p) => `${p.store.name} — ${p.amount} ${p.currency}`),
    });
  }

  let created = 0;
  if (items.length > 0) {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      const res = await db.notification.createMany({
        data: items.flatMap((item) =>
          admins.map((a) => ({
            userId: a.id,
            type: item.type,
            title: item.title,
            body: item.body,
            link: item.link,
            meta: (item.meta as object) ?? undefined,
          })),
        ),
      });
      created = res.count;
    }
  }

  let emailed = false;
  if (sections.length > 0 && config.enabled && config.adminAlerts && config.adminAlertEmail) {
    const result = await sendAndLog({
      to: config.adminAlertEmail,
      template: digestEmail({ siteName: config.siteName, sections }),
      meta: { template: "digest", counts },
    });
    emailed = result.ok;
  }

  return { created, emailed, counts };
}
