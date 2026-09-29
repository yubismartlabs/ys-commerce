import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, hashToken, withAdmin } from "@/lib/api/guard";

/** Mint a bearer token for the mobile app / scripts. The raw token is shown once. */
const createSchema = z.object({
  name: z.string().min(1).max(80).default("mobile-app"),
});

export const POST = withAdmin(async (req, actor) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("VALIDATION", "Invalid name", 422);

  const raw = `ys_${randomBytes(24).toString("hex")}`;
  const token = await db.apiToken.create({
    data: { name: parsed.data.name, tokenHash: hashToken(raw), userId: actor.id, scopes: ["admin"] },
  });
  await audit(actor.id, "apitoken.create", "ApiToken", token.id, { name: parsed.data.name });
  return ok({ id: token.id, name: token.name, token: raw }, undefined, 201);
});

export const GET = withAdmin(async () => {
  const tokens = await db.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, scopes: true, expiresAt: true, createdAt: true, user: { select: { email: true } } },
  });
  return ok(tokens);
});
