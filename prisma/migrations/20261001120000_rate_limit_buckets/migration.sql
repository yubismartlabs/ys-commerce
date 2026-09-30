-- Fixed-window rate-limit counters.
--
-- Keyed by (key, windowStart) so each window is its own row and old windows
-- are removed by a plain time-range delete. `count` is the number of attempts
-- seen in that window.
CREATE TABLE "RateLimitBucket" (
    "key"         TEXT        NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count"       INTEGER     NOT NULL DEFAULT 0,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key", "windowStart")
);

-- Supports the pruning sweep over expired windows.
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket" ("windowStart");
