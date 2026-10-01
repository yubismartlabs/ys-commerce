"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { useAccountBase } from "@/lib/account-url";
import { ACCOUNT_TABS, groupsFor, hasSidebar, resolveSection } from "@/lib/account-section";

/**
 * My YS shell: a full-width line tab bar over the three top-level sections,
 * with a section-specific sidebar beside the content. The tab bar is
 * controlled by the URL rather than by local state — each section's pages
 * keep their own canonical route (/account/orders, /account/messages,
 * /account/settings), so switching tabs is a navigation and every section
 * stays linkable from notifications, email and the footer.
 */
export function AccountShell({ hasStore, children }: { hasStore: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = useAccountBase();
  const section = resolveSection(pathname, base);
  const sidebar = hasSidebar(section);

  return (
    <div className="space-y-4">
      <Tabs value={section}>
        <TabsList variant="line" className="h-10 w-full justify-start gap-6 p-0">
          {ACCOUNT_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              asChild
              className="h-auto flex-none px-0 pb-2 text-sm data-active:font-semibold"
            >
              <Link href={`${base}${tab.path}`}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {sidebar ? (
        <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* Mobile: horizontal scroll nav. Desktop: sticky sidebar. */}
          <Card className="p-3 lg:sticky lg:top-32 lg:self-start">
            <div className="no-scrollbar -mx-1 overflow-x-auto px-1 lg:overflow-visible">
              <div className="min-w-max lg:min-w-0">
                {/* The sidebar reads ?view= to tell Purchases from Sales. */}
                <Suspense fallback={null}>
                  <AccountSidebar groups={groupsFor(section, hasStore, base)} section={section} />
                </Suspense>
              </div>
            </div>
          </Card>
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}