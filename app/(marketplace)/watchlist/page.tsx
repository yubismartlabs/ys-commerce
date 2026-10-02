"use client";

import { WatchlistList } from "@/components/account/watchlist-list";

/**
 * Standalone watchlist, linked from the storefront header. Same rows as the
 * in-shell Activity -> Watchlist page — one shared list component.
 */
export default function WatchlistPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Watchlist</h1>
      <WatchlistList signInNext="/watchlist" />
    </div>
  );
}
