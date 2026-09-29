"use client";

import { Globe, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/refine/ui";
import { groupSchemas } from "@/lib/settings";
import { GroupForm, MaintenanceFields, SiteFields, useAdminSettings } from "@/components/settings/settings-forms";

export default function SiteSettingsPage() {
  const query = useAdminSettings();

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Site settings" description="Everything customer-facing: brand, SEO and storefront banners." />
        <Card className="p-0"><TableSkeleton rows={6} cols={2} /></Card>
      </div>
    );
  }
  if (query.isError || !query.data || Object.keys(query.data).length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Site settings" description="Everything customer-facing: brand, SEO and storefront banners." />
        <Card className="p-0">
          {query.isError ? <ErrorState message="Failed to load settings." /> : <EmptyState title="No settings found" hint="Run the database seed to create defaults." />}
        </Card>
      </div>
    );
  }

  const s = query.data;

  return (
    <div className="space-y-4">
      <PageHeader title="Site settings" description="Everything customer-facing: brand, SEO and storefront banners." />
      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general" className="gap-1.5"><Globe className="size-4" /> General</TabsTrigger>
          <TabsTrigger value="banners" className="gap-1.5"><Megaphone className="size-4" /> Banners & maintenance</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GroupForm group="site" schema={groupSchemas.site} values={s.site}>
            {(c) => <SiteFields control={c} />}
          </GroupForm>
        </TabsContent>
        <TabsContent value="banners">
          <GroupForm group="maintenance" schema={groupSchemas.maintenance} values={s.maintenance}>
            {(c) => <MaintenanceFields control={c} />}
          </GroupForm>
        </TabsContent>
      </Tabs>
    </div>
  );
}
