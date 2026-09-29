import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
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
