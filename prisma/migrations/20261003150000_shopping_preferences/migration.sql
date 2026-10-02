-- Shopping preferences: sizes and brands the buyer wants surfaced back to them.
--
-- Values are free text rather than an enum, because "size" means footwear in
-- one category and waist in another. Deduplication is case-insensitive, so the
-- unique index is on LOWER(value) — a plain (userId, kind, value) unique would
-- happily store both "Nike" and "nike" and then match only one of them.
CREATE TYPE "PreferenceKind" AS ENUM ('SIZE', 'BRAND');

CREATE TABLE IF NOT EXISTS "ShoppingPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PreferenceKind" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ShoppingPreference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShoppingPreference_userId_kind_idx" ON "ShoppingPreference"("userId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingPreference_userId_kind_value_key"
    ON "ShoppingPreference"("userId", "kind", LOWER("value"));

ALTER TABLE "ShoppingPreference"
    ADD CONSTRAINT "ShoppingPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
