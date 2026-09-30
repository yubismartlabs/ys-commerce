import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Buyer/seller private areas and the admin console must stay out of the
        // index; the API is not crawlable content either.
        disallow: [
          "/api/",
          "/account/",
          "/cart",
          "/checkout",
          "/watchlist",
          "/selling/",
          "/ys-admin",
          "/sign-in",
          "/sign-up",
          "/maintenance",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
