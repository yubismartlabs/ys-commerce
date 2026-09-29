import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/ys-admin")) return NextResponse.next();
  if (pathname === "/ys-admin/login") return NextResponse.next();

  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/ys-admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/ys-admin/:path*"],
};
