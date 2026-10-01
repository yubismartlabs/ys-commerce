-- Store @handles: public username per store, shown as /store/@username.
-- Slug stays the immutable legacy key (old /store/<slug> links redirect).
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "usernameChangeCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Store_username_key" ON "Store"("username");
