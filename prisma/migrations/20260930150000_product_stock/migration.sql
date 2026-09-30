-- Product-level stock for listings that have no variants.
--
-- A product with variants always tracked stock through ProductVariant, but a
-- variantless listing had no stock field at all: it was implicitly unlimited,
-- invisible to the low-stock digest, and sellable without limit.
--
-- "trackStock" is opt-in and defaults to false so existing listings keep their
-- current behaviour until a seller deliberately turns tracking on.
--
-- HAND-WRITTEN for the same reason as the previous two migrations:
-- "Product"."search" is a GENERATED ALWAYS STORED tsvector backing the GIN
-- indexes the search engine ranks against. A generated migration drops the
-- column and both indexes, silently disabling full-text search.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: supports the storefront's in-stock filter and the seller
-- low-stock query without scanning every row.
CREATE INDEX "Product_trackStock_stock_idx" ON "Product"("trackStock", "stock");

-- Seed listings that have no variants so they start from a sensible non-zero
-- quantity rather than immediately reading as sold out once tracking is on.
-- 1000 is a deliberately non-zero baseline; the seller is expected to set the
-- real number when they switch tracking on.
UPDATE "Product" p
SET "stock" = 1000
WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id);
