import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/guard";
import { isAdmin } from "@/lib/auth/permissions";

export type Actor = { id: string; email: string; role: string; scopes: string[] };

/** Signed-in user, live-checked against the DB (suspension enforced). */
export async function requireUser(): Promise<Actor> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError("UNAUTHORIZED", "Sign in required", 401);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new ApiError("UNAUTHORIZED", "Account not found", 401);
  if (user.suspendedAt) throw new ApiError("SUSPENDED", "This account is suspended", 403);
  return { id: user.id, email: user.email, role: user.role, scopes: user.scopes };
}

/** One-line suspension gate for routes that auth directly. */
export async function isSuspended(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } });
  return !!user?.suspendedAt;
}

/** Admin actor, live-checked (role + suspension). Replaces ad-hoc checks. */
export async function requireAdminUser(req: Request): Promise<Actor & { via: "session" | "token" }> {
  // Token path (mobile/scripts) preserves existing behavior + suspension.
  const header = req.headers.get("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (raw) {
    const { hashToken } = await import("@/lib/api/guard");
    const token = await db.apiToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: true },
    });
    if (
      token &&
      token.user.role === "ADMIN" &&
      token.scopes.includes("admin") &&
      (!token.expiresAt || token.expiresAt > new Date())
    ) {
      if (token.user.suspendedAt) throw new ApiError("SUSPENDED", "This account is suspended", 403);
      return { id: token.user.id, email: token.user.email, role: "ADMIN", scopes: token.user.scopes, via: "token" };
    }
  }
  const actor = await requireUser();
  if (!isAdmin(actor.role, actor.scopes)) throw new ApiError("FORBIDDEN", "Admin access required", 403);
  return { ...actor, via: "session" };
}
