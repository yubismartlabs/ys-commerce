/**
 * Buyer-facing labels for product report reasons. Shared by the report dialog
 * and the API route's validation — one list, so the dialog can never offer a
 * reason the server rejects.
 */
export const PRODUCT_REPORT_REASONS = [
  { value: "COUNTERFEIT", label: "Counterfeit", hint: "Claims a brand it isn't" },
  { value: "PROHIBITED", label: "Prohibited item", hint: "Can't legally be sold here" },
  { value: "MISLEADING", label: "Misleading", hint: "Photos or description don't match" },
  { value: "WRONG_CATEGORY", label: "Wrong category", hint: "Listed where it doesn't belong" },
  { value: "OFFENSIVE", label: "Offensive", hint: "Inappropriate content" },
  { value: "OTHER", label: "Something else", hint: "Tell us in your own words" },
] as const;

export type ProductReportReason = (typeof PRODUCT_REPORT_REASONS)[number]["value"];

export const PRODUCT_REPORT_REASON_VALUES = PRODUCT_REPORT_REASONS.map((r) => r.value) as unknown as [
  ProductReportReason,
  ...ProductReportReason[],
];
