import { test as setup } from "@playwright/test";
import { signIn } from "./helpers/auth";

/** A second seller, so cross-store authorization can actually be exercised. */
setup("sign in as a second seller", async ({ page }) => {
  await signIn(page, { email: "seller2@ys.local", password: "seller123" }, "seller2");
});
