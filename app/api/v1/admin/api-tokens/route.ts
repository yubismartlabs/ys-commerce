import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, hashToken, withAdmin } from "@/lib/api/guard";
import { getSettingGroup } from "@/lib/server-settings";

/** Mint a bearer token for the mobile app / scripts. The raw token is shown once. */
const createSchema = z.object({
  name: z.string().min(1).max(80).default("mobile-app"),
  /** Optional lifetime in days. Tokens never expiring is a standing risk. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const TOKEN_MAX_AGE_DAYS = 90;

export const POST = withAdmin(async (req, actor) => {
  // `security.allowAdminTokens` is enforced here — it was previously a live
  // console toggle that did nothing, so operators could revoke the capability
  // and tokens kept working.
  const { allowAdminTokens } = await getSettingGroup("security");
  if (!allowAdminTokens) {
    return fail("FORBIDDEN", "API tokens are disabled by the security policy", 403);
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("VALIDATION", "Invalid name", 422);

  const raw = `ys_${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(
    Date.now() + Math.min(parsed.data.expiresInDays ?? TOKEN_MAX_AGE_DAYS, TOKEN_MAX_AGE_DAYS) * 86400000
  );
  const token = await db.apiToken.create({
    data: {
      name: parsed.data.name,
      tokenHash: hashToken(raw),
      userId: actor.id,
      scopes: ["admin"],
      expiresAt,
    },
  });
  await audit(actor.id, "apitoken.create", "ApiToken", token.id, { name: parsed.data.name, expiresAt });
  return ok({ id: token.id, name: token.name, token: raw, expiresAt }, undefined, 201);
});

export const GET = withAdmin(async () => {
  const tokens = await db.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, scopes: true, expiresAt: true, createdAt: true, user: { select: { email: true } } },
  });
  return ok(tokens);
});
