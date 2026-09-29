import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { getEmailConfig, sendEmail } from "@/lib/email/send";
import { accountReinstatedEmail, accountSuspendedEmail, adminPasswordResetEmail } from "@/lib/email/templates";
import { notifyUser } from "@/lib/notifications/notify";

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        scopes: true,
        suspendedAt: true,
        suspendReason: true,
        emailVerified: true,
        createdAt: true,
        stores: { select: { id: true, name: true, slug: true, status: true } },
        _count: { select: { disputes: true, apiTokens: true, notifications: true } },
      },
    });
    if (!user) return fail("NOT_FOUND", "User not found", 404);
    const [orderCount, orderTotal, redemptions, auditRecent] = await Promise.all([
      db.order.count({ where: { buyerId: id } }),
      db.order.aggregate({ where: { buyerId: id }, _sum: { total: true } }),
      db.couponRedemption.count({ where: { userId: id } }),
      db.auditLog.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);
    return ok({
      ...user,
      orderCount,
      orderTotal: Number(orderTotal._sum.total ?? 0),
      redemptions,
      auditRecent,
    });
  }
);

const patchSchema = z.union([
  z.object({ action: z.literal("role"), role: z.enum(["BUYER", "SELLER", "ADMIN"]) }),
  z.object({ action: z.literal("suspend"), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("unsuspend") }),
  z.object({ action: z.literal("resetPassword") }),
  z.object({ action: z.literal("profile"), name: z.string().min(1).max(80) }),
]);

async function assertNotLastAdmin(id: string): Promise<boolean> {
  const admins = await db.user.count({ where: { role: "ADMIN" } });
  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  return target?.role === "ADMIN" && admins <= 1;
}

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Invalid user action", 422);

    const user = await db.user.findUnique({ where: { id } });
    if (!user) return fail("NOT_FOUND", "User not found", 404);
    const config = await getEmailConfig();

    if (parsed.data.action === "role") {
      if (parsed.data.role !== "ADMIN" && (await assertNotLastAdmin(id))) {
        return fail("CONFLICT", "Cannot demote the last admin", 409);
      }
      const updated = await db.user.update({ where: { id }, data: { role: parsed.data.role } });
      await audit(actor.id, "user.role", "User", id, { from: user.role, to: parsed.data.role });
      await notifyUser({
        userId: id,
        type: "account.role",
        title: `Your account role is now ${parsed.data.role}`,
        link: undefined,
      });
      return ok({ id: updated.id, role: updated.role });
    }

    if (parsed.data.action === "suspend") {
      if (await assertNotLastAdmin(id)) return fail("CONFLICT", "Cannot suspend the last admin", 409);
      if (user.suspendedAt) return fail("CONFLICT", "User is already suspended", 409);
      // Full freeze: suspend APPROVED stores so listings go dark immediately.
      const approved = await db.store.findMany({ where: { ownerId: id, status: "APPROVED" }, select: { id: true } });
      await db.$transaction([
        db.user.update({ where: { id }, data: { suspendedAt: new Date(), suspendReason: parsed.data.reason ?? null } }),
        ...(approved.length ? [db.store.updateMany({ where: { id: { in: approved.map((s) => s.id) } }, data: { status: "SUSPENDED" } })] : []),
      ]);
      await audit(actor.id, "user.suspend", "User", id, { reason: parsed.data.reason, suspendedStores: approved.map((s) => s.id) });
      await notifyUser({
        userId: id,
        type: "account.suspended",
        title: "Your account is suspended",
        body: parsed.data.reason ?? undefined,
        email: {
          template: accountSuspendedEmail({ siteName: config.siteName, reason: parsed.data.reason }),
          name: "account.suspended",
          enabled: config.enabled,
        },
      });
      return ok({ id, suspended: true, suspendedStores: approved.length });
    }

    if (parsed.data.action === "unsuspend") {
      if (!user.suspendedAt) return fail("CONFLICT", "User is not suspended", 409);
      // Restore stores this suspension froze (recorded in the suspend audit).
      const lastSuspend = await db.auditLog.findFirst({
        where: { action: "user.suspend", entityId: id },
        orderBy: { createdAt: "desc" },
      });
      const frozenIds = ((lastSuspend?.meta as { suspendedStores?: string[] } | null)?.suspendedStores ?? []).filter(
        (x): x is string => typeof x === "string"
      );
      await db.$transaction([
        db.user.update({ where: { id }, data: { suspendedAt: null, suspendReason: null } }),
        ...(frozenIds.length
          ? [db.store.updateMany({ where: { id: { in: frozenIds }, status: "SUSPENDED" }, data: { status: "APPROVED" } })]
          : []),
      ]);
      await audit(actor.id, "user.unsuspend", "User", id, { restoredStores: frozenIds });
      await notifyUser({
        userId: id,
        type: "account.reinstated",
        title: "Your account is restored",
        email: { template: accountReinstatedEmail({ siteName: config.siteName }), name: "account.reinstated", enabled: config.enabled },
      });
      return ok({ id, suspended: false, restoredStores: frozenIds.length });
    }

    if (parsed.data.action === "resetPassword") {
      const temp = randomBytes(12).toString("base64url");
      await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temp, 10) } });
      await audit(actor.id, "user.resetPassword", "User", id, {});
      if (config.enabled) {
        await sendEmail({
          to: user.email,
          template: adminPasswordResetEmail({ siteName: config.siteName, tempPassword: temp }),
        });
      }
      // Shown once — never stored or logged.
      return ok({ id, tempPassword: temp, emailed: config.enabled });
    }

    // profile
    const updated = await db.user.update({ where: { id }, data: { name: parsed.data.name } });
    await audit(actor.id, "user.profile", "User", id, { name: parsed.data.name });
    return ok({ id: updated.id, name: updated.name });
  }
);

export const DELETE = withAdmin(
  async (_req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      include: {
        _count: { select: { stores: true, disputes: true, apiTokens: true } },
      },
    });
    if (!user) return fail("NOT_FOUND", "User not found", 404);
    if (id === actor.id) return fail("CONFLICT", "You cannot delete your own account", 409);
    if (await assertNotLastAdmin(id)) return fail("CONFLICT", "Cannot delete the last admin", 409);
    if (user._count.stores > 0) return fail("CONFLICT", "Delete or transfer their stores first", 409);
    const [orders, redemptions] = await Promise.all([
      db.order.count({ where: { buyerId: id } }),
      db.couponRedemption.count({ where: { userId: id } }),
    ]);
    if (orders > 0 || user._count.disputes > 0 || redemptions > 0) {
      return fail("CONFLICT", "Suspend instead — this user has order history", 409);
    }
    await db.user.delete({ where: { id } });
    await audit(actor.id, "user.delete", "User", id, { email: user.email });
    return ok({ deleted: true });
  }
);
