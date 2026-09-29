"use client";

import React from "react";
import { Refine, type NotificationProvider } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { Banknote, Bell, History, KeyRound, Mail, MessageCircle, MessageSquareWarning, Package, ShoppingCart, Store, Ticket, Users, Zap } from "lucide-react";
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
        { name: "coupons", list: "/ys-admin/coupons", show: "/ys-admin/coupons/show/:id", create: "/ys-admin/coupons/create", meta: { label: "Coupons", icon: <Ticket className="size-4" /> } },
        { name: "deals", list: "/ys-admin/deals", meta: { label: "Flash deals", icon: <Zap className="size-4" /> } },
        { name: "notifications", list: "/ys-admin/notifications", meta: { label: "Notifications", icon: <Bell className="size-4" /> } },
        { name: "emails", list: "/ys-admin/emails", meta: { label: "Email log", icon: <Mail className="size-4" /> } },
        { name: "payouts", list: "/ys-admin/payouts", meta: { label: "Payouts", icon: <Banknote className="size-4" /> } },
        { name: "roles", list: "/ys-admin/roles", meta: { label: "Roles", icon: <KeyRound className="size-4" /> } },
        { name: "chat", list: "/ys-admin/chat", show: "/ys-admin/chat/:id", meta: { label: "Message reports", icon: <MessageCircle className="size-4" /> } },
        { name: "audit", list: "/ys-admin/activity", meta: { label: "Activity log", icon: <History className="size-4" /> } },
        { name: "users", list: "/ys-admin/users", show: "/ys-admin/users/show/:id", create: "/ys-admin/users/create", meta: { label: "Users", icon: <Users className="size-4" /> } },
      ]}
      options={{ syncWithLocation: true, disableTelemetry: true }}
    >
      {children}
    </Refine>
  );
}
