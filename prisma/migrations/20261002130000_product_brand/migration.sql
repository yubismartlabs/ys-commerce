-- Seller-declared brand for assistant grouping ("Top Apple").
--
-- Nullable with no backfill: existing listings simply group under their
-- category until a seller sets one. Additive only, touches nothing existing.
ALTER TABLE "Product" ADD COLUMN "brand" TEXT;
