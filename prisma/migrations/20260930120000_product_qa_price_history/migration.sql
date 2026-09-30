-- Public product Q&A and buyer price history.
--
-- HAND-WRITTEN for the same reason as 20260929120000: "Product"."search" is a
-- GENERATED ALWAYS STORED tsvector backing the GIN indexes the search engine
-- ranks against. Prisma cannot model generated columns, so a generated
-- migration drops the column and both indexes, silently disabling full-text
-- search. Those statements are deliberately omitted.

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "fromSeller" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "compareAt" DECIMAL(10,2),
    "source" TEXT NOT NULL DEFAULT 'edit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductQuestion_productId_authorId_key" ON "ProductQuestion"("productId", "authorId");
CREATE INDEX "ProductQuestion_productId_hidden_createdAt_idx" ON "ProductQuestion"("productId", "hidden", "createdAt");
CREATE INDEX "ProductQuestion_storeId_createdAt_idx" ON "ProductQuestion"("storeId", "createdAt");
CREATE INDEX "ProductAnswer_questionId_createdAt_idx" ON "ProductAnswer"("questionId", "createdAt");
CREATE INDEX "PriceSnapshot_productId_createdAt_idx" ON "PriceSnapshot"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ProductQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAnswer" ADD CONSTRAINT "ProductAnswer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed an opening snapshot per product so the price-history chart has a
-- baseline on day one rather than starting blank.
INSERT INTO "PriceSnapshot" ("id", "productId", "price", "compareAt", "source", "createdAt")
SELECT
    md5(p.id || 'initial') AS id,
    p.id,
    p.price,
    p."compareAt",
    'initial',
    now()
FROM "Product" p
WHERE p.price IS NOT NULL;
