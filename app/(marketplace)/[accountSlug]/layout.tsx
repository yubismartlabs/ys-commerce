import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";
import { AccountShell } from "@/components/account/account-shell";

/**
 * My eBay-style account shell: auth guard + the three-section My YS chrome.
 * The section slug is site-wide and admin-configurable (default "account",
 * e.g. "myebay" → /myebay/summary). A wrong slug 404s instead of rendering
 * another tenant's shell — there is only one account section per site.
 * "Seller" is derived from store ownership, never from a role.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ accountSlug: string }>;
}) {
  const { accountSlug } = await params;
  const site = await getSettingGroup("site");
  if (accountSlug !== site.accountSlug) {
    notFound();
  }
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  if (!user?.id) {
    redirect(`/sign-in?next=${encodeURIComponent(accountPath("/summary", site.accountSlug))}`);
  }
  const hasStore = (await db.store.count({ where: { ownerId: user.id } })) > 0;
  const displayName = user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-black tracking-tight">
          My YS <span className="ml-1 align-middle text-sm font-medium text-neutral-500">Hi, {displayName}!</span>
        </h1>
      </div>
      <AccountShell hasStore={hasStore}>{children}</AccountShell>
    </div>
  );
}
