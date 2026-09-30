-- Test-catalog provenance for scraped rows (see scripts/import-catalog).
--
-- Nullable so seller listings are unaffected. externalId makes re-imports
-- idempotent. All three columns are dropped with the scraped rows before
-- production (or kept for licensed-feed provenance — operator's call).
ALTER TABLE "Product" ADD COLUMN "source" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId") WHERE "externalId" IS NOT NULL;
