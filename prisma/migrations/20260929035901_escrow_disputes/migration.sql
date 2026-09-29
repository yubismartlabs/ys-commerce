-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('NOT_RECEIVED', 'DAMAGED', 'WRONG_ITEM', 'QUALITY', 'NOT_AS_DESCRIBED', 'OTHER');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'FROZEN', 'RELEASED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "category" "DisputeCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DisputeMessage" ADD COLUMN     "authorId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "protectionUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EscrowHold" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "gross" DECIMAL(10,2) NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL,
    "net" DECIMAL(10,2) NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowHold_orderItemId_key" ON "EscrowHold"("orderItemId");

-- CreateIndex
CREATE INDEX "EscrowHold_orderId_idx" ON "EscrowHold"("orderId");

-- CreateIndex
CREATE INDEX "EscrowHold_storeId_status_idx" ON "EscrowHold"("storeId", "status");

-- CreateIndex
CREATE INDEX "EscrowHold_status_createdAt_idx" ON "EscrowHold"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");
