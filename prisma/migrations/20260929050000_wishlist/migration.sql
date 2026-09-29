-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('PRICE_DROP', 'RESTOCK');

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "target" DECIMAL(10,2),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_userId_createdAt_idx" ON "WishlistItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_sentAt_idx" ON "PriceAlert"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "PriceAlert_productId_kind_sentAt_idx" ON "PriceAlert"("productId", "kind", "sentAt");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

