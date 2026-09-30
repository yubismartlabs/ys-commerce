# Test-catalog importer (scraped, temporary)

**Status: test data only. Remove or re-license before production.**

## Why this exists

Real listings (real brands, specs, variants, images) exercise the
storefront, search, and AI assistant the way mock rows cannot. The operator
confirmed scraped output will be removed before production.

## Terms & limits (read before running)

- Amazon, AliExpress, and eBay prohibit automated collection in their terms
  and run bot defenses. This importer is deliberately polite and dumb:
  single-threaded, ~1 request per 2.5s, desktop user-agent, obeys robots
  signals, **stops at the first block** (403/429/CAPTCHA marker) with no
  evasion, no proxy rotation, no CAPTCHA solving.
- Images and copy belong to their owners. Rows are hotlinked (never copied
  locally) and every row carries `source`/`sourceUrl`/`externalId`.
- Never run this from production infrastructure or on a schedule.

## Usage

```bash
# Report only: fetch + parse + normalize, print the plan, write nothing.
npx tsx --tsconfig tsconfig.json scripts/import-catalog/run.ts --dry --limit 20

# Import: upserts by externalId into the dev database on house stores.
npx tsx --tsconfig tsconfig.json scripts/import-catalog/run.ts --import --limit 100
```

`--limit` caps total products across all sites/categories.

## Removal

```sql
DELETE FROM "Product" WHERE source IS NOT NULL;
```

then drop the provenance columns (or keep them for licensed feeds).
