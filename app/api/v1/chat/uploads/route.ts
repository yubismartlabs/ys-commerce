import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Chat image upload. Clients AES-GCM-seal bytes BEFORE uploading, so blobs
 * on disk are ciphertext (Content-Type carries no image hint). Stored as
 * .enc files; buyers and sellers only.
 */
export async function POST(req: Request) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("VALIDATION", "Expected multipart form with a 'file' field", 422);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("VALIDATION", "Missing 'file' field", 422);
  if (file.size > MAX_BYTES) return fail("VALIDATION", "File must be 5MB or smaller", 422);
  // Accept any bytes — sealed blobs have no reliable MIME. Size-capped only.

  const user = await db.user.findUnique({ where: { id: me.id }, select: { role: true } });
  if (!user || (user.role !== "BUYER" && user.role !== "SELLER" && user.role !== "ADMIN")) {
    return fail("FORBIDDEN", "Buyers and sellers only", 403);
  }

  const name = `chat-${Date.now()}-${randomBytes(8).toString("hex")}.enc`;
  const dir = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "chat"));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
  return ok({ url: `/uploads/chat/${name}`, size: file.size }, undefined, 201);
}
