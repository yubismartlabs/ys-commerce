import { NextResponse } from "next/server";
import { getSettings } from "@/lib/server-settings";

/** Public subset for the storefront + mobile app. No auth required. */
export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    data: {
      siteName: s.site.siteName,
      logoUrl: s.site.logoUrl,
      announcement: s.maintenance.announcement,
      buyerProtectionText: s.commerce.buyerProtectionText,
      buyerProtectionDays: s.commerce.buyerProtectionDays,
      maintenance: { enabled: s.maintenance.enabled, message: s.maintenance.message },
    },
  });
}
