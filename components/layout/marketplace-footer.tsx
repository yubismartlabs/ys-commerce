import Link from "next/link";

export function MarketplaceFooter() {
  return (
    <footer className="mt-10 border-t bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-neutral-600 md:grid-cols-4">
        <div>
          <p className="mb-3 text-xl font-black"><span className="text-ali-red">7</span>Krave</p>
          <p>Multi-vendor marketplace with buyer protection on every order. USD / English.</p>
        </div>
        <div>
          <p className="mb-2 font-semibold text-neutral-900">Buy</p>
          <div className="grid gap-1.5">
            <Link href="/deals">Flash Deals</Link>
            <Link href="/watchlist">Watchlist</Link>
            <Link href="/cart">Cart</Link>
            <Link href="/account?tab=orders">Track Order</Link>
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold text-neutral-900">Sell</p>
          <div className="grid gap-1.5">
            <Link href="/selling/onboarding">Start Selling</Link>
            <Link href="/selling/dashboard">Seller Dashboard</Link>
            <Link href="/selling/listings">Listings</Link>
            <Link href="/selling/orders">Seller Orders</Link>
          </div>
        </div>
        <div>
          <p className="mb-2 font-semibold text-neutral-900">Support</p>
          <div className="grid gap-1.5">
            <Link href="/account">My Account</Link>
            <Link href="/account?tab=orders">Orders</Link>
            <Link href="/account/disputes">Disputes</Link>
            <Link href="/account/messages">Messages</Link>
          </div>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-neutral-500">
        © 2026 7Krave · Demo marketplace · Payments are simulated
      </div>
    </footer>
  );
}
