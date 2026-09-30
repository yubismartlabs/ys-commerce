-- Frequently-bought-together for the assistant's "pairs well with".
--
-- ProductAffinity is rebuilt from real baskets (see lib/affinity). The
-- OrderItem(productId) index makes the co-occurrence scan cheap; without it
-- the self-join seq-scans every order line. (The product FK itself already
-- exists from the original relation — only the index is new here.)
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE TABLE "ProductAffinity" (
  "id" TEXT NOT NULL,
  "aId" TEXT NOT NULL,
  "bId" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductAffinity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductAffinity_aId_bId_key" ON "ProductAffinity"("aId", "bId");
CREATE INDEX "ProductAffinity_aId_count_idx" ON "ProductAffinity"("aId", "count");
