import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MarketplaceHeader } from "@/components/layout/marketplace-header";
import { MarketplaceFooter } from "@/components/layout/marketplace-footer";
import { SiteBanners } from "@/components/layout/site-banners";
import { CartTracker } from "@/components/lifecycle/cart-tracker";
import { AssistantShell } from "@/components/ai/assistant-shell";
import { getSettings } from "@/lib/server-settings";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  // Maintenance mode: guests see the full /maintenance page, admins browse
  // normally (with the amber banner as a reminder). If the session lookup
  // itself fails we fail closed — showing the maintenance page is safer than
  // leaking the storefront to a possibly-suspended account.
  if (settings.maintenance.enabled) {
    let role: string | undefined;
    try {
      const session = await auth();
      role = (session?.user as { role?: string } | undefined)?.role;
    } catch (e) {
      console.error("[layout] session lookup failed during maintenance:", e);
    }
    if (role !== "ADMIN") redirect("/maintenance");
  }
  return (
    <AssistantShell>
    <div className="flex min-h-screen flex-col bg-ali-bg">
      {/* Keyboard users otherwise tab through ~15 header controls on every page. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ali-red focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <CartTracker />
      <SiteBanners
        maintenance={{ enabled: settings.maintenance.enabled, message: settings.maintenance.message }}
        announcement={settings.maintenance.announcement}
      />
      <MarketplaceHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 focus:outline-none">
        {children}
      </main>
      <MarketplaceFooter />
    </div>
    </AssistantShell>
  );
}
