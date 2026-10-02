import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";
import { SummaryList } from "@/components/account/summary-list";

export const metadata = { title: "My YS — Summary" };

const TAB_TO_ROUTE: Record<string, string> = {
  orders: "/orders",
  disputes: "/disputes",
  returns: "/returns",
  reviews: "/reviews",
  coupons: "/coupons",
  settings: "/settings",
};

/**
 * My YS landing: one list over what the buyer is watching and what they
 * bought. Everything else that used to live here (stat cards, following,
 * selling) moved to the nav or to its own page — the summary is the list.
 */
export default async function AccountSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const site = await getSettingGroup("site");
  const base = (p: string) => accountPath(p, site.accountSlug);
  const basePrefix = `/${site.accountSlug}`;
  // Back-compat: old header/footer links used /account?tab=orders etc.
  const { tab } = await searchParams;
  if (tab && TAB_TO_ROUTE[tab]) redirect(base(TAB_TO_ROUTE[tab]));
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(base("/summary"))}`);

  return <SummaryList base={basePrefix} />;
}
