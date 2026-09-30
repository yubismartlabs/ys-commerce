import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { AREAS } from "@/lib/auth/permissions";

const scopesSchema = z.array(z.string()).max(20).refine(
  (s) => s.every((x) => (AREAS as readonly string[]).includes(x) && x !== "admin"),
  { message: "Scopes must be console areas (vendors, orders, …). \"admin\" is not assignable." }
);

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const role = await db.staffRole.findUnique({
      where: { id },
      include: { users: { select: { id: true, name: true, email: true } } },
    });
    if (!role) return fail("NOT_FOUND", "Role not found", 404);
    return ok(role);
  },
  "users"
);

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = z
      .object({ name: z.string().min(2).max(40).optional(), scopes: scopesSchema.optional() })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid role", 422);

    const role = await db.staffRole.findUnique({ where: { id } });
    if (!role) return fail("NOT_FOUND", "Role not found", 404);
    if (parsed.data.name && parsed.data.name !== role.name) {
      const clash = await db.staffRole.findUnique({ where: { name: parsed.data.name } });
      if (clash) return fail("CONFLICT", "A role with this name already exists", 409);
    }
    const updated = await db.staffRole.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.scopes ? { scopes: [...new Set(parsed.data.scopes)] } : {}),
      },
    });
    await audit(actor.id, "role.update", "StaffRole", id, { name: updated.name, scopes: updated.scopes });
    return ok(updated);
  },
  "users"
);

export const DELETE = withAdmin(
  async (_req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const role = await db.staffRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) return fail("NOT_FOUND", "Role not found", 404);
    if (role._count.users > 0) {
      return fail("CONFLICT", `Unassign ${role._count.users} user(s) first`, 409);
    }
    await db.staffRole.delete({ where: { id } });
    await audit(actor.id, "role.delete", "StaffRole", id, { name: role.name });
    return ok({ deleted: true });
  },
  "users"
);
