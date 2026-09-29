import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasScope } from "@/lib/auth/permissions";

const LANDING: Array<[string, string]> = [
  ["vendors", "/ys-admin/vendors"],
  ["products", "/ys-admin/products"],
  ["orders", "/ys-admin/orders"],
  ["disputes", "/ys-admin/disputes"],
  ["coupons", "/ys-admin/coupons"],
  ["users", "/ys-admin/users"],
  ["payouts", "/ys-admin/payouts"],
  ["emails", "/ys-admin/emails"],
  ["settings", "/ys-admin/settings/system"],
  ["notifications", "/ys-admin/notifications"],
];

export default async function AdminIndex() {
  const session = await auth();
  const scopes = (session?.user as { scopes?: string[] } | undefined)?.scopes ?? [];
  const hit = LANDING.find(([area]) => hasScope(scopes, area));
  redirect(hit ? hit[1] : "/ys-admin/no-access");
}
