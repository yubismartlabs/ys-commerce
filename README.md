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

## Architecture notes

**Route layout.** `/` , `/search`, `/cart`, `/product/*`, `/store/*`, `/account/*`, `/selling/*` live in the `(marketplace)` group (no URL segment). `/ys-admin/*` is a separate staff console gated by `middleware.ts`. `/maintenance` is a holding page.

**Server vs client.** Public product/store pages are React Server Components so they can call `notFound()` and emit `generateMetadata`; interactive halves are client components (`components/products/product-view.tsx`). Admin and account screens are client components that fetch from `/api/v1/*` via TanStack Query.

**API.** `/api/v1/*` route handlers return a consistent envelope (`{ data, pagination, meta }` or `{ error: { code, message } }`) from `lib/api/http.ts`. `serialize()` normalizes Prisma Decimals/Dates and sanitizes image URLs for every response.

**Authorization.** Session JWTs carry `role` + `scopes`. Admin routes are gated twice: `middleware.ts` by path→area, and `withAdmin(handler, area)` in the handler. The API re-reads the principal from the database on every call, so a scope change takes effect immediately even though the JWT is only refreshed on sign-in.

**Money.** Checkout re-validates the coupon and stock *inside* the transaction, takes prices from `resolveCart` (never the client payload), and locks each seller's net in `EscrowHold`. Funds release `escrowReleaseDays` after the buyer-protection window closes, unless a dispute freezes them.

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
- **`Product` has no stock column.** A listing with no variants is treated as always in stock.
- **Seller-side bulk tooling** (CSV import, inventory manager) does not exist.

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
```
