import Link from "next/link";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";

export async function MarketplaceFooter() {
  const site = await getSettingGroup("site");
  const a = (p: string) => accountPath(p, site.accountSlug);
  return (
    <footer className="mt-10 border-t bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-neutral-600 md:grid-cols-4">
        <div>
          <p className="mb-3 text-xl font-black"><span className="text-ali-red">ys</span>-commerce</p>
          <p>Multi-vendor marketplace with buyer protection on every order. USD / English.</p>
        </div>
        <div>
          <p className="mb-2 font-semibold text-neutral-900">Buy</p>
          <div className="grid gap-1.5">
            <Link href="/deals">Flash Deals</Link>
            <Link href="/watchlist">Watchlist</Link>
            <Link href="/cart">Cart</Link>
            <Link href={a("/orders")}>Track Order</Link>
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold text-neutral-900">Sell</p>
          <div className="grid gap-1.5">
            <Link href={a("/start-selling")}>Start Selling</Link>
            <Link href={a("/store")}>My Store</Link>
            <Link href={a("/listings")}>My Listings</Link>
            <Link href={a("/orders?view=selling")}>Sales</Link>
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold text-neutral-900">Support</p>
          <div className="grid gap-1.5">
            <Link href={a("/summary")}>My Account</Link>
            <Link href={a("/orders")}>Orders</Link>
            <Link href={a("/disputes")}>Disputes</Link>
            <Link href={a("/messages")}>Messages</Link>
          </div>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-neutral-500">
        © 2026 ys-commerce · Demo marketplace · Payments are simulated
      </div>
    </footer>
  );
}
