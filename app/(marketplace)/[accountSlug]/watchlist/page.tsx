import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";
import { WatchlistList } from "@/components/account/watchlist-list";

export const metadata = { title: "Watchlist" };

/**
 * In-shell Activity -> Watchlist: same rows as the standalone /watchlist
 * page, rendered inside the My YS tabs and sidebar so the buyer never leaves
 * the account section.
 */
export default async function AccountWatchlistPage() {
  const site = await getSettingGroup("site");
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Watchlist</h2>
        <p className="text-sm text-neutral-500">
          Items you are watching, with price alerts and delivery estimates.
        </p>
      </div>
      <WatchlistList signInNext={accountPath("/watchlist", site.accountSlug)} />
    </div>
  );
}
