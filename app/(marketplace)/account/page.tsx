import { Suspense } from "react";
import { AccountTabs, isAccountTab } from "@/components/account/account-tabs";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Server component reads the tab so the right panel is rendered on first
  // paint; the client component handles interaction. `useSearchParams` inside
  // AccountTabs needs the Suspense boundary below.
  const { tab } = await searchParams;
  const initial = isAccountTab(tab) ? tab : "orders";
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />}>
      <AccountTabs initial={initial} />
    </Suspense>
  );
}
