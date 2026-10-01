"use client";

import { AtSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/refine/ui";
import { groupSchemas, DEFAULT_RESERVED_NOTE } from "@/lib/settings";
import { GroupForm, UsernamesFields, useAdminSettings } from "@/components/settings/settings-forms";

export default function UsernamesSettingsPage() {
  const query = useAdminSettings();

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Usernames" description="Seller handles: format rules, auto-generation and the reserved blocklist." />
        <Card className="p-0"><TableSkeleton rows={4} cols={2} /></Card>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Usernames" description="Seller handles: format rules, auto-generation and the reserved blocklist." />
        <Card className="p-0"><ErrorState message="Failed to load settings." /></Card>
      </div>
    );
  }

  const s = query.data;
  if (!s.usernames) {
    return (
      <div className="space-y-4">
        <PageHeader title="Usernames" description="Seller handles: format rules, auto-generation and the reserved blocklist." />
        <Card className="p-0"><EmptyState title="No username settings found" hint="Run the database seed to create defaults." /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Usernames" description="Seller handles: format rules, auto-generation and the reserved blocklist." />
      <Tabs defaultValue="policy">
        <TabsList className="flex-wrap">
          <TabsTrigger value="policy" className="gap-1.5"><AtSign className="size-4" /> Policy & blocklist</TabsTrigger>
        </TabsList>
        <TabsContent value="policy" className="space-y-4">
          <GroupForm group="usernames" schema={groupSchemas.usernames} values={s.usernames}>
            {(c) => <UsernamesFields control={c} />}
          </GroupForm>
          <Card className="p-5 text-sm text-neutral-500">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">How handles work</p>
            <p className="mt-1">{DEFAULT_RESERVED_NOTE}</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
