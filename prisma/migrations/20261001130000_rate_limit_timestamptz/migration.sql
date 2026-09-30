-- Move the rate-limit window columns to timestamptz.
--
-- These are absolute instants. Stored as `timestamp without time zone`, a JS
-- Date passed through $queryRaw was written shifted by the server's UTC offset
-- (four hours behind in the dev environment), so current windows compared as
-- already expired and pruning deleted live buckets -- turning rate limiting off
-- with no error anywhere. timestamptz stores the instant unambiguously.
--
-- Existing rows are re-interpreted at UTC, which is the correct reading of what
-- the old column intended; any skew self-corrects within one window.
ALTER TABLE "RateLimitBucket"
  ALTER COLUMN "windowStart" TYPE TIMESTAMPTZ(3) USING "windowStart" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt"  TYPE TIMESTAMPTZ(3) USING "updatedAt"  AT TIME ZONE 'UTC';
