import type { MetadataRoute } from "next";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const site = await getSettingGroup("site");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Buyer/seller private areas and the admin console must stay out of the
        // index; the API is not crawlable content either.
        disallow: [
          "/api/",
          `${accountPath("/", site.accountSlug)}`,
          "/cart",
          "/checkout",
          "/watchlist",
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
