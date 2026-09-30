import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { getSettingGroup } from "@/lib/server-settings";
import { safeImageSrc } from "@/lib/images";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

/**
 * Site-level metadata, driven by the admin-managed `site` settings group. These
 * fields (seoTitle, seoDescription, faviconUrl) were editable in the console
 * but previously read by nothing, so the site shipped the hardcoded defaults
 * regardless of what an operator configured.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettingGroup("site").catch(() => null);
  const title = site?.seoTitle?.trim() || "7Krave | Multi-vendor marketplace";
  const description =
    site?.seoDescription?.trim() || "Multi-vendor marketplace. Buy and sell with buyer protection on every order.";
  const icon = site?.faviconUrl?.trim() ? safeImageSrc(site.faviconUrl) : undefined;

  return {
    title: { default: title, template: `%s` },
    description,
    ...(icon ? { icons: { icon } } : {}),
    openGraph: { type: "website", siteName: site?.siteName, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-ali-bg font-sans text-neutral-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
