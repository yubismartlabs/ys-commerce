import { createHash } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail } from "@/lib/api/http";

export type AdminActor = { id: string; email: string; via: "session" | "token" };

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Session cookie (web) or `Authorization: Bearer <token>` (mobile / scripts). */
export async function requireAdmin(req: Request): Promise<AdminActor> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "ADMIN" && session?.user) {
    return { id: (session.user as { id: string }).id, email: session.user.email ?? "", via: "session" };
  }

  const header = req.headers.get("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (raw) {
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
      return { id: token.user.id, email: token.user.email, via: "token" };
    }
  }
  throw new ApiError("FORBIDDEN", "Admin access required", 403);
}

/** Wrap an admin route handler: 403s become JSON instead of crashing the handler. */
export function withAdmin<C>(
  handler: (req: Request, actor: AdminActor, ctx: C) => Promise<Response>
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const actor = await requireAdmin(req);
      return await handler(req, actor, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.code, e.message, e.status);
      throw e;
    }
  };
}

export async function audit(actorId: string | null, action: string, entity: string, entityId: string, meta?: unknown) {
  await db.auditLog.create({
    data: { actorId, action, entity, entityId, meta: (meta as object) ?? undefined },
  });
}
