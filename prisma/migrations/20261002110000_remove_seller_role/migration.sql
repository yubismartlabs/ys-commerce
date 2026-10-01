-- No more SELLER role: anyone can open a store and list. Seller-ness is
-- derived from Store.ownerId, never from User.role. Existing sellers fold
-- back into BUYER (they keep their stores, handles and listings).
UPDATE "User" SET "role" = 'BUYER' WHERE "role" = 'SELLER';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('BUYER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'BUYER';
DROP TYPE "Role_old";
