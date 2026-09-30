/**
 * Payment provider contract.
 *
 * The rest of the app talks only to this interface, so adding a provider means
 * adding a file and an enum case — not touching checkout, orders, or refunds.
 * That seam is what makes it possible to drop the Stripe and PayPal
 * implementations and keep the surrounding code intact: they were built against
 * this interface and nothing else, so removing them cost one file each.
 *
 * What a provider implementation owes the rest of the app:
 *
 * 1. It decides nothing about the order. The amount is computed here from the
 *    resolved cart and sent to the provider; the provider's response is a
 *    *status*, never a price. A provider that could change the amount would let
 *    a tampered request set its own total.
 * 2. Confirmation is asynchronous and arrives out of band. An order is only
 *    marked paid from a verified webhook, never from the browser's say-so — a
 *    browser returning from a payment page is a hint, not proof.
 *
 * Both rules are currently unexercised, because the only implementation is the
 * mock. They are written down here so the first real provider does not have to
 * rediscover them.
 */

export type PaymentProviderName = "mock";

/** What we tell the provider to charge. */
export type ChargeRequest = {
  orderId: string;
  orderNumber: string;
  /** Minor units (cents). Integers only — never a float. */
  amountCents: number;
  currency: string;
  buyerEmail: string;
  description: string;
  /** Where the buyer returns after approving. */
  returnUrl: string;
  cancelUrl: string;
  /** Free-form, echoed back on the webhook so we can match the order. */
  metadata: Record<string, string>;
};

export type ChargeResult =
  | {
      /** The buyer must act before we can confirm payment. */
      status: "requires_action";
      /** Opaque handle stored for later confirmation or refund. */
      reference: string;
      /** Stripe: client secret for the Payment Element. */
      clientSecret?: string;
      /** PayPal: approval URL to redirect the buyer to. */
      approvalUrl?: string;
    }
  | {
      /** Settled immediately (the mock provider). */
      status: "paid";
      reference: string;
    };

export type RefundResult = {
  ok: boolean;
  reference: string;
  /** Present when the refund failed, for the audit trail. */
  error?: string;
};

export type WebhookEvent = {
  /** Provider-specific event id, for idempotency. */
  id: string;
  type: string;
  /** Our order id, recovered from provider metadata. */
  orderId: string | null;
  /** Provider reference (payment intent id, PayPal capture id). */
  paymentReference: string | null;
  /** Minor units actually captured, when the provider tells us. */
  amountCents: number | null;
};

export type Provider = {
  name: PaymentProviderName | (string & {});
  /** True when a charge settles without a webhook. */
  settlesSynchronously: boolean;
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund(paymentReference: string, amountCents: number, idempotencyKey: string): Promise<RefundResult>;
  /**
   * Verify and parse a webhook. Must return null for anything not authentically
   * signed by the provider — a forged "payment succeeded" is the whole attack.
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
};

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly code: string = "PAYMENT"
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/** Minor units from a decimal string or number, without float drift. */
export function toCents(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
