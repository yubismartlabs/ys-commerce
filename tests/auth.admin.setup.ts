import { test as setup } from "@playwright/test";
import { signIn, ADMIN } from "./helpers/auth";

setup("sign in as an admin", async ({ page }) => {
  await signIn(page, ADMIN, "admin");
});
