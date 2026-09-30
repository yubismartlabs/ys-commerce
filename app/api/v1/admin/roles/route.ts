import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { AREAS } from "@/lib/auth/permissions";

// Custom roles never carry "admin" — full access stays exclusive to the ADMIN role.
const scopesSchema = z.array(z.string()).max(20).refine(
  (s) => s.every((x) => (AREAS as readonly string[]).includes(x) && x !== "admin"),
  { message: "Scopes must be console areas (vendors, orders, …). \"admin\" is not assignable." }
);

/**
 * Staff roles directory with assignment counts.
 *
 * Area "users" — matches the middleware gate for /ys-admin/roles. These roles
 * exist to scope user management, so the same staff who can open the users
 * area can define them. The default "admin" area would have 403'd every
 * scoped staff member after the page shell had already loaded.
 */
export const GET = withAdmin(async () => {
  const roles = await db.staffRole.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return ok(roles);
}, "users");

export const POST = withAdmin(async (req, actor) => {
  const parsed = z.object({ name: z.string().min(2).max(40), scopes: scopesSchema }).safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid role", 422);

  const existing = await db.staffRole.findUnique({ where: { name: parsed.data.name } });
  if (existing) return fail("CONFLICT", "A role with this name already exists", 409);

  const role = await db.staffRole.create({
    data: { name: parsed.data.name, scopes: [...new Set(parsed.data.scopes)] },
  });
  await audit(actor.id, "role.create", "StaffRole", role.id, { name: role.name, scopes: role.scopes });
  return ok(role, undefined, 201);
}, "users");
