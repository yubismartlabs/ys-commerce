import { MarketplaceHeader } from "@/components/layout/marketplace-header";
import { MarketplaceFooter } from "@/components/layout/marketplace-footer";
import { SiteBanners } from "@/components/layout/site-banners";
import { getSettings } from "@/lib/server-settings";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-screen flex-col bg-ali-bg">
      <SiteBanners
        maintenance={{ enabled: settings.maintenance.enabled, message: settings.maintenance.message }}
        announcement={settings.maintenance.announcement}
      />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">{children}</main>
      <MarketplaceFooter />
    </div>
  );
}
