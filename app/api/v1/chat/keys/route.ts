import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";

async function actor() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw e;
  }
}

const backupSchema = z.object({
  wrappedPrivate: z.string().min(16).max(4000),
  salt: z.string().min(8).max(200),
  iv: z.string().min(8).max(200),
});

const putSchema = z.object({
  // Base64 SPKI of the P-256 ECDH identity public key (91 bytes).
  publicKey: z.string().min(100).max(200),
  // Passphrase-wrapped private JWK (ciphertext only) for new-device restore.
  backup: backupSchema.optional(),
  // Explicit rotation: previous history becomes unreadable. Warn in UI.
  rotate: z.boolean().optional(),
});

/** Publish (or rotate) my chat identity public key + backup. */
export async function PUT(req: Request) {
  let me;
  try {
    me = await actor();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "publicKey required", 422);
  let raw: Buffer;
  try {
    raw = Buffer.from(parsed.data.publicKey, "base64");
  } catch {
    return fail("VALIDATION", "publicKey must be base64", 422);
  }
  if (raw.length !== 91) return fail("VALIDATION", "publicKey must be a P-256 SPKI (91 bytes)", 422);
  await db.user.update({
    where: { id: me.id },
    data: {
      identityKey: parsed.data.publicKey,
      ...(parsed.data.backup ? { identityBackup: JSON.stringify(parsed.data.backup) } : {}),
    },
  });
  return ok({ published: true, rotated: !!parsed.data.rotate });
}

/** Key directory: fetch any user's identity public key (for wrapping). */
export async function GET(req: Request) {
  let me;
  try {
    me = await actor();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    const self = await db.user.findUnique({ where: { id: me.id }, select: { identityKey: true, identityBackup: true } });
    if (url.searchParams.get("backup") === "1") {
      return ok({ backup: self?.identityBackup ?? null });
    }
    return ok({ userId: me.id, identityKey: self?.identityKey ?? null, hasBackup: !!self?.identityBackup });
  }
  const other = await db.user.findUnique({ where: { id: userId }, select: { id: true, identityKey: true } });
  if (!other) return fail("NOT_FOUND", "User not found", 404);
  return ok({ userId: other.id, identityKey: other.identityKey });
}
