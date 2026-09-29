-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dealPrice" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "stockCap" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "status" "DealStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartSnapshot" (
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deal_productId_key" ON "Deal"("productId");

-- CreateIndex
CREATE INDEX "Deal_status_startsAt_idx" ON "Deal"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Deal_status_endsAt_idx" ON "Deal"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

