-- Per-buyer browse history for "Recently viewed" (My YS -> Activity).
--
-- One row per (buyer, product) rather than per visit: re-viewing bumps
-- viewedAt, so the list is a recency order and the table cannot grow with
-- traffic. Both foreign keys cascade, so deleting an account or a listing
-- leaves no orphaned history behind.
CREATE TABLE IF NOT EXISTS "ProductView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductView_userId_productId_key" ON "ProductView"("userId", "productId");

-- Serves the page's only query: newest first, for one buyer.
CREATE INDEX IF NOT EXISTS "ProductView_userId_viewedAt_idx" ON "ProductView"("userId", "viewedAt");

ALTER TABLE "ProductView"
    ADD CONSTRAINT "ProductView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductView"
    ADD CONSTRAINT "ProductView_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
