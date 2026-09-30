-- Shopping-assistant thread: one persistent conversation per buyer, so the
-- assistant greets by name and keeps context across sessions (Alexa-style
-- continuity), plus +1/-1 votes on answers to tune future replies.
--
-- Deliberately a flat message log, not conversations-with-messages: the drawer
-- is a single thread per buyer, and a second table would buy nothing.
-- `content` holds the buyer's own shopping questions only — never payment
-- data or secrets. `citations` is the AiCitation JSON rendered as product
-- cards, snapshotted per answer so history still shows cards.
-- Hand-written (see README): additive only, touches nothing existing.
CREATE TYPE "AiRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AiRole" NOT NULL,
  "content" TEXT NOT NULL,
  "citations" JSONB,
  "feedback" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiMessage_userId_createdAt_idx" ON "AiMessage"("userId", "createdAt");

ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
