import { db } from "@/lib/db";
import { stripAtParam } from "@/lib/stores/url";

export type ResolvedStore = {
  id: string;
  name: string;
  slug: string;
  username: string | null;
  status: string;
  ownerId: string;
};

/**
 * Resolve a public store param: @handle (canonical) or legacy slug.
 * Returns null for unknown or non-approved stores.
 */
export async function resolvePublicStore(raw: string): Promise<ResolvedStore | null> {
  const key = stripAtParam(decodeURIComponent(raw));
  if (!key) return null;
  const byUsername = await db.store.findUnique({
    where: { username: key },
    select: { id: true, name: true, slug: true, username: true, status: true, ownerId: true },
  });
  if (byUsername) return byUsername.status === "APPROVED" ? byUsername : null;
  const bySlug = await db.store.findUnique({
    where: { slug: key },
    select: { id: true, name: true, slug: true, username: true, status: true, ownerId: true },
  });
  if (!bySlug || bySlug.status !== "APPROVED") return null;
  return bySlug;
}
