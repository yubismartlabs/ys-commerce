/**
 * ISO 3166-1 alpha-2 country data for the address book.
 *
 * Kept deliberately small and dependency-free: two parallel string arrays
 * rather than 250 object literals, so the whole thing is a few KB on the wire
 * to the checkout form. Codes are alpha-2 and stored uppercase.
 */
export const COUNTRY_CODES = [
  "AE", "AR", "AT", "AU", "BE", "BG", "BH", "BR", "CA", "CH", "CL", "CN", "CO",
  "CY", "CZ", "DE", "DK", "DO", "EE", "EG", "ES", "FI", "FR", "GB", "GR", "HK",
  "HR", "HU", "ID", "IE", "IL", "IN", "IQ", "IS", "IT", "JO", "JP", "KR", "KW",
  "LT", "LU", "LV", "MA", "MX", "MY", "NG", "NL", "NO", "NZ", "OM", "PE", "PH",
  "PK", "PL", "PT", "QA", "RO", "RS", "SA", "SE", "SG", "SI", "SK", "TH", "TN",
  "TR", "UA", "US", "VN", "ZA",
] as const;

export const COUNTRY_NAMES = [
  "United Arab Emirates", "Argentina", "Austria", "Australia", "Belgium",
  "Bulgaria", "Bahrain", "Brazil", "Canada", "Switzerland", "Chile", "China",
  "Colombia", "Cyprus", "Czechia", "Germany", "Denmark", "Dominican Republic",
  "Estonia", "Egypt", "Spain", "Finland", "France", "United Kingdom", "Greece",
  "Hong Kong SAR", "Croatia", "Hungary", "Indonesia", "Ireland", "Israel", "India",
  "Iraq", "Iceland", "Italy", "Jordan", "Japan", "South Korea", "Kuwait",
  "Lithuania", "Luxembourg", "Latvia", "Morocco", "Mexico", "Malaysia", "Nigeria",
  "Netherlands", "Norway", "New Zealand", "Oman", "Peru", "Philippines",
  "Pakistan", "Poland", "Portugal", "Qatar", "Romania", "Serbia", "Saudi Arabia",
  "Sweden", "Singapore", "Slovenia", "Slovakia", "Thailand", "Tunisia",
  "Türkiye", "Ukraine", "United States", "Vietnam", "South Africa",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const COUNTRY_BY_CODE = new Map<string, string>(
  COUNTRY_CODES.map((code, i) => [code, COUNTRY_NAMES[i] as string])
);

/** Display name for a code, falling back to the code itself. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return COUNTRY_BY_CODE.get(code.toUpperCase()) ?? code.toUpperCase();
}

export function isKnownCountry(code: string): boolean {
  return COUNTRY_BY_CODE.has(code.toUpperCase());
}

/**
 * Subdivisions (state / province / region) for the countries where a
 * free-text field would let buyers type nonsense. Every other country
 * legitimately has no subdivision, so `region` stays optional there.
 */
export const SUBDIVISIONS: Record<string, string[]> = {
  US: [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
  CA: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick",
    "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut",
    "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
  ],
  AU: [
    "Australian Capital Territory", "New South Wales", "Northern Territory",
    "Queensland", "South Australia", "Tasmania", "Victoria", "Western Australia",
  ],
  GB: ["England", "Northern Ireland", "Scotland", "Wales"],
  MX: [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
    "Chiapas", "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato",
    "Guerrero", "Hidalgo", "Jalisco", "Mexico City", "Michoacán", "Morelos",
    "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo",
    "San Luis Potosí", "Sinaloa", "Sonora", "State of Mexico", "Tabasco",
    "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
  ],
  IN: [
    "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan",
    "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  ],
};

/**
 * Abbreviations for the countries above, used only when rendering. Full names
 * are stored (so the picker and validation speak the buyer's language), but
 * "New York NY 10001" is how an address is meant to read — "New York New York
 * 10001" is what you get without this.
 */
const US_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

const REGION_ABBREV: Record<string, Record<string, string>> = {
  US: Object.fromEntries(SUBDIVISIONS.US.map((name, i) => [name, US_CODES[i] as string])),
  CA: {
    Alberta: "AB", "British Columbia": "BC", Manitoba: "MB", "New Brunswick": "NB",
    "Newfoundland and Labrador": "NL", "Northwest Territories": "NT", "Nova Scotia": "NS",
    Nunavut: "NU", Ontario: "ON", "Prince Edward Island": "PE", Quebec: "QC",
    Saskatchewan: "SK", Yukon: "YT",
  },
  AU: {
    "Australian Capital Territory": "ACT", "New South Wales": "NSW",
    "Northern Territory": "NT", Queensland: "QLD", "South Australia": "SA",
    Tasmania: "TAS", Victoria: "VIC", "Western Australia": "WA",
  },
  GB: { England: "ENG", "Northern Ireland": "NIR", Scotland: "SCT", Wales: "WLS" },
};

/** Abbreviate a subdivision for display; falls back to the full name. */
export function regionAbbrev(country: string | null | undefined, region: string | null | undefined): string {
  if (!region) return "";
  const table = REGION_ABBREV[country?.toUpperCase() ?? ""];
  return table?.[region] ?? region;
}

/** Subdivisions for a country, or [] when it has none / is unknown. */
export function subdivisionsFor(code: string | null | undefined): string[] {
  if (!code) return [];
  return SUBDIVISIONS[code.toUpperCase()] ?? [];
}

export function hasSubdivisions(code: string | null | undefined): boolean {
  return subdivisionsFor(code).length > 0;
}

/**
 * Postal codes are alphanumeric nearly everywhere but the exact pattern is
 * country-specific and buyers mistype. This is a shared sanity bound, not a
 * validator: it only rejects input that cannot be a postal code at all.
 */
export function postalCodeHint(code: string | null | undefined): string {
  switch (code?.toUpperCase()) {
    case "US":
      return "5 or 9 digits";
    case "CA":
      return "A1A 1A1";
    case "GB":
      return "e.g. SW1A 1AA";
    case "NL":
      return "4 digits + 2 letters";
    case "DE":
      return "5 digits";
    case "IN":
      return "6 digits";
    default:
      return "";
  }
}