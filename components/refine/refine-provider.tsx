"use client";

import React from "react";
import { Refine, type NotificationProvider } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { Bell, Mail, MessageSquareWarning, Package, ShoppingCart, Store, Ticket } from "lucide-react";
import { toast } from "sonner";
import { dataProvider } from "@/lib/refine/data-provider";
import { authProvider } from "@/lib/refine/auth-provider";

const notificationProvider: NotificationProvider = {
  open: ({ message, description, type }) => {
    if (type === "success") toast.success(message, { description });
    else if (type === "error") toast.error(message, { description });
    else toast(message, { description });
  },
  close: (key) => toast.dismiss(key),
};

export function RefineProvider({ children }: { children: React.ReactNode }) {
  return (
    <Refine
      dataProvider={dataProvider}
      authProvider={authProvider}
      routerProvider={routerProvider}
      notificationProvider={notificationProvider}
      resources={[
        { name: "vendors", list: "/ys-admin/vendors", show: "/ys-admin/vendors/show/:id", meta: { label: "Vendors", icon: <Store className="size-4" /> } },
        { name: "products", list: "/ys-admin/products", show: "/ys-admin/products/show/:id", meta: { label: "Products", icon: <Package className="size-4" /> } },
        { name: "orders", list: "/ys-admin/orders", show: "/ys-admin/orders/show/:id", meta: { label: "Orders", icon: <ShoppingCart className="size-4" /> } },
        { name: "disputes", list: "/ys-admin/disputes", show: "/ys-admin/disputes/show/:id", meta: { label: "Disputes", icon: <MessageSquareWarning className="size-4" /> } },
        { name: "coupons", list: "/ys-admin/coupons", show: "/ys-admin/coupons/show/:id", meta: { label: "Coupons", icon: <Ticket className="size-4" /> } },
        { name: "notifications", list: "/ys-admin/notifications", meta: { label: "Notifications", icon: <Bell className="size-4" /> } },
        { name: "emails", list: "/ys-admin/emails", meta: { label: "Email log", icon: <Mail className="size-4" /> } },
      ]}
      options={{ syncWithLocation: true, disableTelemetry: true }}
    >
      {children}
    </Refine>
  );
}
