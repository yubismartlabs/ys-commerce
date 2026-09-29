export type EmailTemplate = { subject: string; html: string; text: string };

function layout(title: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#18181b">` +
    `<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>` +
    `<div style="font-size:14px;line-height:1.6">${body}</div>` +
    `</div>`;
}

function textify(title: string, lines: string[]): string {
  return [title, "", ...lines].join("\n");
}

export function orderCancelledEmail(opts: { orderNumber: string; siteName: string; note?: string }): EmailTemplate {
  const title = `Order ${opts.orderNumber} was cancelled`;
  const body =
    `<p>Your order <strong>${opts.orderNumber}</strong> on ${opts.siteName} was cancelled.</p>` +
    (opts.note ? `<p>Note from our team: ${opts.note}</p>` : "") +
    `<p>If you were charged, a refund will follow automatically.</p>`;
  return {
    subject: `[${opts.siteName}] Order ${opts.orderNumber} cancelled`,
    html: layout(title, body),
    text: textify(title, [
      `Your order ${opts.orderNumber} on ${opts.siteName} was cancelled.`,
      ...(opts.note ? [`Note from our team: ${opts.note}`] : []),
      "If you were charged, a refund will follow automatically.",
    ]),
  };
}

export function orderShippedEmail(opts: {
  orderNumber: string;
  siteName: string;
  trackingNumber?: string;
  carrier?: string;
  note?: string;
}): EmailTemplate {
  const title = `Order ${opts.orderNumber} shipped`;
  const tracking =
    opts.trackingNumber || opts.carrier
      ? `<p>Tracking: <strong>${opts.trackingNumber ?? "—"}</strong>${opts.carrier ? ` via ${opts.carrier}` : ""}</p>`
      : "";
  const body =
    `<p>Good news — your order <strong>${opts.orderNumber}</strong> on ${opts.siteName} is on its way.</p>` +
    tracking +
    (opts.note ? `<p>Note from the seller: ${opts.note}</p>` : "");
  return {
    subject: `[${opts.siteName}] Order ${opts.orderNumber} shipped`,
    html: layout(title, body),
    text: textify(title, [
      `Your order ${opts.orderNumber} on ${opts.siteName} is on its way.`,
      ...(opts.trackingNumber ? [`Tracking: ${opts.trackingNumber}${opts.carrier ? ` via ${opts.carrier}` : ""}`] : []),
      ...(opts.note ? [`Note from the seller: ${opts.note}`] : []),
    ]),
  };
}

export function orderDeliveredEmail(opts: { orderNumber: string; siteName: string; note?: string }): EmailTemplate {
  const title = `Order ${opts.orderNumber} delivered`;
  const body =
    `<p>Your order <strong>${opts.orderNumber}</strong> on ${opts.siteName} was delivered. Enjoy!</p>` +
    (opts.note ? `<p>Note: ${opts.note}</p>` : "") +
    `<p>Something wrong? Open a dispute from your account.</p>`;
  return {
    subject: `[${opts.siteName}] Order ${opts.orderNumber} delivered`,
    html: layout(title, body),
    text: textify(title, [
      `Your order ${opts.orderNumber} on ${opts.siteName} was delivered.`,
      ...(opts.note ? [`Note: ${opts.note}`] : []),
    ]),
  };
} 

export function orderRefundedEmail(opts: { orderNumber: string; siteName: string; note?: string }): EmailTemplate {
  const title = `Order ${opts.orderNumber} was refunded`;
  const body =
    `<p>Your order <strong>${opts.orderNumber}</strong> on ${opts.siteName} was refunded.</p>` +
    (opts.note ? `<p>Note from our team: ${opts.note}</p>` : "") +
    `<p>The amount should appear on your original payment method within 5–10 business days.</p>`;
  return {
    subject: `[${opts.siteName}] Order ${opts.orderNumber} refunded`,
    html: layout(title, body),
    text: textify(title, [
      `Your order ${opts.orderNumber} on ${opts.siteName} was refunded.`,
      ...(opts.note ? [`Note from our team: ${opts.note}`] : []),
      "The amount should appear on your original payment method within 5–10 business days.",
    ]),
  };
}

export type DisputeStatusKey = "UNDER_REVIEW" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CLOSED";

export function disputeStatusEmail(opts: {
  status: DisputeStatusKey;
  orderNumber: string;
  siteName: string;
  message?: string;
}): EmailTemplate {
  const statusLabel =
    opts.status === "UNDER_REVIEW"
      ? "under review"
      : opts.status === "RESOLVED_BUYER"
        ? "resolved in your favor"
        : opts.status === "RESOLVED_SELLER"
          ? "resolved in the seller's favor"
          : "closed";
  const title = `Dispute for order ${opts.orderNumber} is ${statusLabel}`;
  const body =
    `<p>The dispute on order <strong>${opts.orderNumber}</strong> (${opts.siteName}) is now <strong>${statusLabel}</strong>.</p>` +
    (opts.message ? `<p>Message from our team: ${opts.message}</p>` : "");
  return {
    subject: `[${opts.siteName}] Dispute update for order ${opts.orderNumber}`,
    html: layout(title, body),
    text: textify(title, [
      `The dispute on order ${opts.orderNumber} (${opts.siteName}) is now ${statusLabel}.`,
      ...(opts.message ? [`Message from our team: ${opts.message}`] : []),
    ]),
  };
}

export type VendorStatusKey = "APPROVED" | "SUSPENDED" | "REJECTED";

export function vendorStatusEmail(opts: {
  status: VendorStatusKey;
  storeName: string;
  siteName: string;
  note?: string;
}): EmailTemplate {
  const title =
    opts.status === "APPROVED"
      ? `${opts.storeName} is approved`
      : opts.status === "SUSPENDED"
        ? `${opts.storeName} is suspended`
        : `${opts.storeName} application update`;
  const detail =
    opts.status === "APPROVED"
      ? `Your store <strong>${opts.storeName}</strong> on ${opts.siteName} is approved and can sell.`
      : opts.status === "SUSPENDED"
        ? `Your store <strong>${opts.storeName}</strong> on ${opts.siteName} is suspended. Contact support to appeal.`
        : `Your store application <strong>${opts.storeName}</strong> on ${opts.siteName} was not approved.`;
  const body = `<p>${detail}</p>` + (opts.note ? `<p>Note from our team: ${opts.note}</p>` : "");
  return {
    subject: `[${opts.siteName}] ${title}`,
    html: layout(title, body),
    text: textify(title, [
      detail.replace(/<[^>]+>/g, ""),
      ...(opts.note ? [`Note from our team: ${opts.note}`] : []),
    ]),
  };
}

export function testEmail(opts: { siteName: string }): EmailTemplate {
  const title = `${opts.siteName} email is working`;
  const body = `<p>This is a test message from the ${opts.siteName} admin. Resend is configured correctly.</p>`;
  return {
    subject: `[${opts.siteName}] Test email`,
    html: layout(title, body),
    text: textify(title, [`Resend is configured correctly.`]),
  };
}

export type ProductStatusKey = "DRAFT" | "ACTIVE" | "TAKEDOWN";

export function productStatusEmail(opts: {
  status: ProductStatusKey;
  productTitle: string;
  storeName: string;
  siteName: string;
  note?: string;
}): EmailTemplate {
  const verb = opts.status === "TAKEDOWN" ? "taken down" : opts.status === "ACTIVE" ? "activated" : "moved to draft";
  const title = `Product ${verb}: ${opts.productTitle}`;
  const body =
    `<p>Your product <strong>${opts.productTitle}</strong> (${opts.storeName} on ${opts.siteName}) was <strong>${verb}</strong>.</p>` +
    (opts.note ? `<p>Note from our team: ${opts.note}</p>` : "") +
    (opts.status === "TAKEDOWN" ? `<p>Contact support if you think this is a mistake.</p>` : "");
  return {
    subject: `[${opts.siteName}] Product ${verb}`,
    html: layout(title, body),
    text: textify(title, [
      `Your product ${opts.productTitle} (${opts.storeName} on ${opts.siteName}) was ${verb}.`,
      ...(opts.note ? [`Note from our team: ${opts.note}`] : []),
    ]),
  };
}

export function sellerRequestEmail(opts: {
  storeName: string;
  ownerEmail: string;
  siteName: string;
}): EmailTemplate {
  const title = `New seller request: ${opts.storeName}`;
  const body =
    `<p><strong>${opts.ownerEmail}</strong> requested a seller account for <strong>${opts.storeName}</strong> on ${opts.siteName}.</p>` +
    `<p>Review it in ys-admin → Vendors.</p>`;
  return {
    subject: `[${opts.siteName}] New seller request: ${opts.storeName}`,
    html: layout(title, body),
    text: textify(title, [
      `${opts.ownerEmail} requested a seller account for ${opts.storeName} on ${opts.siteName}.`,
      "Review it in ys-admin → Vendors.",
    ]),
  };
}

export function disputeOpenedEmail(opts: {
  orderNumber: string;
  buyerEmail: string;
  reason: string;
  siteName: string;
}): EmailTemplate {
  const title = `New dispute on order ${opts.orderNumber}`;
  const body =
    `<p><strong>${opts.buyerEmail}</strong> opened a dispute on order <strong>${opts.orderNumber}</strong> (${opts.siteName}).</p>` +
    `<p>Reason: ${opts.reason}</p>`;
  return {
    subject: `[${opts.siteName}] New dispute on order ${opts.orderNumber}`,
    html: layout(title, body),
    text: textify(title, [
      `${opts.buyerEmail} opened a dispute on order ${opts.orderNumber} (${opts.siteName}).`,
      `Reason: ${opts.reason}`,
    ]),
  };
}

export type DigestSection = { title: string; lines: string[] };

export function digestEmail(opts: { siteName: string; sections: DigestSection[] }): EmailTemplate {
  const title = `${opts.siteName} digest: ${opts.sections.reduce((n, s) => n + s.lines.length, 0)} items need attention`;
  const body = opts.sections
    .map((s) => `<h2 style="font-size:15px;margin:16px 0 6px">${s.title}</h2><ul>${s.lines.map((l) => `<li>${l}</li>`).join("")}</ul>`)
    .join("");
  return {
    subject: `[${opts.siteName}] Ops digest`,
    html: layout(title, body),
    text: textify(
      title,
      opts.sections.flatMap((s) => [``, `${s.title}:`, ...s.lines.map((l) => ` - ${l}`)]),
    ),
  };
}

export function accountSuspendedEmail(opts: { siteName: string; reason?: string }): EmailTemplate {
  const title = `Your ${opts.siteName} account is suspended`;
  const body =
    `<p>Your account on ${opts.siteName} has been suspended and you can no longer sign in.</p>` +
    (opts.reason ? `<p>Reason: ${opts.reason}</p>` : "") +
    `<p>If you think this is a mistake, reply to this email to appeal.</p>`;
  return {
    subject: `[${opts.siteName}] Account suspended`,
    html: layout(title, body),
    text: textify(title, [
      `Your account on ${opts.siteName} has been suspended.`,
      ...(opts.reason ? [`Reason: ${opts.reason}`] : []),
    ]),
  };
}

export function accountReinstatedEmail(opts: { siteName: string }): EmailTemplate {
  const title = `Your ${opts.siteName} account is restored`;
  const body = `<p>Good news — your account on ${opts.siteName} is active again. You can sign in normally.</p>`;
  return {
    subject: `[${opts.siteName}] Account restored`,
    html: layout(title, body),
    text: textify(title, [`Your account on ${opts.siteName} is active again.`]),
  };
}

export function adminPasswordResetEmail(opts: { siteName: string; tempPassword: string }): EmailTemplate {
  const title = `Your ${opts.siteName} password was reset`;
  const body =
    `<p>An admin reset your password. Your temporary password is:</p>` +
    `<p style="font-family:monospace;font-size:18px;font-weight:bold">${opts.tempPassword}</p>` +
    `<p>Sign in and change it immediately from Account → Settings.</p>`;
  return {
    subject: `[${opts.siteName}] Password reset by admin`,
    html: layout(title, body),
    text: textify(title, [
      `Temporary password: ${opts.tempPassword}`,
      "Sign in and change it immediately.",
    ]),
  };
}

export function accountInviteEmail(opts: { siteName: string; tempPassword: string; role: string }): EmailTemplate {
  const title = `Your ${opts.siteName} ${opts.role.toLowerCase()} account`;
  const body =
    `<p>An admin created a ${opts.role.toLowerCase()} account for you on ${opts.siteName}.</p>` +
    `<p>Sign in with this temporary password:</p>` +
    `<p style="font-family:monospace;font-size:18px;font-weight:bold">${opts.tempPassword}</p>` +
    `<p>Change it immediately from Account → Settings.</p>`;
  return {
    subject: `[${opts.siteName}] Your new account`,
    html: layout(title, body),
    text: textify(title, [
      `Temporary password: ${opts.tempPassword}`,
      "Sign in and change it immediately.",
    ]),
  };
}
