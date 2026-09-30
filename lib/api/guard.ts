import { createHash } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { fail } from "@/lib/api/http";
import { canAccessConsole, effectiveScopes, hasScope } from "@/lib/auth/permissions";

export type AdminActor = {
  id: string;
  email: string;
  via: "session" | "token";
  role: string;
  scopes: string[];
};

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

/** Throw unless the actor's effective scopes grant an area. */
export function denyUnless(actor: Pick<AdminActor, "scopes">, area: string): void {
  if (!hasScope(actor.scopes, area)) {
    throw new ApiError("FORBIDDEN", `Requires ${area} access`, 403);
  }
}

async function loadPrincipal(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      scopes: true,
      suspendedAt: true,
      staffRole: { select: { scopes: true } },
    },
  });
}

/**
 * Session cookie (web) or `Authorization: Bearer <token>` (mobile / scripts).
 * Scope-gated: ADMIN role (or "*") passes everywhere; staff pass only areas
 * in their effective scopes. Default "admin" = superuser-only.
 *
 * Area "any" mirrors middleware's `/ys-admin/notifications`: reachable by any
 * console user (full admin or staff holding at least one scope) without
 * naming a specific area. It must NOT mean "any signed-in account" — a plain
 * buyer has no business on an admin route.
 */
export async function requireAdmin(req: Request, area = "admin"): Promise<AdminActor> {
  const session = await auth();
  const sessionId = session?.user ? (session.user as { id: string }).id : null;
  if (sessionId) {
    const user = await loadPrincipal(sessionId);
    if (!user || user.suspendedAt) {
      throw new ApiError("SUSPENDED", "This account is suspended", 403);
    }
    const scopes = effectiveScopes({ role: user.role, scopes: user.scopes, staffScopes: user.staffRole?.scopes ?? [] });
    const allowed = area === "any" ? canAccessConsole(user.role, scopes) : hasScope(scopes, area);
    if (!allowed) {
      throw new ApiError("FORBIDDEN", area === "any" ? "Console access required" : `Requires ${area} access`, 403);
    }
    return { id: user.id, email: user.email ?? "", via: "session", role: user.role, scopes };
  }

  const header = req.headers.get("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (raw) {
    const token = await db.apiToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: { include: { staffRole: { select: { scopes: true } } } } },
    });
    if (
      token &&
      token.user.role === "ADMIN" &&
      token.scopes.includes("admin") &&
      (!token.expiresAt || token.expiresAt > new Date())
    ) {
      if (token.user.suspendedAt) {
        throw new ApiError("SUSPENDED", "This account is suspended", 403);
      }
      // Bearer tokens are full-admin credentials: area check still applies
      // unless the token scope set is the admin one (it always is here).
      const scopes = effectiveScopes({
        role: token.user.role,
        scopes: token.user.scopes,
        staffScopes: token.user.staffRole?.scopes ?? [],
      });
      if (!hasScope(scopes, area) && !(area === "any" && canAccessConsole(token.user.role, scopes))) {
        throw new ApiError("FORBIDDEN", `Requires ${area} access`, 403);
      }
      return { id: token.user.id, email: token.user.email, via: "token", role: token.user.role, scopes };
    }
  }
  throw new ApiError("FORBIDDEN", "Admin access required", 403);
}

/** Wrap an admin route handler: 403s become JSON instead of crashing the handler. */
export function withAdmin<C>(
  handler: (req: Request, actor: AdminActor, ctx: C) => Promise<Response>,
  area = "admin"
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const actor = await requireAdmin(req, area);
      return await handler(req, actor, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.code, e.message, e.status);
      throw e;
    }
  };
}

/**
 * Best-effort audit write.
 *
 * An audit row must never be the reason a business operation fails. Several
 * callers run this *after* the work is already committed — checkout creates the
 * order, then audits it — so a failure here (a bad actor id, a constraint, a
 * dropped connection) turned a completed purchase into a 500. The buyer saw a
 * failure for an order that existed, and retrying risked a duplicate.
 *
 * Losing one trail entry is preferable to that, so failures are logged and
 * swallowed. If audit integrity ever needs to be strict, the right fix is an
 * outbox written inside the same transaction, not throwing from here.
 */
export async function audit(actorId: string | null, action: string, entity: string, entityId: string, meta?: unknown) {
  try {
    await db.auditLog.create({
      data: { actorId, action, entity, entityId, meta: (meta as object) ?? undefined },
    });
  } catch (e) {
    log.error("audit write failed", { action, entity, entityId, err: e });
  }
}
