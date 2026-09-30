-- Curated mission packs for mission-style questions ("robust off-grid
-- network"). Editorial bundling; resolved to live products at ask time.
-- Additive only.
CREATE TABLE "Mission" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "triggers" TEXT[] NOT NULL DEFAULT '{}',
  "slots" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Mission_slug_key" ON "Mission"("slug");
