import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "../db-url";

/**
 * Direct database access, bound to the throwaway E2E database.
 *
 * Used only for time-travel fixtures. The settlement gates are defined in
 * terms of elapsed time — `protectionUntil` versus the settling buffer, a
 * payout's age versus the payout cadence — and the API deliberately exposes no
 * way to set those timestamps. Waiting fourteen days is not an option, so the
 * fixtures backdate the rows instead.
 *
 * Nothing here may assert on results: assertions belong in the spec, against
 * what the API returns. This exists to arrange the starting state.
 */
export const db = new PrismaClient({ datasourceUrl: testDatabaseUrl() });

const DAY = 24 * 60 * 60 * 1000;

export function daysAgo(n: number) {
  return new Date(Date.now() - n * DAY);
}
