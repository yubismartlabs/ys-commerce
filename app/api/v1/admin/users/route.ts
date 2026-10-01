import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getPagination, ok, fail } from "@/lib/api/http";
import { audit, denyUnless, withAdmin } from "@/lib/api/guard";
import { getEmailConfig, sendEmail } from "@/lib/email/send";
import { accountInviteEmail } from "@/lib/email/templates";
import { notifyUser } from "@/lib/notifications/notify";

/** User directory: search + role/status filters, order volume per row. */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status"); // active | suspended
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    ...(q
      ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }, { username: { contains: q, mode: "insensitive" as const } }] }
      : {}),
    ...(role ? { role: role as "BUYER" | "ADMIN" } : {}),
    ...(status === "suspended" ? { suspendedAt: { not: null } } : status === "active" ? { suspendedAt: null } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        suspendedAt: true,
        createdAt: true,
        staffRole: { select: { id: true, name: true } },
        _count: { select: { stores: true, disputes: true } },
      },
    }),
  ]);
  const ids = users.map((u) => u.id);
  const orderCounts = ids.length
    ? await db.order.groupBy({ by: ["buyerId"], where: { buyerId: { in: ids } }, _count: true })
    : [];
  const ordersByUser = new Map(orderCounts.map((o) => [o.buyerId, o._count]));
  return ok(
    users.map((u) => ({ ...u, orderCount: ordersByUser.get(u.id) ?? 0 })),
    { page, pageSize, total }
  );
}, "users");

const createSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["BUYER", "ADMIN"]).default("BUYER"),
  staffRoleId: z.string().nullable().optional(),
});

/**
 * Create an account directly (invite). A temporary password is generated
 * unless one is provided — returned once and emailed when mail is on.
 * Minting ADMINs requires superuser.
 */
export const POST = withAdmin(async (req, actor) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Name, valid email and role required", 422);
  if (parsed.data.role === "ADMIN") denyUnless(actor, "admin");

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return fail("CONFLICT", "An account with this email already exists", 409);

  let staffRoleId: string | null = null;
  if (parsed.data.staffRoleId) {
    const role = await db.staffRole.findUnique({ where: { id: parsed.data.staffRoleId } });
    if (!role) return fail("NOT_FOUND", "Staff role not found", 404);
    staffRoleId = role.id;
  }

  const temp = parsed.data.password ?? randomBytes(12).toString("base64url");
  const config = await getEmailConfig();
  const { generateUsernameForNewUser } = await import("@/lib/usernames-server");
  const username = await generateUsernameForNewUser(parsed.data.name, parsed.data.email);
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      username,
      passwordHash: await bcrypt.hash(temp, 10),
      role: parsed.data.role,
      staffRoleId,
    },
    select: { id: true, name: true, username: true, email: true, role: true },
  });
  await audit(actor.id, "user.create", "User", user.id, { email: user.email, role: user.role });
  let emailed = false;
  if (config.enabled) {
    const r = await sendEmail({
      to: user.email,
      template: accountInviteEmail({ siteName: config.siteName, tempPassword: temp, role: user.role }),
    });
    emailed = r.ok;
  }
  await notifyUser({ userId: user.id, type: "account.created", title: `Welcome to ${config.siteName}` });
  // Shown once — never stored or logged.
  return ok({ ...user, tempPassword: temp, emailed }, undefined, 201);
}, "users");
