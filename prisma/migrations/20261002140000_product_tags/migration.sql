-- Use-case tags for mission answers ("offgrid", "camping", "gaming").
--
-- A plain text array, deliberately NOT folded into the Product.search
-- tsvector: that column is GENERATED and hand-managed (see README), so
-- tag matching happens as an overlap lookup in the assistant instead.
-- Sellers set tags on the listing form; empty keeps current behaviour.
ALTER TABLE "Product" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
