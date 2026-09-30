import { ok } from "@/lib/api/http";
import { getSettings } from "@/lib/server-settings";

/**
 * Public subset for the storefront + mobile app. No auth required.
 * Uses `ok()` so image URLs are sanitized by the shared serializer.
 */
export async function GET() {
  const s = await getSettings();
  return ok({
    siteName: s.site.siteName,
    logoUrl: s.site.logoUrl,
    announcement: s.maintenance.announcement,
    buyerProtectionText: s.commerce.buyerProtectionText,
    buyerProtectionDays: s.commerce.buyerProtectionDays,
    etaText: s.shipping.etaText,
    shipFrom: s.shipping.shipFrom,
    maintenance: { enabled: s.maintenance.enabled, message: s.maintenance.message },
  });
}
