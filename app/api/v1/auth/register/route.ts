import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { clientKey, limit } from "@/lib/api/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  // 10 signups per hour per client: generous for a person, useless for
  // enumerating which addresses already have accounts.
  const rl = await limit(clientKey(req, "register"), 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("RATE_LIMITED", "Too many signup attempts. Try again later.", 429, {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION", "Name, valid email and password (8+ chars) required", 422);
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return fail("CONFLICT", "An account with this email already exists", 409);

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "BUYER",
    },
    select: { id: true, name: true, email: true, role: true },
  });
  return ok(user, undefined, 201);
}
