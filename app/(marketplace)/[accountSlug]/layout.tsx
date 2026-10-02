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
  const sessionUser = session?.user as { id?: string } | undefined;
  // `reason=session` tells the sign-in page to DISCARD this cookie rather than
  // treat it as a good session. A JWT that outlived its user still reports
  // "authenticated", so without that the sign-in page would bounce the visitor
  // straight back into the account area and the two would redirect-loop.
  const signIn = `/sign-in?reason=session&next=${encodeURIComponent(accountPath("/summary", site.accountSlug))}`;
  if (!sessionUser?.id) redirect(`/sign-in?next=${encodeURIComponent(accountPath("/summary", site.accountSlug))}`);

  // Sessions are JWTs, so auth() hands back an id without touching the
  // database — and that id can outlive the row. A deleted account, a restored
  // snapshot or a recreated dev database all leave a cookie that still decodes
  // to a user who is no longer there. Skipping this check rendered a
  // convincing signed-in shell ("Hi, <name>") whose every account-scoped
  // request then failed 401, which reads as a broken app rather than an expired
  // session. requireUser() has always checked; the shell now agrees with it.
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true },
  });
  if (!user) redirect(signIn);

  const displayName = user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-black tracking-tight">
          My YS <span className="ml-1 align-middle text-sm font-medium text-neutral-500">Hi, {displayName}!</span>
        </h1>
      </div>
      <AccountShell>{children}</AccountShell>
    </div>
  );
}
