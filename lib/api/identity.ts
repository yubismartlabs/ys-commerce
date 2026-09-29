import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/guard";

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
