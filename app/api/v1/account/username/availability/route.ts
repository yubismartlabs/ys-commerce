import { z } from "zod";
import { fail, ok } from "@/lib/api/http";
import { checkUsername, usernameErrorMessage } from "@/lib/usernames";
import { findHandleOwner, getReservedUsernames } from "@/lib/usernames-server";

const querySchema = z.object({ username: z.string().min(1).max(30) });

/**
 * Public availability check for handle fields (user handle at store
 * creation, store @username, admin renames). Checks the shared user+store
 * namespace — a handle taken by either is unavailable to both.
 * Rate-limited by the shared API budget; returns { available, value?, reason? }.
 * Deliberately unauthenticated so onboarding forms can check live —
 * it reveals only whether a handle is taken, like any signup form.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ username: url.searchParams.get("username") ?? "" });
  if (!parsed.success) return fail("VALIDATION", "username query param required", 422);

  const reserved = await getReservedUsernames();
  const checked = checkUsername(parsed.data.username, reserved);
  if (!checked.ok) {
    return ok({ available: false, reason: checked.reason, message: usernameErrorMessage(checked.reason) });
  }
  // Shared namespace: taken by a user OR a store both count as taken.
  const taken = await findHandleOwner(checked.value);
  if (taken) {
    return ok({ available: false, reason: "TAKEN", message: usernameErrorMessage("TAKEN") });
  }
  return ok({ available: true, value: checked.value });
}
