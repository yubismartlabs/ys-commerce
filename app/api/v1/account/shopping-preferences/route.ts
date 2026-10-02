import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { PREFERENCE_KINDS, limitFor, validateValue } from "@/lib/shopping-preferences";

const postSchema = z.union([
  z.object({ kind: z.enum(PREFERENCE_KINDS), value: z.string().min(1).max(60) }),
  // Multi-select commit from the picker sheet: one request for the whole
  // selection, rather than N round trips racing each other.
  z.object({ kind: z.enum(PREFERENCE_KINDS), values: z.array(z.string().min(1).max(60)).min(1).max(40) }),
]);

/**
 * The buyer's sizes and brands.
 *
 * `brands` in meta is every distinct brand in the catalogue, sorted, so the
 * picker can filter it instantly with no round trip per keystroke. It is a
 * convenience only — a preference can be any string, and nothing here requires
 * the brand to exist.
 */
export async function GET() {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const [rows, brands] = await Promise.all([
    db.shoppingPreference.findMany({ where: { userId: actor.id }, orderBy: { value: "asc" } }),
    db.product
      .groupBy({ by: ["brand"], where: { status: "ACTIVE", brand: { not: null } } })
      // `brand` is nullable, so the group key can be null even with the filter.
      .then((g) =>
        g
          .filter((x) => !!x.brand)
          .map((x) => x.brand as string)
          // groupBy gives no ordering guarantee, and Postgres folds case in
          // comparisons — collapse "Nike"/"nike" to one entry so the picker
          // can't offer a brand the save endpoint would then reject as a dupe.
          .filter((b, i, arr) => arr.findIndex((o) => o.toLowerCase() === b.toLowerCase()) === i)
          .sort((a, b) => a.localeCompare(b))
      ),
  ]);

  return ok(
    {
      sizes: rows.filter((r) => r.kind === "SIZE").map((r) => r.value),
      brands: rows.filter((r) => r.kind === "BRAND").map((r) => r.value),
    },
    undefined,
    200,
    { maxSizes: limitFor("SIZE"), maxBrands: limitFor("BRAND"), brands }
  );
}

class PreferenceError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

/**
 * Add a size or brand — or a whole selection at once. Re-adding one the buyer
 * already has is a no-op success rather than a 409 — the UI double-submits
 * easily, and "already saved" is the state they asked for anyway.
 *
 * A batch write and concurrent single writes could each pass the limit check
 * and together exceed it, so the check and the insert run in one transaction.
 * The partial unique index underneath is the backstop, not the plan.
 */
export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Pick a kind and enter one or more values", 422);

  const inputs = "values" in parsed.data ? parsed.data.values : [parsed.data.value];
  const kind = parsed.data.kind;
  const checked: string[] = [];
  for (const raw of inputs) {
    const v = validateValue(kind, raw);
    if ("error" in v) return fail("VALIDATION", v.error, 422);
    checked.push(v.value);
  }

  const noun = kind === "SIZE" ? "sizes" : "brands";
  try {
    const added = await db.$transaction(async (tx) => {
      const have = new Set(
        (await tx.shoppingPreference.findMany({ where: { userId: actor.id, kind }, select: { value: true } })).map(
          (r) => r.value.toLowerCase()
        )
      );
      const fresh = checked.filter((v, i) => {
        // De-dupe within the request too — selecting the same brand twice from
        // the sheet must not make the limit check see double.
        const lower = v.toLowerCase();
        if (have.has(lower)) return false;
        have.add(lower);
        return checked.findIndex((o) => o.toLowerCase() === lower) === i;
      });
      // `have` already absorbed `fresh`, so its size minus what we are about
      // to add is the pre-existing count.
      const existingCount = have.size - fresh.length;
      const room = Math.max(0, limitFor(kind) - existingCount);
      if (fresh.length > room) {
        throw new PreferenceError(
          "CONFLICT",
          `Only ${room} more ${noun} fit — remove something first, or split the selection.`
        );
      }
      if (fresh.length === 0) return [];
      await tx.shoppingPreference.createMany({ data: fresh.map((value) => ({ userId: actor.id, kind, value })) });
      return fresh;
    });

    if (!("values" in parsed.data)) {
      if (added.length === 0) return ok({ kind, value: checked[0], alreadySaved: true });
      return ok({ kind, value: added[0] }, undefined, 201);
    }
    return ok({ kind, added }, undefined, added.length > 0 ? 201 : 200);
  } catch (e) {
    if (e instanceof PreferenceError) {
      return fail(e.code, e.message, e.code === "CONFLICT" ? 409 : 422);
    }
    // A genuine race hits the unique index; surface it as the same 409 the
    // limit check produces rather than a raw Prisma error.
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      return fail("CONFLICT", "Some of those were already saved.", 409);
    }
    throw e;
  }
}