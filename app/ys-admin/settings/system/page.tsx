"use client";

import { Bell, CreditCard, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/refine/ui";
import { groupSchemas } from "@/lib/settings";
import {
  CommerceFields,
  GroupForm,
  NotificationsFields,
  PaymentsFields,
  SecurityFields,
  ShippingFields,
  TestEmailButton,
  useAdminSettings,
} from "@/components/settings/settings-forms";

export default function SystemSettingsPage() {
  const query = useAdminSettings();

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="System settings" description="Operational configuration: money, fulfillment, notifications and security." />
        <Card className="p-0"><TableSkeleton rows={6} cols={2} /></Card>
      </div>
    );
  }
  if (query.isError || !query.data || Object.keys(query.data).length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="System settings" description="Operational configuration: money, fulfillment, notifications and security." />
        <Card className="p-0">
          {query.isError ? <ErrorState message="Failed to load settings." /> : <EmptyState title="No settings found" hint="Run the database seed to create defaults." />}
        </Card>
      </div>
    );
  }

  const s = query.data;

  return (
    <div className="space-y-4">
      <PageHeader title="System settings" description="Operational configuration: money, fulfillment, notifications and security." />
      <Tabs defaultValue="commerce">
        <TabsList className="flex-wrap">
          <TabsTrigger value="commerce" className="gap-1.5"><ShoppingBag className="size-4" /> Commerce</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><CreditCard className="size-4" /> Payments</TabsTrigger>
          <TabsTrigger value="shipping" className="gap-1.5"><Truck className="size-4" /> Shipping</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="size-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><ShieldCheck className="size-4" /> Security</TabsTrigger>
        </TabsList>
        <TabsContent value="commerce">
          <GroupForm group="commerce" schema={groupSchemas.commerce} values={s.commerce}>
            {(c) => <CommerceFields control={c} />}
          </GroupForm>
        </TabsContent>
        <TabsContent value="payments">
          <GroupForm group="payments" schema={groupSchemas.payments} values={s.payments}>
            {(c) => <PaymentsFields control={c} />}
          </GroupForm>
        </TabsContent>
        <TabsContent value="shipping">
          <GroupForm group="shipping" schema={groupSchemas.shipping} values={s.shipping}>
            {(c) => <ShippingFields control={c} />}
          </GroupForm>
        </TabsContent>
        <TabsContent value="notifications" className="space-y-4">
          <GroupForm group="notifications" schema={groupSchemas.notifications} values={s.notifications}>
            {(c) => <NotificationsFields control={c} hasResendKey={(s.notifications as { hasResendKey?: boolean }).hasResendKey} />}
          </GroupForm>
          <TestEmailButton defaultTo={s.notifications.testRecipient || s.notifications.adminAlertEmail || undefined} />
        </TabsContent>
        <TabsContent value="security">
          <GroupForm group="security" schema={groupSchemas.security} values={s.security}>
            {(c) => <SecurityFields control={c} />}
          </GroupForm>
        </TabsContent>
      </Tabs>
    </div>
  );
}
