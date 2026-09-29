import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessConsole, hasScope } from "@/lib/auth/permissions";

const AREA_BY_PREFIX: Array<[string, string]> = [
  ["/ys-admin/api-tokens", "admin"],
  ["/ys-admin/roles", "users"],
  ["/ys-admin/users", "users"],
  ["/ys-admin/vendors", "vendors"],
  ["/ys-admin/products", "products"],
  ["/ys-admin/orders", "orders"],
  ["/ys-admin/disputes", "disputes"],
  ["/ys-admin/coupons", "coupons"],
  ["/ys-admin/payouts", "payouts"],
  ["/ys-admin/emails", "emails"],
  ["/ys-admin/settings", "settings"],
  ["/ys-admin/notifications", "any"],
];

function toLogin(req: { nextUrl: { clone(): URL } }, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/ys-admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/ys-admin")) return NextResponse.next();
  if (pathname === "/ys-admin/login" || pathname === "/ys-admin/no-access") return NextResponse.next();

  const user = req.auth?.user as { role?: string; scopes?: string[] } | undefined;
  const scopes = Array.isArray(user?.scopes) ? user.scopes : [];
  if (!user || !canAccessConsole(user.role, scopes)) return toLogin(req, pathname);
  if (pathname === "/ys-admin" || pathname === "/ys-admin/") return NextResponse.next();

  const match = AREA_BY_PREFIX.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  const area = match?.[1] ?? "admin";
  if (area !== "any" && !hasScope(scopes, area)) {
    const url = req.nextUrl.clone();
    url.pathname = "/ys-admin/no-access";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/ys-admin/:path*"],
};
