import { MarketplaceHeader } from "@/components/layout/marketplace-header";
import { MarketplaceFooter } from "@/components/layout/marketplace-footer";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ali-bg">
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">{children}</main>
      <MarketplaceFooter />
    </div>
  );
}
