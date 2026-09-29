-- DropForeignKey
ALTER TABLE "KeyEnvelope" DROP CONSTRAINT "KeyEnvelope_conversationId_fkey";

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "imageNonce",
DROP COLUMN "keyVersion",
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flaggedKinds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "keyId" TEXT NOT NULL DEFAULT '1';

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "reportEvidence";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "identityBackup",
DROP COLUMN "identityKey";

-- DropTable
DROP TABLE "KeyEnvelope";

-- CreateIndex
CREATE INDEX "ChatMessage_flagged_createdAt_idx" ON "ChatMessage"("flagged", "createdAt");

