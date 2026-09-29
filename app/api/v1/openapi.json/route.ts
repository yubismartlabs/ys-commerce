import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "ys-commerce API",
    version: "1.0.0",
    description:
      "Versioned REST API shared by the Next.js storefront, ys-admin and the future mobile app. Auth: session cookie (web) or `Authorization: Bearer <token>` (mobile).",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/products": { get: { summary: "List active products", parameters: ["q", "category", "page", "pageSize"] } },
    "/products/{slug}": { get: { summary: "Product detail with variants + reviews" } },
    "/stores/{slug}": { get: { summary: "Approved store + its products" } },
    "/admin/stats": { get: { summary: "Dashboard KPIs (admin)" } },
    "/admin/vendors": { get: { summary: "List vendors, filter ?status= (admin)" } },
    "/admin/vendors/{id}": { patch: { summary: "Approve / reject / suspend vendor (admin)" } },
    "/admin/products": { get: { summary: "List products (admin)" } },
    "/admin/products/{id}": { patch: { summary: "Takedown / restore product (admin)" } },
    "/admin/orders": { get: { summary: "List orders (admin)" } },
    "/admin/orders/{id}": { patch: { summary: "Cancel / refund order (admin)" } },
    "/admin/disputes": { get: { summary: "List disputes with threads (admin)" } },
    "/admin/disputes/{id}": { patch: { summary: "Resolve dispute (admin)" } },
    "/admin/coupons": { get: { summary: "List coupons, filters ?active=&type=&q= (admin)" }, post: { summary: "Create coupon (admin)" } },
    "/admin/coupons/{id}": { get: { summary: "Coupon detail + redemptions (admin)" }, patch: { summary: "Update coupon (admin)" }, delete: { summary: "Delete coupon" } },
    "/coupons": { get: { summary: "Active public coupons (no auth)" } },
    "/coupons/validate": { post: { summary: "Quote a coupon against a basket (no auth)" } },
    "/checkout": { post: { summary: "Place an order, optional couponCode (auth)" } },
    "/admin/api-tokens": {
      get: { summary: "List mobile API tokens" },
      post: { summary: "Mint a bearer token (raw token shown once)" },
    },
    "/admin/settings": {
      get: { summary: "All site + system settings (admin)" },
      patch: { summary: "Partial per-group settings update (admin)" },
    },
    "/admin/uploads": {
      get: { summary: "Recent uploads (admin)" },
      post: { summary: "Upload an image, max 2MB (admin)" },
    },
    "/settings/public": { get: { summary: "Public brand + banner settings (no auth)" } },
    "/auth/register": { post: { summary: "Create a buyer account (public)" } },
    "/auth/become-seller": { post: { summary: "Open a store for the signed-in user" } },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
