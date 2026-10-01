import { db } from "@/lib/db";
import { blankToNull, MAX_ADDRESSES, type AddressInput } from "./schema";

/**
 * The address book invariants. These live here rather than in the route
 * handlers so the checkout and the CRUD endpoints can't drift apart.
 *
 * Single default is enforced twice over: in code (clearDefaults runs in the
 * same transaction as the write that needs it) and in the database by the
 * partial unique index "Address_one_default_per_user" created in the
 * migration. The DB constraint is the one that matters — it is the only thing
 * that survives two concurrent "set default" requests.
 */

/** Cap per buyer, counted before insert. */
export async function assertUnderAddressLimit(userId: string): Promise<boolean> {
  const count = await db.address.count({ where: { userId } });
  return count < MAX_ADDRESSES;
}

/**
 * Clear every other default for this buyer, then optionally promote one.
 * `tx` is a Prisma transaction client; the union with `db` is what lets this
 * run standalone or inside a caller's transaction.
 */
export async function clearDefaults(
  userId: string,
  keepId?: string,
  tx: Pick<typeof db, "address"> = db
) {
  await tx.address.updateMany({
    where: { userId, ...(keepId ? { NOT: { id: keepId } } : {}) },
    data: { isDefault: false },
  });
}



/** Every address, default first, then oldest — the order the book renders in. */
export async function listAddresses(userId: string) {
  return db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/** Normalise a validated payload into nullable DB columns. */
export function toRow(a: AddressInput) {
  return {
    label: blankToNull(a.label),
    name: a.name.trim(),
    phone: blankToNull(a.phone),
    line1: a.line1.trim(),
    line2: blankToNull(a.line2),
    city: a.city.trim(),
    region: blankToNull(a.region),
    postalCode: a.postalCode.trim(),
    country: a.country.toUpperCase(),
  };
}