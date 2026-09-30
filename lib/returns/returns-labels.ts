/**
 * Client-safe mirror of the return-reason labels in lib/returns/returns.ts.
 * Keep in sync — the server module pulls in Prisma and cannot be imported by
 * a client component.
 */
export const RETURN_REASON_LABELS: Record<string, string> = {
  NOT_AS_DESCRIBED: "Not as described",
  DEFECTIVE: "Defective",
  WRONG_ITEM: "Wrong item",
  NO_LONGER_NEEDED: "No longer needed",
  BETTER_PRICE_ELSEWHERE: "Found a better price",
  DAMAGED_IN_TRANSIT: "Damaged in transit",
  OTHER: "Other",
};

export function returnReasonLabel(reason: string): string {
  return RETURN_REASON_LABELS[reason] ?? reason;
}
