"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_CODES, COUNTRY_NAMES, countryName, postalCodeHint, subdivisionsFor } from "@/lib/addresses/countries";

export type AddressFormValue = {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export const EMPTY_ADDRESS: AddressFormValue = {
  label: "",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
};

/** Coerce an API row into form state (nullable columns → empty strings). */
export function toFormValue(a: {
  label?: string | null;
  name?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
} | null | undefined): AddressFormValue {
  const v = a ?? {};
  return {
    label: v.label ?? "",
    name: v.name ?? "",
    phone: v.phone ?? "",
    line1: v.line1 ?? "",
    line2: v.line2 ?? "",
    city: v.city ?? "",
    region: v.region ?? "",
    postalCode: v.postalCode ?? "",
    country: v.country || "US",
  };
}

/**
 * Address fields shared by the address book and the checkout one-off form, so
 * both validate and autocomplete identically. Controlled by `value`; the
 * region field switches to a select for countries that have a known
 * subdivision list and stays free text everywhere else.
 */
export function AddressFields({
  value,
  onChange,
  idPrefix,
  showLabel = true,
}: {
  value: AddressFormValue;
  onChange: (next: AddressFormValue) => void;
  idPrefix: string;
  showLabel?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const set = (patch: Partial<AddressFormValue>) => onChange({ ...value, ...patch });
  const regions = subdivisionsFor(value.country);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {showLabel ? (
        <div className="space-y-1">
          <label htmlFor={id("label")} className="text-xs font-semibold text-neutral-600">
            Label
          </label>
          <Input
            id={id("label")}
            placeholder="Home"
            maxLength={40}
            value={value.label}
            onChange={(e) => set({ label: e.target.value })}
          />
          <p className="text-[11px] text-neutral-400">Only you see this — e.g. Home, Office.</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor={id("name")} className="text-xs font-semibold text-neutral-600">
          Full name *
        </label>
        <Input
          id={id("name")}
          placeholder="Jane Doe"
          autoComplete="name"
          maxLength={80}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={id("phone")} className="text-xs font-semibold text-neutral-600">
          Phone
        </label>
        <Input
          id={id("phone")}
          placeholder="(555) 123-4567"
          autoComplete="tel"
          maxLength={30}
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </div>

      <div className="space-y-1 md:col-span-2">
        <label htmlFor={id("line1")} className="text-xs font-semibold text-neutral-600">
          Street *
        </label>
        <Input
          id={id("line1")}
          placeholder="123 Main St"
          autoComplete="address-line1"
          maxLength={120}
          value={value.line1}
          onChange={(e) => set({ line1: e.target.value })}
        />
      </div>

      <div className="space-y-1 md:col-span-2">
        <label htmlFor={id("line2")} className="text-xs font-semibold text-neutral-600">
          Apartment, suite, etc.
        </label>
        <Input
          id={id("line2")}
          placeholder="Apt 4B"
          autoComplete="address-line2"
          maxLength={120}
          value={value.line2}
          onChange={(e) => set({ line2: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={id("city")} className="text-xs font-semibold text-neutral-600">
          City *
        </label>
        <Input
          id={id("city")}
          placeholder="New York"
          autoComplete="address-level2"
          maxLength={80}
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
        />
      </div>

      {regions.length > 0 ? (
        <div className="space-y-1">
          <label htmlFor={id("region-trigger")} className="text-xs font-semibold text-neutral-600">
            State / Province *
          </label>
          <Select
            value={value.region || undefined}
            onValueChange={(v) => set({ region: v })}
          >
            <SelectTrigger id={id("region-trigger")} className="w-full">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1">
          <label htmlFor={id("region")} className="text-xs font-semibold text-neutral-600">
            State / Region
          </label>
          <Input
            id={id("region")}
            autoComplete="address-level1"
            maxLength={80}
            value={value.region}
            onChange={(e) => set({ region: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={id("postalCode")} className="text-xs font-semibold text-neutral-600">
          {value.country === "US" ? "ZIP" : "Postal code"} *
        </label>
        <Input
          id={id("postalCode")}
          placeholder={postalCodeHint(value.country) || "Postal code"}
          autoComplete="postal-code"
          maxLength={12}
          value={value.postalCode}
          onChange={(e) => set({ postalCode: e.target.value })}
        />
        {postalCodeHint(value.country) ? (
          <p className="text-[11px] text-neutral-400">{postalCodeHint(value.country)}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor={id("country-trigger")} className="text-xs font-semibold text-neutral-600">
          Country *
        </label>
        <Select
          value={value.country || "US"}
          onValueChange={(v) => {
            // Switching country invalidates the region: the old value is
            // meaningless in the new one, and shipping it would save "New
            // York" as a French region. Clear it and let the buyer re-pick.
            set({ country: v, region: "" });
          }}
        >
          <SelectTrigger id={id("country-trigger")} className="w-full" aria-label="Country">
            <SelectValue placeholder="Pick a country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((code, i) => (
              <SelectItem key={code} value={code}>
                {COUNTRY_NAMES[i]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11px] text-neutral-400 md:col-span-2">
        Ships to {countryName(value.country)}
        {regions.length > 0 ? ` · ${regions.length} states/provinces available` : ""}
      </p>
    </div>
  );
}

/** Client-side mirror of the API's required-field rule, for gating the button. */
export function isAddressComplete(v: AddressFormValue): boolean {
  return (
    v.name.trim().length >= 2 &&
    v.line1.trim().length >= 3 &&
    v.city.trim().length >= 2 &&
    v.postalCode.trim().length >= 2
  );
}