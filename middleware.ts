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
  ["/ys-admin/deals", "deals"],
  ["/ys-admin/activity", "ops"],
  ["/ys-admin/chat", "chat"],
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

/**
 * Access log for API traffic, plus a request id echoed back to the caller.
 *
 * Scoped to /api and deliberately skipping /api/health: a liveness probe runs
 * every few seconds per replica, and logging it buries real traffic (and costs
 * money at volume). The request id is what makes a report actionable — it ties
 * an access line to the error line the route logged with the same id.
 */
async function withAccessLog(
  req: Request & { nextUrl: URL },
  // Matches what the auth wrapper actually returns, which may be void or a
  // promise of one; normalised to a Response inside.
  next: () => void | Response | Promise<void | Response>
): Promise<Response> {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/health")) {
    return (await next()) ?? NextResponse.next();
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const startedAt = Date.now();
  // The auth wrapper may hand back a plain Response whose headers are already
  // sealed, so the request id is best-effort — losing it costs correlation on
  // that one response, not correctness.
  const res = (await next()) ?? NextResponse.next();

  console.log(
    JSON.stringify({
      level: "info",
      time: new Date().toISOString(),
      msg: "api request",
      requestId,
      method: req.method,
      path: pathname,
      durationMs: Date.now() - startedAt,
    })
  );

  try {
    res.headers.set("x-request-id", requestId);
  } catch {
    /* headers already sealed */
  }
  return res;
}

const guard = auth((req) => {
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

export default function middleware(
  req: Parameters<typeof guard>[0],
  event: Parameters<typeof guard>[1]
) {
  return withAccessLog(req, () => guard(req, event));
}

export const config = {
  // Was admin-only. API routes are included so access logging covers them.
  matcher: ["/ys-admin/:path*", "/api/:path*"],
};
