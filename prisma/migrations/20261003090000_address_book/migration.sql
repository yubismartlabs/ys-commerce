-- Buyer address book (eBay-style): several saved addresses, one default.
--
-- The order keeps a SNAPSHOT of the address, never a hard reference: an order
-- is a record of where a parcel went and must survive the buyer editing or
-- deleting the saved address. `addressId` is a plain column with no foreign
-- key for exactly that reason — a cascade here would rewrite order history.
--
-- shipStreet/shipZip are renamed rather than dropped and re-added so existing
-- orders keep their address data.
CREATE TABLE IF NOT EXISTS "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Address_userId_isDefault_idx" ON "Address"("userId", "isDefault");

-- One default per buyer, enforced by the database as well as in code. Postgres
-- allows multiple NULLs in a unique index, so plain (userId, isDefault) would
-- still permit two rows with isDefault = false; the WHERE clause narrows it to
-- only the rows that claim the flag.
CREATE UNIQUE INDEX IF NOT EXISTS "Address_one_default_per_user"
    ON "Address"("userId") WHERE "isDefault" = true;

ALTER TABLE "Address"
    ADD CONSTRAINT "Address_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "addressId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipLine2" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipRegion" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipCountry" TEXT;

-- Preserve the addresses already recorded on past orders.
ALTER TABLE "Order" RENAME COLUMN "shipStreet" TO "shipLine1";
ALTER TABLE "Order" RENAME COLUMN "shipZip" TO "shipPostalCode";

-- Orders placed before the address book existed have no country on file. They
-- were all placed through the US-only mock checkout, so backfilling US is
-- accurate rather than a guess.
UPDATE "Order" SET "shipCountry" = 'US' WHERE "shipCountry" IS NULL;