-- Buyer reports on listings for trust & safety review.
-- Kept as rows (not a counter) so each report keeps its reason, reporter and
-- timestamp. No unique constraint on (productId, reporterId): re-reporting
-- after a dismissal is how an unaddressed listing resurfaces.
CREATE TYPE "ProductReportReason" AS ENUM ('COUNTERFEIT', 'PROHIBITED', 'MISLEADING', 'WRONG_CATEGORY', 'OFFENSIVE', 'OTHER');
CREATE TYPE "ProductReportStatus" AS ENUM ('OPEN', 'DISMISSED');

CREATE TABLE IF NOT EXISTS "ProductReport" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ProductReportReason" NOT NULL,
    "detail" TEXT,
    "status" "ProductReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductReport_productId_status_idx" ON "ProductReport"("productId", "status");
CREATE INDEX IF NOT EXISTS "ProductReport_status_createdAt_idx" ON "ProductReport"("status", "createdAt");

ALTER TABLE "ProductReport"
    ADD CONSTRAINT "ProductReport_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReport"
    ADD CONSTRAINT "ProductReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
