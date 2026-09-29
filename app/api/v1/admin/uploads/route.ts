import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);
const MAX_BYTES = 2 * 1024 * 1024;

function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads");
  return resolve(dir);
}

export const POST = withAdmin(async (req, actor) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("VALIDATION", "Expected multipart form with a 'file' field", 422);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("VALIDATION", "Missing 'file' field", 422);

  const ext = ALLOWED.get(file.type);
  if (!ext) return fail("VALIDATION", "Only PNG, JPEG, WebP or SVG images allowed", 422);
  if (file.size > MAX_BYTES) return fail("VALIDATION", "File must be 2MB or smaller", 422);

  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${name}`;
  await audit(actor.id, "upload.create", "Upload", name, { type: file.type, size: file.size });
  return ok({ url, type: file.type, size: file.size }, undefined, 201);
}, "settings");

export const GET = withAdmin(async () => {
  // Document the endpoint; listing lives on disk (dev-grade local storage).
  const rows = await db.auditLog.findMany({
    where: { action: "upload.create" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { entityId: true, meta: true, createdAt: true },
  });
  return ok(
    rows.map((r) => ({
      url: `/uploads/${r.entityId}`,
      ...(typeof r.meta === "object" && r.meta ? (r.meta as Record<string, unknown>) : {}),
      createdAt: r.createdAt,
    }))
  );
}, "settings");
