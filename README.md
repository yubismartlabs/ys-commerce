# ys-commerce

A multi-vendor marketplace (AliExpress/eBay-shaped) built with Next.js 16 (App Router), React 19, Prisma and PostgreSQL.

Sellers open stores, list products with variants and flash deals, and get paid through escrow with a buyer-protection window. Buyers browse, search with typo tolerance, use coupons, message sellers over E2EE chat, and file disputes.

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run db:migrate
npm run db:seed           # creates a demo admin + catalogue
npm run dev
```

Storefront: <http://localhost:3000> · Admin console: <http://localhost:3000/ys-admin>

The seed prints the admin email/password. Dev-only credentials are in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `AUTH_SECRET` | yes | Auth.js signing secret. Generate per environment: `openssl rand -base64 32`. |
| `MESSAGE_ENCRYPTION_KEY` | yes | Key used to seal chat message bodies at rest. Auto-generates a dev default — **set this explicitly in production** or existing messages become unreadable when it rotates. |
| `IMAGE_HOSTS` | in production | Comma-separated hosts allowed for product/store/site images, e.g. `my-bucket.r2.cloudflarestorage.com`. See below. |
| `NEXT_PUBLIC_SITE_URL` | in production | Absolute origin used by `sitemap.xml` and `robots.txt`. |
| `AUTH_TRUST_HOST` | when deploying | `true` behind a proxy or on a non-localhost host — otherwise Auth.js rejects every request with `UntrustedHost`. |
| `UPLOAD_DIR` | no | Where chat uploads are written. Defaults to `public/uploads/chat`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed only | Demo admin credentials created by `db:seed`. |

### Images and the `IMAGE_HOSTS` allowlist

`next/image` **throws during render** if it is handed a URL whose host is not in `images.remotePatterns`. Sellers paste their own image URLs, so an unconfigured host used to be able to take down every page that rendered a product image.

`lib/images.ts` is the single source of truth and enforces this in three places:

1. **`next.config.ts`** builds `remotePatterns` from `allowedImageHosts()`.
2. **Save time** — product and store schemas reject a URL on a host outside the allowlist, with a message naming the permitted hosts.
3. **Read time** — `serialize()` in `lib/api/http.ts` rewrites any disallowed URL to `/placeholder-product.svg`, and the server-side loaders do the same. A legacy bad row renders a placeholder instead of crashing the page.

`picsum.photos` is allowed by default so a fresh seed works with no configuration. In production, set `IMAGE_HOSTS` to your object-store/CDN hostname. To add seller file uploads (rather than pasted URLs) point that hostname at your bucket and wire an upload endpoint to it.

---

## Migrations — read this before running `prisma migrate dev`

> **`Product.search` must not be dropped.**
>
> It is a `GENERATED ALWAYS AS ... STORED` `tsvector` created by a hand-written
> migration, backing the GIN index (`Product_search_idx`) that
> `lib/search/engine.ts` ranks every search against. Prisma cannot model
> generated columns, so a *generated* migration proposes dropping the column
> and both search indexes — which silently disables full-text search while
> every query still succeeds and returns the wrong rows.
>
> It is declared as `search Unsupported("tsvector")?` in `schema.prisma` so at
> least the column is visible to Prisma. `migrate deploy` only replays
> migration files, so **production is safe**. The risk is local
> `prisma migrate dev`: always read the generated SQL before applying it.
>
> If it does get dropped, restore it with the statements in
> `prisma/migrations/20260929054000_search_fts/migration.sql`.

Because of this, migrations that need judgement (data backfills, destructive
drops) are written by hand. `20260929120000_split_shipments_and_returns` is the
worked example: it backfills existing orders into `Shipment` rows before
dropping the order-level tracking columns.

---

## Architecture notes

**Route layout.** `/` , `/search`, `/cart`, `/product/*`, `/store/*`, `/account/*`, `/selling/*` live in the `(marketplace)` group (no URL segment). `/ys-admin/*` is a separate staff console gated by `middleware.ts`. `/maintenance` is a holding page.

**Server vs client.** Public product/store pages are React Server Components so they can call `notFound()` and emit `generateMetadata`; interactive halves are client components (`components/products/product-view.tsx`). Admin and account screens are client components that fetch from `/api/v1/*` via TanStack Query.

**API.** `/api/v1/*` route handlers return a consistent envelope (`{ data, pagination, meta }` or `{ error: { code, message } }`) from `lib/api/http.ts`. `serialize()` normalizes Prisma Decimals/Dates and sanitizes image URLs for every response.

**Authorization.** Session JWTs carry `role` + `scopes`. Admin routes are gated twice: `middleware.ts` by path→area, and `withAdmin(handler, area)` in the handler. The API re-reads the principal from the database on every call, so a scope change takes effect immediately even though the JWT is only refreshed on sign-in.

**Money.** Checkout re-validates the coupon and stock *inside* the transaction, takes prices from `resolveCart` (never the client payload), and locks each seller's net in `EscrowHold`. Funds release `escrowReleaseDays` after the buyer-protection window closes, unless a dispute or return freezes them.

**Split fulfilment.** A multi-seller basket is N separate parcels, so tracking lives on `Shipment` (one row per store per order), not on `Order`. `Order.carrier`/`trackingNumber`/`shippedAt`/`deliveredAt` were removed rather than left behind, to avoid a second source of truth. `Order.status` is derived: `DELIVERED` only once every parcel has arrived, and the buyer-protection clock starts at the *last* delivery. A seller's transition only moves their own parcels.

**Product Q&A** (`ProductQuestion`/`ProductAnswer`) is public and shared, deliberately unlike chat: chat is E2EE and private to its two parties, so one buyer's answer can't help the next visitor. One question per buyer per product — it's a thread, not a support ticket. Sellers hide rather than delete, so answers other shoppers rely on survive.

**Price history** (`PriceSnapshot`) records a row only when the price or compare-at actually moves, so the storefront sparkline shows real changes rather than padding with edits. The migration seeds a baseline point per product.

**Bulk import** (`lib/products/bulk.ts`) is hand-rolled rather than a dependency because the cases that
break seller imports are exactly the ones generic parsers mishandle: quoted fields containing commas,
quotes and newlines, a BOM pasted from Sheets, CRLF, and trailing commas. Rows are validated
independently — one bad line is skipped with its line number, not a failed import — and writes are chunked
so a large file can't hold a transaction open. Imported slugs are deterministic (`product`, `product-2`)
rather than random, so catalogue URLs stay clean and indexable.

**Stock.** `ProductVariant.stock` covers options; `Product.trackStock` + `Product.stock` covers variantless listings, which previously had no stock field at all and were sellable without limit. `trackStock` is opt-in so existing listings are unaffected until a seller turns it on. Checkout re-reads stock inside the transaction and sums quantities **per product across all cart lines**, so two lines of the same item can't each pass the check and oversell together.

**Bulk inventory actions.** `/selling/listings` selects rows and applies publish/unpublish, a percentage
price change, or an absolute stock set in one audited call (`POST /api/v1/selling/products/bulk-action`).
Price actions are a **multiplier on the current price**, not a delta, so repeating a −20% markdown halves
each time rather than compounding into nonsense. A selection spanning two stores is refused — the API is
store-scoped, and the UI says so rather than silently applying to the first store it finds. A price change
that would round a listing to $0.00 is skipped with an explanation instead of being clamped.

**PATCH bodies must not be trusted to mean "unchanged"** (`lib/api/patch.ts`). `z.number().default(0)`
inside `.partial()` still yields `0` for an omitted key, so spreading the parse result straight into a
Prisma update silently resets every defaulted field on every partial edit. Editing a product's price used
to zero its `stock`, clear `images`/`specs`, and — because `variants` defaulted to `[]`, which is truthy —
**delete all of its variants**; editing a coupon's `active` flag wiped the store/category scoping built for
seller `FREESHIP`. `pickSent` keeps only keys the client actually sent. Any new PATCH route built on a
create schema must use it.

**Returns vs disputes.** They are deliberately separate. A return is ordinary after-sales and freezes escrow for the lines involved; a dispute is adversarial and settles via admin ruling. Money only moves on `REFUNDED`, which is admin-only — a seller cannot self-serve a refund.

**Payments are simulated.** No card is collected or charged; orders are written as `PAID` immediately. `payments.provider` is `mock` only. Wire a real provider before taking money — see "Not yet built" below.

**Query defaults** live in `components/layout/providers.tsx`: 30s `staleTime`, no refetch-on-focus, and a retry policy that skips 4xx (a 401 is not worth retrying three times).

---

## Known limitations

Deliberately incomplete — see the plan in the git history:

- **Payments.** Mock only. No refunds are issued to a processor.
- **Session lifetime** is a fixed 30 days. It cannot be made operator-configurable while the session strategy is JWT and `auth.ts` is imported by edge middleware; it needs database sessions.
- **Review moderation** is not implemented. Reviews publish immediately.
- **Chat uploads** are written to local disk and served publicly. They are not access-controlled, which is intentional for trust & safety but means they are not private. Use object storage for production.
- **Product taxonomy** is a free-text column, not a real category tree. `lib/categories.ts` provides a canonical slug list and alias normalization, and filters are case-insensitive, but sellers can still enter arbitrary category strings.
- **The inventory manager has no scheduling.** Sellers can import up to 500 products per CSV at
  `/selling/listings/bulk` (dry-run preview, per-row errors, deterministic slugs), run bulk *updates* from
  the same page matched by slug, and apply selection-based price/stock/status actions at `/selling/listings`.
  There is no scheduled publish, no variant-level bulk edit, and no CSV of images.
- **Seller coupons are manual**: no scheduled campaigns, no auto-apply, no stacking
  (one coupon per order). A seller `FREESHIP` code waives only their own parcel's
  shipping, never a peer's.
- **Returns are manual end to end.** There are no return shipping labels or automated carrier integration; the seller marks an item received by hand and support releases the refund.
- **Flash-deal prices aren't in price history.** `PriceSnapshot` records seller edits; deal pricing is resolved at read time, so a temporary deal price won't appear as a data point.

**End-to-end tests** (`tests/`, `playwright.config.ts`) cover the seller inventory manager through a real
browser, because the failure mode that unit-level and curl-level checks miss is exactly the one that
matters here: an API that works perfectly while the UI that calls it is dead. That is not hypothetical —
the action bar's Apply button was permanently disabled because the listings endpoint selected only
`store: { name: true }` and the bar derived its store scope from a field the response never contained.
Every individual API call passed; the feature was unreachable. The suite runs against a **production
build** (not dev, which hides prerender and client-boundary bugs), signs in through the real form, and
asserts on stored values read back from the API rather than on toasts, because a toast left over from the
previous action will happily satisfy the next assertion. Specs create and delete their own listings, so
they don't depend on specific seeded rows, and `workers: 1` is deliberate — they mutate a shared
database.

**Settlement and payouts** (`tests/settlements.flow.spec.ts`) cover the last untested money path. Two
gates guard a seller's funds and neither is reachable through the API on a useful timescale — the
settling buffer (14 days) after buyer protection closes, and the payout cadence plus a $20 minimum. The
fixtures therefore backdate rows directly (see `tests/helpers/db.ts`, which exists for exactly this and
for nothing else) and then drive the real scheduler endpoint, so every assertion is still made against
what the API returns. Pinned: a hold is gross minus commission at the store's own rate; a coupon reduces
the hold **pro-rata**, so the platform does not take commission on a price the buyer never paid; nothing
releases while protection is open; the scheduler is idempotent; a payout under the minimum is not paid
even past its cadence; and a payout is not paid before its cadence elapses.

**Coupons** (`tests/coupons.flow.spec.ts`) assert the discount arithmetic against the stored order
(`subtotal`, `discount`, `shipping`, `total`) rather than the quote the page displayed. The property
worth most is the **store-scoped `FREESHIP`** rule: a buyer's code may only waive shipping for the
seller's own parcels, because waiving a stranger's fee means the platform has to reimburse a seller who
shipped for less than they were paid. It is asserted directly against a two-store basket — one parcel's
fee waived, the other's still charged — rather than inferred. Also pinned: a fixed discount is clamped
to the subtotal so a total can never go negative, a category-scoped coupon only discounts eligible
items, `minSubtotal` and `perUserLimit` are enforced, and redemption increments `usedCount`.

**Disputes** (`tests/disputes.flow.spec.ts`) are the adversarial counterpart to returns: support rules
and money moves to one side. The invariant worth most is the one spanning two features — a return and a
dispute are **mutually exclusive** on the same order, because both draw on the same escrow. Neither
feature enforces that alone; it falls out of the shared `filingEligibility` gate, so without a test it
would quietly stop being true. The suite also pins that ruling `RESOLVED_BUYER` actually refunds the
order rather than only relabelling the dispute, that `RESOLVED_SELLER` does not, that `CLOSED` is
terminal for both admin transitions and seller replies, and that dispute text is screened for
off-platform payment and contact details. Profanity is only a *warning* there, not a block — a
deliberate policy difference from blocking, and the tests reflect that rather than assuming.

**Seller fulfilment** (`tests/orders.seller.spec.ts`) drives the orders list and shipping a parcel from
PAID through SHIPPED to DELIVERED. Every button on that page is conditional on order status, so a wrong
condition renders nothing to click rather than erroring — the same shape as the dead Apply button, and
the reason this page is tested rather than assumed. It also pins that `Update tracking` stays disabled
until a number is typed, and that fetching another store's order returns **404 rather than 403**: the
route filters to the seller's own items, and a 403 would confirm a foreign order id is real.

**Audit writes are best-effort** (`lib/api/guard.ts`). Callers audit *after* the work is committed —
checkout creates the order, then writes the trail — so an audit failure returned 500 for an order that
already existed. The buyer was told the purchase failed, and retrying risked a duplicate order. The write
is now logged and swallowed. If audit integrity ever needs to be strict the answer is an outbox written
inside the same transaction, not throwing from the audit helper.

**Returns and escrow** (`tests/returns.flow.spec.ts`) cover the after-sales chain, which is three
different users acting in sequence: the buyer files, the seller responds, support refunds. Each role is
a separate session, so these specs drive the API through per-role contexts rather than a single page
session. What they protect is the escrow accounting and the state machine — that a refund is
`admin`-only and unreachable in one jump, that a rejected return is terminal, that an unrelated seller
is refused a return id that is real, that a second request cannot double-claim the same units, and
that a return cannot span two stores. The refund is asserted to be the **net** the seller was owed
rather than the buyer's gross charge, because commission was already deducted when the hold was
created. Note the admin transitions live at `PATCH /api/v1/admin/returns?id=…` — the id is a query
parameter, not a path segment.

**Buyer checkout** (`tests/checkout.buyer.spec.ts`) covers the money path: product page -> cart ->
checkout -> order, asserting on the stock actually decremented in the database rather than on what the
page claims. It pins two properties that are easy to break and expensive to discover late: checkout
**re-prices server-side** (the cart API accepts a client-supplied `price`; posting `$0.01` for a `$20`
item must still bill `$20`), and an order **beyond available stock is refused** with the listing's
stock left untouched rather than driven negative. That oversell case is driven through the API on
purpose, because the product page caps its quantity stepper at available stock — the UI cannot express
an oversell, so the guard worth testing is the server's.

---

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint
npm run db:migrate   # apply migrations
npm run db:seed      # seed demo data
npm run db:studio    # Prisma Studio

npm run test:e2e:install   # one-time: download the Chromium build
npm run test:e2e           # Playwright smoke suite (builds + starts the app)
npm run test:e2e:ui        # interactive debugger
```

The suite runs against its **own throwaway database** (`ys_commerce_e2e`, derived from `DATABASE_URL`),
which `tests/global-setup.ts` drops, recreates, migrates, and seeds before each run and
`tests/global-teardown.ts` drops afterwards. This matters because the suite places real orders, and a
listing with order history cannot be deleted through the API — pointing this at your development data
would leave unrecoverable debris on every run. Set `E2E_KEEP_DB=1` to keep the database for inspection
after a failure. The app under test is always started with the test `DATABASE_URL`, on port 3210; set
`E2E_BASE_URL` to reuse a server you started yourself (in which case you own its database).
