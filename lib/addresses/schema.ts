import { z } from "zod";
import { hasSubdivisions, isKnownCountry, regionAbbrev } from "./countries";

/**
 * Address validation shared by the address book and checkout, so a saved
 * address and a one-off checkout address are held to exactly the same rules.
 */

/** Postal codes: 2–12 of the characters real postal codes actually use. */
const postalCode = z
  .string()
  .trim()
  .min(2, "Enter a postal code")
  .max(12, "Postal code is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Postal code can only contain letters, numbers, spaces and dashes");

export const addressFields = {
  label: z.string().trim().max(40).optional().nullable(),
  name: z.string().trim().min(2, "Enter a recipient name").max(80),
  phone: z.string().trim().max(30).optional().nullable(),
  line1: z.string().trim().min(3, "Enter a street address").max(120),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2, "Enter a city").max(80),
  region: z.string().trim().max(80).optional().nullable(),
  postalCode,
  country: z
    .string()
    .trim()
    .length(2, "Pick a country")
    .transform((v) => v.toUpperCase())
    .refine(isKnownCountry, "Pick a country from the list"),
};

/**
 * A full address. `region` is required exactly when the chosen country has a
 * known subdivision list — that is the one rule a flat zod object can't
 * express, so it is enforced here rather than in a per-field refine.
 */
export const addressSchema = z
  .object(addressFields)
  .superRefine((a, ctx) => {
    if (hasSubdivisions(a.country) && !a.region?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["region"],
        message: "Pick a state or province",
      });
    }
  });

/** Same shape, but every field optional — for PATCH. */
export const addressPatchSchema = z
  .object({
    label: addressFields.label,
    name: addressFields.name.optional(),
    phone: addressFields.phone,
    line1: addressFields.line1.optional(),
    line2: addressFields.line2,
    city: addressFields.city.optional(),
    region: addressFields.region,
    postalCode: addressFields.postalCode.optional(),
    country: addressFields.country.optional(),
    isDefault: z.boolean().optional(),
  })
  .strip();

/** Cap per buyer. eBay allows a handful; more than this is a data-entry slip. */
export const MAX_ADDRESSES = 10;

export type AddressInput = z.infer<typeof addressSchema>;
export type AddressPatch = z.infer<typeof addressPatchSchema>;

/** Collapse "" to null so optional columns don't accumulate empty strings. */
export function blankToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Render an address as the lines a carrier or a packing slip wants.
 * Single-line consumers (order summaries, admin tables) join on ", ".
 */
export function formatAddressLines(a: {
  line1: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string[] {
  const lines: string[] = [];
  if (a.line1) lines.push(a.line1);
  if (a.line2) lines.push(a.line2);

  // "New York NY 10001", and never "New York New York 10001": a city named
  // after its state is the common case in the US, so drop the duplicate.
  const city = a.city?.trim() || null;
  const regionFull = a.region?.trim() || null;
  const region =
    regionFull && regionFull.toLowerCase() === city?.toLowerCase() ? null : regionAbbrev(a.country, regionFull);

  const locality = [city, region, a.postalCode?.trim() || null].filter(Boolean).join(" ");
  if (locality) lines.push(locality);
  return lines;
}

/** One-line form: "123 Main St, New York NY 10001, United States". */
export function formatAddressOneLine(a: Parameters<typeof formatAddressLines>[0]): string {
  return formatAddressLines(a).join(", ");
}