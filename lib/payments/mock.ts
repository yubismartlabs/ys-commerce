import type { ChargeRequest, ChargeResult, Provider, RefundResult, WebhookEvent } from "./types";

/**
 * The provider used when no real processor is configured.
 *
 * It settles synchronously and never touches the network, which is what keeps
 * the checkout tests deterministic. It is a first-class implementation rather
 * than a bypass so the same code path runs in development that runs in
 * production — a separate "test mode" branch is how mock-only bugs survive to
 * launch.
 *
 * The webhook parser accepts anything, because there is nothing to verify: no
 * signature is involved, and no request can reach it while this is the only
 * provider.
 */
export const mockProvider: Provider = {
  name: "mock",
  settlesSynchronously: true,

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    return { status: "paid", reference: `mock_${req.orderId}` };
  },

  async refund(paymentReference: string, amountCents: number): Promise<RefundResult> {
    return { ok: true, reference: `${paymentReference}_refund_${amountCents}` };
  },

  async parseWebhook(rawBody: string): Promise<WebhookEvent | null> {
    try {
      const parsed = JSON.parse(rawBody) as { id?: string; type?: string; orderId?: string };
      if (!parsed.id || !parsed.type) return null;
      return {
        id: parsed.id,
        type: parsed.type,
        orderId: parsed.orderId ?? null,
        paymentReference: null,
        amountCents: null,
      };
    } catch {
      return null;
    }
  },
};
