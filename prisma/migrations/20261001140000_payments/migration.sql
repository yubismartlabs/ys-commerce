-- Payment records.
--
-- One row per attempt, so a retried charge is visible rather than hidden, and
-- the provider's own reference is stored for later refunds. `amountCents` is an
-- integer: money is never a float anywhere in this path.
--
-- `providerEventId` records the webhook that settled this payment, which makes
-- webhook handling idempotent — a redelivery is recognised and ignored instead
-- of marking an order paid twice.
CREATE TABLE "Payment" (
    "id"               TEXT        NOT NULL,
    "orderId"          TEXT        NOT NULL,
    "provider"         TEXT        NOT NULL,
    "providerRef"      TEXT,
    "amountCents"      INTEGER     NOT NULL,
    "currency"         TEXT        NOT NULL DEFAULT 'USD',
    "status"           TEXT        NOT NULL DEFAULT 'PENDING',
    "failureReason"    TEXT,
    "providerEventId"  TEXT,
    "refundedCents"    INTEGER     NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_status_check" CHECK ("status" IN ('PENDING','REQUIRES_ACTION','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')),
    CONSTRAINT "Payment_amount_check" CHECK ("amountCents" >= 0),
    CONSTRAINT "Payment_refunded_check" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "amountCents")
);

CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");
-- Webhook redelivery lookup.
CREATE UNIQUE INDEX "Payment_providerEventId_key" ON "Payment"("providerEventId") WHERE "providerEventId" IS NOT NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;

-- Orders charged by a real provider start PENDING and are only marked PAID
-- once a verified webhook arrives. The previous default was PAID, which is
-- correct for the mock provider (it settles synchronously) and is set
-- explicitly there now.
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
