import { notFound, redirect } from "next/navigation";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";

/**
 * Section root has no content of its own — the summary is canonical at
 * /<slug>/summary (e.g. /myebay/summary).
 */
export default async function AccountRootPage({
  params,
}: {
  params: Promise<{ accountSlug: string }>;
}) {
  const { accountSlug } = await params;
  const site = await getSettingGroup("site");
  if (accountSlug !== site.accountSlug) {
    notFound();
  }
  redirect(accountPath("/summary", site.accountSlug));
}
