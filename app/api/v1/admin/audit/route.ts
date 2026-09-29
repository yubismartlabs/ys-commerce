import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

/** Audit trail viewer: who did what, filterable by actor/action/entity. */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const entity = url.searchParams.get("entity");
  const actorId = url.searchParams.get("actorId");
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(entity ? { entity: { contains: entity, mode: "insensitive" as const } } : {}),
    ...(actorId ? { actorId } : {}),
  };
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { email: true, name: true } } },
    }),
  ]);
  return ok(logs, { page, pageSize, total });
}, "ops");
