-- Usernames: eBay-style handles. Auto-generated at signup, custom-claimable
-- only when opening a store. Nullable so pre-username rows keep working;
-- Postgres UNIQUE allows multiple NULLs, binding only real handles.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Backfill guard: nothing to update on a fresh DB; existing rows get handles
-- from scripts/backfill-usernames.ts (run after deploy, before enforcing NOT NULL
-- if you ever choose to).

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
